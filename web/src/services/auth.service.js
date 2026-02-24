/**
 * Authentication Service (Web)
 * Uses backend auth endpoints + Supabase client session
 */

import { supabase } from '../config/supabase';
import {
  clearTokens,
  getAccessToken as getStoredAccessToken,
  getRefreshToken as getStoredRefreshToken,
  setTokens,
} from '../config/storage';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function toErrorMessage(code, fallback = 'Une erreur est survenue.') {
  if (code === 'EMAIL_ALREADY_EXISTS') return 'Un compte existe déjà avec cette adresse email.';
  if (code === 'INVALID_CREDENTIALS') return 'Email ou mot de passe incorrect.';
  if (code === 'PASSWORD_TOO_SHORT') return 'Le mot de passe doit contenir au moins 8 caractères.';
  if (code === 'MISSING_FIELDS') return 'Veuillez remplir tous les champs obligatoires.';
  return fallback;
}

async function parseAuthResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.success) {
    const code = payload?.error?.code;
    throw new Error(toErrorMessage(code, payload?.error?.message || 'Erreur de connexion.'));
  }
  return payload.data;
}

async function syncClientSession(session) {
  if (!session?.access_token || !session?.refresh_token) {
    return;
  }
  setTokens(session.access_token, session.refresh_token);
  await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
}

async function restoreSupabaseSessionFromStoredTokens() {
  const accessToken = getStoredAccessToken();
  const refreshToken = getStoredRefreshToken();
  if (!accessToken || !refreshToken) {
    return null;
  }

  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error || !data?.session) {
    clearTokens();
    return null;
  }

  // Keep local storage aligned in case tokens are rotated by Supabase.
  if (data.session.access_token && data.session.refresh_token) {
    setTokens(data.session.access_token, data.session.refresh_token);
  }

  return data.session;
}

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

  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      full_name,
      language,
    }),
  });
  const data = await parseAuthResponse(response);
  await syncClientSession(data.session);

  return data;
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

  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });
  const data = await parseAuthResponse(response);
  await syncClientSession(data.session);

  return data;
}

/**
 * Logout current user
 */
export async function logout() {
  const accessToken = await getAccessToken();
  if (accessToken) {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
    } catch (error) {
      console.error('Backend logout error:', error);
    }
  }

  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('Logout error:', error);
    // Don't throw - logout should always succeed client-side
  }
  clearTokens();

  // Redirect to login
  window.location.href = '/login';

  return { success: true };
}

/**
 * Get current session
 * @returns {Promise<{session, user}|null>}
 */
export async function getSession() {
  let { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    const restoredSession = await restoreSupabaseSessionFromStoredTokens();
    if (!restoredSession) {
      return null;
    }
    ({ data, error } = await supabase.auth.getSession());
    if (error || !data.session) {
      return null;
    }
  }

  // Get profile data
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.session.user.id)
    .single();

  return {
    session: data.session,
    user: {
      id: data.session.user.id,
      email: data.session.user.email,
      full_name: profile?.full_name,
      language: profile?.language,
      avatar_url: profile?.avatar_url,
      onboarding_completed: profile?.onboarding_completed,
      role: data.session.user.user_metadata?.role || 'user',
    },
  };
}

/**
 * Get current user
 * @returns {Promise<Object|null>}
 */
export async function getUser() {
  const sessionData = await getSession();
  return sessionData?.user || null;
}

/**
 * Check if user is authenticated
 * @returns {Promise<boolean>}
 */
export async function isAuthenticated() {
  const token = getStoredAccessToken();
  if (token) {
    return true;
  }
  const sessionData = await getSession();
  return !!sessionData?.session;
}

/**
 * Get access token for API calls (if needed for non-Supabase APIs)
 * @returns {Promise<string|null>}
 */
export async function getAccessToken() {
  const storedToken = getStoredAccessToken();
  if (storedToken) {
    return storedToken;
  }

  const sessionData = await getSession();
  return sessionData?.session?.access_token || null;
}

/**
 * Make authenticated API request to backend with Supabase token
 * Handles token refresh on 401 before giving up.
 * @param {string} url - API endpoint
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>}
 */
let _refreshPromise = null;

async function refreshTokens() {
  // Deduplicate concurrent refresh attempts
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    try {
      const refreshToken = getStoredRefreshToken();
      if (!refreshToken) return null;

      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (error || !data?.session) {
        clearTokens();
        return null;
      }

      setTokens(data.session.access_token, data.session.refresh_token);
      return data.session.access_token;
    } catch {
      clearTokens();
      return null;
    } finally {
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

export async function authFetch(url, options = {}) {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  // Add authorization header with Supabase JWT
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${accessToken}`,
  };

  const response = await fetch(url, { ...options, headers });

  // If 401, attempt token refresh before giving up
  if (response.status === 401) {
    const newToken = await refreshTokens();
    if (newToken) {
      // Retry with refreshed token
      const retryHeaders = {
        ...options.headers,
        'Authorization': `Bearer ${newToken}`,
      };
      const retryResponse = await fetch(url, { ...options, headers: retryHeaders });
      if (retryResponse.status === 401) {
        // Refresh succeeded but still rejected — force logout
        await logout();
        throw new Error('Session expired');
      }
      return retryResponse;
    }

    // No refresh token or refresh failed — logout
    await logout();
    throw new Error('Session expired');
  }

  return response;
}

/**
 * Listen to auth state changes
 * @param {Function} callback - Called when auth state changes
 * @returns {Function} Unsubscribe function
 */
export function onAuthStateChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // Get user profile
        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          callback({
            event,
            session,
            user: {
              id: session.user.id,
              email: session.user.email,
              full_name: profile?.full_name,
              language: profile?.language,
              avatar_url: profile?.avatar_url,
              onboarding_completed: profile?.onboarding_completed,
              role: session.user.user_metadata?.role || 'user',
            },
          });
        } else {
          callback({ event, session, user: null });
        }
      } else if (event === 'SIGNED_OUT') {
        callback({ event, session: null, user: null });
      }
    }
  );

  // Return unsubscribe function
  return () => {
    subscription.unsubscribe();
  };
}
