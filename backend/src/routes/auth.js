const express = require('express');
const router = express.Router();
const authService = require('../services/auth.service');
const { authLimiter } = require('../middleware/rateLimiter');
const { verifyJWT } = require('../middleware/auth');

/**
 * POST /auth/register
 * Public endpoint - User registration
 * Rate limited: 10 req/min per IP
 */
router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const { email, password, full_name, language = 'fr' } = req.body;

    // Validate required fields
    if (!email || !password || !full_name) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Les champs email, password et full_name sont obligatoires.'
        }
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'INVALID_EMAIL',
          message: 'Format d\'email invalide.'
        }
      });
    }

    // Validate password length
    if (password.length < 8) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'PASSWORD_TOO_SHORT',
          message: 'Le mot de passe doit contenir au minimum 8 caracteres.'
        }
      });
    }

    // Register user
    const result = await authService.register(email, password, full_name, language);

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    // Handle duplicate email
    if (error.code === 'EMAIL_ALREADY_EXISTS' || error.code === '23505' || error.message.includes('duplicate') || error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'Un compte existe deja avec cette adresse email.'
        }
      });
    }
    next(error);
  }
});

/**
 * POST /auth/login
 * Public endpoint - User login
 * Rate limited: 10 req/min per IP
 */
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Email et mot de passe requis.'
        }
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_EMAIL',
          message: 'Format d\'email invalide.'
        }
      });
    }

    // Login user
    const result = await authService.login(email, password);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    // Handle account inactive
    if (error.code === 'ACCOUNT_INACTIVE') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_INACTIVE',
          message: 'Compte désactivé. Contactez le support.'
        }
      });
    }

    // Handle invalid credentials (don't distinguish between email not found and wrong password)
    if (error.code === 'INVALID_CREDENTIALS' || error.message === 'Invalid credentials') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Email ou mot de passe incorrect.'
        }
      });
    }

    next(error);
  }
});

/**
 * POST /auth/refresh
 * Public endpoint - Refresh access token
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const { refresh_token } = req.body;

    // Validate required field
    if (!refresh_token) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REFRESH_TOKEN',
          message: 'Refresh token requis.'
        }
      });
    }

    // Refresh tokens
    const result = await authService.refresh(refresh_token);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    // Handle token errors
    if (error.code === 'TOKEN_EXPIRED') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Session expirée. Veuillez vous reconnecter.'
        }
      });
    }

    if (error.code === 'INVALID_TOKEN') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Token invalide.'
        }
      });
    }

    // Handle account inactive
    if (error.code === 'ACCOUNT_INACTIVE') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_INACTIVE',
          message: 'Compte désactivé. Contactez le support.'
        }
      });
    }

    next(error);
  }
});

router.post('/mfa/email/verify', authLimiter, async (req, res, next) => {
  try {
    const { challenge_id, code } = req.body;

    if (!challenge_id || !code) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Challenge et code requis.',
        },
      });
    }

    const result = await authService.verifyEmailMfa(challenge_id, String(code).trim());
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    if (['MFA_CHALLENGE_INVALID', 'MFA_CHALLENGE_EXPIRED', 'MFA_TOO_MANY_ATTEMPTS', 'INVALID_MFA_CODE'].includes(error.code)) {
      return res.status(400).json({
        success: false,
        error: {
          code: error.code,
          message:
            error.code === 'MFA_CHALLENGE_EXPIRED'
              ? 'Le code a expire. Demandez-en un nouveau.'
              : error.code === 'MFA_TOO_MANY_ATTEMPTS'
                ? 'Trop de tentatives. Recommencez la connexion.'
                : error.code === 'INVALID_MFA_CODE'
                  ? 'Code incorrect.'
                  : 'Challenge invalide.',
        },
      });
    }
    next(error);
  }
});

router.post('/mfa/email/resend', authLimiter, async (req, res, next) => {
  try {
    const { challenge_id } = req.body;
    if (!challenge_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Challenge requis.',
        },
      });
    }

    const result = await authService.resendEmailMfa(challenge_id);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    if (['MFA_CHALLENGE_INVALID', 'MFA_CHALLENGE_EXPIRED'].includes(error.code)) {
      return res.status(400).json({
        success: false,
        error: {
          code: error.code,
          message: error.code === 'MFA_CHALLENGE_EXPIRED' ? 'Le challenge a expire. Reconnectez-vous.' : 'Challenge invalide.',
        },
      });
    }
    next(error);
  }
});

router.post('/mfa/email/profile-pin/start', verifyJWT, authLimiter, async (req, res, next) => {
  try {
    const result = await authService.createEmailActionChallenge({
      userId: req.user.id,
      purpose: 'profile_pin_owner',
    });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    if (error.code === 'USER_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        error: {
          code: error.code,
          message: 'Utilisateur introuvable.',
        },
      });
    }
    next(error);
  }
});

router.post('/mfa/email/profile-pin/verify', verifyJWT, authLimiter, async (req, res, next) => {
  try {
    const { challenge_id, code } = req.body;
    if (!challenge_id || !code) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Challenge et code requis.',
        },
      });
    }

    const result = await authService.verifyEmailActionChallenge(
      req.user.id,
      challenge_id,
      String(code).trim(),
      'profile_pin_owner'
    );
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    if (['MFA_CHALLENGE_INVALID', 'MFA_CHALLENGE_EXPIRED', 'MFA_TOO_MANY_ATTEMPTS', 'INVALID_MFA_CODE'].includes(error.code)) {
      return res.status(400).json({
        success: false,
        error: {
          code: error.code,
          message:
            error.code === 'MFA_CHALLENGE_EXPIRED'
              ? 'Le code a expire. Demandez-en un nouveau.'
              : error.code === 'MFA_TOO_MANY_ATTEMPTS'
                ? 'Trop de tentatives. Recommencez.'
                : error.code === 'INVALID_MFA_CODE'
                  ? 'Code incorrect.'
                  : 'Challenge invalide.',
        },
      });
    }
    next(error);
  }
});

/**
 * POST /auth/logout
 * Protected endpoint - User logout
 * Requires JWT authentication
 */
