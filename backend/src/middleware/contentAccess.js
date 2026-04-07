const { resolveContentAccess } = require('../services/content-access.service');

async function resolveContentAccessContext(req, res, next) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentification requise.',
        },
      });
    }

    const context = await resolveContentAccess({
      userId: req.user.id,
      contentId: req.params.id,
      profileId: req.headers['x-profile-id'] || null,
    });

    req.contentAccessContext = context;
    return next();
  } catch (error) {
    if (error.message === 'CONTENT_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CONTENT_NOT_FOUND',
          message: 'Contenu introuvable.',
        },
      });
    }

    console.error('❌ resolveContentAccessContext middleware error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'RESOLVE_CONTENT_ACCESS_FAILED',
        message: 'Impossible de verifier les acces au contenu.',
      },
    });
  }
}

function requireReadableContent(req, res, next) {
  const access = req.contentAccessContext?.access;
  if (!access) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'MISSING_CONTENT_ACCESS_CONTEXT',
        message: 'Contexte d acces contenu indisponible.',
      },
    });
  }

  if (access.can_read) {
    return next();
  }

  const denialCode = access.denial?.code;
  const statusCode = ['NO_ACTIVE_SUBSCRIPTION', 'SUBSCRIPTION_UNLOCK_REQUIRED'].includes(denialCode) ? 403 : 402;
  return res.status(statusCode).json({
    success: false,
    error: {
      code: access.denial?.code || 'CONTENT_ACCESS_DENIED',
      message: access.denial?.message || 'Acces refuse au contenu.',
    },
    data: {
      content_id: access.content_id,
      access_type: access.access_type,
      has_active_subscription: access.has_active_subscription,
      is_purchasable: access.is_purchasable,
      pricing: access.pricing,
    },
  });
}

module.exports = {
  resolveContentAccessContext,
  requireReadableContent,
};
