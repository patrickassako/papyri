/**
 * Subscriptions Routes
 * Routes pour la gestion des abonnements et paiements
 */

const express = require('express');
const router = express.Router();
const subscriptionsController = require('../controllers/subscriptions.controller');
const { authenticate } = require('../middleware/auth');
const { rejectKidProfile } = require('../middleware/family-access');

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
router.get('/me', authenticate, rejectKidProfile, subscriptionsController.getMySubscription);

/**
 * GET /api/subscriptions/all
 * Get all user's subscriptions (including expired/cancelled)
 * @protected
 */
router.get('/all', authenticate, rejectKidProfile, subscriptionsController.getAllMySubscriptions);

/**
 * POST /api/subscriptions/promo/validate
 * Valide un code promo et retourne le montant après remise
 * @protected
 * @body {code: string, planId?: string, planCode?: string, usersLimit?: number}
 */
router.post('/promo/validate', authenticate, rejectKidProfile, subscriptionsController.validatePromoCode);

/**
 * POST /api/subscriptions/checkout
 * Initiate subscription payment via Flutterwave or Stripe
 * @protected
 * @body {planCode?: string, planId?: string, usersLimit?: number, provider?: string, promoCode?: string}
 */
router.post('/checkout', authenticate, rejectKidProfile, subscriptionsController.initiateCheckout);

/**
 * POST /api/subscriptions/buy-extra-seat
 * Purchase one additional seat for a family subscription (requires payment)
 * @protected
 * @body {provider?: 'stripe' | 'flutterwave'}
 */
router.post('/buy-extra-seat', authenticate, rejectKidProfile, subscriptionsController.buyExtraSeat);

/**
 * POST /api/subscriptions/cancel
 * Cancel current user's subscription
 * @protected
 * @body {immediately?: boolean}
 */
router.post('/cancel', authenticate, rejectKidProfile, subscriptionsController.cancelSubscription);

/**
 * POST /api/subscriptions/reactivate
 * Reactivate a Stripe subscription scheduled for cancellation (cancel_at_period_end=true)
 * @protected
 */
router.post('/reactivate', authenticate, rejectKidProfile, subscriptionsController.reactivateSubscription);

/**
 * GET /api/subscriptions/payment-history
 * Get current user's payment history
 * @protected
 */
router.get('/payment-history', authenticate, rejectKidProfile, subscriptionsController.getPaymentHistory);

/**
 * POST /api/subscriptions/verify-payment
 * Verify payment status after Flutterwave redirect
 * @protected
 * @body {transactionId: string, reference: string}
 */
router.post('/verify-payment', authenticate, rejectKidProfile, subscriptionsController.verifyPayment);

/**
 * POST /api/subscriptions/verify-stripe-session
 * Verify a Stripe Checkout Session after redirect (fallback if webhook missed)
 * @protected
 * @body {sessionId: string}
 */
router.post('/verify-stripe-session', authenticate, rejectKidProfile, subscriptionsController.verifyStripeSession);

/**
 * POST /api/subscriptions/renew
 * Initiate manual renewal checkout for active subscription
 * @protected
 */
router.post('/renew', authenticate, rejectKidProfile, subscriptionsController.initiateRenewalCheckout);

/**
 * POST /api/subscriptions/resume
 * Resume subscription cancellation (cancel_at_period_end=false)
 * @protected
 */
router.post('/resume', authenticate, rejectKidProfile, subscriptionsController.resumeSubscription);

/**
 * POST /api/subscriptions/change-plan
 * Schedule plan change for next billing cycle
 * @protected
 * @body {planId?: string, planCode?: string, usersLimit?: number}
 */
router.post('/change-plan', authenticate, rejectKidProfile, subscriptionsController.schedulePlanChange);

/**
 * GET /api/subscriptions/cycle/current
 * Get current cycle + member usage
 * @protected
 */
router.get('/cycle/current', authenticate, rejectKidProfile, subscriptionsController.getCurrentCycle);

/**
 * GET /api/subscriptions/usage/me
 * Get usage summary for current user
 * @protected
 */
router.get('/usage/me', authenticate, rejectKidProfile, subscriptionsController.getMyUsage);

/**
 * GET /api/subscriptions/bonuses/me
 * List bonus credits for current user
 * @protected
 */
router.get('/bonuses/me', authenticate, rejectKidProfile, subscriptionsController.getMyBonuses);

/**
 * GET /api/subscriptions/members
 * List members for active subscription
 * @protected
 */
router.get('/members', authenticate, rejectKidProfile, subscriptionsController.getMembers);

/**
 * POST /api/subscriptions/members
 * Add member to active subscription
 * @protected
 * @body {userId: string}
 */
router.post('/members', authenticate, rejectKidProfile, subscriptionsController.addMember);

/**
 * DELETE /api/subscriptions/members/:userId
 * Remove member from active subscription
 * @protected
 */
router.delete('/members/:userId', authenticate, rejectKidProfile, subscriptionsController.removeMember);

/**
 * PATCH /api/subscriptions/users-limit
 * Update users limit for current subscription
 * @protected
 * @body {usersLimit: number}
 */
router.patch('/users-limit', authenticate, rejectKidProfile, subscriptionsController.updateUsersLimit);

/**
 * GET /api/subscriptions/payments/:paymentId/invoice
 * Download PDF invoice for a specific payment
 * @protected — only the owner of the payment can download it
 */
router.get('/payments/:paymentId/invoice', authenticate, rejectKidProfile, subscriptionsController.downloadInvoice);

module.exports = router;
