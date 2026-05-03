const bcrypt = require('bcryptjs');
const { supabase, supabaseAdmin } = require('../config/database');
const subscriptionsService = require('./subscriptions.service');
const authService = require('./auth.service');

const MAX_PIN_LENGTH = 6;
const MIN_PIN_LENGTH = 4;

function isFamilySubscription(subscription) {
  if (!subscription) return false;
  const snapshotSlug = String(subscription?.plan_snapshot?.slug || '').toLowerCase();
  const typeSlug = String(subscription?.plan_type || '').toLowerCase();
  // Detect any plan starting with "family" (family, family-monthly, family-annual, family-yearly).
  // Fallback: included_users > 1 — any multi-seat plan is family-style.
  if (snapshotSlug.startsWith('family') || typeSlug.startsWith('family')) return true;
  const includedUsers = Number(
    subscription?.plan_snapshot?.includedUsers
    ?? subscription?.included_profiles
    ?? subscription?.users_limit
    ?? 1
  );
  return includedUsers > 1;
}

function sanitizeProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    subscription_id: row.subscription_id,
    owner_user_id: row.owner_user_id,
    name: row.name,
    avatar_key: row.avatar_key,
    is_owner_profile: Boolean(row.is_owner_profile),
    is_kid: Boolean(row.is_kid),
    pin_enabled: Boolean(row.pin_enabled),
    is_active: Boolean(row.is_active),
    position: Number(row.position || 0),
    last_used_at: row.last_used_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

function normalizeName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ');
}

function validatePin(pin) {
  const raw = String(pin || '').trim();
  if (!/^\d{4,6}$/.test(raw)) {
    throw new Error('INVALID_PIN');
  }
  if (raw.length < MIN_PIN_LENGTH || raw.length > MAX_PIN_LENGTH) {
    throw new Error('INVALID_PIN');
  }
  return raw;
}

async function getManagedFamilySubscription(userId) {
  const subscription = await subscriptionsService.getUserSubscription(userId);
  if (!subscription) {
    throw new Error('NO_ACTIVE_SUBSCRIPTION');
  }
  if (!isFamilySubscription(subscription)) {
    throw new Error('FAMILY_SUBSCRIPTION_REQUIRED');
  }
  return subscription;
}

async function countActiveProfiles(subscriptionId) {
  const { count, error } = await supabaseAdmin
    .from('family_profiles')
    .select('id', { head: true, count: 'exact' })
    .eq('subscription_id', subscriptionId)
    .eq('is_active', true)
    .is('deleted_at', null);

  if (error) throw error;
  return Number(count || 0);
}

async function listProfilesForOwner(userId) {
  const subscription = await getManagedFamilySubscription(userId);

  const { data, error } = await supabaseAdmin
    .from('family_profiles')
    .select('*')
    .eq('subscription_id', subscription.id)
    .is('deleted_at', null)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;

  return {
    subscription: {
      id: subscription.id,
      included_profiles: Number(subscription.included_profiles || 3),
      profiles_limit: Number(subscription.profiles_limit || subscription.users_limit || 3),
      max_profiles: Number(subscription.max_profiles || 10),
    },
    profiles: (data || []).map(sanitizeProfile),
  };
}

