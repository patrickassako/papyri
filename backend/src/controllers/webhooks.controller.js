/**
 * Webhooks Controller
 * Gestion des webhooks de paiement (Flutterwave + Stripe)
 */

const flutterwaveService = require('../services/flutterwave.service');
const stripeService = require('../services/stripe.service');
const subscriptionsService = require('../services/subscriptions.service');
const { sendPaymentConfirmationEmail, sendSubscriptionConfirmationEmail, sendInvoiceEmail, sendRenewalReminderEmail, sendPaymentFailedEmail } = require('../services/email.service');
const { generateInvoicePDFBuffer, buildInvoiceNumber } = require('../services/invoice.service');
const { getSettings } = require('../services/settings.service');
const { supabaseAdmin } = require('../config/database');

/**
 * POST /webhooks/flutterwave
 * Handle Flutterwave webhook events
 *
 * Events:
 * - charge.completed: Payment successful
 * - charge.failed: Payment failed
 * - charge.pending: Payment pending
 */
async function handleFlutterwaveWebhook(req, res) {
  try {
    const signature = req.headers['verif-hash'];
    const payload = req.body;

    console.log('📥 Flutterwave webhook received:', {
      event: payload.event,
      txRef: payload.data?.tx_ref,
      status: payload.data?.status,
    });

    // Verify webhook signature
    const isValid = flutterwaveService.verifyWebhookSignature(payload, signature);
    if (!isValid) {
      console.error('❌ Invalid webhook signature');
      return res.status(401).json({
        success: false,
        error: 'Invalid signature',
      });
    }

    // Check for duplicate webhook (idempotency)
    const eventId = payload.id || payload.data?.id;
    if (!eventId) {
      console.error('❌ No event ID in webhook payload');
      return res.status(400).json({
        success: false,
        error: 'Missing event ID',
      });
    }

    // Check if event already processed
    const { data: existingEvent } = await supabaseAdmin
      .from('webhook_events')
      .select('id, processed')
      .eq('provider', 'flutterwave')
      .eq('event_id', String(eventId))
      .single();

    if (existingEvent && existingEvent.processed) {
      console.log('⚠️  Webhook already processed, skipping');
      return res.status(200).json({
        success: true,
        message: 'Webhook already processed',
      });
    }

    // Store webhook event
    const webhookRecord = {
      provider: 'flutterwave',
      event_id: String(eventId),
      event_type: payload.event,
      payload: payload,
      processed: false,
    };

    if (!existingEvent) {
      await supabaseAdmin.from('webhook_events').insert(webhookRecord);
    }

    // Handle different event types
    const eventType = payload.event;
    const data = payload.data;

    switch (eventType) {
      case 'charge.completed':
        await handleChargeCompleted(data, eventId);
        break;

      case 'charge.failed':
        await handleChargeFailed(data, eventId);
        break;

      case 'charge.pending':
        console.log('ℹ️  Charge pending, waiting for completion');
        break;

      default:
        console.log(`⚠️  Unhandled event type: ${eventType}`);
    }

    // Mark webhook as processed
    await supabaseAdmin
      .from('webhook_events')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('event_id', String(eventId))
      .eq('provider', 'flutterwave');

    console.log('✅ Webhook processed successfully');

    // Always return 200 to acknowledge receipt
    res.status(200).json({
      success: true,
      message: 'Webhook processed',
    });
  } catch (error) {
    console.error('❌ Webhook processing error:', error);

    // Log error to webhook_events
    const eventId = req.body?.id || req.body?.data?.id;
    if (eventId) {
      await supabaseAdmin
        .from('webhook_events')
        .update({ error_message: error.message })
        .eq('event_id', String(eventId))
        .eq('provider', 'flutterwave');
    }

    // Always return 200 to avoid retries
    res.status(200).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Handle charge.completed event
 * Activate subscription when payment succeeds
 */
async function handleChargeCompleted(data, eventId) {
  try {
    const txRef = data.tx_ref;
    const status = data.status;
    const amount = data.amount;
    const currency = data.currency;

    console.log(`💰 Processing completed charge: ${txRef}`);

    // Only process if status is 'successful'
    if (status !== 'successful') {
      console.log(`⚠️  Charge status is ${status}, not successful`);
      return;
    }

    // Find payment record by tx_ref
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('provider_payment_id', txRef)
      .single();

    if (paymentError || !payment) {
      console.error('❌ Payment record not found for tx_ref:', txRef);
      throw new Error('Payment record not found');
    }

    // Check if payment already succeeded
    if (payment.status !== 'succeeded') {
      await subscriptionsService.updatePaymentStatus(payment.id, 'succeeded');
    } else {
      console.log('⚠️  Payment already marked as succeeded');
    }

    const paymentType = payment.metadata?.payment_type;

    if (paymentType === 'content_unlock') {
      console.log(`ℹ️  Content unlock payment confirmed: ${txRef}`);
      return;
    }

    if (paymentType === 'extra_seat') {
      const targetUsersLimit = Number(payment.metadata?.target_users_limit || 0);
      if (payment.subscription_id && targetUsersLimit > 0) {
        await subscriptionsService.applyExtraSeat(payment.subscription_id, targetUsersLimit);
      }
      return;
    }

    if (!payment.subscription_id) {
      console.log(`ℹ️  No subscription linked to payment ${payment.id}, nothing to activate`);
      return;
    }

    const updatedSubscription = await subscriptionsService.applySuccessfulSubscriptionPayment(payment.subscription_id);
    console.log(`✅ Subscription ${updatedSubscription.id} active until ${updatedSubscription.current_period_end}`);

    // Send payment confirmation email
    try {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('email, full_name')
        .eq('id', payment.user_id)
        .maybeSingle();

      if (profile) {
        const planName = updatedSubscription.plan_snapshot?.name || updatedSubscription.plan_type || 'Abonnement';
        // Confirmation paiement
        sendPaymentConfirmationEmail(
          profile.email, profile.full_name || profile.email, planName, amount, currency
        ).catch(e => console.error('📧 sendPaymentConfirmation:', e.message));

        // Confirmation abonnement
        sendSubscriptionConfirmationEmail(profile.email, profile.full_name || profile.email, {
          planName,
          amount: (amount / 100).toFixed(2),
          currency,
          endDate: updatedSubscription.end_date,
        }).catch(e => console.error('📧 sendSubscriptionConfirmation:', e.message));

        // Facture PDF par email
        getSettings().then(settings =>
          generateInvoicePDFBuffer({
            payment: { id: payment.id, amount: amount / 100, currency, status: 'succeeded', paid_at: new Date().toISOString(), provider: 'stripe', metadata: payment.metadata || {} },
            user: { email: profile.email, full_name: profile.full_name },
            subscription: updatedSubscription,
            settings,
          }).then(pdfBuffer => {
            const invoiceNumber = buildInvoiceNumber(payment.id, new Date().toISOString(), settings.invoice_prefix || 'INV');
            return sendInvoiceEmail(profile.email, profile.full_name, { invoiceNumber, pdfBuffer });
          })
        ).catch(e => console.error('📧 sendInvoiceEmail:', e.message));
      }
    } catch (emailErr) {
      console.error('📧 Email sending failed (non-blocking):', emailErr.message);
    }
  } catch (error) {
    console.error('❌ Error handling charge.completed:', error);
    throw error;
  }
}

/**
 * Handle charge.failed event
 * Mark payment as failed
 */
async function handleChargeFailed(data, eventId) {
  try {
    const txRef = data.tx_ref;
    const status = data.status;

    console.log(`💔 Processing failed charge: ${txRef}`);

    // Find payment record
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('provider_payment_id', txRef)
      .single();

    if (paymentError || !payment) {
      console.error('❌ Payment record not found for tx_ref:', txRef);
      throw new Error('Payment record not found');
    }

    if (payment.status !== 'failed') {
      await subscriptionsService.updatePaymentStatus(payment.id, 'failed', 'Payment failed');
    }

    // Track failure in subscription metadata + notify user
    if (payment.user_id) {
      // Update subscription metadata with payment_failed_at
      if (payment.subscription_id) {
        const { data: sub } = await supabaseAdmin
          .from('subscriptions')
          .select('metadata')
          .eq('id', payment.subscription_id)
          .maybeSingle();
        if (sub) {
          const existingMeta = sub.metadata || {};
          await supabaseAdmin
            .from('subscriptions')
            .update({
              metadata: {
                ...existingMeta,
                payment_failed_at: existingMeta.payment_failed_at || new Date().toISOString(),
                failure_count: (existingMeta.failure_count || 0) + 1,
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', payment.subscription_id);
        }
      }

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('email, full_name')
        .eq('id', payment.user_id)
        .maybeSingle();
      if (profile?.email) {
        const retryUrl = `${require('../config/env').frontendUrl || 'http://localhost:3000'}/subscription`;
        sendPaymentFailedEmail(profile.email, profile.full_name || profile.email, {
          planName: payment.metadata?.plan_name || 'Abonnement',
          retryUrl,
        }).catch(e => console.error('📧 sendPaymentFailedEmail (Flutterwave):', e.message));
      }
    }

    console.log('📧 Payment failure recorded for', txRef);
  } catch (error) {
    console.error('❌ Error handling charge.failed:', error);
    throw error;
  }
}

/**
 * POST /webhooks/stripe
 * Handle Stripe webhook events (checkout.session.completed, etc.)
 *
 * IMPORTANT: This route must receive the RAW body (Buffer), NOT the parsed JSON body.
 * Mount it BEFORE express.json() in index.js using express.raw({ type: 'application/json' }).
 */
async function handleStripeWebhook(req, res) {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripeService.constructWebhookEvent(req.body, sig);
  } catch (err) {
    console.error('❌ Stripe webhook signature verification failed:', err.message);
    return res.status(400).send(`Stripe Webhook Error: ${err.message}`);
  }

  const eventId = event.id;
  console.log('📥 Stripe webhook received:', { type: event.type, id: eventId });

  // Idempotency check
  const { data: existingEvent } = await supabaseAdmin
    .from('webhook_events')
    .select('id, processed')
    .eq('provider', 'stripe')
    .eq('event_id', eventId)
    .maybeSingle();

  if (existingEvent?.processed) {
    console.log('⚠️  Stripe webhook already processed, skipping:', eventId);
    return res.status(200).json({ success: true, message: 'Already processed' });
  }

  // Store event record
  if (!existingEvent) {
    await supabaseAdmin.from('webhook_events').insert({
      provider: 'stripe',
      event_id: eventId,
      event_type: event.type,
      payload: event,
      processed: false,
    });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleStripeCheckoutCompleted(event.data.object);
        break;

      case 'checkout.session.expired':
        await handleStripeCheckoutExpired(event.data.object);
        break;

      // Subscription renewed — Stripe automatically charged the card
      case 'invoice.payment_succeeded':
        await handleStripeInvoicePaymentSucceeded(event.data.object);
        break;

      // Renewal failed — Stripe will retry, notify user
      case 'invoice.payment_failed':
        await handleStripeInvoicePaymentFailed(event.data.object);
        break;

      // Subscription cancelled (end of period or immediately)
      case 'customer.subscription.deleted':
        await handleStripeSubscriptionDeleted(event.data.object);
        break;

      // cancel_at_period_end toggled
      case 'customer.subscription.updated':
        await handleStripeSubscriptionUpdated(event.data.object);
        break;

      default:
        console.log(`⚠️  Unhandled Stripe event type: ${event.type}`);
    }

    // Mark processed
    await supabaseAdmin
      .from('webhook_events')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('event_id', eventId)
      .eq('provider', 'stripe');

    console.log('✅ Stripe webhook processed:', eventId);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ Stripe webhook processing error:', error);
    await supabaseAdmin
      .from('webhook_events')
      .update({ error_message: error.message })
      .eq('event_id', eventId)
      .eq('provider', 'stripe');
    // Return 200 to avoid Stripe retries on non-transient errors
    return res.status(200).json({ success: false, error: error.message });
  }
}

/**
 * Handle checkout.session.completed
 * Activate the subscription when Stripe confirms payment
 */
async function handleStripeCheckoutCompleted(session) {
  const { subscription_id, user_id, payment_type } = session.metadata || {};
  console.log(`💳 Stripe checkout completed — session: ${session.id}, user: ${user_id}`);

  // Only process paid sessions
  if (session.payment_status !== 'paid') {
    console.log(`⚠️  Stripe session payment_status=${session.payment_status}, skipping`);
    return;
  }

  // Find the payment record created during checkout initiation
  const { data: payment } = await supabaseAdmin
    .from('payments')
    .select('*')
    .eq('provider_payment_id', session.id)
    .maybeSingle();

  if (!payment) {
    console.error('❌ No payment record found for Stripe session:', session.id);
    throw new Error(`Payment not found for Stripe session ${session.id}`);
  }

  // Mark payment as succeeded
  if (payment.status !== 'succeeded') {
    await subscriptionsService.updatePaymentStatus(payment.id, 'succeeded');
  }

  if (payment_type === 'content_unlock') {
    console.log(`ℹ️  Content unlock payment confirmed via Stripe: ${session.id}`);
    return;
  }

  if (payment_type === 'extra_seat') {
    const targetUsersLimit = Number(session.metadata?.users_limit || payment.metadata?.target_users_limit || 0);
    if (payment.subscription_id && targetUsersLimit > 0) {
      await subscriptionsService.applyExtraSeat(payment.subscription_id, targetUsersLimit);
    }
    return;
  }

  if (!payment.subscription_id) {
    console.log(`ℹ️  No subscription linked to payment ${payment.id}`);
    return;
  }

  const updatedSubscription = await subscriptionsService.applySuccessfulSubscriptionPayment(
    payment.subscription_id
  );
  console.log(`✅ Subscription ${updatedSubscription.id} activated until ${updatedSubscription.current_period_end}`);

  // Send confirmation email
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name')
      .eq('id', user_id || payment.user_id)
      .maybeSingle();

    if (profile?.email) {
      const planName = updatedSubscription.plan_snapshot?.name || updatedSubscription.plan_type || 'Abonnement';
      const amountMajor = (session.amount_total || 0) / 100;
      await sendPaymentConfirmationEmail(
        profile.email,
        profile.full_name || profile.email,
        planName,
        amountMajor,
        (session.currency || 'usd').toUpperCase()
      );
    }
  } catch (emailErr) {
    console.error('📧 Email sending failed (non-blocking):', emailErr.message);
  }
}

/**
 * Handle checkout.session.expired
 * Mark payment as failed when session expires without payment
 */
async function handleStripeCheckoutExpired(session) {
  console.log(`⏰ Stripe session expired: ${session.id}`);
  const { data: payment } = await supabaseAdmin
    .from('payments')
    .select('id, status')
    .eq('provider_payment_id', session.id)
    .maybeSingle();

  if (payment && payment.status === 'pending') {
    await subscriptionsService.updatePaymentStatus(payment.id, 'failed', 'Stripe session expired');
  }
}

/**
 * Handle invoice.payment_succeeded
 * Fired on initial payment AND every automatic renewal.
 * For renewals: extend subscription period in DB + send confirmation email + invoice.
 */
async function handleStripeInvoicePaymentSucceeded(invoice) {
  // billing_reason: 'subscription_create' (initial) | 'subscription_cycle' (renewal) | 'subscription_update'
  const billingReason = invoice.billing_reason;
  const stripeSubId = invoice.subscription;
  const customerId = invoice.customer;

  console.log(`💳 Stripe invoice paid — reason: ${billingReason}, sub: ${stripeSubId}`);

  // Skip initial creation — handled by checkout.session.completed
  if (billingReason === 'subscription_create') {
    console.log('ℹ️  Initial subscription payment — handled by checkout.session.completed');
    return;
  }

  if (!stripeSubId) {
    console.log('ℹ️  No subscription linked to invoice, skipping');
    return;
  }

  // Find internal subscription by provider_subscription_id
  const { data: subscription } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('provider_subscription_id', stripeSubId)
    .maybeSingle();

  if (!subscription) {
    console.error('❌ No internal subscription found for Stripe sub:', stripeSubId);
    return;
  }

  // Get new period from Stripe subscription
  const stripeSub = await stripeService.retrieveSubscription(stripeSubId);
  const updatedSub = await subscriptionsService.renewSubscription(
    subscription.id,
    new Date(stripeSub.currentPeriodEnd)
  );

  // Clear any payment failure tracking (retry succeeded)
  const meta = subscription.metadata || {};
  if (meta.payment_failed_at) {
    await supabaseAdmin
      .from('subscriptions')
      .update({
        metadata: {
          ...meta,
          payment_failed_at: null,
          failure_count: null,
          last_failure_reminder_at: null,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription.id);
  }

  console.log(`🔄 Subscription ${subscription.id} renewed until ${updatedSub.current_period_end}`);

  // Record renewal payment
  const amountMajor = invoice.amount_paid / 100;
  const currency = invoice.currency?.toUpperCase() || 'EUR';

  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name')
      .eq('id', subscription.user_id)
      .maybeSingle();

    if (profile?.email) {
      const planName = subscription.plan_snapshot?.name || subscription.plan_type || 'Abonnement';

      // Confirmation de paiement
      sendPaymentConfirmationEmail(profile.email, profile.full_name || profile.email, planName, amountMajor, currency)
        .catch(e => console.error('📧 sendPaymentConfirmation (renewal):', e.message));

      // Confirmation abonnement renouvelé
      sendSubscriptionConfirmationEmail(profile.email, profile.full_name || profile.email, {
        planName,
        amount: amountMajor.toFixed(2),
        currency,
        endDate: updatedSub.current_period_end,
      }).catch(e => console.error('📧 sendSubscriptionConfirmation (renewal):', e.message));
    }
  } catch (emailErr) {
    console.error('📧 Renewal email failed (non-blocking):', emailErr.message);
  }
}

/**
 * Handle invoice.payment_failed
 * Stripe will retry automatically. We just notify the user.
 */
async function handleStripeInvoicePaymentFailed(invoice) {
  const stripeSubId = invoice.subscription;
  console.log(`❌ Stripe invoice payment failed — sub: ${stripeSubId}`);

  if (!stripeSubId) return;

  const { data: subscription } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('provider_subscription_id', stripeSubId)
    .maybeSingle();

  if (!subscription) return;

  // Track failure in metadata (used by scheduler grace period logic)
  const existingMeta = subscription.metadata || {};
  if (!existingMeta.payment_failed_at) {
    await supabaseAdmin
      .from('subscriptions')
      .update({
        metadata: {
          ...existingMeta,
          payment_failed_at: new Date().toISOString(),
          failure_count: 1,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription.id);
  } else {
    await supabaseAdmin
      .from('subscriptions')
      .update({
        metadata: {
          ...existingMeta,
          failure_count: (existingMeta.failure_count || 0) + 1,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription.id);
  }

  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name')
      .eq('id', subscription.user_id)
      .maybeSingle();

    if (profile?.email) {
      const retryUrl = `${config.frontendUrl || 'http://localhost:3000'}/subscription`;
      const planName = subscription.plan_snapshot?.name || subscription.plan_type || 'Abonnement';

      sendPaymentFailedEmail(profile.email, profile.full_name || profile.email, {
        planName,
        retryUrl,
      }).catch(e => console.error('📧 sendPaymentFailedEmail (Stripe):', e.message));
    }
  } catch (emailErr) {
    console.error('📧 Payment failed email error (non-blocking):', emailErr.message);
  }
}

/**
 * Handle customer.subscription.deleted
 * Fired when Stripe subscription is cancelled (end of period or immediately).
 */
async function handleStripeSubscriptionDeleted(stripeSub) {
  console.log(`🗑️  Stripe subscription deleted: ${stripeSub.id}`);

  const { data: subscription } = await supabaseAdmin
    .from('subscriptions')
    .select('id, status')
    .eq('provider_subscription_id', stripeSub.id)
    .maybeSingle();

  if (!subscription) {
    console.log('⚠️  No internal subscription found for deleted Stripe sub:', stripeSub.id);
    return;
  }

  if (subscription.status !== 'CANCELLED') {
    await supabaseAdmin
      .from('subscriptions')
      .update({
        status: 'CANCELLED',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription.id);

    console.log(`✅ Subscription ${subscription.id} marked CANCELLED`);
  }
}

/**
 * Handle customer.subscription.updated
 * Tracks cancel_at_period_end changes (user cancelled or reactivated).
 */
async function handleStripeSubscriptionUpdated(stripeSub) {
  console.log(`🔄 Stripe subscription updated: ${stripeSub.id}, cancel_at_period_end=${stripeSub.cancel_at_period_end}`);

  const { data: subscription } = await supabaseAdmin
    .from('subscriptions')
    .select('id')
    .eq('provider_subscription_id', stripeSub.id)
    .maybeSingle();

  if (!subscription) return;

  await supabaseAdmin
    .from('subscriptions')
    .update({
      cancel_at_period_end: stripeSub.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscription.id);
}

/**
 * Test endpoint to check webhook configuration
 * GET /webhooks/test
 */
async function testWebhook(req, res) {
  res.status(200).json({
    success: true,
    message: 'Webhook endpoint is working',
    timestamp: new Date().toISOString(),
    providers: ['flutterwave', 'stripe'],
  });
}

module.exports = {
  handleFlutterwaveWebhook,
  handleStripeWebhook,
  testWebhook,
};
