const familyProfilesService = require('../services/family-profiles.service');

async function rejectKidProfile(req, res, next) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Non authentifie.',
        },
      });
    }

    const familyContext = await familyProfilesService.resolveProfileForUser(
      req.user.id,
      req.headers['x-profile-id'] || null,
    );

    req.familyContext = familyContext;

    if (familyContext?.isFamilyContext && familyContext?.profile?.is_kid) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'CHILD_PROFILE_FORBIDDEN',
          message: 'Ce profil enfant ne peut pas acceder a cette action.',
        },
      });
    }

    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  rejectKidProfile,
};
