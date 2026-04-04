/**
 * AdminJS Routes - Epic 10
 * Protected back-office for admin users
 * Uses Supabase REST adapter (no DATABASE_URL needed)
 */

const AdminJSModule = require('adminjs');
const AdminJS = AdminJSModule.default || AdminJSModule;
const AdminJSExpress = require('@adminjs/express');
const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const path = require('path');
const { buildAdminOptions } = require('../config/adminjs');
const { createClient } = require('@supabase/supabase-js');
const { supabaseAdmin } = require('../config/database');
const { logAdminLogin } = require('../services/audit.service');
const { consumeToken, peekToken } = require('../services/admin-invoice-token.service');
const { getSettings } = require('../services/settings.service');
const { generateInvoicePDFBuffer, buildInvoiceNumber } = require('../services/invoice.service');
const { storeToken } = require('../services/admin-invoice-token.service');

/**
 * Shared session store — the SAME instance used by both buildAuthenticatedRouter
 * and adminUtilRouter so that req.session.adminUser set by AdminJS login is
 * visible when custom API routes are hit.
 * FileStore persists sessions to disk → survives server restarts (no more repeated logins).
 */
const sharedSessionStore = new FileStore({
  path: path.join(__dirname, '..', '..', '.sessions'),
  ttl: 86400,       // 24h in seconds
  retries: 1,
  logFn: () => {},  // silence file-store verbose logs
});
// NOTE: buildAuthenticatedRouter overrides `secret` with auth.cookiePassword and sets `name`.
// We must use the SAME cookiePassword here so adminUtilRouter can verify session IDs.
const ADMIN_COOKIE_PASSWORD = process.env.ADMIN_COOKIE_SECRET || 'papyri-admin-cookie-dev-secret-32chars-min';
const sharedSessionOptions = {
  resave: false,
  saveUninitialized: false,
  secret: ADMIN_COOKIE_PASSWORD,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000, // 24h
    sameSite: 'lax',
  },
  name: 'adminjs',
  store: sharedSessionStore,
};

// Dedicated Supabase client for admin auth ONLY
// Separate from supabaseAdmin to avoid polluting its auth state
// (signInWithPassword changes the client's auth context, breaking service_role bypass)
const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * Custom authentication function for AdminJS
 * Uses a DEDICATED Supabase client for auth to avoid polluting supabaseAdmin state
 */
async function authenticate(email, password, req) {
  try {
    // Use dedicated auth client — NOT supabaseAdmin
    const { data, error } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      console.log(`❌ Admin login failed: ${email}`);
      return null;
    }

    // Check role in profile (use supabaseAdmin for data queries)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    const role = data.user.user_metadata?.role || profile?.role || 'user';

    if (role !== 'admin') {
      console.log(`❌ Admin login rejected (not admin): ${email}`);
      return null;
    }

    // Log successful admin login
    await logAdminLogin(data.user.id, email, {
      ip_address: req?.ip || req?.headers?.['x-forwarded-for'] || 'unknown',
      user_agent: req?.headers?.['user-agent'] || 'unknown',
    });

    console.log(`✅ Admin login: ${email}`);

    return {
      id: data.user.id,
      email: data.user.email,
      full_name: profile?.full_name || email,
      role,
    };

  } catch (err) {
    console.error('Admin auth error:', err.message);
    return null;
  }
}

/**
 * Setup AdminJS with Supabase adapter and authentication
 * @returns {Promise<{admin: AdminJS, router: Express.Router}>}
 */
async function setupAdminJS() {
  const adminOptions = await buildAdminOptions();
  const admin = new AdminJS(adminOptions);

  // Bundle custom components (required for ComponentLoader)
  if (process.env.NODE_ENV === 'production') {
    await admin.initialize();
  } else {
    await admin.watch();
  }

  // Build authenticated router with the SHARED session store (defined at module top)
  const router = AdminJSExpress.buildAuthenticatedRouter(
    admin,
    {
      authenticate,
      cookiePassword: ADMIN_COOKIE_PASSWORD, // same as sharedSessionOptions.secret
    },
    null,
    sharedSessionOptions
  );

  return { admin, router };
}

