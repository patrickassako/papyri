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

function hashCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

// Cryptographically secure 6-digit code (Math.random is predictable).
function generateEmailCode() {
  return String(crypto.randomInt(100000, 1000000));
}

// Best-effort purge of expired rows. Not strictly required since every
// read also filters on expires_at, but keeps the tables small.
async function cleanupExpiredEmailMfaChallenges() {
  const nowIso = new Date().toISOString();
  try {
    await supabaseAdmin.from('email_mfa_challenges').delete().lte('expires_at', nowIso);
    await supabaseAdmin.from('email_action_tokens').delete().lte('expires_at', nowIso);
  } catch (_) { /* non-fatal */ }
}

async function createEmailMfaChallenge({ user, profile, session }) {
  cleanupExpiredEmailMfaChallenges().catch(() => {}); // best-effort purge
  // Drop any previous login challenge for this user.
  await supabaseAdmin
    .from('email_mfa_challenges')
    .delete()
    .eq('user_id', user.id)
    .is('purpose', null);

  const code = generateEmailCode();
  const challengeId = crypto.randomUUID();
  const { error } = await supabaseAdmin.from('email_mfa_challenges').insert({
    id: challengeId,
    user_id: user.id,
    purpose: null,
    email: user.email,
    full_name: profile?.full_name || user.email,
    code_hash: hashCode(code),
    attempts: 0,
    session,
    expires_at: new Date(Date.now() + EMAIL_MFA_TTL_MS).toISOString(),
  });
  if (error) throw error;

  await sendEmailVerificationCodeEmail(user.email, profile?.full_name || user.email, code);
  return challengeId;
}

async function createEmailActionChallenge({ userId, purpose }) {
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

  // Drop any previous challenge for this user + purpose.
  await supabaseAdmin
    .from('email_mfa_challenges')
    .delete()
    .eq('user_id', userId)
    .eq('purpose', purpose);

  const code = generateEmailCode();
  const challengeId = crypto.randomUUID();
  const { error } = await supabaseAdmin.from('email_mfa_challenges').insert({
    id: challengeId,
    user_id: userId,
    purpose,
    email: user.email,
    full_name: profile?.full_name || user.email,
    code_hash: hashCode(code),
    attempts: 0,
    session: null,
    expires_at: new Date(Date.now() + EMAIL_MFA_TTL_MS).toISOString(),
  });
  if (error) throw error;

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
        role: profile?.role || 'user',
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

async function fetchChallenge(challengeId) {
  const { data } = await supabaseAdmin
    .from('email_mfa_challenges')
    .select('*')
    .eq('id', challengeId)
    .maybeSingle();
  return data || null;
}

async function deleteChallenge(challengeId) {
  await supabaseAdmin.from('email_mfa_challenges').delete().eq('id', challengeId);
}

async function verifyEmailMfa(challengeId, code) {
  const challenge = await fetchChallenge(challengeId);

  if (!challenge || challenge.purpose !== null) {
    throw makeError('MFA_CHALLENGE_INVALID');
  }
  if (new Date(challenge.expires_at).getTime() <= Date.now()) {
    await deleteChallenge(challengeId);
    throw makeError('MFA_CHALLENGE_EXPIRED');
  }
  if (challenge.attempts >= EMAIL_MFA_MAX_ATTEMPTS) {
    await deleteChallenge(challengeId);
    throw makeError('MFA_TOO_MANY_ATTEMPTS');
  }

  if (hashCode(code) !== challenge.code_hash) {
    await supabaseAdmin
      .from('email_mfa_challenges')
      .update({ attempts: challenge.attempts + 1 })
      .eq('id', challengeId);
    throw makeError('INVALID_MFA_CODE');
  }

  await deleteChallenge(challengeId);

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', challenge.user_id)
    .single();

  return {
    user: {
      id: challenge.user_id,
      email: challenge.email,
      full_name: profile?.full_name,
      role: profile?.role || 'user',
    },
    session: challenge.session,
  };
}

async function verifyEmailActionChallenge(userId, challengeId, code, purpose) {
  const challenge = await fetchChallenge(challengeId);

  if (!challenge || challenge.user_id !== userId || challenge.purpose !== purpose) {
    throw makeError('MFA_CHALLENGE_INVALID');
  }
  if (new Date(challenge.expires_at).getTime() <= Date.now()) {
    await deleteChallenge(challengeId);
    throw makeError('MFA_CHALLENGE_EXPIRED');
  }
  if (challenge.attempts >= EMAIL_MFA_MAX_ATTEMPTS) {
    await deleteChallenge(challengeId);
    throw makeError('MFA_TOO_MANY_ATTEMPTS');
  }

  if (hashCode(code) !== challenge.code_hash) {
    await supabaseAdmin
      .from('email_mfa_challenges')
      .update({ attempts: challenge.attempts + 1 })
      .eq('id', challengeId);
    throw makeError('INVALID_MFA_CODE');
  }

  await deleteChallenge(challengeId);

  const verificationToken = crypto.randomUUID();
  const { error } = await supabaseAdmin.from('email_action_tokens').insert({
    token: verificationToken,
    user_id: userId,
    purpose,
    expires_at: new Date(Date.now() + EMAIL_MFA_TTL_MS).toISOString(),
  });
  if (error) throw error;

  return {
    verification_token: verificationToken,
    expires_in: Math.floor(EMAIL_MFA_TTL_MS / 1000),
  };
}

async function consumeVerifiedEmailActionToken(userId, token, purpose) {
  const { data: payload } = await supabaseAdmin
    .from('email_action_tokens')
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (!payload
    || payload.user_id !== userId
    || payload.purpose !== purpose
    || new Date(payload.expires_at).getTime() <= Date.now()) {
    throw makeError('EMAIL_ACTION_VERIFICATION_REQUIRED');
  }

  await supabaseAdmin.from('email_action_tokens').delete().eq('token', token);
  return true;
}

async function resendEmailMfa(challengeId) {
  const challenge = await fetchChallenge(challengeId);
  if (!challenge) throw makeError('MFA_CHALLENGE_INVALID');
  if (new Date(challenge.expires_at).getTime() <= Date.now()) {
    await deleteChallenge(challengeId);
    throw makeError('MFA_CHALLENGE_EXPIRED');
  }

  const code = generateEmailCode();
  await supabaseAdmin
    .from('email_mfa_challenges')
    .update({
      code_hash: hashCode(code),
      attempts: 0,
      expires_at: new Date(Date.now() + EMAIL_MFA_TTL_MS).toISOString(),
    })
    .eq('id', challengeId);
  await sendEmailVerificationCodeEmail(challenge.email, challenge.full_name, code);

  return {
    challenge_id: challengeId,
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
      role: profile?.role || 'user',
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
