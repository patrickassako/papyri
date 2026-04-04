import React, { useState, useEffect } from 'react'

const ZONES = [
  { value: 'africa',        label: 'Afrique' },
  { value: 'europe',        label: 'Europe' },
  { value: 'north_america', label: 'Amérique du Nord' },
  { value: 'south_america', label: 'Amérique du Sud' },
  { value: 'asia',          label: 'Asie' },
  { value: 'middle_east',   label: 'Moyen-Orient' },
  { value: 'oceania',       label: 'Océanie' },
]

const COUNTRIES = [
  { value: 'DZ', label: 'Algérie' }, { value: 'AO', label: 'Angola' },
  { value: 'BJ', label: 'Bénin' }, { value: 'BW', label: 'Botswana' },
  { value: 'BF', label: 'Burkina Faso' }, { value: 'BI', label: 'Burundi' },
  { value: 'CM', label: 'Cameroun' }, { value: 'CV', label: 'Cap-Vert' },
  { value: 'CF', label: 'Centrafrique' }, { value: 'TD', label: 'Tchad' },
  { value: 'KM', label: 'Comores' }, { value: 'CG', label: 'Congo-Brazzaville' },
  { value: 'CD', label: 'Congo-Kinshasa' }, { value: 'CI', label: "Côte d'Ivoire" },
  { value: 'DJ', label: 'Djibouti' }, { value: 'EG', label: 'Égypte' },
  { value: 'GQ', label: 'Guinée équatoriale' }, { value: 'ER', label: 'Érythrée' },
  { value: 'ET', label: 'Éthiopie' }, { value: 'GA', label: 'Gabon' },
  { value: 'GM', label: 'Gambie' }, { value: 'GH', label: 'Ghana' },
  { value: 'GN', label: 'Guinée' }, { value: 'GW', label: 'Guinée-Bissau' },
  { value: 'KE', label: 'Kenya' }, { value: 'LS', label: 'Lesotho' },
  { value: 'LR', label: 'Libéria' }, { value: 'LY', label: 'Libye' },
  { value: 'MG', label: 'Madagascar' }, { value: 'MW', label: 'Malawi' },
  { value: 'ML', label: 'Mali' }, { value: 'MR', label: 'Mauritanie' },
  { value: 'MU', label: 'Maurice' }, { value: 'MA', label: 'Maroc' },
  { value: 'MZ', label: 'Mozambique' }, { value: 'NA', label: 'Namibie' },
  { value: 'NE', label: 'Niger' }, { value: 'NG', label: 'Nigeria' },
  { value: 'RW', label: 'Rwanda' }, { value: 'SN', label: 'Sénégal' },
  { value: 'SC', label: 'Seychelles' }, { value: 'SL', label: 'Sierra Leone' },
  { value: 'SO', label: 'Somalie' }, { value: 'ZA', label: 'Afrique du Sud' },
  { value: 'SS', label: 'Soudan du Sud' }, { value: 'SD', label: 'Soudan' },
  { value: 'SZ', label: 'Eswatini' }, { value: 'TZ', label: 'Tanzanie' },
  { value: 'TG', label: 'Togo' }, { value: 'TN', label: 'Tunisie' },
  { value: 'UG', label: 'Ouganda' }, { value: 'ZM', label: 'Zambie' },
  { value: 'ZW', label: 'Zimbabwe' },
  { value: 'FR', label: 'France' }, { value: 'BE', label: 'Belgique' },
  { value: 'CH', label: 'Suisse' }, { value: 'CA', label: 'Canada' },
  { value: 'US', label: 'États-Unis' }, { value: 'GB', label: 'Royaume-Uni' },
  { value: 'DE', label: 'Allemagne' }, { value: 'ES', label: 'Espagne' },
  { value: 'IT', label: 'Italie' }, { value: 'PT', label: 'Portugal' },
  { value: 'NL', label: 'Pays-Bas' }, { value: 'BR', label: 'Brésil' },
  { value: 'MX', label: 'Mexique' }, { value: 'AR', label: 'Argentine' },
  { value: 'CN', label: 'Chine' }, { value: 'JP', label: 'Japon' },
  { value: 'IN', label: 'Inde' }, { value: 'AU', label: 'Australie' },
  { value: 'AE', label: 'Émirats arabes unis' }, { value: 'SA', label: 'Arabie saoudite' },
  { value: 'QA', label: 'Qatar' },
]

const CURRENCIES = ['EUR', 'USD', 'XAF', 'XOF', 'GBP', 'CAD', 'MAD', 'TND']

