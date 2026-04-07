/**
 * Authentication Service - Supabase Auth
 * Migration from custom bcrypt + JWT to Supabase Auth
 */

const { supabase, supabaseAdmin } = require('../config/database');
const crypto = require('crypto');
const { sendWelcomeEmail, sendEmailVerificationCodeEmail } = require('./email.service');

function makeError(code, message = code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

const EMAIL_MFA_TTL_MS = 10 * 60 * 1000;
const EMAIL_MFA_MAX_ATTEMPTS = 5;
const pendingEmailMfaChallenges = new Map();
const verifiedEmailActionTokens = new Map();

function hashCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

function generateEmailCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function cleanupExpiredEmailMfaChallenges() {
  const now = Date.now();
  for (const [challengeId, challenge] of pendingEmailMfaChallenges.entries()) {
    if (challenge.expiresAt <= now) {
      pendingEmailMfaChallenges.delete(challengeId);
    }
  }

  for (const [token, payload] of verifiedEmailActionTokens.entries()) {
    if (payload.expiresAt <= now) {
      verifiedEmailActionTokens.delete(token);
    }
  }
}

async function createEmailMfaChallenge({ user, profile, session }) {
  cleanupExpiredEmailMfaChallenges();

  for (const [existingId, existing] of pendingEmailMfaChallenges.entries()) {
    if (existing.userId === user.id) {
      pendingEmailMfaChallenges.delete(existingId);
    }
  }

  const code = generateEmailCode();
  const challengeId = crypto.randomUUID();
  pendingEmailMfaChallenges.set(challengeId, {
    challengeId,
    userId: user.id,
    email: user.email,
    fullName: profile?.full_name || user.email,
    codeHash: hashCode(code),
    attempts: 0,
    expiresAt: Date.now() + EMAIL_MFA_TTL_MS,
    session,
  });

  await sendEmailVerificationCodeEmail(user.email, profile?.full_name || user.email, code);
  return challengeId;
}

async function createEmailActionChallenge({ userId, purpose }) {
  cleanupExpiredEmailMfaChallenges();

  const { data: authUserData, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
  const user = authUserData?.user || null;
  if (authUserError || !user?.email) {
    throw makeError('USER_NOT_FOUND');
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .single();

  for (const [existingId, existing] of pendingEmailMfaChallenges.entries()) {
    if (existing.userId === userId && existing.purpose === purpose) {
      pendingEmailMfaChallenges.delete(existingId);
    }
  }

  const code = generateEmailCode();
  const challengeId = crypto.randomUUID();
  pendingEmailMfaChallenges.set(challengeId, {
    challengeId,
    userId,
    purpose,
    email: user.email,
    fullName: profile?.full_name || user.email,
    codeHash: hashCode(code),
    attempts: 0,
    expiresAt: Date.now() + EMAIL_MFA_TTL_MS,
    session: null,
  });

  await sendEmailVerificationCodeEmail(user.email, profile?.full_name || user.email, code);
  return {
    challenge_id: challengeId,
    challenge_expires_in: Math.floor(EMAIL_MFA_TTL_MS / 1000),
    email: user.email,
  };
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

  // Envoyer l'email de bienvenue (non-bloquant)
  sendWelcomeEmail(email, full_name).catch((err) =>
    console.error('[auth] sendWelcomeEmail error:', err.message)
  );

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

  const mfaMethod = data.user.user_metadata?.mfa_method || 'none';

  if (mfaMethod === 'email') {
    const challengeId = await createEmailMfaChallenge({
      user: data.user,
      profile,
      session: data.session,
    });

    return {
      user: {
        id: data.user.id,
        email: data.user.email,
        full_name: profile?.full_name,
        role: data.user.user_metadata?.role || 'user',
      },
      requires_mfa: true,
      mfa_method: 'email',
      challenge_id: challengeId,
      challenge_expires_in: Math.floor(EMAIL_MFA_TTL_MS / 1000),
    };
  }

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

async function verifyEmailMfa(challengeId, code) {
  cleanupExpiredEmailMfaChallenges();
  const challenge = pendingEmailMfaChallenges.get(challengeId);

  if (!challenge) {
    throw makeError('MFA_CHALLENGE_INVALID');
  }
  if (challenge.expiresAt <= Date.now()) {
    pendingEmailMfaChallenges.delete(challengeId);
    throw makeError('MFA_CHALLENGE_EXPIRED');
  }
  if (challenge.attempts >= EMAIL_MFA_MAX_ATTEMPTS) {
    pendingEmailMfaChallenges.delete(challengeId);
    throw makeError('MFA_TOO_MANY_ATTEMPTS');
  }

  challenge.attempts += 1;
  if (hashCode(code) !== challenge.codeHash) {
    throw makeError('INVALID_MFA_CODE');
  }

  pendingEmailMfaChallenges.delete(challengeId);

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', challenge.userId)
    .single();

  return {
    user: {
      id: challenge.userId,
      email: challenge.email,
      full_name: profile?.full_name,
      role: profile?.role || 'user',
    },
    session: challenge.session,
  };
}

async function verifyEmailActionChallenge(userId, challengeId, code, purpose) {
  cleanupExpiredEmailMfaChallenges();
  const challenge = pendingEmailMfaChallenges.get(challengeId);

  if (!challenge || challenge.userId !== userId || challenge.purpose !== purpose) {
    throw makeError('MFA_CHALLENGE_INVALID');
  }
  if (challenge.expiresAt <= Date.now()) {
    pendingEmailMfaChallenges.delete(challengeId);
    throw makeError('MFA_CHALLENGE_EXPIRED');
  }
  if (challenge.attempts >= EMAIL_MFA_MAX_ATTEMPTS) {
    pendingEmailMfaChallenges.delete(challengeId);
    throw makeError('MFA_TOO_MANY_ATTEMPTS');
  }

  challenge.attempts += 1;
  if (hashCode(code) !== challenge.codeHash) {
    throw makeError('INVALID_MFA_CODE');
  }

  pendingEmailMfaChallenges.delete(challengeId);
  const verificationToken = crypto.randomUUID();
  verifiedEmailActionTokens.set(verificationToken, {
    userId,
    purpose,
    expiresAt: Date.now() + EMAIL_MFA_TTL_MS,
  });

  return {
    verification_token: verificationToken,
    expires_in: Math.floor(EMAIL_MFA_TTL_MS / 1000),
  };
}

function consumeVerifiedEmailActionToken(userId, token, purpose) {
  cleanupExpiredEmailMfaChallenges();
  const payload = verifiedEmailActionTokens.get(token);
  if (!payload || payload.userId !== userId || payload.purpose !== purpose) {
    throw makeError('EMAIL_ACTION_VERIFICATION_REQUIRED');
  }
  verifiedEmailActionTokens.delete(token);
  return true;
}

async function resendEmailMfa(challengeId) {
  cleanupExpiredEmailMfaChallenges();
  const challenge = pendingEmailMfaChallenges.get(challengeId);
  if (!challenge) throw makeError('MFA_CHALLENGE_INVALID');
  if (challenge.expiresAt <= Date.now()) {
    pendingEmailMfaChallenges.delete(challengeId);
    throw makeError('MFA_CHALLENGE_EXPIRED');
  }

  const code = generateEmailCode();
  challenge.codeHash = hashCode(code);
  challenge.attempts = 0;
  challenge.expiresAt = Date.now() + EMAIL_MFA_TTL_MS;
  await sendEmailVerificationCodeEmail(challenge.email, challenge.fullName, code);

  return {
    challenge_id: challenge.challengeId,
    challenge_expires_in: Math.floor(EMAIL_MFA_TTL_MS / 1000),
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
  verifyEmailMfa,
  resendEmailMfa,
  createEmailActionChallenge,
  verifyEmailActionChallenge,
  consumeVerifiedEmailActionToken,
  logout,
  refresh: refreshToken,
  refreshToken,
  getUserFromToken,
  forgotPassword,
  resetPassword,
  verifyToken,
};