async function getProfileForOwner(userId, profileId) {
  const subscription = await getManagedFamilySubscription(userId);
  const { data, error } = await supabaseAdmin
    .from('family_profiles')
    .select('*')
    .eq('id', profileId)
    .eq('subscription_id', subscription.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('PROFILE_NOT_FOUND');

  return { subscription, profile: data };
}

async function createProfile(userId, payload) {
  const subscription = await getManagedFamilySubscription(userId);
  const currentCount = await countActiveProfiles(subscription.id);
  const profilesLimit = Number(subscription.profiles_limit || subscription.users_limit || 3);
  const maxProfiles = Number(subscription.max_profiles || 10);

  if (currentCount >= profilesLimit || currentCount >= maxProfiles) {
    throw new Error('PROFILE_LIMIT_REACHED');
  }

  const name = normalizeName(payload?.name);
  if (!name || name.length > 80) {
    throw new Error('INVALID_PROFILE_NAME');
  }

  const { data: existingRows, error: posError } = await supabaseAdmin
    .from('family_profiles')
    .select('position')
    .eq('subscription_id', subscription.id)
    .is('deleted_at', null)
    .order('position', { ascending: false })
    .limit(1);

  if (posError) throw posError;
  const nextPosition = Number(existingRows?.[0]?.position || 0) + 1;

  let pinHash = null;
  let pinEnabled = false;
  if (payload?.pin) {
    const pin = validatePin(payload.pin);
    pinHash = await bcrypt.hash(pin, 10);
    pinEnabled = true;
  }

  const { data, error } = await supabaseAdmin
    .from('family_profiles')
    .insert({
      subscription_id: subscription.id,
      owner_user_id: userId,
      name,
      avatar_key: payload?.avatar_key || null,
      is_owner_profile: false,
      is_kid: Boolean(payload?.is_kid),
      pin_hash: pinHash,
      pin_enabled: pinEnabled,
      is_active: true,
      position: nextPosition,
    })
    .select()
    .single();

  if (error) throw error;
  return sanitizeProfile(data);
}

async function updateProfile(userId, profileId, payload) {
  const { profile } = await getProfileForOwner(userId, profileId);

  const updateData = {
    updated_at: new Date().toISOString(),
  };

  if (payload?.name !== undefined) {
    const name = normalizeName(payload.name);
    if (!name || name.length > 80) throw new Error('INVALID_PROFILE_NAME');
    updateData.name = name;
  }

  if (payload?.avatar_key !== undefined) {
    updateData.avatar_key = payload.avatar_key || null;
  }

  if (payload?.is_kid !== undefined) {
    updateData.is_kid = Boolean(payload.is_kid);
  }

  if (payload?.position !== undefined) {
    const position = Number(payload.position);
    if (!Number.isInteger(position) || position < 0) throw new Error('INVALID_PROFILE_POSITION');
    updateData.position = position;
  }

  if (Object.keys(updateData).length === 1) {
    return sanitizeProfile(profile);
  }

  const { data, error } = await supabaseAdmin
    .from('family_profiles')
    .update(updateData)
    .eq('id', profileId)
    .select()
    .single();

  if (error) throw error;
  return sanitizeProfile(data);
}

async function deleteProfile(userId, profileId, options = {}) {
  const { profile } = await getProfileForOwner(userId, profileId);
  if (profile.is_owner_profile) {
    throw new Error('OWNER_PROFILE_CANNOT_BE_DELETED');
  }
  authService.consumeVerifiedEmailActionToken(userId, options.verificationToken, 'profile_pin_owner');

  const { data, error } = await supabaseAdmin
    .from('family_profiles')
    .update({
      is_active: false,
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', profileId)
    .select()
    .single();

  if (error) throw error;
  return sanitizeProfile(data);
}

async function setProfilePin(userId, profileId, pin, options = {}) {
  const { profile } = await getProfileForOwner(userId, profileId);
  if (profile.is_owner_profile) {
    authService.consumeVerifiedEmailActionToken(userId, options.verificationToken, 'profile_pin_owner');
  }
  const normalizedPin = validatePin(pin);
  const pinHash = await bcrypt.hash(normalizedPin, 10);

  const { data, error } = await supabaseAdmin
    .from('family_profiles')
    .update({
      pin_hash: pinHash,
      pin_enabled: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.id)
    .select()
    .single();

  if (error) throw error;
  return sanitizeProfile(data);
}

async function removeProfilePin(userId, profileId, options = {}) {
  const { profile } = await getProfileForOwner(userId, profileId);
  if (profile.is_owner_profile) {
    authService.consumeVerifiedEmailActionToken(userId, options.verificationToken, 'profile_pin_owner');
  }

  const { data, error } = await supabaseAdmin
    .from('family_profiles')
    .update({
      pin_hash: null,
      pin_enabled: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.id)
    .select()
    .single();

  if (error) throw error;
  return sanitizeProfile(data);
}

async function verifyProfilePin(userId, profileId, pin) {
  const { profile } = await getProfileForOwner(userId, profileId);

  if (!profile.pin_enabled || !profile.pin_hash) {
    return { valid: true, profile: sanitizeProfile(profile) };
  }

  const normalizedPin = validatePin(pin);
  const valid = await bcrypt.compare(normalizedPin, profile.pin_hash);
  if (!valid) throw new Error('INVALID_PIN');

  await supabaseAdmin
    .from('family_profiles')
    .update({ last_used_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', profile.id);

  return { valid: true, profile: sanitizeProfile(profile) };
}

async function selectProfile(userId, profileId, pin = null) {
  const { profile } = await getProfileForOwner(userId, profileId);
  if (!profile.is_active || profile.deleted_at) {
    throw new Error('PROFILE_NOT_FOUND');
  }

  if (profile.pin_enabled) {
    if (pin === null || pin === undefined || pin === '') {
      throw new Error('PIN_REQUIRED');
    }
    const normalizedPin = validatePin(pin);
    const valid = await bcrypt.compare(normalizedPin, profile.pin_hash);
    if (!valid) throw new Error('INVALID_PIN');
  }

  const { data, error } = await supabaseAdmin
    .from('family_profiles')
    .update({
      last_used_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.id)
    .select()
    .single();

  if (error) throw error;
  return sanitizeProfile(data);
}

async function resolveProfileForUser(userId, requestedProfileId = null) {
  const subscription = await subscriptionsService.getUserSubscription(userId);
  if (!subscription || !isFamilySubscription(subscription)) {
    return {
      subscription: null,
      profile: null,
      profileId: null,
      isFamilyContext: false,
    };
  }

  if (requestedProfileId) {
    try {
      const { profile } = await getProfileForOwner(userId, requestedProfileId);
      return {
        subscription,
        profile: sanitizeProfile(profile),
        profileId: profile.id,
        isFamilyContext: true,
      };
    } catch (profileErr) {
      // Stale or invalid profileId (e.g. subscription renewed, profile deleted) —
      // fall through to owner profile lookup rather than propagating as 500.
      const benign = ['PROFILE_NOT_FOUND', 'NO_ACTIVE_SUBSCRIPTION', 'FAMILY_SUBSCRIPTION_REQUIRED'];
      if (!benign.includes(profileErr.message)) throw profileErr;
    }
  }

  const { data, error } = await supabaseAdmin
    .from('family_profiles')
    .select('*')
    .eq('subscription_id', subscription.id)
    .eq('owner_user_id', userId)
    .eq('is_owner_profile', true)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw error;

  return {
    subscription,
    profile: sanitizeProfile(data),
    profileId: data?.id || null,
    isFamilyContext: true,
  };
}

module.exports = {
  isFamilySubscription,
  getManagedFamilySubscription,
  listProfilesForOwner,
  getProfileForOwner,
  createProfile,
  updateProfile,
  deleteProfile,
  setProfilePin,
  removeProfilePin,
  verifyProfilePin,
  selectProfile,
  resolveProfileForUser,
};
