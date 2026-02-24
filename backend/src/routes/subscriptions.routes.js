/**
 * Subscriptions Routes
 * Routes pour la gestion des abonnements et paiements
 */

const express = require('express');
const router = express.Router();
const subscriptionsController = require('../controllers/subscriptions.controller');
const { authenticate } = require('../middleware/auth');

/**
 * GET /api/subscriptions/plans
 * Get available subscription plans (public)
 */
router.get('/plans', subscriptionsController.getPlans);

/**
 * GET /api/subscriptions/me
 * Get current user's active subscription
 * @protected
 */
router.get('/me', authenticate, subscriptionsController.getMySubscription);

/**
 * GET /api/subscriptions/all
 * Get all user's subscriptions (including expired/cancelled)
 * @protected
 */
router.get('/all', authenticate, subscriptionsController.getAllMySubscriptions);

/**
 * POST /api/subscriptions/checkout
 * Initiate subscription payment via Flutterwave or Stripe
 * @protected
 * @body {planCode?: string, planId?: string, usersLimit?: number, provider?: string}
 */
router.post('/checkout', authenticate, subscriptionsController.initiateCheckout);

/**
 * POST /api/subscriptions/buy-extra-seat
 * Purchase one additional seat for a family subscription (requires payment)
 * @protected
 * @body {provider?: 'stripe' | 'flutterwave'}
 */
router.post('/buy-extra-seat', authenticate, subscriptionsController.buyExtraSeat);

/**
 * POST /api/subscriptions/cancel
 * Cancel current user's subscription
 * @protected
 * @body {immediately?: boolean}
 */
router.post('/cancel', authenticate, subscriptionsController.cancelSubscription);

/**
 * GET /api/subscriptions/payment-history
 * Get current user's payment history
 * @protected
 */
router.get('/payment-history', authenticate, subscriptionsController.getPaymentHistory);

/**
 * POST /api/subscriptions/verify-payment
 * Verify payment status after Flutterwave redirect
 * @protected
 * @body {transactionId: string, reference: string}
 */
router.post('/verify-payment', authenticate, subscriptionsController.verifyPayment);

/**
 * POST /api/subscriptions/verify-stripe-session
 * Verify a Stripe Checkout Session after redirect (fallback if webhook missed)
 * @protected
 * @body {sessionId: string}
 */
router.post('/verify-stripe-session', authenticate, subscriptionsController.verifyStripeSession);

/**
 * POST /api/subscriptions/renew
 * Initiate manual renewal checkout for active subscription
 * @protected
 */
router.post('/renew', authenticate, subscriptionsController.initiateRenewalCheckout);

/**
 * POST /api/subscriptions/resume
 * Resume subscription cancellation (cancel_at_period_end=false)
 * @protected
 */
router.post('/resume', authenticate, subscriptionsController.resumeSubscription);

/**
 * POST /api/subscriptions/change-plan
 * Schedule plan change for next billing cycle
 * @protected
 * @body {planId?: string, planCode?: string, usersLimit?: number}
 */
router.post('/change-plan', authenticate, subscriptionsController.schedulePlanChange);

/**
 * GET /api/subscriptions/cycle/current
 * Get current cycle + member usage
 * @protected
 */
router.get('/cycle/current', authenticate, subscriptionsController.getCurrentCycle);

/**
 * GET /api/subscriptions/usage/me
 * Get usage summary for current user
 * @protected
 */
router.get('/usage/me', authenticate, subscriptionsController.getMyUsage);

/**
 * GET /api/subscriptions/bonuses/me
 * List bonus credits for current user
 * @protected
 */
router.get('/bonuses/me', authenticate, subscriptionsController.getMyBonuses);

/**
 * GET /api/subscriptions/members
 * List members for active subscription
 * @protected
 */
router.get('/members', authenticate, subscriptionsController.getMembers);

/**
 * POST /api/subscriptions/members
 * Add member to active subscription
 * @protected
 * @body {userId: string}
 */
router.post('/members', authenticate, subscriptionsController.addMember);

/**
 * DELETE /api/subscriptions/members/:userId
 * Remove member from active subscription
 * @protected
 */
router.delete('/members/:userId', authenticate, subscriptionsController.removeMember);

/**
 * PATCH /api/subscriptions/users-limit
 * Update users limit for current subscription
 * @protected
 * @body {usersLimit: number}
 */
router.patch('/users-limit', authenticate, subscriptionsController.updateUsersLimit);

/**
 * GET /api/subscriptions/payments/:paymentId/invoice
 * Download PDF invoice for a specific payment
 * @protected — only the owner of the payment can download it
 */
router.get('/payments/:paymentId/invoice', authenticate, subscriptionsController.downloadInvoice);

module.exports = router;
