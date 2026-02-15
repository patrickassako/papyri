const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { supabase, supabaseAdmin } = require('../config/database');
const { verifyJWT } = require('../middleware/auth');

/**
 * GET /users/me
 * Protected endpoint - Get current user profile
 */
router.get('/me', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;
    console.log('🔍 [/users/me] User ID:', userId);

    // Get user data from profiles table using admin client (bypasses RLS)
    const { data: user, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, language, onboarding_completed, created_at, updated_at')
      .eq('id', userId)
      .single();

    console.log('📊 [/users/me] Profile data:', user);
    console.log('❌ [/users/me] Profile error:', userError);

    if (userError || !user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Utilisateur non trouvé.'
        }
      });
    }

    // Try to get subscription data (may not exist yet - Epic 2)
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('status, plan_type, plan_id, users_limit, amount, currency, current_period_end')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Get email from Supabase Auth
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);

    res.status(200).json({
      success: true,
      data: {
        id: user.id,
        email: authUser?.user?.email || null,
        full_name: user.full_name,
        role: 'user', // Default role for Supabase Auth users
        language: user.language,
        avatar_url: null, // Not in profiles table yet
        onboarding_completed: user.onboarding_completed,
        created_at: user.created_at,
        updated_at: user.updated_at,
        subscription: subscription || null
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /users/me
 * Protected endpoint - Update current user profile
 */
router.patch('/me', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { full_name, language, avatar_url } = req.body;

    // Validation: full_name length
    if (full_name && full_name.length > 255) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'NAME_TOO_LONG',
          message: 'Le nom ne peut pas dépasser 255 caractères.'
        }
      });
    }

    // Validation: language must be valid (if provided)
    const validLanguages = ['fr', 'en', 'es', 'pt'];
    if (language && !validLanguages.includes(language)) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'INVALID_LANGUAGE',
          message: 'Langue non valide. Options: fr, en, es, pt.'
        }
      });
    }

    // Build updates object
    const updates = {
      updated_at: new Date().toISOString()
    };

    if (full_name !== undefined) updates.full_name = full_name;
    if (language !== undefined) updates.language = language;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;

    // Update user profile
    const { data: updatedUser, error: updateError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select('id, full_name, language, onboarding_completed, created_at, updated_at')
      .single();

    if (updateError) {
      console.error('Error updating user:', updateError);
      throw new Error('Failed to update user');
    }

    // Get email from Supabase Auth for response
    const { data: authUser } = await supabase.auth.admin.getUserById(userId);

    res.status(200).json({
      success: true,
      data: {
        ...updatedUser,
        email: authUser?.user?.email || null,
        role: 'user',
        avatar_url: null
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /users/me/password
 * Protected endpoint - Change password
 */
router.put('/me/password', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { current_password, new_password } = req.body;

    // Validate required fields
    if (!current_password || !new_password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Mot de passe actuel et nouveau mot de passe requis.'
        }
      });
    }

    // Validate new password length
    if (new_password.length < 8) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'PASSWORD_TOO_SHORT',
          message: 'Le mot de passe doit contenir au moins 8 caractères.'
        }
      });
    }

    // Get user's current password hash
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('password_hash')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Utilisateur non trouvé.'
        }
      });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(current_password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_PASSWORD',
          message: 'Mot de passe actuel incorrect.'
        }
      });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(new_password, 12);

    // Update password
    const { error: updateError } = await supabase
      .from('users')
      .update({
        password_hash: newPasswordHash,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating password:', updateError);
      throw new Error('Failed to update password');
    }

    res.status(200).json({
      success: true,
      message: 'Mot de passe modifié avec succès.'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /users/me/onboarding-complete
 * Protected endpoint - Mark onboarding as completed
 */
router.post('/me/onboarding-complete', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Update onboarding_completed flag in profiles
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Error completing onboarding:', updateError);
      throw new Error('Failed to complete onboarding');
    }

    res.status(200).json({
      success: true,
      message: 'Onboarding complété avec succès.',
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
