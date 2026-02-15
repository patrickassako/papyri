/**
 * Require Subscription Middleware
 * Vérifie qu'un utilisateur a un abonnement actif
 *
 * Utilisation:
 *   router.get('/premium-content', authenticate, requireSubscription, handler);
 */

const subscriptionsService = require('../services/subscriptions.service');

/**
 * Middleware to check if user has an active subscription
 * Must be used after authenticate middleware (requires req.user)
 */
async function requireSubscription(req, res, next) {
  try {
    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const userId = req.user.id;

    // Check subscription status
    const status = await subscriptionsService.checkSubscriptionStatus(userId);

    if (!status.hasSubscription || !status.isActive) {
      return res.status(403).json({
        success: false,
        error: 'Subscription required',
        message: 'An active subscription is required to access this content',
        code: 'NO_ACTIVE_SUBSCRIPTION',
        hasSubscription: status.hasSubscription,
        isActive: status.isActive,
        status: status.status,
      });
    }

    // Check if subscription is about to expire (warn user)
    if (status.subscription) {
      const periodEnd = new Date(status.subscription.current_period_end);
      const now = new Date();
      const daysUntilExpiry = Math.floor((periodEnd - now) / (1000 * 60 * 60 * 24));

      // Attach subscription info to request
      req.subscription = {
        id: status.subscription.id,
        planCode: status.subscription.plan_type,
        planId: status.subscription.plan_id || null,
        usersLimit: status.subscription.users_limit || 1,
        status: status.subscription.status,
        periodEnd: status.subscription.current_period_end,
        daysUntilExpiry,
        cancelAtPeriodEnd: status.subscription.cancel_at_period_end,
      };

      // Warn if subscription expires in less than 7 days
      if (daysUntilExpiry <= 7 && daysUntilExpiry > 0) {
        res.set('X-Subscription-Warning', `Subscription expires in ${daysUntilExpiry} days`);
      }
    }

    // User has active subscription, proceed
    next();
  } catch (error) {
    console.error('❌ requireSubscription middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to check subscription',
      message: error.message,
    });
  }
}

/**
 * Middleware variant that returns subscription status but doesn't block
 * Useful for routes that show different content based on subscription
 */
async function checkSubscription(req, res, next) {
  try {
    if (!req.user || !req.user.id) {
      req.subscription = null;
      return next();
    }

    const userId = req.user.id;
    const status = await subscriptionsService.checkSubscriptionStatus(userId);

    if (status.hasSubscription && status.isActive && status.subscription) {
      const periodEnd = new Date(status.subscription.current_period_end);
      const now = new Date();
      const daysUntilExpiry = Math.floor((periodEnd - now) / (1000 * 60 * 60 * 24));

      req.subscription = {
        id: status.subscription.id,
        planCode: status.subscription.plan_type,
        planId: status.subscription.plan_id || null,
        usersLimit: status.subscription.users_limit || 1,
        status: status.subscription.status,
        periodEnd: status.subscription.current_period_end,
        daysUntilExpiry,
        cancelAtPeriodEnd: status.subscription.cancel_at_period_end,
      };
    } else {
      req.subscription = null;
    }

    next();
  } catch (error) {
    console.error('❌ checkSubscription middleware error:', error);
    req.subscription = null;
    next();
  }
}

module.exports = {
  requireSubscription,
  checkSubscription,
};
