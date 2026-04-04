/**
 * Admin upload routes - cover image upload to R2
 */
const express = require('express');
const multer = require('multer');
const path = require('path');
const r2Service = require('../services/r2.service');
const config = require('../config/env');
const { extractMetadata } = require('../services/metadata-extractor.service');

const router = express.Router();

// Multer config: 5MB max, images only
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Format non supporte. Acceptes: JPG, PNG, WebP, GIF'));
    }
  },
});

/**
 * POST /admin/api/upload-cover
 * Upload a cover image to R2
 * Requires admin session (protected by AdminJS auth middleware)
 */
router.post('/upload-cover', upload.single('cover'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier envoye' });
    }

    if (!r2Service.isConfigured()) {
      return res.status(503).json({ error: 'R2 non configure' });
    }

    // Generate unique key: covers/YYYY/MM/filename
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const ext = path.extname(req.file.originalname) || '.jpg';
    const safeName = req.file.originalname
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(ext, '');
    const fileKey = `covers/${year}/${month}/${safeName}_${Date.now()}${ext}`;

    // Upload to R2 covers bucket
    await r2Service.uploadBuffer(req.file.buffer, fileKey, {
      bucket: config.r2.bucketCovers,
      contentType: req.file.mimetype,
      cacheControl: 'public, max-age=31536000',
    });

    // Get public URL
    const publicUrl = r2Service.getPublicUrl(fileKey, config.r2.bucketCovers);

    console.log(`✅ Cover uploaded: ${fileKey} → ${publicUrl}`);

    res.json({
      success: true,
      url: publicUrl,
      key: fileKey,
    });
  } catch (err) {
    console.error('Cover upload error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Content file upload (EPUB, PDF, MP3, M4A) ─────────────────────────────

const CONTENT_MIMES = {
  'application/epub+zip': 'epub',
  'application/pdf': 'pdf',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/mp3': 'mp3',
};

const uploadContent = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB max
  fileFilter: (req, file, cb) => {
    if (CONTENT_MIMES[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new Error('Format non supporte. Acceptes: EPUB, PDF, MP3, M4A'));
    }
  },
});

/**
 * POST /admin/api/upload-content
 * Upload a content file (ebook/audiobook) to R2 private bucket
 */
router.post('/upload-content', uploadContent.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier envoye' });
    }

    if (!r2Service.isConfigured()) {
      return res.status(503).json({ error: 'R2 non configure' });
    }

    const mime = req.file.mimetype;
    const format = CONTENT_MIMES[mime] || 'bin';
    const isAudio = ['mp3', 'm4a'].includes(format);
    const folder = isAudio ? 'audiobooks' : 'ebooks';

    // Generate key: ebooks/YYYY/MM/filename.epub or audiobooks/YYYY/MM/filename.mp3
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const ext = path.extname(req.file.originalname) || `.${format}`;
    const safeName = req.file.originalname
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(new RegExp(ext.replace('.', '\\.') + '$'), '');
    const fileKey = `${folder}/${year}/${month}/${safeName}_${Date.now()}${ext}`;

    // Upload to R2 content bucket (private)
    await r2Service.uploadBuffer(req.file.buffer, fileKey, {
      bucket: config.r2.bucketContent,
      contentType: mime,
    });

    console.log(`✅ Content uploaded: ${fileKey} (${(req.file.size / 1024 / 1024).toFixed(1)} Mo)`);

    res.json({
      success: true,
      key: fileKey,
      format,
      content_type: isAudio ? 'audiobook' : 'ebook',
      size_bytes: req.file.size,
      original_name: req.file.originalname,
    });
  } catch (err) {
    console.error('Content upload error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Metadata extraction ─────────────────────────────────────────────────────

const uploadExtract = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/epub+zip',
      'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/mp3',
    ];
    const ext = file.originalname.split('.').pop().toLowerCase();
    const allowedExts = ['epub', 'mp3', 'm4a'];
    if (allowed.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Format non supporté. Acceptés: EPUB, MP3, M4A'));
    }
  },
});

/**
 * POST /admin/api/extract-metadata
 * Receives an EPUB or audio file, extracts metadata, uploads cover to R2 if found.
 * Returns JSON with all extracted fields + optional coverUrl.
 */
router.post('/extract-metadata', uploadExtract.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });

    const meta = await extractMetadata(req.file.buffer, req.file.originalname, req.file.mimetype);
    if (meta.error) return res.status(422).json({ error: meta.error });

    // Upload extracted cover to R2 if found
    let coverUrl = null;
    if (meta.coverBuffer && r2Service.isConfigured()) {
      const now = new Date();
      const ext = meta.coverMime === 'image/png' ? '.png' : '.jpg';
      const fileKey = `covers/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/extracted_${Date.now()}${ext}`;
      await r2Service.uploadBuffer(meta.coverBuffer, fileKey, {
        bucket: config.r2.bucketCovers,
        contentType: meta.coverMime,
        cacheControl: 'public, max-age=31536000',
      });
      coverUrl = r2Service.getPublicUrl(fileKey, config.r2.bucketCovers);
    }

    // Don't send the binary buffer to the client
    const { coverBuffer, coverMime, ...metaClean } = meta;

    res.json({ ...metaClean, coverUrl });
  } catch (err) {
    console.error('extract-metadata error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Logo upload (invoice settings) ────────────────────────────────────────

const uploadLogo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Format non supporte. Acceptes: JPG, PNG, WebP, SVG'));
    }
  },
});

/**
 * POST /admin/api/upload-logo
 * Upload the company logo to R2 (public covers bucket).
 * Returns a public URL stored in app_settings.invoice_logo_url.
 */
router.post('/upload-logo', uploadLogo.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier envoye' });
    }

    if (!r2Service.isConfigured()) {
      return res.status(503).json({ error: 'R2 non configure' });
    }

    // Determine extension (SVG needs special handling)
    const mimeToExt = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
    };
    const ext = mimeToExt[req.file.mimetype] || path.extname(req.file.originalname) || '.png';
    const fileKey = `assets/logos/logo_${Date.now()}${ext}`;

    // Upload to covers bucket (public)
    await r2Service.uploadBuffer(req.file.buffer, fileKey, {
      bucket: config.r2.bucketCovers,
      contentType: req.file.mimetype,
      cacheControl: 'public, max-age=31536000',
    });

    const publicUrl = r2Service.getPublicUrl(fileKey, config.r2.bucketCovers);
    console.log(`✅ Logo uploaded: ${fileKey} → ${publicUrl}`);

    res.json({ success: true, url: publicUrl, key: fileKey });
  } catch (err) {
    console.error('Logo upload error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
