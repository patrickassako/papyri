/**
 * Admin General Routes — /api/admin/*
 * Global KPI stats + user management
 * Protected by verifyJWT + requireRole('admin')
 */

const express = require('express');
const multer  = require('multer');
const path    = require('path');
const router  = express.Router();
const { verifyJWT, requirePermission } = require('../middleware/auth');
const { supabaseAdmin } = require('../config/database');
const publisherService  = require('../services/publisher.service');
const r2Service         = require('../services/r2.service');
const config            = require('../config/env');
const { extractMetadata } = require('../services/metadata-extractor.service');
const { logResourceUpdated } = require('../services/audit.service');

// Helpers par domaine de permission (admin bypass automatique dans requirePermission)
const dashRead    = [verifyJWT, requirePermission('dashboard.read')];
const usersRead   = [verifyJWT, requirePermission('users.read')];
const usersWrite  = [verifyJWT, requirePermission('users.write')];
const subsRead    = [verifyJWT, requirePermission('subscriptions.read')];
const subsWrite   = [verifyJWT, requirePermission('subscriptions.write')];
const subsExtend  = [verifyJWT, requirePermission('subscriptions.extend')];
const subsCancel  = [verifyJWT, requirePermission('subscriptions.cancel')];
const contentRead = [verifyJWT, requirePermission('content.read')];
const contentWrite= [verifyJWT, requirePermission('content.write')];
const contentDel  = [verifyJWT, requirePermission('content.delete')];
const geoRead     = [verifyJWT, requirePermission('geo_pricing.read')];
const geoWrite    = [verifyJWT, requirePermission('geo_pricing.write')];
const catRead     = [verifyJWT, requirePermission('categories.read')];
const gdprRead    = [verifyJWT, requirePermission('gdpr.read')];
const gdprWrite   = [verifyJWT, requirePermission('gdpr.write')];

// ── Global Dashboard Stats ────────────────────────────────────────────────────

router.get('/stats', ...dashRead, async (req, res) => {
  try {
    const [
      usersTotal, usersActive, usersBlocked, newUsersMonth,
      subsActive, subsExpired, subsCancelled, subsRevenue,
      contentsTotal, contentsEbooks, contentsAudiobooks, contentsPublished,
      categoriesCount, rightsHoldersCount,
      readingTotal, readingCompleted, readingTime,
      recentSubs, monthlySignupsRaw,
    ] = await Promise.all([
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('is_active', false),
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),

      supabaseAdmin.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
      supabaseAdmin.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'EXPIRED'),
      supabaseAdmin.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'CANCELLED'),
      supabaseAdmin.from('subscriptions').select('amount, currency').in('status', ['ACTIVE', 'EXPIRED', 'CANCELLED']),

      supabaseAdmin.from('contents').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('contents').select('*', { count: 'exact', head: true }).eq('content_type', 'ebook'),
      supabaseAdmin.from('contents').select('*', { count: 'exact', head: true }).eq('content_type', 'audiobook'),
      supabaseAdmin.from('contents').select('*', { count: 'exact', head: true }).eq('is_published', true),

      supabaseAdmin.from('categories').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('rights_holders').select('*', { count: 'exact', head: true }),

      supabaseAdmin.from('reading_history').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('reading_history').select('*', { count: 'exact', head: true }).eq('is_completed', true),
      supabaseAdmin.from('reading_history').select('total_time_seconds'),

      supabaseAdmin.from('subscriptions')
        .select('id, user_id, plan_type, amount, currency, status, created_at')
        .order('created_at', { ascending: false }).limit(5),

      supabaseAdmin.from('profiles')
        .select('created_at')
        .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1).toISOString())
        .order('created_at', { ascending: true }),
    ]);

    // Revenue
    let totalRevenueCents = 0;
    let currency = 'XAF';
    if (subsRevenue.data) {
      subsRevenue.data.forEach(s => {
        totalRevenueCents += (s.amount || 0);
        if (s.currency) currency = s.currency;
      });
    }

    // Reading time
    let totalTimeSeconds = 0;
    if (readingTime.data) readingTime.data.forEach(r => { totalTimeSeconds += (r.total_time_seconds || 0); });

    // Monthly signups (6 months)
    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    const now = new Date();
    const monthlySignups = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      let count = 0;
      if (monthlySignupsRaw.data) {
        count = monthlySignupsRaw.data.filter(p => {
          const pd = new Date(p.created_at);
          return `${pd.getFullYear()}-${pd.getMonth()}` === key;
        }).length;
      }
      monthlySignups.push({ month: monthNames[d.getMonth()], count });
    }

    // Enrich recent subscriptions
    let recentSubscriptions = [];
    if (recentSubs.data && recentSubs.data.length > 0) {
      const userIds = [...new Set(recentSubs.data.map(s => s.user_id))];
      const { data: profiles } = await supabaseAdmin
        .from('profiles').select('id, email, full_name').in('id', userIds);
      const pm = {};
      if (profiles) profiles.forEach(p => { pm[p.id] = p; });
      recentSubscriptions = recentSubs.data.map(s => ({
        user_email: pm[s.user_id]?.email || '—',
        user_name: pm[s.user_id]?.full_name || '—',
        plan_type: s.plan_type,
        amount: s.amount ? Math.round(s.amount / 100) : 0,
        currency: s.currency || 'XAF',
        status: s.status,
        created_at: s.created_at,
      }));
    }

    res.json({
      users: {
        total: usersTotal.count || 0,
        active: usersActive.count || 0,
        blocked: usersBlocked.count || 0,
        newThisMonth: newUsersMonth.count || 0,
      },
      subscriptions: {
        active: subsActive.count || 0,
        expired: subsExpired.count || 0,
        cancelled: subsCancelled.count || 0,
        totalRevenue: Math.round(totalRevenueCents / 100),
        currency,
      },
      contents: {
        total: contentsTotal.count || 0,
        ebooks: contentsEbooks.count || 0,
        audiobooks: contentsAudiobooks.count || 0,
        published: contentsPublished.count || 0,
        categories: categoriesCount.count || 0,
        rightsHolders: rightsHoldersCount.count || 0,
      },
      reading: {
        total: readingTotal.count || 0,
        completed: readingCompleted.count || 0,
        totalTimeHours: Math.round(totalTimeSeconds / 3600),
      },
      recentSubscriptions,
      monthlySignups,
    });
  } catch (err) {
    console.error('Admin stats error:', err.message);
    res.status(500).json({ error: 'Erreur chargement statistiques' });
  }
});

