/**
 * Subscriptions Controller
 * Gestion des endpoints API pour les abonnements
 */

const subscriptionsService = require('../services/subscriptions.service');
const flutterwaveService = require('../services/flutterwave.service');
const stripeService = require('../services/stripe.service');
const promoService = require('../services/promo.service');
const familyProfilesService = require('../services/family-profiles.service');
const { generateInvoicePDF, generateInvoicePDFBuffer, buildInvoiceNumber } = require('../services/invoice.service');
const { getSettings } = require('../services/settings.service');
const { supabaseAdmin } = require('../config/database');
const config = require('../config/env');
const { sendSubscriptionConfirmationEmail, sendInvoiceEmail } = require('../services/email.service');
const MAX_FAMILY_SEATS = 10;

/**
 * GET /api/subscriptions/plans
 * Get available subscription plans (public)
 */
// Currency info per geo zone
const ZONE_CURRENCY = {
  africa:        { code: 'XAF', symbol: 'XAF', rateToCent: 6.5596, label: 'Franc CFA' }, // 1 EUR = 655.96 XAF → 1 EUR-cent ≈ 6.5596 XAF
  europe:        { code: 'EUR', symbol: '€',   rateToCent: 1,      label: 'Euro' },
  north_america: { code: 'USD', symbol: '$',   rateToCent: 1.08,   label: 'Dollar US' }, // approx
  south_america: { code: 'USD', symbol: '$',   rateToCent: 1.08,   label: 'Dollar US' },
  asia:          { code: 'USD', symbol: '$',   rateToCent: 1.08,   label: 'Dollar US' },
  middle_east:   { code: 'USD', symbol: '$',   rateToCent: 1.08,   label: 'Dollar US' },
  oceania:       { code: 'AUD', symbol: 'A$',  rateToCent: 1.62,   label: 'Dollar AUS' },
};

async function getPlans(req, res) {
  try {
    const plans = await subscriptionsService.getPlans();

    // Detect user zone for currency localisation (best-effort)
    let geo = { zone: null, country: null };
    try {
      const { getGeoFromRequest } = require('../services/geo.service');
      geo = getGeoFromRequest(req);
    } catch (_) {}

    const zoneCurrency = (geo.zone && ZONE_CURRENCY[geo.zone]) ? ZONE_CURRENCY[geo.zone] : null;

    const enrichedPlans = plans.map((plan) => {
      if (!zoneCurrency || zoneCurrency.code === (plan.currency || 'EUR')) return plan;
      return {
        ...plan,
        localizedCurrency: zoneCurrency.code,
        localizedSymbol: zoneCurrency.symbol,
        localizedPriceCents: Math.round((plan.basePriceCents || 0) * zoneCurrency.rateToCent),
        localizedExtraUserPriceCents: Math.round((plan.extraUserPriceCents || 0) * zoneCurrency.rateToCent),
      };
    });

    res.status(200).json({
      success: true,
      plans: enrichedPlans,
      geo: { zone: geo.zone, country: geo.country, currency: zoneCurrency?.code || null },
    });
  } catch (error) {
    console.error('❌ Get plans error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get plans',
      message: error.message,
    });
  }
}

/**
 * GET /api/subscriptions/me
 * Get current user's active subscription
 */
async function getMySubscription(req, res) {
  try {
    const userId = req.user.id;

    const status = await subscriptionsService.checkSubscriptionStatus(userId);

    res.status(200).json({
      success: true,
      ...status,
    });
  } catch (error) {
    console.error('❌ Get my subscription error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get subscription',
      message: error.message,
    });
  }
}

/**
 * GET /api/subscriptions/all
 * Get all user's subscriptions (including expired/cancelled)
 */
async function getAllMySubscriptions(req, res) {
  try {
    const userId = req.user.id;

    const subscriptions = await subscriptionsService.getUserSubscriptions(userId);

    res.status(200).json({
      success: true,
      subscriptions,
      count: subscriptions.length,
    });
  } catch (error) {
    console.error('❌ Get all subscriptions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get subscriptions',
      message: error.message,
    });
  }
}

/**
 * POST /api/subscriptions/checkout
 * Initiate subscription payment via Flutterwave (mobile money) or Stripe (card)
 *
 * Body: {
 *   planCode?: string,
 *   planId?: string,
 *   usersLimit?: number,
 *   provider?: 'flutterwave' | 'stripe'  // default: 'flutterwave'
 * }
 */
