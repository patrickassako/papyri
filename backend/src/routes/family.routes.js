const express = require('express');
const router = express.Router();
const familyController = require('../controllers/family.controller');
const { authenticate } = require('../middleware/auth');
const { rejectKidProfile, requireOwnerProfile, requireOwnerOrSelfProfile } = require('../middleware/family-access');

// List : tous les profils peuvent voir la liste (mais seul l'owner peut muter d'autres profils)
router.get('/profiles', authenticate, rejectKidProfile, familyController.listProfiles);

// Création / suppression de profil : owner uniquement
router.post('/profiles', authenticate, requireOwnerProfile, familyController.createProfile);
router.delete('/profiles/:profileId', authenticate, requireOwnerProfile, familyController.deleteProfile);

// PATCH : un membre peut éditer son propre profil famille (avatar/nom).
router.patch('/profiles/:profileId', authenticate, requireOwnerOrSelfProfile, familyController.updateProfile);

router.post('/profiles/:profileId/set-pin', authenticate, requireOwnerProfile, familyController.setPin);
router.post('/profiles/:profileId/remove-pin', authenticate, requireOwnerProfile, familyController.removePin);
router.post('/profiles/:profileId/verify-pin', authenticate, familyController.verifyPin);

router.post('/select-profile', authenticate, familyController.selectProfile);

module.exports = router;
