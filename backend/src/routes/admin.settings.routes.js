/**
 * Admin Settings Routes
 * Mounted on /api/admin/settings
 */
const express = require('express');
const multer  = require('multer');
const path    = require('path');
const router  = express.Router();
const { verifyJWT, requireRole } = require('../middleware/auth');
const { supabaseAdmin } = require('../config/database');
const { clearCache, SETTINGS_ROW_ID, getDefaultSettings } = require('../services/settings.service');
const r2Service = require('../services/r2.service');
const config    = require('../config/env');

const uploadLogo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Format non supporté. Acceptés: JPG, PNG, WebP, SVG'));
  },
});

const isAdmin = [verifyJWT, requireRole('admin')];

const ALLOWED_FIELDS = [
  'company_name', 'company_tagline', 'company_address',
  'company_email', 'company_website', 'company_phone', 'company_vat_id',
  'invoice_prefix', 'invoice_footer_text', 'invoice_logo_url', 'invoice_notes',
  'invoice_primary_color', 'invoice_accent_color',
];

// GET /  — fetch current settings
router.get('/', isAdmin, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('app_settings')
      .select('*')
      .eq('id', SETTINGS_ROW_ID)
      .maybeSingle();

    if (error) throw error;
    return res.json({ ...getDefaultSettings(), ...(data || {}) });
  } catch (err) {
    console.error('[admin.settings] GET /:', err);
    return res.status(500).json({ error: 'Erreur chargement paramètres.' });
  }
});

// PUT /  — update settings (upsert singleton row)
router.put('/', isAdmin, express.json(), async (req, res) => {
  try {
    const patch = { id: SETTINGS_ROW_ID, updated_at: new Date().toISOString() };
    for (const k of ALLOWED_FIELDS) {
      if (req.body[k] !== undefined) patch[k] = req.body[k];
    }

    const { data, error } = await supabaseAdmin
      .from('app_settings')
      .upsert(patch, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw error;
    clearCache();
    return res.json(data);
  } catch (err) {
    console.error('[admin.settings] PUT /:', err);
    return res.status(500).json({ error: 'Erreur sauvegarde paramètres.' });
  }
});

// POST /upload-logo  — upload logo to R2, returns URL
router.post('/upload-logo', isAdmin, uploadLogo.single('logo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu.' });
    if (!r2Service.isConfigured()) return res.status(503).json({ error: 'Stockage R2 non configuré.' });

    const mimeToExt = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/svg+xml': '.svg' };
    const ext     = mimeToExt[req.file.mimetype] || path.extname(req.file.originalname) || '.png';
    const fileKey = `assets/logos/logo_${Date.now()}${ext}`;

    await r2Service.uploadBuffer(req.file.buffer, fileKey, {
      bucket: config.r2.bucketCovers,
      contentType: req.file.mimetype,
      cacheControl: 'public, max-age=31536000',
    });

    const url = r2Service.getPublicUrl(fileKey, config.r2.bucketCovers);
    console.log(`✅ Logo uploaded: ${fileKey} → ${url}`);
    return res.json({ url });
  } catch (err) {
    console.error('[admin.settings] POST /upload-logo:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