async function initiateCheckout(req, res) {
  try {
    const userId = req.user.id;
    const { planCode, planId, usersLimit, provider = 'flutterwave', promoCode } = req.body;
    console.log('[subscriptions.checkout] start', { userId, planCode, planId, usersLimit, provider, promoCode: promoCode || null });

    // Validate plan
    const plan = await subscriptionsService.getPlan(planId || planCode);
    if (!plan) {
      return res.status(400).json({
        success: false,
        error: 'Invalid plan',
        message: 'Selected subscription plan is invalid or inactive',
      });
    }

    // Check if user already has an active OR pending subscription (prevent duplicate checkouts)
    const existingSubscription = await subscriptionsService.getUserSubscription(userId);
    if (existingSubscription) {
      return res.status(400).json({
        success: false,
        error: 'Active subscription exists',
        message: 'You already have an active subscription. Please cancel it first.',
      });
    }
    const { data: pendingSub } = await supabaseAdmin
      .from('subscriptions')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'INACTIVE')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pendingSub) {
      return res.status(400).json({
        success: false,
        error: 'Pending subscription exists',
        message: 'You already have a pending payment in progress. Please complete or wait for it to expire.',
      });
    }

    // Resolve payer identity from authenticated user + optional profile fallback.
    let payerEmail = req.user?.email || null;
    let payerName = req.user?.full_name || null;

    if (!payerName) {
      const { data: profileData } = await supabaseAdmin
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .maybeSingle();
      payerName = profileData?.full_name || null;
    }

    if (!payerEmail) {
      return res.status(400).json({
        success: false,
        error: 'Missing user email',
        message: 'Authenticated user email is required to initiate payment',
      });
    }

    // Validate provider choice
    const resolvedProvider = provider === 'stripe' ? 'stripe' : 'flutterwave';

    if (resolvedProvider === 'flutterwave' && !flutterwaveService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Payment provider not configured',
        message: 'Flutterwave is not configured. Set FLUTTERWAVE_PUBLIC_KEY and FLUTTERWAVE_SECRET_KEY in backend env.',
      });
    }

    if (resolvedProvider === 'stripe' && !stripeService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Payment provider not configured',
        message: 'Stripe is not configured. Set STRIPE_SECRET_KEY in backend env.',
      });
    }

    // Valider et appliquer le code promo si fourni
    let promoResult = null;
    if (promoCode) {
      const normalizedUsersLimit = Number(usersLimit || plan.includedUsers || 1);
      const baseAmountCents = subscriptionsService.computeSubscriptionAmountCents(plan, normalizedUsersLimit);
      try {
        promoResult = await promoService.validatePromoCode(promoCode, plan.slug, userId, baseAmountCents);
        console.log('[subscriptions.checkout] promo applied:', {
          code: promoResult.code,
          discountCents: promoResult.discountCents,
          finalAmountCents: promoResult.finalAmountCents,
        });
      } catch (promoError) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_PROMO_CODE',
          message: promoService.getPromoErrorMessage(promoError.message),
        });
      }
    }

    // Create subscription record (INACTIVE until webhook confirms payment)
    const subscription = await subscriptionsService.createSubscription({
      userId,
      planId: plan.id,
      usersLimit,
      provider: resolvedProvider,
      providerData: {},
      overrideAmountCents: promoResult ? promoResult.finalAmountCents : null,
    });

    const requestOrigin = req.headers.origin;
    const redirectBaseUrl = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(String(requestOrigin || ''))
      ? requestOrigin
      : undefined;

    // ---- Flutterwave path ----
    if (resolvedProvider === 'flutterwave') {
      const payment = await flutterwaveService.initiatePayment({
        amount: subscription.amount,
        currency: subscription.currency,
        email: payerEmail,
        name: payerName || payerEmail,
        planCode: plan.slug,
        planName: plan.name,
        usersLimit: subscription.users_limit,
        userId,
        redirectBaseUrl,
      });

      await subscriptionsService.createPayment({
        userId,
        subscriptionId: subscription.id,
        amount: subscription.amount,
        currency: subscription.currency,
        status: 'pending',
        provider: 'flutterwave',
        providerPaymentId: payment.reference,
        providerCustomerId: null,
        paymentMethod: 'mobile_money',
        metadata: {
          payment_type: 'subscription_initial',
          tx_ref: payment.reference,
          plan_id: plan.id,
          plan_code: plan.slug,
          users_limit: subscription.users_limit,
          promo_code: promoResult?.code || null,
          discount_cents: promoResult?.discountCents || 0,
        },
      });

      // Enregistrer l'utilisation du code promo (non bloquant)
      if (promoResult) {
        promoService.recordUsage(promoResult.promoId, userId, subscription.id, promoResult.discountCents)
          .catch((err) => console.error('[promo] recordUsage error (flutterwave):', err.message));
      }

      return res.status(200).json({
        success: true,
        provider: 'flutterwave',
        paymentLink: payment.link,
        reference: payment.reference,
        subscription: {
          id: subscription.id,
          planId: subscription.plan_id,
          planCode: subscription.plan_type,
          planName: plan.name,
          usersLimit: subscription.users_limit,
          amount: subscription.amount,
          currency: subscription.currency,
          status: subscription.status,
        },
      });
    }

    // ---- Stripe path ----
    // Convert major-unit amount to cents for Stripe
    const amountMajor = Number(subscription.amount);
    const amountCents = Math.round(amountMajor >= 100 ? amountMajor : amountMajor * 100);

    // Reuse existing Stripe customer ID if the user had a prior Stripe subscription
    const { data: prevStripeSub } = await supabaseAdmin
      .from('subscriptions')
      .select('provider_customer_id')
      .eq('user_id', userId)
      .eq('provider', 'stripe')
      .not('provider_customer_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const stripeCustomerId = prevStripeSub?.provider_customer_id || null;

    const stripeSession = await stripeService.createCheckoutSession({
      userId,
      subscriptionId: subscription.id,
      planId: plan.id,
      planCode: plan.slug,
      planName: plan.name,
      amountCents,
      currency: subscription.currency,
      usersLimit: subscription.users_limit,
      customerEmail: payerEmail,
      stripeCustomerId,
      paymentType: 'subscription_initial',
      redirectBaseUrl,
    });

    await subscriptionsService.createPayment({
      userId,
      subscriptionId: subscription.id,
      amount: subscription.amount,
      currency: subscription.currency,
      status: 'pending',
      provider: 'stripe',
      providerPaymentId: stripeSession.sessionId,
      providerCustomerId: null,
      paymentMethod: 'card',
      metadata: {
        payment_type: 'subscription_initial',
        stripe_session_id: stripeSession.sessionId,
        plan_id: plan.id,
        plan_code: plan.slug,
        users_limit: subscription.users_limit,
        promo_code: promoResult?.code || null,
        discount_cents: promoResult?.discountCents || 0,
      },
    });

    // Enregistrer l'utilisation du code promo (non bloquant)
    if (promoResult) {
      promoService.recordUsage(promoResult.promoId, userId, subscription.id, promoResult.discountCents)
        .catch((err) => console.error('[promo] recordUsage error (stripe):', err.message));
    }

    return res.status(200).json({
      success: true,
      provider: 'stripe',
      paymentLink: stripeSession.sessionUrl,
      reference: stripeSession.sessionId,
      subscription: {
        id: subscription.id,
        planId: subscription.plan_id,
        planCode: subscription.plan_type,
        planName: plan.name,
        usersLimit: subscription.users_limit,
        amount: subscription.amount,
        currency: subscription.currency,
        status: subscription.status,
      },
    });
  } catch (error) {
    console.error('❌ Initiate checkout error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate checkout',
      message: error.message,
    });
  }
}

/**
 * POST /api/subscriptions/cancel
 * Cancel current user's subscription
 *
 * Body: {
 *   immediately?: boolean  // Default: false (cancel at period end)
 * }
 */
