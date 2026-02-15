/**
 * Authentication Service - Supabase Auth
 * Migration from custom bcrypt + JWT to Supabase Auth
 */

const { supabase, supabaseAdmin } = require('../config/database');

function makeError(code, message = code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/**
 * Register a new user with Supabase Auth
 * @param {string} email
 * @param {string} password
 * @param {string} full_name
 * @param {string} language
 * @returns {Promise<{user, session}>}
 */
async function register(email, password, full_name, language = 'fr') {
  // Validation
  if (!email || !password || !full_name) {
    throw makeError('MISSING_FIELDS');
  }

  if (password.length < 8) {
    throw makeError('PASSWORD_TOO_SHORT');
  }

  // Sign up with Supabase Auth
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    // Map Supabase errors to our error codes
    if (error.message.includes('already registered')) {
      throw makeError('EMAIL_ALREADY_EXISTS');
    }
    throw error;
  }

  // The trigger auto-created profile with defaults
  // Now update it with real values using admin client (bypasses RLS)
  if (data.user) {
    await supabaseAdmin
      .from('profiles')
      .update({
        full_name,
        language,
      })
      .eq('id', data.user.id);
  }

  return {
    user: {
      id: data.user.id,
      email: data.user.email,
      full_name,
      role: 'user',
    },
    session: data.session, // Contains access_token and refresh_token
  };
}

/**
 * Login user with Supabase Auth
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{user, session}>}
 */
async function login(email, password) {
  if (!email || !password) {
    throw makeError('MISSING_FIELDS');
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw makeError('INVALID_CREDENTIALS');
  }

  // Get profile data
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  return {
    user: {
      id: data.user.id,
      email: data.user.email,
      full_name: profile?.full_name,
      role: data.user.user_metadata?.role || 'user',
    },
    session: data.session,
  };
}

/**
 * Logout user (invalidate session)
 * @param {string} accessToken - JWT token from request
 */
async function logout(accessToken) {
  // Set the session with the provided token
  await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: '', // Not needed for signOut
  });

  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('Logout error:', error);
    // Don't throw - logout should always succeed client-side
  }

  return { success: true };
}

/**
 * Refresh access token
 * @param {string} refreshToken
 * @returns {Promise<{session}>}
 */
async function refreshToken(refreshToken) {
  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error) {
    throw makeError('TOKEN_EXPIRED');
  }

  return {
    session: data.session,
  };
}

/**
 * Get user from access token
 * @param {string} accessToken
 * @returns {Promise<{user}>}
 */
async function getUserFromToken(accessToken) {
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error) {
    throw makeError('INVALID_TOKEN');
  }

  // Get profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  return {
    user: {
      id: data.user.id,
      email: data.user.email,
      full_name: profile?.full_name,
      language: profile?.language,
      avatar_url: profile?.avatar_url,
      onboarding_completed: profile?.onboarding_completed,
      role: data.user.user_metadata?.role || 'user',
      created_at: profile?.created_at,
      updated_at: profile?.updated_at,
    },
  };
}

/**
 * Request password reset
 * @param {string} email
 */
async function forgotPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.FRONTEND_URL}/reset-password`,
  });

  if (error) {
    console.error('Forgot password error:', error);
    // Don't throw - for privacy, always return success
  }

  return { success: true };
}

/**
 * Reset password with token
 * @param {string} accessToken - From reset password email
 * @param {string} newPassword
 */
async function resetPassword(accessToken, newPassword) {
  if (newPassword.length < 8) {
    throw makeError('PASSWORD_TOO_SHORT');
  }

  // Set session with reset token
  await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: '', // Not needed for password update
  });

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    if (error.message.includes('expired')) {
      throw makeError('TOKEN_EXPIRED');
    }
    throw makeError('INVALID_TOKEN');
  }

  return { success: true };
}

/**
 * Verify JWT token middleware helper
 * @param {string} token
 * @returns {Promise<{user}>}
 */
async function verifyToken(token) {
  return getUserFromToken(token);
}

module.exports = {
  register,
  login,
  logout,
  refresh: refreshToken,
  refreshToken,
  getUserFromToken,
  forgotPassword,
  resetPassword,
  verifyToken,
};
