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
router.get('/stats',      authenticate, requirePermission('notifications.read'),  notificationsController.adminGetStats);
router.post('/send',      authenticate, requirePermission('notifications.send'),  notificationsController.adminSendNotification);
router.post('/send-promo',authenticate, requirePermission('notifications.send'),  notificationsController.adminSendPromo);
module.exports = router;

// ── Router session (cookie adminjs) — usage AdminJS panel ──────────────────
const panelRouter = express.Router();
panelRouter.get('/stats',       notificationsController.adminGetStats);
panelRouter.post('/send',       notificationsController.adminSendNotification);
panelRouter.post('/send-promo', notificationsController.adminSendPromo);
module.exports.panel = panelRouter;
