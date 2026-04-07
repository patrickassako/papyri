/**
 * Subscriptions Service
 * Gestion de la logique metier des abonnements
 */

const { supabaseAdmin } = require('../config/database');

const LEGACY_PLAN_DURATION_DAYS = {
  monthly: 30,
  yearly: 365,
};

function normalizePlan(row) {
  if (!row) return null;

  return {
    id: row.id,
    slug: row.slug,
    name: row.display_name,
    description: row.description,
    isActive: row.is_active,
    durationDays: row.duration_days,
    basePriceCents: row.base_price_cents,
    currency: row.currency,
    includedUsers: row.included_users,
    extraUserPriceCents: row.extra_user_price_cents,
    textQuotaPerUser: row.text_quota_per_user,
    audioQuotaPerUser: row.audio_quota_per_user,
    discountPercentPaidBooks: row.paid_books_discount_percent,
    bonusTrigger: row.bonus_trigger,
    bonusType: row.bonus_type,
    bonusQuantityPerUser: row.bonus_quantity_per_user,
    bonusValidityDays: row.bonus_validity_days,
    metadata: row.metadata || {},
  };
}

function toMajorAmount(cents) {
  return Number((Number(cents || 0) / 100).toFixed(2));
}

function computeSubscriptionAmountCents(plan, usersLimit) {
  const users = Number(usersLimit || plan.includedUsers || 1);
  const included = Number(plan.includedUsers || 1);
  const extraUsers = Math.max(0, users - included);
  return Number(plan.basePriceCents) + (extraUsers * Number(plan.extraUserPriceCents || 0));
}

async function getPlans() {
  const { data, error } = await supabaseAdmin
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true)
    .order('base_price_cents', { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []).map(normalizePlan);
}

async function getPlan(planRef) {
  if (!planRef) return null;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(planRef);

  const query = supabaseAdmin
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true);

  let data;
  let error;

  if (typeof planRef === 'string' && isUuid) {
    ({ data, error } = await query.eq('id', planRef).maybeSingle());
  } else {
    ({ data, error } = await query.eq('slug', planRef).maybeSingle());
  }

  if (error) {
    throw error;
  }

  return normalizePlan(data);
}

async function getPlanFromSubscription(subscription) {
  if (!subscription) return null;

  if (subscription.plan_snapshot && Object.keys(subscription.plan_snapshot).length > 0) {
    return subscription.plan_snapshot;
  }

  if (subscription.plan_id) {
    const plan = await getPlan(subscription.plan_id);
    if (plan) return plan;
  }

  // Legacy fallback when migration has not been applied to historical rows.
  if (subscription.plan_type) {
    return {
      slug: subscription.plan_type,
      name: subscription.plan_type,
      durationDays: LEGACY_PLAN_DURATION_DAYS[subscription.plan_type] || 30,
    };
  }

  return null;
}

