const express = require('express');
const router = express.Router();
const familyController = require('../controllers/family.controller');
const { authenticate } = require('../middleware/auth');
const { rejectKidProfile } = require('../middleware/family-access');

router.get('/profiles', authenticate, rejectKidProfile, familyController.listProfiles);
router.post('/profiles', authenticate, rejectKidProfile, familyController.createProfile);
router.patch('/profiles/:profileId', authenticate, rejectKidProfile, familyController.updateProfile);
router.delete('/profiles/:profileId', authenticate, rejectKidProfile, familyController.deleteProfile);

router.post('/profiles/:profileId/set-pin', authenticate, rejectKidProfile, familyController.setPin);
router.post('/profiles/:profileId/remove-pin', authenticate, rejectKidProfile, familyController.removePin);
router.post('/profiles/:profileId/verify-pin', authenticate, rejectKidProfile, familyController.verifyPin);

router.post('/select-profile', authenticate, familyController.selectProfile);

module.exports = router;
