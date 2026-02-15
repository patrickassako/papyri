/**
 * Webhooks Routes
 * Routes pour les webhooks de paiement
 */

const express = require('express');
const router = express.Router();
const webhooksController = require('../controllers/webhooks.controller');

/**
 * POST /webhooks/flutterwave
 * Flutterwave webhook endpoint
 * @public (no auth, verified by signature)
 */
router.post('/flutterwave', webhooksController.handleFlutterwaveWebhook);

/**
 * GET /webhooks/test
 * Test endpoint to check webhook configuration
 * @public
 */
router.get('/test', webhooksController.testWebhook);

module.exports = router;
