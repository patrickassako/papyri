/**
 * Admin Subscriptions Module Routes
 * Mounted on /api/admin/subscriptions-module
 * Protected: admin only
 */

const express = require('express');
const router  = express.Router();
const { verifyJWT, requireRole } = require('../middleware/auth');
const { supabaseAdmin } = require('../config/database');

const isAdmin = [verifyJWT, requireRole('admin')];

// ─────────────────────────────────────────────────────────────
// GET /stats  — global KPIs
// ─────────────────────────────────────────────────────────────
router.get('/stats', isAdmin, async (req, res) => {
  try {
    // Active subscriptions
    const { count: activeCount } = await supabaseAdmin
      .from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE');

    // Total subscriptions ever
    const { count: totalCount } = await supabaseAdmin
      .from('subscriptions').select('*', { count: 'exact', head: true });

    // Cancelled
    const { count: cancelledCount } = await supabaseAdmin
      .from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'CANCELLED');

    // Expired
    const { count: expiredCount } = await supabaseAdmin
      .from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'EXPIRED');

    // Total revenue (succeeded payments)
    const { data: payments } = await supabaseAdmin
      .from('payments')
      .select('amount, currency')
      .eq('status', 'succeeded');

    const totalRevenue = (payments || []).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const revenueThisMonth = (payments || [])
      .filter(p => {
        // no paid_at on payment rows here; approximate using all
        return true;
      })
      .reduce((s, p) => s + 0, 0); // placeholder — we need paid_at

    // Revenue by month (last 6 months)
    const { data: paymentsWithDate } = await supabaseAdmin
      .from('payments')
      .select('amount, currency, paid_at')
      .eq('status', 'succeeded')
      .not('paid_at', 'is', null)
      .order('paid_at', { ascending: false });

    const now   = new Date();
    const monthly = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthly[key] = 0;
    }
    for (const p of (paymentsWithDate || [])) {
      const d = new Date(p.paid_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (key in monthly) monthly[key] += parseFloat(p.amount) || 0;
    }

    // By provider
    const { data: byProvider } = await supabaseAdmin
      .from('subscriptions')
      .select('provider')
      .eq('status', 'ACTIVE');

    const providerMap = {};
    for (const s of (byProvider || [])) {
      providerMap[s.provider || 'unknown'] = (providerMap[s.provider || 'unknown'] || 0) + 1;
    }

    // New this month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { count: newThisMonth } = await supabaseAdmin
      .from('subscriptions')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfMonth);

    return res.json({
      activeCount:   activeCount  || 0,
      totalCount:    totalCount   || 0,
      cancelledCount:cancelledCount || 0,
      expiredCount:  expiredCount || 0,
      newThisMonth:  newThisMonth || 0,
      totalRevenue:  Math.round(totalRevenue * 100) / 100,
      monthlyRevenue: Object.entries(monthly).map(([month, revenue]) => ({ month, revenue: Math.round(revenue * 100) / 100 })),
      byProvider: providerMap,
    });
  } catch (err) {
    console.error('[admin.subs] GET /stats error:', err);
    return res.status(500).json({ error: 'Erreur statistiques.' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /plans  — all plans with subscriber counts
// ─────────────────────────────────────────────────────────────
router.get('/plans', isAdmin, async (req, res) => {
  try {
    const { data: plans, error } = await supabaseAdmin
      .from('subscription_plans')
      .select('*')
      .order('base_price_cents', { ascending: true });
    if (error) throw error;

    // Count active subscribers per plan
    const planIds = (plans || []).map(p => p.id);
    let subCounts = {};
    if (planIds.length > 0) {
      const { data: subs } = await supabaseAdmin
        .from('subscriptions')
        .select('plan_id, status')
        .in('plan_id', planIds);
      for (const s of (subs || [])) {
        if (!subCounts[s.plan_id]) subCounts[s.plan_id] = { active: 0, total: 0 };
        subCounts[s.plan_id].total += 1;
        if (s.status === 'ACTIVE') subCounts[s.plan_id].active += 1;
      }
    }

    const result = (plans || []).map(p => ({
      ...p,
      activeSubscribers: subCounts[p.id]?.active || 0,
      totalSubscribers:  subCounts[p.id]?.total  || 0,
    }));

    return res.json(result);
  } catch (err) {
    console.error('[admin.subs] GET /plans error:', err);
    return res.status(500).json({ error: 'Erreur chargement plans.' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /plans  — create a plan
// ─────────────────────────────────────────────────────────────
router.post('/plans', isAdmin, express.json(), async (req, res) => {
  try {
    const {
      slug, display_name, description,
      base_price_cents, currency,
      duration_days, included_users,
      text_quota_per_user, audio_quota_per_user,
      is_active,
    } = req.body;

    if (!slug || !display_name || !base_price_cents || !duration_days) {
      return res.status(400).json({ error: 'slug, display_name, base_price_cents et duration_days sont requis.' });
    }

    const { data, error } = await supabaseAdmin
      .from('subscription_plans')
      .insert({
        slug,
        display_name,
        description: description || null,
        base_price_cents: parseInt(base_price_cents),
        currency: currency || 'EUR',
        duration_days: parseInt(duration_days),
        included_users: parseInt(included_users) || 1,
        text_quota_per_user:  parseInt(text_quota_per_user)  || 0,
        audio_quota_per_user: parseInt(audio_quota_per_user) || 0,
        is_active: is_active !== false,
      })
      .select()
      .single();
    if (error) throw error;

    return res.status(201).json(data);
  } catch (err) {
    console.error('[admin.subs] POST /plans error:', err);
    if (err.code === '23505') return res.status(409).json({ error: 'Un plan avec ce slug existe déjà.' });
    return res.status(500).json({ error: 'Erreur création plan.' });
  }
});

// ─────────────────────────────────────────────────────────────
// PUT /plans/:id  — update a plan
// ─────────────────────────────────────────────────────────────
router.put('/plans/:id', isAdmin, express.json(), async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = ['display_name', 'description', 'base_price_cents', 'currency',
                     'duration_days', 'included_users', 'text_quota_per_user',
                     'audio_quota_per_user', 'is_active'];
    const patch = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) patch[k] = req.body[k];
    }

    const { data, error } = await supabaseAdmin
      .from('subscription_plans')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    return res.json(data);
  } catch (err) {
    console.error('[admin.subs] PUT /plans/:id error:', err);
    return res.status(500).json({ error: 'Erreur mise à jour plan.' });
  }
});

// ─────────────────────────────────────────────────────────────
// PATCH /plans/:id/toggle  — activate / deactivate
// ─────────────────────────────────────────────────────────────
router.patch('/plans/:id/toggle', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { data: current } = await supabaseAdmin
      .from('subscription_plans').select('is_active').eq('id', id).single();
    if (!current) return res.status(404).json({ error: 'Plan introuvable.' });

    const { data, error } = await supabaseAdmin
      .from('subscription_plans')
      .update({ is_active: !current.is_active, updated_at: new Date().toISOString() })
      .eq('id', id).select().single();
    if (error) throw error;

    return res.json(data);
  } catch (err) {
    console.error('[admin.subs] PATCH /plans/:id/toggle error:', err);
    return res.status(500).json({ error: 'Erreur toggle plan.' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /subscribers  — paginated list with filters
// ─────────────────────────────────────────────────────────────
router.get('/subscribers', isAdmin, async (req, res) => {
  try {
    const planId   = req.query.planId   || '';
    const status   = req.query.status   || '';  // ACTIVE | EXPIRED | CANCELLED | INACTIVE
    const provider = req.query.provider || '';  // stripe | flutterwave
    const search   = (req.query.search  || '').trim();
    const sortBy   = req.query.sort     || 'recent'; // recent | amount | name
    const page     = Math.max(1, parseInt(req.query.page)  || 1);
    const limit    = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
    const offset   = (page - 1) * limit;

    let query = supabaseAdmin
      .from('subscriptions')
      .select('id, user_id, plan_id, plan_type, amount, currency, status, provider, current_period_start, current_period_end, cancel_at_period_end, created_at, plan_snapshot', { count: 'exact' });

    if (planId)   query = query.eq('plan_id', planId);
    if (status)   query = query.eq('status', status);
    if (provider) query = query.eq('provider', provider);

    const orderCol = sortBy === 'amount' ? 'amount' : 'created_at';
    query = query.order(orderCol, { ascending: false });

    const { data: subs, count, error } = await query.range(offset, offset + limit - 1);
    if (error) throw error;

    if (!subs || subs.length === 0) return res.json({ subscribers: [], total: 0 });

    // Fetch user profiles
    const userIds = [...new Set(subs.map(s => s.user_id))];
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .in('id', userIds);

    const profileMap = {};
    for (const p of (profiles || [])) profileMap[p.id] = p;

    // Fetch plan names for those without plan_id (legacy)
    const planIds = [...new Set(subs.filter(s => s.plan_id).map(s => s.plan_id))];
    const { data: plans } = planIds.length > 0
      ? await supabaseAdmin.from('subscription_plans').select('id, display_name, slug').in('id', planIds)
      : { data: [] };
    const planMap = {};
    for (const p of (plans || [])) planMap[p.id] = p;

    let subscribers = subs.map(s => ({
      ...s,
      user: profileMap[s.user_id] || { full_name: 'Inconnu', email: '', avatar_url: null },
      plan: planMap[s.plan_id] || { display_name: s.plan_snapshot?.display_name || s.plan_type || '—', slug: s.plan_type || '' },
    }));

    // Search filter (client-side on fetched data — approximate)
    if (search) {
      const q = search.toLowerCase();
      subscribers = subscribers.filter(s =>
        s.user.full_name?.toLowerCase().includes(q) ||
        s.user.email?.toLowerCase().includes(q)
      );
    }

    return res.json({ subscribers, total: search ? subscribers.length : (count || 0) });
  } catch (err) {
    console.error('[admin.subs] GET /subscribers error:', err);
    return res.status(500).json({ error: 'Erreur chargement abonnés.' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /export?format=csv|pdf&planId=&status=
// Export subscribers list
// ─────────────────────────────────────────────────────────────
router.get('/export', isAdmin, async (req, res) => {
  try {
    const format   = req.query.format   || 'csv';
    const planId   = req.query.planId   || '';
    const status   = req.query.status   || '';
    const provider = req.query.provider || '';

    // Fetch all matching subscriptions (no pagination)
    let query = supabaseAdmin
      .from('subscriptions')
      .select('id, user_id, plan_id, plan_type, amount, currency, status, provider, current_period_start, current_period_end, created_at, plan_snapshot')
      .order('created_at', { ascending: false });

    if (planId)   query = query.eq('plan_id', planId);
    if (status)   query = query.eq('status', status);
    if (provider) query = query.eq('provider', provider);

    const { data: subs, error } = await query;
    if (error) throw error;

    const userIds = [...new Set((subs || []).map(s => s.user_id))];
    const { data: profiles } = userIds.length > 0
      ? await supabaseAdmin.from('profiles').select('id, full_name, email').in('id', userIds)
      : { data: [] };
    const profileMap = {};
    for (const p of (profiles || [])) profileMap[p.id] = p;

    const planIds = [...new Set((subs || []).filter(s => s.plan_id).map(s => s.plan_id))];
    const { data: plans } = planIds.length > 0
      ? await supabaseAdmin.from('subscription_plans').select('id, display_name').in('id', planIds)
      : { data: [] };
    const planMap = {};
    for (const p of (plans || [])) planMap[p.id] = p;

    const rows = (subs || []).map(s => ({
      id:           s.id,
      nom:          profileMap[s.user_id]?.full_name || 'Inconnu',
      email:        profileMap[s.user_id]?.email     || '',
      plan:         planMap[s.plan_id]?.display_name || s.plan_snapshot?.display_name || s.plan_type || '—',
      montant:      s.amount,
      devise:       s.currency,
      statut:       s.status,
      provider:     s.provider || '',
      debut:        s.current_period_start ? new Date(s.current_period_start).toLocaleDateString('fr-FR') : '',
      fin:          s.current_period_end   ? new Date(s.current_period_end).toLocaleDateString('fr-FR')   : '',
      inscrit_le:   new Date(s.created_at).toLocaleDateString('fr-FR'),
    }));

    if (format === 'csv') {
      const headers = ['id', 'nom', 'email', 'plan', 'montant', 'devise', 'statut', 'provider', 'debut', 'fin', 'inscrit_le'];
      const csvLines = [
        headers.join(';'),
        ...rows.map(r => headers.map(h => `"${String(r[h] || '').replace(/"/g, '""')}"`).join(';')),
      ];
      const csv = csvLines.join('\r\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="abonnes-${Date.now()}.csv"`);
      return res.send('\uFEFF' + csv); // BOM for Excel
    }

    if (format === 'pdf') {
      const PDFDocument = require('pdfkit');
      const { getSettings } = require('../services/settings.service');

      // Helper: fetch a remote image as Buffer
      function fetchImageBuffer(url) {
        return new Promise((resolve, reject) => {
          const lib = url.startsWith('https') ? require('https') : require('http');
          lib.get(url, (imgRes) => {
            const chunks = [];
            imgRes.on('data', c => chunks.push(c));
            imgRes.on('end',  () => resolve(Buffer.concat(chunks)));
            imgRes.on('error', reject);
          }).on('error', reject);
        });
      }

      const settings = await getSettings();
      const logoUrl  = settings.invoice_logo_url || '';
      const companyName = settings.company_name || 'Papyri';

      const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="abonnes-${Date.now()}.pdf"`);
      doc.pipe(res);

      // ── Header ──────────────────────────────────────────────
      const pageW   = doc.page.width;   // ~841 landscape
      const headerY = 30;
      const logoH   = 44;

      if (logoUrl) {
        try {
          const logoBuf = await fetchImageBuffer(logoUrl);
          doc.image(logoBuf, 40, headerY, { height: logoH, fit: [140, logoH] });
        } catch (_) { /* logo unavailable — skip */ }
      }

      // Title block (right-aligned so it doesn't overlap logo)
      const titleX = logoUrl ? 200 : 40;
      const titleW = pageW - titleX - 40;
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#2E4057')
        .text('Export Abonnements', titleX, headerY + 4, { width: titleW, align: logoUrl ? 'right' : 'center' });
      doc.fontSize(9).font('Helvetica').fillColor('#888')
        .text(
          `${companyName}  ·  Généré le ${new Date().toLocaleDateString('fr-FR')}  ·  ${rows.length} abonnement(s)`,
          titleX, headerY + 24, { width: titleW, align: logoUrl ? 'right' : 'center' }
        );

      // Separator line
      const lineY = headerY + logoH + 10;
      doc.moveTo(40, lineY).lineTo(pageW - 40, lineY).strokeColor('#e0dbd5').lineWidth(1).stroke();
      doc.y = lineY + 10;
      doc.moveDown(0.2);

      // Table header
      const cols   = [180, 180, 100, 60, 60, 70, 80, 90];
      const labels = ['Nom', 'Email', 'Plan', 'Montant', 'Statut', 'Provider', 'Début', 'Fin'];
      let x = 40;
      const tableHeaderY = doc.y;

      doc.rect(40, tableHeaderY, cols.reduce((a, b) => a + b, 0), 18).fill('#2E4057');
      doc.fillColor('#fff').fontSize(9).font('Helvetica-Bold');
      labels.forEach((label, i) => {
        doc.text(label, x + 3, tableHeaderY + 5, { width: cols[i] - 6, lineBreak: false });
        x += cols[i];
      });

      // Rows
      let rowY = tableHeaderY + 20;
      doc.font('Helvetica').fontSize(8);

      rows.forEach((r, idx) => {
        if (rowY > 510) {
          doc.addPage();
          rowY = 40;
        }
        const bg = idx % 2 === 0 ? '#F7F6F3' : '#ffffff';
        doc.rect(40, rowY, cols.reduce((a, b) => a + b, 0), 16).fill(bg);

        const values = [r.nom, r.email, r.plan, `${r.montant} ${r.devise}`, r.statut, r.provider, r.debut, r.fin];
        x = 40;
        doc.fillColor('#1a1a2e');
        values.forEach((val, i) => {
          doc.text(String(val || ''), x + 3, rowY + 4, { width: cols[i] - 6, lineBreak: false, ellipsis: true });
          x += cols[i];
        });
        rowY += 16;
      });

      doc.end();
      return;
    }

    return res.status(400).json({ error: 'Format non supporté. Utiliser csv ou pdf.' });
  } catch (err) {
    console.error('[admin.subs] GET /export error:', err);
    return res.status(500).json({ error: 'Erreur export.' });
  }
});

module.exports = router;
