/**
 * Subscriptions Controller
 * Gestion des endpoints API pour les abonnements
 */

const subscriptionsService = require('../services/subscriptions.service');
const flutterwaveService = require('../services/flutterwave.service');
const { supabaseAdmin } = require('../config/database');

/**
 * GET /api/subscriptions/plans
 * Get available subscription plans (public)
 */
async function getPlans(req, res) {
  try {
    const plans = await subscriptionsService.getPlans();

    console.log('[subscriptions.checkout] success', {
      userId,
      subscriptionId: subscription.id,
      reference: payment.reference,
      planId: plan.id,
      usersLimit: subscription.users_limit,
    });

    res.status(200).json({
      success: true,
      plans,
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
 * Initiate subscription payment via Flutterwave
 *
 * Body: {
 *   planCode?: string,
 *   planId?: string,
 *   usersLimit?: number
 * }
 */
async function initiateCheckout(req, res) {
  try {
    const userId = req.user.id;
    const { planCode, planId, usersLimit } = req.body;
    console.log('[subscriptions.checkout] start', { userId, planCode, planId, usersLimit });

    // Validate plan
    const plan = await subscriptionsService.getPlan(planId || planCode);
    if (!plan) {
      return res.status(400).json({
        success: false,
        error: 'Invalid plan',
        message: 'Selected subscription plan is invalid or inactive',
      });
    }

    // Check if user already has an active subscription
    const existingSubscription = await subscriptionsService.getUserSubscription(userId);
    if (existingSubscription) {
      return res.status(400).json({
        success: false,
        error: 'Active subscription exists',
        message: 'You already have an active subscription. Please cancel it first.',
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

    if (!flutterwaveService.isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Payment provider not configured',
        message: 'Flutterwave is not configured. Set FLUTTERWAVE_PUBLIC_KEY and FLUTTERWAVE_SECRET_KEY in backend env.',
      });
    }

    // Create subscription record (INACTIVE until webhook confirms payment)
    const subscription = await subscriptionsService.createSubscription({
      userId,
      planId: plan.id,
      usersLimit,
      provider: 'flutterwave',
      providerData: {},
    });

    // Initiate Flutterwave payment
    const requestOrigin = req.headers.origin;
    const redirectBaseUrl = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(String(requestOrigin || ''))
      ? requestOrigin
      : undefined;

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

    // Create payment record
    await subscriptionsService.createPayment({
      userId,
      subscriptionId: subscription.id,
      amount: subscription.amount,
      currency: subscription.currency,
      status: 'pending',
      provider: 'flutterwave',
      providerPaymentId: payment.reference,
      providerCustomerId: null,
      paymentMethod: 'card',
      metadata: {
        payment_type: 'subscription_initial',
        tx_ref: payment.reference,
        plan_id: plan.id,
        plan_code: plan.slug,
        users_limit: subscription.users_limit,
      },
    });

    res.status(200).json({
      success: true,
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

    // Get active subscription
    const subscription = await subscriptionsService.getUserSubscription(userId);

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'No active subscription',
        message: 'You do not have an active subscription',
      });
    }

    // Cancel subscription
    const updatedSubscription = await subscriptionsService.cancelSubscription(
      subscription.id,
      immediately
    );

    res.status(200).json({
      success: true,
      message: immediately
        ? 'Subscription cancelled immediately'
        : 'Subscription will be cancelled at the end of the billing period',
      subscription: updatedSubscription,
    });
  } catch (error) {
    console.error('❌ Cancel subscription error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel subscription',
      message: error.message,
    });
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
      .select('id, subscription_id')
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

      // Activate or renew depending on current subscription state.
      const subscription = await subscriptionsService.applySuccessfulSubscriptionPayment(payment.subscription_id);

      console.log('[subscriptions.verify] success', {
        userId,
        subscriptionId: subscription.id,
        transactionId,
        reference,
      });

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

    const nextUsersLimit = Number(usersLimit || subscription.users_limit || targetPlan.includedUsers || 1);
    if (!Number.isInteger(nextUsersLimit) || nextUsersLimit < Number(targetPlan.includedUsers || 1)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_USERS_LIMIT',
        message: `usersLimit must be an integer >= includedUsers (${targetPlan.includedUsers})`,
      });
    }

    const existingMetadata = subscription.metadata || {};
    const metadata = {
      ...existingMetadata,
      pending_plan_change: {
        plan_id: targetPlan.id,
        plan_slug: targetPlan.slug,
        users_limit: nextUsersLimit,
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

    const usage = await subscriptionsService.ensureMemberCycleUsage(
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
    const usage = cycle
      ? await subscriptionsService.ensureMemberCycleUsage(membership.subscription, cycle, userId)
      : null;

    const bonuses = await subscriptionsService.getBonusCredits(userId);
    const bonusSummary = bonuses.reduce((acc, item) => {
      const available = Math.max(0, Number(item.quantity_total) - Number(item.quantity_used));
      acc[item.bonus_type] = (acc[item.bonus_type] || 0) + available;
      return acc;
    }, {});

    return res.status(200).json({
      success: true,
      data: {
        has_subscription: true,
        subscription: membership.subscription,
        member_role: membership.memberRole,
        cycle,
        usage,
        bonuses: bonusSummary,
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
    const bonuses = await subscriptionsService.getBonusCredits(userId, { includeExpired });

    const normalized = bonuses.map((item) => ({
      ...item,
      available: Math.max(0, Number(item.quantity_total) - Number(item.quantity_used)),
    }));

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

module.exports = {
  getPlans,
  getMySubscription,
  getAllMySubscriptions,
  initiateCheckout,
  cancelSubscription,
  getPaymentHistory,
  verifyPayment,
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
};
