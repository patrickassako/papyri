/**
 * Admin Publisher Routes — /api/admin/publishers/*
 * Accessible aux utilisateurs avec rôle 'admin'
 */

const express = require('express');
const router = express.Router();
const { verifyJWT, requirePermission } = require('../middleware/auth');
const ctrl = require('../controllers/publisher.controller');
const claimsService = require('../services/publisher-claims.service');
const publisherService = require('../services/publisher.service');

// Helpers par domaine de permission
const pubRead     = [verifyJWT, requirePermission('publishers.read')];
const pubWrite    = [verifyJWT, requirePermission('publishers.write')];
const pubApprove  = [verifyJWT, requirePermission('publishers.approve')];
const payRead     = [verifyJWT, requirePermission('payouts.read')];
const payWrite    = [verifyJWT, requirePermission('payouts.write')];
const contentVal  = [verifyJWT, requirePermission('content.validate')];
const contentRead = [verifyJWT, requirePermission('content.read')];
const promoRead   = [verifyJWT, requirePermission('promo_codes.read')];
const promoWrite  = [verifyJWT, requirePermission('promo_codes.write')];

// ── Routes fixes AVANT les routes paramétriques /:id ─────────
router.post('/invite', ...pubWrite, ctrl.adminInvitePublisher);

// ── Validation de contenu ─────────────────────────────────────
router.get('/content/pending',       ...contentRead,  ctrl.adminGetPendingContent);
router.put('/content/:id/approve',   ...contentVal,   ctrl.adminApproveContent);
router.put('/content/:id/reject',    ...contentVal,   ctrl.adminRejectContent);
router.put('/content/:id/pause',     ...contentVal,   express.json(), ctrl.adminPauseContent);
router.put('/content/:id/pending',   ...contentVal,   ctrl.adminResetContent);

// ── Versements ────────────────────────────────────────────────
router.get('/payouts/overview',        ...payRead,  ctrl.adminGetPayoutsOverview);
router.get('/payouts/history',         ...payRead,  ctrl.adminGetPayoutsHistory);
router.get('/payouts/scheduled',       ...payRead,  ctrl.adminGetScheduledPayouts);
router.get('/payouts/schedule-config', ...payRead,  ctrl.adminGetScheduleConfig);
router.get('/payouts/schedule-preview',...payRead,  ctrl.adminGetSchedulePreview);
router.put('/payouts/schedule-config', ...payWrite, ctrl.adminUpdateScheduleConfig);
router.post('/payouts/schedule-now',   ...payWrite, ctrl.adminScheduleNow);
router.post('/payouts/all',            ...payWrite, ctrl.adminCreateAllPayouts);
router.post('/payouts',                ...payWrite, ctrl.adminCreatePayout);
router.put('/payouts/:id/status',      ...payWrite, ctrl.adminUpdatePayoutStatus);

// ── Réclamations éditeurs ─────────────────────────────────────
router.get('/claims', ...pubRead, async (req, res) => {
  try {
    const { page, limit, status, publisherId } = req.query;
    const result = await claimsService.adminGetClaims({ page: +page || 1, limit: +limit || 30, status, publisherId });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.put('/claims/:id/reply', ...pubWrite, express.json(), async (req, res) => {
  try {
    const claim = await claimsService.adminReplyClaim(req.params.id, req.user.id, req.body);
    res.json({ success: true, claim });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.put('/claims/:id/status', ...pubWrite, express.json(), async (req, res) => {
  try {
    const claim = await claimsService.adminUpdateClaimStatus(req.params.id, req.body.status);
    res.json({ success: true, claim });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ── Codes promo éditeurs (admin) ──────────────────────────────
router.get('/publisher-promo-codes', ...promoRead, async (req, res) => {
  try {
    const { publisherId, status, page, limit } = req.query;
    const codes = await publisherService.adminGetPublisherPromoCodes({
      publisherId, status, page: +page || 1, limit: +limit || 100,
    });
    res.json({ success: true, codes });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.put('/:id/promo-limit', ...promoWrite, express.json(), async (req, res) => {
  try {
    const limit = parseInt(req.body.limit);
    if (isNaN(limit)) return res.status(400).json({ success: false, message: 'limit requis (entier).' });
    const publisher = await publisherService.adminUpdatePublisherPromoLimit(req.params.id, limit);
    res.json({ success: true, publisher });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.patch('/publisher-promo-codes/:codeId/toggle', ...promoWrite, async (req, res) => {
  try {
    const { supabaseAdmin } = require('../config/database');
    const { data: current, error: fe } = await supabaseAdmin
      .from('promo_codes').select('is_active').eq('id', req.params.codeId).single();
    if (fe || !current) return res.status(404).json({ success: false, message: 'Code introuvable.' });
    const { data, error } = await supabaseAdmin
      .from('promo_codes')
      .update({ is_active: !current.is_active, updated_at: new Date().toISOString() })
      .eq('id', req.params.codeId).select().single();
    if (error) throw error;
    res.json({ success: true, code: data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.get('/publisher-promo-codes/:codeId/usages', ...promoRead, async (req, res) => {
  try {
    const { supabaseAdmin } = require('../config/database');
    const { data, error } = await supabaseAdmin
      .from('promo_code_usages')
      .select('id, discount_applied, used_at, profiles ( id, full_name, email )')
      .eq('promo_code_id', req.params.codeId)
      .order('used_at', { ascending: false });
    if (error) throw error;
    res.json({ success: true, usages: data || [] });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ── Gestion des éditeurs (routes paramétriques en dernier) ────
router.get('/stats/dashboard', ...pubRead,  ctrl.adminGetDashboardStats);
router.get('/',               ...pubRead,  ctrl.adminGetPublishers);
router.get('/:id/export',     ...pubRead,  ctrl.adminExportPublisher);
router.get('/:id',            ...pubRead,  ctrl.adminGetPublisher);
router.put('/:id/status',     ...pubWrite, ctrl.adminUpdateStatus);
router.put('/:id/revenue-grid',...pubWrite,ctrl.adminUpdateRevenueGrid);
router.delete('/:id',         ...pubWrite, ctrl.adminDeletePublisher);

module.exports = router;