async function cancelSubscription(req, res) {
  try {
    const userId = req.user.id;
    const { immediately = false } = req.body;

    const subscription = await subscriptionsService.getUserSubscription(userId);
    if (!subscription) {
      return res.status(404).json({ success: false, error: 'Aucun abonnement actif.' });
    }

    // For Stripe subscriptions: cancel via Stripe API (at period end)
    if (subscription.provider === 'stripe' && subscription.provider_subscription_id) {
      if (immediately) {
        // Immediately cancel via Stripe
        const stripe = require('stripe')(config.stripe?.secretKey);
        await stripe.subscriptions.cancel(subscription.provider_subscription_id);
      } else {
        await stripeService.cancelSubscriptionAtPeriodEnd(subscription.provider_subscription_id);
      }
      // DB update will come via webhook (customer.subscription.updated / deleted)
      // But update locally too for immediate UX
    }

    const updatedSubscription = await subscriptionsService.cancelSubscription(subscription.id, immediately);

    res.status(200).json({
      success: true,
      message: immediately
        ? 'Abonnement annulé immédiatement.'
        : 'Abonnement annulé — accès conservé jusqu\'à la fin de la période.',
      subscription: updatedSubscription,
    });
  } catch (error) {
    console.error('❌ Cancel subscription error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/subscriptions/reactivate
 * Reactivate a Stripe subscription scheduled for cancellation
 */
async function reactivateSubscription(req, res) {
  try {
    const userId = req.user.id;

    const subscription = await subscriptionsService.getUserSubscription(userId);
    if (!subscription) {
      return res.status(404).json({ success: false, error: 'Aucun abonnement trouvé.' });
    }

    if (subscription.provider !== 'stripe' || !subscription.provider_subscription_id) {
      return res.status(400).json({ success: false, error: 'Réactivation disponible uniquement pour les abonnements Stripe.' });
    }

    if (!subscription.cancel_at_period_end) {
      return res.status(400).json({ success: false, error: 'Cet abonnement n\'est pas programmé pour annulation.' });
    }

    await stripeService.reactivateSubscription(subscription.provider_subscription_id);

    // Update DB
    await supabaseAdmin
      .from('subscriptions')
      .update({ cancel_at_period_end: false, updated_at: new Date().toISOString() })
      .eq('id', subscription.id);

    res.status(200).json({
      success: true,
      message: 'Abonnement réactivé. Le renouvellement automatique est rétabli.',
    });
  } catch (error) {
    console.error('❌ Reactivate subscription error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * GET /api/subscriptions/payment-history
 * Get current user's payment history
 */
async function getPaymentHistory(req, res) {
  try {
    const userId = req.user.id;

    const payments = await subscriptionsService.getPaymentHistory(userId);

    res.status(200).json({
      success: true,
      payments,
      count: payments.length,
    });
  } catch (error) {
    console.error('❌ Get payment history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get payment history',
      message: error.message,
    });
  }
}

/**
 * POST /api/subscriptions/verify-payment
 * Verify payment status (called from callback page)
 *
 * Body: {
 *   transactionId: string,  // Flutterwave transaction ID
 *   reference: string       // Our tx_ref
 * }
 */
async function verifyPayment(req, res) {
  try {
    const userId = req.user.id;
    const { transactionId, reference } = req.body;
    console.log('[subscriptions.verify] start', { userId, transactionId, reference });

    if (!transactionId || !reference) {
      return res.status(400).json({
        success: false,
        error: 'Missing parameters',
        message: 'transactionId and reference are required',
      });
    }

    // Verify payment with Flutterwave
    const paymentDetails = await flutterwaveService.verifyPayment(transactionId);

    // Check if payment belongs to this user
    if (paymentDetails.meta.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized',
        message: 'This payment does not belong to you',
      });
    }

    // Find subscription by reference
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .select('id, subscription_id, status, metadata')
      .eq('provider_payment_id', reference)
      .single();

    if (paymentError || !payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found',
        message: 'Payment record not found',
      });
    }

    if (paymentDetails.status === 'successful') {
      if (payment.status !== 'succeeded') {
        await subscriptionsService.updatePaymentStatus(payment.id, 'succeeded');
      }

      // Extra seat purchase
      const paymentType = payment.metadata?.payment_type;
      if (paymentType === 'extra_seat') {
        const targetUsersLimit = Number(payment.metadata?.target_users_limit || 0);
        let updatedSub = null;
        if (payment.subscription_id && targetUsersLimit > 0) {
          updatedSub = await subscriptionsService.applyExtraSeat(payment.subscription_id, targetUsersLimit);
        }
        return res.status(200).json({
          success: true,
          type: 'extra_seat',
          message: `Siège ajouté. Votre abonnement passe à ${targetUsersLimit} places.`,
          subscription: updatedSub,
        });
      }

      // Activate or renew depending on current subscription state.
      const subscription = await subscriptionsService.applySuccessfulSubscriptionPayment(payment.subscription_id);

      console.log('[subscriptions.verify] success', {
        userId,
        subscriptionId: subscription.id,
        transactionId,
        reference,
      });

      // Emails post-paiement (non-bloquants)
      const { data: profile } = await supabaseAdmin
        .from('profiles').select('email, full_name').eq('id', userId).single();
      const { data: plan } = await supabaseAdmin
        .from('subscription_plans').select('name').eq('id', subscription.plan_id).single();

      if (profile) {
        const emailData = {
          planName: plan?.name || 'Abonnement',
          amount: (paymentDetails.amount / 100).toFixed(2),
          currency: paymentDetails.currency || 'EUR',
          endDate: subscription.end_date,
        };
        sendSubscriptionConfirmationEmail(profile.email, profile.full_name, emailData)
          .catch(e => console.error('[email] subscription confirmation:', e.message));

        // Facture PDF par email
        try {
          const settings = await getSettings();
          const pdfBuffer = await generateInvoicePDFBuffer({
            payment: { ...payment, amount: paymentDetails.amount / 100, currency: paymentDetails.currency, status: 'succeeded', paid_at: new Date().toISOString() },
            user: { email: profile.email, full_name: profile.full_name },
            subscription,
            settings,
          });
          const invoiceNumber = buildInvoiceNumber(payment.id, new Date().toISOString(), settings.invoice_prefix || 'INV');
          sendInvoiceEmail(profile.email, profile.full_name, { invoiceNumber, pdfBuffer })
            .catch(e => console.error('[email] invoice:', e.message));
        } catch (e) {
          console.error('[email] invoice generation error:', e.message);
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Payment successful and subscription activated',
        subscription,
        payment: {
          status: 'succeeded',
          amount: paymentDetails.amount,
          currency: paymentDetails.currency,
          paidAt: paymentDetails.paidAt,
        },
      });
    } else if (paymentDetails.status === 'failed') {
      // Update payment status
      await subscriptionsService.updatePaymentStatus(payment.id, 'failed', 'Payment failed');

      return res.status(400).json({
        success: false,
        error: 'Payment failed',
        message: 'Your payment was not successful',
      });
    } else {
      // Payment still pending
      return res.status(200).json({
        success: false,
        status: 'pending',
        message: 'Payment is still being processed',
      });
    }
  } catch (error) {
    console.error('❌ Verify payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify payment',
      message: error.message,
    });
  }
}

