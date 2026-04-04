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
    lock:    '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>',
    globe:   '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/>',
    plus:    '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    trash:   '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>',
    check:   '<polyline points="20 6 9 17 4 12"/>',
    x:       '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    shield:  '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    'alert-triangle': '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
      dangerouslySetInnerHTML={{ __html: p[n] || '' }}
    />
  )
}

export default function GeoRestrictionsEditor({ record }) {
  const contentId    = record?.params?.id
  const contentTitle = record?.params?.title || 'Ce contenu'

  const [config,     setConfig]     = useState(null)   // { mode: 'blacklist'|'whitelist' } ou null
  const [zones,      setZones]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState(null)
  const [success,    setSuccess]    = useState(null)
  const [showForm,   setShowForm]   = useState(false)
  const [form,       setForm]       = useState({ type: 'zone', zone: '', _countryVal: '', reason: '', is_active: true })

  useEffect(() => { if (contentId) load() }, [contentId])

  function load() {
    setLoading(true)
    fetch(`/admin/api/content/${contentId}/geo-restrictions`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setConfig(d.config || null); setZones(d.zones || []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  async function saveMode(mode) {
    setSaving(true); setError(null)
    try {
      const res  = await fetch(`/admin/api/content/${contentId}/geo-restrictions/config`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setConfig({ mode })
      setSuccess('Mode de restriction mis à jour.')
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  async function removeRestrictions() {
    if (!window.confirm('Supprimer toutes les restrictions géographiques pour ce contenu ?')) return
    setSaving(true)
    try {
      await fetch(`/admin/api/content/${contentId}/geo-restrictions`, { method: 'DELETE', credentials: 'include' })
      setConfig(null); setZones([])
      setSuccess('Restrictions supprimées. Le contenu est maintenant disponible partout.')
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  async function addZone() {
    const key = form.type === 'country' ? (form._countryVal || '') : form.zone
    if (!key) { setError(form.type === 'country' ? 'Sélectionnez un pays' : 'Sélectionnez un continent'); return }
    if (!config) { setError('Définissez d\'abord le mode de restriction'); return }
    setSaving(true); setError(null)
    try {
      const label = form.type === 'country'
        ? COUNTRIES.find(c => c.value === key)?.label || key
        : ZONES.find(z => z.value === key)?.label || key
      const res  = await fetch(`/admin/api/content/${contentId}/geo-restrictions/zones`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone: key, zone_label: label, reason: form.reason || null, is_active: form.is_active }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setShowForm(false)
      setForm({ type: 'zone', zone: '', _countryVal: '', reason: '', is_active: true })
      setSuccess('Zone ajoutée.')
      load()
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  async function toggleZone(z) {
    try {
      await fetch(`/admin/api/content/geo-restrictions/zones/${z.id}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !z.is_active }),
      })
      load()
    } catch (e) { setError(e.message) }
  }

  async function removeZone(id) {
    if (!window.confirm('Retirer cette zone ?')) return
    try {
      await fetch(`/admin/api/content/geo-restrictions/zones/${id}`, { method: 'DELETE', credentials: 'include' })
      load()
    } catch (e) { setError(e.message) }
  }

  const usedZones         = zones.map(z => z.zone)
  const availableZones    = ZONES.filter(z => !usedZones.includes(z.value))
  const availableCountries = COUNTRIES.filter(c => !usedZones.includes(c.value))
  const isBlacklist    = config?.mode === 'blacklist'
  const isWhitelist    = config?.mode === 'whitelist'
  const hasConfig      = config !== null

  const modeColor  = isBlacklist ? C.red    : isWhitelist ? C.green  : C.grey
  const modeBg     = isBlacklist ? '#ffebee' : isWhitelist ? '#e8f5e9' : '#f5f5f5'
  const modeLabel  = isBlacklist ? 'Blacklist — Bloqué dans les zones listées'
                   : isWhitelist ? 'Whitelist — Disponible uniquement dans les zones listées'
                   : 'Aucune restriction'

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
          <Icon n="lock" size={24} color={C.indigo} />
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: C.indigo, margin: 0, fontFamily: 'Georgia, serif' }}>
            Restrictions Géographiques
          </h1>
        </div>
        <p style={{ margin: '0 0 0 36px', fontSize: '14px', color: C.textSecondary }}>
          <strong>{contentTitle}</strong>
        </p>
      </div>

      {/* Messages */}
      {error   && <div style={{ background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: '10px', padding: '10px 16px', marginBottom: '16px', color: '#c62828', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {error} <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><Icon n="x" size={14} color="#c62828" /></button>
      </div>}
      {success && <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: '10px', padding: '10px 16px', marginBottom: '16px', color: '#2e7d32', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {success} <button onClick={() => setSuccess(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><Icon n="x" size={14} color="#2e7d32" /></button>
      </div>}

      {/* Statut actuel */}
      <div style={{ ...S.card, border: `2px solid ${modeColor}33` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: C.indigo }}>Mode de restriction</h2>
          {hasConfig && (
            <button style={{ ...S.btn, padding: '5px 12px', background: '#ffebee', color: C.red, fontSize: '12px' }} onClick={removeRestrictions} disabled={saving}>
              <Icon n="x" size={12} color={C.red} /> Supprimer toutes les restrictions
            </button>
          )}
        </div>

        {/* Statut badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', padding: '12px 16px', background: modeBg, borderRadius: '10px' }}>
          <Icon n={hasConfig ? 'shield' : 'globe'} size={20} color={modeColor} />
          <span style={{ fontWeight: '700', fontSize: '14px', color: modeColor }}>{modeLabel}</span>
        </div>

        {/* Sélecteur de mode */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <ModeCard
            active={isBlacklist}
            title="Blacklist"
            description="Le contenu est visible partout sauf dans les zones que vous listez ci-dessous."
            color={C.red}
            bg="#ffebee"
            icon="alert-triangle"
            onClick={() => saveMode('blacklist')}
            disabled={saving}
          />
          <ModeCard
            active={isWhitelist}
            title="Whitelist"
            description="Le contenu est visible UNIQUEMENT dans les zones que vous listez ci-dessous."
            color={C.green}
            bg="#e8f5e9"
            icon="shield"
            onClick={() => saveMode('whitelist')}
            disabled={saving}
          />
        </div>
      </div>

      {/* Zones */}
      {hasConfig && (
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: C.indigo }}>
              Zones {isBlacklist ? 'bloquées' : 'autorisées'} ({zones.length})
            </h2>
            {!showForm && (
              <button style={{ ...S.btn, background: C.indigo, color: 'white' }} onClick={() => { setShowForm(true); setError(null) }}>
                <Icon n="plus" size={14} color="white" /> Ajouter
              </button>
            )}
          </div>

          {/* Résumé visuel */}
          {zones.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
              {ZONES.map(z => {
                const zoneEntry  = zones.find(r => r.zone === z.value)
                const isListed   = !!zoneEntry
                const isActive   = zoneEntry?.is_active
                const bgColor    = !isListed ? '#f5f5f5'
                                 : isActive  ? (isBlacklist ? '#ffebee' : '#e8f5e9')
                                 : '#fff9e6'
                const txtColor   = !isListed ? C.grey
                                 : isActive  ? (isBlacklist ? C.red : C.green)
                                 : C.orange
                return (
                  <div key={z.value} style={{ padding: '5px 12px', borderRadius: '20px', background: bgColor, color: txtColor, fontSize: '12px', fontWeight: '700', border: `1px solid ${txtColor}33` }}>
                    {z.label}
                    {isListed && !isActive && ' (inactif)'}
                  </div>
                )
              })}
            </div>
          )}

          {/* Formulaire ajout */}
          {showForm && (
            <div style={{ background: '#f9f9f9', borderRadius: '12px', padding: '16px', marginBottom: '16px', border: '1px solid #e0e0e0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={S.label}>Zone / Pays *</label>
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                    {[['zone', 'Continent'], ['country', 'Pays']].map(([v, l]) => (
                      <button key={v} type="button" onClick={() => setForm(f => ({ ...f, type: v, zone: '', _countryVal: '' }))}
                        style={{ flex: 1, padding: '6px', borderRadius: '8px', border: `1px solid ${form.type === v ? C.indigo : '#e0e0e0'}`, background: form.type === v ? C.indigo + '15' : '#f0f0f0', color: form.type === v ? C.indigo : C.grey, fontSize: '12px', fontWeight: form.type === v ? '700' : '400', cursor: 'pointer' }}>
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
                  <label style={S.label}>Motif (optionnel)</label>
                  <input style={S.input} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                    placeholder="Ex: Droits non acquis" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button style={{ ...S.btn, background: C.indigo, color: 'white', opacity: saving ? 0.7 : 1 }} onClick={addZone} disabled={saving}>
                  {saving ? '…' : <><Icon n="check" size={14} color="white" /> Ajouter</>}
                </button>
                <button style={{ ...S.btn, background: '#f5f5f5', color: C.textSecondary }} onClick={() => { setShowForm(false); setError(null) }}>
                  <Icon n="x" size={14} color={C.textSecondary} /> Annuler
                </button>
              </div>
            </div>
          )}

          {/* Liste zones */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px', color: C.grey }}>Chargement…</div>
          ) : zones.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: C.grey }}>
              <p style={{ fontSize: '14px' }}>
                {isBlacklist
                  ? 'Aucune zone bloquée pour l\'instant — le contenu est accessible partout.'
                  : 'Aucune zone autorisée — le contenu n\'est accessible nulle part tant que la liste est vide.'}
              </p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Zone', 'Motif', 'Statut', 'Actions'].map((h, i) => (
                    <th key={h} style={{ padding: '10px 12px', fontSize: '11px', fontWeight: '700', color: C.grey, textTransform: 'uppercase', background: '#fafafa', textAlign: i === 3 ? 'right' : 'left', borderBottom: `1px solid ${C.lightGrey}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {zones.map(z => (
                  <tr key={z.id} style={{ opacity: z.is_active ? 1 : 0.55 }}>
                    <td style={{ padding: '12px', borderBottom: `1px solid ${C.lightGrey}`, fontWeight: '700', fontSize: '14px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: z.is_active ? (isBlacklist ? C.red : C.green) : C.orange, display: 'inline-block', flexShrink: 0 }} />
                        {COUNTRIES.find(c => c.value === z.zone)?.label || ZONES.find(zz => zz.value === z.zone)?.label || z.zone_label || z.zone}
                        {' '}
                        <span style={{ fontSize: '10px', color: '#aaa', fontWeight: '400' }}>
                          {z.zone?.length === 2 ? 'Pays' : 'Continent'}
                        </span>
                      </span>
                    </td>
                    <td style={{ padding: '12px', borderBottom: `1px solid ${C.lightGrey}`, fontSize: '13px', color: C.grey }}>
                      {z.reason || '—'}
                    </td>
                    <td style={{ padding: '12px', borderBottom: `1px solid ${C.lightGrey}` }}>
                      <button
                        onClick={() => toggleZone(z)}
                        style={{ ...S.btn, padding: '4px 10px', fontSize: '11px', background: z.is_active ? '#e8f5e9' : '#fff9e6', color: z.is_active ? C.green : C.orange, border: `1px solid ${z.is_active ? C.green + '44' : C.orange + '44'}` }}
                      >
                        {z.is_active ? 'Actif' : 'Suspendu'}
                      </button>
                    </td>
                    <td style={{ padding: '12px', borderBottom: `1px solid ${C.lightGrey}`, textAlign: 'right' }}>
                      <button style={{ ...S.btn, padding: '5px 10px', background: '#ffebee', color: C.red, border: `1px solid ${C.red}33` }} onClick={() => removeZone(z.id)}>
                        <Icon n="trash" size={12} color={C.red} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Avertissement whitelist vide */}
          {isWhitelist && zones.length === 0 && (
            <div style={{ display: 'flex', gap: '10px', padding: '12px 16px', background: '#fff3e0', borderRadius: '10px', marginTop: '12px', border: '1px solid #ffcc0244' }}>
              <Icon n="alert-triangle" size={18} color={C.orange} />
              <div style={{ fontSize: '13px', color: '#e65100' }}>
                <strong>Attention :</strong> Le mode Whitelist est actif mais aucune zone n'est listée. Le contenu est inaccessible pour tous les utilisateurs.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ModeCard({ active, title, description, color, bg, icon, onClick, disabled }) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        border: `2px solid ${active ? color : '#e0e0e0'}`,
        borderRadius: '12px', padding: '16px', cursor: disabled ? 'default' : 'pointer',
        background: active ? bg : '#fafafa',
        transition: 'all .15s',
        opacity: disabled ? 0.7 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <Icon n={icon} size={18} color={active ? color : '#aaa'} />
        <span style={{ fontWeight: '700', fontSize: '14px', color: active ? color : '#999' }}>{title}</span>
        {active && <span style={{ marginLeft: 'auto', background: color, color: 'white', borderRadius: '20px', padding: '2px 10px', fontSize: '11px', fontWeight: '700' }}>Actif</span>}
      </div>
      <p style={{ margin: 0, fontSize: '12px', color: active ? color : '#999', lineHeight: '1.5' }}>{description}</p>
    </div>
  )
}
