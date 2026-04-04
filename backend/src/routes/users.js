const express = require('express');
const router = express.Router();
const fs = require('fs/promises');
const path = require('path');
const formidable = require('express-formidable');
const { supabase, supabaseAdmin } = require('../config/database');
const config = require('../config/env');
const { verifyJWT } = require('../middleware/auth');
const r2Service = require('../services/r2.service');

/**
 * GET /users/lookup?email=
 * Protected — Cherche un utilisateur par email (pour inviter un membre famille).
 * Retourne { id, email, full_name, avatar_url } si trouvé, 404 sinon.
 * Ne retourne pas le compte du requêtant lui-même.
 */
router.get('/lookup', verifyJWT, async (req, res, next) => {
  try {
    const requesterId = req.user.id;
    const email = String(req.query.email || '').trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ success: false, message: 'Paramètre email requis.' });
    }

    // Recherche dans auth.users via l'API admin Supabase
    const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) throw listError;

    const found = (listData?.users || []).find(
      (u) => u.email?.toLowerCase() === email
    );

    if (!found) {
      return res.status(404).json({ success: false, message: 'Aucun compte trouvé avec cet email.' });
    }

    if (found.id === requesterId) {
      return res.status(400).json({ success: false, message: 'Vous ne pouvez pas vous ajouter vous-même.' });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', found.id)
      .maybeSingle();

    return res.status(200).json({
      success: true,
      data: {
        id: found.id,
        email: found.email,
        full_name: profile?.full_name || null,
        avatar_url: profile?.avatar_url || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

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
      .select('id, full_name, language, avatar_url, onboarding_completed, created_at, updated_at')
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
        avatar_url: user.avatar_url || null,
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
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select('id, full_name, language, avatar_url, onboarding_completed, created_at, updated_at')
      .single();

    if (updateError) {
      console.error('Error updating user:', updateError);
      throw new Error('Failed to update user');
    }

    // Get email from Supabase Auth for response
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);

    res.status(200).json({
      success: true,
      data: {
        ...updatedUser,
        email: authUser?.user?.email || null,
        role: 'user',
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /users/me/avatar
 * Protected endpoint - Upload avatar image
 * multipart/form-data: avatar=<file>
 */
router.post(
  '/me/avatar',
  verifyJWT,
  formidable({ multiples: false, maxFileSize: 5 * 1024 * 1024 }),
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const avatarFile = req.files?.avatar;

      if (!avatarFile) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_FILE',
            message: 'Fichier avatar requis.',
          },
        });
      }

      const mimeType = String(avatarFile.type || '').toLowerCase();
      if (!mimeType.startsWith('image/')) {
        return res.status(422).json({
          success: false,
          error: {
            code: 'INVALID_FILE_TYPE',
            message: 'Le fichier doit être une image.',
          },
        });
      }

      const size = Number(avatarFile.size || 0);
      if (size <= 0 || size > 5 * 1024 * 1024) {
        return res.status(422).json({
          success: false,
          error: {
            code: 'INVALID_FILE_SIZE',
            message: 'Image invalide (max 5MB).',
          },
        });
      }

      const tmpPath = avatarFile.path || avatarFile.filepath;
      const fileBuffer = await fs.readFile(tmpPath);

      const extensionFromName = path.extname(avatarFile.name || avatarFile.originalFilename || '').toLowerCase();
      const extensionFromType = mimeType.split('/')[1] || 'jpg';
      const ext = extensionFromName || `.${extensionFromType}`;
      const safeExt = ext.startsWith('.') ? ext : `.${ext}`;
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safeExt}`;
      let publicUrl = null;

      if (r2Service.isConfigured()) {
        const key = `avatars/${userId}/${fileName}`;
        await r2Service.uploadBuffer(fileBuffer, key, {
          bucket: config.r2.bucketCovers,
          contentType: mimeType,
          cacheControl: 'public, max-age=31536000',
        });
        publicUrl = r2Service.getPublicUrl(key, config.r2.bucketCovers);
      } else {
        // Dev fallback: store avatars locally when R2 is not configured.
        const localDir = path.join(__dirname, '..', '..', 'uploads', 'avatars', userId);
        await fs.mkdir(localDir, { recursive: true });
        const localFilePath = path.join(localDir, fileName);
        await fs.writeFile(localFilePath, fileBuffer);
        publicUrl = `${req.protocol}://${req.get('host')}/uploads/avatars/${userId}/${fileName}`;
      }

      const { data: updatedUser, error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          avatar_url: publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select('id, full_name, language, avatar_url, onboarding_completed, created_at, updated_at')
        .single();

      if (updateError) {
        throw updateError;
      }

      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);

      return res.status(200).json({
        success: true,
        data: {
          ...updatedUser,
          email: authUser?.user?.email || null,
          role: 'user',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

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

    const { data: authUserData, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
    const userEmail = authUserData?.user?.email || null;

    if (authUserError || !userEmail) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Utilisateur non trouvé.'
        }
      });
    }

    // Verify current password via Supabase Auth sign-in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: current_password,
    });

    if (signInError) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_PASSWORD',
          message: 'Mot de passe actuel incorrect.'
        }
      });
    }

    if (current_password === new_password) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'PASSWORD_SAME_AS_CURRENT',
          message: 'Le nouveau mot de passe doit être différent de l\'actuel.'
        }
      });
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: new_password,
    });

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
 * GET /users/me/sessions
 * Protected — Retourne les sessions actives de l'utilisateur
 */