router.post('/logout', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Log logout event for audit trail
    console.log(`User logout: userId=${userId}, timestamp=${new Date().toISOString()}`);

    // For web clients: expire HttpOnly cookie (if implemented)
    // Note: Currently using localStorage, this is for future migration to HttpOnly cookies
    res.cookie('access_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      expires: new Date(0) // Expire immediately
    });

    // Return 204 No Content (successful logout, no body needed)
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/forgot-password
 * Public endpoint - Request password reset
 * Rate limited: 10 req/min per IP
 */
router.post('/forgot-password', authLimiter, async (req, res, next) => {
  try {
    const { email } = req.body;

    // Validate required field
    if (!email) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_EMAIL',
          message: 'L\'email est obligatoire.'
        }
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_EMAIL',
          message: 'Format d\'email invalide.'
        }
      });
    }

    // Request password reset
    await authService.forgotPassword(email);

    // Always return 200 (privacy - don't reveal if email exists)
    res.status(200).json({
      success: true,
      message: 'Si cet email existe, un lien de réinitialisation a été envoyé.'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/reset-password
 * Public endpoint - Reset password with token
 * Rate limited: 10 req/min per IP
 */
router.post('/reset-password', authLimiter, async (req, res, next) => {
  try {
    const { token, new_password } = req.body;

    // Validate required fields
    if (!token || !new_password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Le token et le nouveau mot de passe sont obligatoires.'
        }
      });
    }

    // Validate password length
    if (new_password.length < 8) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'PASSWORD_TOO_SHORT',
          message: 'Le mot de passe doit contenir au moins 8 caractères.'
        }
      });
    }

    // Reset password
    await authService.resetPassword(token, new_password);

    res.status(200).json({
      success: true,
      message: 'Mot de passe modifié avec succès.'
    });
  } catch (error) {
    // Handle token errors
    if (error.code === 'INVALID_TOKEN') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Lien invalide. Veuillez demander un nouveau.'
        }
      });
    }

    if (error.code === 'TOKEN_EXPIRED') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Votre lien a expiré. Veuillez en demander un nouveau.'
        }
      });
    }

    if (error.code === 'TOKEN_ALREADY_USED') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'TOKEN_ALREADY_USED',
          message: 'Ce lien a déjà été utilisé. Veuillez en demander un nouveau.'
        }
      });
    }

    next(error);
  }
});

module.exports = router;
