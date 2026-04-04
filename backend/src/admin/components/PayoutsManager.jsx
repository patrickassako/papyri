import React, { useState, useEffect, useCallback } from 'react'

const C = {
  terre: '#B5651D', or: '#D4A017', indigo: '#2E4057',
  green: '#27ae60', red: '#e74c3c', blue: '#2196F3', purple: '#9C27B0',
  orange: '#FF9800', grey: '#8c8c8c', lightGrey: '#f0f0f0',
  card: '#ffffff', bg: '#f4f1ec',
  textPrimary: '#1a1a2e', textSecondary: '#6b7280',
}

const PAYOUT_STATUS = {
  pending:    { label: 'En attente',  color: C.orange,  bg: '#fff3e0' },
  processing: { label: 'En cours',   color: C.blue,    bg: '#e3f2fd' },
  paid:       { label: 'Versé',      color: C.green,   bg: '#e8f5e9' },
  failed:     { label: 'Échoué',     color: C.red,     bg: '#ffebee' },
}

const PAYOUT_METHOD_LABELS = {
  bank_transfer: 'Virement bancaire',
  mobile_money:  'Mobile Money',
  paypal:        'PayPal',
}

const S = {
  page:     { width: '100%', padding: '32px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', boxSizing: 'border-box', background: C.bg, minHeight: '100vh' },
  card:     { background: C.card, borderRadius: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' },
  btn:      { padding: '9px 16px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' },
  btnSm:    { padding: '6px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' },
  thCell:   { padding: '12px 16px', fontSize: '12px', fontWeight: '700', color: C.grey, textTransform: 'uppercase', letterSpacing: '0.4px', background: '#fafafa', whiteSpace: 'nowrap' },
  tdCell:   { padding: '13px 16px', fontSize: '13px', borderBottom: `1px solid ${C.lightGrey}`, verticalAlign: 'middle' },
  chip:     { display: 'inline-block', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' },
  overlay:  { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' },
  modal:    { background: 'white', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '520px', boxSizing: 'border-box', maxHeight: '90vh', overflowY: 'auto' },
  input:    { width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid #e0e0e0', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'inherit' },
  label:    { display: 'block', fontSize: '13px', fontWeight: '600', color: C.textSecondary, marginBottom: '5px' },
  avatar:   { width: '36px', height: '36px', borderRadius: '50%', background: C.terre, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '800', fontSize: '14px', flexShrink: 0 },
  tab:      { padding: '10px 20px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', border: 'none', background: 'transparent', transition: 'all 0.15s', borderBottom: '3px solid transparent' },
}

function Icon({ n, size = 16, color = 'currentColor', style }) {
  const p = {
    dollar:         '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>',
    'check-circle': '<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    check:          '<polyline points="20 6 9 17 4 12"/>',
    plus:           '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    'layers':       '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
    'list':         '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
    'edit-2':       '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
    'alert-circle': '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
    'chevron-left': '<polyline points="15 18 9 12 15 6"/>',
    'chevron-right':'<polyline points="9 18 15 12 9 6"/>',
    'x':            '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    'calendar':     '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    'zap':          '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    'clock':        '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    'refresh-cw':   '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>',
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      dangerouslySetInnerHTML={{ __html: p[n] || '' }}
    />
  )
}

function StatusChip({ status }) {
  const s = PAYOUT_STATUS[status] || { label: status, color: C.grey, bg: C.lightGrey }
  return <span style={{ ...S.chip, background: s.bg, color: s.color }}>{s.label}</span>
}

function PayoutMethodLabel({ method }) {
  if (!method) return <span style={{ color: C.grey, fontSize: '12px' }}>—</span>
  const label = PAYOUT_METHOD_LABELS[method.type] || method.type
  const detail = method.type === 'mobile_money' ? ` (${method.operator || ''})` : method.type === 'bank_transfer' ? ` (${method.iban?.slice(0, 10) || ''}…)` : method.email ? ` (${method.email})` : ''
  return <span style={{ fontSize: '12px', color: C.grey }}>{label}{detail}</span>
}

function apiJson(path, method, body) {
  return fetch('/admin/api' + path, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }).then(r => r.json())
}

// ─────────────────────────────────────────────────────────────
// Tab 1 — Revenus à verser
// ─────────────────────────────────────────────────────────────
function TabToVerser({ onSwitchToHistory }) {
  const [payouts, setPayouts]     = useState([])
  const [totalToPay, setTotal]    = useState(0)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)

  // Dialog — créer un versement (unique)
  const [createDialog, setCreateDialog] = useState(null) // item from overview
  const [createForm, setCreateForm]     = useState({ periodStart: '', periodEnd: '', notes: '' })
  const [creating, setCreating]         = useState(false)
  const [createError, setCreateError]   = useState(null)

  // Dialog — tout verser (bulk)
  const [bulkDialog, setBulkDialog]   = useState(false)
  const [bulkForm, setBulkForm]       = useState({ periodStart: '', periodEnd: '', notes: '' })
  const [bulkResult, setBulkResult]   = useState(null) // { created, errors }
  const [bulking, setBulking]         = useState(false)
  const [bulkError, setBulkError]     = useState(null)

  function defaultPeriod() {
    const now   = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
    return { start, end }
  }

  const load = useCallback(() => {
    setLoading(true); setError(null)
    fetch('/admin/api/payouts', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        const list = d.payouts || []
        setPayouts(list)
        setTotal(list.reduce((s, p) => s + p.total_cad, 0))
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate(item) {
    const { start, end } = defaultPeriod()
    setCreateForm({ periodStart: start, periodEnd: end, notes: '' })
    setCreateError(null)
    setCreateDialog(item)
  }

  async function handleCreate() {
    if (!createForm.periodStart || !createForm.periodEnd) { setCreateError('Dates requises.'); return }
    setCreating(true); setCreateError(null)
    const res = await apiJson('/payouts', 'POST', {
      publisherId: createDialog.publisher.id,
      periodStart: createForm.periodStart,
      periodEnd:   createForm.periodEnd,
      notes:       createForm.notes,
    })
    setCreating(false)
    if (res.error || !res.success) { setCreateError(res.error || res.message || 'Erreur inconnue'); return }
    setCreateDialog(null)
    load()
    onSwitchToHistory()
  }

  function openBulk() {
    const { start, end } = defaultPeriod()
    setBulkForm({ periodStart: start, periodEnd: end, notes: '' })
    setBulkResult(null); setBulkError(null)
    setBulkDialog(true)
  }

  async function handleBulk() {
    if (!bulkForm.periodStart || !bulkForm.periodEnd) { setBulkError('Dates requises.'); return }
    setBulking(true); setBulkError(null); setBulkResult(null)
    const res = await apiJson('/payouts-bulk', 'POST', bulkForm)
    setBulking(false)
    if (res.error) { setBulkError(res.error); return }
    setBulkResult(res)
    load()
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '60px', color: C.grey }}>Chargement…</div>
  if (error)   return <div style={{ background: '#ffebee', border: `1px solid ${C.red}`, borderRadius: '10px', padding: '16px', color: '#c62828', margin: '0 0 20px' }}>{error}</div>

  return (
    <>
      {/* Bannière total + bouton tout verser */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: '#fff8f0', border: `1px solid ${C.terre}33`, borderRadius: '14px', padding: '20px 24px', marginBottom: '24px' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: C.terre + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon n="dollar" size={24} color={C.terre} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', color: C.textSecondary }}>Total à verser</div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: totalToPay > 0 ? C.terre : C.grey }}>
            {totalToPay.toFixed(2)} CAD
          </div>
          <div style={{ fontSize: '12px', color: C.grey }}>{payouts.length} éditeur{payouts.length > 1 ? 's' : ''} avec un solde en attente</div>
        </div>
        {payouts.length > 0 && (
          <button style={{ ...S.btn, background: C.terre, color: 'white' }} onClick={openBulk}>
            <Icon n="zap" size={14} color="white" /> Tout verser ({payouts.length})
          </button>
        )}
      </div>

      {payouts.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', padding: '60px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
            <Icon n="check-circle" size={40} color={C.green} />
          </div>
          <div style={{ color: C.grey, fontWeight: '600' }}>Aucun versement en attente</div>
          <div style={{ color: C.grey, fontSize: '13px', marginTop: '4px' }}>Tous les revenus ont été traités</div>
        </div>
      ) : (
        <div style={S.card}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Éditeur', 'Méthode de paiement', 'Ventes normales', 'Bonus', 'Total à verser', 'Action'].map((h, i) => (
                  <th key={h} style={{ ...S.thCell, textAlign: i >= 2 && i <= 4 ? 'right' : i === 5 ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payouts.map((item, idx) => (
                <tr key={item.publisher?.id || idx} style={{ transition: 'background 0.12s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <td style={S.tdCell}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={S.avatar}>{item.publisher?.company_name?.charAt(0).toUpperCase()}</div>
                      <div style={{ fontWeight: '700', color: C.textPrimary }}>{item.publisher?.company_name}</div>
                    </div>
                  </td>
                  <td style={S.tdCell}><PayoutMethodLabel method={item.publisher?.payout_method} /></td>
                  <td style={{ ...S.tdCell, textAlign: 'right', fontWeight: '700', color: C.terre }}>{item.normal.toFixed(2)} CAD</td>
                  <td style={{ ...S.tdCell, textAlign: 'right', fontWeight: '700', color: C.or }}>{item.bonus.toFixed(2)} CAD</td>
                  <td style={{ ...S.tdCell, textAlign: 'right', fontWeight: '800', fontSize: '15px', color: C.textPrimary }}>{item.total_cad.toFixed(2)} CAD</td>
                  <td style={{ ...S.tdCell, textAlign: 'right' }}>
                    <button style={{ ...S.btnSm, background: C.terre, color: 'white' }} onClick={() => openCreate(item)}>
                      <Icon n="plus" size={12} color="white" /> Créer versement
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal créer versement unique */}
      {createDialog && (
        <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) setCreateDialog(null) }}>
          <div style={S.modal}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px', color: C.indigo, fontSize: '18px' }}>Créer un versement</h3>
                <p style={{ margin: 0, fontSize: '13px', color: C.textSecondary }}>{createDialog.publisher?.company_name}</p>
              </div>
              <button onClick={() => setCreateDialog(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.grey }}>
                <Icon n="x" size={20} color={C.grey} />
              </button>
            </div>

            {createError && <div style={{ background: '#ffebee', border: `1px solid ${C.red}`, borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', color: '#c62828', fontSize: '13px' }}>{createError}</div>}

            <div style={{ background: '#fff8f0', borderRadius: '10px', padding: '14px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', color: C.textSecondary, marginBottom: '2px' }}>Montant à verser</div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: C.terre }}>{createDialog.total_cad?.toFixed(2)} CAD</div>
              </div>
              <div style={{ fontSize: '12px', color: C.grey, textAlign: 'right', lineHeight: 1.5 }}>
                <div>Ventes : {createDialog.normal?.toFixed(2)} CAD</div>
                <div>Bonus : {createDialog.bonus?.toFixed(2)} CAD</div>
              </div>
            </div>

            {createDialog.publisher?.payout_method && (
              <div style={{ background: '#f9f9f9', borderRadius: '10px', padding: '10px 14px', marginBottom: '20px', fontSize: '13px', color: C.textSecondary }}>
                <strong>Méthode :</strong> <PayoutMethodLabel method={createDialog.publisher.payout_method} />
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label style={S.label}>Début de période *</label>
                <input type="date" style={S.input} value={createForm.periodStart} onChange={e => setCreateForm(f => ({ ...f, periodStart: e.target.value }))} />
              </div>
              <div>
                <label style={S.label}>Fin de période *</label>
                <input type="date" style={S.input} value={createForm.periodEnd} onChange={e => setCreateForm(f => ({ ...f, periodEnd: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={S.label}>Notes (optionnel)</label>
              <textarea style={{ ...S.input, minHeight: '70px', resize: 'vertical' }} value={createForm.notes} onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button style={{ ...S.btn, background: '#f5f5f5', color: C.textPrimary }} onClick={() => setCreateDialog(null)}>Annuler</button>
              <button style={{ ...S.btn, background: C.terre, color: 'white', opacity: creating ? 0.7 : 1 }} onClick={handleCreate} disabled={creating}>
                {creating ? 'Création…' : <><Icon n="check" size={13} color="white" /> Confirmer le versement</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal tout verser (bulk) */}
      {bulkDialog && (
        <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget && !bulkResult) setBulkDialog(false) }}>
          <div style={S.modal}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px', color: C.indigo, fontSize: '18px' }}>Versement groupé</h3>
                <p style={{ margin: 0, fontSize: '13px', color: C.textSecondary }}>
                  Crée un versement pour les {payouts.length} éditeur{payouts.length > 1 ? 's' : ''} avec solde en attente
                </p>
              </div>
              <button onClick={() => setBulkDialog(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.grey }}>
                <Icon n="x" size={20} color={C.grey} />
              </button>
            </div>

            {bulkResult ? (
              <>
                <div style={{ background: '#e8f5e9', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
                  <div style={{ fontWeight: '700', color: C.green, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Icon n="check-circle" size={16} color={C.green} /> {bulkResult.created?.length} versement{bulkResult.created?.length > 1 ? 's' : ''} créé{bulkResult.created?.length > 1 ? 's' : ''}
                  </div>
                  {bulkResult.created?.map((c, i) => (
                    <div key={i} style={{ fontSize: '13px', color: C.textSecondary, padding: '3px 0' }}>
                      ✓ {c.publisher} — {parseFloat(c.amount).toFixed(2)} CAD ({c.reference})
                    </div>
                  ))}
                </div>
                {bulkResult.errors?.length > 0 && (
                  <div style={{ background: '#ffebee', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
                    <div style={{ fontWeight: '700', color: C.red, marginBottom: '8px' }}>
                      {bulkResult.errors.length} erreur{bulkResult.errors.length > 1 ? 's' : ''}
                    </div>
                    {bulkResult.errors.map((e, i) => (
                      <div key={i} style={{ fontSize: '13px', color: '#c62828', padding: '3px 0' }}>✗ {e.publisher} : {e.error}</div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button style={{ ...S.btn, background: C.indigo, color: 'white' }} onClick={() => { setBulkDialog(false); onSwitchToHistory() }}>
                    Voir l'historique
                  </button>
                </div>
              </>
            ) : (
              <>
                {bulkError && <div style={{ background: '#ffebee', border: `1px solid ${C.red}`, borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', color: '#c62828', fontSize: '13px' }}>{bulkError}</div>}

                <div style={{ background: '#fff8f0', borderRadius: '10px', padding: '14px 18px', marginBottom: '20px' }}>
                  <div style={{ fontSize: '12px', color: C.textSecondary, marginBottom: '2px' }}>Total à verser (tous éditeurs)</div>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: C.terre }}>{totalToPay.toFixed(2)} CAD</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                  <div>
                    <label style={S.label}>Début de période *</label>
                    <input type="date" style={S.input} value={bulkForm.periodStart} onChange={e => setBulkForm(f => ({ ...f, periodStart: e.target.value }))} />
                  </div>
                  <div>
                    <label style={S.label}>Fin de période *</label>
                    <input type="date" style={S.input} value={bulkForm.periodEnd} onChange={e => setBulkForm(f => ({ ...f, periodEnd: e.target.value }))} />
                  </div>
                </div>
                <div style={{ marginBottom: '24px' }}>
                  <label style={S.label}>Notes (optionnel)</label>
                  <textarea style={{ ...S.input, minHeight: '60px', resize: 'vertical' }} value={bulkForm.notes} onChange={e => setBulkForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button style={{ ...S.btn, background: '#f5f5f5', color: C.textPrimary }} onClick={() => setBulkDialog(false)}>Annuler</button>
                  <button style={{ ...S.btn, background: C.terre, color: 'white', opacity: bulking ? 0.7 : 1 }} onClick={handleBulk} disabled={bulking}>
                    {bulking ? 'Création en cours…' : <><Icon n="zap" size={13} color="white" /> Tout verser</>}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// Tab 2 — Historique des versements
// ─────────────────────────────────────────────────────────────
function TabHistorique() {
  const [payouts, setPayouts]   = useState([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [page, setPage]         = useState(1)
  const LIMIT = 20

  // Filtres
  const [filterStatus, setFilterStatus] = useState('')
  const [filterFrom, setFilterFrom]     = useState('')
  const [filterTo, setFilterTo]         = useState('')

  // Dialog — changer statut
  const [statusDialog, setStatusDialog] = useState(null) // payout row
  const [newStatus, setNewStatus]       = useState('paid')
  const [savingStatus, setSavingStatus] = useState(false)
  const [statusNote, setStatusNote]     = useState('')

  const load = useCallback(() => {
    setLoading(true); setError(null)
    const qs = new URLSearchParams({ page, limit: LIMIT })
    if (filterStatus) qs.set('status', filterStatus)
    if (filterFrom)   qs.set('from', new Date(filterFrom).toISOString())
    if (filterTo)     qs.set('to',   new Date(filterTo + 'T23:59:59').toISOString())
    fetch('/admin/api/payout-history?' + qs, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setPayouts(d.payouts || [])
        setTotal(d.total || 0)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [page, filterStatus, filterFrom, filterTo])

  useEffect(() => { load() }, [load])

  function openStatus(payout) {
    setNewStatus(payout.status)
    setStatusNote('')
    setStatusDialog(payout)
  }

  async function handleStatusUpdate() {
    setSavingStatus(true)
    const res = await apiJson(`/payouts/${statusDialog.id}/status`, 'PUT', { status: newStatus })
    setSavingStatus(false)
    if (res.error || !res.success) { alert(res.error || res.message || 'Erreur'); return }
    setStatusDialog(null)
    load()
  }

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <>
      {/* Filtres */}
      <div style={{ ...S.card, marginBottom: '20px', padding: '16px 20px', overflow: 'visible' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <select style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid #e0e0e0', fontSize: '13px', fontWeight: '600' }}
            value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}>
            <option value="">Tous les statuts</option>
            {Object.entries(PAYOUT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icon n="calendar" size={14} color={C.grey} />
            <input type="date" style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid #e0e0e0', fontSize: '13px' }}
              value={filterFrom} onChange={e => { setFilterFrom(e.target.value); setPage(1) }} />
            <span style={{ color: C.grey, fontSize: '13px' }}>→</span>
            <input type="date" style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid #e0e0e0', fontSize: '13px' }}
              value={filterTo} onChange={e => { setFilterTo(e.target.value); setPage(1) }} />
          </div>
          {(filterStatus || filterFrom || filterTo) && (
            <button style={{ ...S.btnSm, background: C.lightGrey, color: C.textSecondary }}
              onClick={() => { setFilterStatus(''); setFilterFrom(''); setFilterTo(''); setPage(1) }}>
              <Icon n="x" size={12} color={C.textSecondary} /> Réinitialiser
            </button>
          )}
          <span style={{ marginLeft: 'auto', fontSize: '13px', color: C.grey }}>{total} versement{total > 1 ? 's' : ''}</span>
        </div>
      </div>

      {error && <div style={{ background: '#ffebee', border: `1px solid ${C.red}`, borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', color: '#c62828', fontSize: '13px' }}>{error}</div>}

      <div style={S.card}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: C.grey }}>
            <Icon n="refresh-cw" size={24} color={C.grey} style={{ marginBottom: '12px', display: 'block', margin: '0 auto 12px' }} />
            Chargement…
          </div>
        ) : payouts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <Icon n="list" size={36} color={C.lightGrey} style={{ marginBottom: '12px', display: 'block', margin: '0 auto 12px' }} />
            <div style={{ color: C.grey }}>Aucun versement trouvé</div>
          </div>
        ) : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Référence', 'Éditeur', 'Montant', 'Période', 'Statut', 'Créé le', 'Traité le', ''].map((h, i) => (
                    <th key={i} style={{ ...S.thCell, textAlign: i === 2 ? 'right' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payouts.map(p => {
                  const pub = p.publishers
                  return (
                    <tr key={p.id}
                      onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}>
                      <td style={S.tdCell}>
                        <span style={{ fontFamily: 'monospace', fontSize: '12px', background: '#f5f5f5', padding: '3px 8px', borderRadius: '6px', color: C.textPrimary }}>
                          {p.reference || '—'}
                        </span>
                      </td>
                      <td style={S.tdCell}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ ...S.avatar, width: '30px', height: '30px', fontSize: '12px' }}>
                            {pub?.company_name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: '600', fontSize: '13px' }}>{pub?.company_name || '—'}</div>
                            <PayoutMethodLabel method={pub?.payout_method} />
                          </div>
                        </div>
                      </td>
                      <td style={{ ...S.tdCell, textAlign: 'right', fontWeight: '800', color: C.textPrimary }}>
                        {parseFloat(p.amount_cad).toFixed(2)} CAD
                      </td>
                      <td style={{ ...S.tdCell, fontSize: '12px', color: C.textSecondary }}>
                        {p.period_start ? new Date(p.period_start).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '—'}
                        {' → '}
                        {p.period_end ? new Date(p.period_end).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                      </td>
                      <td style={S.tdCell}><StatusChip status={p.status} /></td>
                      <td style={{ ...S.tdCell, fontSize: '12px', color: C.grey }}>
                        {new Date(p.created_at).toLocaleDateString('fr-FR')}
                      </td>
                      <td style={{ ...S.tdCell, fontSize: '12px', color: C.grey }}>
                        {p.processed_at ? new Date(p.processed_at).toLocaleDateString('fr-FR') : '—'}
                      </td>
                      <td style={{ ...S.tdCell, textAlign: 'right' }}>
                        {p.status !== 'paid' && (
                          <button style={{ ...S.btnSm, background: C.indigo + '15', color: C.indigo, border: `1px solid ${C.indigo}30` }}
                            onClick={() => openStatus(p)}>
                            <Icon n="edit-2" size={11} color={C.indigo} /> Statut
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '16px', borderTop: `1px solid ${C.lightGrey}` }}>
                <button style={{ ...S.btnSm, background: C.lightGrey, color: C.textPrimary, opacity: page === 1 ? 0.4 : 1 }}
                  onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                  <Icon n="chevron-left" size={13} />
                </button>
                <span style={{ fontSize: '13px', color: C.textSecondary }}>Page {page} / {totalPages}</span>
                <button style={{ ...S.btnSm, background: C.lightGrey, color: C.textPrimary, opacity: page === totalPages ? 0.4 : 1 }}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                  <Icon n="chevron-right" size={13} />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal changer statut */}
      {statusDialog && (
        <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) setStatusDialog(null) }}>
          <div style={{ ...S.modal, maxWidth: '400px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px', color: C.indigo, fontSize: '18px' }}>Changer le statut</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: C.textSecondary }}>
                  <span style={{ fontFamily: 'monospace', background: '#f5f5f5', padding: '2px 6px', borderRadius: '4px' }}>{statusDialog.reference}</span>
                  <span>—</span>
                  <span>{statusDialog.publishers?.company_name}</span>
                </div>
              </div>
              <button onClick={() => setStatusDialog(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <Icon n="x" size={20} color={C.grey} />
              </button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', color: C.textSecondary, marginBottom: '8px' }}>Statut actuel</div>
              <StatusChip status={statusDialog.status} />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={S.label}>Nouveau statut *</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {Object.entries(PAYOUT_STATUS).map(([k, v]) => (
                  <button key={k} onClick={() => setNewStatus(k)} style={{
                    padding: '10px', borderRadius: '10px', cursor: 'pointer', fontWeight: '700', fontSize: '13px',
                    border: newStatus === k ? `2px solid ${v.color}` : `2px solid ${C.lightGrey}`,
                    background: newStatus === k ? v.bg : 'white',
                    color: newStatus === k ? v.color : C.textSecondary,
                    transition: 'all 0.15s',
                  }}>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button style={{ ...S.btn, background: '#f5f5f5', color: C.textPrimary }} onClick={() => setStatusDialog(null)}>Annuler</button>
              <button style={{ ...S.btn, background: C.terre, color: 'white', opacity: savingStatus ? 0.7 : 1 }}
                onClick={handleStatusUpdate} disabled={savingStatus || newStatus === statusDialog.status}>
                {savingStatus ? 'Enregistrement…' : <><Icon n="check" size={13} color="white" /> Enregistrer</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// Modal — Nouveau versement manuel
// ─────────────────────────────────────────────────────────────
function ManualPayoutModal({ onClose, onSuccess }) {
  const now   = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  const [publishers, setPublishers] = useState([])
  const [loadingPubs, setLoadingPubs] = useState(true)
  const [form, setForm] = useState({ publisherId: '', amountCad: '', periodStart: start, periodEnd: end, status: 'pending', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)

  useEffect(() => {
    fetch('/admin/api/publishers', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setPublishers(d.publishers || d || []))
      .catch(() => {})
      .finally(() => setLoadingPubs(false))
  }, [])

  async function handleSave() {
    if (!form.publisherId)  { setError('Sélectionnez un éditeur.'); return }
    if (!form.amountCad || parseFloat(form.amountCad) <= 0) { setError('Montant invalide (doit être > 0).'); return }
    if (!form.periodStart || !form.periodEnd) { setError('Dates requises.'); return }
    setSaving(true); setError(null)
    const res = await apiJson('/payouts-manual', 'POST', {
      publisherId:  form.publisherId,
      amountCad:    parseFloat(form.amountCad),
      periodStart:  form.periodStart,
      periodEnd:    form.periodEnd,
      status:       form.status,
      notes:        form.notes,
    })
    setSaving(false)
    if (res.error || !res.success) { setError(res.error || 'Erreur inconnue'); return }
    onSuccess(res.payout)
  }

  const selectedPub = publishers.find(p => p.id === form.publisherId)

  return (
    <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={S.modal}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <h3 style={{ margin: '0 0 4px', color: C.indigo, fontSize: '18px' }}>Nouveau versement manuel</h3>
            <p style={{ margin: 0, fontSize: '13px', color: C.textSecondary }}>Créer un versement avec un montant libre</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <Icon n="x" size={20} color={C.grey} />
          </button>
        </div>

        {error && (
          <div style={{ background: '#ffebee', border: `1px solid ${C.red}`, borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', color: '#c62828', fontSize: '13px' }}>
            {error}
          </div>
        )}

        {/* Éditeur */}
        <div style={{ marginBottom: '14px' }}>
          <label style={S.label}>Éditeur *</label>
          {loadingPubs ? (
            <div style={{ ...S.input, color: C.grey, display: 'flex', alignItems: 'center', gap: '6px' }}>Chargement…</div>
          ) : (
            <select style={{ ...S.input, cursor: 'pointer' }} value={form.publisherId}
              onChange={e => setForm(f => ({ ...f, publisherId: e.target.value }))}>
              <option value="">— Sélectionner un éditeur —</option>
              {publishers.map(p => (
                <option key={p.id} value={p.id}>{p.company_name}</option>
              ))}
            </select>
          )}
          {selectedPub?.payout_method && (
            <div style={{ marginTop: '6px', fontSize: '12px', color: C.grey }}>
              Méthode : <PayoutMethodLabel method={selectedPub.payout_method} />
            </div>
          )}
        </div>

        {/* Montant */}
        <div style={{ marginBottom: '14px' }}>
          <label style={S.label}>Montant (CAD) *</label>
          <div style={{ position: 'relative' }}>
            <input type="number" min="0.01" step="0.01" style={{ ...S.input, paddingRight: '50px' }}
              placeholder="0.00"
              value={form.amountCad}
              onChange={e => setForm(f => ({ ...f, amountCad: e.target.value }))} />
            <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: C.grey, pointerEvents: 'none' }}>CAD</span>
          </div>
        </div>

        {/* Statut initial */}
        <div style={{ marginBottom: '14px' }}>
          <label style={S.label}>État du versement *</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {Object.entries(PAYOUT_STATUS).map(([k, v]) => (
              <button key={k} type="button" onClick={() => setForm(f => ({ ...f, status: k }))} style={{
                padding: '10px 12px', borderRadius: '10px', cursor: 'pointer',
                fontWeight: '700', fontSize: '13px', textAlign: 'left',
                border: form.status === k ? `2px solid ${v.color}` : `2px solid ${C.lightGrey}`,
                background: form.status === k ? v.bg : 'white',
                color: form.status === k ? v.color : C.textSecondary,
                transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: form.status === k ? v.color : C.lightGrey, flexShrink: 0 }} />
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Période */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
          <div>
            <label style={S.label}>Début de période *</label>
            <input type="date" style={S.input} value={form.periodStart}
              onChange={e => setForm(f => ({ ...f, periodStart: e.target.value }))} />
          </div>
          <div>
            <label style={S.label}>Fin de période *</label>
            <input type="date" style={S.input} value={form.periodEnd}
              onChange={e => setForm(f => ({ ...f, periodEnd: e.target.value }))} />
          </div>
        </div>

        {/* Notes */}
        <div style={{ marginBottom: '24px' }}>
          <label style={S.label}>Notes (optionnel)</label>
          <textarea style={{ ...S.input, minHeight: '65px', resize: 'vertical' }}
            placeholder="Raison du versement, référence externe…"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button style={{ ...S.btn, background: '#f5f5f5', color: C.textPrimary }} onClick={onClose}>Annuler</button>
          <button style={{ ...S.btn, background: C.indigo, color: 'white', opacity: saving ? 0.7 : 1 }}
            onClick={handleSave} disabled={saving}>
            {saving ? 'Création…' : <><Icon n="check" size={13} color="white" /> Créer le versement</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────
export default function PayoutsManager() {
  const [tab, setTab] = useState('to-pay')
  const [manualDialog, setManualDialog]   = useState(false)
  const [manualSuccess, setManualSuccess] = useState(null)

  function handleManualSuccess(payout) {
    setManualDialog(false)
    setManualSuccess(payout)
    setTab('history')
    setTimeout(() => setManualSuccess(null), 4000)
  }

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: C.indigo, margin: '0 0 4px', fontFamily: 'Georgia, serif' }}>
            Versements éditeurs
          </h1>
          <p style={{ fontSize: '14px', color: C.textSecondary, margin: 0 }}>
            Gestion des paiements aux éditeurs partenaires
          </p>
        </div>
        <button style={{ ...S.btn, background: C.indigo, color: 'white' }} onClick={() => setManualDialog(true)}>
          <Icon n="plus" size={14} color="white" /> Nouveau versement
        </button>
      </div>

      {/* Notification succès */}
      {manualSuccess && (
        <div style={{ background: '#e8f5e9', border: `1px solid ${C.green}33`, borderRadius: '12px', padding: '14px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Icon n="check-circle" size={18} color={C.green} />
          <span style={{ fontSize: '14px', color: C.green, fontWeight: '600' }}>
            Versement créé : <span style={{ fontFamily: 'monospace' }}>{manualSuccess.reference}</span> — {parseFloat(manualSuccess.amount_cad).toFixed(2)} CAD
          </span>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: `2px solid ${C.lightGrey}` }}>
        <button style={{
          ...S.tab,
          color: tab === 'to-pay' ? C.terre : C.grey,
          borderBottom: tab === 'to-pay' ? `3px solid ${C.terre}` : '3px solid transparent',
        }} onClick={() => setTab('to-pay')}>
          <Icon n="dollar" size={14} color={tab === 'to-pay' ? C.terre : C.grey} style={{ marginRight: '6px' }} />
          À verser
        </button>
        <button style={{
          ...S.tab,
          color: tab === 'history' ? C.terre : C.grey,
          borderBottom: tab === 'history' ? `3px solid ${C.terre}` : '3px solid transparent',
        }} onClick={() => setTab('history')}>
          <Icon n="list" size={14} color={tab === 'history' ? C.terre : C.grey} style={{ marginRight: '6px' }} />
          Historique
        </button>
      </div>

      {tab === 'to-pay'  && <TabToVerser onSwitchToHistory={() => setTab('history')} />}
      {tab === 'history' && <TabHistorique key={manualSuccess?.id} />}

      {manualDialog && (
        <ManualPayoutModal
          onClose={() => setManualDialog(false)}
          onSuccess={handleManualSuccess}
        />
      )}
    </div>
  )
}