const C = {
  terre: '#B5651D', indigo: '#2E4057', green: '#27ae60', red: '#e74c3c',
  orange: '#FF9800', grey: '#8c8c8c', lightGrey: '#f0f0f0',
  card: '#ffffff', bg: '#f4f1ec', textPrimary: '#1a1a2e', textSecondary: '#6b7280',
}
const S = {
  page:  { width: '100%', padding: '32px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', boxSizing: 'border-box', background: C.bg, minHeight: '100vh' },
  card:  { background: C.card, borderRadius: '14px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', marginBottom: '20px' },
  label: { display: 'block', fontSize: '13px', fontWeight: '600', color: C.textSecondary, marginBottom: '5px' },
  input: { width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid #e0e0e0', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' },
  btn:   { padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' },
}

function Icon({ n, size = 16, color = 'currentColor' }) {
  const p = {
    globe:   '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/>',
    plus:    '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    edit:    '<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    trash:   '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>',
    check:   '<polyline points="20 6 9 17 4 12"/>',
    x:       '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    'arrow-left': '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
      dangerouslySetInnerHTML={{ __html: p[n] || '' }}
    />
  )
}

function formatPrice(cents, currency) {
  if (cents == null) return '—'
  const major = (cents / 100).toFixed(2)
  return `${major} ${currency || 'EUR'}`
}

export default function GeographicPricingEditor({ record }) {
  const contentId    = record?.params?.id
  const contentTitle = record?.params?.title || 'Ce contenu'
  const basePriceCents   = record?.params?.price_cents
  const baseCurrency     = record?.params?.price_currency || 'EUR'
  const accessType       = record?.params?.access_type

  const [prices, setPrices]   = useState([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState(null)
  const [success, setSuccess] = useState(null)

  // Form for adding / editing
  const [editingId,   setEditingId]   = useState(null) // null = new, uuid = edit
  const [showForm,    setShowForm]    = useState(false)
  const [form, setForm] = useState({ type: 'zone', zone: '', price_cents: '', currency: 'EUR', notes: '', is_active: true })

  useEffect(() => { if (contentId) load() }, [contentId])

  function load() {
    setLoading(true)
    fetch(`/admin/api/content/${contentId}/geo-pricing`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setPrices(d.prices || []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  function openNew() {
    setEditingId(null)
    setForm({ type: 'zone', zone: '', price_cents: '', currency: 'EUR', notes: '', is_active: true })
    setShowForm(true)
    setError(null)
    setSuccess(null)
  }

  function openEdit(p) {
    // Detect if existing entry is a country (2-char ISO code) or a zone
    const isCountry = p.zone && p.zone.length === 2
    setEditingId(p.id)
    setForm({ type: isCountry ? 'country' : 'zone', zone: isCountry ? '' : p.zone, price_cents: String(p.price_cents), currency: p.currency, notes: p.notes || '', is_active: p.is_active, _countryVal: isCountry ? p.zone : '' })
    setShowForm(true)
    setError(null)
    setSuccess(null)
  }

  async function save() {
    const key = form.type === 'country' ? (form._countryVal || '') : form.zone
    if (!key) { setError(form.type === 'country' ? 'Sélectionnez un pays' : 'Sélectionnez un continent'); return }
    const priceCents = parseInt(form.price_cents, 10)
    if (isNaN(priceCents) || priceCents < 0) { setError('Prix invalide (entier ≥ 0 en centimes)'); return }

    setSaving(true)
    setError(null)
    try {
      const label = form.type === 'country'
        ? COUNTRIES.find(c => c.value === key)?.label || key
        : ZONES.find(z => z.value === key)?.label || key
      const payload  = { zone: key, zone_label: label, price_cents: priceCents, currency: form.currency, notes: form.notes || null, is_active: form.is_active }
      const url      = editingId
        ? `/admin/api/content/geo-pricing/${editingId}`
        : `/admin/api/content/${contentId}/geo-pricing`
      const method   = editingId ? 'PUT' : 'POST'
      const res      = await fetch(url, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data     = await res.json()
      if (data.error) throw new Error(data.error)
      setSuccess(editingId ? 'Prix mis à jour.' : 'Zone ajoutée.')
      setShowForm(false)
      load()
    } catch (e) {
      setError(e.message)
    }
    setSaving(false)
  }

  async function remove(id) {
    if (!window.confirm('Supprimer ce prix géographique ?')) return
    try {
      await fetch(`/admin/api/content/geo-pricing/${id}`, { method: 'DELETE', credentials: 'include' })
      load()
    } catch (e) { setError(e.message) }
  }

  async function toggleActive(p) {
    try {
      await fetch(`/admin/api/content/geo-pricing/${p.id}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...p, is_active: !p.is_active }),
      })
      load()
    } catch (e) { setError(e.message) }
  }

  const usedKeys = prices.map(p => p.zone)
  const availableZones = ZONES.filter(z => !usedKeys.includes(z.value) || z.value === form.zone)
  const availableCountries = COUNTRIES.filter(c => !usedKeys.includes(c.value) || c.value === (form._countryVal || ''))

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
          <Icon n="globe" size={24} color={C.terre} />
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: C.indigo, margin: 0, fontFamily: 'Georgia, serif' }}>
            Prix Géographiques
          </h1>
        </div>
        <p style={{ margin: '0 0 0 36px', fontSize: '14px', color: C.textSecondary }}>
          <strong>{contentTitle}</strong>
        </p>
      </div>

      {/* Info prix de base */}
      <div style={{ ...S.card, background: '#fff8f0', border: '1px solid #f0d8c0', marginBottom: '20px' }}>
        <div style={{ fontSize: '13px', color: C.textSecondary, marginBottom: '4px' }}>Prix de base (global)</div>
        <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontWeight: '700', fontSize: '18px', color: C.indigo }}>
              {basePriceCents != null ? formatPrice(basePriceCents, baseCurrency) : '—'}
            </span>
            <span style={{ marginLeft: '8px', fontSize: '12px', color: C.grey }}>prix de base</span>
          </div>
          <div>
            <span style={{ background: '#e8f0fe', color: '#1a56db', borderRadius: '20px', padding: '3px 12px', fontSize: '12px', fontWeight: '700' }}>
              {accessType === 'subscription' ? 'Abonnement' : accessType === 'paid' ? 'Payant' : accessType === 'subscription_or_paid' ? 'Abo. ou Payant' : accessType || '—'}
            </span>
            <span style={{ marginLeft: '6px', fontSize: '12px', color: C.grey }}>type de vente</span>
          </div>
        </div>
        <p style={{ margin: '10px 0 0', fontSize: '12px', color: C.grey }}>
          Les prix géographiques ci-dessous remplacent ce prix pour les utilisateurs des zones concernées.
        </p>
      </div>

      {/* Messages */}
      {error   && <div style={{ background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: '10px', padding: '10px 16px', marginBottom: '16px', color: '#c62828', fontSize: '13px' }}>{error}</div>}
      {success && <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: '10px', padding: '10px 16px', marginBottom: '16px', color: '#2e7d32', fontSize: '13px' }}>{success}</div>}

      {/* Formulaire ajout/modif */}
      {showForm && (
        <div style={{ ...S.card, border: `2px solid ${C.terre}33` }}>
          <h3 style={{ margin: '0 0 16px', color: C.indigo, fontSize: '15px' }}>
            {editingId ? 'Modifier le prix' : 'Ajouter une zone / pays'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '14px' }}>
            <div>
              <label style={S.label}>Type *</label>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                {[['zone', 'Continent'], ['country', 'Pays']].map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setForm(f => ({ ...f, type: v, zone: '', _countryVal: '' }))}
                    style={{ flex: 1, padding: '7px', borderRadius: '8px', border: `1px solid ${form.type === v ? C.terre : '#e0e0e0'}`, background: form.type === v ? C.terre + '15' : '#f5f5f5', color: form.type === v ? C.terre : C.grey, fontSize: '12px', fontWeight: form.type === v ? '700' : '400', cursor: 'pointer' }}>
                    {l}
                  </button>
                ))}
              </div>
              {form.type === 'zone' ? (
                <select style={S.input} value={form.zone} onChange={e => setForm(f => ({ ...f, zone: e.target.value }))}>
                  <option value="">— Continent —</option>
                  {availableZones.map(z => <option key={z.value} value={z.value}>{z.label}</option>)}
                </select>
              ) : (
                <select style={S.input} value={form._countryVal || ''} onChange={e => setForm(f => ({ ...f, _countryVal: e.target.value }))}>
                  <option value="">— Pays —</option>
                  {availableCountries.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              )}
            </div>
            <div>
              <label style={S.label}>Prix (centimes) *</label>
              <input style={S.input} type="number" min="0" value={form.price_cents}
                onChange={e => setForm(f => ({ ...f, price_cents: e.target.value }))}
                placeholder="ex: 500 = 5,00 €" />
              {form.price_cents !== '' && !isNaN(parseInt(form.price_cents)) && (
                <div style={{ fontSize: '12px', color: C.terre, marginTop: '4px' }}>
                  = {formatPrice(parseInt(form.price_cents), form.currency)}
                </div>
              )}
            </div>
            <div>
              <label style={S.label}>Devise</label>
              <select style={S.input} value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={S.label}>Notes (optionnel)</label>
            <input style={S.input} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Ex: Prix solidaire pour les pays francophones d'Afrique" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: C.textSecondary }}>
              <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
              Actif (ce prix sera appliqué)
            </label>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button style={{ ...S.btn, background: C.terre, color: 'white', opacity: saving ? 0.7 : 1 }} onClick={save} disabled={saving}>
              {saving ? '…' : <><Icon n="check" size={14} color="white" /> {editingId ? 'Enregistrer' : 'Ajouter'}</>}
            </button>
            <button style={{ ...S.btn, background: '#f5f5f5', color: C.textSecondary }} onClick={() => { setShowForm(false); setError(null) }}>
              <Icon n="x" size={14} color={C.textSecondary} /> Annuler
            </button>
          </div>
        </div>
      )}

      {/* Liste des prix géographiques */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: C.indigo }}>
            Prix par zone ({prices.length})
          </h2>
          {!showForm && (
            <button style={{ ...S.btn, background: C.terre, color: 'white' }} onClick={openNew}>
              <Icon n="plus" size={14} color="white" /> Ajouter
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: C.grey }}>Chargement…</div>
        ) : prices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: C.grey }}>
            <Icon n="globe" size={40} color={C.lightGrey} />
            <p style={{ marginTop: '12px', fontSize: '14px' }}>Aucun prix géographique défini.</p>
            <p style={{ fontSize: '13px', color: C.grey }}>Le prix de base s'applique partout.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Zone', 'Prix', 'Devise', 'Économie vs base', 'Statut', 'Notes', 'Actions'].map((h, i) => (
                  <th key={h} style={{ padding: '10px 12px', fontSize: '11px', fontWeight: '700', color: C.grey, textTransform: 'uppercase', letterSpacing: '0.4px', background: '#fafafa', textAlign: i === 6 ? 'right' : 'left', borderBottom: `1px solid ${C.lightGrey}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {prices.map(p => {
                const saving = basePriceCents != null ? basePriceCents - p.price_cents : null
                const pct    = saving != null && basePriceCents > 0 ? Math.round((saving / basePriceCents) * 100) : null
                return (
                  <tr key={p.id} style={{ opacity: p.is_active ? 1 : 0.5 }}>
                    <td style={{ padding: '12px', borderBottom: `1px solid ${C.lightGrey}`, fontWeight: '700', fontSize: '14px', color: C.textPrimary }}>
                      <span>
                        {COUNTRIES.find(c => c.value === p.zone)?.label || ZONES.find(z => z.value === p.zone)?.label || p.zone_label || p.zone}
                      </span>
                      <span style={{ marginLeft: '6px', fontSize: '11px', color: C.grey, fontWeight: '400' }}>
                        {p.zone?.length === 2 ? 'Pays' : 'Continent'}
                      </span>
                    </td>
                    <td style={{ padding: '12px', borderBottom: `1px solid ${C.lightGrey}`, fontWeight: '700', fontSize: '15px', color: C.terre }}>
                      {formatPrice(p.price_cents, p.currency)}
                    </td>
                    <td style={{ padding: '12px', borderBottom: `1px solid ${C.lightGrey}`, fontSize: '13px', color: C.grey }}>
                      {p.currency}
                    </td>
                    <td style={{ padding: '12px', borderBottom: `1px solid ${C.lightGrey}` }}>
                      {pct != null && pct > 0 ? (
                        <span style={{ background: '#e8f5e9', color: C.green, borderRadius: '20px', padding: '2px 10px', fontSize: '12px', fontWeight: '700' }}>
                          -{pct}%
                        </span>
                      ) : pct != null && pct < 0 ? (
                        <span style={{ background: '#ffebee', color: C.red, borderRadius: '20px', padding: '2px 10px', fontSize: '12px', fontWeight: '700' }}>
                          +{Math.abs(pct)}%
                        </span>
                      ) : <span style={{ color: C.grey, fontSize: '12px' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px', borderBottom: `1px solid ${C.lightGrey}` }}>
                      <button
                        onClick={() => toggleActive(p)}
                        style={{ ...S.btn, padding: '4px 10px', fontSize: '11px', background: p.is_active ? '#e8f5e9' : '#f5f5f5', color: p.is_active ? C.green : C.grey, border: `1px solid ${p.is_active ? C.green + '44' : '#ddd'}` }}
                      >
                        {p.is_active ? 'Actif' : 'Inactif'}
                      </button>
                    </td>
                    <td style={{ padding: '12px', borderBottom: `1px solid ${C.lightGrey}`, fontSize: '12px', color: C.grey, maxWidth: '200px' }}>
                      {p.notes || '—'}
                    </td>
                    <td style={{ padding: '12px', borderBottom: `1px solid ${C.lightGrey}`, textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button style={{ ...S.btn, padding: '5px 10px', background: '#f0ede8', color: C.terre, border: `1px solid ${C.terre}33` }} onClick={() => openEdit(p)}>
                          <Icon n="edit" size={12} color={C.terre} />
                        </button>
                        <button style={{ ...S.btn, padding: '5px 10px', background: '#ffebee', color: C.red, border: `1px solid ${C.red}33` }} onClick={() => remove(p.id)}>
                          <Icon n="trash" size={12} color={C.red} />
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
    </div>
  )
}
