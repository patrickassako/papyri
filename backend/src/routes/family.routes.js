const express = require('express');
const router = express.Router();
const familyController = require('../controllers/family.controller');
const { authenticate } = require('../middleware/auth');

router.get('/profiles', authenticate, familyController.listProfiles);
router.post('/profiles', authenticate, familyController.createProfile);
router.patch('/profiles/:profileId', authenticate, familyController.updateProfile);
router.delete('/profiles/:profileId', authenticate, familyController.deleteProfile);

router.post('/profiles/:profileId/set-pin', authenticate, familyController.setPin);
router.post('/profiles/:profileId/remove-pin', authenticate, familyController.removePin);
router.post('/profiles/:profileId/verify-pin', authenticate, familyController.verifyPin);

router.post('/select-profile', authenticate, familyController.selectProfile);

module.exports = router;
