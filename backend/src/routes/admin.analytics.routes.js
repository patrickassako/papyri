/**
 * Admin Analytics Routes
 * Mounted on /api/admin/analytics
 * Revenue analytics + reading stats
 * Supports ?from=YYYY-MM-DD&to=YYYY-MM-DD filters
 */
const express = require('express');
const router  = express.Router();
const { verifyJWT, requireRole } = require('../middleware/auth');
const { supabaseAdmin } = require('../config/database');
const { getSettings }   = require('../services/settings.service');

const isAdmin = [verifyJWT, requireRole('admin')];

// ─── PDF helpers ───────────────────────────────────────────────
function fetchImageBuffer(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? require('https') : require('http');
    lib.get(url, (imgRes) => {
      const chunks = [];
      imgRes.on('data', c => chunks.push(c));
      imgRes.on('end', () => resolve(Buffer.concat(chunks)));
      imgRes.on('error', reject);
    }).on('error', reject);
  });
}

function buildPdfHeader(doc, settings, title) {
  const pageW    = doc.page.width;
  const C_indigo = '#2E4057';
  const logoUrl  = settings.invoice_logo_url || '';
  if (logoUrl) {
    try { /* logo injected async before call */ } catch (_) {}
  }
  const titleX = logoUrl ? 190 : 40;
  const titleW = pageW - titleX - 40;
  doc.fontSize(17).font('Helvetica-Bold').fillColor(C_indigo)
    .text(title, titleX, 32, { width: titleW, align: logoUrl ? 'right' : 'left' });
  doc.fontSize(9).font('Helvetica').fillColor('#888')
    .text(`${settings.company_name || 'Papyri'}  ·  ${new Date().toLocaleDateString('fr-FR')}`,
      titleX, 54, { width: titleW, align: logoUrl ? 'right' : 'left' });
  doc.moveTo(40, 82).lineTo(pageW - 40, 82).strokeColor('#ddd').lineWidth(1).stroke();
  doc.y = 98;
  return { pageW, logoUrl, titleX, titleW };
}

function sectionTitle(doc, label) {
  const pageW    = doc.page.width;
  const C_indigo = '#2E4057';
  doc.moveDown(0.3);
  doc.fontSize(11).font('Helvetica-Bold').fillColor(C_indigo).text(label, 40, doc.y, { width: pageW - 80 });
  doc.moveTo(40, doc.y).lineTo(pageW - 40, doc.y).strokeColor('#e0dbd5').lineWidth(0.5).stroke();
  doc.moveDown(0.6);
}

function kpiBox(doc, label, value, color, x, y, w) {
  doc.rect(x, y, w, 44).fill(`${color}12`);
  doc.moveTo(x, y).lineTo(x+w, y).strokeColor(`${color}40`).lineWidth(0.5).stroke();
  doc.moveTo(x, y+44).lineTo(x+w, y+44).strokeColor(`${color}40`).lineWidth(0.5).stroke();
  doc.moveTo(x, y).lineTo(x, y+44).strokeColor(`${color}40`).lineWidth(0.5).stroke();
  doc.moveTo(x+w, y).lineTo(x+w, y+44).strokeColor(`${color}40`).lineWidth(0.5).stroke();
  doc.fontSize(15).font('Helvetica-Bold').fillColor(color)
    .text(value, x + 4, y + 6, { width: w - 8, align: 'center', lineBreak: false });
  doc.fontSize(7.5).font('Helvetica').fillColor('#666')
    .text(label, x + 4, y + 28, { width: w - 8, align: 'center', lineBreak: false });
}

function tableRow(doc, cols, widths, x, isHeader = false) {
  const C_indigo = '#2E4057';
  const font   = isHeader ? 'Helvetica-Bold' : 'Helvetica';
  const color  = isHeader ? C_indigo : '#333';
  const size   = isHeader ? 8.5 : 8;
  let cx = x;
  doc.fontSize(size).font(font).fillColor(color);
  for (let i = 0; i < cols.length; i++) {
    doc.text(String(cols[i]), cx, doc.y, { width: widths[i], lineBreak: false });
    cx += widths[i];
  }
  doc.moveDown(0.5);
  if (isHeader) {
    doc.moveTo(x, doc.y).lineTo(x + widths.reduce((a,b)=>a+b,0), doc.y)
      .strokeColor('#e0dbd5').lineWidth(0.5).stroke();
    doc.moveDown(0.2);
  }
}

