/**
 * Invoice Service
 * Generates PDF invoices for payments using PDFKit
 * Company info is loaded dynamically from app_settings (configurable in admin panel)
 */

const PDFDocument = require('pdfkit');
const { getDefaultSettings } = require('./settings.service');

/**
 * Fetches an image from a URL and returns a Buffer.
 * Used to embed the company logo into PDF invoices.
 * @param {string} url
 * @returns {Promise<Buffer>}
 */
function fetchImageBuffer(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? require('https') : require('http');
    const req = lib.get(url, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return reject(new Error(`Logo HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('Logo fetch timeout')); });
  });
}

// Static colours that do not come from settings (structural)
const COLOR_DARK   = '#1a1a1a';
const COLOR_GREY   = '#888888';
const COLOR_LIGHT  = '#f5f5f0';
const COLOR_BORDER = '#e0dbd0';

/**
 * Formats an amount with currency symbol.
 */
function formatMoney(amount, currency = 'USD') {
  const n = Number(amount || 0);
  const symbols = { USD: '$', EUR: '€', XAF: 'XAF ', GBP: '£', NGN: '₦', GHS: '₵', KES: 'KSh ' };
  const sym = symbols[currency] || `${currency} `;
  return `${sym}${n.toFixed(2)}`;
}

/**
 * Formats a date to "DD Month YYYY" in French.
 */
function formatDateFr(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

/**
 * Builds a short invoice number from payment id, date, and configurable prefix.
 * e.g. INV-20260224-A3F2
 */
function buildInvoiceNumber(paymentId, paidAt, prefix = 'INV') {
  const d = paidAt ? new Date(paidAt) : new Date();
  const datePart = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('');
  const shortId = paymentId.slice(-4).toUpperCase();
  return `${prefix}-${datePart}-${shortId}`;
}

/**
 * Returns a human-readable description for a payment_type.
 */
function paymentTypeLabel(metadata = {}) {
  const type = metadata.payment_type || '';
  const planName = metadata.plan_name || metadata.plan_code || 'Abonnement';
  switch (type) {
    case 'subscription_initial':  return `Souscription — ${planName}`;
    case 'subscription_renewal':  return `Renouvellement — ${planName}`;
    case 'extra_seat':            return `Place supplémentaire — ${planName}`;
    case 'content_unlock':        return `Déverrouillage contenu`;
    default:                      return planName;
  }
}

/**
 * Draws a horizontal rule.
 */
function hRule(doc, y, color = COLOR_BORDER) {
  doc.moveTo(50, y).lineTo(545, y).strokeColor(color).lineWidth(0.8).stroke();
}

/**
 * Generates a PDF invoice and pipes it to the provided writable stream.
 *
 * @param {object} options
 * @param {object} options.payment      - Payment row from DB
 * @param {object} options.user         - { email, full_name }
 * @param {object} options.subscription - Subscription row (may be null)
 * @param {object} options.settings     - App settings from DB (app_settings row)
 * @param {WritableStream} options.stream - Target stream (res)
 */
async function generateInvoicePDF({ payment, user, subscription, settings, stream }) {
  // Merge with defaults so any missing field is covered
  const s = { ...getDefaultSettings(), ...(settings || {}) };

  const COLOR_PRIMARY = s.invoice_primary_color || '#B5651D';
  const COLOR_GOLD    = s.invoice_accent_color   || '#D4A017';
  const prefix        = s.invoice_prefix         || 'INV';

  // Pre-fetch logo before opening the PDF stream (logo fetch is async)
  let logoBuffer = null;
  if (s.invoice_logo_url && s.invoice_logo_url.trim()) {
    try {
      logoBuffer = await fetchImageBuffer(s.invoice_logo_url.trim());
    } catch (e) {
      console.warn('Invoice logo fetch failed (skipped):', e.message);
    }
  }

  const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: false });
  doc.pipe(stream);

  const invoiceNumber = buildInvoiceNumber(payment.id, payment.paid_at || payment.created_at, prefix);
  const issueDate     = formatDateFr(payment.paid_at || payment.created_at);
  const description   = paymentTypeLabel(payment.metadata || {});
  const amount        = formatMoney(payment.amount, payment.currency || 'USD');
  const providerLabel = payment.provider === 'stripe' ? 'Stripe (carte bancaire)' : 'Flutterwave (Mobile Money)';
  const statusLabel   = payment.status === 'succeeded' ? 'Payée' : payment.status === 'pending' ? 'En attente' : 'Échouée';

  /* ------------------------------------------------------------------ */
  /* HEADER — logo or company name (left side)                           */
  /* ------------------------------------------------------------------ */
  let detailY;

  if (logoBuffer) {
    // With logo: image top-left + company name in smaller text below
    doc.image(logoBuffer, 50, 45, { fit: [170, 65], align: 'left' });
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(COLOR_PRIMARY)
      .text(s.company_name, 50, 118);
    detailY = 134;
  } else {
    // Without logo: large two-tone company name (original behaviour)
    const nameParts = s.company_name.split(' — ');
    const nameFirst = nameParts[0] || s.company_name;
    const nameRest  = nameParts.length > 1 ? ` — ${nameParts.slice(1).join(' — ')}` : '';

    doc
      .font('Helvetica-Bold')
      .fontSize(22)
      .fillColor(COLOR_PRIMARY)
      .text(nameFirst, 50, 50, { continued: Boolean(nameRest) });

    if (nameRest) {
      doc
        .font('Helvetica')
        .fontSize(22)
        .fillColor(COLOR_DARK)
        .text(nameRest);
    }
    detailY = 78;
  }

  // Company details (address, email, phone, website, VAT)
  const companyDetails = [
    s.company_address,
    s.company_email,
    s.company_website,
    s.company_phone,
    s.company_vat_id ? `N° TVA / SIRET : ${s.company_vat_id}` : null,
  ].filter(Boolean);

  companyDetails.forEach((line) => {
    doc.font('Helvetica').fontSize(9).fillColor(COLOR_GREY).text(line, 50, detailY);
    detailY += 11;
  });

  /* FACTURE title on the right (always at the same position) */
  doc
    .font('Helvetica-Bold')
    .fontSize(30)
    .fillColor(COLOR_GOLD)
    .text('FACTURE', 0, 50, { align: 'right' });

  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(COLOR_GREY)
    .text(`N° ${invoiceNumber}`, 0, 86, { align: 'right' })
    .text(`Émise le : ${issueDate}`, 0, 97, { align: 'right' });

  /* ------------------------------------------------------------------ */
  /* Horizontal rule (pushed down a bit more when logo is shown)        */
  /* ------------------------------------------------------------------ */
  const ruleY = logoBuffer ? Math.max(158, detailY + 6) : Math.max(125, detailY + 6);
  hRule(doc, ruleY, COLOR_PRIMARY);

  /* ------------------------------------------------------------------ */
  /* BILLING TO */
  /* ------------------------------------------------------------------ */
  const billingY = ruleY + 15;

  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor(COLOR_GREY)
    .text('FACTURÉ À', 50, billingY);

  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(COLOR_DARK)
    .text(user.full_name || user.email, 50, billingY + 16);

  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(COLOR_GREY)
    .text(user.email, 50, billingY + 30);

  /* ------------------------------------------------------------------ */
  /* INVOICE DETAILS table header */
  /* ------------------------------------------------------------------ */
  const tableTop = billingY + 75;

  doc
    .rect(50, tableTop, 495, 28)
    .fillColor(COLOR_LIGHT)
    .fill();

  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor(COLOR_GREY)
    .text('DESCRIPTION', 60, tableTop + 9)
    .text('MONTANT', 0, tableTop + 9, { align: 'right', width: 535 });

  hRule(doc, tableTop + 28, COLOR_BORDER);

  /* ------------------------------------------------------------------ */
  /* INVOICE LINE */
  /* ------------------------------------------------------------------ */
  const lineY = tableTop + 38;

  doc
    .font('Helvetica')
    .fontSize(11)
    .fillColor(COLOR_DARK)
    .text(description, 60, lineY);

  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(COLOR_DARK)
    .text(amount, 0, lineY, { align: 'right', width: 535 });

  const subInfoY = lineY + 18;
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(COLOR_GREY)
    .text(`Référence : ${payment.provider_payment_id || payment.id}`, 60, subInfoY)
    .text(`Mode de paiement : ${providerLabel}`, 60, subInfoY + 12);

  /* ------------------------------------------------------------------ */
  /* TOTAL */
  /* ------------------------------------------------------------------ */
  const totalY = subInfoY + 50;

  hRule(doc, totalY, COLOR_PRIMARY);

  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor(COLOR_DARK)
    .text('Total', 60, totalY + 12);

  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor(COLOR_PRIMARY)
    .text(amount, 0, totalY + 12, { align: 'right', width: 535 });

  /* ------------------------------------------------------------------ */
  /* STATUS badge */
  /* ------------------------------------------------------------------ */
  const statusY = totalY + 50;
  const statusColor = payment.status === 'succeeded'
    ? '#1a7f37'
    : payment.status === 'pending' ? '#b56a00' : '#c0392b';
  const statusBg = payment.status === 'succeeded'
    ? '#e6f4ea'
    : payment.status === 'pending' ? '#fff3cd' : '#fdecea';

  doc
    .roundedRect(50, statusY, 120, 26, 6)
    .fillColor(statusBg)
    .fill();

  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor(statusColor)
    .text(statusLabel, 50, statusY + 8, { align: 'center', width: 120 });

  /* ------------------------------------------------------------------ */
  /* NOTES (optional) */
  /* ------------------------------------------------------------------ */
  if (s.invoice_notes && s.invoice_notes.trim()) {
    const notesY = statusY + 50;
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(COLOR_GREY)
      .text(s.invoice_notes.trim(), 50, notesY, { width: 495 });
  }

  /* ------------------------------------------------------------------ */
  /* FOOTER */
  /* ------------------------------------------------------------------ */
  const footerY = 750;
  hRule(doc, footerY, COLOR_BORDER);

  const footerText = s.invoice_footer_text ||
    `Cette facture a été générée automatiquement par ${s.company_name}. Pour toute question : ${s.company_email}`;

  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(COLOR_GREY)
    .text(footerText, 50, footerY + 10, { align: 'center', width: 495 });

  doc.end();
}

/**
 * Generates a PDF invoice and returns a Buffer (for admin panel token flow).
 * Same parameters as generateInvoicePDF but resolves with a Buffer instead of streaming.
 */
function generateInvoicePDFBuffer(options) {
  return new Promise((resolve, reject) => {
    const { PassThrough } = require('stream');
    const stream = new PassThrough();
    const chunks = [];
    stream.on('data', (c) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
    // generateInvoicePDF is async (logo fetch); forward any rejection
    generateInvoicePDF({ ...options, stream }).catch(reject);
  });
}

module.exports = { generateInvoicePDF, generateInvoicePDFBuffer, buildInvoiceNumber };
