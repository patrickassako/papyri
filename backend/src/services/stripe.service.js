/**
 * Stripe Service
 * Gestion des paiements par carte bancaire via Stripe Checkout Sessions
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

/**
 * Returns true if Stripe is properly configured
 */
function isConfigured() {
  return Boolean(config.stripe.secretKey);
}

/**
 * Create a Stripe Checkout Session for a subscription payment
 *
 * @param {object} params
 * @param {string} params.userId         - Supabase user UUID
 * @param {string} params.subscriptionId - Internal subscription ID
 * @param {string} params.planId         - Internal plan ID
 * @param {string} params.planCode       - Plan slug/code
 * @param {string} params.planName       - Display name
 * @param {number} params.amountCents    - Amount in cents (e.g. 999 for $9.99)
 * @param {string} params.currency       - ISO currency code (e.g. 'USD')
 * @param {number} params.usersLimit     - Number of seats
 * @param {string} params.customerEmail  - Pre-fill customer email
 * @param {string} params.paymentType    - 'subscription_initial' | 'subscription_renewal' | 'content_unlock'
 * @param {string} params.redirectBaseUrl - Override base URL (for local dev)
 * @returns {{ sessionId, sessionUrl }} - Stripe session ID and hosted checkout URL
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
  paymentType = 'subscription_initial',
  redirectBaseUrl,
}) {
  const stripe = getClient();

  const frontendUrl = redirectBaseUrl || config.frontendUrl;

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: currency.toLowerCase(),
          product_data: {
            name: planName,
            description: `Abonnement ${planName} — ${usersLimit} utilisateur${usersLimit > 1 ? 's' : ''}`,
          },
          unit_amount: Math.round(amountCents),
        },
        quantity: 1,
      },
    ],
    customer_email: customerEmail,
    metadata: {
      user_id: userId,
      subscription_id: subscriptionId || '',
      plan_id: planId,
      plan_code: planCode,
      users_limit: String(usersLimit),
      payment_type: paymentType,
    },
    success_url: `${frontendUrl}/subscription/callback?provider=stripe&session_id={CHECKOUT_SESSION_ID}&status=successful`,
    cancel_url: `${frontendUrl}/pricing?payment=cancelled`,
  });

  return {
    sessionId: session.id,
    sessionUrl: session.url,
  };
}

/**
 * Retrieve a Stripe Checkout Session and return basic payment info
 *
 * @param {string} sessionId
 * @returns {{ status, amountTotal, currency, metadata, paymentStatus }}
 */
async function retrieveSession(sessionId) {
  const stripe = getClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['payment_intent'],
  });
  return {
    id: session.id,
    status: session.status,           // 'open' | 'complete' | 'expired'
    paymentStatus: session.payment_status, // 'paid' | 'unpaid' | 'no_payment_required'
    amountTotal: session.amount_total,
    currency: session.currency?.toUpperCase(),
    metadata: session.metadata || {},
    customerEmail: session.customer_details?.email || null,
  };
}

/**
 * Verify Stripe webhook event signature and construct the event
 *
 * @param {Buffer} rawBody - Raw request body (must NOT be parsed by express.json)
 * @param {string} signature - Value of 'stripe-signature' header
 * @returns {Stripe.Event}
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
  createCheckoutSession,
  retrieveSession,
  constructWebhookEvent,
};