/**
 * POST /api/subscriptions/verify-stripe-session
 * Verify a Stripe Checkout Session after browser redirect (fallback if webhook missed).
 * Body: { sessionId: string }
 */
async function verifyStripeSession(req, res) {
  try {
    const userId = req.user.id;
    const { sessionId } = req.body;
    console.log('[subscriptions.verify-stripe] start', { userId, sessionId });

    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'Missing sessionId' });
    }

    if (!stripeService.isConfigured()) {
      return res.status(503).json({ success: false, error: 'Stripe not configured' });
    }

    // Retrieve session from Stripe
    const session = await stripeService.retrieveSession(sessionId);

    // Security: verify session belongs to this user via metadata
    if (session.metadata?.user_id && session.metadata.user_id !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized', message: 'Session does not belong to you' });
    }

    // Find payment record
    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('id, subscription_id, status, metadata')
      .eq('provider_payment_id', sessionId)
      .maybeSingle();

    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    if (session.paymentStatus !== 'paid') {
      return res.status(400).json({
        success: false,
        status: session.paymentStatus,
        message: session.status === 'expired' ? 'La session de paiement a expiré.' : 'Paiement non encore confirmé.',
      });
    }

    // Mark payment as succeeded
    if (payment.status !== 'succeeded') {
      await subscriptionsService.updatePaymentStatus(payment.id, 'succeeded');
    }

    const paymentType = payment.metadata?.payment_type;

    // Extra seat purchase
    if (paymentType === 'extra_seat') {
      const targetUsersLimit = Number(payment.metadata?.target_users_limit || 0);
      let updatedSub = null;
      if (payment.subscription_id && targetUsersLimit > 0) {
        updatedSub = await subscriptionsService.applyExtraSeat(payment.subscription_id, targetUsersLimit);
      }
      console.log('[subscriptions.verify-stripe] extra_seat success', { userId, sessionId, targetUsersLimit });
      return res.status(200).json({
        success: true,
        type: 'extra_seat',
        message: `Siège ajouté. Votre abonnement passe à ${targetUsersLimit} places.`,
        subscription: updatedSub,
      });
    }

    // Regular subscription activation
    let subscription = null;
    if (payment.subscription_id) {
      subscription = await subscriptionsService.applySuccessfulSubscriptionPayment(payment.subscription_id);
    }

    console.log('[subscriptions.verify-stripe] success', { userId, sessionId });

    return res.status(200).json({
      success: true,
      message: 'Paiement Stripe confirmé. Abonnement activé.',
      subscription,
    });
  } catch (error) {
    console.error('❌ Verify Stripe session error:', error);
    res.status(500).json({ success: false, error: 'Failed to verify Stripe session', message: error.message });
  }
}

/**
 * POST /api/subscriptions/renew
 * Initiate manual renewal payment for current active subscription
 */
async function initiateRenewalCheckout(req, res) {
  try {
    const userId = req.user.id;
    console.log('[subscriptions.renew] start', { userId });
    const subscription = await subscriptionsService.getUserSubscription(userId);

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'NO_ACTIVE_SUBSCRIPTION',
        message: 'No active subscription found for renewal',
      });
    }

    if (!flutterwaveService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Payment provider not configured',
        message: 'Flutterwave is not configured. Set FLUTTERWAVE_PUBLIC_KEY and FLUTTERWAVE_SECRET_KEY in backend env.',
      });
    }

    const pricing = await subscriptionsService.computeRenewalAmountForSubscription(subscription);
    const requestOrigin = req.headers.origin;
    const redirectBaseUrl = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(String(requestOrigin || ''))
      ? requestOrigin
      : undefined;

    const payment = await flutterwaveService.initiatePayment({
      amount: pricing.amount,
      currency: pricing.currency,
      email: req.user.email,
      name: req.user.full_name || req.user.email,
      planCode: pricing.plan.slug,
      planName: pricing.plan.name,
      usersLimit: subscription.users_limit,
      userId,
      redirectBaseUrl,
    });

    await subscriptionsService.createPayment({
      userId,
      subscriptionId: subscription.id,
      amount: pricing.amount,
      currency: pricing.currency,
      status: 'pending',
      provider: 'flutterwave',
      providerPaymentId: payment.reference,
      providerCustomerId: null,
      paymentMethod: 'card',
      metadata: {
        payment_type: 'subscription_renewal',
        tx_ref: payment.reference,
        plan_id: pricing.plan.id,
        plan_code: pricing.plan.slug,
        users_limit: subscription.users_limit,
      },
    });

    console.log('[subscriptions.renew] success', {
      userId,
      subscriptionId: subscription.id,
      reference: payment.reference,
      amount: pricing.amount,
      currency: pricing.currency,
    });

    return res.status(200).json({
      success: true,
      paymentLink: payment.link,
      reference: payment.reference,
      renewal: {
        subscriptionId: subscription.id,
        planId: pricing.plan.id,
        planCode: pricing.plan.slug,
        planName: pricing.plan.name,
        amount: pricing.amount,
        currency: pricing.currency,
      },
    });
  } catch (error) {
    console.error('❌ Initiate renewal checkout error:', error);
    return res.status(500).json({
      success: false,
      error: 'FAILED_TO_INITIATE_RENEWAL',
      message: error.message,
    });
  }
}

/**
 * POST /api/subscriptions/resume
 * Resume a subscription previously marked cancel_at_period_end
 */
async function resumeSubscription(req, res) {
  try {
    const userId = req.user.id;
    const subscription = await subscriptionsService.getUserSubscription(userId);

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'NO_ACTIVE_SUBSCRIPTION',
        message: 'No active subscription found',
      });
    }

    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .update({
        cancel_at_period_end: false,
        cancelled_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription.id)
      .select()
      .single();

    if (error) throw error;
    console.log('[subscriptions.changePlan] success', {
      userId,
      subscriptionId: subscription.id,
      targetPlanId: targetPlan.id,
      usersLimit: nextUsersLimit,
      effectiveOn: subscription.current_period_end,
    });

    return res.status(200).json({
      success: true,
      message: 'Subscription resumed successfully',
      subscription: data,
    });
  } catch (error) {
    console.error('❌ Resume subscription error:', error);
    return res.status(500).json({
      success: false,
      error: 'FAILED_TO_RESUME_SUBSCRIPTION',
      message: error.message,
    });
  }
}

