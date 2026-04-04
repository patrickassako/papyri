/**
 * Publisher Controller
 * Thin layer — validation basique + appel service
 */

const publisherService = require('../services/publisher.service');
const { supabaseAdmin } = require('../config/database');

// Vérifie que le contenu appartient bien à l'éditeur connecté
async function assertOwnsContent(userId, contentId) {
  const publisher = await publisherService.getPublisherByUserId(userId);
  const { data: pb } = await supabaseAdmin
    .from('publisher_books')
    .select('id')
    .eq('publisher_id', publisher.id)
    .eq('content_id', contentId)
    .maybeSingle();
  if (!pb) throw Object.assign(new Error('Contenu introuvable ou accès refusé.'), { status: 403 });
  return publisher;
}

// ──── Auth & profil ───────────────────────────────────────────

async function verifyToken(req, res) {
  try {
    const { token } = req.params;
    const publisher = await publisherService.verifyInvitationToken(token);
    res.json({ success: true, publisher: { email: publisher.email, contactName: publisher.contact_name, companyName: publisher.company_name } });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function activate(req, res) {
  try {
    const { token, password, fullName } = req.body;
    if (!token || !password) return res.status(400).json({ success: false, message: 'token et password requis.' });
    const result = await publisherService.activatePublisher(token, { password, fullName });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function getMe(req, res) {
  try {
    const publisher = await publisherService.getPublisherByUserId(req.user.id);
    res.json({ success: true, publisher });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
}

async function updateMe(req, res) {
  try {
    const publisher = await publisherService.getPublisherByUserId(req.user.id);
    const updated = await publisherService.updatePublisher(publisher.id, req.body);
    res.json({ success: true, publisher: updated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function updatePayoutMethod(req, res) {
  try {
    const publisher = await publisherService.getPublisherByUserId(req.user.id);
    const updated = await publisherService.updatePayoutMethod(publisher.id, req.body);
    res.json({ success: true, publisher: updated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

// ──── Livres ──────────────────────────────────────────────────

async function getBooks(req, res) {
  try {
    const publisher = await publisherService.getPublisherByUserId(req.user.id);
    const { status, type, page, limit } = req.query;
    const result = await publisherService.getPublisherBooks(publisher.id, { status, type, page: +page || 1, limit: +limit || 20 });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function submitBook(req, res) {
  try {
    const publisher = await publisherService.getPublisherByUserId(req.user.id);
    if (publisher.status !== 'active') return res.status(403).json({ success: false, message: 'Compte éditeur inactif.' });
    const result = await publisherService.submitBook(publisher.id, req.body);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function updateBook(req, res) {
  try {
    const publisher = await publisherService.getPublisherByUserId(req.user.id);
    const { submit, ...fields } = req.body;
    const result = await publisherService.updateDraft(publisher.id, req.params.contentId, fields, !!submit);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function deleteBook(req, res) {
  try {
    const publisher = await publisherService.getPublisherByUserId(req.user.id);
    await publisherService.deletePublisherBook(publisher.id, req.params.contentId);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

// ──── Revenus ─────────────────────────────────────────────────

async function adminDeletePublisher(req, res) {
  try {
    const result = await publisherService.deletePublisher(req.params.id);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function getDashboardData(req, res) {
  try {
    const publisher = await publisherService.getPublisherByUserId(req.user.id);
    const data = await publisherService.getDashboardData(publisher.id);
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function getRevenueSummary(req, res) {
  try {
    const publisher = await publisherService.getPublisherByUserId(req.user.id);
    const summary = await publisherService.getRevenueSummary(publisher.id, req.query);
    res.json({ success: true, summary });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function getRevenueByBook(req, res) {
  try {
    const publisher = await publisherService.getPublisherByUserId(req.user.id);
    const books = await publisherService.getRevenueByBook(publisher.id, req.query);
    res.json({ success: true, books });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function getPayouts(req, res) {
  try {
    const publisher = await publisherService.getPublisherByUserId(req.user.id);
    const payouts = await publisherService.getPayouts(publisher.id);
    res.json({ success: true, payouts });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

// ──── Codes promo ─────────────────────────────────────────────

async function getPromoQuota(req, res) {
  try {
    const publisher = await publisherService.getPublisherByUserId(req.user.id);
    const quota = await publisherService.getPromoCodeQuota(publisher.id);
    res.json({ success: true, quota });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function getPromoCodes(req, res) {
  try {
    const publisher = await publisherService.getPublisherByUserId(req.user.id);
    const codes = await publisherService.getPromoCodes(publisher.id, req.query);
    res.json({ success: true, codes });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function createPromoCode(req, res) {
  try {
    const publisher = await publisherService.getPublisherByUserId(req.user.id);
    const code = await publisherService.createPromoCode(publisher.id, req.body);
    res.status(201).json({ success: true, code });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function deletePromoCode(req, res) {
  try {
    const publisher = await publisherService.getPublisherByUserId(req.user.id);
    await publisherService.deletePromoCode(publisher.id, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function togglePromoCode(req, res) {
  try {
    const publisher = await publisherService.getPublisherByUserId(req.user.id);
    const code = await publisherService.togglePromoCode(publisher.id, req.params.id);
    res.json({ success: true, code });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function getPromoCodeUsages(req, res) {
  try {
    const publisher = await publisherService.getPublisherByUserId(req.user.id);
    const usages = await publisherService.getPromoCodeUsages(publisher.id, req.params.id);
    res.json({ success: true, usages });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

// ──── Prix géographiques (par livre) ──────────────────────────

async function getBookGeoPricing(req, res) {
  try {
    await assertOwnsContent(req.user.id, req.params.contentId);
    const { data, error } = await supabaseAdmin
      .from('content_geographic_pricing')
      .select('*')
      .eq('content_id', req.params.contentId)
      .order('zone');
    if (error) throw error;
    res.json({ success: true, pricing: data || [] });
  } catch (err) {
    res.status(err.status || 400).json({ success: false, message: err.message });
  }
}

async function upsertBookGeoPricing(req, res) {
  try {
    await assertOwnsContent(req.user.id, req.params.contentId);
    const { zone, zone_label, price_cents, currency, is_active, notes } = req.body;
    if (!zone || price_cents == null) return res.status(400).json({ success: false, message: 'zone et price_cents requis.' });
    const { data, error } = await supabaseAdmin
      .from('content_geographic_pricing')
      .upsert({
        content_id: req.params.contentId,
        zone, zone_label: zone_label || zone,
        price_cents: Number(price_cents),
        currency: currency || 'EUR',
        is_active: is_active !== false,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'content_id,zone' })
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, pricing: data });
  } catch (err) {
    res.status(err.status || 400).json({ success: false, message: err.message });
  }
}

async function deleteBookGeoPricing(req, res) {
  try {
    const publisher = await assertOwnsContent(req.user.id, req.params.contentId);
    void publisher;
    const { error } = await supabaseAdmin
      .from('content_geographic_pricing')
      .delete()
      .eq('id', req.params.id)
      .eq('content_id', req.params.contentId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 400).json({ success: false, message: err.message });
  }
}

// ──── Restrictions géographiques (par livre) ──────────────────

async function getBookGeoRestrictions(req, res) {
  try {
    await assertOwnsContent(req.user.id, req.params.contentId);
    const [{ data: config }, { data: zones }] = await Promise.all([
      supabaseAdmin.from('content_geo_restriction_config').select('mode').eq('content_id', req.params.contentId).maybeSingle(),
      supabaseAdmin.from('content_geo_restrictions').select('*').eq('content_id', req.params.contentId).order('zone'),
    ]);
    res.json({ success: true, config: config || null, zones: zones || [] });
  } catch (err) {
    res.status(err.status || 400).json({ success: false, message: err.message });
  }
}

async function setBookGeoRestrictionConfig(req, res) {
  try {
    await assertOwnsContent(req.user.id, req.params.contentId);
    const { mode } = req.body;
    if (!['blacklist', 'whitelist'].includes(mode)) return res.status(400).json({ success: false, message: 'mode invalide.' });
    const { data, error } = await supabaseAdmin
      .from('content_geo_restriction_config')
      .upsert({ content_id: req.params.contentId, mode, updated_at: new Date().toISOString() }, { onConflict: 'content_id' })
      .select().single();
    if (error) throw error;
    res.json({ success: true, config: data });
  } catch (err) {
    res.status(err.status || 400).json({ success: false, message: err.message });
  }
}

async function deleteBookGeoRestrictionConfig(req, res) {
  try {
    await assertOwnsContent(req.user.id, req.params.contentId);
    await supabaseAdmin.from('content_geo_restriction_config').delete().eq('content_id', req.params.contentId);
    await supabaseAdmin.from('content_geo_restrictions').delete().eq('content_id', req.params.contentId);
    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 400).json({ success: false, message: err.message });
  }
}

async function upsertBookGeoZone(req, res) {
  try {
    await assertOwnsContent(req.user.id, req.params.contentId);
    const { zone, zone_label, is_active, reason } = req.body;
    if (!zone) return res.status(400).json({ success: false, message: 'zone requis.' });
    const { data, error } = await supabaseAdmin
      .from('content_geo_restrictions')
      .upsert({
        content_id: req.params.contentId,
        zone, zone_label: zone_label || zone,
        is_active: is_active !== false,
        reason: reason || null,
      }, { onConflict: 'content_id,zone' })
      .select().single();
    if (error) throw error;
    res.json({ success: true, zone: data });
  } catch (err) {
    res.status(err.status || 400).json({ success: false, message: err.message });
  }
}

async function deleteBookGeoZone(req, res) {
  try {
    await assertOwnsContent(req.user.id, req.params.contentId);
    const { error } = await supabaseAdmin
      .from('content_geo_restrictions')
      .delete()
      .eq('id', req.params.zoneId)
      .eq('content_id', req.params.contentId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 400).json({ success: false, message: err.message });
  }
}

// ──── Admin ───────────────────────────────────────────────────

async function adminGetDashboardStats(req, res) {
  try {
    const stats = await publisherService.getAdminDashboardStats();
    res.json({ success: true, ...stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function adminInvitePublisher(req, res) {
  try {
    const { companyName, contactName, email, description, revenueGrid } = req.body;
    if (!companyName || !contactName || !email) {
      return res.status(400).json({ success: false, message: 'companyName, contactName et email sont requis.' });
    }
    const publisher = await publisherService.invitePublisher(req.user.id, { companyName, contactName, email, description, revenueGrid });
    res.status(201).json({ success: true, publisher });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function adminGetPublishers(req, res) {
  try {
    const result = await publisherService.getAllPublishers(req.query);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function adminGetPublisher(req, res) {
  try {
    const { from, to } = req.query;
    const result = await publisherService.getPublisherFull(req.params.id, { from, to });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
}

async function adminExportPublisher(req, res) {
  try {
    const { id } = req.params;
    const { format = 'pdf', from, to } = req.query;

    const { getSettings } = require('../services/settings.service');
    const { supabaseAdmin } = require('../config/database');

    const [fullData, settings] = await Promise.all([
      publisherService.getPublisherFull(id, { from, to }),
      getSettings(),
    ]);

    const { publisher, books = [], revenue, revenueByBook = [], payouts = [] } = fullData;

    // Ventes normales vs promo (sale_type)
    let revenueQuery = supabaseAdmin
      .from('publisher_revenue')
      .select('sale_type, publisher_amount_cad')
      .eq('publisher_id', id);
    if (from) revenueQuery = revenueQuery.gte('created_at', from);
    if (to)   revenueQuery = revenueQuery.lte('created_at', to);
    const { data: rawRevenue } = await revenueQuery;
    const normalSales = (rawRevenue || []).filter(r => r.sale_type === 'normal').length;
    const promoSales  = (rawRevenue || []).filter(r => r.sale_type === 'bonus').length;
    const totalSales  = normalSales + promoSales;

    const periodLabel = from && to
      ? `${new Date(from).toLocaleDateString('fr-FR')} → ${new Date(to).toLocaleDateString('fr-FR')}`
      : from ? `À partir du ${new Date(from).toLocaleDateString('fr-FR')}`
      : to   ? `Jusqu'au ${new Date(to).toLocaleDateString('fr-FR')}`
      : 'Toute la période';

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

    // ════════════════════ CSV ════════════════════════════════
    if (format === 'csv') {
      const lines = ['\uFEFF'];
      lines.push(`"Éditeur";"${publisher.company_name}"`);
      lines.push(`"Contact";"${publisher.contact_name || ''}"`);
      lines.push(`"Email";"${publisher.email}"`);
      lines.push(`"Période";"${periodLabel}"`);
      lines.push(`"Généré le";"${new Date().toLocaleDateString('fr-FR')}"`);
      lines.push('');
      lines.push('"=== RÉSUMÉ REVENUS ==="');
      lines.push(`"Total généré";"${revenue.total.toFixed(2)} CAD"`);
      lines.push(`"Ventes normales";"${revenue.normal.toFixed(2)} CAD"`);
      lines.push(`"Ventes promo/bonus";"${revenue.bonus.toFixed(2)} CAD"`);
      lines.push(`"Montant versé";"${revenue.paid.toFixed(2)} CAD"`);
      lines.push(`"Solde à verser";"${revenue.pending.toFixed(2)} CAD"`);
      lines.push('');
      lines.push('"=== STATISTIQUES VENTES ==="');
      lines.push(`"Ventes totales";"${totalSales}"`);
      lines.push(`"Ventes normales (nb)";"${normalSales}"`);
      lines.push(`"Ventes avec promo (nb)";"${promoSales}"`);
      lines.push('');
      lines.push('"=== REVENUS PAR LIVRE ==="');
      lines.push('"Titre";"Auteur";"Ventes";"Revenus normaux (CAD)";"Revenus promo (CAD)";"Total (CAD)"');
      for (const r of revenueByBook) {
        lines.push(`"${r.content?.title || '—'}";"${r.content?.author || '—'}";"${r.sales}";"${r.normal.toFixed(2)}";"${r.bonus.toFixed(2)}";"${r.total.toFixed(2)}"`);
      }
      lines.push(`"TOTAL";"";"${revenueByBook.reduce((s,r)=>s+r.sales,0)}";"${revenueByBook.reduce((s,r)=>s+r.normal,0).toFixed(2)}";"${revenueByBook.reduce((s,r)=>s+r.bonus,0).toFixed(2)}";"${revenue.total.toFixed(2)}"`);
      lines.push('');
      lines.push('"=== CATALOGUE ==="');
      lines.push('"Titre";"Auteur";"Type";"Statut validation"');
      for (const b of books) {
        const c = b.contents || b;
        lines.push(`"${c.title || '—'}";"${c.author || '—'}";"${c.content_type || '—'}";"${b.validation_status || '—'}"`);
      }
      lines.push('');
      lines.push('"=== VERSEMENTS ==="');
      lines.push('"Période";"Montant (CAD)";"Statut";"Date versement"');
      for (const p of payouts) {
        const ps = p.period_start ? new Date(p.period_start).toLocaleDateString('fr-FR') : '—';
        const pe = p.period_end   ? new Date(p.period_end).toLocaleDateString('fr-FR')   : '—';
        const pd = p.paid_at      ? new Date(p.paid_at).toLocaleDateString('fr-FR')      : '—';
        lines.push(`"${ps} → ${pe}";"${Number(p.amount_cad).toFixed(2)}";"${p.status}";"${pd}"`);
      }
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="editeur-${publisher.company_name.replace(/\s+/g,'-')}-${Date.now()}.csv"`);
      return res.send(lines.join('\r\n'));
    }

    // ════════════════════ PDF ════════════════════════════════
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'portrait' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="editeur-${publisher.company_name.replace(/\s+/g,'-')}-${Date.now()}.pdf"`);
    doc.pipe(res);

    const pageW   = doc.page.width;
    const C_indigo  = '#2E4057';
    const C_green   = '#27ae60';
    const C_orange  = '#FF9800';
    const C_primary = '#B5651D';

    // ── Header ───────────────────────────────────────────────
    const logoUrl = settings.invoice_logo_url || '';
    if (logoUrl) {
      try { const lb = await fetchImageBuffer(logoUrl); doc.image(lb, 40, 30, { height: 40, fit: [130, 40] }); } catch (_) {}
    }
    const titleX = logoUrl ? 190 : 40;
    const titleW = pageW - titleX - 40;
    doc.fontSize(17).font('Helvetica-Bold').fillColor(C_indigo)
      .text(`Rapport éditeur — ${publisher.company_name}`, titleX, 32, { width: titleW, align: logoUrl ? 'right' : 'left' });
    doc.fontSize(9).font('Helvetica').fillColor('#888')
      .text(`${settings.company_name || 'Papyri'}  ·  Période : ${periodLabel}  ·  ${new Date().toLocaleDateString('fr-FR')}`,
        titleX, 54, { width: titleW, align: logoUrl ? 'right' : 'left' });
    doc.moveTo(40, 82).lineTo(pageW - 40, 82).strokeColor('#ddd').lineWidth(1).stroke();
    doc.y = 98;

    function sectionTitle(label) {
      doc.moveDown(0.3);
      doc.fontSize(11).font('Helvetica-Bold').fillColor(C_indigo).text(label, 40, doc.y, { width: pageW - 80 });
      doc.moveTo(40, doc.y).lineTo(pageW - 40, doc.y).strokeColor('#e0dbd5').lineWidth(0.5).stroke();
      doc.moveDown(0.6);
    }

    function kpiBox(label, value, color, x, y, w) {
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

    // ── Infos éditeur ────────────────────────────────────────
    sectionTitle('Informations éditeur');
    const infoY = doc.y;
    const colW = (pageW - 80) / 2;
    [
      ['Société', publisher.company_name, 0],
      ['Responsable', publisher.contact_name, 1],
      ['Email', publisher.email, 0],
      ['Mode de paiement', publisher.payout_method?.type || 'Non renseigné', 1],
    ].forEach(([label, value, col], i) => {
      const y = infoY + Math.floor(i / 2) * 28;
      const x = 40 + col * (colW + 20);
      doc.fontSize(8).font('Helvetica').fillColor('#888').text(label.toUpperCase(), x, y, { width: colW });
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#1a1a2e').text(value || '—', x, y + 11, { width: colW });
    });
    doc.y = infoY + 64;

    // ── KPIs revenus ─────────────────────────────────────────
    sectionTitle('Revenus sur la période');
    const kpiY = doc.y;
    const kpiW = (pageW - 80) / 5 - 3;
    [
      { label: 'Total généré',    value: `${revenue.total.toFixed(2)}\nCAD`,   color: C_indigo  },
      { label: 'Ventes normales', value: `${revenue.normal.toFixed(2)}\nCAD`,  color: C_green   },
      { label: 'Ventes promo',    value: `${revenue.bonus.toFixed(2)}\nCAD`,   color: C_primary },
      { label: 'Versé',           value: `${revenue.paid.toFixed(2)}\nCAD`,    color: C_green   },
      { label: 'Solde à verser',  value: `${revenue.pending.toFixed(2)}\nCAD`, color: C_orange  },
    ].forEach(({ label, value, color }, i) => {
      kpiBox(label, value.replace('\n', ' '), color, 40 + i * (kpiW + 4), kpiY, kpiW);
    });
    doc.y = kpiY + 58;

    // ── Répartition ventes ───────────────────────────────────
    sectionTitle('Répartition des ventes');
    const rY = doc.y;
    const rW = (pageW - 80) / 3 - 4;
    [
      { label: 'Ventes totales',     value: String(totalSales),  color: C_indigo  },
      { label: 'Ventes normales',    value: String(normalSales), color: C_green   },
      { label: 'Ventes avec promo',  value: String(promoSales),  color: C_primary },
    ].forEach(({ label, value, color }, i) => {
      kpiBox(label, value, color, 40 + i * (rW + 6), rY, rW);
    });
    doc.y = rY + 58;

    // ── Revenus par livre ────────────────────────────────────
    if (revenueByBook.length > 0) {
      sectionTitle('Revenus par livre');
      const bCols = [210, 50, 80, 80, 80];
      const bHdrs = ['Titre / Auteur', 'Ventes', 'Normal CAD', 'Promo CAD', 'Total CAD'];
      const tableW = bCols.reduce((a,b)=>a+b,0);
      let ty = doc.y;

      doc.rect(40, ty, tableW, 18).fill(C_indigo);
      doc.fillColor('#fff').fontSize(8).font('Helvetica-Bold');
      let bx = 40;
      bHdrs.forEach((h, i) => {
        doc.text(h, bx + 4, ty + 5, { width: bCols[i] - 8, lineBreak: false, align: i > 0 ? 'right' : 'left' });
        bx += bCols[i];
      });
      ty += 20;

      revenueByBook.forEach((r, idx) => {
        if (ty > 740) { doc.addPage(); ty = 40; }
        doc.rect(40, ty, tableW, 16).fill(idx % 2 === 0 ? '#F7F6F3' : '#fff');
        doc.fillColor('#1a1a2e').fontSize(8).font('Helvetica');
        bx = 40;
        [
          `${r.content?.title || '—'} — ${r.content?.author || '—'}`,
          String(r.sales), r.normal.toFixed(2), r.bonus.toFixed(2), r.total.toFixed(2),
        ].forEach((v, i) => {
          doc.text(v, bx + 4, ty + 4, { width: bCols[i] - 8, lineBreak: false, ellipsis: true, align: i > 0 ? 'right' : 'left' });
          bx += bCols[i];
        });
        ty += 16;
      });

      // Total
      doc.rect(40, ty, tableW, 18).fill(`${C_indigo}18`);
      doc.fillColor(C_indigo).fontSize(8.5).font('Helvetica-Bold');
      bx = 40;
      [
        'TOTAL',
        String(revenueByBook.reduce((s,r)=>s+r.sales,0)),
        revenueByBook.reduce((s,r)=>s+r.normal,0).toFixed(2),
        revenueByBook.reduce((s,r)=>s+r.bonus,0).toFixed(2),
        revenue.total.toFixed(2),
      ].forEach((v, i) => {
        doc.text(v, bx + 4, ty + 5, { width: bCols[i] - 8, lineBreak: false, align: i > 0 ? 'right' : 'left' });
        bx += bCols[i];
      });
      doc.y = ty + 26;
    }

    // ── Versements ───────────────────────────────────────────
    if (payouts.length > 0) {
      if (doc.y > 680) { doc.addPage(); doc.y = 40; }
      sectionTitle('Historique des versements');
      const pCols = [200, 120, 80, 115];
      const pHdrs = ['Période', 'Montant (CAD)', 'Statut', 'Versé le'];
      const pTableW = pCols.reduce((a,b)=>a+b,0);
      let py = doc.y;
      doc.rect(40, py, pTableW, 18).fill(C_indigo);
      doc.fillColor('#fff').fontSize(8).font('Helvetica-Bold');
      let px = 40;
      pHdrs.forEach((h, i) => { doc.text(h, px+4, py+5, { width: pCols[i]-8, lineBreak: false }); px += pCols[i]; });
      py += 20;
      payouts.forEach((p, idx) => {
        if (py > 740) { doc.addPage(); py = 40; }
        doc.rect(40, py, pTableW, 16).fill(idx % 2 === 0 ? '#F7F6F3' : '#fff');
        doc.fillColor('#1a1a2e').fontSize(8).font('Helvetica');
        px = 40;
        const ps = p.period_start ? new Date(p.period_start).toLocaleDateString('fr-FR') : '—';
        const pe = p.period_end   ? new Date(p.period_end).toLocaleDateString('fr-FR')   : '—';
        [
          `${ps} → ${pe}`,
          `${Number(p.amount_cad).toFixed(2)} CAD`,
          p.status,
          p.paid_at ? new Date(p.paid_at).toLocaleDateString('fr-FR') : '—',
        ].forEach((v, i) => {
          doc.text(v, px+4, py+4, { width: pCols[i]-8, lineBreak: false, ellipsis: true });
          px += pCols[i];
        });
        py += 16;
      });
      doc.y = py + 8;
    }

    // ── Footer ───────────────────────────────────────────────
    const footerY = doc.page.height - 30;
    doc.moveTo(40, footerY - 8).lineTo(pageW - 40, footerY - 8).strokeColor('#eee').lineWidth(0.5).stroke();
    doc.fontSize(7.5).font('Helvetica').fillColor('#bbb')
      .text(`${settings.company_name || 'Papyri'} — Document confidentiel — ${new Date().toLocaleDateString('fr-FR')}`,
        40, footerY, { width: pageW - 80, align: 'center' });

    doc.end();
    return;

  } catch (err) {
    console.error('[adminExportPublisher]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function adminUpdateStatus(req, res) {
  try {
    const { status } = req.body;
    const allowed = ['active', 'paused', 'banned'];
    if (!allowed.includes(status)) return res.status(400).json({ success: false, message: 'Statut invalide.' });
    const publisher = await publisherService.updatePublisherStatus(req.params.id, status);
    res.json({ success: true, publisher });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function adminUpdateRevenueGrid(req, res) {
  try {
    const publisher = await publisherService.updateRevenueGrid(req.params.id, req.body);
    res.json({ success: true, publisher });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function adminGetPendingContent(req, res) {
  try {
    const result = await publisherService.getPendingContent(req.query);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function adminApproveContent(req, res) {
  try {
    const result = await publisherService.approveContent(req.params.id, req.user.id);
    res.json({ success: true, publisherBook: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function adminRejectContent(req, res) {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, message: 'Un motif de rejet est requis.' });
    const result = await publisherService.rejectContent(req.params.id, req.user.id, reason);
    res.json({ success: true, publisherBook: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function adminPauseContent(req, res) {
  try {
    const { reason } = req.body;
    const result = await publisherService.pauseContent(req.params.id, req.user.id, reason || null);
    res.json({ success: true, publisherBook: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function adminResetContent(req, res) {
  try {
    const result = await publisherService.setPendingContent(req.params.id, req.user.id);
    res.json({ success: true, publisherBook: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function adminGetPayoutsOverview(req, res) {
  try {
    const payouts = await publisherService.getPayoutsOverview(req.query);
    res.json({ success: true, payouts });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function adminGetPayoutsHistory(req, res) {
  try {
    const result = await publisherService.getPayoutsHistory(req.query);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

const payoutSchedulerService = require('../services/payout-scheduler.service');

async function adminGetScheduleConfig(req, res) {
  try {
    const config = await payoutSchedulerService.getConfig();
    res.json({ success: true, config });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function adminUpdateScheduleConfig(req, res) {
  try {
    const config = await payoutSchedulerService.updateConfig(req.user.id, req.body);
    res.json({ success: true, config });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function adminGetSchedulePreview(req, res) {
  try {
    const preview = await payoutSchedulerService.getSchedulingPreview();
    res.json({ success: true, ...preview });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function adminGetScheduledPayouts(req, res) {
  try {
    const result = await payoutSchedulerService.getScheduledPayouts(req.query);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function adminScheduleNow(req, res) {
  try {
    const result = await payoutSchedulerService.createScheduledPayouts(req.user.id);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function adminCreatePayout(req, res) {
  try {
    const payout = await publisherService.createPayout(req.user.id, req.body);
    res.status(201).json({ success: true, payout });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function adminCreateAllPayouts(req, res) {
  try {
    const result = await publisherService.createAllPayouts(req.user.id, req.body);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

async function adminUpdatePayoutStatus(req, res) {
  try {
    const { status } = req.body;
    const payout = await publisherService.updatePayoutStatus(req.params.id, status, req.user.id);
    res.json({ success: true, payout });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

// ──── Stats de lecture ─────────────────────────────────────────

async function getReadingStats(req, res) {
  try {
    const publisher = await publisherService.getPublisherByUserId(req.user.id);

    // Récupérer les content_id de l'éditeur
    const { data: pbooks, error: pbErr } = await supabaseAdmin
      .from('publisher_books')
      .select('content_id, contents(id, title, author, cover_url, content_type)')
      .eq('publisher_id', publisher.id);

    if (pbErr) throw pbErr;
    if (!pbooks || pbooks.length === 0) return res.json({ success: true, stats: [], totals: { reads: 0, uniqueReaders: 0, avgTimeSeconds: 0 } });

    const contentIds = pbooks.map(pb => pb.content_id);

    // Agréger reading_history par content_id
    const { data: history, error: histErr } = await supabaseAdmin
      .from('reading_history')
      .select('content_id, user_id, total_time_seconds, progress_percent')
      .in('content_id', contentIds);

    if (histErr && histErr.code !== 'PGRST205') throw histErr;

    const rows = history || [];

    // Grouper par content_id
    const byContent = {};
    for (const row of rows) {
      if (!byContent[row.content_id]) byContent[row.content_id] = { reads: 0, users: new Set(), totalTime: 0, totalProgress: 0 };
      byContent[row.content_id].reads++;
      byContent[row.content_id].users.add(row.user_id);
      byContent[row.content_id].totalTime += row.total_time_seconds || 0;
      byContent[row.content_id].totalProgress += row.progress_percent || 0;
    }

    const stats = pbooks.map(pb => {
      const c = pb.contents || {};
      const agg = byContent[pb.content_id] || { reads: 0, users: new Set(), totalTime: 0, totalProgress: 0 };
      const reads = agg.reads;
      return {
        contentId:     pb.content_id,
        title:         c.title || '—',
        author:        c.author || '',
        coverUrl:      c.cover_url || null,
        contentType:   c.content_type || 'ebook',
        reads,
        uniqueReaders: agg.users.size,
        avgTimeSeconds: reads > 0 ? Math.round(agg.totalTime / reads) : 0,
        avgProgress:    reads > 0 ? Math.round(agg.totalProgress / reads) : 0,
      };
    }).sort((a, b) => b.reads - a.reads);

    const totals = {
      reads:         rows.length,
      uniqueReaders: new Set(rows.map(r => r.user_id)).size,
      avgTimeSeconds: rows.length > 0 ? Math.round(rows.reduce((s, r) => s + (r.total_time_seconds || 0), 0) / rows.length) : 0,
    };

    res.json({ success: true, stats, totals });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

module.exports = {
  verifyToken, activate,
  getMe, updateMe, updatePayoutMethod,
  getBooks, submitBook, updateBook, deleteBook,
  getDashboardData,
  getRevenueSummary, getRevenueByBook, getPayouts, getReadingStats,
  getPromoQuota, getPromoCodes, createPromoCode, deletePromoCode, togglePromoCode, getPromoCodeUsages,
  getBookGeoPricing, upsertBookGeoPricing, deleteBookGeoPricing,
  getBookGeoRestrictions, setBookGeoRestrictionConfig, deleteBookGeoRestrictionConfig,
  upsertBookGeoZone, deleteBookGeoZone,
  adminGetDashboardStats,
  adminInvitePublisher, adminGetPublishers, adminGetPublisher, adminExportPublisher,
  adminDeletePublisher,
  adminUpdateStatus, adminUpdateRevenueGrid,
  adminGetPendingContent, adminApproveContent, adminRejectContent, adminPauseContent, adminResetContent,
  adminGetPayoutsOverview, adminGetPayoutsHistory,
  adminCreatePayout, adminCreateAllPayouts, adminUpdatePayoutStatus,
  adminGetScheduleConfig, adminUpdateScheduleConfig,
  adminGetSchedulePreview, adminGetScheduledPayouts, adminScheduleNow,
};
