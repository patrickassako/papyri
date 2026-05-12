/**
 * Audience resolver — turns a (target, criteria) tuple into a list of user_ids.
 * Used by the admin notifications endpoint to support segmented broadcasts.
 *
 * Supported targets:
 *   all                       → every active profile
 *   user                      → single user (criteria.userId or criteria.userEmail)
 *   active_subscribers        → ACTIVE/TRIAL subscriptions
 *   expired_subscribers       → EXPIRED subscriptions
 *   cancelled_subscribers     → CANCELLED subscriptions
 *   read_category             → profiles who read at least one book of
 *                               criteria.categoryId in the past N days
 *                               (criteria.daysWindow, default 60)
 *   bought_paid               → profiles with at least one content_unlocks
 *                               row where source='paid'
 *   kid_profiles              → owners of profiles flagged kid_profile
 *   adult_profiles            → owners of profiles NOT flagged kid
 *   push_enabled              → users with push_enabled=true (any token)
 */

const { supabaseAdmin } = require('../config/database');

async function resolveAudience(target, criteria = {}) {
  switch (String(target || '').toLowerCase()) {
    case 'all':
      return resolveAll();
    case 'user':
      return resolveSingleUser(criteria);
    case 'active_subscribers':
      return resolveBySubscriptionStatus(['ACTIVE', 'TRIAL']);
    case 'expired_subscribers':
      return resolveBySubscriptionStatus(['EXPIRED']);
    case 'cancelled_subscribers':
      return resolveBySubscriptionStatus(['CANCELLED']);
    case 'read_category':
      return resolveReadCategory(criteria);
    case 'bought_paid':
      return resolveBoughtPaid();
    case 'kid_profiles':
      return resolveKidProfiles();
    case 'adult_profiles':
      return resolveAdultProfiles();
    case 'push_enabled':
      return resolvePushEnabled();
    default:
      throw new Error(`Unknown audience target: ${target}`);
  }
}

async function resolveAll() {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('is_active', true);
  return (data || []).map(r => r.id);
}

async function resolveSingleUser({ userId, userEmail }) {
  if (userId) return [userId];
  if (userEmail) {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', String(userEmail).trim().toLowerCase())
      .maybeSingle();
    return profile ? [profile.id] : [];
  }
  throw new Error('user target requires userId or userEmail');
}

async function resolveBySubscriptionStatus(statuses) {
  const { data } = await supabaseAdmin
    .from('subscriptions')
    .select('user_id')
    .in('status', statuses);
  return [...new Set((data || []).map(r => r.user_id).filter(Boolean))];
}

async function resolveReadCategory({ categoryId, daysWindow = 60 }) {
  if (!categoryId) throw new Error('read_category target requires categoryId');
  const since = new Date(Date.now() - daysWindow * 86400000).toISOString();
  const { data } = await supabaseAdmin
    .from('reading_history')
    .select('user_id, contents!inner(id, content_categories!inner(category_id))')
    .gte('last_read_at', since)
    .eq('contents.content_categories.category_id', categoryId);
  return [...new Set((data || []).map(r => r.user_id).filter(Boolean))];
}

async function resolveBoughtPaid() {
  const { data } = await supabaseAdmin
    .from('content_unlocks')
    .select('user_id')
    .eq('source', 'paid');
  return [...new Set((data || []).map(r => r.user_id).filter(Boolean))];
}

async function resolveKidProfiles() {
  // family_profiles has owner_user_id; kid_profile boolean.
  const { data } = await supabaseAdmin
    .from('family_profiles')
    .select('owner_user_id')
    .eq('kid_profile', true);
  return [...new Set((data || []).map(r => r.owner_user_id).filter(Boolean))];
}

async function resolveAdultProfiles() {
  // Owners whose family_profiles entries are all non-kid (or have no kid profile).
  const { data: kidOwners } = await supabaseAdmin
    .from('family_profiles')
    .select('owner_user_id')
    .eq('kid_profile', true);
  const kidSet = new Set((kidOwners || []).map(r => r.owner_user_id));
  const all = await resolveAll();
  return all.filter(id => !kidSet.has(id));
}

async function resolvePushEnabled() {
  const { data } = await supabaseAdmin
    .from('notification_preferences')
    .select('user_id')
    .eq('push_enabled', true)
    .not('fcm_token', 'is', null);
  return (data || []).map(r => r.user_id).filter(Boolean);
}

module.exports = {
  resolveAudience,
};
