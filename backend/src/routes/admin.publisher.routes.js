/**
 * Admin Publisher Routes — /api/admin/publishers/*
 * Accessible aux utilisateurs avec rôle 'admin'
 */

const express = require('express');
const router = express.Router();
const { verifyJWT, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/publisher.controller');
const claimsService = require('../services/publisher-claims.service');
const publisherService = require('../services/publisher.service');

const isAdmin = [verifyJWT, requireRole('admin')];

// ── Routes fixes AVANT les routes paramétriques /:id ─────────
router.post('/invite', ...isAdmin, ctrl.adminInvitePublisher);

// ── Validation de contenu ─────────────────────────────────────
router.get('/content/pending', ...isAdmin, ctrl.adminGetPendingContent);
router.put('/content/:id/approve', ...isAdmin, ctrl.adminApproveContent);
router.put('/content/:id/reject',  ...isAdmin, ctrl.adminRejectContent);
router.put('/content/:id/pause',   ...isAdmin, express.json(), ctrl.adminPauseContent);
router.put('/content/:id/pending', ...isAdmin, ctrl.adminResetContent);

// ── Versements ────────────────────────────────────────────────
router.get('/payouts/overview',        ...isAdmin, ctrl.adminGetPayoutsOverview);
router.get('/payouts/history',         ...isAdmin, ctrl.adminGetPayoutsHistory);
router.get('/payouts/scheduled',       ...isAdmin, ctrl.adminGetScheduledPayouts);
router.get('/payouts/schedule-config', ...isAdmin, ctrl.adminGetScheduleConfig);
router.get('/payouts/schedule-preview',...isAdmin, ctrl.adminGetSchedulePreview);
router.put('/payouts/schedule-config', ...isAdmin, ctrl.adminUpdateScheduleConfig);
router.post('/payouts/schedule-now',   ...isAdmin, ctrl.adminScheduleNow);
router.post('/payouts/all',            ...isAdmin, ctrl.adminCreateAllPayouts);
router.post('/payouts',                ...isAdmin, ctrl.adminCreatePayout);
router.put('/payouts/:id/status',      ...isAdmin, ctrl.adminUpdatePayoutStatus);

// ── Réclamations éditeurs ─────────────────────────────────────
router.get('/claims', ...isAdmin, async (req, res) => {
  try {
    const { page, limit, status, publisherId } = req.query;
    const result = await claimsService.adminGetClaims({ page: +page || 1, limit: +limit || 30, status, publisherId });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.put('/claims/:id/reply', ...isAdmin, express.json(), async (req, res) => {
  try {
    const claim = await claimsService.adminReplyClaim(req.params.id, req.user.id, req.body);
    res.json({ success: true, claim });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.put('/claims/:id/status', ...isAdmin, express.json(), async (req, res) => {
  try {
    const claim = await claimsService.adminUpdateClaimStatus(req.params.id, req.body.status);
    res.json({ success: true, claim });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ── Codes promo éditeurs (admin) ──────────────────────────────
router.get('/publisher-promo-codes', ...isAdmin, async (req, res) => {
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

router.put('/:id/promo-limit', ...isAdmin, express.json(), async (req, res) => {
  try {
    const limit = parseInt(req.body.limit);
    if (isNaN(limit)) return res.status(400).json({ success: false, message: 'limit requis (entier).' });
    const publisher = await publisherService.adminUpdatePublisherPromoLimit(req.params.id, limit);
    res.json({ success: true, publisher });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.patch('/publisher-promo-codes/:codeId/toggle', ...isAdmin, async (req, res) => {
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

router.get('/publisher-promo-codes/:codeId/usages', ...isAdmin, async (req, res) => {
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
router.get('/stats/dashboard', ...isAdmin, ctrl.adminGetDashboardStats);
router.get('/', ...isAdmin, ctrl.adminGetPublishers);
router.get('/:id/export', ...isAdmin, ctrl.adminExportPublisher);
router.get('/:id', ...isAdmin, ctrl.adminGetPublisher);
router.put('/:id/status', ...isAdmin, ctrl.adminUpdateStatus);
router.put('/:id/revenue-grid', ...isAdmin, ctrl.adminUpdateRevenueGrid);
router.delete('/:id', ...isAdmin, ctrl.adminDeletePublisher);

module.exports = router;
