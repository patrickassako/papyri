/**
 * Media Proxy Routes
 * Generates presigned URLs for R2 cover images and avatars (public bucket).
 * Avoids exposing R2 credentials to the client and bypasses R2 public access restrictions.
 */

const express = require('express');
const router = express.Router();
const r2Service = require('../services/r2.service');
const config = require('../config/env');

/**
 * GET /api/media/image?key=avatars/user-id/filename.jpg
 * Returns a 302 redirect to a presigned URL valid for 1 hour.
 * No authentication required — covers and avatars are considered public content.
 */
router.get('/image', async (req, res) => {
  const { key } = req.query;

  if (!key || typeof key !== 'string' || key.length > 512) {
    return res.status(400).json({ error: 'Missing or invalid key parameter' });
  }

  // Block path traversal attempts
  const normalized = key.replace(/\\/g, '/');
  if (normalized.includes('..') || normalized.startsWith('/')) {
    return res.status(400).json({ error: 'Invalid key' });
  }

  try {
    const presignedUrl = await r2Service.generatePresignedUrl(
      normalized,
      3600, // 1 hour
      config.r2.bucketCovers
    );

    // 302 redirect — mobile Image component follows redirects automatically
    res.redirect(302, presignedUrl);
  } catch (err) {
    console.error('[media/image] presign error:', err.message);
    res.status(500).json({ error: 'Failed to generate image URL' });
  }
});

module.exports = router;