// ─── Helpers ──────────────────────────────────────────────────
function monthKey(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthsBetween(from, to) {
  const months = [];
  const start = new Date(from);
  const end   = new Date(to);
  const cur   = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur <= end) {
    months.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

function daysBetween(from, to) {
  const days = [];
  const cur  = new Date(from);
  const end  = new Date(to);
  while (cur <= end) {
    days.push(cur.toISOString().split('T')[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function resolveRange(fromQ, toQ, defaultDays = 365) {
  const now = new Date();
  const to  = toQ   ? new Date(toQ)   : now;
  const from = fromQ ? new Date(fromQ) : new Date(now - defaultDays * 24 * 3600 * 1000);
  return {
    from: from.toISOString(),
    to:   to.toISOString(),
    fromDate: from.toISOString().split('T')[0],
    toDate:   to.toISOString().split('T')[0],
  };
}

// ─── GET /revenue/export (PDF) ────────────────────────────────
router.get('/revenue/export', isAdmin, async (req, res) => {
  try {
    const range = resolveRange(req.query.from, req.query.to, 365);
    const { provider: providerFilter, plan: planFilter } = req.query;

    let paymentsQ = supabaseAdmin
      .from('payments')
      .select('amount, currency, provider, paid_at, status, subscription_id')
      .eq('status', 'succeeded')
      .gte('paid_at', range.from)
      .lte('paid_at', range.to);
    if (providerFilter && providerFilter !== 'all') paymentsQ = paymentsQ.eq('provider', providerFilter);

    const [paymentsRes, subsRes, plansRes, settings] = await Promise.all([
      paymentsQ,
      supabaseAdmin.from('subscriptions').select('status, plan_id, cancelled_at'),
      supabaseAdmin.from('subscription_plans').select('id, display_name, base_price_cents, billing_period'),
      getSettings(),
    ]);

    let payments = paymentsRes.data || [];
    const subs   = subsRes.data   || [];
    const plans  = plansRes.data  || [];

    if (planFilter && planFilter !== 'all') {
      const { data: planSubs } = await supabaseAdmin.from('subscriptions').select('id').eq('plan_id', planFilter);
      const subIds = new Set((planSubs || []).map(s => s.id));
      payments = payments.filter(p => subIds.has(p.subscription_id));
    }

    const months = monthsBetween(range.from, range.to);
    const revenueByMonth = {};
    for (const m of months) revenueByMonth[m] = 0;
    for (const p of payments) {
      const m = monthKey(p.paid_at);
      if (revenueByMonth[m] !== undefined) revenueByMonth[m] += Number(p.amount) || 0;
    }
    const totalRevenue  = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const currentMonth  = monthKey(new Date().toISOString());
    const mrr           = revenueByMonth[currentMonth] || 0;
    const arr           = mrr * 12;
    const activeTotal   = subs.filter(s => s.status === 'ACTIVE').length;
    const churned       = subs.filter(s =>
      s.status === 'CANCELLED' && s.cancelled_at &&
      s.cancelled_at >= range.from && s.cancelled_at <= range.to
    ).length;
    const churnRate = activeTotal > 0 ? Math.round((churned / activeTotal) * 100 * 10) / 10 : 0;

    const byProvider = {};
    for (const p of payments) {
      const prov = p.provider || 'unknown';
      byProvider[prov] = (byProvider[prov] || 0) + (Number(p.amount) || 0);
    }

    const activeSubsByPlan = {};
    for (const s of subs) {
      if (s.status !== 'ACTIVE' || !s.plan_id) continue;
      activeSubsByPlan[s.plan_id] = (activeSubsByPlan[s.plan_id] || 0) + 1;
    }
    const byPlan = plans.map(pl => ({
      name:        pl.display_name,
      period:      pl.billing_period,
      activeCount: activeSubsByPlan[pl.id] || 0,
      mrr: ((activeSubsByPlan[pl.id] || 0) * ((pl.base_price_cents || 0) / 100)) /
           (pl.billing_period === 'yearly' ? 12 : 1),
    }));

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'portrait' });
    const filename = `revenus_${range.fromDate}_${range.toDate}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    const pageW    = doc.page.width;
    const C_indigo = '#2E4057';
    const C_green  = '#27ae60';
    const C_orange = '#FF9800';
    const C_prim   = '#B5651D';
    const C_red    = '#e74c3c';

    // Logo
    const logoUrl = settings.invoice_logo_url || '';
    if (logoUrl) {
      try { const lb = await fetchImageBuffer(logoUrl); doc.image(lb, 40, 30, { height: 40, fit: [130, 40] }); } catch (_) {}
    }
    const titleX = logoUrl ? 190 : 40;
    const titleW = pageW - titleX - 40;
    const periodLabel = `${range.fromDate} → ${range.toDate}`;

    doc.fontSize(17).font('Helvetica-Bold').fillColor(C_indigo)
      .text('Analytiques Revenus', titleX, 32, { width: titleW, align: logoUrl ? 'right' : 'left' });
    doc.fontSize(9).font('Helvetica').fillColor('#888')
      .text(`${settings.company_name || 'Papyri'}  ·  Période : ${periodLabel}  ·  ${new Date().toLocaleDateString('fr-FR')}`,
        titleX, 54, { width: titleW, align: logoUrl ? 'right' : 'left' });
    doc.moveTo(40, 82).lineTo(pageW - 40, 82).strokeColor('#ddd').lineWidth(1).stroke();
    doc.y = 98;

    // KPIs
    sectionTitle(doc, 'Résumé financier');
    const kpiY   = doc.y;
    const kpiW   = (pageW - 80 - 16) / 4;
    kpiBox(doc, 'Revenu total', `${totalRevenue.toFixed(2)} €`, C_indigo, 40,            kpiY, kpiW);
    kpiBox(doc, 'MRR',         `${mrr.toFixed(2)} €`,          C_green,  40+kpiW+4,     kpiY, kpiW);
    kpiBox(doc, 'ARR projeté', `${arr.toFixed(2)} €`,          C_prim,   40+kpiW*2+8,   kpiY, kpiW);
    kpiBox(doc, 'Churn (%)',   `${churnRate} %`,                churnRate > 5 ? C_red : C_orange, 40+kpiW*3+12, kpiY, kpiW);
    doc.y = kpiY + 60;

    // Revenu mensuel
    sectionTitle(doc, 'Revenu mensuel');
    const mCols  = ['Mois', 'Revenu (€)'];
    const mWidths = [200, pageW - 280];
    tableRow(doc, mCols, mWidths, 40, true);
    for (const m of months) {
      const label = new Date(m + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      tableRow(doc, [label, (revenueByMonth[m] || 0).toFixed(2)], mWidths, 40);
      if (doc.y > doc.page.height - 80) { doc.addPage(); }
    }
    doc.moveDown(0.5);

    // Par provider
    sectionTitle(doc, 'Par provider de paiement');
    tableRow(doc, ['Provider', 'Montant (€)', 'Transactions'], [150, 150, pageW - 280], 40, true);
    for (const [prov, amount] of Object.entries(byProvider)) {
      const txCount = payments.filter(p => (p.provider || 'unknown') === prov).length;
      tableRow(doc, [prov, amount.toFixed(2), txCount], [150, 150, pageW - 280], 40);
    }
    doc.moveDown(0.5);

    // Par plan
    sectionTitle(doc, 'Par plan d\'abonnement');
    const pCols   = ['Plan', 'Période', 'Abonnés actifs', 'MRR (€)'];
    const pWidths = [180, 120, 120, pageW - 460];
    tableRow(doc, pCols, pWidths, 40, true);
    for (const pl of byPlan) {
      tableRow(doc, [pl.name, pl.period, pl.activeCount, pl.mrr.toFixed(2)], pWidths, 40);
    }

    doc.end();
  } catch (err) {
    console.error('[admin.analytics] GET /revenue/export:', err);
    if (!res.headersSent) return res.status(500).json({ error: 'Erreur export PDF revenus.' });
  }
});

// ─── GET /reading/export (PDF) ────────────────────────────────
router.get('/reading/export', isAdmin, async (req, res) => {
  try {
    const range = resolveRange(req.query.from, req.query.to, 30);
    const { type: typeFilter } = req.query;

    let histQ = supabaseAdmin
      .from('reading_history')
      .select('progress_percent, total_time_seconds, is_completed, content_id, last_read_at')
      .gte('last_read_at', range.from)
      .lte('last_read_at', range.to);

    let topQ = supabaseAdmin
      .from('reading_history')
      .select('content_id, is_completed, progress_percent, total_time_seconds, contents ( id, title, content_type, cover_url )')
      .gte('last_read_at', range.from)
      .lte('last_read_at', range.to)
      .order('last_read_at', { ascending: false });

    const [historyRes, topBooksRes, settings] = await Promise.all([histQ, topQ, getSettings()]);

    let history = historyRes.data || [];
    let topRaw  = topBooksRes.data || [];

    if (typeFilter && typeFilter !== 'all') {
      topRaw  = topRaw.filter(h => h.contents?.content_type === typeFilter);
      history = history.filter(h => topRaw.some(t => t.content_id === h.content_id));
    }

    const totalSessions  = history.length;
    const completed      = history.filter(h => h.is_completed).length;
    const completionRate = totalSessions > 0 ? Math.round((completed / totalSessions) * 100) : 0;
    const totalSeconds   = history.reduce((s, h) => s + (h.total_time_seconds || 0), 0);
    const avgMinutes     = totalSessions > 0 ? Math.round(totalSeconds / totalSessions / 60) : 0;

    const contentMap = {};
    for (const h of topRaw) {
      const cid = h.content_id;
      if (!contentMap[cid]) {
        contentMap[cid] = { content: h.contents, readers: 0, completed: 0, totalTime: 0, _progSum: 0 };
      }
      contentMap[cid].readers   += 1;
      contentMap[cid].totalTime += h.total_time_seconds || 0;
      contentMap[cid]._progSum  += h.progress_percent   || 0;
      if (h.is_completed) contentMap[cid].completed += 1;
    }
    const topBooks = Object.values(contentMap)
      .map(c => ({
        ...c,
        avgProgress:    c.readers > 0 ? Math.round(c._progSum / c.readers) : 0,
        completionRate: c.readers > 0 ? Math.round((c.completed / c.readers) * 100) : 0,
        avgMinutes:     c.readers > 0 ? Math.round(c.totalTime / c.readers / 60) : 0,
      }))
      .sort((a, b) => b.readers - a.readers)
      .slice(0, 10);

    const days = daysBetween(range.fromDate, range.toDate);
    const dailyMap = {};
    for (const d of days) dailyMap[d] = 0;
    for (const h of history) {
      const k = (h.last_read_at || '').split('T')[0];
      if (dailyMap[k] !== undefined) dailyMap[k] += 1;
    }

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'portrait' });
    const filename = `lecture_${range.fromDate}_${range.toDate}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    const pageW    = doc.page.width;
    const C_indigo = '#2E4057';
    const C_green  = '#27ae60';
    const C_orange = '#FF9800';
    const C_prim   = '#B5651D';
    const periodLabel = `${range.fromDate} → ${range.toDate}`;

    const logoUrl = settings.invoice_logo_url || '';
    if (logoUrl) {
      try { const lb = await fetchImageBuffer(logoUrl); doc.image(lb, 40, 30, { height: 40, fit: [130, 40] }); } catch (_) {}
    }
    const titleX = logoUrl ? 190 : 40;
    const titleW = pageW - titleX - 40;

    doc.fontSize(17).font('Helvetica-Bold').fillColor(C_indigo)
      .text('Statistiques de lecture', titleX, 32, { width: titleW, align: logoUrl ? 'right' : 'left' });
    doc.fontSize(9).font('Helvetica').fillColor('#888')
      .text(`${settings.company_name || 'Papyri'}  ·  Période : ${periodLabel}  ·  ${new Date().toLocaleDateString('fr-FR')}`,
        titleX, 54, { width: titleW, align: logoUrl ? 'right' : 'left' });
    doc.moveTo(40, 82).lineTo(pageW - 40, 82).strokeColor('#ddd').lineWidth(1).stroke();
    doc.y = 98;

    // KPIs
    sectionTitle(doc, 'Résumé lecture');
    const kpiY  = doc.y;
    const kpiW  = (pageW - 80 - 12) / 4;
    kpiBox(doc, 'Sessions',         String(totalSessions),    C_indigo, 40,            kpiY, kpiW);
    kpiBox(doc, 'Livres terminés',  String(completed),        C_green,  40+kpiW+4,     kpiY, kpiW);
    kpiBox(doc, 'Taux complétion',  `${completionRate} %`,    C_prim,   40+kpiW*2+8,   kpiY, kpiW);
    kpiBox(doc, 'Moy. par session', `${avgMinutes} min`,      C_orange, 40+kpiW*3+12,  kpiY, kpiW);
    doc.y = kpiY + 60;

    // Top livres
    sectionTitle(doc, 'Top 10 contenus lus');
    const bCols   = ['Titre', 'Type', 'Lecteurs', 'Terminés', 'Moy. (min)'];
    const bWidths = [200, 80, 70, 70, pageW - 460];
    tableRow(doc, bCols, bWidths, 40, true);
    for (const b of topBooks) {
      tableRow(doc, [
        (b.content?.title || '—').slice(0, 40),
        b.content?.content_type || '—',
        b.readers,
        b.completed,
        b.avgMinutes,
      ], bWidths, 40);
      if (doc.y > doc.page.height - 80) { doc.addPage(); }
    }
    doc.moveDown(0.5);

    // Sessions par jour (résumé condensé sur page)
    sectionTitle(doc, 'Sessions par jour');
    const dCols   = ['Date', 'Sessions'];
    const dWidths = [200, pageW - 280];
    tableRow(doc, dCols, dWidths, 40, true);
    for (const [date, count] of Object.entries(dailyMap)) {
      const label = new Date(date).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' });
      tableRow(doc, [label, count], dWidths, 40);
      if (doc.y > doc.page.height - 80) { doc.addPage(); }
    }

    doc.end();
  } catch (err) {
    console.error('[admin.analytics] GET /reading/export:', err);
    if (!res.headersSent) return res.status(500).json({ error: 'Erreur export PDF lecture.' });
  }
});

// ─── GET /revenue ─────────────────────────────────────────────
router.get('/revenue', isAdmin, async (req, res) => {
  try {
    const range = resolveRange(req.query.from, req.query.to, 365);
    const { provider: providerFilter, plan: planFilter } = req.query;

    let paymentsQ = supabaseAdmin
      .from('payments')
      .select('amount, currency, provider, paid_at, status, subscription_id')
      .eq('status', 'succeeded')
      .gte('paid_at', range.from)
      .lte('paid_at', range.to);
    if (providerFilter && providerFilter !== 'all') paymentsQ = paymentsQ.eq('provider', providerFilter);

    const [paymentsRes, subsRes, plansRes] = await Promise.all([
      paymentsQ,
      supabaseAdmin
        .from('subscriptions')
        .select('status, plan_id, created_at, cancelled_at, current_period_end'),
      supabaseAdmin
        .from('subscription_plans')
        .select('id, display_name, base_price_cents, billing_period'),
    ]);

    let payments = paymentsRes.data || [];
    const subs   = subsRes.data   || [];
    const plans  = plansRes.data  || [];

    // Filter by plan if needed (join via subscriptions)
    if (planFilter && planFilter !== 'all') {
      const { data: planSubs } = await supabaseAdmin
        .from('subscriptions')
        .select('id')
        .eq('plan_id', planFilter);
      const subIds = new Set((planSubs || []).map(s => s.id));
      payments = payments.filter(p => subIds.has(p.subscription_id));
    }

    // ── Revenu mensuel (période sélectionnée) ──
    const months = monthsBetween(range.from, range.to);
    const revenueByMonth = {};
    for (const m of months) revenueByMonth[m] = 0;
    for (const p of payments) {
      if (!p.paid_at) continue;
      const m = monthKey(p.paid_at);
      if (revenueByMonth[m] !== undefined) revenueByMonth[m] += Number(p.amount) || 0;
    }

    // ── Totaux ──
    const totalRevenue = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const currentMonth = monthKey(new Date().toISOString());
    const mrr = revenueByMonth[currentMonth] || 0;
    const arr = mrr * 12;

    // ── Par provider ──
    const byProvider = {};
    for (const p of payments) {
      const prov = p.provider || 'unknown';
      byProvider[prov] = (byProvider[prov] || 0) + (Number(p.amount) || 0);
    }

    // ── Par plan ──
    const planMap = {};
    for (const pl of plans) planMap[pl.id] = pl;
    const activeSubsByPlan = {};
    for (const s of subs) {
      if (s.status !== 'ACTIVE' || !s.plan_id) continue;
      activeSubsByPlan[s.plan_id] = (activeSubsByPlan[s.plan_id] || 0) + 1;
    }
    const byPlan = plans.map(pl => ({
      id:          pl.id,
      name:        pl.display_name,
      period:      pl.billing_period,
      price:       (pl.base_price_cents || 0) / 100,
      activeCount: activeSubsByPlan[pl.id] || 0,
      mrr: ((activeSubsByPlan[pl.id] || 0) * ((pl.base_price_cents || 0) / 100)) /
           (pl.billing_period === 'yearly' ? 12 : 1),
    }));

    // ── Churn (sur la période) ──
    const activeTotal = subs.filter(s => s.status === 'ACTIVE').length;
    const churned = subs.filter(s =>
      s.status === 'CANCELLED' && s.cancelled_at &&
      s.cancelled_at >= range.from && s.cancelled_at <= range.to
    ).length;
    const churnRate = activeTotal > 0 ? Math.round((churned / activeTotal) * 100 * 10) / 10 : 0;

    // ── Évolution abonnés par mois ──
    const newSubsByMonth   = {};
    const churnByMonth     = {};
    for (const m of months) { newSubsByMonth[m] = 0; churnByMonth[m] = 0; }
    for (const s of subs) {
      if (s.created_at) {
        const m = monthKey(s.created_at);
        if (newSubsByMonth[m] !== undefined) newSubsByMonth[m]++;
      }
      if (s.status === 'CANCELLED' && s.cancelled_at) {
        const m = monthKey(s.cancelled_at);
        if (churnByMonth[m] !== undefined) churnByMonth[m]++;
      }
    }
    // Calcul du total cumulé (approximation : part du total actuel et remonte)
    let running = activeTotal;
    const subscriberSeries = [...months].reverse().map(m => {
      const snap = running;
      running = running - (newSubsByMonth[m] || 0) + (churnByMonth[m] || 0);
      return { month: m, active: snap, newSubs: newSubsByMonth[m] || 0, churned: churnByMonth[m] || 0 };
    }).reverse().map(s => ({
      ...s,
      label: new Date(s.month + '-01').toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
    }));

    const monthlySeries = months.map(m => ({
      month:   m,
      label:   new Date(m + '-01').toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
      revenue: Math.round(revenueByMonth[m] * 100) / 100,
    }));

    return res.json({
      range: { from: range.fromDate, to: range.toDate },
      summary: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        mrr:  Math.round(mrr * 100) / 100,
        arr:  Math.round(arr * 100) / 100,
        churnRate, activeSubscribers: activeTotal, churned,
      },
      monthlySeries,
      subscriberSeries,
      byProvider: Object.entries(byProvider).map(([provider, amount]) => ({
        provider, amount: Math.round(amount * 100) / 100,
      })),
      byPlan,
    });
  } catch (err) {
    console.error('[admin.analytics] GET /revenue:', err);
    return res.status(500).json({ error: 'Erreur analytics revenus.' });
  }
});

// ─── GET /reading ─────────────────────────────────────────────
router.get('/reading', isAdmin, async (req, res) => {
  try {
    const range = resolveRange(req.query.from, req.query.to, 30);
    const { type: typeFilter } = req.query;

    let histQ = supabaseAdmin
      .from('reading_history')
      .select('progress_percent, total_time_seconds, is_completed, content_id, last_read_at')
      .gte('last_read_at', range.from)
      .lte('last_read_at', range.to);

    let topQ = supabaseAdmin
      .from('reading_history')
      .select(`
        content_id, is_completed, progress_percent, total_time_seconds,
        contents ( id, title, content_type, cover_url )
      `)
      .gte('last_read_at', range.from)
      .lte('last_read_at', range.to)
      .order('last_read_at', { ascending: false });

    const [historyRes, topBooksRes] = await Promise.all([histQ, topQ]);

    let history = historyRes.data || [];
    let topRaw  = topBooksRes.data || [];

    // Filter by content type
    if (typeFilter && typeFilter !== 'all') {
      topRaw  = topRaw.filter(h => h.contents?.content_type === typeFilter);
      history = history.filter(h => topRaw.some(t => t.content_id === h.content_id));
    }

    // ── Stats globales ──
    const totalSessions  = history.length;
    const completed      = history.filter(h => h.is_completed).length;
    const completionRate = totalSessions > 0 ? Math.round((completed / totalSessions) * 100) : 0;
    const totalSeconds   = history.reduce((s, h) => s + (h.total_time_seconds || 0), 0);
    const avgMinutes     = totalSessions > 0 ? Math.round(totalSeconds / totalSessions / 60) : 0;

    // ── Répartition type ──
    const byType = {};
    for (const h of topRaw) {
      const t = h.contents?.content_type || 'unknown';
      byType[t] = (byType[t] || 0) + 1;
    }

    // ── Top 10 contenus ──
    const contentMap = {};
    for (const h of topRaw) {
      const cid = h.content_id;
      if (!contentMap[cid]) {
        contentMap[cid] = { content: h.contents, readers: 0, completed: 0, totalTime: 0, _progSum: 0 };
      }
      contentMap[cid].readers   += 1;
      contentMap[cid].totalTime += h.total_time_seconds || 0;
      contentMap[cid]._progSum  += h.progress_percent   || 0;
      if (h.is_completed) contentMap[cid].completed += 1;
    }
    const topBooks = Object.values(contentMap)
      .map(c => ({
        ...c,
        avgProgress:    c.readers > 0 ? Math.round(c._progSum / c.readers) : 0,
        completionRate: c.readers > 0 ? Math.round((c.completed / c.readers) * 100) : 0,
        avgMinutes:     c.readers > 0 ? Math.round(c.totalTime / c.readers / 60) : 0,
        _progSum: undefined,
      }))
      .sort((a, b) => b.readers - a.readers)
      .slice(0, 10);

    // ── Sessions par jour (sur la période) ──
    const days = daysBetween(range.fromDate, range.toDate);
    const dailyMap = {};
    for (const d of days) dailyMap[d] = 0;
    for (const h of history) {
      const k = (h.last_read_at || '').split('T')[0];
      if (dailyMap[k] !== undefined) dailyMap[k] += 1;
    }
    const dailySeries = Object.entries(dailyMap).map(([date, count]) => ({
      date,
      label: new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
      count,
    }));

    return res.json({
      range: { from: range.fromDate, to: range.toDate },
      summary: { totalSessions, completed, completionRate, avgMinutes, totalHours: Math.round(totalSeconds / 3600) },
      byType: Object.entries(byType).map(([type, count]) => ({ type, count })),
      topBooks,
      dailySeries,
    });
  } catch (err) {
    console.error('[admin.analytics] GET /reading:', err);
    return res.status(500).json({ error: 'Erreur analytics lecture.' });
  }
});

// ─── GET /accounting-export (CSV comptable) ───────────────────
router.get('/accounting-export', isAdmin, async (req, res) => {
  try {
    const range = resolveRange(req.query.from, req.query.to, 365);

    const [paymentsRes, payoutsRes, plansRes, subsRes] = await Promise.all([
      supabaseAdmin
        .from('payments')
        .select('id, amount, currency, provider, paid_at, status, subscription_id, subscriptions(plan_id, profiles(email, full_name))')
        .eq('status', 'succeeded')
        .gte('paid_at', range.from)
        .lte('paid_at', range.to)
        .order('paid_at', { ascending: true }),
      supabaseAdmin
        .from('publisher_payouts')
        .select('id, amount_cad, status, paid_at, created_at, period_start, period_end, reference, publishers(company_name, email)')
        .gte('created_at', range.from)
        .lte('created_at', range.to)
        .order('created_at', { ascending: true }),
      supabaseAdmin.from('subscription_plans').select('id, display_name, billing_period'),
      supabaseAdmin.from('subscriptions').select('status, plan_id, created_at, cancelled_at'),
    ]);

    const payments = paymentsRes.data || [];
    const payouts  = payoutsRes.data  || [];
    const plans    = plansRes.data    || [];
    const subs     = subsRes.data     || [];

    const planMap = {};
    for (const p of plans) planMap[p.id] = p;

    // Résumé mensuel
    const months = monthsBetween(range.from, range.to);
    const monthlyRevenue = {};
    const monthlyPayouts = {};
    const monthlyNewSubs = {};
    const monthlyChurn   = {};
    for (const m of months) { monthlyRevenue[m] = 0; monthlyPayouts[m] = 0; monthlyNewSubs[m] = 0; monthlyChurn[m] = 0; }

    for (const p of payments) {
      const m = monthKey(p.paid_at);
      if (monthlyRevenue[m] !== undefined) monthlyRevenue[m] += Number(p.amount) || 0;
    }
    for (const p of payouts) {
      const m = monthKey(p.paid_at || p.created_at);
      if (monthlyPayouts[m] !== undefined) monthlyPayouts[m] += Number(p.amount_cad) || 0;
    }
    for (const s of subs) {
      if (s.created_at) {
        const m = monthKey(s.created_at);
        if (monthlyNewSubs[m] !== undefined) monthlyNewSubs[m]++;
      }
      if (s.status === 'CANCELLED' && s.cancelled_at) {
        const m = monthKey(s.cancelled_at);
        if (monthlyChurn[m] !== undefined) monthlyChurn[m]++;
      }
    }

    const totalRevenue  = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const totalPayouts  = payouts.reduce((s, p) => s + (Number(p.amount_cad) || 0), 0);
    const netRevenue    = totalRevenue - totalPayouts;

    const BOM = '\uFEFF';
    const rows = [];

    const fmt2 = v => Number(v || 0).toFixed(2);
    const fmtDate = v => v ? new Date(v).toLocaleDateString('fr-FR') : '—';

    rows.push([`EXPORT COMPTABLE — ${range.fromDate} → ${range.toDate}`]);
    rows.push([`Généré le ${new Date().toLocaleDateString('fr-FR')}`]);
    rows.push([]);

    rows.push(['=== RÉSUMÉ GLOBAL ===']);
    rows.push(['Revenu total collecté (€)', fmt2(totalRevenue)]);
    rows.push(['Versements éditeurs (€)', fmt2(totalPayouts)]);
    rows.push(['Revenu net plateforme (€)', fmt2(netRevenue)]);
    rows.push(['Nombre de paiements', payments.length]);
    rows.push(['Nombre de versements éditeurs', payouts.length]);
    rows.push([]);

    rows.push(['=== RÉSUMÉ MENSUEL ===']);
    rows.push(['Mois', 'Revenu (€)', 'Versements éditeurs (€)', 'Revenu net (€)', 'Nouveaux abonnés', 'Résiliations']);
    for (const m of months) {
      const label = new Date(m + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      const rev   = monthlyRevenue[m] || 0;
      const pay   = monthlyPayouts[m] || 0;
      rows.push([label, fmt2(rev), fmt2(pay), fmt2(rev - pay), monthlyNewSubs[m] || 0, monthlyChurn[m] || 0]);
    }
    rows.push([]);

    rows.push(['=== PAIEMENTS DÉTAILLÉS ===']);
    rows.push(['Date', 'Abonné', 'Email', 'Plan', 'Provider', 'Montant (€)', 'Devise', 'Référence']);
    for (const p of payments) {
      const sub   = p.subscriptions;
      const prof  = sub?.profiles;
      const plan  = planMap[sub?.plan_id];
      rows.push([
        fmtDate(p.paid_at),
        prof?.full_name || '—',
        prof?.email || '—',
        plan?.display_name || '—',
        p.provider || '—',
        fmt2(p.amount),
        p.currency || 'EUR',
        p.id?.slice(0, 8) || '—',
      ]);
    }
    rows.push([]);

    rows.push(['=== VERSEMENTS ÉDITEURS ===']);
    rows.push(['Date', 'Éditeur', 'Email', 'Référence', 'Période début', 'Période fin', 'Montant (€)', 'Statut']);
    for (const p of payouts) {
      rows.push([
        fmtDate(p.paid_at || p.created_at),
        p.publishers?.company_name || '—',
        p.publishers?.email || '—',
        p.reference || '—',
        fmtDate(p.period_start),
        fmtDate(p.period_end),
        fmt2(p.amount_cad),
        p.status,
      ]);
    }

    const csv = BOM + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    const filename = `comptabilite_${range.fromDate}_${range.toDate}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    console.error('[admin.analytics] GET /accounting-export:', err);
    if (!res.headersSent) return res.status(500).json({ error: 'Erreur export comptable.' });
  }
});

module.exports = router;
