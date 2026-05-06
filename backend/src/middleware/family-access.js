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

/**
 * Restrict to owner-context only:
 * - solo subscription (no family) → allowed
 * - family subscription with active owner profile → allowed
 * - family subscription with non-owner profile → 403
 *
 * Used to gate sensitive endpoints: subscription management, family profile
 * mutations, account preferences.
 */
async function requireOwnerProfile(req, res, next) {
  if (!req.user?.id) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Non authentifie.' },
    });
  }

  let familyContext = { subscription: null, profile: null, profileId: null, isFamilyContext: false };
  try {
    familyContext = await familyProfilesService.resolveProfileForUser(
      req.user.id,
      req.headers['x-profile-id'] || null,
    );
  } catch (err) {
    console.warn('[requireOwnerProfile] resolveProfileForUser error:', err.message);
  }

  req.familyContext = familyContext;

  // Solo subs are always allowed (no family context).
  if (!familyContext?.isFamilyContext) return next();

  // Family sub: only the owner profile can perform sensitive actions.
  if (!familyContext?.profile?.is_owner_profile) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'OWNER_PROFILE_REQUIRED',
        message: 'Cette action est reservee au profil principal.',
      },
    });
  }

  return next();
}

/**
 * Allow if owner OR if the targeted profileId (req.params.profileId) is the
 * currently active profile (a non-owner member can edit their own family profile).
 */
async function requireOwnerOrSelfProfile(req, res, next) {
  if (!req.user?.id) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Non authentifie.' },
    });
  }

  let familyContext = { subscription: null, profile: null, profileId: null, isFamilyContext: false };
  try {
    familyContext = await familyProfilesService.resolveProfileForUser(
      req.user.id,
      req.headers['x-profile-id'] || null,
    );
  } catch (err) {
    console.warn('[requireOwnerOrSelfProfile] resolve error:', err.message);
  }

  req.familyContext = familyContext;

  // Solo subs always allowed.
  if (!familyContext?.isFamilyContext) return next();

  // Owner: allowed.
  if (familyContext?.profile?.is_owner_profile) return next();

  // Self: targeted profileId matches the active profile.
  const targetProfileId = req.params?.profileId;
  if (targetProfileId && targetProfileId === familyContext.profileId) return next();

  return res.status(403).json({
    success: false,
    error: {
      code: 'OWNER_OR_SELF_REQUIRED',
      message: 'Vous ne pouvez modifier que votre propre profil.',
    },
  });
}

module.exports = {
  rejectKidProfile,
  requireOwnerProfile,
  requireOwnerOrSelfProfile,
};
