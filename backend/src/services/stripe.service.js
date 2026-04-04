/**
 * Stripe Service
 * Gestion des paiements par carte bancaire via Stripe
 * Mode: subscription (renouvellement automatique géré par Stripe)
 */

const Stripe = require('stripe');
const config = require('../config/env');

let stripeClient = null;

function getClient() {
  if (!stripeClient) {
    if (!config.stripe.secretKey) throw new Error('STRIPE_SECRET_KEY not configured');
    stripeClient = new Stripe(config.stripe.secretKey, { apiVersion: '2023-10-16' });
  }
  return stripeClient;
}

function isConfigured() {
  return Boolean(config.stripe.secretKey);
}

function buildUrl(base, path, query = {}) {
  const url = new URL(path, base);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

/**
 * Get or create a Stripe Customer for a user.
 * Reuses existing customer if provider_customer_id is stored in DB.
 */
async function getOrCreateCustomer({ userId, email, existingCustomerId }) {
  const stripe = getClient();

  if (existingCustomerId) {
    try {
      const customer = await stripe.customers.retrieve(existingCustomerId);
      if (!customer.deleted) return customer.id;
    } catch {
      // Customer may have been deleted in Stripe — fall through to create
    }
  }

  const customer = await stripe.customers.create({
    email,
    metadata: { papyri_user_id: userId },
  });

  return customer.id;
}

/**
 * Create a Stripe Checkout Session in subscription mode.
 * Stripe handles all renewals automatically and sends webhooks on each renewal.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.subscriptionId  - Internal subscription UUID
 * @param {string} params.planId
 * @param {string} params.planCode        - 'monthly' | 'yearly'
 * @param {string} params.planName
 * @param {number} params.amountCents     - Amount in cents
 * @param {string} params.currency        - ISO currency (e.g. 'EUR')
 * @param {number} params.usersLimit
 * @param {string} params.customerEmail
 * @param {string} params.stripeCustomerId - Optional existing Stripe customer ID
 * @param {string} params.paymentType
 * @param {string} params.redirectBaseUrl
 */
async function createCheckoutSession({
  userId,
  subscriptionId,
  planId,
  planCode,
  planName,
  amountCents,
  currency,
  usersLimit,
  customerEmail,
  stripeCustomerId,
  paymentType = 'subscription_initial',
  redirectBaseUrl,
}) {
  const stripe = getClient();
  const frontendUrl = redirectBaseUrl || config.frontendUrl;

  // Determine billing interval from plan code
  const isYearly = String(planCode || '').toLowerCase().includes('year') ||
                   String(planCode || '').toLowerCase().includes('annual');
  const interval = isYearly ? 'year' : 'month';

  const sessionParams = {
    mode: 'subscription',
    line_items: [
      {
        price_data: {
          currency: currency.toLowerCase(),
          product_data: {
            name: planName,
            description: `Abonnement ${planName} — ${usersLimit} utilisateur${usersLimit > 1 ? 's' : ''}`,
          },
          unit_amount: Math.round(amountCents),
          recurring: { interval },
        },
        quantity: 1,
      },
    ],
    metadata: {
      user_id: userId,
      subscription_id: subscriptionId || '',
      plan_id: planId,
      plan_code: planCode,
      users_limit: String(usersLimit),
      payment_type: paymentType,
    },
    subscription_data: {
      metadata: {
        user_id: userId,
        subscription_id: subscriptionId || '',
        plan_id: planId,
        plan_code: planCode,
      },
    },
    success_url: `${frontendUrl}/subscription/callback?provider=stripe&session_id={CHECKOUT_SESSION_ID}&status=successful`,
    cancel_url: `${frontendUrl}/pricing?payment=cancelled`,
  };

  // Attach to existing Stripe customer or pre-fill email
  if (stripeCustomerId) {
    sessionParams.customer = stripeCustomerId;
  } else if (customerEmail) {
    sessionParams.customer_email = customerEmail;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  return {
    sessionId: session.id,
    sessionUrl: session.url,
  };
}

/**
 * Create a Stripe Checkout Session in one-time payment mode.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {number} params.amountCents
 * @param {string} params.currency
 * @param {string} params.title
 * @param {string} [params.description]
 * @param {string} [params.customerEmail]
 * @param {object} [params.metadata]
 * @param {string} [params.successPath]
 * @param {string} [params.cancelPath]
 * @param {string} [params.redirectBaseUrl]
 */
async function createPaymentCheckoutSession({
  userId,
  amountCents,
  currency,
  title,
  description = '',
  customerEmail,
  metadata = {},
  successPath = '/',
  cancelPath = '/',
  redirectBaseUrl,
}) {
  const stripe = getClient();
  const frontendUrl = redirectBaseUrl || config.frontendUrl;

  const successUrl = buildUrl(frontendUrl, successPath, {
    provider: 'stripe',
    status: 'successful',
    session_id: '{CHECKOUT_SESSION_ID}',
  });
  const cancelUrl = buildUrl(frontendUrl, cancelPath, {
    provider: 'stripe',
    payment: 'cancelled',
  });

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: String(currency || 'USD').toLowerCase(),
          product_data: {
            name: title,
            ...(description ? { description } : {}),
          },
          unit_amount: Math.round(Number(amountCents || 0)),
        },
        quantity: 1,
      },
    ],
    ...(customerEmail ? { customer_email: customerEmail } : {}),
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      user_id: userId,
      ...metadata,
    },
  });

  return {
    sessionId: session.id,
    sessionUrl: session.url,
  };
}