/**
 * POST /api/subscriptions/change-plan
 * Schedule plan change at next billing cycle
 */
async function schedulePlanChange(req, res) {
  try {
    const userId = req.user.id;
    const { planId, planCode, usersLimit } = req.body;
    console.log('[subscriptions.changePlan] start', { userId, planId, planCode, usersLimit });
    const targetPlan = await subscriptionsService.getPlan(planId || planCode);

    if (!targetPlan) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_PLAN',
        message: 'Selected target plan is invalid or inactive',
      });
    }

    const membership = await subscriptionsService.getActiveSubscriptionForMember(userId);
    if (!membership) {
      return res.status(404).json({
        success: false,
        error: 'NO_ACTIVE_SUBSCRIPTION',
        message: 'No active subscription found',
      });
    }

    const subscription = membership.subscription;
    if (membership.memberRole !== 'owner') {
      return res.status(403).json({
        success: false,
        error: 'ONLY_OWNER_CAN_CHANGE_PLAN',
        message: 'Only subscription owner can schedule plan change',
      });
    }

    const nextUsersLimit = Number(
      usersLimit
      || subscription.profiles_limit
      || subscription.users_limit
      || targetPlan.includedUsers
      || 1
    );
    if (!Number.isInteger(nextUsersLimit) || nextUsersLimit < Number(targetPlan.includedUsers || 1)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_USERS_LIMIT',
        message: `usersLimit must be an integer >= includedUsers (${targetPlan.includedUsers})`,
      });
    }
    if (nextUsersLimit > MAX_FAMILY_SEATS) {
      return res.status(400).json({
        success: false,
        error: 'USERS_LIMIT_TOO_HIGH',
        message: `usersLimit cannot exceed ${MAX_FAMILY_SEATS} for the family subscription.`,
      });
    }

    const existingMetadata = subscription.metadata || {};
    const metadata = {
      ...existingMetadata,
      pending_plan_change: {
        plan_id: targetPlan.id,
        plan_slug: targetPlan.slug,
        users_limit: nextUsersLimit,
        profiles_limit: nextUsersLimit,
        requested_at: new Date().toISOString(),
      },
    };

    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .update({
        metadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription.id)
      .select()
      .single();

    if (error) throw error;
    return res.status(200).json({
      success: true,
      message: 'Plan change scheduled for next billing cycle',
      effective_on: subscription.current_period_end,
      subscription: data,
      pending_plan_change: metadata.pending_plan_change,
    });
  } catch (error) {
    console.error('❌ Schedule plan change error:', error);
    return res.status(500).json({
      success: false,
      error: 'FAILED_TO_SCHEDULE_PLAN_CHANGE',
      message: error.message,
    });
  }
}

/**
 * GET /api/subscriptions/cycle/current
 * Get current active cycle for authenticated user
 */
async function getCurrentCycle(req, res) {
  try {
    const userId = req.user.id;
    const membership = await subscriptionsService.getActiveSubscriptionForMember(userId);

    if (!membership) {
      return res.status(404).json({
        success: false,
        error: 'NO_ACTIVE_SUBSCRIPTION',
        message: 'No active subscription found for current user',
      });
    }

    const cycle = await subscriptionsService.ensureCurrentCycle(membership.subscription);
    if (!cycle) {
      return res.status(404).json({
        success: false,
        error: 'NO_ACTIVE_CYCLE',
        message: 'No active billing cycle found',
      });
    }

    const familyContext = await familyProfilesService.resolveProfileForUser(userId, req.headers['x-profile-id']);
    const usage = familyContext?.isFamilyContext && familyContext?.profileId
      ? await subscriptionsService.ensureProfileCycleUsage(
        membership.subscription,
        cycle,
        familyContext.profileId
      )
      : await subscriptionsService.ensureMemberCycleUsage(
        membership.subscription,
        cycle,
        userId
      );

    return res.status(200).json({
      success: true,
      data: {
        subscription: membership.subscription,
        member_role: membership.memberRole,
        cycle,
        usage,
        active_profile: familyContext?.profile || null,
      },
    });
  } catch (error) {
    console.error('❌ Get current cycle error:', error);
    return res.status(500).json({
      success: false,
      error: 'FAILED_TO_GET_CURRENT_CYCLE',
      message: error.message,
    });
  }
}

/**
 * GET /api/subscriptions/usage/me
 * Get usage summary for current cycle
 */
async function getMyUsage(req, res) {
  try {
    const userId = req.user.id;
    const membership = await subscriptionsService.getActiveSubscriptionForMember(userId);

    if (!membership) {
      return res.status(200).json({
        success: true,
        data: {
          has_subscription: false,
          usage: null,
        },
      });
    }

    const cycle = await subscriptionsService.ensureCurrentCycle(membership.subscription);
    const familyContext = await familyProfilesService.resolveProfileForUser(userId, req.headers['x-profile-id']);
    const isFamilyProfileContext = Boolean(familyContext?.isFamilyContext && familyContext?.profileId);
    const usage = cycle
      ? (isFamilyProfileContext
        ? await subscriptionsService.ensureProfileCycleUsage(membership.subscription, cycle, familyContext.profileId)
        : await subscriptionsService.ensureMemberCycleUsage(membership.subscription, cycle, userId))
      : null;

    let bonusSummary = {};
    if (isFamilyProfileContext && usage) {
      bonusSummary = {
        flex: Math.max(0, Number(usage.bonus_quota || 0) - Number(usage.bonus_used_count || 0)),
      };
    } else {
      const bonuses = await subscriptionsService.getBonusCredits(userId);
      bonusSummary = bonuses.reduce((acc, item) => {
        const available = Math.max(0, Number(item.quantity_total) - Number(item.quantity_used));
        acc[item.bonus_type] = (acc[item.bonus_type] || 0) + available;
        return acc;
      }, {});
    }

    return res.status(200).json({
      success: true,
      data: {
        has_subscription: true,
        subscription: membership.subscription,
        member_role: membership.memberRole,
        cycle,
        usage,
        bonuses: bonusSummary,
        active_profile: familyContext?.profile || null,
      },
    });
  } catch (error) {
    console.error('❌ Get usage error:', error);
    return res.status(500).json({
      success: false,
      error: 'FAILED_TO_GET_USAGE',
      message: error.message,
    });
  }
}

/**
 * GET /api/subscriptions/bonuses/me
 * List bonus credits for current user
 */
