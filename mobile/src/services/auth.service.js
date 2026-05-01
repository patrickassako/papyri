/**
 * Authentication Service (Mobile)
 * Migrated to Supabase Auth - Direct client usage
 */

import { supabase } from '../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Note: Token storage is handled by Supabase client with custom storage adapter
// Session persists in global storage (to be migrated to AsyncStorage later)
let currentUser = null;

/**
 * Register a new user
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {string} full_name - User full name
 * @param {string} language - User language (default: 'fr')
 * @returns {Promise<{user, session}>}
 */
export async function register(email, password, full_name, language = 'fr') {
  // Validation
  if (!email || !password || !full_name) {
    throw new Error('MISSING_FIELDS');
  }

  if (password.length < 8) {
    throw new Error('PASSWORD_TOO_SHORT');
  }

  // Sign up with Supabase Auth
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    if (error.message.includes('already registered')) {
      throw new Error('EMAIL_ALREADY_EXISTS');
    }
    throw error;
  }

  // Update profile with real values using RPC function
  if (data.user) {
    const { error: profileError } = await supabase.rpc('update_user_profile', {
      user_id: data.user.id,
      new_full_name: full_name,
      new_language: language,
    });

    if (profileError) {
      console.error('Profile update error:', profileError);
      // Don't throw - user is created, profile update can be retried
    }

    // Store user locally
    currentUser = {
      id: data.user.id,
      email: data.user.email,
      full_name,
      language,
      role: 'user',
    };
  }

  return {
    user: currentUser,
    session: data.session,
  };
}

/**
 * Login existing user
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<{user, session}>}
 */
export async function login(email, password) {
  if (!email || !password) {
    throw new Error('MISSING_FIELDS');
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error('INVALID_CREDENTIALS');
  }

  // Get profile data
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  currentUser = {
    id: data.user.id,
    email: data.user.email,
    full_name: profile?.full_name,
    language: profile?.language,
    avatar_url: profile?.avatar_url,
    onboarding_completed: profile?.onboarding_completed,
    role: data.user.user_metadata?.role || 'user',
  };

  return {
    user: currentUser,
    session: data.session,
  };
}

/**
 * Logout current user
 */
export async function logout() {
  // Revoke push token before signing out so we still have the session
  try {
    const { revokePushToken } = require('./notifications.service');
    await revokePushToken();
  } catch (_) {}

  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('Logout error:', error);
    // Don't throw - logout should always succeed client-side
  }

  // Clear local user cache
  currentUser = null;

  return { success: true };
}

/**
 * Get current session
 * @returns {Promise<{session, user}|null>}
 */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session) {
    return null;
  }

  // Update local user cache if needed
  if (!currentUser && data.session.user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.session.user.id)
      .single();

    currentUser = {
      id: data.session.user.id,
      email: data.session.user.email,
      full_name: profile?.full_name,
      language: profile?.language,
      avatar_url: profile?.avatar_url,
      onboarding_completed: profile?.onboarding_completed,
      role: data.session.user.user_metadata?.role || 'user',
    };
  }

  return {
    session: data.session,
    user: currentUser,
  };
}

/**
 * Get current user
 * @returns {Promise<Object|null>}
 */
export async function getUser() {
  if (currentUser) {
    return currentUser;
  }

  // Try to restore from session
  const sessionData = await getSession();
  return sessionData?.user || null;
}

/**
 * Check if user is authenticated
 * @returns {Promise<boolean>}
 */
export async function isAuthenticated() {
  const sessionData = await getSession();
  return !!sessionData?.session;
}

/**
 * Get access token for API calls (if needed for non-Supabase APIs)
 * @returns {Promise<string|null>}
 */
export async function getAccessToken() {
  const sessionData = await getSession();
  return sessionData?.session?.access_token || null;
}

/**
 * Make authenticated API request to backend with Supabase token
 * @param {string} url - API endpoint
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>}
 */
export async function authFetch(url, options = {}) {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  // Read active family profile (if any) to scope API data
  let profileId = null;
  try {
    const raw = await AsyncStorage.getItem('@papyri_active_profile');
    if (raw) {
      const activeProfile = JSON.parse(raw);
      profileId = activeProfile?.id || null;
    }
  } catch (_) {}

  // Add authorization header with Supabase JWT
  const headers = {
    ...options.headers,
    Authorization: `Bearer ${accessToken}`,
    ...(profileId ? { 'X-Profile-Id': profileId } : {}),
  };

  const timeoutMs = options.timeout || 30000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(url, { ...options, headers, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('REQUEST_TIMEOUT');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  // If 401, session expired - logout
  if (response.status === 401) {
    await logout();
    throw new Error('Session expired');
  }

  return response;
}
