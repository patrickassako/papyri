/**
 * Flutterwave Service
 * Gestion des paiements et webhooks Flutterwave
 */

const Flutterwave = require('flutterwave-node-v3');
const crypto = require('crypto');
const config = require('../config/env');

// Initialize Flutterwave client
let flw = null;

/**
 * Get Flutterwave client instance
 */
function getClient() {
  if (!flw) {
    if (!config.flutterwave.publicKey || !config.flutterwave.secretKey) {
      console.warn('⚠️  Flutterwave not configured');
      return null;
    }

    flw = new Flutterwave(
      config.flutterwave.publicKey,
      config.flutterwave.secretKey
    );

    console.log('✅ Flutterwave client initialized');
  }

  return flw;
}

/**
 * Initiate payment
 * @param {Object} params - Payment parameters
 * @param {number} params.amount - Amount in EUR
 * @param {string} params.email - Customer email
 * @param {string} params.name - Customer name
 * @param {string} params.planCode - Plan slug/code
 * @param {string} params.planName - Plan display name
 * @param {number} params.usersLimit - Number of users/seats
 * @param {string} params.userId - User UUID
 * @returns {Promise<{link: string, reference: string}>} Payment link and reference
 */
async function initiatePayment({
  amount,
  currency = 'USD',
  email,
  name,
  planCode,
  planName,
  usersLimit,
  userId,
  redirectBaseUrl,
}) {
  return initiateCheckout({
    amount,
    currency,
    email,
    name,
    userId,
    redirectBaseUrl,
    txPrefix: 'SUB',
    redirectPath: '/subscription/callback',
    title: 'Papyri - Bibliothèque Numérique',
    description: `Abonnement ${planName || planCode || ''}`.trim(),
    meta: {
      plan_code: planCode || null,
      users_limit: usersLimit || null,
    },
  });
}

/**
 * Initiate generic checkout (subscription or content unlock)
 * @param {Object} params
 * @returns {Promise<{link: string, reference: string}>}
 */
async function initiateCheckout({
  amount,
  currency = 'EUR',
  email,
  name,
  userId,
  redirectBaseUrl = config.frontendUrl,
  txPrefix = 'PAY',
  redirectPath = '/subscription/callback',
  title = 'Papyri - Bibliothèque Numérique',
  description = 'Paiement',
  meta = {},
}) {
  const client = getClient();

  if (!client) {
    throw new Error('Flutterwave not configured');
  }

  try {
    const payload = {
      tx_ref: `${txPrefix}-${Date.now()}-${userId.substring(0, 8)}`,
      amount: amount,
      currency,
      redirect_url: `${String(redirectBaseUrl || config.frontendUrl).replace(/\/$/, '')}${redirectPath}`,
      customer: {
        email: email,
        name: name,
      },
      customizations: {
        title,
        description,
        logo: 'https://cdn.papyri.com/logo.png',
      },
      meta: {
        user_id: userId,
        ...meta,
      },
    };

    const response = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.flutterwave.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const body = await response.json();

    if (response.ok && body?.status === 'success' && body?.data?.link) {
      return {
        link: body.data.link,
        reference: payload.tx_ref,
      };
    }

    throw new Error(body?.message || 'Failed to initiate payment');
  } catch (error) {
    console.error('❌ Flutterwave initiate payment error:', error);
    throw new Error(`Failed to initiate payment: ${error.message}`);
  }
}

/**
 * Verify payment
 * @param {string} transactionId - Flutterwave transaction ID
 * @returns {Promise<Object>} Transaction details
 */
async function verifyPayment(transactionId) {
  const client = getClient();

  if (!client) {
    throw new Error('Flutterwave not configured');
  }

  try {
    const response = await client.Transaction.verify({ id: transactionId });

    if (response.status === 'success') {
      return {
        status: response.data.status, // 'successful', 'failed', 'pending'
        amount: response.data.amount,
        currency: response.data.currency,
        customer: response.data.customer,
        reference: response.data.tx_ref,
        paymentType: response.data.payment_type,
        meta: response.data.meta,
        paidAt: response.data.created_at,
      };
    }

    throw new Error('Payment verification failed');
  } catch (error) {
    console.error('❌ Flutterwave verify payment error:', error);
    throw new Error(`Failed to verify payment: ${error.message}`);
  }
}

/**
 * Verify webhook signature
 * @param {Object} payload - Webhook payload
 * @param {string} signature - Webhook signature from header
 * @returns {boolean} Is valid signature
 */
function verifyWebhookSignature(payload, signature) {
  if (!config.flutterwave.webhookHash) {
    console.warn('⚠️  Flutterwave webhook hash not configured - skipping verification');
    return true; // In dev, allow without verification
  }

  try {
    // Flutterwave uses webhook hash for verification
    const hash = crypto
      .createHmac('sha256', config.flutterwave.webhookHash)
      .update(JSON.stringify(payload))
      .digest('hex');

    return hash === signature;
  } catch (error) {
    console.error('❌ Webhook signature verification error:', error);
    return false;
  }
}

/**
 * Create subscription plan (if using Flutterwave subscriptions)
 * Note: Flutterwave doesn't have native recurring billing like Stripe
 * We'll handle recurring manually via scheduled jobs
 * @param {Object} params - Subscription parameters
 * @returns {Promise<Object>} Subscription details
 */
async function createSubscription(params) {
  // Flutterwave doesn't have native subscriptions
  // We handle recurring payments manually:
  // 1. User pays once (initiatePayment)
  // 2. We store subscription in DB
  // 3. Cron job checks expiring subscriptions
  // 4. Send payment reminder email
  // 5. User clicks link → initiatePayment again

  console.log('ℹ️  Flutterwave subscriptions handled manually via payment reminders');

  return {
    provider: 'flutterwave',
    recurring: 'manual', // Manual recurring via reminders
  };
}

/**
 * Cancel subscription
 * Since Flutterwave doesn't have native subscriptions, we just mark it as cancelled in our DB
 * @param {string} subscriptionId - Our internal subscription ID
 * @returns {Promise<Object>} Cancellation confirmation
 */
async function cancelSubscription(subscriptionId) {
  // No API call needed - we manage this in our DB
  console.log(`ℹ️  Subscription ${subscriptionId} will be cancelled at period end`);

  return {
    cancelled: true,
    cancel_at_period_end: true,
  };
}

/**
 * Get customer by email
 * @param {string} email - Customer email
 * @returns {Promise<Object|null>} Customer details or null
 */
async function getCustomer(email) {
  const client = getClient();

  if (!client) {
    return null;
  }

  try {
    // Flutterwave doesn't have a direct "get customer" API
    // Customers are created automatically during payment
    return {
      email,
      provider: 'flutterwave',
    };
  } catch (error) {
    console.error('❌ Get customer error:', error);
    return null;
  }
}

/**
 * Format amount for Flutterwave (no cents, just whole numbers for some currencies)
 * @param {number} amount - Amount in EUR
 * @returns {number} Formatted amount
 */
function formatAmount(amount) {
  // EUR uses decimals
  return Number(amount.toFixed(2));
}

/**
 * Check if Flutterwave is configured
 * @returns {boolean}
 */
function isConfigured() {
  return !!(config.flutterwave.publicKey && config.flutterwave.secretKey);
}

module.exports = {
  initiatePayment,
  initiateCheckout,
  verifyPayment,
  verifyWebhookSignature,
  createSubscription,
  cancelSubscription,
  getCustomer,
  formatAmount,
  isConfigured,
  getClient,
};