/**
 * Express router for custom admin utility endpoints (mounted alongside admin)
 */
const adminUtilRouter = express.Router();
const publisherService = require('../services/publisher.service');

// Apply the shared session middleware so req.session.adminUser is populated
const adminSessionMiddleware = session(sharedSessionOptions);
adminUtilRouter.use(adminSessionMiddleware);

// Middleware : vérifie que la session AdminJS est active
function requireAdminSession(req, res, next) {
  if (!req.session?.adminUser) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  next();
}

// ── Données de référence (listes pour les formulaires) ────────────────────────

adminUtilRouter.get('/api/categories', requireAdminSession, async (req, res) => {
  try {
    const { supabaseAdmin } = require('../config/database');
    const { data, error } = await supabaseAdmin.from('categories').select('id, name').order('name');
    if (error) throw error;
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── API données éditeurs (appelée depuis les composants custom AdminJS) ────────

adminUtilRouter.get('/api/publisher-stats', requireAdminSession, async (req, res) => {
  try {
    const { from, to } = req.query;
    const stats = await publisherService.getAdminDashboardStats({ from, to });
    res.json(stats);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

adminUtilRouter.get('/api/publishers', requireAdminSession, async (req, res) => {
  try {
    const result = await publisherService.getAllPublishers(req.query);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

adminUtilRouter.post('/api/publishers/invite', requireAdminSession, express.json(), async (req, res) => {
  try {
    const adminId = req.session.adminUser.id;
    const result = await publisherService.invitePublisher(adminId, req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

adminUtilRouter.get('/api/publishers/:id', requireAdminSession, async (req, res) => {
  try {
    const { from, to } = req.query;
    const result = await publisherService.getPublisherFull(req.params.id, { from, to });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

adminUtilRouter.put('/api/publishers/:id/status', requireAdminSession, express.json(), async (req, res) => {
  try {
    const result = await publisherService.updatePublisherStatus(req.params.id, req.body.status);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

adminUtilRouter.put('/api/publishers/:id/revenue-grid', requireAdminSession, express.json(), async (req, res) => {
  try {
    const result = await publisherService.updateRevenueGrid(req.params.id, req.body);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

adminUtilRouter.get('/api/content/pending', requireAdminSession, async (req, res) => {
  try {
    const result = await publisherService.getPendingContent(req.query);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

adminUtilRouter.put('/api/content/:id/metadata', requireAdminSession, express.json(), async (req, res) => {
  try {
    const allowed = ['title', 'author', 'description', 'language', 'access_type', 'is_purchasable',
      'price_cents', 'price_currency', 'subscription_discount_percent', 'cover_url', 'file_key'];
    const update = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) update[k] = req.body[k];
    }
    if (Object.keys(update).length === 0) return res.status(400).json({ error: 'Aucun champ à modifier.' });
    update.updated_at = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from('contents').update(update).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ content: data });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

adminUtilRouter.put('/api/content/:id/approve', requireAdminSession, async (req, res) => {
  try {
    const adminId = req.session.adminUser.id;
    await publisherService.approveContent(req.params.id, adminId);
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

adminUtilRouter.put('/api/content/:id/reject', requireAdminSession, express.json(), async (req, res) => {
  try {
    const adminId = req.session.adminUser.id;
    await publisherService.rejectContent(req.params.id, adminId, req.body.reason);
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

adminUtilRouter.put('/api/content/:id/pause', requireAdminSession, express.json(), async (req, res) => {
  try {
    const adminId = req.session.adminUser.id;
    await publisherService.pauseContent(req.params.id, adminId, req.body.reason);
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

adminUtilRouter.put('/api/content/:id/pending', requireAdminSession, async (req, res) => {
  try {
    const adminId = req.session.adminUser.id;
    await publisherService.setPendingContent(req.params.id, adminId);
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Revenus non versés, groupés par éditeur
adminUtilRouter.get('/api/payouts', requireAdminSession, async (req, res) => {
  try {
    const payouts = await publisherService.getPayoutsOverview(req.query);
    res.json({ payouts });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Historique des versements créés
adminUtilRouter.get('/api/payout-history', requireAdminSession, async (req, res) => {
  try {
    const result = await publisherService.getPayoutsHistory(req.query);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Créer un versement pour un éditeur
adminUtilRouter.post('/api/payouts', requireAdminSession, express.json(), async (req, res) => {
  try {
    const adminId = req.session.adminUser.id;
    const result = await publisherService.createPayout(adminId, req.body);
    res.json({ success: true, payout: result });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Créer versements pour TOUS les éditeurs avec solde en attente
adminUtilRouter.post('/api/payouts/bulk', requireAdminSession, express.json(), async (req, res) => {
  try {
    const adminId = req.session.adminUser.id;
    const result = await publisherService.createAllPayouts(adminId, req.body);
    res.json({ success: true, ...result });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Changer le statut d'un versement
adminUtilRouter.put('/api/payouts/:id/status', requireAdminSession, express.json(), async (req, res) => {
  try {
    const adminId = req.session.adminUser.id;
    const payout = await publisherService.updatePayoutStatus(req.params.id, req.body.status, adminId);
    res.json({ success: true, payout });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── Prix géographiques ────────────────────────────────────────────────────────

adminUtilRouter.get('/api/content/:contentId/geo-pricing', requireAdminSession, async (req, res) => {
  try {
    const { supabaseAdmin } = require('../config/database');
    const { data, error } = await supabaseAdmin
      .from('content_geographic_pricing')
      .select('*')
      .eq('content_id', req.params.contentId)
      .order('zone');
    if (error) throw new Error(error.message);
    res.json({ prices: data || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

adminUtilRouter.post('/api/content/:contentId/geo-pricing', requireAdminSession, express.json(), async (req, res) => {
  try {
    const { supabaseAdmin } = require('../config/database');
    const { zone, zone_label, price_cents, currency, notes, is_active } = req.body;
    if (!zone || price_cents == null) return res.status(400).json({ error: 'zone et price_cents requis' });
    const { data, error } = await supabaseAdmin
      .from('content_geographic_pricing')
      .insert({ content_id: req.params.contentId, zone, zone_label: zone_label || zone, price_cents, currency: currency || 'EUR', notes: notes || null, is_active: is_active !== false })
      .select()
      .single();
    if (error) throw new Error(error.message);
    res.json({ price: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

adminUtilRouter.put('/api/content/geo-pricing/:id', requireAdminSession, express.json(), async (req, res) => {
  try {
    const { supabaseAdmin } = require('../config/database');
    const { zone, zone_label, price_cents, currency, notes, is_active } = req.body;
    const { data, error } = await supabaseAdmin
      .from('content_geographic_pricing')
      .update({ zone, zone_label, price_cents, currency, notes: notes || null, is_active, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    res.json({ price: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

adminUtilRouter.delete('/api/content/geo-pricing/:id', requireAdminSession, async (req, res) => {
  try {
    const { supabaseAdmin } = require('../config/database');
    const { error } = await supabaseAdmin
      .from('content_geographic_pricing')
      .delete()
      .eq('id', req.params.id);
    if (error) throw new Error(error.message);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Restrictions géographiques ───────────────────────────────────────────────

adminUtilRouter.get('/api/content/:contentId/geo-restrictions', requireAdminSession, async (req, res) => {
  try {
    const { supabaseAdmin } = require('../config/database');
    const [cfgRes, zonesRes] = await Promise.all([
      supabaseAdmin.from('content_geo_restriction_config').select('*').eq('content_id', req.params.contentId).maybeSingle(),
      supabaseAdmin.from('content_geo_restrictions').select('*').eq('content_id', req.params.contentId).order('zone'),
    ]);
    res.json({ config: cfgRes.data || null, zones: zonesRes.data || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

adminUtilRouter.post('/api/content/:contentId/geo-restrictions/config', requireAdminSession, express.json(), async (req, res) => {
  try {
    const { supabaseAdmin } = require('../config/database');
    const { mode } = req.body;
    if (!['blacklist', 'whitelist'].includes(mode)) return res.status(400).json({ error: 'mode invalide' });
    const { data, error } = await supabaseAdmin
      .from('content_geo_restriction_config')
      .upsert({ content_id: req.params.contentId, mode, updated_at: new Date().toISOString() }, { onConflict: 'content_id' })
      .select().single();
    if (error) throw new Error(error.message);
    res.json({ config: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

adminUtilRouter.delete('/api/content/:contentId/geo-restrictions', requireAdminSession, async (req, res) => {
  try {
    const { supabaseAdmin } = require('../config/database');
    await Promise.all([
      supabaseAdmin.from('content_geo_restriction_config').delete().eq('content_id', req.params.contentId),
      supabaseAdmin.from('content_geo_restrictions').delete().eq('content_id', req.params.contentId),
    ]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

adminUtilRouter.post('/api/content/:contentId/geo-restrictions/zones', requireAdminSession, express.json(), async (req, res) => {
  try {
    const { supabaseAdmin } = require('../config/database');
    const { zone, zone_label, reason, is_active } = req.body;
    if (!zone) return res.status(400).json({ error: 'zone requis' });
    const { data, error } = await supabaseAdmin
      .from('content_geo_restrictions')
      .insert({ content_id: req.params.contentId, zone, zone_label: zone_label || zone, reason: reason || null, is_active: is_active !== false })
      .select().single();
    if (error) throw new Error(error.message);
    res.json({ zone: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

adminUtilRouter.put('/api/content/geo-restrictions/zones/:id', requireAdminSession, express.json(), async (req, res) => {
  try {
    const { supabaseAdmin } = require('../config/database');
    const { is_active, reason } = req.body;
    const update = {};
    if (is_active !== undefined) update.is_active = is_active;
    if (reason !== undefined)    update.reason    = reason;
    const { data, error } = await supabaseAdmin
      .from('content_geo_restrictions').update(update).eq('id', req.params.id).select().single();
    if (error) throw new Error(error.message);
    res.json({ zone: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

adminUtilRouter.delete('/api/content/geo-restrictions/zones/:id', requireAdminSession, async (req, res) => {
  try {
    const { supabaseAdmin } = require('../config/database');
    const { error } = await supabaseAdmin.from('content_geo_restrictions').delete().eq('id', req.params.id);
    if (error) throw new Error(error.message);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Proxy de streaming R2 (évite CORS) ───────────────────────────────────────
// GET /admin/api/content/:id/stream          → lecture inline (lecteur)
// GET /admin/api/content/:id/stream?download=1 → téléchargement avec Content-Disposition
adminUtilRouter.get('/api/content/:id/stream', requireAdminSession, async (req, res) => {
  try {
    const { supabaseAdmin } = require('../config/database');
    const r2 = require('../services/r2.service');
    const config = require('../config/env');
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const { Readable } = require('stream');

    const { data: content, error } = await supabaseAdmin
      .from('contents')
      .select('id, title, file_key, format, content_type')
      .eq('id', req.params.id)
      .single();
    if (error || !content) return res.status(404).json({ error: 'Contenu introuvable' });
    if (!content.file_key) return res.status(400).json({ error: 'Aucun fichier associé' });

    const client = r2.getClient();
    if (!client) return res.status(503).json({ error: 'R2 non configuré' });

    const MIME = { epub: 'application/epub+zip', pdf: 'application/pdf', mp3: 'audio/mpeg', m4a: 'audio/mp4' };
    const mime = MIME[content.format] || 'application/octet-stream';
    const safeName = (content.title || 'document').replace(/[^a-z0-9]/gi, '_') + '.' + (content.format || 'bin');
    const isDownload = req.query.download === '1';

    const cmdParams = { Bucket: config.r2.bucketContent, Key: content.file_key };
    // Passer le Range header au bucket R2 → permet le seek audio/video
    if (req.headers.range) cmdParams.Range = req.headers.range;

    const r2Res = await client.send(new GetObjectCommand(cmdParams));

    res.status(req.headers.range && r2Res.ContentRange ? 206 : 200);
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `${isDownload ? 'attachment' : 'inline'}; filename="${safeName}"`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, no-store');
    if (r2Res.ContentLength) res.setHeader('Content-Length', r2Res.ContentLength);
    if (r2Res.ContentRange)  res.setHeader('Content-Range',  r2Res.ContentRange);

    // SDK v3 : Body est un Readable Node.js ou un Web ReadableStream selon l'env
    const body = r2Res.Body;
    if (typeof body.pipe === 'function') {
      body.pipe(res);
      body.on('error', () => { if (!res.headersSent) res.end(); });
    } else {
      Readable.fromWeb(body).pipe(res);
    }
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

// ── Lecteur EPUB plein écran (servi dans un iframe AdminJS) ───────────────────
// epub.js fetch le fichier via l'endpoint stream (même origine → cookie session auto).
// Il désarchive le ZIP en mémoire et sert toutes les ressources internes depuis la mémoire.
adminUtilRouter.get('/epub-reader', requireAdminSession, async (req, res) => {
  const contentId = req.query.contentId;
  if (!contentId) return res.status(400).send('<p>contentId manquant</p>');

  try {
    const { supabaseAdmin } = require('../config/database');

    const { data: content, error } = await supabaseAdmin
      .from('contents').select('id, title, file_key, format').eq('id', contentId).single();
    if (error || !content) return res.status(404).send('<p>Contenu introuvable</p>');
    if (!content.file_key) return res.status(400).send('<p>Aucun fichier associé</p>');

    // epub.js fetche cette URL (même origine, cookie admin envoyé automatiquement)
    // puis désarchive le ZIP en mémoire → pas de problème de résolution de chemins
    const epubUrl = `/admin/api/content/${contentId}/stream`;
    const downloadUrl = `/admin/api/content/${contentId}/stream?download=1`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lecteur EPUB — Papyri Admin</title>
<script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%;overflow:hidden;background:#fdf8f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a2e}
#app{display:flex;flex-direction:column;height:100%}
#toolbar{display:flex;align-items:center;gap:10px;padding:10px 16px;background:#fff;border-bottom:1px solid #e5e0d8;flex-shrink:0;flex-wrap:wrap}
.btn{padding:7px 13px;border:1px solid #e0d8d0;border-radius:8px;background:#fff;cursor:pointer;font-size:13px;font-weight:600;color:#2E4057;transition:background .15s;white-space:nowrap;font-family:inherit}
.btn:hover{background:#f5f0eb}.btn:disabled{opacity:.4;cursor:default}
.btn-primary{background:#B5651D;color:#fff;border-color:#B5651D}.btn-primary:hover{background:#9a5518}
#chapter-wrap{flex:1;display:flex;align-items:center;justify-content:center;min-width:0}
#chapter-title{font-size:13px;color:#8c8c8c;text-overflow:ellipsis;overflow:hidden;white-space:nowrap;max-width:340px;font-weight:600}
#viewer{flex:1;overflow:hidden;position:relative}
#loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:14px;background:#fdf8f3}
.spinner{width:40px;height:40px;border:3px solid #e0d8d0;border-top-color:#B5651D;border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
#err{display:none;position:absolute;inset:0;align-items:center;justify-content:center;flex-direction:column;gap:14px;padding:40px;text-align:center}
#err .ico{font-size:48px}
#err .msg{font-size:14px;color:#c62828;max-width:360px;line-height:1.6}
.toc-overlay{display:none;position:absolute;inset:0;z-index:20;background:rgba(0,0,0,.35)}
.toc-overlay.open{display:block}
.toc-panel{position:absolute;top:0;left:0;bottom:0;width:300px;background:#fff;overflow-y:auto;box-shadow:6px 0 24px rgba(0,0,0,.12)}
.toc-head{padding:18px 20px;font-weight:800;font-size:15px;color:#2E4057;border-bottom:1px solid #e5e0d8;display:flex;justify-content:space-between;align-items:center}
.toc-close{background:none;border:none;cursor:pointer;font-size:18px;color:#8c8c8c;line-height:1}
.toc-item{padding:12px 20px;font-size:13px;cursor:pointer;border-bottom:1px solid #f0ede8;transition:background .12s;line-height:1.4}
.toc-item:hover{background:#fdf8f3;color:#B5651D}
.toc-item.sub{padding-left:34px;font-size:12px;color:#666}
</style>
</head>
<body>
<div id="app">
  <div id="toolbar">
    <button class="btn" id="toc-btn">☰ Sommaire</button>
    <button class="btn" id="prev-btn">&#8592; Précédent</button>
    <div id="chapter-wrap"><span id="chapter-title">Chargement…</span></div>
    <button class="btn" id="next-btn">Suivant &#8594;</button>
  </div>
  <div id="viewer">
    <div id="loading"><div class="spinner"></div><div style="font-size:14px;color:#8c8c8c">Ouverture du livre…</div></div>
    <div id="err"><div class="ico">📖</div><div class="msg" id="err-msg">Impossible de charger ce fichier EPUB.</div><a id="dl-link" href="#" style="color:#B5651D;font-weight:600;font-size:14px">Télécharger le fichier</a></div>
    <div class="toc-overlay" id="toc-ov">
      <div class="toc-panel">
        <div class="toc-head">Table des matières<button class="toc-close" id="toc-close">✕</button></div>
        <div id="toc-list"></div>
      </div>
    </div>
  </div>
</div>
<script>
(function(){
  var epubUrl = ${JSON.stringify(epubUrl)};
  var loading = document.getElementById('loading');
  var errBox  = document.getElementById('err');
  var errMsg  = document.getElementById('err-msg');
  var chapEl  = document.getElementById('chapter-title');
  var tocOv   = document.getElementById('toc-ov');
  var tocList = document.getElementById('toc-list');

  var dlUrl = ${JSON.stringify(downloadUrl)};
  document.getElementById('dl-link').href = dlUrl;
  document.getElementById('toc-btn').onclick = function(){ tocOv.classList.add('open'); };
  document.getElementById('toc-close').onclick = function(){ tocOv.classList.remove('open'); };
  tocOv.addEventListener('click', function(e){ if(e.target===tocOv) tocOv.classList.remove('open'); });

  var book, rend;

  // Fetch manuel → ArrayBuffer → ePub(buffer)
  // epub.js ne passe pas par archive.request() (bugué avec data:/blob: URLs).
  // Avec un ArrayBuffer, epub.js appelle directement zip.loadAsync() en mémoire.
  fetch(epubUrl, {credentials: 'same-origin'})
    .then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' — vérifier la session admin');
      return r.arrayBuffer();
    })
    .then(function(buffer) {
      try {
        book = ePub(buffer);
        rend = book.renderTo('viewer', {width:'100%',height:'100%',allowScriptedContent:false,spread:'none'});

        book.on('openFailed', function(e){ showErr('Fichier non accessible. '+(e&&e.message||'')); });

        rend.display().then(function(){
          loading.style.display='none';
        }).catch(function(e){ showErr('Erreur de rendu : '+(e&&e.message||e)); });

        book.loaded.navigation.then(function(nav){
          buildToc(nav.toc, tocList, 0);
        }).catch(function(){});

        rend.on('rendered', function(section){
          loading.style.display='none';
          book.loaded.navigation.then(function(nav){
            var ch = nav.get(section.href);
            chapEl.textContent = ch ? ch.label.trim() : 'Lecture en cours';
          }).catch(function(){ chapEl.textContent='Lecture en cours'; });
        });
      } catch(e){ showErr('Erreur init epub.js : '+e.message); }
    })
    .catch(function(e){ showErr('Erreur chargement : '+(e&&e.message||e)); });

  function buildToc(items, container, depth){
    if(!items||!items.length) return;
    items.forEach(function(item){
      var el = document.createElement('div');
      el.className = 'toc-item'+(depth>0?' sub':'');
      el.textContent = item.label.trim();
      el.onclick = function(){ rend&&rend.display(item.href); tocOv.classList.remove('open'); };
      container.appendChild(el);
      if(item.subitems&&item.subitems.length) buildToc(item.subitems, container, depth+1);
    });
  }

  function showErr(msg){
    loading.style.display='none';
    errBox.style.display='flex';
    errMsg.textContent=msg;
  }

  document.getElementById('prev-btn').onclick = function(){ rend&&rend.prev(); };
  document.getElementById('next-btn').onclick = function(){ rend&&rend.next(); };

  document.addEventListener('keydown', function(e){
    if(!rend) return;
    if(e.key==='ArrowRight') rend.next();
    if(e.key==='ArrowLeft')  rend.prev();
  });
})();
</script>
</body>
</html>`);
  } catch (e) {
    res.status(500).send(`<p style="color:red;font-family:sans-serif;padding:20px">Erreur : ${e.message}</p>`);
  }
});

// ── Création de contenu éditeur ───────────────────────────────────────────────
// Crée un `contents` + `publisher_books` (validation_status = pending)
// Relie au flow existant : le contenu apparaît dans ContentValidation pour approbation
adminUtilRouter.post('/api/publisher-content', requireAdminSession, express.json(), async (req, res) => {
  try {
    const { publisherId, title, author, description, language, contentType, coverUrl, fileKey, audioFileKey, durationSeconds } = req.body;
    if (!publisherId || !title) return res.status(400).json({ error: 'publisherId et title requis' });
    const result = await publisherService.submitBook(publisherId, {
      title, author, description,
      language: language || 'fr',
      coverUrl:      coverUrl      || null,
      fileKey:       fileKey       || null,
      audioFileKey:  audioFileKey  || null,
      contentType:   contentType   || 'ebook',
      durationSeconds: durationSeconds || null,
    });
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

/**
 * GET /admin/invoice-token/:token
 * HTML launcher: validates the token (without consuming it) and returns a page
 * that opens the PDF in a new tab then redirects the admin back to /admin.
 * This prevents AdminJS's redirectUrl from navigating away from the panel.
 */
adminUtilRouter.get('/invoice-token/:token', (req, res) => {
  const token = req.params.token;
  const entry = peekToken(token);

  if (!entry) {
    return res.status(410).send(
      '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Lien expiré</title>' +
      '<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f5f5}' +
      '.card{background:white;padding:2rem 3rem;border-radius:10px;box-shadow:0 2px 12px rgba(0,0,0,.1);text-align:center}' +
      'a{color:#B5651D}</style></head>' +
      '<body><div class="card"><h2>Lien expiré</h2>' +
      '<p>Ce lien de prévisualisation a expiré (60 s) ou a déjà été utilisé.</p>' +
      '<p><a href="/admin">← Retour au panel admin</a></p></div></body></html>'
    );
  }

  const pdfUrl = `/admin/invoice-pdf/${token}`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Facture PDF — Papyri</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           display: flex; align-items: center; justify-content: center;
           min-height: 100vh; margin: 0; background: #f5f5f5; }
    .card { background: white; padding: 2.5rem 3.5rem; border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,.12); text-align: center; max-width: 440px; }
    h2   { margin: 0 0 .5rem; color: #2E4057; font-size: 1.4rem; }
    p    { color: #666; margin: 0 0 1.5rem; line-height: 1.5; }
    .btn-primary { display: inline-block; padding: .75rem 2rem; background: #B5651D;
                   color: white; text-decoration: none; border-radius: 8px;
                   font-size: 1rem; font-weight: 600; }
    .btn-primary:hover { background: #9a4e15; }
    .btn-back { display: inline-block; margin-top: 1rem; font-size: .875rem;
                color: #888; cursor: pointer; background: none; border: none;
                text-decoration: underline; font-family: inherit; }
    .status { margin-top: 1rem; font-size: .8rem; color: #aaa; min-height: 1.2em; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Facture PDF prête</h2>
    <p>La facture s'ouvre dans un nouvel onglet.<br>Vous serez redirigé automatiquement.</p>
    <a href="${pdfUrl}" target="_blank" id="pdfLink" class="btn-primary">Ouvrir la facture</a>
    <br>
    <button class="btn-back" onclick="window.location.href='/admin'">← Retour au panel admin</button>
    <p class="status" id="status"></p>
  </div>
  <script>
    (function () {
      var link   = document.getElementById('pdfLink');
      var status = document.getElementById('status');
      // Small delay so the page paints before we trigger the new-tab open
      setTimeout(function () {
        try {
          link.click();
          status.textContent = 'Facture ouverte. Redirection dans 2 s…';
          setTimeout(function () { window.location.href = '/admin'; }, 2000);
        } catch (e) {
          status.textContent = 'Cliquez sur le bouton pour ouvrir la facture.';
        }
      }, 300);
    })();
  </script>
</body>
</html>`);
});

/**
 * GET /admin/invoice-pdf/:token
 * Serves the actual PDF bytes (single-use — consumes the token).
 * Called from the HTML launcher page via target="_blank".
 */
adminUtilRouter.get('/invoice-pdf/:token', (req, res) => {
  const entry = consumeToken(req.params.token);
  if (!entry) {
    return res.status(410).send(
      '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Lien expiré</title>' +
      '<style>body{font-family:sans-serif;padding:2rem}</style></head>' +
      '<body><h2>Lien expiré</h2><p>Ce lien PDF a expiré ou a déjà été téléchargé. ' +
      'Générez un nouvel aperçu depuis le panel admin.</p></body></html>'
    );
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${entry.filename}"`);
  res.setHeader('Content-Length', entry.buffer.length);
  res.send(entry.buffer);
});

/**
 * GET /admin/invoice-preview-data
 * Returns current app_settings as JSON for the InvoicePreview component.
 * No auth — data is non-sensitive (company info / colors).
 */
adminUtilRouter.get('/invoice-preview-data', async (req, res) => {
  try {
    const settings = await getSettings();
    res.json(settings);
  } catch (err) {
    console.error('invoice-preview-data error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /admin/invoice-preview-pdf
 * Generates a sample invoice PDF with current settings, stores a one-time token,
 * and redirects to /admin/invoice-pdf/:token (opens the PDF in the browser).
 * Called from the InvoicePreview component "Télécharger PDF" button in a new tab.
 */
adminUtilRouter.get('/invoice-preview-pdf', async (req, res) => {
  try {
    const settings = await getSettings();

    const now = new Date().toISOString();
    const samplePayment = {
      id: '00000000-0000-0000-0000-sample000001',
      amount: 9.99,
      currency: 'USD',
      status: 'succeeded',
      provider: 'stripe',
      provider_payment_id: 'pi_sample_preview',
      paid_at: now,
      created_at: now,
      metadata: { payment_type: 'subscription_initial', plan_name: 'Plan Solo Mensuel' },
    };
    const sampleUser = { email: 'client@exemple.com', full_name: 'Nom du Client' };

    const prefix = settings.invoice_prefix || 'INV';
    const invoiceNumber = buildInvoiceNumber(samplePayment.id, now, prefix);
    const filename = `apercu-${invoiceNumber}.pdf`;

    const buffer = await generateInvoicePDFBuffer({
      payment: samplePayment,
      user: sampleUser,
      subscription: null,
      settings,
    });

    const token = storeToken(buffer, filename);
    res.redirect(`/admin/invoice-pdf/${token}`);
  } catch (err) {
    console.error('invoice-preview-pdf error:', err.message);
    res.status(500).send(`<html><body><p>Erreur : ${err.message}</p></body></html>`);
  }
});

module.exports = setupAdminJS;
module.exports.adminUtilRouter = adminUtilRouter;
module.exports.requireAdminSession = requireAdminSession;
module.exports.adminSessionGuard = [adminSessionMiddleware, requireAdminSession];