router.get('/me/sessions', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    const user = authUser?.user;

    // Parse user-agent for current request
    const ua = req.headers['user-agent'] || '';
    const currentSession = {
      id: 'current',
      is_current: true,
      last_sign_in_at: user?.last_sign_in_at || null,
      created_at: user?.created_at || null,
      device: parseUserAgent(ua),
      ip: req.ip || req.headers['x-forwarded-for'] || 'Inconnue',
    };

    return res.status(200).json({ success: true, data: [currentSession] });
  } catch (error) {
    next(error);
  }
});

function parseUserAgent(ua) {
  const uaLower = ua.toLowerCase();
  let browser = 'Navigateur inconnu';
  let os = 'OS inconnu';
  let deviceType = 'desktop';

  // Browser
  if (uaLower.includes('edg/')) browser = 'Microsoft Edge';
  else if (uaLower.includes('chrome/') && !uaLower.includes('chromium')) browser = 'Google Chrome';
  else if (uaLower.includes('firefox/')) browser = 'Firefox';
  else if (uaLower.includes('safari/') && !uaLower.includes('chrome')) browser = 'Safari';
  else if (uaLower.includes('opr/') || uaLower.includes('opera')) browser = 'Opera';

  // OS
  if (uaLower.includes('windows nt')) os = 'Windows';
  else if (uaLower.includes('mac os x')) os = 'macOS';
  else if (uaLower.includes('linux')) os = 'Linux';
  else if (uaLower.includes('android')) os = 'Android';
  else if (uaLower.includes('iphone') || uaLower.includes('ipad')) os = 'iOS';

  // Device type
  if (uaLower.includes('mobile') || uaLower.includes('android') || uaLower.includes('iphone')) {
    deviceType = 'mobile';
  } else if (uaLower.includes('ipad') || uaLower.includes('tablet')) {
    deviceType = 'tablet';
  }

  return { browser, os, deviceType, raw: ua.slice(0, 120) };
}

/**
 * DELETE /users/me/sessions
 * Protected — Révoque toutes les sessions (déconnexion globale)
 */