async function getMyBonuses(req, res) {
  try {
    const userId = req.user.id;
    const includeExpired = String(req.query.includeExpired || 'false') === 'true';
    const membership = await subscriptionsService.getActiveSubscriptionForMember(userId);
    const familyContext = await familyProfilesService.resolveProfileForUser(userId, req.headers['x-profile-id']);

    let normalized = [];

    if (membership && familyContext?.isFamilyContext && familyContext?.profileId) {
      const cycle = await subscriptionsService.ensureCurrentCycle(membership.subscription);
      const usage = cycle
        ? await subscriptionsService.ensureProfileCycleUsage(membership.subscription, cycle, familyContext.profileId)
        : null;

      if (usage && (includeExpired || new Date(cycle.period_end) > new Date())) {
        normalized = [{
          id: `profile-flex-${usage.id}`,
          bonus_type: 'flex',
          quantity_total: Number(usage.bonus_quota || 0),
          quantity_used: Number(usage.bonus_used_count || 0),
          available: Math.max(0, Number(usage.bonus_quota || 0) - Number(usage.bonus_used_count || 0)),
          expires_at: cycle.period_end,
          profile_id: familyContext.profileId,
          scope: 'profile',
        }];
      }
    } else {
      const bonuses = await subscriptionsService.getBonusCredits(userId, { includeExpired });
      normalized = bonuses.map((item) => ({
        ...item,
        available: Math.max(0, Number(item.quantity_total) - Number(item.quantity_used)),
      }));
    }

    return res.status(200).json({
      success: true,
      data: normalized,
      count: normalized.length,
    });
  } catch (error) {
    console.error('❌ Get bonuses error:', error);
    return res.status(500).json({
      success: false,
      error: 'FAILED_TO_GET_BONUSES',
      message: error.message,
    });
  }
}

/**
 * GET /api/subscriptions/members
 * List active members of current subscription
 */
async function getMembers(req, res) {
  try {
    const userId = req.user.id;
    const membership = await subscriptionsService.getActiveSubscriptionForMember(userId);

    if (!membership) {
      return res.status(404).json({
        success: false,
        error: 'NO_ACTIVE_SUBSCRIPTION',
        message: 'No active subscription found',
      });
    }

    const subscription = membership.subscription;
    await subscriptionsService.ensureOwnerMembership(subscription);

    const { data: members, error } = await supabaseAdmin
      .from('subscription_members')
      .select('id, user_id, role, status, joined_at, removed_at, metadata')
      .eq('subscription_id', subscription.id)
      .order('joined_at', { ascending: true });

    if (error) throw error;

    return res.status(200).json({
      success: true,
      data: {
        subscription_id: subscription.id,
        users_limit: subscription.users_limit,
        member_role: membership.memberRole,
        members: members || [],
      },
    });
  } catch (error) {
    console.error('❌ Get members error:', error);
    return res.status(500).json({
      success: false,
      error: 'FAILED_TO_GET_MEMBERS',
      message: error.message,
    });
  }
}

/**
 * POST /api/subscriptions/members
 * Add a member by userId
 */
async function addMember(req, res) {
  try {
    const currentUserId = req.user.id;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_USER_ID',
        message: 'userId is required',
      });
    }

    const membership = await subscriptionsService.getActiveSubscriptionForMember(currentUserId);
    if (!membership) {
      return res.status(404).json({
        success: false,
        error: 'NO_ACTIVE_SUBSCRIPTION',
        message: 'No active subscription found',
      });
    }

    const subscription = membership.subscription;
    await subscriptionsService.ensureOwnerMembership(subscription);

    if (membership.memberRole !== 'owner') {
      return res.status(403).json({
        success: false,
        error: 'ONLY_OWNER_CAN_ADD_MEMBERS',
        message: 'Only subscription owner can add members',
      });
    }

    const { count: activeMembersCount, error: countError } = await supabaseAdmin
      .from('subscription_members')
      .select('id', { head: true, count: 'exact' })
      .eq('subscription_id', subscription.id)
      .eq('status', 'active');

    if (countError) throw countError;

    if ((activeMembersCount || 0) >= Number(subscription.users_limit || 1)) {
      return res.status(400).json({
        success: false,
        error: 'MEMBER_LIMIT_REACHED',
        message: 'users_limit reached for this subscription',
      });
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('subscription_members')
      .insert({
        subscription_id: subscription.id,
        user_id: userId,
        role: 'member',
        status: 'active',
        joined_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        return res.status(409).json({
          success: false,
          error: 'MEMBER_ALREADY_EXISTS',
          message: 'User is already a member of this subscription',
        });
      }
      throw insertError;
    }

    const cycle = await subscriptionsService.ensureCurrentCycle(subscription);
    if (cycle) {
      await subscriptionsService.ensureMemberCycleUsage(subscription, cycle, userId);
    }

    return res.status(201).json({
      success: true,
      data: inserted,
    });
  } catch (error) {
    console.error('❌ Add member error:', error);
    return res.status(500).json({
      success: false,
      error: 'FAILED_TO_ADD_MEMBER',
      message: error.message,
    });
  }
}

/**
 * DELETE /api/subscriptions/members/:userId
 * Remove a member
 */
async function removeMember(req, res) {
  try {
    const currentUserId = req.user.id;
    const memberUserId = req.params.userId;

    const membership = await subscriptionsService.getActiveSubscriptionForMember(currentUserId);
    if (!membership) {
      return res.status(404).json({
        success: false,
        error: 'NO_ACTIVE_SUBSCRIPTION',
        message: 'No active subscription found',
      });
    }

    const subscription = membership.subscription;
    await subscriptionsService.ensureOwnerMembership(subscription);

    if (membership.memberRole !== 'owner') {
      return res.status(403).json({
        success: false,
        error: 'ONLY_OWNER_CAN_REMOVE_MEMBERS',
        message: 'Only subscription owner can remove members',
      });
    }

    if (memberUserId === subscription.user_id) {
      return res.status(400).json({
        success: false,
        error: 'OWNER_CANNOT_BE_REMOVED',
        message: 'Subscription owner cannot be removed',
      });
    }

    const { data, error } = await supabaseAdmin
      .from('subscription_members')
      .update({
        status: 'removed',
        removed_at: new Date().toISOString(),
      })
      .eq('subscription_id', subscription.id)
      .eq('user_id', memberUserId)
      .eq('status', 'active')
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'MEMBER_NOT_FOUND',
        message: 'Active member not found',
      });
    }

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('❌ Remove member error:', error);
    return res.status(500).json({
      success: false,
      error: 'FAILED_TO_REMOVE_MEMBER',
      message: error.message,
    });
  }
}

