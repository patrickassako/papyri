/**
 * Webhooks Controller
 * Gestion des webhooks de paiement (Flutterwave)
 */

const flutterwaveService = require('../services/flutterwave.service');
const subscriptionsService = require('../services/subscriptions.service');
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

    if (!payment.subscription_id) {
      console.log(`ℹ️  No subscription linked to payment ${payment.id}, nothing to activate`);
      return;
    }

    const updatedSubscription = await subscriptionsService.applySuccessfulSubscriptionPayment(payment.subscription_id);
    console.log(`✅ Subscription ${updatedSubscription.id} active until ${updatedSubscription.current_period_end}`);

    // TODO: Send confirmation email to user
    console.log('📧 TODO: Send subscription confirmation email');
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

    // TODO: Send failure notification email
    console.log('📧 TODO: Send payment failure email');
  } catch (error) {
    console.error('❌ Error handling charge.failed:', error);
    throw error;
  }
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
    provider: 'flutterwave',
  });
}

module.exports = {
  handleFlutterwaveWebhook,
  testWebhook,
};
