/**
 * Publisher Service
 * Gestion des comptes éditeurs : invitation, profil, livres, revenus, codes promo, versements
 */

const { supabaseAdmin } = require('../config/database');
const {
  sendPublisherContentApprovedEmail,
  sendPublisherContentRejectedEmail,
  sendPublisherWelcomeEmail,
} = require('./email.service');
const config = require('../config/env');
const crypto = require('crypto');

// ──── Helpers ─────────────────────────────────────────────────

function generateInvitationToken() {
  return crypto.randomBytes(32).toString('hex');
}

function buildPayoutReference() {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `VRS-${stamp}-${rand}`;
}

function calcPublisherAmount(bookPriceCad, grid) {
  const threshold = grid?.threshold_cad ?? 5;
  const above = grid?.above_threshold_cad ?? 5;
  const below = grid?.below_threshold_cad ?? 2.5;
  return bookPriceCad > threshold ? above : below;
}

function periodStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
}

// ──── Invitation & activation ─────────────────────────────────

async function invitePublisher(adminUserId, { companyName, contactName, email, description, revenueGrid }) {
  // Vérifier que l'email n'est pas déjà utilisé
  const { data: existing } = await supabaseAdmin
    .from('publishers')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existing) throw new Error('Un éditeur avec cet email existe déjà.');

  const token = generateInvitationToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 jours

  const grid = revenueGrid || { threshold_cad: 5, above_threshold_cad: 5, below_threshold_cad: 2.5 };

  const { data: publisher, error } = await supabaseAdmin
    .from('publishers')
    .insert({
      company_name: companyName,
      contact_name: contactName,
      email,
      description,
      revenue_grid: grid,
      invited_by: adminUserId,
      invitation_token: token,
      invitation_sent_at: new Date().toISOString(),
      invitation_expires_at: expiresAt,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;

  // Envoyer l'email d'invitation
  const activationUrl = `${config.frontendUrl}/publisher/activate?token=${token}`;
  await sendInvitationEmail(email, contactName, companyName, activationUrl);

  return publisher;
}

async function sendInvitationEmail(email, contactName, companyName, activationUrl) {
  const { sendWelcomeEmail } = require('./email.service');
  // On utilise directement le transport interne
  const { SESClient, SendRawEmailCommand } = require('@aws-sdk/client-ses');
  const nodemailer = require('nodemailer');

  // Réutiliser la fonction _sendEmail du email.service via une approche directe
  // On importe le service et on appelle via une API interne
  // Pour éviter la dépendance circulaire, on crée l'email directement ici
  const emailService = require('./email.service');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Invitation Éditeur Papyri</title></head>
<body style="margin:0;padding:0;font-family:Inter,-apple-system,sans-serif;background:#F5F5F5;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F5;padding:40px 20px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;">
      <tr><td style="background:#B5651D;padding:40px;text-align:center;">
        <h1 style="margin:0;color:#fff;font-family:Georgia,serif;font-size:28px;">Papyri</h1>
      </td></tr>
      <tr><td style="padding:40px 30px;">
        <h2 style="color:#2E4057;margin:0 0 16px;">Vous êtes invité(e) à rejoindre Papyri en tant qu'éditeur</h2>
        <p style="color:#4A4A4A;font-size:16px;line-height:1.6;">Bonjour ${contactName},</p>
        <p style="color:#4A4A4A;font-size:16px;line-height:1.6;">
          Nous avons le plaisir de vous inviter à créer votre espace éditeur sur Papyri pour <strong>${companyName}</strong>.
        </p>
        <p style="color:#4A4A4A;font-size:16px;line-height:1.6;">
          Depuis votre espace, vous pourrez publier vos livres et livres audio, suivre vos ventes et percevoir vos revenus.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 0;">
          <a href="${activationUrl}" style="display:inline-block;background:#B5651D;color:#fff;text-decoration:none;padding:16px 40px;border-radius:24px;font-size:16px;font-weight:700;">
            Activer mon compte éditeur
          </a>
        </td></tr></table>
        <p style="color:#757575;font-size:13px;">Ce lien est valable 7 jours. Si vous ne souhaitez pas activer ce compte, ignorez cet email.</p>
      </td></tr>
      <tr><td style="background:#F5F5F5;padding:24px;text-align:center;">
        <p style="margin:0;color:#9E9E9E;font-size:12px;">&copy; ${new Date().getFullYear()} Papyri. Tous droits réservés.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  // Utiliser directement la logique de transport
  const provider = config.email?.provider || 'brevo';

  if (provider === 'ses') {
    const ses = new SESClient({
      region: config.ses.region,
      credentials: { accessKeyId: config.ses.accessKeyId, secretAccessKey: config.ses.secretAccessKey },
    });
    const transporter = nodemailer.createTransport({
      SES: { ses, aws: require('@aws-sdk/client-ses') },
    });
    await transporter.sendMail({
      from: `"${config.email.senderName}" <${config.email.senderEmail}>`,
      to: `"${contactName}" <${email}>`,
      subject: `Invitation éditeur Papyri — ${companyName}`,
      html,
      text: `Bonjour ${contactName},\n\nVous êtes invité(e) à activer votre compte éditeur Papyri pour ${companyName}.\n\nLien d'activation (valable 7 jours) :\n${activationUrl}\n\n© ${new Date().getFullYear()} Papyri.`,
    });
  } else {
    if (!config.brevo?.apiKey) { console.warn('[publisher] Brevo not configured, skipping invitation email'); return; }
    const senderEmail = config.email?.senderEmail || config.brevo?.senderEmail || 'contact@papyrihub.com';
    const senderName = config.email?.senderName || 'Papyri';
    console.log(`[publisher] Sending invitation email via Brevo from ${senderEmail} to ${email}`);
    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'api-key': config.brevo.apiKey },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email, name: contactName }],
        subject: `Invitation éditeur Papyri — ${companyName}`,
        htmlContent: html,
        textContent: `Bonjour ${contactName},\n\nVous êtes invité(e) à activer votre compte éditeur Papyri pour ${companyName}.\n\nLien d'activation :\n${activationUrl}`,
      }),
    });
    const brevoData = await brevoRes.json().catch(() => ({}));
    if (!brevoRes.ok) {
      console.error('[publisher] Brevo error:', brevoRes.status, JSON.stringify(brevoData));
      throw new Error(`Échec envoi email Brevo: ${brevoData.message || brevoRes.status}`);
    }
    console.log('[publisher] Invitation email sent, messageId:', brevoData.messageId);
  }
}

