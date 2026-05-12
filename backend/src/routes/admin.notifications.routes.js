/**
 * Admin Notifications Routes
 * Deux exports :
 *  - module.exports       : routes JWT (pour /api/admin/notifications — apps externes)
 *  - module.exports.panel : routes sans JWT (pour /admin/api/notifications — AdminJS panel)
 */

const express = require('express');
const notificationsController = require('../controllers/notifications.controller');
const { authenticate, requirePermission } = require('../middleware/auth');

// ── Router JWT (Bearer token) — usage API externe ──────────────────────────
const router = express.Router();
router.get('/stats',                      authenticate, requirePermission('notifications.read'), notificationsController.adminGetStats);
router.post('/send',                      authenticate, requirePermission('notifications.send'), notificationsController.adminSendNotification);
router.post('/send-promo',                authenticate, requirePermission('notifications.send'), notificationsController.adminSendPromo);
router.get('/scheduled',                  authenticate, requirePermission('notifications.read'), notificationsController.adminListScheduled);
router.delete('/scheduled/:id',           authenticate, requirePermission('notifications.send'), notificationsController.adminCancelScheduled);
router.get('/audience-preview',           authenticate, requirePermission('notifications.read'), notificationsController.adminAudiencePreview);
module.exports = router;

// ── Router session (cookie adminjs) — usage AdminJS panel ──────────────────
const panelRouter = express.Router();
panelRouter.get('/stats',           notificationsController.adminGetStats);
panelRouter.post('/send',           notificationsController.adminSendNotification);
panelRouter.post('/send-promo',     notificationsController.adminSendPromo);
panelRouter.get('/scheduled',       notificationsController.adminListScheduled);
panelRouter.delete('/scheduled/:id',notificationsController.adminCancelScheduled);
panelRouter.get('/audience-preview',notificationsController.adminAudiencePreview);
module.exports.panel = panelRouter;