/**
 * PATCH /api/subscriptions/users-limit
 * Update users limit for current active subscription
 */
async function updateUsersLimit(req, res) {
  try {
    const currentUserId = req.user.id;
    const { usersLimit } = req.body;
    const nextUsersLimit = Number(usersLimit);

    if (!Number.isInteger(nextUsersLimit) || nextUsersLimit < 1) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_USERS_LIMIT',
        message: 'usersLimit must be a positive integer',
      });
    }

    const membership = await subscriptionsService.getActiveSubscriptionForMember(currentUserId);
    if (!membership) {
      return res.status(404).json({
        success: false,
        error: 'NO_ACTIVE_SUBSCRIPTION',
        message: 'No active subscription found',
      });
    }

    const subscription = membership.subscription;
    await subscriptionsService.ensureOwnerMembership(subscription);

    if (membership.memberRole !== 'owner') {
      return res.status(403).json({
        success: false,
        error: 'ONLY_OWNER_CAN_UPDATE_USERS_LIMIT',
        message: 'Only subscription owner can update users_limit',
      });
    }

    const snapshot = subscription.plan_snapshot || {};
    const livePlan = subscription.plan_id
      ? await subscriptionsService.getPlan(subscription.plan_id)
      : await subscriptionsService.getPlan(subscription.plan_type);
    const minUsers = Number(livePlan?.includedUsers || snapshot.includedUsers || 1);

    // Security: increasing seats must go through buy-extra-seat (paid flow)
    const currentUsersLimit = Number(subscription.profiles_limit || subscription.users_limit || 1);

    if (nextUsersLimit > currentUsersLimit) {
      return res.status(403).json({
        success: false,
        error: 'USE_BUY_EXTRA_SEAT',
        message: 'Pour ajouter des places, utilisez le flux de paiement (POST /buy-extra-seat).',
      });
    }

    if (nextUsersLimit < minUsers) {
      return res.status(400).json({
        success: false,
        error: 'USERS_LIMIT_BELOW_PLAN_MINIMUM',
        message: `usersLimit cannot be lower than includedUsers (${minUsers})`,
      });
    }

    const { count: activeMembersCount, error: countError } = await supabaseAdmin
      .from('subscription_members')
      .select('id', { head: true, count: 'exact' })
      .eq('subscription_id', subscription.id)
      .eq('status', 'active');

    if (countError) throw countError;
    if ((activeMembersCount || 0) > nextUsersLimit) {
      return res.status(400).json({
        success: false,
        error: 'USERS_LIMIT_BELOW_ACTIVE_MEMBERS',
        message: 'usersLimit cannot be lower than current number of active members',
      });
    }

    const amountPlan = livePlan || {
      includedUsers: minUsers,
      basePriceCents: Number(snapshot.basePriceCents || Math.round(Number(subscription.amount || 0) * 100)),
      extraUserPriceCents: Number(snapshot.extraUserPriceCents || 0),
    };
    const amountCents = subscriptionsService.computeSubscriptionAmountCents(amountPlan, nextUsersLimit);

    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .update({
        users_limit: nextUsersLimit,
        profiles_limit: nextUsersLimit,
        amount: subscriptionsService.toMajorAmount(amountCents),
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription.id)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('❌ Update users limit error:', error);
    return res.status(500).json({
      success: false,
      error: 'FAILED_TO_UPDATE_USERS_LIMIT',
      message: error.message,
    });
  }
}

/**
 * POST /api/subscriptions/buy-extra-seat
 * Initiate payment for one additional seat on a family subscription.
 * Body: { provider?: 'stripe' | 'flutterwave' }
 */
async function buyExtraSeat(req, res) {
  try {
    const userId = req.user.id;
    const { provider = 'stripe' } = req.body;

    // Verify caller is subscription owner
    const membership = await subscriptionsService.getActiveSubscriptionForMember(userId);
    if (!membership) {
      return res.status(404).json({ success: false, error: 'NO_ACTIVE_SUBSCRIPTION', message: 'No active subscription found.' });
    }
    if (membership.memberRole !== 'owner') {
      return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Only the subscription owner can purchase extra seats.' });
    }

    const subscription = membership.subscription;
    const snapshot = subscription.plan_snapshot || {};
    const plan = subscription.plan_id ? await subscriptionsService.getPlan(subscription.plan_id) : null;
    const extraUserPriceCents = Number(plan?.extraUserPriceCents || snapshot.extraUserPriceCents || 0);

    if (!extraUserPriceCents) {
      return res.status(400).json({ success: false, error: 'NO_EXTRA_SEAT_PRICING', message: 'Your plan does not support extra seats.' });
    }

    const targetUsersLimit = Number(subscription.profiles_limit || subscription.users_limit || 1) + 1;
    if (targetUsersLimit > MAX_FAMILY_SEATS) {
      return res.status(400).json({
        success: false,
        error: 'USERS_LIMIT_TOO_HIGH',
        message: `You cannot exceed ${MAX_FAMILY_SEATS} seats on the family subscription.`,
      });
    }

    // Resolve payer identity
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    const payerEmail = authUser?.user?.email;
    if (!payerEmail) {
      return res.status(400).json({ success: false, error: 'MISSING_EMAIL', message: 'User email is required.' });
    }
    const { data: profile } = await supabaseAdmin.from('profiles').select('full_name').eq('id', userId).maybeSingle();
    const payerName = profile?.full_name || payerEmail;

    const requestOrigin = req.headers.origin;
    const redirectBaseUrl = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(String(requestOrigin || ''))
      ? requestOrigin
      : undefined;

    const resolvedProvider = provider === 'stripe' ? 'stripe' : 'flutterwave';

    // ---- Stripe ----
    if (resolvedProvider === 'stripe') {
      if (!stripeService.isConfigured()) {
        return res.status(503).json({ success: false, error: 'STRIPE_NOT_CONFIGURED', message: 'Stripe is not configured.' });
      }
      const stripeSession = await stripeService.createCheckoutSession({
        userId,
        subscriptionId: subscription.id,
        planId: plan?.id || '',
        planCode: plan?.slug || subscription.plan_type,
        planName: `+1 siège — ${plan?.name || snapshot.name || 'Abonnement'}`,
        amountCents: extraUserPriceCents,
        currency: subscription.currency,
        usersLimit: targetUsersLimit,
        customerEmail: payerEmail,
        paymentType: 'extra_seat',
        redirectBaseUrl,
      });

      await subscriptionsService.createPayment({
        userId,
        subscriptionId: subscription.id,
        amount: extraUserPriceCents / 100,
        currency: subscription.currency,
        status: 'pending',
        provider: 'stripe',
        providerPaymentId: stripeSession.sessionId,
        providerCustomerId: null,
        paymentMethod: 'card',
        metadata: {
          payment_type: 'extra_seat',
          stripe_session_id: stripeSession.sessionId,
          target_users_limit: targetUsersLimit,
        },
      });

      return res.status(200).json({
        success: true,
        provider: 'stripe',
        paymentLink: stripeSession.sessionUrl,
        reference: stripeSession.sessionId,
      });
    }

    // ---- Flutterwave ----
    if (!flutterwaveService.isConfigured()) {
      return res.status(503).json({ success: false, error: 'FLUTTERWAVE_NOT_CONFIGURED', message: 'Flutterwave is not configured.' });
    }
    const payment = await flutterwaveService.initiateCheckout({
      amount: extraUserPriceCents / 100,
      currency: subscription.currency,
      email: payerEmail,
      name: payerName,
      userId,
      redirectBaseUrl,
      txPrefix: 'SEAT',
      redirectPath: '/subscription/callback',
      title: 'Papyri — Place supplémentaire',
      description: `+1 siège pour votre abonnement famille`,
      meta: {
        user_id: userId,
        payment_type: 'extra_seat',
        target_users_limit: targetUsersLimit,
        subscription_id: subscription.id,
      },
    });

    await subscriptionsService.createPayment({
      userId,
      subscriptionId: subscription.id,
      amount: extraUserPriceCents / 100,
      currency: subscription.currency,
      status: 'pending',
      provider: 'flutterwave',
      providerPaymentId: payment.reference,
      providerCustomerId: null,
      paymentMethod: 'mobile_money',
      metadata: {
        payment_type: 'extra_seat',
        tx_ref: payment.reference,
        target_users_limit: targetUsersLimit,
      },
    });

    return res.status(200).json({
      success: true,
      provider: 'flutterwave',
      paymentLink: payment.link,
      reference: payment.reference,
    });
  } catch (error) {
    console.error('❌ Buy extra seat error:', error);
    res.status(500).json({ success: false, error: 'FAILED_TO_BUY_SEAT', message: error.message });
  }
}