// ── User Management ───────────────────────────────────────────────────────────

/** GET /api/admin/users?q=&page=&limit=&role=&is_active= */
router.get('/users', ...usersRead, async (req, res) => {
  try {
    const { q = '', page = 1, limit = 20, role, is_active } = req.query;
    const from = (Number(page) - 1) * Number(limit);
    const to = from + Number(limit) - 1;

    let query = supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, role, is_active, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (q.trim()) {
      query = query.or(`email.ilike.%${q.trim()}%,full_name.ilike.%${q.trim()}%`);
    }
    if (role) {
      query = query.eq('role', role);
    }
    if (is_active !== undefined && is_active !== '') {
      query = query.eq('is_active', is_active === 'true');
    }

    const { data, error, count } = await query;
    if (error) throw error;

    // Enrich with active subscription flag
    let users = data || [];
    if (users.length > 0) {
      const ids = users.map(u => u.id);
      const { data: subs } = await supabaseAdmin
        .from('subscriptions')
        .select('user_id, plan_type, current_period_end')
        .in('user_id', ids)
        .eq('status', 'ACTIVE');
      const subMap = {};
      if (subs) subs.forEach(s => { subMap[s.user_id] = s; });
      users = users.map(u => ({ ...u, subscription: subMap[u.id] || null }));
    }

    res.json({ users, total: count || 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** GET /api/admin/users/search?q= */
router.get('/users/search', ...usersRead, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ users: [] });
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, role, is_active, created_at')
      .or(`email.ilike.%${q}%,full_name.ilike.%${q}%`)
      .order('created_at', { ascending: false })
      .limit(15);
    if (error) throw error;
    res.json({ users: data || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** GET /api/admin/users/:id */
router.get('/users/:id', ...usersRead, async (req, res) => {
  try {
    const { id } = req.params;
    const [profileRes, subRes, unlocksRes, historyRes] = await Promise.all([
      supabaseAdmin.from('profiles').select('id, email, full_name, role, is_active, created_at').eq('id', id).single(),
      supabaseAdmin.from('subscriptions').select('id, status, plan_type, current_period_start, current_period_end, amount, currency, created_at').eq('user_id', id).eq('status', 'ACTIVE').maybeSingle(),
      supabaseAdmin.from('content_unlocks')
        .select('id, source, unlocked_at, metadata, contents(id, title, author, cover_url, content_type, access_type)')
        .eq('user_id', id).order('unlocked_at', { ascending: false }),
      supabaseAdmin.from('reading_history')
        .select('id, progress_percent, total_time_seconds, is_completed, last_read_at, completed_at, contents(id, title, author, cover_url, content_type)')
        .eq('user_id', id).order('last_read_at', { ascending: false }),
    ]);
    if (!profileRes.data) return res.status(404).json({ error: 'Utilisateur introuvable.' });
    res.json({ profile: profileRes.data, subscription: subRes.data || null, unlocks: unlocksRes.data || [], history: historyRes.data || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** PATCH /api/admin/users/:id */
router.patch('/users/:id', ...usersWrite, express.json(), async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;
    const { full_name, role, is_active } = req.body;

    // ── Guard: fetch current profile before any modification ──────────────────
    const { data: current, error: fetchErr } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, role, is_active')
      .eq('id', id)
      .single();
    if (fetchErr || !current) return res.status(404).json({ error: 'Utilisateur introuvable.' });

    // ── Guard: self-demotion ───────────────────────────────────────────────────
    if (id === adminId && role !== undefined && role !== 'admin') {
      return res.status(403).json({
        error: 'Vous ne pouvez pas retirer votre propre rôle admin.',
      });
    }

    // ── Guard: self-deactivation ───────────────────────────────────────────────
    if (id === adminId && is_active === false) {
      return res.status(403).json({
        error: 'Vous ne pouvez pas désactiver votre propre compte.',
      });
    }

    // ── Guard: last admin protection ──────────────────────────────────────────
    if (role !== undefined && role !== 'admin' && current.role === 'admin') {
      const { count } = await supabaseAdmin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'admin')
        .eq('is_active', true);
      if (count <= 1) {
        return res.status(403).json({
          error: 'Impossible — cet utilisateur est le dernier administrateur actif.',
        });
      }
    }

    // ── Apply updates ─────────────────────────────────────────────────────────
    const updates = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (role      !== undefined) updates.role      = role;
    if (is_active !== undefined) updates.is_active = is_active;
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'Aucun champ à modifier.' });

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select('id, email, full_name, role, is_active, created_at')
      .single();
    if (error) throw error;

    // ── Audit trail ───────────────────────────────────────────────────────────
    await logResourceUpdated(
      adminId,
      'profiles',
      id,
      { role: current.role, is_active: current.is_active, full_name: current.full_name },
      { role: data.role,    is_active: data.is_active,    full_name: data.full_name },
      { ip_address: req.headers['x-forwarded-for'] || req.ip, target_email: data.email },
    );

    res.json({ success: true, profile: data });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

/** POST /api/admin/users/:id/grant-book */
router.post('/users/:id/grant-book', ...usersWrite, express.json(), async (req, res) => {
  try {
    const { contentId } = req.body;
    const userId = req.params.id;
    if (!contentId) return res.status(400).json({ error: 'contentId requis.' });
    const { data, error } = await supabaseAdmin.from('content_unlocks')
      .upsert({ user_id: userId, content_id: contentId, source: 'admin_grant', unlocked_at: new Date().toISOString(), metadata: { granted_by: 'admin' } }, { onConflict: 'user_id,content_id' })
      .select('*, contents(id, title, author, cover_url, content_type, access_type)').single();
    if (error) throw error;
    res.json({ success: true, unlock: data });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

/** DELETE /api/admin/users/unlocks/:unlockId */
router.delete('/users/unlocks/:unlockId', ...usersWrite, async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('content_unlocks').delete().eq('id', req.params.unlockId);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

/** POST /api/admin/subscriptions/extend */
router.post('/subscriptions/extend', ...subsExtend, express.json(), async (req, res) => {
  try {
    const { userId, months } = req.body;
    if (!userId || !months) return res.status(400).json({ error: 'userId et months requis.' });
    const { data: sub, error: subErr } = await supabaseAdmin
      .from('subscriptions').select('id, current_period_end').eq('user_id', userId).eq('status', 'ACTIVE').maybeSingle();
    if (subErr) throw subErr;
    if (!sub) return res.status(404).json({ error: 'Aucun abonnement actif.' });
    const newEnd = new Date(sub.current_period_end);
    newEnd.setMonth(newEnd.getMonth() + parseInt(months, 10));
    const { data: updated, error: updErr } = await supabaseAdmin
      .from('subscriptions').update({ current_period_end: newEnd.toISOString() }).eq('id', sub.id)
      .select('id, status, plan_type, current_period_start, current_period_end, amount, currency').single();
    if (updErr) throw updErr;
    res.json({ success: true, subscription: updated });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

/** POST /api/admin/subscriptions/cancel/:userId */
router.post('/subscriptions/cancel/:userId', ...subsCancel, async (req, res) => {
  try {
    const { data: sub, error: subErr } = await supabaseAdmin
      .from('subscriptions').select('id').eq('user_id', req.params.userId).eq('status', 'ACTIVE').maybeSingle();
    if (subErr) throw subErr;
    if (!sub) return res.status(404).json({ error: 'Aucun abonnement actif.' });
    const { error } = await supabaseAdmin.from('subscriptions')
      .update({ status: 'CANCELLED', cancelled_at: new Date().toISOString() }).eq('id', sub.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

/** GET /api/admin/plans — liste des forfaits actifs */
router.get('/plans', ...subsRead, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('subscription_plans')
      .select('id, slug, display_name, description, duration_days, base_price_cents, currency, metadata')
      .eq('is_active', true)
      .order('base_price_cents', { ascending: true });
    if (error) throw error;
    res.json({ plans: data || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** PATCH /api/admin/subscriptions/:subId — modifier plan, dates, montant, statut */
router.patch('/subscriptions/:subId', ...subsWrite, express.json(), async (req, res) => {
  try {
    const { plan_type, current_period_end, current_period_start, amount, currency, status } = req.body;
    const updates = {};
    if (plan_type !== undefined) updates.plan_type = plan_type;
    if (current_period_end !== undefined) updates.current_period_end = current_period_end;
    if (current_period_start !== undefined) updates.current_period_start = current_period_start;
    if (amount !== undefined) updates.amount = amount; // en centimes
    if (currency !== undefined) updates.currency = currency;
    if (status !== undefined) {
      updates.status = status;
      if (status === 'CANCELLED') updates.cancelled_at = new Date().toISOString();
    }
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'Aucun champ à modifier.' });

    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .update(updates)
      .eq('id', req.params.subId)
      .select('id, status, plan_type, current_period_start, current_period_end, amount, currency, cancelled_at')
      .single();
    if (error) throw error;
    res.json({ success: true, subscription: data });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

/** DELETE /api/admin/subscriptions/:subId — supprimer définitivement */
router.delete('/subscriptions/:subId', ...subsWrite, async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('subscriptions').delete().eq('id', req.params.subId);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

/** POST /api/admin/subscriptions/create — créer un abonnement manuel */
router.post('/subscriptions/create', ...subsWrite, express.json(), async (req, res) => {
  try {
    console.log('[admin] create subscription body:', JSON.stringify(req.body));
    const { userId, plan_type, current_period_start, current_period_end, amount, currency } = req.body;
    if (!userId || !plan_type || !current_period_end) return res.status(400).json({ error: 'userId, plan_type et current_period_end requis.' });

    // Check if a subscription already exists for this user (any status)
    const { data: existing } = await supabaseAdmin
      .from('subscriptions').select('id').eq('user_id', userId).maybeSingle();

    let data, error;
    const payload = {
      user_id: userId,
      plan_type,
      status: 'ACTIVE',
      current_period_start: current_period_start || new Date().toISOString(),
      current_period_end,
      amount: amount || 0,
      currency: currency || 'XAF',
      cancelled_at: null,
      provider: 'flutterwave', // required NOT NULL — admin subscriptions use flutterwave as default
    };

    if (existing) {
      // Update the existing row instead of inserting a new one
      ({ data, error } = await supabaseAdmin.from('subscriptions')
        .update(payload).eq('id', existing.id)
        .select('id, status, plan_type, current_period_start, current_period_end, amount, currency').single());
    } else {
      ({ data, error } = await supabaseAdmin.from('subscriptions')
        .insert(payload)
        .select('id, status, plan_type, current_period_start, current_period_end, amount, currency').single());
    }
    if (error) { console.error('[admin] supabase subscription error:', error); throw error; }
    res.json({ success: true, subscription: data });
  } catch (e) { console.error('[admin] create sub catch:', e.message); res.status(400).json({ error: e.message }); }
});

/** GET /api/admin/books/:bookId — détails complets d'un livre (publisher_book + content) */
router.get('/books/:bookId', ...contentRead, async (req, res) => {
  try {
    const { bookId } = req.params;
    const { data: pb, error: pbErr } = await supabaseAdmin
      .from('publisher_books')
      .select(`
        id, validation_status, rejection_reason, submitted_at, reviewed_at,
        contents(id, title, author, cover_url, content_type, format, file_key, description, language, is_published, created_at),
        publishers(id, company_name, contact_name, email)
      `)
      .eq('id', bookId)
      .single();
    if (pbErr) { console.error('[admin/books] supabase error:', pbErr); return res.status(500).json({ error: pbErr.message }); }
    if (!pb) return res.status(404).json({ error: 'Livre introuvable.' });
    res.json({ book: pb });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** GET /api/admin/books/:bookId/file — stream du fichier R2 (admin bypass, pas de vérification d'abonnement) */
router.get('/books/:bookId/file', ...contentRead, async (req, res) => {
  try {
    const r2Service = require('../services/r2.service');
    const { bookId } = req.params;
    const { data: pb, error } = await supabaseAdmin
      .from('publisher_books')
      .select('contents(file_key, title, format, content_type)')
      .eq('id', bookId)
      .single();
    if (error || !pb?.contents?.file_key) return res.status(404).json({ error: 'Fichier introuvable.' });
    const { file_key, title, format } = pb.contents;
    const { buffer, contentType } = await r2Service.getObjectBuffer(file_key);
    const ext = format || file_key.split('.').pop() || 'bin';
    const filename = `${(title || 'livre').replace(/[^a-z0-9]/gi, '_')}.${ext}`;
    res.setHeader('Content-Type', contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** PUT /api/admin/books/:bookId/metadata — mise à jour des métadonnées du livre */
router.put('/books/:bookId/metadata', ...contentWrite, express.json(), async (req, res) => {
  try {
    const { bookId } = req.params;
    // Récupérer le content_id lié au publisher_book
    const { data: pb, error: pbErr } = await supabaseAdmin
      .from('publisher_books').select('contents(id)').eq('id', bookId).single();
    if (pbErr || !pb?.contents?.id) return res.status(404).json({ error: 'Livre introuvable.' });
    const contentId = pb.contents.id;

    const allowed = ['title', 'author', 'description', 'language', 'access_type',
      'is_purchasable', 'price_cents', 'price_currency', 'subscription_discount_percent', 'cover_url'];
    const update = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) update[k] = req.body[k];
    }
    if (Object.keys(update).length === 0) return res.status(400).json({ error: 'Aucun champ à modifier.' });
    update.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('contents').update(update).eq('id', contentId).select().single();
    if (error) throw error;
    res.json({ content: data });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── Prix géographiques (JWT admin) ────────────────────────────────────────────

router.get('/content/:contentId/geo-pricing', ...geoRead, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('content_geographic_pricing')
      .select('*').eq('content_id', req.params.contentId).order('zone');
    if (error) throw error;
    res.json({ prices: data || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/content/:contentId/geo-pricing', ...geoWrite, express.json(), async (req, res) => {
  try {
    const { zone, zone_label, price_cents, currency, notes, is_active } = req.body;
    if (!zone || price_cents == null) return res.status(400).json({ error: 'zone et price_cents requis' });
    const { data, error } = await supabaseAdmin.from('content_geographic_pricing')
      .insert({ content_id: req.params.contentId, zone, zone_label: zone_label || zone, price_cents, currency: currency || 'EUR', notes: notes || null, is_active: is_active !== false })
      .select().single();
    if (error) throw error;
    res.json({ price: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/content/geo-pricing/:id', ...geoWrite, async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('content_geographic_pricing').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Restrictions géographiques (JWT admin) ────────────────────────────────────

router.get('/content/:contentId/geo-restrictions', ...geoRead, async (req, res) => {
  try {
    const [cfgRes, zonesRes] = await Promise.all([
      supabaseAdmin.from('content_geo_restriction_config').select('*').eq('content_id', req.params.contentId).maybeSingle(),
      supabaseAdmin.from('content_geo_restrictions').select('*').eq('content_id', req.params.contentId).order('zone'),
    ]);
    res.json({ config: cfgRes.data || null, zones: zonesRes.data || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/content/:contentId/geo-restrictions/config', ...geoWrite, express.json(), async (req, res) => {
  try {
    const { mode } = req.body;
    if (!['blacklist', 'whitelist'].includes(mode)) return res.status(400).json({ error: 'mode invalide' });
    const { data, error } = await supabaseAdmin.from('content_geo_restriction_config')
      .upsert({ content_id: req.params.contentId, mode, updated_at: new Date().toISOString() }, { onConflict: 'content_id' })
      .select().single();
    if (error) throw error;
    res.json({ config: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/content/:contentId/geo-restrictions', ...geoWrite, async (req, res) => {
  try {
    await Promise.all([
      supabaseAdmin.from('content_geo_restriction_config').delete().eq('content_id', req.params.contentId),
      supabaseAdmin.from('content_geo_restrictions').delete().eq('content_id', req.params.contentId),
    ]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/content/:contentId/geo-restrictions/zones', ...geoWrite, express.json(), async (req, res) => {
  try {
    const { zone, zone_label, reason, is_active } = req.body;
    if (!zone) return res.status(400).json({ error: 'zone requis' });
    const { data, error } = await supabaseAdmin.from('content_geo_restrictions')
      .insert({ content_id: req.params.contentId, zone, zone_label: zone_label || zone, reason: reason || null, is_active: is_active !== false })
      .select().single();
    if (error) throw error;
    res.json({ zone: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/content/geo-restrictions/zones/:id', ...geoWrite, express.json(), async (req, res) => {
  try {
    const { is_active, reason } = req.body;
    const update = {};
    if (is_active !== undefined) update.is_active = is_active;
    if (reason    !== undefined) update.reason    = reason;
    const { data, error } = await supabaseAdmin.from('content_geo_restrictions')
      .update(update).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ zone: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/content/geo-restrictions/zones/:id', ...geoWrite, async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('content_geo_restrictions').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** GET /api/admin/contents/search?q= */
router.get('/contents/search', ...contentRead, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ contents: [] });
    const { data, error } = await supabaseAdmin.from('contents')
      .select('id, title, author, cover_url, content_type, access_type')
      .or(`title.ilike.%${q}%,author.ilike.%${q}%`).eq('is_published', true).limit(10);
    if (error) throw error;
    res.json({ contents: data || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Catégories ────────────────────────────────────────────────────────────────

router.get('/categories', ...catRead, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('categories').select('id, name, slug').order('name');
    if (error) throw error;
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Upload couverture (JWT) ───────────────────────────────────────────────────

const uploadCover = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype);
    cb(ok ? null : new Error('Format non supporté. Acceptés: JPG, PNG, WebP'), ok);
  },
});

router.post('/upload-cover', ...contentWrite, uploadCover.single('cover'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier envoyé' });
    if (!r2Service.isConfigured()) return res.status(503).json({ error: 'R2 non configuré' });
    const now = new Date();
    const ext = path.extname(req.file.originalname) || '.jpg';
    const safeName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_').replace(ext, '');
    const fileKey = `covers/${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}/${safeName}_${Date.now()}${ext}`;
    await r2Service.uploadBuffer(req.file.buffer, fileKey, { bucket: config.r2.bucketCovers, contentType: req.file.mimetype, cacheControl: 'public, max-age=31536000' });
    res.json({ success: true, url: r2Service.getPublicUrl(fileKey, config.r2.bucketCovers), key: fileKey });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Upload fichier contenu (JWT) ──────────────────────────────────────────────

const CONTENT_MIMES = { 'application/epub+zip': 'epub', 'application/pdf': 'pdf', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/mp3': 'mp3' };

const uploadContent = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const ext = file.originalname.split('.').pop().toLowerCase();
    const ok = !!CONTENT_MIMES[file.mimetype] || ['epub','pdf','mp3','m4a'].includes(ext);
    cb(ok ? null : new Error('Format non supporté. Acceptés: EPUB, PDF, MP3, M4A'), ok);
  },
});

router.post('/upload-content', ...contentWrite, uploadContent.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier envoyé' });
    if (!r2Service.isConfigured()) return res.status(503).json({ error: 'R2 non configuré' });
    const format  = CONTENT_MIMES[req.file.mimetype] || req.file.originalname.split('.').pop().toLowerCase() || 'bin';
    const isAudio = ['mp3', 'm4a'].includes(format);
    const folder  = isAudio ? 'audiobooks' : 'ebooks';
    const now = new Date();
    const ext = path.extname(req.file.originalname) || `.${format}`;
    const safeName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_').replace(new RegExp(ext.replace('.', '\\.') + '$'), '');
    const fileKey = `${folder}/${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}/${safeName}_${Date.now()}${ext}`;
    await r2Service.uploadBuffer(req.file.buffer, fileKey, { bucket: config.r2.bucketContent, contentType: req.file.mimetype });
    res.json({ success: true, key: fileKey, format, content_type: isAudio ? 'audiobook' : 'ebook', size_bytes: req.file.size });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Extraction de métadonnées (JWT) ──────────────────────────────────────────

const uploadExtract = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const ext = file.originalname.split('.').pop().toLowerCase();
    const ok = ['application/epub+zip','application/pdf','audio/mpeg','audio/mp4','audio/x-m4a','audio/mp3'].includes(file.mimetype) || ['epub','pdf','mp3','m4a'].includes(ext);
    cb(ok ? null : new Error('Format non supporté. Acceptés: EPUB, PDF, MP3, M4A'), ok);
  },
});

router.post('/extract-metadata', ...contentWrite, uploadExtract.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });
    const meta = await extractMetadata(req.file.buffer, req.file.originalname, req.file.mimetype);
    if (meta.error) return res.status(422).json({ error: meta.error });
    let coverUrl = null;
    if (meta.coverBuffer && r2Service.isConfigured()) {
      const now = new Date();
      const ext = meta.coverMime === 'image/png' ? '.png' : '.jpg';
      const fileKey = `covers/${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}/extracted_${Date.now()}${ext}`;
      await r2Service.uploadBuffer(meta.coverBuffer, fileKey, { bucket: config.r2.bucketCovers, contentType: meta.coverMime, cacheControl: 'public, max-age=31536000' });
      coverUrl = r2Service.getPublicUrl(fileKey, config.r2.bucketCovers);
    }
    const { coverBuffer, coverMime, ...metaClean } = meta;
    res.json({ ...metaClean, coverUrl });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Chapitres audio ──────────────────────────────────────────────────────────

router.get('/content/:contentId/chapters', ...contentRead, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('audio_chapters')
      .select('*')
      .eq('content_id', req.params.contentId)
      .order('position', { ascending: true });
    if (error) throw error;
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/content/:contentId/chapters', ...contentWrite, express.json(), async (req, res) => {
  try {
    const { title, fileKey, durationSeconds, position } = req.body;
    if (!fileKey) return res.status(400).json({ error: 'fileKey requis' });
    const { data, error } = await supabaseAdmin
      .from('audio_chapters')
      .insert({ content_id: req.params.contentId, title: title || 'Sans titre', file_key: fileKey, duration_seconds: durationSeconds || null, position: position || 1 })
      .select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/content/chapters/:id', ...contentWrite, express.json(), async (req, res) => {
  try {
    const { title, position } = req.body;
    const updates = {};
    if (title    !== undefined) updates.title    = title;
    if (position !== undefined) updates.position = position;
    const { data, error } = await supabaseAdmin
      .from('audio_chapters').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/content/chapters/:id', ...contentDel, async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('audio_chapters').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Créer contenu éditeur (JWT) ───────────────────────────────────────────────

router.post('/publisher-content', ...contentWrite, express.json(), async (req, res) => {
  try {
    const { publisherId, title, author, description, language, contentType, coverUrl, fileKey, audioFileKey, durationSeconds, chapters, accessType, priceCents } = req.body;
    if (!title) return res.status(400).json({ error: 'title requis' });
    const result = await publisherService.submitBook(publisherId, {
      title, author, description,
      language:        language        || 'fr',
      coverUrl:        coverUrl        || null,
      fileKey:         fileKey         || null,
      audioFileKey:    audioFileKey    || null,
      contentType:     contentType     || 'ebook',
      durationSeconds: durationSeconds || null,
      chapters:        chapters        || null,
      accessType:      accessType      || 'subscription',
      priceCents:      priceCents      || 0,
    });
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── RGPD — demandes de suppression / export ────────────────────────────────────

/**
 * GET /admin/gdpr-requests
 * Liste toutes les demandes RGPD avec infos utilisateur
 */
router.get('/gdpr-requests', ...gdprRead, async (req, res) => {
  try {
    const { status, type, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabaseAdmin
      .from('gdpr_requests')
      .select('id, request_type, status, user_message, admin_notes, deadline_at, created_at, processed_at, user_id', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (status) query = query.eq('status', status);
    if (type) query = query.eq('request_type', type);

    const { data, error, count } = await query;
    if (error) throw error;

    // Fetch profiles separately (gdpr_requests.user_id → auth.users, not public.profiles)
    const userIds = [...new Set((data || []).map(r => r.user_id))];
    let profileMap = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds);
      for (const p of profiles || []) profileMap[p.id] = p;
    }

    const enriched = (data || []).map(r => ({ ...r, profiles: profileMap[r.user_id] || null }));
    res.json({ success: true, data: enriched, total: count || 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * PATCH /admin/gdpr-requests/:id
 * Traiter une demande RGPD (status: processing | completed | rejected)
 * Si completed + deletion → suppression du compte
 */
router.patch('/gdpr-requests/:id', ...gdprWrite, express.json(), async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user?.id;
    const { status, admin_notes } = req.body;

    const validStatuses = ['processing', 'completed', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Statut invalide.' });
    }

    // Get the request
    const { data: request, error: fetchErr } = await supabaseAdmin
      .from('gdpr_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !request) return res.status(404).json({ error: 'Demande introuvable.' });

    // Update status
    const { error: updateErr } = await supabaseAdmin
      .from('gdpr_requests')
      .update({
        status,
        admin_notes: admin_notes || null,
        processed_by: adminId || null,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateErr) throw updateErr;

    // If completed deletion request → execute account deletion
    if (status === 'completed' && request.request_type === 'deletion') {
      const userId = request.user_id;

      await supabaseAdmin.from('subscriptions')
        .update({ status: 'CANCELLED', cancelled_at: new Date().toISOString() })
        .eq('user_id', userId).eq('status', 'ACTIVE');

      await Promise.allSettled([
        supabaseAdmin.from('reading_history').delete().eq('user_id', userId),
        supabaseAdmin.from('user_devices').delete().eq('user_id', userId),
        supabaseAdmin.from('notification_preferences').delete().eq('user_id', userId),
        supabaseAdmin.from('user_notifications').delete().eq('user_id', userId),
      ]);

      await supabaseAdmin.from('profiles').update({
        full_name: 'Compte supprimé',
        avatar_url: null,
        updated_at: new Date().toISOString(),
      }).eq('id', userId);

      await supabaseAdmin.auth.admin.deleteUser(userId);
      console.log(`[RGPD] Compte utilisateur ${userId} supprimé suite à la demande ${id}`);
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/admin/me/permissions ─────────────────────────────────────────────
// Retourne la liste des clés de permissions du user connecté.
// Admin → toutes les permissions. Autre rôle → via role_permissions.
router.get('/me/permissions', verifyJWT, async (req, res) => {
  try {
    const role = req.user.role;

    if (role === 'admin') {
      const { data, error } = await supabaseAdmin
        .from('permissions')
        .select('key');
      if (error) throw error;
      return res.json({ success: true, permissions: (data || []).map(p => p.key), is_admin: true });
    }

    const { data: roleRow } = await supabaseAdmin
      .from('roles')
      .select('id')
      .eq('name', role)
      .maybeSingle();

    if (!roleRow) {
      return res.json({ success: true, permissions: [], is_admin: false });
    }

    const { data: rp } = await supabaseAdmin
      .from('role_permissions')
      .select('permissions(key)')
      .eq('role_id', roleRow.id);

    const keys = (rp || []).map(r => r.permissions?.key).filter(Boolean);
    return res.json({ success: true, permissions: keys, is_admin: false });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
