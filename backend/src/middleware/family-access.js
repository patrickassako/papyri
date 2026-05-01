const familyProfilesService = require('../services/family-profiles.service');

async function rejectKidProfile(req, res, next) {
  if (!req.user?.id) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Non authentifie.',
      },
    });
  }

  // Resolve family context — fail open: a stale/invalid X-Profile-Id header must not
  // block device operations. Kid profiles are unlikely to carry broken profile headers.
  let familyContext = { subscription: null, profile: null, profileId: null, isFamilyContext: false };
  try {
    familyContext = await familyProfilesService.resolveProfileForUser(
      req.user.id,
      req.headers['x-profile-id'] || null,
    );
  } catch (err) {
    console.warn('[rejectKidProfile] resolveProfileForUser error (allowing through):', err.message);
  }

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
}

module.exports = {
  rejectKidProfile,
};