/**
 * GET /api/subscriptions/payments/:paymentId/invoice
 * Download a PDF invoice for a specific payment
 * @protected — user can only download their own invoices
 */
async function downloadInvoice(req, res) {
  try {
    const userId = req.user.id;
    const { paymentId } = req.params;

    // Fetch the payment, ensuring it belongs to the requesting user
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .eq('user_id', userId)
      .single();

    if (paymentError || !payment) {
      return res.status(404).json({ success: false, error: 'Paiement introuvable.' });
    }

    // Only generate invoices for succeeded payments
    if (payment.status !== 'succeeded') {
      return res.status(400).json({ success: false, error: 'Facture disponible uniquement pour les paiements réussis.' });
    }

    // Fetch subscription (optional — for plan details)
    let subscription = null;
    if (payment.subscription_id) {
      const { data: sub } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('id', payment.subscription_id)
        .maybeSingle();
      subscription = sub;
    }

    // Use user info from JWT (already enriched by auth middleware)
    const user = {
      email: req.user.email,
      full_name: req.user.full_name,
    };

    // Load app settings (cached — includes invoice prefix, colors, company info)
    const settings = await getSettings();

    // Build a short filename using the configured prefix
    const { buildInvoiceNumber } = require('../services/invoice.service');
    const invoiceNumber = buildInvoiceNumber(
      payment.id,
      payment.paid_at || payment.created_at,
      settings.invoice_prefix || 'INV'
    );
    const filename = `${invoiceNumber}.pdf`;

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Generate and stream the PDF with dynamic settings (async — may fetch logo)
    await generateInvoicePDF({ payment, user, subscription, settings, stream: res });

  } catch (error) {
    console.error('❌ Download invoice error:', error);
    // Can't send JSON if headers already sent (PDF streaming started)
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Erreur lors de la génération de la facture.', message: error.message });
    }
  }
}

/**
 * POST /api/subscriptions/promo/validate
 * Valide un code promo et retourne le montant après remise.
 * @protected
 * @body { code: string, planId?: string, planCode?: string, usersLimit?: number }
 */
async function validatePromoCode(req, res) {
  try {
    const userId = req.user.id;
    const { code, planId, planCode, usersLimit } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, error: 'Code requis.' });
    }

    const plan = await subscriptionsService.getPlan(planId || planCode);
    if (!plan) {
      return res.status(400).json({ success: false, error: 'Plan invalide.' });
    }

    const normalizedUsersLimit = Number(usersLimit || plan.includedUsers || 1);
    const originalAmountCents = subscriptionsService.computeSubscriptionAmountCents(plan, normalizedUsersLimit);

    const result = await promoService.validatePromoCode(code, plan.slug, userId, originalAmountCents);

    return res.status(200).json({
      success: true,
      code: result.code,
      discountType: result.discountType,
      discountValue: result.discountValue,
      discountCents: result.discountCents,
      finalAmountCents: result.finalAmountCents,
      originalAmountCents,
    });
  } catch (error) {
    const message = promoService.getPromoErrorMessage(error.message);
    const isKnownError = [
      'INVALID_CODE', 'CODE_NOT_YET_VALID', 'CODE_EXPIRED',
      'CODE_MAX_USES_REACHED', 'CODE_NOT_APPLICABLE', 'CODE_ALREADY_USED',
    ].includes(error.message);

    if (isKnownError) {
      return res.status(400).json({ success: false, error: error.message, message });
    }

    console.error('❌ Validate promo code error:', error);
    return res.status(500).json({ success: false, error: 'VALIDATION_ERROR', message: error.message });
  }
}

module.exports = {
  getPlans,
  getMySubscription,
  getAllMySubscriptions,
  initiateCheckout,
  validatePromoCode,
  buyExtraSeat,
  cancelSubscription,
  reactivateSubscription,
  getPaymentHistory,
  verifyPayment,
  verifyStripeSession,
  initiateRenewalCheckout,
  resumeSubscription,
  schedulePlanChange,
  getCurrentCycle,
  getMyUsage,
  getMyBonuses,
  getMembers,
  addMember,
  removeMember,
  updateUsersLimit,
  downloadInvoice,
};