/**
 * Retrieve a Stripe Checkout Session
 */
async function retrieveSession(sessionId) {
  const stripe = getClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['subscription'],
  });
  return {
    id: session.id,
    status: session.status,
    paymentStatus: session.payment_status,
    amountTotal: session.amount_total,
    currency: session.currency?.toUpperCase(),
    metadata: session.metadata || {},
    customerEmail: session.customer_details?.email || null,
    customerId: session.customer || null,
    stripeSubscriptionId: session.subscription?.id || (typeof session.subscription === 'string' ? session.subscription : null),
    subscriptionStatus: session.subscription?.status || null,
    currentPeriodEnd: session.subscription?.current_period_end
      ? new Date(session.subscription.current_period_end * 1000).toISOString()
      : null,
  };
}

/**
 * Retrieve a Stripe Subscription
 */
async function retrieveSubscription(stripeSubId) {
  const stripe = getClient();
  const sub = await stripe.subscriptions.retrieve(stripeSubId);
  return {
    id: sub.id,
    status: sub.status,
    currentPeriodStart: new Date(sub.current_period_start * 1000).toISOString(),
    currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    customerId: sub.customer,
    metadata: sub.metadata || {},
  };
}

/**
 * Cancel a Stripe Subscription at period end (user keeps access until expiry)
 */
async function cancelSubscriptionAtPeriodEnd(stripeSubId) {
  const stripe = getClient();
  const sub = await stripe.subscriptions.update(stripeSubId, {
    cancel_at_period_end: true,
  });
  return sub;
}

/**
 * Reactivate a cancelled-at-period-end Stripe Subscription
 */
async function reactivateSubscription(stripeSubId) {
  const stripe = getClient();
  const sub = await stripe.subscriptions.update(stripeSubId, {
    cancel_at_period_end: false,
  });
  return sub;
}

/**
 * Retrieve a Stripe Invoice
 */
async function retrieveInvoice(invoiceId) {
  const stripe = getClient();
  return stripe.invoices.retrieve(invoiceId);
}

/**
 * Construct and verify a Stripe webhook event
 */
function constructWebhookEvent(rawBody, signature) {
  if (!config.stripe.webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET not configured');
  }
  const stripe = getClient();
  return stripe.webhooks.constructEvent(rawBody, signature, config.stripe.webhookSecret);
}

module.exports = {
  isConfigured,
  getOrCreateCustomer,
  createCheckoutSession,
  createPaymentCheckoutSession,
  retrieveSession,
  retrieveSubscription,
  cancelSubscriptionAtPeriodEnd,
  reactivateSubscription,
  retrieveInvoice,
  constructWebhookEvent,
};
