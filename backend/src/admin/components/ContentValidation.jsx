import React, { useState, useEffect } from 'react'

const C = { terre: '#B5651D', indigo: '#2E4057', green: '#27ae60', red: '#e74c3c', orange: '#FF9800', grey: '#8c8c8c', lightGrey: '#f0f0f0', card: '#ffffff', bg: '#f4f1ec', textPrimary: '#1a1a2e', textSecondary: '#6b7280' }

const S = {
  page: { width: '100%', padding: '32px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', boxSizing: 'border-box', background: C.bg, minHeight: '100vh' },
  card: { background: C.card, borderRadius: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' },
  btn: { padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' },
  thCell: { padding: '12px 16px', fontSize: '12px', fontWeight: '700', color: C.grey, textTransform: 'uppercase', letterSpacing: '0.4px', background: '#fafafa' },
  tdCell: { padding: '14px 16px', fontSize: '13px', borderBottom: `1px solid ${C.lightGrey}`, verticalAlign: 'middle' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' },
  modal: { background: 'white', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '480px', boxSizing: 'border-box' },
}

// Feather-style SVG icon helper
function Icon({ n, size = 16, color = 'currentColor', style }) {
  const p = {
    'check-circle': '<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    'x-circle':     '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
    check:          '<polyline points="20 6 9 17 4 12"/>',
    x:              '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    'file-text':    '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      dangerouslySetInnerHTML={{ __html: p[n] || '' }}
    />
  )
}

export default function ContentValidation() {
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [approvingId, setApprovingId] = useState(null)
  const [rejectDialog, setRejectDialog] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)

  function load() {
    setLoading(true)
    fetch('/admin/api/content/pending', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setItems(d.items || []); setTotal(d.total || 0) })
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  async function approve(id) {
    setApprovingId(id)
    try {
      await fetch(`/admin/api/content/${id}/approve`, { method: 'PUT', credentials: 'include' })
      setItems(prev => prev.filter(i => i.id !== id))
      setTotal(t => Math.max(0, t - 1))
    } catch (e) { alert(e.message) } finally { setApprovingId(null) }
  }

  async function reject() {
    if (!rejectReason.trim()) return
    setRejecting(true)
    try {
      await fetch(`/admin/api/content/${rejectDialog.id}/reject`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      })
      setItems(prev => prev.filter(i => i.id !== rejectDialog.id))
      setTotal(t => Math.max(0, t - 1))
      setRejectDialog(null); setRejectReason('')
    } catch (e) { alert(e.message) } finally { setRejecting(false) }
  }

  return (
    <div style={S.page}>
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: C.indigo, margin: 0, fontFamily: 'Georgia, serif' }}>Validation de contenu</h1>
          {total > 0 && <span style={{ background: '#fff3e0', color: C.orange, border: '1px solid #ff980033', borderRadius: '20px', padding: '3px 12px', fontSize: '13px', fontWeight: '700' }}>{total} en attente</span>}
        </div>
        <p style={{ fontSize: '14px', color: C.textSecondary, margin: 0 }}>Contenus soumis par les éditeurs en attente de votre validation</p>
      </div>

      <div style={S.card}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: C.grey }}>Chargement…</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
              <Icon n="check-circle" size={52} color={C.green} />
            </div>
            <div style={{ fontWeight: '700', color: C.green, fontSize: '16px' }}>File vide</div>
            <div style={{ color: C.grey, marginTop: '4px' }}>Aucun contenu en attente de validation</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Contenu', 'Éditeur', 'Type', 'Soumis le', 'Actions'].map((h, i) => (
                  <th key={h} style={{ ...S.thCell, textAlign: i === 4 ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const content = item.contents
                const publisher = item.publishers
                const isApproving = approvingId === item.id
                const ct = content?.content_type
                return (
                  <tr key={item.id}>
                    <td style={S.tdCell}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {content?.cover_url
                          ? <img src={content.cover_url} alt="" style={{ width: '36px', height: '50px', objectFit: 'cover', borderRadius: '5px' }} />
                          : <div style={{ width: '36px', height: '50px', background: '#f0ede8', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Icon n="file-text" size={18} color={C.grey} />
                            </div>
                        }
                        <div>
                          <div style={{ fontWeight: '700', color: C.textPrimary }}>{content?.title || '—'}</div>
                          <div style={{ fontSize: '12px', color: C.grey }}>{content?.author}</div>
                        </div>
                      </div>
                    </td>
                    <td style={S.tdCell}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: C.terre, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '12px' }}>
                          {publisher?.company_name?.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: '600', fontSize: '13px' }}>{publisher?.company_name}</span>
                      </div>
                    </td>
                    <td style={S.tdCell}>
                      <span style={{ background: '#f0ede8', color: '#5d4037', borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: '700' }}>
                        {ct === 'audio' ? 'Audio' : ct === 'both' ? 'Ebook + Audio' : 'Ebook'}
                      </span>
                    </td>
                    <td style={{ ...S.tdCell, fontSize: '12px', color: C.grey }}>{new Date(item.submitted_at).toLocaleDateString('fr-FR')}</td>
                    <td style={{ ...S.tdCell, textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => approve(item.id)}
                          disabled={isApproving}
                          style={{ ...S.btn, background: '#e8f5e9', color: C.green, border: `1px solid ${C.green}33`, opacity: isApproving ? 0.6 : 1 }}
                        >
                          {isApproving ? '…' : <><Icon n="check" size={13} color={C.green} /> Approuver</>}
                        </button>
                        <button
                          onClick={() => { setRejectDialog({ id: item.id, title: content?.title }); setRejectReason('') }}
                          style={{ ...S.btn, background: '#ffebee', color: C.red, border: `1px solid ${C.red}33` }}
                        >
                          <Icon n="x" size={13} color={C.red} /> Rejeter
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal rejet */}
      {rejectDialog && (
        <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) setRejectDialog(null) }}>
          <div style={S.modal}>
            <h3 style={{ margin: '0 0 6px', color: C.red, fontSize: '18px' }}>Rejeter ce contenu</h3>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: C.textSecondary }}>
              L'éditeur recevra ce motif par email et pourra corriger et re-soumettre.
            </p>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Motif de rejet *</label>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Ex: La description est insuffisante. Le fichier EPUB contient des erreurs de formatage…"
              style={{ width: '100%', minHeight: '100px', padding: '10px', borderRadius: '10px', border: '1px solid #e0e0e0', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button style={{ ...S.btn, background: '#f5f5f5', color: C.textSecondary }} onClick={() => setRejectDialog(null)}>Annuler</button>
              <button
                style={{ ...S.btn, background: C.red, color: 'white', opacity: rejecting || !rejectReason.trim() ? 0.6 : 1 }}
                onClick={reject}
                disabled={rejecting || !rejectReason.trim()}
              >
                {rejecting ? '…' : <><Icon n="x-circle" size={14} color="white" /> Confirmer le rejet</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