async function getUserSubscription(userId) {
  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

async function getUserSubscriptions(userId) {
  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

async function getSubscriptionById(subscriptionId) {
  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('id', subscriptionId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

async function createSubscription({ userId, planId, planCode, usersLimit, provider, providerData = {}, overrideAmountCents = null }) {
  const plan = await getPlan(planId || planCode);

  if (!plan) {
    throw new Error('INVALID_PLAN');
  }

  const existingSubscription = await getUserSubscription(userId);
  if (existingSubscription) {
    throw new Error('ACTIVE_SUBSCRIPTION_EXISTS');
  }

  const normalizedUsersLimit = Number(usersLimit || plan.includedUsers || 1);
  if (normalizedUsersLimit < Number(plan.includedUsers || 1)) {
    throw new Error('INVALID_USERS_LIMIT');
  }

  const amountCents = overrideAmountCents !== null
    ? overrideAmountCents
    : computeSubscriptionAmountCents(plan, normalizedUsersLimit);

  const subscriptionData = {
    user_id: userId,
    plan_id: plan.id,
    plan_type: plan.slug,
    plan_snapshot: {
      id: plan.id,
      slug: plan.slug,
      name: plan.name,
      basePriceCents: plan.basePriceCents,
      currency: plan.currency,
      durationDays: plan.durationDays,
      includedUsers: plan.includedUsers,
      extraUserPriceCents: plan.extraUserPriceCents,
      textQuotaPerUser: plan.textQuotaPerUser,
      audioQuotaPerUser: plan.audioQuotaPerUser,
      discountPercentPaidBooks: plan.discountPercentPaidBooks,
      bonusTrigger: plan.bonusTrigger,
      bonusType: plan.bonusType,
      bonusQuantityPerUser: plan.bonusQuantityPerUser,
      bonusValidityDays: plan.bonusValidityDays,
      metadata: plan.metadata || {},
    },
    users_limit: normalizedUsersLimit,
    amount: toMajorAmount(amountCents),
    currency: plan.currency,
    status: 'INACTIVE',
    provider,
    provider_subscription_id: providerData.subscriptionId || null,
    provider_customer_id: providerData.customerId || null,
    metadata: providerData.metadata || {},
  };

  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .insert(subscriptionData)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function activateSubscription(subscriptionId, periodEnd = null) {
  const subscription = await getSubscriptionById(subscriptionId);
  if (!subscription) {
    throw new Error('SUBSCRIPTION_NOT_FOUND');
  }

  const now = new Date();
  const actualPeriodEnd = periodEnd || await calculatePeriodEnd(subscription, now);

  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .update({
      status: 'ACTIVE',
      current_period_start: now.toISOString(),
      current_period_end: actualPeriodEnd.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('id', subscriptionId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function cancelSubscription(subscriptionId, immediately = false) {
  const now = new Date();

  const updateData = {
    cancel_at_period_end: !immediately,
    cancelled_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  if (immediately) {
    updateData.status = 'CANCELLED';
    updateData.current_period_end = now.toISOString();
  }

  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .update(updateData)
    .eq('id', subscriptionId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function expireSubscription(subscriptionId) {
  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .update({
      status: 'EXPIRED',
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function checkSubscriptionStatus(userId) {
  const subscription = await getUserSubscription(userId);

  if (!subscription) {
    return {
      hasSubscription: false,
      isActive: false,
      status: 'NONE',
    };
  }

  const now = new Date();
  const periodEnd = new Date(subscription.current_period_end);
  const isExpired = periodEnd.toString() !== 'Invalid Date' && now > periodEnd;

  if (isExpired && subscription.status === 'ACTIVE') {
    await expireSubscription(subscription.id);
    return {
      hasSubscription: true,
      isActive: false,
      status: 'EXPIRED',
      subscription: { ...subscription, status: 'EXPIRED' },
    };
  }

  return {
    hasSubscription: true,
    isActive: subscription.status === 'ACTIVE' && !isExpired,
    status: subscription.status,
    subscription,
  };
}

async function renewSubscription(subscriptionId, newPeriodEnd) {
  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .update({
      status: 'ACTIVE',
      current_period_start: new Date().toISOString(),
      current_period_end: newPeriodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function getPaymentHistory(userId) {
  const { data, error } = await supabaseAdmin
    .from('payments')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

async function createPayment({
  userId,
  subscriptionId,
  amount,
  currency,
  status,
  provider,
  providerPaymentId,
  providerCustomerId,
  paymentMethod,
  metadata = {},
}) {
  const paymentData = {
    user_id: userId,
    subscription_id: subscriptionId || null,
    amount,
    currency,
    status,
    provider,
    provider_payment_id: providerPaymentId,
    provider_customer_id: providerCustomerId,
    payment_method: paymentMethod || null,
    metadata,
  };

  if (status === 'succeeded') {
    paymentData.paid_at = new Date().toISOString();
  } else if (status === 'failed') {
    paymentData.failed_at = new Date().toISOString();
  }

  const { data, error } = await supabaseAdmin
    .from('payments')
    .insert(paymentData)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function updatePaymentStatus(paymentId, status, errorMessage = null) {
  const updateData = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === 'succeeded') {
    updateData.paid_at = new Date().toISOString();
  } else if (status === 'failed') {
    updateData.failed_at = new Date().toISOString();
    updateData.error_message = errorMessage;
  }

  const { data, error } = await supabaseAdmin
    .from('payments')
    .update(updateData)
    .eq('id', paymentId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function calculatePeriodEnd(planRefOrSubscription, startDate = new Date()) {
  let durationDays = 30;

  if (typeof planRefOrSubscription === 'string') {
    const plan = await getPlan(planRefOrSubscription);
    if (plan) {
      durationDays = Number(plan.durationDays || 30);
    } else {
      durationDays = LEGACY_PLAN_DURATION_DAYS[planRefOrSubscription] || 30;
    }
  } else if (planRefOrSubscription && typeof planRefOrSubscription === 'object') {
    const plan = await getPlanFromSubscription(planRefOrSubscription);
    durationDays = Number(plan?.durationDays || 30);
  }

  const periodEnd = new Date(startDate);
  periodEnd.setDate(periodEnd.getDate() + durationDays);
  return periodEnd;
}

function isActiveAndNotExpired(subscription) {
  if (!subscription || subscription.status !== 'ACTIVE') return false;
  const end = new Date(subscription.current_period_end);
  if (Number.isNaN(end.getTime())) return false;
  return end > new Date();
}

function normalizeSnapshotPlan(snapshot) {
  if (!snapshot) return null;
  return {
    id: snapshot.id || null,
    slug: snapshot.slug || snapshot.plan_type || null,
    name: snapshot.name || snapshot.display_name || snapshot.slug || 'plan',
    durationDays: Number(snapshot.durationDays || snapshot.duration_days || 30),
    basePriceCents: Number(snapshot.basePriceCents || snapshot.base_price_cents || 0),
    currency: snapshot.currency || 'USD',
    includedUsers: Number(snapshot.includedUsers || snapshot.included_users || 1),
    extraUserPriceCents: Number(snapshot.extraUserPriceCents || snapshot.extra_user_price_cents || 0),
    textQuotaPerUser: Number(snapshot.textQuotaPerUser || snapshot.text_quota_per_user || 0),
    audioQuotaPerUser: Number(snapshot.audioQuotaPerUser || snapshot.audio_quota_per_user || 0),
    discountPercentPaidBooks: Number(snapshot.discountPercentPaidBooks || snapshot.paid_books_discount_percent || 0),
    bonusTrigger: snapshot.bonusTrigger || snapshot.bonus_trigger || 'none',
    bonusType: snapshot.bonusType || snapshot.bonus_type || 'flex',
    bonusQuantityPerUser: Number(snapshot.bonusQuantityPerUser || snapshot.bonus_quantity_per_user || 0),
    bonusValidityDays: Number(snapshot.bonusValidityDays || snapshot.bonus_validity_days || 365),
    metadata: snapshot.metadata || {},
  };
}

async function resolvePricingPlanForSubscription(subscription) {
  if (subscription.plan_id) {
    try {
      const activePlan = await getPlan(subscription.plan_id);
      if (activePlan) return activePlan;
    } catch (error) {
      // Fallback to snapshot when plan is inactive or unavailable.
    }
  }

  const snapshotPlan = normalizeSnapshotPlan(subscription.plan_snapshot);
  if (snapshotPlan) return snapshotPlan;

  return {
    slug: subscription.plan_type || 'monthly',
    name: subscription.plan_type || 'monthly',
    durationDays: LEGACY_PLAN_DURATION_DAYS[subscription.plan_type] || 30,
    basePriceCents: Math.round(Number(subscription.amount || 0) * 100),
    currency: subscription.currency || 'USD',
    includedUsers: Number(subscription.users_limit || 1),
    extraUserPriceCents: 0,
    textQuotaPerUser: 0,
    audioQuotaPerUser: 0,
    discountPercentPaidBooks: 0,
    bonusTrigger: 'none',
    bonusType: 'flex',
    bonusQuantityPerUser: 0,
    bonusValidityDays: 365,
    metadata: {},
  };
}

async function computeRenewalAmountForSubscription(subscription) {
  const plan = await resolvePricingPlanForSubscription(subscription);
  const amountCents = computeSubscriptionAmountCents(plan, subscription.users_limit || plan.includedUsers || 1);
  return {
    plan,
    amountCents,
    amount: toMajorAmount(amountCents),
    currency: plan.currency || subscription.currency || 'USD',
  };
}

function buildPlanSnapshot(plan) {
  return {
    id: plan.id,
    slug: plan.slug,
    name: plan.name,
    basePriceCents: Number(plan.basePriceCents || 0),
    currency: plan.currency || 'USD',
    durationDays: Number(plan.durationDays || 30),
    includedUsers: Number(plan.includedUsers || 1),
    extraUserPriceCents: Number(plan.extraUserPriceCents || 0),
    textQuotaPerUser: Number(plan.textQuotaPerUser || 0),
    audioQuotaPerUser: Number(plan.audioQuotaPerUser || 0),
    discountPercentPaidBooks: Number(plan.discountPercentPaidBooks || 0),
    bonusTrigger: plan.bonusTrigger || 'none',
    bonusType: plan.bonusType || 'flex',
    bonusQuantityPerUser: Number(plan.bonusQuantityPerUser || 0),
    bonusValidityDays: Number(plan.bonusValidityDays || 365),
    metadata: plan.metadata || {},
  };
}

async function applySuccessfulSubscriptionPayment(subscriptionId) {
  const subscription = await getSubscriptionById(subscriptionId);
  if (!subscription) {
    throw new Error('SUBSCRIPTION_NOT_FOUND');
  }

  const now = new Date();
  const metadata = subscription.metadata || {};
  const pendingPlanChange = metadata.pending_plan_change || null;
  let effectiveSubscription = { ...subscription };
  const updateData = {
    status: 'ACTIVE',
    cancel_at_period_end: false,
    updated_at: now.toISOString(),
  };

  if (pendingPlanChange?.plan_id || pendingPlanChange?.plan_slug) {
    const nextPlan = await getPlan(pendingPlanChange.plan_id || pendingPlanChange.plan_slug);
    if (nextPlan) {
      const nextUsersLimit = Number(
        pendingPlanChange.users_limit || subscription.users_limit || nextPlan.includedUsers || 1
      );
      const nextAmountCents = computeSubscriptionAmountCents(nextPlan, nextUsersLimit);

      updateData.plan_id = nextPlan.id;
      updateData.plan_type = nextPlan.slug;
      updateData.plan_snapshot = buildPlanSnapshot(nextPlan);
      updateData.users_limit = Math.max(nextUsersLimit, Number(nextPlan.includedUsers || 1));
      updateData.amount = toMajorAmount(nextAmountCents);
      updateData.currency = nextPlan.currency;

      effectiveSubscription = {
        ...effectiveSubscription,
        plan_id: nextPlan.id,
        plan_type: nextPlan.slug,
        plan_snapshot: buildPlanSnapshot(nextPlan),
        users_limit: updateData.users_limit,
        amount: updateData.amount,
        currency: nextPlan.currency,
      };
    }
  }

  const metadataWithoutPending = { ...(metadata || {}) };
  if (metadataWithoutPending.pending_plan_change) {
    delete metadataWithoutPending.pending_plan_change;
    metadataWithoutPending.last_plan_change_applied_at = now.toISOString();
    updateData.metadata = metadataWithoutPending;
  }

  if (isActiveAndNotExpired(subscription)) {
    const currentEnd = new Date(subscription.current_period_end);
    const nextPeriodEnd = await calculatePeriodEnd(effectiveSubscription, currentEnd);
    updateData.current_period_end = nextPeriodEnd.toISOString();
  } else {
    const nextPeriodEnd = await calculatePeriodEnd(effectiveSubscription, now);
    updateData.current_period_start = now.toISOString();
    updateData.current_period_end = nextPeriodEnd.toISOString();
  }

  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .update(updateData)
    .eq('id', subscriptionId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function getActiveSubscriptionForMember(userId) {
  const { data, error } = await supabaseAdmin
    .from('subscription_members')
    .select(`
      subscription_id,
      role,
      status,
      subscriptions!inner(*)
    `)
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('subscriptions.status', 'ACTIVE')
    .order('created_at', { referencedTable: 'subscriptions', ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    const ownerSubscription = await getUserSubscription(userId);
    if (!ownerSubscription) return null;
    await ensureOwnerMembership(ownerSubscription);
    return {
      subscription: ownerSubscription,
      memberRole: 'owner',
    };
  }

  return {
    subscription: data.subscriptions,
    memberRole: data.role,
  };
}

async function ensureOwnerMembership(subscription) {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('subscription_members')
    .select('id')
    .eq('subscription_id', subscription.id)
    .eq('user_id', subscription.user_id)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return existing;

  const { data, error } = await supabaseAdmin
    .from('subscription_members')
    .insert({
      subscription_id: subscription.id,
      user_id: subscription.user_id,
      role: 'owner',
      status: 'active',
      joined_at: subscription.current_period_start || subscription.created_at || new Date().toISOString(),
      metadata: { auto_created: true },
    })
    .select()
    .single();

  if (error) {
    // 23505 = unique_violation: concurrent request already inserted — not an error
    if (error.code === '23505') return null;
    throw error;
  }
  return data;
}

/**
 * Apply an extra seat purchase to a subscription (idempotent).
 * Only updates users_limit if current value < targetUsersLimit.
 *
 * @param {string} subscriptionId
 * @param {number} targetUsersLimit - The new desired users_limit
 * @returns {object} Updated subscription row
 */
async function applyExtraSeat(subscriptionId, targetUsersLimit) {
  const { data: sub, error: subErr } = await supabaseAdmin
    .from('subscriptions')
    .select('users_limit, plan_id, plan_type, plan_snapshot, currency, amount')
    .eq('id', subscriptionId)
    .single();

  if (subErr) throw subErr;

  // Idempotent guard: already at target or higher
  if (Number(sub.users_limit) >= targetUsersLimit) {
    console.log(`ℹ️  applyExtraSeat: already at ${sub.users_limit} seats, target=${targetUsersLimit}, skipping`);
    return sub;
  }

  // Recompute monthly amount with new seat count
  const plan = sub.plan_id ? await getPlan(sub.plan_id) : null;
  let amountCents;
  if (plan) {
    amountCents = computeSubscriptionAmountCents(plan, targetUsersLimit);
  } else {
    const snapshot = sub.plan_snapshot || {};
    const baseCents = Number(snapshot.basePriceCents || Math.round(Number(sub.amount || 0) * 100));
    const includedUsers = Number(snapshot.includedUsers || 1);
    const extraCents = Number(snapshot.extraUserPriceCents || 0);
    amountCents = baseCents + Math.max(0, targetUsersLimit - includedUsers) * extraCents;
  }

  const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .update({
      users_limit: targetUsersLimit,
      amount: toMajorAmount(amountCents),
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId)
    .select()
    .single();

  if (error) throw error;
  console.log(`✅ applyExtraSeat: subscription ${subscriptionId} → ${targetUsersLimit} seats`);
  return data;
}

async function getCurrentCycle(subscriptionId) {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('subscription_cycles')
    .select('*')
    .eq('subscription_id', subscriptionId)
    .lte('period_start', now)
    .gt('period_end', now)
    .order('period_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function ensureCurrentCycle(subscription) {
  let cycle = await getCurrentCycle(subscription.id);
  if (cycle) return cycle;

  if (!subscription.current_period_start || !subscription.current_period_end) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from('subscription_cycles')
    .insert({
      subscription_id: subscription.id,
      period_start: subscription.current_period_start,
      period_end: subscription.current_period_end,
      status: 'active',
    })
    .select()
    .single();

  if (error && error.code !== '23505') throw error;
  if (data) return data;

  return await getCurrentCycle(subscription.id);
}

async function resolveUsageQuotas(subscription) {
  const snapshot = normalizeSnapshotPlan(subscription.plan_snapshot);
  let textQuota = Number(snapshot?.textQuotaPerUser || 0);
  let audioQuota = Number(snapshot?.audioQuotaPerUser || 0);
  let bonusQuota = Number(snapshot?.bonusQuantityPerUser || 0);

  if (textQuota === 0 && audioQuota === 0 && bonusQuota === 0 && subscription.plan_id) {
    const livePlan = await getPlan(subscription.plan_id);
    if (livePlan) {
      textQuota = Number(livePlan.textQuotaPerUser || 0);
      audioQuota = Number(livePlan.audioQuotaPerUser || 0);
      bonusQuota = Number(livePlan.bonusQuantityPerUser || 0);
    }
  }

  return { textQuota, audioQuota, bonusQuota };
}

async function ensureMemberCycleUsage(subscription, cycle, userId) {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('member_cycle_usage')
    .select('*')
    .eq('cycle_id', cycle.id)
    .eq('user_id', userId)
    .maybeSingle();

  if (existingError) throw existingError;

  const { textQuota, audioQuota, bonusQuota } = await resolveUsageQuotas(subscription);

  // If row exists but quotas are 0 (created before plan had quotas configured), patch it.
  if (existing) {
    const needsPatch = Number(existing.text_quota || 0) === 0 && Number(existing.audio_quota || 0) === 0
      && (textQuota > 0 || audioQuota > 0);
    if (needsPatch) {
      const { data: patched } = await supabaseAdmin
        .from('member_cycle_usage')
        .update({ text_quota: textQuota, audio_quota: audioQuota, bonus_quota: bonusQuota || existing.bonus_quota, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();
      return patched || existing;
    }
    return existing;
  }

  const { data, error } = await supabaseAdmin
    .from('member_cycle_usage')
    .insert({
      cycle_id: cycle.id,
      subscription_id: subscription.id,
      user_id: userId,
      text_quota: textQuota,
      audio_quota: audioQuota,
      bonus_quota: bonusQuota,
    })
    .select()
    .single();

  if (error && error.code !== '23505') throw error;
  if (data) return data;

  const { data: fallback, error: fallbackError } = await supabaseAdmin
    .from('member_cycle_usage')
    .select('*')
    .eq('cycle_id', cycle.id)
    .eq('user_id', userId)
    .single();

  if (fallbackError) throw fallbackError;
  return fallback;
}

async function ensureProfileCycleUsage(subscription, cycle, profileId) {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('profile_cycle_usage')
    .select('*')
    .eq('cycle_id', cycle.id)
    .eq('profile_id', profileId)
    .maybeSingle();

  if (existingError) throw existingError;

  const { textQuota, audioQuota, bonusQuota } = await resolveUsageQuotas(subscription);

  if (existing) {
    const needsPatch = Number(existing.text_quota || 0) === 0
      && Number(existing.audio_quota || 0) === 0
      && Number(existing.bonus_quota || 0) === 0
      && (textQuota > 0 || audioQuota > 0 || bonusQuota > 0);

    if (needsPatch) {
      const { data: patched } = await supabaseAdmin
        .from('profile_cycle_usage')
        .update({
          text_quota: textQuota,
          audio_quota: audioQuota,
          bonus_quota: bonusQuota,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();
      return patched || existing;
    }
    return existing;
  }

  const { data, error } = await supabaseAdmin
    .from('profile_cycle_usage')
    .insert({
      cycle_id: cycle.id,
      subscription_id: subscription.id,
      profile_id: profileId,
      text_quota: textQuota,
      audio_quota: audioQuota,
      bonus_quota: bonusQuota,
    })
    .select()
    .single();

  if (error && error.code !== '23505') throw error;
  if (data) return data;

  const { data: fallback, error: fallbackError } = await supabaseAdmin
    .from('profile_cycle_usage')
    .select('*')
    .eq('cycle_id', cycle.id)
    .eq('profile_id', profileId)
    .single();

  if (fallbackError) throw fallbackError;
  return fallback;
}

async function getBonusCredits(userId, { includeExpired = false } = {}) {
  let query = supabaseAdmin
    .from('bonus_credits')
    .select('*')
    .eq('user_id', userId)
    .order('expires_at', { ascending: true });

  if (!includeExpired) {
    query = query.gt('expires_at', new Date().toISOString());
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

module.exports = {
  getPlans,
  getPlan,
  getUserSubscription,
  getUserSubscriptions,
  getSubscriptionById,
  createSubscription,
  activateSubscription,
  cancelSubscription,
  expireSubscription,
  renewSubscription,
  checkSubscriptionStatus,
  getPaymentHistory,
  createPayment,
  updatePaymentStatus,
  calculatePeriodEnd,
  computeSubscriptionAmountCents,
  computeRenewalAmountForSubscription,
  toMajorAmount,
  applySuccessfulSubscriptionPayment,
  getActiveSubscriptionForMember,
  ensureOwnerMembership,
  applyExtraSeat,
  getCurrentCycle,
  ensureCurrentCycle,
  ensureMemberCycleUsage,
  ensureProfileCycleUsage,
  getBonusCredits,
};
