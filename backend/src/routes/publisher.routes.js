/**
 * Publisher Routes — /api/publisher/*
 * Accessible aux utilisateurs avec rôle 'publisher'
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const { verifyJWT, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/publisher.controller');
const claimsService = require('../services/publisher-claims.service');
const publisherService = require('../services/publisher.service');
const r2Service = require('../services/r2.service');
const config = require('../config/env');
const { extractMetadata } = require('../services/metadata-extractor.service');

const isPublisher = [verifyJWT, requireRole('publisher')];

// ── Auth invitation (public) ──────────────────────────────────
router.get('/activate/:token', ctrl.verifyToken);
router.post('/activate', ctrl.activate);

// ── Dashboard ─────────────────────────────────────────────────
router.get('/dashboard-data', ...isPublisher, ctrl.getDashboardData);

// ── Profil ────────────────────────────────────────────────────
router.get('/me', ...isPublisher, ctrl.getMe);
router.put('/me', ...isPublisher, ctrl.updateMe);
router.put('/me/payout-method', ...isPublisher, ctrl.updatePayoutMethod);

// ── Livres ────────────────────────────────────────────────────
router.get('/books', ...isPublisher, ctrl.getBooks);
router.post('/books', ...isPublisher, ctrl.submitBook);
router.put('/books/:contentId', ...isPublisher, ctrl.updateBook);
router.delete('/books/:contentId', ...isPublisher, ctrl.deleteBook);

// ── Stats de lecture ──────────────────────────────────────────
router.get('/stats/reading', ...isPublisher, ctrl.getReadingStats);

// ── Revenus ───────────────────────────────────────────────────
router.get('/revenue/summary', ...isPublisher, ctrl.getRevenueSummary);
router.get('/revenue/by-book', ...isPublisher, ctrl.getRevenueByBook);
router.get('/payouts', ...isPublisher, ctrl.getPayouts);

// ── Codes promo ───────────────────────────────────────────────
router.get('/promo-codes/quota', ...isPublisher, ctrl.getPromoQuota);
router.get('/promo-codes', ...isPublisher, ctrl.getPromoCodes);
router.post('/promo-codes', ...isPublisher, ctrl.createPromoCode);
router.patch('/promo-codes/:id/toggle', ...isPublisher, ctrl.togglePromoCode);
router.get('/promo-codes/:id/usages', ...isPublisher, ctrl.getPromoCodeUsages);
router.delete('/promo-codes/:id', ...isPublisher, ctrl.deletePromoCode);

// ── Prix géographiques ────────────────────────────────────────
router.get('/books/:contentId/geo-pricing', ...isPublisher, ctrl.getBookGeoPricing);
router.post('/books/:contentId/geo-pricing', ...isPublisher, express.json(), ctrl.upsertBookGeoPricing);
router.delete('/books/:contentId/geo-pricing/:id', ...isPublisher, ctrl.deleteBookGeoPricing);

// ── Restrictions géographiques ────────────────────────────────
router.get('/books/:contentId/geo-restrictions', ...isPublisher, ctrl.getBookGeoRestrictions);
router.post('/books/:contentId/geo-restrictions/config', ...isPublisher, express.json(), ctrl.setBookGeoRestrictionConfig);
router.delete('/books/:contentId/geo-restrictions', ...isPublisher, ctrl.deleteBookGeoRestrictionConfig);
router.post('/books/:contentId/geo-restrictions/zones', ...isPublisher, express.json(), ctrl.upsertBookGeoZone);
router.delete('/books/:contentId/geo-restrictions/zones/:zoneId', ...isPublisher, ctrl.deleteBookGeoZone);

// ── Upload fichiers (R2) ──────────────────────────────────────

const multerCover = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype);
    ok ? cb(null, true) : cb(new Error('Format non supporté. Acceptés: JPG, PNG, WebP'));
  },
});

const CONTENT_MIMES = {
  'application/epub+zip': 'epub',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/mp3': 'mp3',
};

const multerContent = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.split('.').pop().toLowerCase();
    const ok = !!CONTENT_MIMES[file.mimetype] || ['epub', 'mp3', 'm4a'].includes(ext);
    ok ? cb(null, true) : cb(new Error('Format non supporté. Acceptés: EPUB, MP3, M4A'));
  },
});

router.post('/upload-cover', ...isPublisher, multerCover.single('cover'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu.' });
    if (!r2Service.isConfigured()) return res.status(503).json({ error: 'Stockage non configuré.' });

    const now = new Date();
    const ext = path.extname(req.file.originalname) || '.jpg';
    const safeName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_').replace(new RegExp(`\\${ext}$`), '');
    const fileKey = `covers/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${safeName}_${Date.now()}${ext}`;

    await r2Service.uploadBuffer(req.file.buffer, fileKey, {
      bucket: config.r2.bucketCovers,
      contentType: req.file.mimetype,
      cacheControl: 'public, max-age=31536000',
    });

    const url = r2Service.getPublicUrl(fileKey, config.r2.bucketCovers);
    res.json({ success: true, url, key: fileKey });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/upload-content', ...isPublisher, multerContent.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu.' });
    if (!r2Service.isConfigured()) return res.status(503).json({ error: 'Stockage non configuré.' });

    const mime = req.file.mimetype;
    const ext = path.extname(req.file.originalname).toLowerCase() || '.bin';
    const format = CONTENT_MIMES[mime] || ext.replace('.', '');
    const isAudio = ['mp3', 'm4a'].includes(format);
    const folder = isAudio ? 'audiobooks' : 'ebooks';

    const now = new Date();
    const safeName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_').replace(new RegExp(`\\${ext}$`), '');
    const fileKey = `${folder}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${safeName}_${Date.now()}${ext}`;

    await r2Service.uploadBuffer(req.file.buffer, fileKey, {
      bucket: config.r2.bucketContent,
      contentType: mime,
    });

    res.json({
      success: true,
      key: fileKey,
      format,
      content_type: isAudio ? 'audiobook' : 'ebook',
      size_bytes: req.file.size,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/extract-metadata', ...isPublisher, multerContent.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu.' });

    const meta = await extractMetadata(req.file.buffer, req.file.originalname, req.file.mimetype);
    if (meta.error) return res.status(422).json({ error: meta.error });

    let coverUrl = null;
    if (meta.coverBuffer && r2Service.isConfigured()) {
      const ext = meta.coverMime === 'image/png' ? '.png' : '.jpg';
      const now = new Date();
      const fileKey = `covers/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/extracted_${Date.now()}${ext}`;
      await r2Service.uploadBuffer(meta.coverBuffer, fileKey, {
        bucket: config.r2.bucketCovers,
        contentType: meta.coverMime,
        cacheControl: 'public, max-age=31536000',
      });
      coverUrl = r2Service.getPublicUrl(fileKey, config.r2.bucketCovers);
    }

    const { coverBuffer, coverMime, ...metaClean } = meta;
    res.json({ ...metaClean, coverUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Réclamations ──────────────────────────────────────────────

router.get('/claims', ...isPublisher, async (req, res) => {
  try {
    const publisher = await publisherService.getPublisherByUserId(req.user.id);
    const { page, limit, status } = req.query;
    const result = await claimsService.getClaims(publisher.id, { page: +page || 1, limit: +limit || 20, status });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/claims', ...isPublisher, async (req, res) => {
  try {
    const publisher = await publisherService.getPublisherByUserId(req.user.id);
    const claim = await claimsService.createClaim(publisher.id, req.body);
    res.status(201).json({ success: true, claim });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
