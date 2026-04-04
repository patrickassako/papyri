/**
 * InvoicePreview — AdminJS custom action component
 * Renders an HTML preview of the invoice with current app_settings applied.
 * Mounted at /admin/resources/app_settings/actions/previewInvoice
 */
import React, { useState, useEffect } from 'react'

// Format a number as currency
function formatAmount(amount, currency) {
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency || 'USD' }).format(amount)
  } catch {
    return `${amount} ${currency || 'USD'}`
  }
}

// Build a preview invoice number
function buildPreviewNumber(prefix) {
  const now = new Date()
  const yy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  return `${prefix || 'INV'}-${yy}${mm}-APERCU`
}

const InvoicePreview = (props) => {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pdfLoading, setPdfLoading] = useState(false)

  useEffect(() => {
    fetch('/admin/invoice-preview-data')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((d) => { setSettings(d); setLoading(false) })
      .catch((e) => { setError(e.message); setLoading(false) })
  }, [])

  const handleDownloadPDF = () => {
    setPdfLoading(true)
    // Open in new tab — endpoint generates PDF + redirects to token URL
    const win = window.open('/admin/invoice-preview-pdf', '_blank')
    // Reset button after a moment
    setTimeout(() => setPdfLoading(false), 3000)
  }

  // ── Loading / Error states ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={styles.centered}>
        <div style={styles.spinner} />
        <p style={{ color: '#888', marginTop: '1rem' }}>Chargement des paramètres…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={styles.centered}>
        <p style={{ color: '#e53e3e' }}>Erreur lors du chargement : {error}</p>
        <button style={styles.btnBack} onClick={() => window.history.back()}>← Retour</button>
      </div>
    )
  }

  // ── Computed values ─────────────────────────────────────────────────────────
  const primary  = settings.invoice_primary_color || '#B5651D'
  const accent   = settings.invoice_accent_color  || '#D4A017'
  const today    = new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })
  const invNum   = buildPreviewNumber(settings.invoice_prefix)

  // Sample data
  const sampleAmount   = 9.99
  const sampleCurrency = 'USD'
  const samplePlan     = 'Plan Solo Mensuel'
  const sampleUser     = { name: 'Nom du Client', email: 'client@exemple.com' }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={styles.page}>

      {/* ── Top bar ─────────────────────────────────── */}
      <div style={styles.topBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button style={styles.btnBack} onClick={() => window.history.back()}>
            ← Retour aux paramètres
          </button>
          <span style={{ color: '#aaa', fontSize: '.85rem' }}>
            Aperçu basé sur les paramètres actuels (données fictives)
          </span>
        </div>
        <button
          style={{ ...styles.btnPrimary, background: primary, opacity: pdfLoading ? 0.7 : 1 }}
          onClick={handleDownloadPDF}
          disabled={pdfLoading}
        >
          {pdfLoading ? '⏳ Génération…' : '⬇ Télécharger PDF'}
        </button>
      </div>

      {/* ── Invoice card ────────────────────────────── */}
      <div style={styles.card}>

        {/* Header */}
        <div style={{ ...styles.header, borderBottomColor: primary }}>
          <div>
            {settings.invoice_logo_url && (
              <img
                src={settings.invoice_logo_url}
                alt="Logo"
                style={{ maxHeight: '60px', maxWidth: '180px', objectFit: 'contain', marginBottom: '.75rem', display: 'block' }}
              />
            )}
            <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: primary, lineHeight: 1.2 }}>
              {settings.company_name || 'Votre Société'}
            </div>
            {settings.company_tagline && (
              <div style={{ color: '#888', fontSize: '.9rem', marginTop: '.25rem' }}>
                {settings.company_tagline}
              </div>
            )}
            <div style={{ marginTop: '1rem', fontSize: '.85rem', color: '#555', lineHeight: 1.7 }}>
              {settings.company_address && <div>{settings.company_address}</div>}
              {settings.company_email   && <div>{settings.company_email}</div>}
              {settings.company_phone   && <div>{settings.company_phone}</div>}
              {settings.company_website && <div>{settings.company_website}</div>}
              {settings.company_vat_id  && <div>N° TVA / IFU : {settings.company_vat_id}</div>}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '2.2rem', fontWeight: 800, color: accent, letterSpacing: '.05em' }}>
              FACTURE
            </div>
            <div style={{ fontSize: '.95rem', color: '#444', marginTop: '.4rem' }}>
              N° <strong>{invNum}</strong>
            </div>
            <div style={{ fontSize: '.85rem', color: '#888', marginTop: '.25rem' }}>
              Émis le {today}
            </div>
            <div style={{ marginTop: '1rem', display: 'inline-block', background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: '20px', padding: '.2rem .85rem', fontSize: '.8rem', fontWeight: 600 }}>
              ✓ Payé
            </div>
          </div>
        </div>

        {/* Client block */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid #f0f0f0' }}>
          <div>
            <div style={styles.sectionLabel}>Facturé à</div>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>{sampleUser.name}</div>
            <div style={{ color: '#666', fontSize: '.9rem' }}>{sampleUser.email}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={styles.sectionLabel}>Référence paiement</div>
            <div style={{ fontSize: '.85rem', color: '#555', fontFamily: 'monospace' }}>
              pi_sample_preview_00001
            </div>
            <div style={{ fontSize: '.8rem', color: '#888', marginTop: '.25rem' }}>via Stripe</div>
          </div>
        </div>

        {/* Items table */}
        <table style={styles.table}>
          <thead>
            <tr style={{ background: primary }}>
              <th style={{ ...styles.th, textAlign: 'left' }}>Description</th>
              <th style={{ ...styles.th, textAlign: 'center', width: '100px' }}>Qté</th>
              <th style={{ ...styles.th, textAlign: 'right', width: '140px' }}>Montant</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={styles.td}>
                <strong>{samplePlan}</strong>
                <div style={{ fontSize: '.8rem', color: '#888', marginTop: '.2rem' }}>
                  Abonnement {settings.company_name || 'Papyri'} — {today}
                </div>
              </td>
              <td style={{ ...styles.td, textAlign: 'center' }}>1</td>
              <td style={{ ...styles.td, textAlign: 'right' }}>{formatAmount(sampleAmount, sampleCurrency)}</td>
            </tr>
          </tbody>
        </table>

        {/* Total */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '1.5rem 0 2rem' }}>
          <div style={{ width: '280px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '.4rem 0', fontSize: '.9rem', color: '#555' }}>
              <span>Sous-total</span>
              <span>{formatAmount(sampleAmount, sampleCurrency)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '.8rem 0', borderTop: `2px solid ${primary}`, fontWeight: 700, fontSize: '1.1rem', marginTop: '.25rem' }}>
              <span>Total</span>
              <span style={{ color: primary }}>{formatAmount(sampleAmount, sampleCurrency)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        {(settings.invoice_footer_text || settings.invoice_notes) && (
          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1.25rem', fontSize: '.8rem', color: '#888', lineHeight: 1.7 }}>
            {settings.invoice_footer_text && <div>{settings.invoice_footer_text}</div>}
            {settings.invoice_notes && (
              <div style={{ marginTop: '.5rem', padding: '.75rem', background: '#f9fafb', borderRadius: '6px', color: '#555' }}>
                {settings.invoice_notes}
              </div>
            )}
          </div>
        )}

        {/* Aperçu badge */}
        <div style={{ textAlign: 'center', marginTop: '2rem', padding: '1rem', background: '#fffbeb', border: '1px dashed #fbbf24', borderRadius: '8px', color: '#92400e', fontSize: '.8rem' }}>
          ⚠ Ceci est un aperçu avec des données fictives — la facture réelle contiendra les informations du client
        </div>
      </div>
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = {
  page: {
    padding: '1.5rem 2rem',
    maxWidth: '860px',
    margin: '0 auto',
    fontFamily: "'Segoe UI', -apple-system, sans-serif",
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
    padding: '1rem 1.25rem',
    background: 'white',
    borderRadius: '10px',
    boxShadow: '0 1px 6px rgba(0,0,0,.07)',
  },
  card: {
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    padding: '2.5rem 3rem',
    boxShadow: '0 2px 16px rgba(0,0,0,.06)',
    fontFamily: 'Georgia, serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '2rem',
    paddingBottom: '1.5rem',
    borderBottom: '3px solid #B5651D',
  },
  sectionLabel: {
    fontSize: '.75rem',
    fontWeight: 700,
    color: '#aaa',
    textTransform: 'uppercase',
    letterSpacing: '.08em',
    marginBottom: '.35rem',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    padding: '.7rem 1rem',
    color: 'white',
    fontSize: '.8rem',
    fontWeight: 600,
    fontFamily: "'Segoe UI', sans-serif",
  },
  td: {
    padding: '.85rem 1rem',
    fontSize: '.9rem',
    borderBottom: '1px solid #f0f0f0',
  },
  btnBack: {
    padding: '.5rem 1.25rem',
    background: '#f3f4f6',
    border: '1px solid #d1d5db',
    borderRadius: '7px',
    cursor: 'pointer',
    fontSize: '.875rem',
    color: '#374151',
    fontFamily: "'Segoe UI', sans-serif",
  },
  btnPrimary: {
    padding: '.5rem 1.5rem',
    color: 'white',
    border: 'none',
    borderRadius: '7px',
    cursor: 'pointer',
    fontSize: '.875rem',
    fontWeight: 600,
    fontFamily: "'Segoe UI', sans-serif",
  },
  centered: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem',
  },
  spinner: {
    width: '36px',
    height: '36px',
    border: '3px solid #e5e7eb',
    borderTop: '3px solid #B5651D',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
}

export default InvoicePreview
