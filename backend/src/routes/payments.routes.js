/**
 * Payments Routes — in-app Mobile Money flow
 */
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/payments.controller');
const { authenticate } = require('../middleware/auth');

// Public catalogue (no auth needed)
router.get('/mobile-money/options', ctrl.getMobileMoneyOptions);

// Initiate + poll (auth required)
router.post('/mobile-money/charge', authenticate, ctrl.chargeMobileMoney);
router.get('/:reference/status',    authenticate, ctrl.getPaymentStatus);
router.post('/:reference/cancel',   authenticate, ctrl.cancelPayment);

module.exports = router;
