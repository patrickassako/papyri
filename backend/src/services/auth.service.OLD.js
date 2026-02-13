const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { supabase } = require('../config/database');
const config = require('../config/env');
const emailService = require('./email.service');

/**
 * Register a new user
 */
async function register(email, password, full_name) {
  // Check if email already exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single();

  if (existingUser) {
    throw new Error('Email already exists');
  }

  // Hash password with bcrypt (cost 12)
  const password_hash = await bcrypt.hash(password, 12);

  // Insert user into database
  const { data: user, error: userError } = await supabase
    .from('users')
    .insert({
      email,
      password_hash,
      full_name,
      role: 'user',
      onboarding_completed: false,
      is_active: true
    })
    .select('id, email, full_name, role, created_at')
    .single();

  if (userError) {
    throw userError;
  }

  // Create default notification preferences
  await supabase
    .from('notification_preferences')
    .insert({
      user_id: user.id,
      push_enabled: true,
      email_enabled: true,
      new_content: true,
      resume_reading: true,
      expiration_warning: true,
      marketing: false
    });

  // Generate JWT tokens
  const access_token = generateAccessToken(user);
  const refresh_token = generateRefreshToken(user);

  // Send welcome email asynchronously (don't await - don't block response)
  emailService.sendWelcomeEmail(user.email, user.full_name).catch(err => {
    console.error('Failed to send welcome email:', err);
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role
    },
    access_token,
    refresh_token
  };
}

/**
 * Generate access token (15 minutes TTL)
 */
function generateAccessToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role
    },
    config.jwt.secret,
    {
      expiresIn: '15m',
      algorithm: 'HS256' // Note: HS256 pour dev, RS256 recommandé pour prod
    }
  );
}

/**
 * Generate refresh token (7 days TTL)
 */
function generateRefreshToken(user) {
  return jwt.sign(
    {
      userId: user.id
    },
    config.jwt.refreshSecret,
    {
      expiresIn: '7d',
      algorithm: 'HS256'
    }
  );
}

/**
 * Login existing user
 */
async function login(email, password) {
  // Find user by email
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email, password_hash, full_name, role, is_active, onboarding_completed')
    .eq('email', email)
    .single();

  if (userError || !user) {
    throw new Error('Invalid credentials');
  }

  // Check if account is active
  if (!user.is_active) {
    const error = new Error('Account inactive');
    error.code = 'ACCOUNT_INACTIVE';
    throw error;
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    throw new Error('Invalid credentials');
  }

  // Update last_login_at
  await supabase
    .from('users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', user.id);

  // Generate JWT tokens
  const access_token = generateAccessToken(user);
  const refresh_token = generateRefreshToken(user);

  return {
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      onboarding_completed: user.onboarding_completed
    },
    access_token,
    refresh_token
  };
}

/**
 * Refresh access token using refresh token
 */
async function refresh(refreshToken) {
  try {
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);

    // Get user from database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, full_name, role, is_active')
      .eq('id', decoded.userId)
      .single();

    if (userError || !user) {
      throw new Error('User not found');
    }

    // Check if account is active
    if (!user.is_active) {
      const error = new Error('Account inactive');
      error.code = 'ACCOUNT_INACTIVE';
      throw error;
    }

    // Generate new tokens (rolling refresh)
    const access_token = generateAccessToken(user);
    const refresh_token = generateRefreshToken(user);

    return {
      access_token,
      refresh_token
    };
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      const err = new Error('Refresh token expired');
      err.code = 'TOKEN_EXPIRED';
      throw err;
    }
    if (error.name === 'JsonWebTokenError') {
      const err = new Error('Invalid refresh token');
      err.code = 'INVALID_TOKEN';
      throw err;
    }
    throw error;
  }
}

/**
 * Request password reset
 * Generates reset token and sends email
 */
async function forgotPassword(email) {
  // Find user by email
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email, full_name')
    .eq('email', email)
    .single();

  // Always return success (privacy - don't leak if email exists)
  if (userError || !user) {
    console.log(`Password reset requested for non-existent email: ${email}`);
    return { success: true };
  }

  // Generate reset token (64-char hex string)
  const token = crypto.randomBytes(32).toString('hex');

  // Calculate expiration (1 hour from now)
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1);

  // Insert token into database
  const { error: tokenError } = await supabase
    .from('password_reset_tokens')
    .insert({
      user_id: user.id,
      token: token,
      expires_at: expiresAt.toISOString()
    });

  if (tokenError) {
    console.error('Error creating reset token:', tokenError);
    throw new Error('Failed to create reset token');
  }

  // Send reset email
  await emailService.sendPasswordResetEmail(user.email, user.full_name, token);

  return { success: true };
}

/**
 * Reset password using token
 */
async function resetPassword(token, newPassword) {
  // Find valid token
  const { data: resetToken, error: tokenError } = await supabase
    .from('password_reset_tokens')
    .select('id, user_id, expires_at, used_at')
    .eq('token', token)
    .single();

  if (tokenError || !resetToken) {
    const error = new Error('Invalid token');
    error.code = 'INVALID_TOKEN';
    throw error;
  }

  // Check if token is expired
  if (new Date(resetToken.expires_at) < new Date()) {
    const error = new Error('Token expired');
    error.code = 'TOKEN_EXPIRED';
    throw error;
  }

  // Check if token already used
  if (resetToken.used_at) {
    const error = new Error('Token already used');
    error.code = 'TOKEN_ALREADY_USED';
    throw error;
  }

  // Hash new password
  const password_hash = await bcrypt.hash(newPassword, 12);

  // Update user password
  const { error: updateError } = await supabase
    .from('users')
    .update({
      password_hash: password_hash,
      updated_at: new Date().toISOString()
    })
    .eq('id', resetToken.user_id);

  if (updateError) {
    console.error('Error updating password:', updateError);
    throw new Error('Failed to update password');
  }

  // Mark token as used
  await supabase
    .from('password_reset_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', resetToken.id);

  return { success: true };
}

module.exports = {
  register,
  login,
  refresh,
  forgotPassword,
  resetPassword,
  generateAccessToken,
  generateRefreshToken
};
