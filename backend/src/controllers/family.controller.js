const familyProfilesService = require('../services/family-profiles.service');

function sendError(res, error, fallbackCode = 'FAMILY_OPERATION_FAILED') {
  const message = error?.message || 'Operation impossible.';

  switch (message) {
    case 'NO_ACTIVE_SUBSCRIPTION':
      return res.status(404).json({ success: false, error: message, message: 'Aucun abonnement actif trouve.' });
    case 'FAMILY_SUBSCRIPTION_REQUIRED':
      return res.status(400).json({ success: false, error: message, message: 'Cette fonctionnalite est reservee a l abonnement famille.' });
    case 'PROFILE_NOT_FOUND':
      return res.status(404).json({ success: false, error: message, message: 'Profil introuvable.' });
    case 'PROFILE_LIMIT_REACHED':
      return res.status(400).json({ success: false, error: message, message: 'Limite de profils atteinte pour cet abonnement.' });
    case 'INVALID_PROFILE_NAME':
      return res.status(400).json({ success: false, error: message, message: 'Le nom du profil est invalide.' });
    case 'INVALID_PROFILE_POSITION':
      return res.status(400).json({ success: false, error: message, message: 'La position du profil est invalide.' });
    case 'OWNER_PROFILE_CANNOT_BE_DELETED':
      return res.status(400).json({ success: false, error: message, message: 'Le profil principal ne peut pas etre supprime.' });
    case 'EMAIL_ACTION_VERIFICATION_REQUIRED':
      return res.status(401).json({ success: false, error: message, message: 'Une verification par code email est requise pour cette action sensible.' });
    case 'USER_NOT_FOUND':
      return res.status(404).json({ success: false, error: message, message: 'Utilisateur introuvable.' });
    case 'PIN_REQUIRED':
      return res.status(400).json({ success: false, error: message, message: 'Un code PIN est requis pour ce profil.' });
    case 'INVALID_PIN':
      return res.status(400).json({ success: false, error: message, message: 'Le code PIN doit contenir de 4 a 6 chiffres, ou est invalide.' });
    default:
      console.error(`❌ ${fallbackCode}:`, error);
      return res.status(500).json({ success: false, error: fallbackCode, message });
  }
}

async function listProfiles(req, res) {
  try {
    const data = await familyProfilesService.listProfilesForOwner(req.user.id);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, 'FAILED_TO_LIST_FAMILY_PROFILES');
  }
}

async function createProfile(req, res) {
  try {
    const profile = await familyProfilesService.createProfile(req.user.id, req.body || {});
    return res.status(201).json({ success: true, data: profile });
  } catch (error) {
    return sendError(res, error, 'FAILED_TO_CREATE_FAMILY_PROFILE');
  }
}

async function updateProfile(req, res) {
  try {
    const profile = await familyProfilesService.updateProfile(req.user.id, req.params.profileId, req.body || {});
    return res.status(200).json({ success: true, data: profile });
  } catch (error) {
    return sendError(res, error, 'FAILED_TO_UPDATE_FAMILY_PROFILE');
  }
}

async function deleteProfile(req, res) {
  try {
    const profile = await familyProfilesService.deleteProfile(req.user.id, req.params.profileId, {
      verificationToken: req.body?.verification_token,
    });
    return res.status(200).json({ success: true, data: profile });
  } catch (error) {
    return sendError(res, error, 'FAILED_TO_DELETE_FAMILY_PROFILE');
  }
}

async function setPin(req, res) {
  try {
    const profile = await familyProfilesService.setProfilePin(req.user.id, req.params.profileId, req.body?.pin, {
      verificationToken: req.body?.verification_token,
    });
    return res.status(200).json({ success: true, data: profile });
  } catch (error) {
    return sendError(res, error, 'FAILED_TO_SET_PROFILE_PIN');
  }
}

async function removePin(req, res) {
  try {
    const profile = await familyProfilesService.removeProfilePin(req.user.id, req.params.profileId, {
      verificationToken: req.body?.verification_token,
    });
    return res.status(200).json({ success: true, data: profile });
  } catch (error) {
    return sendError(res, error, 'FAILED_TO_REMOVE_PROFILE_PIN');
  }
}

async function verifyPin(req, res) {
  try {
    const result = await familyProfilesService.verifyProfilePin(req.user.id, req.params.profileId, req.body?.pin);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return sendError(res, error, 'FAILED_TO_VERIFY_PROFILE_PIN');
  }
}

async function selectProfile(req, res) {
  try {
    const profile = await familyProfilesService.selectProfile(req.user.id, req.body?.profileId, req.body?.pin || null);
    return res.status(200).json({ success: true, data: profile });
  } catch (error) {
    return sendError(res, error, 'FAILED_TO_SELECT_PROFILE');
  }
}

module.exports = {
  listProfiles,
  createProfile,
  updateProfile,
  deleteProfile,
  setPin,
  removePin,
  verifyPin,
  selectProfile,
};