router.delete('/me/sessions', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;
    // Supabase admin: sign out user from all sessions
    await supabaseAdmin.auth.admin.signOut(userId, 'global').catch(() => {});
    return res.status(200).json({ success: true, message: 'Toutes les sessions ont été révoquées.' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /users/me/data-export  (RGPD — droit d'accès & portabilité)
 * Retourne toutes les données personnelles de l'utilisateur en JSON
 */
router.get('/me/data-export', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [profileRes, authRes, subsRes, paymentsRes, historyRes, devicesRes] = await Promise.all([
      supabaseAdmin.from('profiles').select('*').eq('id', userId).single(),
      supabaseAdmin.auth.admin.getUserById(userId),
      supabaseAdmin.from('subscriptions').select('*').eq('user_id', userId),
      supabaseAdmin.from('payments').select('amount, currency, provider, paid_at, status').eq('user_id', userId).order('paid_at', { ascending: false }).limit(200),
      supabaseAdmin.from('reading_history').select('content_id, progress_percent, total_time_seconds, is_completed, last_read_at, started_at').eq('user_id', userId).order('last_read_at', { ascending: false }).limit(500),
      supabaseAdmin.from('user_devices').select('device_type, platform, created_at, last_seen_at').eq('user_id', userId),
    ]);

    const exportData = {
      exported_at: new Date().toISOString(),
      profile: {
        id: userId,
        email: authRes.data?.user?.email,
        full_name: profileRes.data?.full_name,
        language: profileRes.data?.language,
        avatar_url: profileRes.data?.avatar_url,
        created_at: profileRes.data?.created_at,
        role: profileRes.data?.role,
      },
      subscriptions: subsRes.data || [],
      payments: paymentsRes.data || [],
      reading_history: historyRes.data || [],
      devices: devicesRes.data || [],
    };

    const filename = `mes-donnees-papyri-${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(exportData);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /users/me  (RGPD — droit à l'effacement)
 * Supprime le compte et toutes les données associées
 */
router.delete('/me', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Annuler les abonnements actifs
    await supabaseAdmin
      .from('subscriptions')
      .update({ status: 'CANCELLED', cancelled_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('status', 'ACTIVE');

    // Supprimer les données utilisateur (dans l'ordre des dépendances FK)
    await Promise.allSettled([
      supabaseAdmin.from('reading_history').delete().eq('user_id', userId),
      supabaseAdmin.from('user_devices').delete().eq('user_id', userId),
      supabaseAdmin.from('notification_preferences').delete().eq('user_id', userId),
      supabaseAdmin.from('user_notifications').delete().eq('user_id', userId),
    ]);

    // Anonymiser le profil plutôt que de le supprimer (garde les FK intactes)
    await supabaseAdmin
      .from('profiles')
      .update({
        full_name: 'Compte supprimé',
        avatar_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    // Supprimer le compte Supabase Auth (irrévocable)
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteAuthError) throw deleteAuthError;

    res.status(200).json({ success: true, message: 'Compte supprimé avec succès.' });
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

/**
 * POST /users/me/gdpr-request
 * RGPD — soumettre une demande (deletion | export | rectification)
 */
router.post('/me/gdpr-request', verifyJWT, express.json(), async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { request_type = 'deletion', user_message } = req.body;

    const validTypes = ['deletion', 'export', 'rectification'];
    if (!validTypes.includes(request_type)) {
      return res.status(400).json({ success: false, error: 'Type de demande invalide.' });
    }

    const { data, error } = await supabaseAdmin
      .from('gdpr_requests')
      .insert({
        user_id: userId,
        request_type,
        status: 'pending',
        user_message: user_message || null,
        deadline_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (error) {
      // Unique constraint: request already pending
      if (error.code === '23505') {
        return res.status(409).json({ success: false, error: 'Une demande de ce type est déjà en cours de traitement.' });
      }
      throw error;
    }

    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /users/me/gdpr-requests
 * RGPD — liste des demandes de l'utilisateur connecté
 */
router.get('/me/gdpr-requests', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { data, error } = await supabaseAdmin
      .from('gdpr_requests')
      .select('id, request_type, status, user_message, admin_notes, deadline_at, created_at, processed_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
