const express = require('express');
const router = express.Router();
const familyController = require('../controllers/family.controller');
const { authenticate } = require('../middleware/auth');
const { rejectKidProfile, requireOwnerProfile } = require('../middleware/family-access');

// List : tous les profils peuvent voir la liste (mais seul l'owner peut muter)
router.get('/profiles', authenticate, rejectKidProfile, familyController.listProfiles);

// Mutations sur les profils : owner uniquement
router.post('/profiles', authenticate, requireOwnerProfile, familyController.createProfile);
router.patch('/profiles/:profileId', authenticate, requireOwnerProfile, familyController.updateProfile);
router.delete('/profiles/:profileId', authenticate, requireOwnerProfile, familyController.deleteProfile);

router.post('/profiles/:profileId/set-pin', authenticate, requireOwnerProfile, familyController.setPin);
router.post('/profiles/:profileId/remove-pin', authenticate, requireOwnerProfile, familyController.removePin);
router.post('/profiles/:profileId/verify-pin', authenticate, familyController.verifyPin);

router.post('/select-profile', authenticate, familyController.selectProfile);

module.exports = router;