async function verifyInvitationToken(token) {
  const { data, error } = await supabaseAdmin
    .from('publishers')
    .select('id, email, contact_name, company_name, status, invitation_expires_at')
    .eq('invitation_token', token)
    .maybeSingle();

  if (error || !data) throw new Error('Token d\'invitation invalide.');
  if (data.status !== 'pending') throw new Error('Ce compte a déjà été activé.');
  if (new Date(data.invitation_expires_at) < new Date()) throw new Error('Ce lien d\'invitation a expiré.');

  return data;
}

async function activatePublisher(token, { password, fullName }) {
  const publisher = await verifyInvitationToken(token);

  // Créer le compte Supabase Auth
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: publisher.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName || publisher.contact_name, role: 'publisher' },
  });

  if (authError) throw authError;

  const userId = authData.user.id;

  // Mettre à jour le publisher avec le user_id + statut actif
  const { error: updateError } = await supabaseAdmin
    .from('publishers')
    .update({
      user_id: userId,
      status: 'active',
      activated_at: new Date().toISOString(),
      invitation_token: null,
    })
    .eq('id', publisher.id);

  if (updateError) throw updateError;

  // Le trigger handle_new_user() crée le profil automatiquement
  // On met à jour le rôle dans le profil
  await supabaseAdmin
    .from('profiles')
    .update({ role: 'publisher', full_name: fullName || publisher.contact_name })
    .eq('id', userId);

  // Email de bienvenue éditeur
  sendPublisherWelcomeEmail(publisher.email, fullName || publisher.contact_name, {
    companyName: publisher.company_name,
    dashboardUrl: `${config.frontendUrl}/publisher/dashboard`,
  }).catch(e => console.warn('[email] sendPublisherWelcomeEmail failed:', e.message));

  return { publisherId: publisher.id, userId };
}

// ──── Profil éditeur ──────────────────────────────────────────

async function getPublisherByUserId(userId) {
  const { data, error } = await supabaseAdmin
    .from('publishers')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Compte éditeur introuvable.');
  return data;
}

