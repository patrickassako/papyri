/**
 * Notifications Routes
 */

const express = require('express');
const router = express.Router();
const notificationsController = require('../controllers/notifications.controller');
const { authenticate, requireAdmin } = require('../middleware/auth');

// ── Token FCM ─────────────────────────────────────────────────
router.post('/fcm-token', authenticate, notificationsController.registerToken);
router.delete('/fcm-token', authenticate, notificationsController.revokeToken);

// ── Préférences ───────────────────────────────────────────────
router.get('/preferences', authenticate, notificationsController.getPreferences);
router.put('/preferences', authenticate, notificationsController.updatePreferences);

// ── Historique in-app ─────────────────────────────────────────
router.get('/', authenticate, notificationsController.getNotifications);
router.patch('/:id/read', authenticate, notificationsController.markRead);
router.post('/read-all', authenticate, notificationsController.markAllRead);

module.exports = router;