async function updatePublisher(publisherId, fields) {
  const allowed = ['company_name', 'contact_name', 'description', 'logo_url', 'website'];
  const update = {};
  for (const k of allowed) { if (fields[k] !== undefined) update[k] = fields[k]; }

  const { data, error } = await supabaseAdmin
    .from('publishers')
    .update(update)
    .eq('id', publisherId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function updatePayoutMethod(publisherId, payoutMethod) {
  const { data, error } = await supabaseAdmin
    .from('publishers')
    .update({ payout_method: payoutMethod })
    .eq('id', publisherId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ──── Livres ──────────────────────────────────────────────────

async function getPublisherBooks(publisherId, { status, type, page = 1, limit = 20 } = {}) {
  let query = supabaseAdmin
    .from('publisher_books')
    .select(`
      id,
      validation_status,
      rejection_reason,
      submitted_at,
      reviewed_at,
      contents (
        id, title, author, cover_url, content_type, format, file_key,
        language, description, duration_seconds, is_published, created_at,
        access_type, price_cents, price_currency, subscription_discount_percent,
        publisher_revenue (
          publisher_amount_cad, sale_type
        )
      )
    `)
    .eq('publisher_id', publisherId)
    .order('submitted_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (status) query = query.eq('validation_status', status);

  const { data, error, count } = await query;
  if (error) throw error;
  return { books: data || [], total: count || 0 };
}

async function submitBook(publisherId, {
  title, author, description, language,
  coverUrl, fileKey, audioFileKey,
  contentType, durationSeconds,
  chapters, // [{ title, fileKey, durationSeconds, position }]
  accessType, priceCents,
  isDraft = false,
}) {
  const needsPrice = accessType === 'paid' || accessType === 'subscription_or_paid';
  const normalizedPriceCents = needsPrice ? (Number(priceCents) || 0) : 0;
  const ebookFormat = String(fileKey || '').toLowerCase().endsWith('.pdf') ? 'pdf' : 'epub';
  // 'both' → crée deux entrées séparées (ebook + audiobook)
  const jobs = [];

  if (contentType === 'ebook' || contentType === 'both') {
    jobs.push({ content_type: 'ebook', format: ebookFormat, file_key: fileKey || '', duration_seconds: null, hasChapters: false });
  }
  if (contentType === 'audiobook' || contentType === 'both') {
    const hasChapters = Array.isArray(chapters) && chapters.length > 0;
    // Durée totale = somme des chapitres si fournis
    const totalDuration = hasChapters
      ? chapters.reduce((s, c) => s + (c.durationSeconds || 0), 0) || durationSeconds || null
      : durationSeconds || null;
    jobs.push({
      content_type: 'audiobook',
      format: 'm4a',
      file_key: hasChapters ? (chapters[0].fileKey || '') : (audioFileKey || fileKey || ''),
      duration_seconds: totalDuration,
      hasChapters,
    });
  }
  if (jobs.length === 0) throw new Error('contentType invalide');

  const results = [];

  for (const job of jobs) {
    const { data: content, error: contentError } = await supabaseAdmin
      .from('contents')
      .insert({
        title:            title   || '',
        author:           author  || '',
        description:      description  || null,
        language:         language     || 'fr',
        cover_url:        coverUrl     || null,
        content_type:     job.content_type,
        format:           job.format,
        file_key:         job.file_key,
        duration_seconds: job.duration_seconds,
        is_published:     false,
        publisher_id:     (publisherId && publisherId !== 'orphan') ? publisherId : null,
        access_type:      accessType  || 'subscription',
        is_purchasable:   needsPrice,
        price_cents:      normalizedPriceCents,
        price_currency:   'EUR',
      })
      .select()
      .single();

    if (contentError) throw contentError;

    // Insérer les chapitres si audiobook avec chapitres
    if (job.hasChapters && job.content_type === 'audiobook') {
      const chapterRows = chapters.map((c, i) => ({
        content_id:       content.id,
        title:            c.title || `Chapitre ${i + 1}`,
        position:         c.position ?? (i + 1),
        file_key:         c.fileKey || '',
        duration_seconds: c.durationSeconds || null,
      }));
      const { error: chapError } = await supabaseAdmin
        .from('audio_chapters')
        .insert(chapterRows);
      if (chapError) throw chapError;
    }

    // Si pas de publisher (contenu direct/orphan) → pas d'entrée publisher_books
    let pb = null;
    if (publisherId && publisherId !== 'orphan') {
      const { data: pbData, error: pbError } = await supabaseAdmin
        .from('publisher_books')
        .insert({ publisher_id: publisherId, content_id: content.id, validation_status: isDraft ? 'draft' : 'pending' })
        .select()
        .single();
      if (pbError) throw pbError;
      pb = pbData;
    }
    results.push({ content, publisherBook: pb });
  }

  return results.length === 1 ? results[0] : results;
}

async function updateDraft(publisherId, contentId, fields, submit = false) {
  // Vérifie que le livre appartient bien à cet éditeur et est en brouillon
  const { data: pb, error: checkError } = await supabaseAdmin
    .from('publisher_books')
    .select('id, validation_status')
    .eq('publisher_id', publisherId)
    .eq('content_id', contentId)
    .maybeSingle();

  if (checkError || !pb) throw new Error('Brouillon introuvable.');
  if (pb.validation_status !== 'draft') throw new Error('Ce livre n\'est pas un brouillon.');

  // Met à jour le contenu
  const contentUpdates = {};
  if (fields.title       != null) contentUpdates.title       = fields.title;
  if (fields.author      != null) contentUpdates.author      = fields.author;
  if (fields.description != null) contentUpdates.description = fields.description;
  if (fields.language    != null) contentUpdates.language    = fields.language;
  if (fields.coverUrl    != null) contentUpdates.cover_url   = fields.coverUrl;
  if (fields.fileKey     != null) contentUpdates.file_key    = fields.fileKey;

  if (Object.keys(contentUpdates).length > 0) {
    const { error: cErr } = await supabaseAdmin.from('contents').update(contentUpdates).eq('id', contentId);
    if (cErr) throw cErr;
  }

  // Si soumission finale → passe en pending
  if (submit) {
    const { error: pbErr } = await supabaseAdmin
      .from('publisher_books')
      .update({ validation_status: 'pending', submitted_at: new Date().toISOString() })
      .eq('id', pb.id);
    if (pbErr) throw pbErr;
  }

  return { success: true };
}

async function deletePublisherBook(publisherId, contentId) {
  // Seulement si rejeté
  const { data: pb, error: checkError } = await supabaseAdmin
    .from('publisher_books')
    .select('id, validation_status')
    .eq('publisher_id', publisherId)
    .eq('content_id', contentId)
    .maybeSingle();

  if (checkError || !pb) throw new Error('Livre introuvable.');
  if (!['rejected', 'draft'].includes(pb.validation_status)) throw new Error('Seuls les brouillons et livres rejetés peuvent être supprimés.');

  await supabaseAdmin.from('publisher_books').delete().eq('id', pb.id);
  await supabaseAdmin.from('contents').delete().eq('id', contentId);
}

// ──── Revenus ─────────────────────────────────────────────────

async function getDashboardData(publisherId) {
  const now   = new Date();
  // 6 derniers mois
  const from6m = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();
  const to6m   = now.toISOString();

  const [revenueRes, booksRes, payoutsRes] = await Promise.all([
    supabaseAdmin
      .from('publisher_revenue')
      .select('publisher_amount_cad, sale_type, payout_id, created_at')
      .eq('publisher_id', publisherId)
      .gte('created_at', from6m)
      .lte('created_at', to6m),
    supabaseAdmin
      .from('publisher_books')
      .select('id, validation_status, created_at, contents(id, title, author, cover_url, content_type)')
      .eq('publisher_id', publisherId)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('publisher_payouts')
      .select('id, amount_cad, status, period_start, period_end, paid_at, created_at')
      .eq('publisher_id', publisherId)
      .order('created_at', { ascending: false })
      .limit(1),
  ]);

  const revenue  = revenueRes.data  || [];
  const books    = booksRes.data    || [];
  const payouts  = payoutsRes.data  || [];

  // KPIs globaux (toute la période)
  const { data: allRevenue } = await supabaseAdmin
    .from('publisher_revenue')
    .select('publisher_amount_cad, sale_type, payout_id')
    .eq('publisher_id', publisherId);

  const allData   = allRevenue || [];
  const totalNorm = allData.filter(r => r.sale_type === 'normal').reduce((s, r) => s + Number(r.publisher_amount_cad), 0);
  const totalBonus = allData.filter(r => r.sale_type === 'bonus').reduce((s, r) => s + Number(r.publisher_amount_cad), 0);
  const totalPaid  = allData.filter(r => r.payout_id).reduce((s, r) => s + Number(r.publisher_amount_cad), 0);
  const pending    = totalNorm + totalBonus - totalPaid;

  // Revenu mensuel (6 mois)
  const monthMap = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthMap[key] = { month: key, label: d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }), normal: 0, bonus: 0 };
  }
  for (const r of revenue) {
    if (!r.created_at) continue;
    const d = new Date(r.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (monthMap[key]) {
      if (r.sale_type === 'normal') monthMap[key].normal += Number(r.publisher_amount_cad);
      else monthMap[key].bonus += Number(r.publisher_amount_cad);
    }
  }
  const monthlySeries = Object.values(monthMap).map(m => ({
    ...m, normal: +m.normal.toFixed(2), bonus: +m.bonus.toFixed(2), total: +(m.normal + m.bonus).toFixed(2),
  }));

  // Livres par statut
  const booksByStatus = { draft: 0, pending: 0, approved: 0, rejected: 0, paused: 0 };
  for (const b of books) booksByStatus[b.validation_status] = (booksByStatus[b.validation_status] || 0) + 1;

  // Prochain paiement planifié (depuis la table scheduler) ou fallback calcul
  let nextPayoutDate = null;
  let scheduledPayout = null;
  try {
    const payoutScheduler = require('./payout-scheduler.service');
    scheduledPayout = await payoutScheduler.getPublisherNextScheduledPayout(publisherId);
    if (scheduledPayout) {
      nextPayoutDate = scheduledPayout.scheduled_for;
    } else {
      const config = await payoutScheduler.getConfig();
      const nextDate = payoutScheduler.computeNextPayoutDate(config.frequency, config.day_of_month, config.day_of_week);
      nextPayoutDate = nextDate.toISOString().split('T')[0];
    }
  } catch {
    nextPayoutDate = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split('T')[0];
  }

  return {
    kpis: {
      pending:   +pending.toFixed(2),
      totalPaid: +totalPaid.toFixed(2),
      total:     +(totalNorm + totalBonus).toFixed(2),
      normal:    +totalNorm.toFixed(2),
      bonus:     +totalBonus.toFixed(2),
      booksTotal: books.length,
      booksPending: booksByStatus.pending,
    },
    monthlySeries,
    nextPayoutDate,
    scheduledPayout,
    lastPayout: payouts[0] || null,
    booksByStatus,
    recentBooks: books.slice(0, 5).map(b => ({
      id: b.id,
      validation_status: b.validation_status,
      created_at: b.created_at,
      title: b.contents?.title || 'Sans titre',
      author: b.contents?.author || '',
      cover_url: b.contents?.cover_url || null,
      content_type: b.contents?.content_type || 'ebook',
      content_id: b.contents?.id,
    })),
  };
}

async function getRevenueSummary(publisherId, { from, to } = {}) {
  let query = supabaseAdmin
    .from('publisher_revenue')
    .select('publisher_amount_cad, sale_type, payout_id')
    .eq('publisher_id', publisherId);

  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);

  const { data, error } = await query;
  if (error) throw error;

  const normal = (data || []).filter(r => r.sale_type === 'normal').reduce((s, r) => s + Number(r.publisher_amount_cad), 0);
  const bonus = (data || []).filter(r => r.sale_type === 'bonus').reduce((s, r) => s + Number(r.publisher_amount_cad), 0);
  const paid = (data || []).filter(r => r.payout_id).reduce((s, r) => s + Number(r.publisher_amount_cad), 0);
  const pending = normal + bonus - paid;

  return { normal: +normal.toFixed(2), bonus: +bonus.toFixed(2), total: +(normal + bonus).toFixed(2), paid: +paid.toFixed(2), pending: +pending.toFixed(2) };
}

async function getRevenueByBook(publisherId, { from, to } = {}) {
  let query = supabaseAdmin
    .from('publisher_revenue')
    .select(`
      content_id,
      sale_type,
      publisher_amount_cad,
      payout_id,
      contents ( id, title, author, cover_url )
    `)
    .eq('publisher_id', publisherId);

  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);

  const { data, error } = await query;
  if (error) throw error;

  // Grouper par contenu
  const map = {};
  for (const row of (data || [])) {
    const cid = row.content_id;
    if (!map[cid]) {
      map[cid] = {
        content: row.contents,
        normal: 0,
        bonus: 0,
        sales: 0,
      };
    }
    map[cid][row.sale_type] += Number(row.publisher_amount_cad);
    map[cid].sales += 1;
  }

  return Object.values(map)
    .map(r => ({ ...r, total: +(r.normal + r.bonus).toFixed(2), normal: +r.normal.toFixed(2), bonus: +r.bonus.toFixed(2) }))
    .sort((a, b) => b.total - a.total);
}

async function getPayouts(publisherId) {
  const { data, error } = await supabaseAdmin
    .from('publisher_payouts')
    .select('*')
    .eq('publisher_id', publisherId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// ──── Codes promo éditeur ─────────────────────────────────────

const PROMO_MONTHLY_LIMIT_DEFAULT = 50;
const PROMO_MAX_DISCOUNT_PERCENT = 80;

async function getPromoCodeQuota(publisherId) {
  const [{ data: usedData, error: usedErr }, { data: pub, error: pubErr }] = await Promise.all([
    supabaseAdmin.rpc('get_publisher_promo_quota', { p_publisher_id: publisherId }),
    supabaseAdmin.from('publishers').select('promo_monthly_limit').eq('id', publisherId).single(),
  ]);
  if (usedErr) throw usedErr;
  if (pubErr) throw pubErr;
  const limit = pub?.promo_monthly_limit ?? PROMO_MONTHLY_LIMIT_DEFAULT;
  const used = usedData || 0;
  return { used, limit, remaining: Math.max(0, limit - used) };
}

async function getPromoCodes(publisherId, { page = 1, limit = 20 } = {}) {
  const { data, error } = await supabaseAdmin
    .from('promo_codes')
    .select('*')
    .eq('publisher_id', publisherId)
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (error) throw error;
  return data || [];
}

async function createPromoCode(publisherId, { code, discountType, discountValue, maxUses, validFrom, validUntil, applicableContents }) {
  // Vérifier le quota mensuel
  const quota = await getPromoCodeQuota(publisherId);
  if (quota.remaining <= 0) throw new Error(`Quota mensuel atteint (${quota.limit} codes/mois).`);

  // Vérifier la limite de réduction
  if (discountType === 'percent' && discountValue > PROMO_MAX_DISCOUNT_PERCENT) {
    throw new Error(`La réduction ne peut pas dépasser ${PROMO_MAX_DISCOUNT_PERCENT}%.`);
  }

  const { data, error } = await supabaseAdmin
    .from('promo_codes')
    .insert({
      code: code.toUpperCase(),
      discount_type: discountType,
      discount_value: discountValue,
      max_uses: maxUses || null,
      valid_from: validFrom || null,
      valid_until: validUntil || null,
      applicable_contents: applicableContents || null,
      publisher_id: publisherId,
      monthly_slot: periodStart(),
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') throw new Error('Ce code promo existe déjà.');
    throw error;
  }
  return data;
}

async function deletePromoCode(publisherId, codeId) {
  const { error } = await supabaseAdmin
    .from('promo_codes')
    .delete()
    .eq('id', codeId)
    .eq('publisher_id', publisherId);

  if (error) throw error;
}

async function togglePromoCode(publisherId, codeId) {
  const { data: current, error: fetchErr } = await supabaseAdmin
    .from('promo_codes')
    .select('is_active')
    .eq('id', codeId)
    .eq('publisher_id', publisherId)
    .single();
  if (fetchErr) throw fetchErr;
  if (!current) throw new Error('Code introuvable.');

  const { data, error } = await supabaseAdmin
    .from('promo_codes')
    .update({ is_active: !current.is_active, updated_at: new Date().toISOString() })
    .eq('id', codeId)
    .eq('publisher_id', publisherId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getPromoCodeUsages(publisherId, codeId) {
  // Vérifier que le code appartient à l'éditeur
  const { data: code, error: codeErr } = await supabaseAdmin
    .from('promo_codes')
    .select('id, code')
    .eq('id', codeId)
    .eq('publisher_id', publisherId)
    .single();
  if (codeErr || !code) throw new Error('Code introuvable.');

  const { data, error } = await supabaseAdmin
    .from('promo_code_usages')
    .select('id, discount_applied, used_at, profiles ( id, full_name, email )')
    .eq('promo_code_id', codeId)
    .order('used_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function adminGetPublisherPromoCodes({ publisherId, status, page = 1, limit = 50 } = {}) {
  let query = supabaseAdmin
    .from('promo_codes')
    .select(`
      id, code, discount_type, discount_value, max_uses, used_count,
      valid_from, valid_until, is_active, monthly_slot, created_at,
      publisher_id,
      publishers ( id, company_name, contact_name, promo_monthly_limit )
    `)
    .not('publisher_id', 'is', null)
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (publisherId) query = query.eq('publisher_id', publisherId);

  const now = new Date().toISOString();
  if (status === 'active')   query = query.eq('is_active', true);
  if (status === 'inactive') query = query.eq('is_active', false);
  if (status === 'expired')  query = query.lt('valid_until', now).not('valid_until', 'is', null);

  const { data, error } = await query;
  if (error) throw error;

  const nowDate = new Date();
  return (data || []).map(p => ({
    ...p,
    publisher: p.publishers || null,
    publishers: undefined,
    isExpired: p.valid_until ? new Date(p.valid_until) < nowDate : false,
    usageRate: p.max_uses ? Math.round((p.used_count / p.max_uses) * 100) : null,
  }));
}

async function adminUpdatePublisherPromoLimit(publisherId, limit) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new Error('La limite doit être un entier entre 1 et 500.');
  }
  const { data, error } = await supabaseAdmin
    .from('publishers')
    .update({ promo_monthly_limit: limit, updated_at: new Date().toISOString() })
    .eq('id', publisherId)
    .select('id, company_name, promo_monthly_limit')
    .single();
  if (error) throw error;
  return data;
}

async function deletePublisher(publisherId) {
  // Récupère l'éditeur avec son user_id et ses stats
  const { data: publisher, error: fetchErr } = await supabaseAdmin
    .from('publishers')
    .select('id, status, user_id, company_name')
    .eq('id', publisherId)
    .maybeSingle();

  if (fetchErr || !publisher) throw new Error('Éditeur introuvable.');

  // Vérifie s'il a des revenus non versés
  const { data: pendingRevenue } = await supabaseAdmin
    .from('publisher_revenue')
    .select('id')
    .eq('publisher_id', publisherId)
    .is('payout_id', null)
    .limit(1);

  if (pendingRevenue?.length > 0) {
    throw new Error('Cet éditeur a des revenus non versés. Effectuez d\'abord le versement avant de supprimer.');
  }

  // Suppression en cascade
  // 1. Récupère les content_ids liés
  const { data: pbRows } = await supabaseAdmin
    .from('publisher_books')
    .select('content_id')
    .eq('publisher_id', publisherId);
  const contentIds = (pbRows || []).map(r => r.content_id);

  // 2. Supprime les données liées
  await supabaseAdmin.from('publisher_books').delete().eq('publisher_id', publisherId);
  if (contentIds.length > 0) {
    await supabaseAdmin.from('contents').delete().in('id', contentIds);
  }
  await supabaseAdmin.from('publisher_promo_codes').delete().eq('publisher_id', publisherId);
  await supabaseAdmin.from('publisher_payouts').delete().eq('publisher_id', publisherId);
  await supabaseAdmin.from('publisher_revenue').delete().eq('publisher_id', publisherId);
  await supabaseAdmin.from('publisher_claims').delete().eq('publisher_id', publisherId);

  // 3. Supprime l'éditeur
  await supabaseAdmin.from('publishers').delete().eq('id', publisherId);

  // 4. Si user_id → remet le rôle à 'user'
  if (publisher.user_id) {
    await supabaseAdmin
      .from('profiles')
      .update({ role: 'user' })
      .eq('id', publisher.user_id);
  }

  return { deleted: true, company_name: publisher.company_name };
}

// ──── Admin : gestion des éditeurs ───────────────────────────

async function getAllPublishers({ status, page = 1, limit = 20, search } = {}) {
  let query = supabaseAdmin
    .from('publishers')
    .select('id, company_name, contact_name, email, status, activated_at, created_at, revenue_grid', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (status) query = query.eq('status', status);
  if (search) query = query.ilike('company_name', `%${search}%`);

  const { data, error, count } = await query;
  if (error) throw error;

  // Enrichir avec stats rapides
  const enriched = await Promise.all((data || []).map(async pub => {
    const [booksRes, revenueRes] = await Promise.all([
      supabaseAdmin.from('publisher_books').select('id', { count: 'exact' }).eq('publisher_id', pub.id).eq('validation_status', 'approved'),
      supabaseAdmin.from('publisher_revenue').select('publisher_amount_cad, payout_id').eq('publisher_id', pub.id),
    ]);
    const totalRevenue = (revenueRes.data || []).reduce((s, r) => s + Number(r.publisher_amount_cad), 0);
    const paidRevenue = (revenueRes.data || []).filter(r => r.payout_id).reduce((s, r) => s + Number(r.publisher_amount_cad), 0);
    return {
      ...pub,
      books_count: booksRes.count || 0,
      total_revenue_cad: +totalRevenue.toFixed(2),
      pending_payout_cad: +(totalRevenue - paidRevenue).toFixed(2),
    };
  }));

  return { publishers: enriched, total: count || 0 };
}

async function getPublisherFull(publisherId, { from, to } = {}) {
  const { data: publisher, error } = await supabaseAdmin
    .from('publishers')
    .select('*')
    .eq('id', publisherId)
    .single();

  if (error) throw error;

  const [books, summary, revenueByBook, payouts] = await Promise.all([
    getPublisherBooks(publisherId),
    getRevenueSummary(publisherId, { from, to }),
    getRevenueByBook(publisherId, { from, to }),
    getPayouts(publisherId),
  ]);

  // Prochain versement estimé : 1er du mois prochain
  const now = new Date();
  const nextPayout = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split('T')[0];

  return { publisher, books: books.books, revenue: summary, revenueByBook, payouts, nextPayoutDate: nextPayout };
}

async function updatePublisherStatus(publisherId, status) {
  const { data, error } = await supabaseAdmin
    .from('publishers')
    .update({ status })
    .eq('id', publisherId)
    .select()
    .single();

  if (error) throw error;

  // Synchroniser la visibilité des contenus selon le statut éditeur
  if (status === 'active') {
    // Republier uniquement les contenus validés (approved)
    const { data: approvedBooks } = await supabaseAdmin
      .from('publisher_books')
      .select('content_id')
      .eq('publisher_id', publisherId)
      .eq('validation_status', 'approved');

    if (approvedBooks?.length) {
      const ids = approvedBooks.map(b => b.content_id);
      await supabaseAdmin.from('contents').update({ is_published: true }).in('id', ids);
    }
  } else {
    // paused, banned, pending → dépublier tous les contenus de cet éditeur
    const { data: publisherBooks } = await supabaseAdmin
      .from('publisher_books')
      .select('content_id')
      .eq('publisher_id', publisherId);

    if (publisherBooks?.length) {
      const ids = publisherBooks.map(b => b.content_id);
      await supabaseAdmin.from('contents').update({ is_published: false }).in('id', ids);
    }
  }

  return data;
}

async function updateRevenueGrid(publisherId, grid) {
  const { data, error } = await supabaseAdmin
    .from('publishers')
    .update({ revenue_grid: grid })
    .eq('id', publisherId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ──── Admin : validation de contenu ──────────────────────────

async function getPendingContent({ page = 1, limit = 20 } = {}) {
  const { data, error, count } = await supabaseAdmin
    .from('publisher_books')
    .select(`
      id, submitted_at,
      publishers ( id, company_name ),
      contents ( id, title, author, cover_url, content_type )
    `, { count: 'exact' })
    .eq('validation_status', 'pending')
    .order('submitted_at', { ascending: true })
    .range((page - 1) * limit, page * limit - 1);

  if (error) throw error;
  return { items: data || [], total: count || 0 };
}

async function approveContent(publisherBookId, adminUserId) {
  const { data: pb, error: fetchError } = await supabaseAdmin
    .from('publisher_books')
    .select('content_id, publisher_id, publishers(email, contact_name), contents(title)')
    .eq('id', publisherBookId)
    .single();

  if (fetchError) throw fetchError;

  // Publier le contenu
  await supabaseAdmin.from('contents').update({ is_published: true }).eq('id', pb.content_id);

  // Mettre à jour le statut de validation
  const { data, error } = await supabaseAdmin
    .from('publisher_books')
    .update({ validation_status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: adminUserId })
    .eq('id', publisherBookId)
    .select()
    .single();

  if (error) throw error;

  // Notifier l'éditeur
  const pub = pb.publishers;
  const bookTitle = pb.contents?.title || 'votre livre';
  if (pub?.email) {
    const frontendUrl = require('../config/env').frontendUrl || 'http://localhost:5173';
    sendPublisherContentApprovedEmail(pub.email, pub.contact_name || pub.email, {
      bookTitle,
      catalogUrl: `${frontendUrl}/catalogue/${pb.content_id}`,
    }).catch(e => console.warn('[email] approveContent notification failed:', e.message));
  }

  return data;
}

async function rejectContent(publisherBookId, adminUserId, reason) {
  const { data: pb, error: fetchError } = await supabaseAdmin
    .from('publisher_books')
    .select('content_id, publisher_id, publishers(email, contact_name), contents(title)')
    .eq('id', publisherBookId)
    .single();

  if (fetchError) throw fetchError;

  const { data, error } = await supabaseAdmin
    .from('publisher_books')
    .update({
      validation_status: 'rejected',
      rejection_reason: reason,
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminUserId,
    })
    .eq('id', publisherBookId)
    .select()
    .single();

  if (error) throw error;

  // Notifier l'éditeur
  const pub = pb.publishers;
  const bookTitle = pb.contents?.title || 'votre livre';
  if (pub?.email) {
    const frontendUrl = require('../config/env').frontendUrl || 'http://localhost:5173';
    sendPublisherContentRejectedEmail(pub.email, pub.contact_name || pub.email, {
      bookTitle,
      reason: reason || null,
      dashboardUrl: `${frontendUrl}/publisher/books`,
    }).catch(e => console.warn('[email] rejectContent notification failed:', e.message));
  }

  return data;
}

async function pauseContent(publisherBookId, adminUserId, reason) {
  const { data: pb, error: fetchError } = await supabaseAdmin
    .from('publisher_books')
    .select('content_id')
    .eq('id', publisherBookId)
    .single();

  if (fetchError) throw fetchError;

  // Dépublier le contenu
  await supabaseAdmin.from('contents').update({ is_published: false }).eq('id', pb.content_id);

  const { data, error } = await supabaseAdmin
    .from('publisher_books')
    .update({
      validation_status: 'paused',
      rejection_reason: reason || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminUserId,
    })
    .eq('id', publisherBookId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function setPendingContent(publisherBookId, adminUserId) {
  const { data, error } = await supabaseAdmin
    .from('publisher_books')
    .update({
      validation_status: 'pending',
      rejection_reason: null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminUserId,
    })
    .eq('id', publisherBookId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ──── Admin : versements ──────────────────────────────────────

async function getPayoutsOverview({ from, to, page = 1, limit = 50 } = {}) {
  // Revenus non encore versés, groupés par éditeur
  let query = supabaseAdmin
    .from('publisher_revenue')
    .select('publisher_id, publisher_amount_cad, sale_type, payout_id, publishers(id, company_name, payout_method)')
    .is('payout_id', null);

  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);

  const { data, error } = await query;
  if (error) throw error;

  const map = {};
  for (const row of (data || [])) {
    const pid = row.publisher_id;
    if (!map[pid]) {
      map[pid] = {
        publisher: row.publishers,
        normal: 0,
        bonus: 0,
      };
    }
    map[pid][row.sale_type] += Number(row.publisher_amount_cad);
  }

  return Object.values(map).map(r => ({
    ...r,
    total_cad: +(r.normal + r.bonus).toFixed(2),
    normal: +r.normal.toFixed(2),
    bonus: +r.bonus.toFixed(2),
  })).sort((a, b) => b.total_cad - a.total_cad);
}

async function createPayout(adminUserId, { publisherId, periodStart: pStart, periodEnd: pEnd, notes }) {
  // Calculer le montant total dû pour la période
  const { data: revenues } = await supabaseAdmin
    .from('publisher_revenue')
    .select('id, publisher_amount_cad')
    .eq('publisher_id', publisherId)
    .is('payout_id', null)
    .gte('created_at', pStart)
    .lte('created_at', pEnd);

  const amount = (revenues || []).reduce((s, r) => s + Number(r.publisher_amount_cad), 0);
  if (amount <= 0) throw new Error('Aucun revenu à verser pour cette période.');

  const { data: publisher } = await supabaseAdmin.from('publishers').select('payout_method').eq('id', publisherId).single();

  const { data: payout, error } = await supabaseAdmin
    .from('publisher_payouts')
    .insert({
      publisher_id: publisherId,
      amount_cad: amount,
      period_start: pStart,
      period_end: pEnd,
      status: 'pending',
      payout_method: publisher?.payout_method,
      reference: buildPayoutReference(),
      notes,
      processed_by: adminUserId,
    })
    .select()
    .single();

  if (error) throw error;

  // Lier les revenus à ce versement
  const revenueIds = (revenues || []).map(r => r.id);
  await supabaseAdmin.from('publisher_revenue').update({ payout_id: payout.id }).in('id', revenueIds);

  return payout;
}

async function updatePayoutStatus(payoutId, status, adminUserId) {
  const { data, error } = await supabaseAdmin
    .from('publisher_payouts')
    .update({ status, processed_at: new Date().toISOString(), processed_by: adminUserId })
    .eq('id', payoutId)
    .select('*, publishers(id, user_id, company_name, email)')
    .single();

  if (error) throw error;

  // Notifier l'éditeur si versement réussi ou échoué
  if (status === 'paid' || status === 'failed') {
    try {
      const notificationsService = require('./notifications.service');
      const publisher = data.publishers;
      if (publisher?.user_id) {
        const title = status === 'paid'
          ? '✅ Versement effectué'
          : '❌ Versement échoué';
        const body = status === 'paid'
          ? `Votre versement de ${Number(data.amount_cad).toFixed(2)} CAD a bien été effectué.`
          : `Votre versement de ${Number(data.amount_cad).toFixed(2)} CAD a échoué. Contactez le support.`;
        await notificationsService.sendToUsers([publisher.user_id], {
          title, body,
          data: { type: 'payout', payoutId, status },
          saveToDb: true,
        });
      }
    } catch (notifErr) {
      console.warn('[publisher] Notification versement échouée:', notifErr.message);
    }
  }

  return data;
}

async function getPayoutsHistory({ status, from, to, page = 1, limit = 50 } = {}) {
  const from_ = (page - 1) * limit;
  const to_   = page * limit - 1;

  let query = supabaseAdmin
    .from('publisher_payouts')
    .select('*, publishers(id, company_name, payout_method)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from_, to_);

  if (status)  query = query.eq('status', status);
  if (from)    query = query.gte('created_at', from);
  if (to)      query = query.lte('created_at', to);

  const { data, error, count } = await query;
  if (error) throw error;
  return { payouts: data || [], total: count || 0 };
}

async function createManualPayout(adminUserId, { publisherId, amountCad, periodStart, periodEnd, status = 'pending', notes }) {
  if (!publisherId) throw new Error('Éditeur requis.');
  const amount = parseFloat(amountCad);
  if (!amount || amount <= 0) throw new Error('Montant invalide.');

  const validStatuses = ['pending', 'processing', 'paid', 'failed'];
  const payoutStatus = validStatuses.includes(status) ? status : 'pending';

  const { data: publisher, error: pubErr } = await supabaseAdmin
    .from('publishers')
    .select('payout_method, company_name')
    .eq('id', publisherId)
    .single();

  if (pubErr || !publisher) throw new Error('Éditeur introuvable.');

  const { data: payout, error } = await supabaseAdmin
    .from('publisher_payouts')
    .insert({
      publisher_id:  publisherId,
      amount_cad:    amount,
      period_start:  periodStart,
      period_end:    periodEnd,
      status:        payoutStatus,
      payout_method: publisher.payout_method,
      reference:     buildPayoutReference(),
      notes,
      processed_by:  adminUserId,
      processed_at:  payoutStatus === 'paid' ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) throw error;
  return payout;
}

async function createAllPayouts(adminUserId, { periodStart, periodEnd, notes } = {}) {
  const overview = await getPayoutsOverview();
  const created = [];
  const errors  = [];

  for (const item of overview) {
    try {
      const payout = await createPayout(adminUserId, {
        publisherId: item.publisher.id,
        periodStart,
        periodEnd,
        notes,
      });
      created.push({ publisher: item.publisher.company_name, reference: payout.reference, amount: payout.amount_cad });
    } catch (e) {
      errors.push({ publisher: item.publisher.company_name, error: e.message });
    }
  }

  return { created, errors };
}

// ──── Enregistrement d'une vente (appelé depuis webhooks) ─────

async function recordSale(contentId, paymentId, bookPriceCad, saleType = 'normal') {
  // Trouver le publisher
  const { data: content } = await supabaseAdmin
    .from('contents')
    .select('publisher_id')
    .eq('id', contentId)
    .maybeSingle();

  if (!content?.publisher_id) return; // contenu admin, pas d'éditeur

  const { data: publisher } = await supabaseAdmin
    .from('publishers')
    .select('revenue_grid')
    .eq('id', content.publisher_id)
    .single();

  const publisherAmount = calcPublisherAmount(bookPriceCad, publisher?.revenue_grid);

  await supabaseAdmin.from('publisher_revenue').insert({
    publisher_id: content.publisher_id,
    content_id: contentId,
    payment_id: paymentId,
    sale_type: saleType,
    book_price_cad: bookPriceCad,
    publisher_amount_cad: publisherAmount,
    period_month: periodStart(),
  });
}

async function getAdminDashboardStats({ from, to } = {}) {
  // Comptage éditeurs par statut (toujours global)
  const { data: publishers } = await supabaseAdmin.from('publishers').select('id, status, created_at');
  const total = publishers?.length || 0;
  const active = publishers?.filter(p => p.status === 'active').length || 0;
  const pending = publishers?.filter(p => p.status === 'pending').length || 0;

  // Contenus en attente de validation (toujours global)
  const { count: pendingContent } = await supabaseAdmin
    .from('publisher_books')
    .select('id', { count: 'exact', head: true })
    .eq('validation_status', 'pending');

  // Helper : appliquer le filtre période sur une query publisher_revenue
  function applyPeriod(q) {
    if (from) q = q.gte('created_at', from);
    if (to)   q = q.lte('created_at', to);
    return q;
  }

  // Revenus totaux non versés (filtré par période si spécifiée, sinon global)
  const unPaidQ = supabaseAdmin.from('publisher_revenue').select('publisher_amount_cad').is('payout_id', null);
  const { data: unPaidRevenue } = await applyPeriod(unPaidQ);
  const totalPending = (unPaidRevenue || []).reduce((s, r) => s + Number(r.publisher_amount_cad), 0);

  // Top 5 éditeurs par revenus (filtré)
  const revQ = supabaseAdmin.from('publisher_revenue').select('publisher_id, publisher_amount_cad');
  const { data: revenueRows } = await applyPeriod(revQ);
  const revenueByPublisher = {};
  (revenueRows || []).forEach(r => {
    revenueByPublisher[r.publisher_id] = (revenueByPublisher[r.publisher_id] || 0) + Number(r.publisher_amount_cad);
  });
  const topPublisherIds = Object.entries(revenueByPublisher)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, amount]) => ({ id, amount }));

  let topPublishers = [];
  if (topPublisherIds.length > 0) {
    const { data: pubData } = await supabaseAdmin
      .from('publishers')
      .select('id, company_name')
      .in('id', topPublisherIds.map(p => p.id));
    topPublishers = topPublisherIds.map(p => ({
      id: p.id,
      company_name: pubData?.find(d => d.id === p.id)?.company_name || '—',
      total_cad: p.amount,
    }));
  }

  // Top 5 livres par nombre de ventes (filtré)
  const salesQ = supabaseAdmin.from('publisher_revenue').select('content_id');
  const { data: salesRows } = await applyPeriod(salesQ);
  const salesByContent = {};
  (salesRows || []).forEach(r => {
    salesByContent[r.content_id] = (salesByContent[r.content_id] || 0) + 1;
  });
  const topContentIds = Object.entries(salesByContent)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => ({ id, count }));

  let topBooks = [];
  if (topContentIds.length > 0) {
    const { data: contentData } = await supabaseAdmin
      .from('contents')
      .select('id, title, author, cover_url, publisher_id')
      .in('id', topContentIds.map(c => c.id));
    topBooks = topContentIds.map(c => ({
      ...c,
      ...(contentData?.find(d => d.id === c.id) || {}),
    }));
  }

  // Catégories tendance (livres publiés par catégorie)
  const { data: catRows } = await supabaseAdmin
    .from('content_categories')
    .select('category_id, categories(name)');
  const countByCat = {};
  (catRows || []).forEach(r => {
    const name = r.categories?.name || r.category_id;
    countByCat[name] = (countByCat[name] || 0) + 1;
  });
  const trendingCategories = Object.entries(countByCat)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({ name, count }));

  // Contenus approuvés (total)
  const { count: approvedContent } = await supabaseAdmin
    .from('publisher_books')
    .select('id', { count: 'exact', head: true })
    .eq('validation_status', 'approved');

  // Nombre de contenus approuvés par éditeur (pour topPublishers)
  const { data: contentCountRows } = await supabaseAdmin
    .from('publisher_books')
    .select('publisher_id')
    .eq('validation_status', 'approved');
  const contentCountByPub = {};
  (contentCountRows || []).forEach(r => {
    contentCountByPub[r.publisher_id] = (contentCountByPub[r.publisher_id] || 0) + 1;
  });
  topPublishers = topPublishers.map(p => ({ ...p, content_count: contentCountByPub[p.id] || 0 }));

  // publisher_name pour topBooks (via publisher_books)
  if (topBooks.length > 0) {
    const { data: pbRows } = await supabaseAdmin
      .from('publisher_books')
      .select('content_id, publishers(id, company_name)')
      .in('content_id', topBooks.map(b => b.id));
    topBooks = topBooks.map(b => {
      const pb = pbRows?.find(r => r.content_id === b.id);
      return { ...b, publisher_name: pb?.publishers?.company_name || '—' };
    });
  }

  // Contenus récents en attente (preview)
  const { data: pendingItems } = await supabaseAdmin
    .from('publisher_books')
    .select('id, submitted_at, contents(title, cover_url), publishers(company_name)')
    .eq('validation_status', 'pending')
    .order('submitted_at', { ascending: false })
    .limit(6);

  return {
    publishers: { total, active, pending },
    pendingContent: pendingContent || 0,
    approvedContent: approvedContent || 0,
    totalPendingPayout: totalPending,
    topPublishers,
    topBooks,
    trendingCategories,
    pendingItems: pendingItems || [],
  };
}

module.exports = {
  // Invitation & activation
  invitePublisher,
  verifyInvitationToken,
  activatePublisher,
  // Profil éditeur
  getPublisherByUserId,
  updatePublisher,
  updatePayoutMethod,
  // Livres
  getPublisherBooks,
  submitBook,
  updateDraft,
  deletePublisherBook,
  // Revenus
  getDashboardData,
  getRevenueSummary,
  getRevenueByBook,
  getPayouts,
  // Codes promo
  getPromoCodeQuota,
  getPromoCodes,
  createPromoCode,
  deletePromoCode,
  togglePromoCode,
  getPromoCodeUsages,
  adminGetPublisherPromoCodes,
  adminUpdatePublisherPromoLimit,
  // Admin
  deletePublisher,
  getAllPublishers,
  getPublisherFull,
  updatePublisherStatus,
  updateRevenueGrid,
  getPendingContent,
  approveContent,
  rejectContent,
  pauseContent,
  setPendingContent,
  getPayoutsOverview,
  getPayoutsHistory,
  createPayout,
  createManualPayout,
  createAllPayouts,
  updatePayoutStatus,
  recordSale,
  getAdminDashboardStats,
};
