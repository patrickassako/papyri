import React, { useState, useEffect, useRef } from 'react'

// Feather-style SVG icon helper
function Icon({ n, size = 16, color = 'currentColor', style }) {
  const p = {
    x:              '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    edit:           '<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    send:           '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
    dollar:         '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>',
    'trending-up':  '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
    book:           '<path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>',
    calendar:       '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    'arrow-left':   '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
    'chevron-right':'<polyline points="9 18 15 12 9 6"/>',
    plus:           '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    download:       '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    'file-text':    '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>',
    music:          '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    eye:            '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    loader:         '<line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>',
    'check-circle': '<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    check:          '<polyline points="20 6 9 17 4 12"/>',
    play:           '<polygon points="5 3 19 12 5 21 5 3"/>',
    pause:          '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>',
    'skip-back':    '<polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/>',
    'skip-forward': '<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/>',
    'volume-2':     '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/>',
    'volume-x':     '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>',
    'info':         '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
    'globe':        '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/>',
    'plus':         '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      dangerouslySetInnerHTML={{ __html: p[n] || '' }}
    />
  )
}

const C = {
  terre: '#B5651D', or: '#D4A017', indigo: '#2E4057',
  green: '#27ae60', red: '#e74c3c', blue: '#2196F3', purple: '#9C27B0',
  orange: '#FF9800', grey: '#8c8c8c', lightGrey: '#f0f0f0',
  card: '#ffffff', bg: '#f4f1ec', textPrimary: '#1a1a2e', textSecondary: '#6b7280',
}

const STATUS = {
  active:  { label: 'Actif',   color: C.green,  bg: '#e8f5e9' },
  pending: { label: 'Attente', color: C.grey,   bg: '#f5f5f5' },
  paused:  { label: 'Pause',   color: C.orange, bg: '#fff3e0' },
  banned:  { label: 'Banni',   color: C.red,    bg: '#ffebee' },
}
const PAYOUT_STATUS = {
  pending:    { label: 'En attente', color: C.orange },
  processing: { label: 'En cours',   color: C.blue },
  paid:       { label: 'Versé',      color: C.green },
  failed:     { label: 'Échoué',     color: C.red },
}

const S = {
  page: { width: '100%', padding: '32px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', boxSizing: 'border-box', background: C.bg, minHeight: '100vh' },
  card: { background: C.card, borderRadius: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' },
  btn: { padding: '9px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' },
  btnPrimary: { background: C.terre, color: 'white' },
  btnSecondary: { background: '#f5f5f5', color: C.textPrimary },
  btnDanger: { background: C.red, color: 'white' },
  btnSuccess: { background: C.green, color: 'white' },
  chip: { display: 'inline-block', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' },
  input: { width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid #e0e0e0', fontSize: '14px', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' },
  label: { display: 'block', fontSize: '13px', fontWeight: '600', color: C.textSecondary, marginBottom: '5px' },
  avatar: { width: '38px', height: '38px', borderRadius: '50%', background: C.terre, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '800', fontSize: '15px', flexShrink: 0 },
  thCell: { padding: '12px 16px', fontSize: '12px', fontWeight: '700', color: C.grey, textTransform: 'uppercase', letterSpacing: '0.4px' },
  tdCell: { padding: '14px 16px', fontSize: '13px', borderBottom: `1px solid ${C.lightGrey}`, verticalAlign: 'middle' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' },
  modal: { background: 'white', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box' },
}

function api(path, opts = {}) {
  return fetch('/admin/api' + path, { credentials: 'include', ...opts })
    .then(r => r.json())
}
function apiJson(path, method, body) {
  return api(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

// ─── Lecteur audio custom ─────────────────────────────────────
function AudioPlayer({ src, cover, title, author, durationSecs }) {
  const audioRef = useRef(null)
  const [playing, setPlaying]       = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration]     = useState(durationSecs || 0)
  const [volume, setVolume]         = useState(1)
  const [muted, setMuted]           = useState(false)
  const [ready, setReady]           = useState(false)

  function fmt(s) {
    const t = Math.floor(s || 0)
    const h = Math.floor(t / 3600)
    const m = Math.floor((t % 3600) / 60)
    const sec = t % 60
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
    return `${m}:${String(sec).padStart(2,'0')}`
  }

  function togglePlay() {
    const a = audioRef.current; if (!a) return
    if (playing) { a.pause(); setPlaying(false) }
    else { a.play().then(() => setPlaying(true)).catch(() => {}) }
  }
  function skip(s) {
    const a = audioRef.current; if (!a) return
    a.currentTime = Math.max(0, Math.min(duration, a.currentTime + s))
  }
  function seek(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const t = ratio * duration
    if (audioRef.current) audioRef.current.currentTime = t
    setCurrentTime(t)
  }
  function changeVolume(e) {
    const v = parseFloat(e.target.value)
    setVolume(v); setMuted(v === 0)
    if (audioRef.current) { audioRef.current.volume = v; audioRef.current.muted = v === 0 }
  }
  function toggleMute() {
    const a = audioRef.current; if (!a) return
    const next = !muted; setMuted(next); a.muted = next
  }

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0
  const BG = 'linear-gradient(160deg, #1a1a2e 0%, #2E4057 60%, #1a2535 100%)'

  return (
    <div style={{ width: '100%', height: '100%', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 40px', gap: '32px' }}>
      <audio ref={audioRef} src={src}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => { setDuration(audioRef.current?.duration || durationSecs || 0); setReady(true) }}
        onEnded={() => { setPlaying(false); setCurrentTime(0) }}
      />

      {/* Pochette */}
      <div style={{ position: 'relative', transition: 'transform 0.3s', transform: playing ? 'scale(1.03)' : 'scale(1)' }}>
        {cover
          ? <img src={cover} alt="" style={{ width: '220px', height: '220px', objectFit: 'cover', borderRadius: '20px', boxShadow: playing ? '0 28px 64px rgba(0,0,0,0.7), 0 0 0 3px rgba(181,101,29,0.5)' : '0 16px 48px rgba(0,0,0,0.55)', transition: 'box-shadow 0.4s' }} />
          : <div style={{ width: '220px', height: '220px', background: 'rgba(255,255,255,0.06)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 16px 48px rgba(0,0,0,0.4)' }}>
              <Icon n="music" size={80} color="rgba(181,101,29,0.7)" />
            </div>
        }
      </div>

      {/* Titre + auteur */}
      <div style={{ textAlign: 'center', maxWidth: '380px' }}>
        <div style={{ fontSize: '22px', fontWeight: '800', color: 'white', fontFamily: 'Georgia, serif', marginBottom: '6px', lineHeight: '1.3' }}>{title || 'Sans titre'}</div>
        {author && <div style={{ fontSize: '15px', color: 'rgba(255,255,255,0.55)' }}>{author}</div>}
      </div>

      {/* Barre de progression */}
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div onClick={seek} style={{ height: '6px', background: 'rgba(255,255,255,0.12)', borderRadius: '3px', cursor: 'pointer', position: 'relative', marginBottom: '10px' }}>
          <div style={{ height: '100%', width: progress + '%', background: `linear-gradient(90deg, ${C.terre}, ${C.or})`, borderRadius: '3px', transition: 'width 0.2s linear' }} />
          <div style={{ position: 'absolute', top: '50%', left: `calc(${progress}% - 7px)`, transform: 'translateY(-50%)', width: '14px', height: '14px', background: 'white', borderRadius: '50%', boxShadow: '0 2px 8px rgba(0,0,0,0.5)', pointerEvents: 'none' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontVariantNumeric: 'tabular-nums' }}>
          <span>{fmt(currentTime)}</span>
          <span>{fmt(duration)}</span>
        </div>
      </div>

      {/* Contrôles */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
        <button onClick={() => skip(-15)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', padding: '6px' }}>
          <Icon n="skip-back" size={26} color="rgba(255,255,255,0.7)" />
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: '700' }}>−15s</span>
        </button>

        <button onClick={togglePlay} disabled={!src}
          style={{ width: '76px', height: '76px', borderRadius: '50%', background: C.terre, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 28px rgba(181,101,29,0.55)', transition: 'transform 0.1s, box-shadow 0.2s', opacity: !src ? 0.4 : 1 }}
          onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.93)' }}
          onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
        >
          <Icon n={playing ? 'pause' : 'play'} size={34} color="white" style={{ marginLeft: playing ? 0 : '3px' }} />
        </button>

        <button onClick={() => skip(15)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', padding: '6px' }}>
          <Icon n="skip-forward" size={26} color="rgba(255,255,255,0.7)" />
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: '700' }}>+15s</span>
        </button>
      </div>

      {/* Volume */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', maxWidth: '400px' }}>
        <button onClick={toggleMute} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', flexShrink: 0 }}>
          <Icon n={muted || volume === 0 ? 'volume-x' : 'volume-2'} size={18} color="rgba(255,255,255,0.5)" />
        </button>
        <input type="range" min="0" max="1" step="0.02" value={muted ? 0 : volume} onChange={changeVolume}
          style={{ flex: 1, accentColor: C.terre, cursor: 'pointer', height: '4px' }} />
      </div>
    </div>
  )
}

// ─── Panneau Prix & Restrictions Géo (dans BookDetailModal) ──
const GEO_ZONES = [
  { value: 'africa',        label: 'Afrique (continent)' },
  { value: 'europe',        label: 'Europe (continent)' },
  { value: 'north_america', label: 'Amérique du Nord (continent)' },
  { value: 'south_america', label: 'Amérique du Sud (continent)' },
  { value: 'asia',          label: 'Asie (continent)' },
  { value: 'middle_east',   label: 'Moyen-Orient (continent)' },
  { value: 'oceania',       label: 'Océanie (continent)' },
]
const GEO_COUNTRIES = [
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
  { value: 'QA', label: 'Qatar' }, { value: 'MA', label: 'Maroc' },
]
const GEO_CURRENCIES = ['EUR', 'USD', 'XAF', 'XOF', 'GBP', 'CAD', 'MAD', 'TND']

function GeoPanel({ contentId }) {
  const [geoTab, setGeoTab]         = useState(0)
  const [pricing, setPricing]       = useState([])
  const [pricingLoading, setPricingLoading] = useState(true)
  const [showPriceForm, setShowPriceForm]   = useState(false)
  const [pForm, setPForm]           = useState({ type: 'zone', zone: '', country: '', price: '', currency: 'EUR' })
  const [pSaving, setPSaving]       = useState(false)
  const [geoConfig, setGeoConfig]   = useState(null)
  const [geoZones, setGeoZones]     = useState([])
  const [geoLoading, setGeoLoading] = useState(true)
  const [showZoneForm, setShowZoneForm] = useState(false)
  const [zForm, setZForm]           = useState({ type: 'zone', zone: '', country: '', reason: '' })
  const [zSaving, setZSaving]       = useState(false)

  useEffect(() => { if (contentId) { loadPricing(); loadRestrictions() } }, [contentId])

  async function loadPricing() {
    setPricingLoading(true)
    const r = await api(`/content/${contentId}/geo-pricing`)
    setPricing(Array.isArray(r.pricing) ? r.pricing : [])
    setPricingLoading(false)
  }
  async function loadRestrictions() {
    setGeoLoading(true)
    const r = await api(`/content/${contentId}/geo-restrictions`)
    setGeoConfig(r.config || null)
    setGeoZones(Array.isArray(r.zones) ? r.zones : [])
    setGeoLoading(false)
  }

  async function savePricing() {
    const key   = pForm.type === 'country' ? pForm.country : pForm.zone
    const label = pForm.type === 'country'
      ? GEO_COUNTRIES.find(c => c.value === pForm.country)?.label || pForm.country
      : GEO_ZONES.find(z => z.value === pForm.zone)?.label || pForm.zone
    if (!key || !pForm.price) return
    setPSaving(true)
    await apiJson(`/content/${contentId}/geo-pricing`, 'POST', {
      zone: key, zone_label: label,
      price_cents: Math.round(parseFloat(pForm.price) * 100),
      currency: pForm.currency, is_active: true,
    })
    setPSaving(false); setShowPriceForm(false); setPForm({ type: 'zone', zone: '', country: '', price: '', currency: 'EUR' })
    loadPricing()
  }
  async function deletePricing(id) {
    await api(`/content/geo-pricing/${id}`, { method: 'DELETE' })
    loadPricing()
  }

  async function setMode(mode) {
    await apiJson(`/content/${contentId}/geo-restrictions/config`, 'POST', { mode })
    loadRestrictions()
  }
  async function removeRestrictions() {
    if (!window.confirm('Supprimer toutes les restrictions ?')) return
    await api(`/content/${contentId}/geo-restrictions`, { method: 'DELETE' })
    loadRestrictions()
  }
  async function saveZone() {
    const key   = zForm.type === 'country' ? zForm.country : zForm.zone
    const label = zForm.type === 'country'
      ? GEO_COUNTRIES.find(c => c.value === zForm.country)?.label || zForm.country
      : GEO_ZONES.find(z => z.value === zForm.zone)?.label || zForm.zone
    if (!key) return
    setZSaving(true)
    await apiJson(`/content/${contentId}/geo-restrictions/zones`, 'POST', {
      zone: key, zone_label: label, is_active: true, reason: zForm.reason || null,
    })
    setZSaving(false); setShowZoneForm(false); setZForm({ type: 'zone', zone: '', country: '', reason: '' })
    loadRestrictions()
  }
  async function toggleZone(z) {
    await apiJson(`/content/geo-restrictions/zones/${z.id}`, 'PUT', {
      zone: z.zone, zone_label: z.zone_label, is_active: !z.is_active, reason: z.reason,
    })
    loadRestrictions()
  }
  async function deleteZone(id) {
    await api(`/content/geo-restrictions/zones/${id}`, { method: 'DELETE' })
    loadRestrictions()
  }

  const usedKeys       = pricing.map(p => p.zone)
  const usedZoneKeys   = geoZones.map(z => z.zone)
  const isWhitelist    = geoConfig?.mode === 'whitelist'
  const tabStyle = (i) => ({
    padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer',
    fontWeight: geoTab === i ? '700' : '400', fontSize: '12px',
    color: geoTab === i ? C.terre : C.grey,
    borderBottom: `2px solid ${geoTab === i ? C.terre : 'transparent'}`,
    transition: 'all 0.15s',
  })
  const typeToggle = (form, setForm) => (
    <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
      {[['zone', 'Continent'], ['country', 'Pays']].map(([v, l]) => (
        <button key={v} onClick={() => setForm(f => ({ ...f, type: v, zone: '', country: '' }))}
          style={{ padding: '5px 12px', borderRadius: '8px', border: `1px solid ${form.type === v ? C.terre : '#e0e0e0'}`, background: form.type === v ? C.terre + '15' : '#f5f5f5', color: form.type === v ? C.terre : C.grey, fontSize: '11px', fontWeight: form.type === v ? '700' : '400', cursor: 'pointer' }}>
          {l}
        </button>
      ))}
    </div>
  )

  return (
    <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '2px solid #f0ede8', paddingBottom: '32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
        <Icon n="globe" size={14} color={C.indigo} />
        <span style={{ fontSize: '12px', fontWeight: '800', color: C.indigo, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Geographie</span>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid #f0ede8', marginBottom: '16px' }}>
        <button style={tabStyle(0)} onClick={() => setGeoTab(0)}>Prix par zone / pays</button>
        <button style={tabStyle(1)} onClick={() => setGeoTab(1)}>Restrictions d'acces</button>
      </div>

      {geoTab === 0 && (
        <div>
          {pricingLoading ? <div style={{ color: C.grey, fontSize: '13px' }}>Chargement...</div> : (
            <>
              {pricing.length > 0 && (
                <div style={{ border: '1px solid #f0ede8', borderRadius: '10px', overflow: 'hidden', marginBottom: '12px' }}>
                  {pricing.map((p, i) => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', background: i % 2 === 0 ? '#fafafa' : 'white', borderBottom: i < pricing.length - 1 ? '1px solid #f0ede8' : 'none' }}>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: C.textPrimary }}>{p.zone_label}</span>
                        <span style={{ fontSize: '10px', color: C.grey, marginLeft: '6px' }}>{p.zone?.length === 2 ? 'Pays' : 'Continent'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '800', color: C.terre }}>{(p.price_cents / 100).toFixed(2)} {p.currency}</span>
                        <span style={{ ...S.chip, fontSize: '10px', background: p.is_active ? '#e8f5e9' : '#f5f5f5', color: p.is_active ? C.green : C.grey }}>{p.is_active ? 'Actif' : 'Off'}</span>
                        <button onClick={() => deletePricing(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, fontSize: '14px', lineHeight: 1, padding: '0 2px' }} title="Supprimer">x</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {pricing.length === 0 && !showPriceForm && <div style={{ fontSize: '12px', color: C.grey, textAlign: 'center', padding: '10px 0 14px', fontStyle: 'italic' }}>Aucun prix specifique defini</div>}
              {!showPriceForm && (
                <button onClick={() => setShowPriceForm(true)} style={{ ...S.btn, ...S.btnSecondary, fontSize: '12px', padding: '7px 14px' }}>
                  <Icon n="plus" size={13} color={C.textPrimary} /> Ajouter
                </button>
              )}
              {showPriceForm && (
                <div style={{ background: '#fdf8f3', borderRadius: '10px', padding: '14px', border: '1px solid #e8e0d5' }}>
                  {typeToggle(pForm, setPForm)}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    {pForm.type === 'zone' ? (
                      <select value={pForm.zone} onChange={e => setPForm(f => ({ ...f, zone: e.target.value }))}
                        style={{ ...S.input, flex: 1, fontSize: '12px', padding: '7px 10px' }}>
                        <option value="">Continent...</option>
                        {GEO_ZONES.filter(z => !usedKeys.includes(z.value)).map(z => <option key={z.value} value={z.value}>{z.label}</option>)}
                      </select>
                    ) : (
                      <select value={pForm.country} onChange={e => setPForm(f => ({ ...f, country: e.target.value }))}
                        style={{ ...S.input, flex: 1, fontSize: '12px', padding: '7px 10px' }}>
                        <option value="">Pays...</option>
                        {GEO_COUNTRIES.filter(c => !usedKeys.includes(c.value)).map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    )}
                    <input type="number" placeholder="Prix" value={pForm.price} step="0.01" min="0"
                      onChange={e => setPForm(f => ({ ...f, price: e.target.value }))}
                      style={{ ...S.input, width: '80px', fontSize: '12px', padding: '7px 10px' }} />
                    <select value={pForm.currency} onChange={e => setPForm(f => ({ ...f, currency: e.target.value }))}
                      style={{ ...S.input, width: '72px', fontSize: '12px', padding: '7px 8px' }}>
                      {GEO_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setShowPriceForm(false)} style={{ ...S.btn, ...S.btnSecondary, flex: 1, justifyContent: 'center', fontSize: '12px', padding: '7px' }}>Annuler</button>
                    <button onClick={savePricing} disabled={pSaving || !(pForm.type === 'zone' ? pForm.zone : pForm.country) || !pForm.price}
                      style={{ ...S.btn, ...S.btnPrimary, flex: 1, justifyContent: 'center', fontSize: '12px', padding: '7px', opacity: (pSaving || !(pForm.type === 'zone' ? pForm.zone : pForm.country) || !pForm.price) ? 0.5 : 1 }}>
                      {pSaving ? '...' : 'Enregistrer'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {geoTab === 1 && (
        <div>
          {geoLoading ? <div style={{ color: C.grey, fontSize: '13px' }}>Chargement...</div> : (
            <>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
                {[['blacklist', 'Blacklist — bloque les zones listees'], ['whitelist', 'Whitelist — autorise uniquement ces zones']].map(([m, l]) => (
                  <button key={m} onClick={() => setMode(m)}
                    style={{ ...S.btn, fontSize: '11px', padding: '6px 12px',
                      background: geoConfig?.mode === m ? (m === 'whitelist' ? '#e3f2fd' : '#fff3e0') : '#f5f5f5',
                      color: geoConfig?.mode === m ? (m === 'whitelist' ? '#1565c0' : '#e65100') : C.grey,
                      border: `1px solid ${geoConfig?.mode === m ? (m === 'whitelist' ? '#90caf9' : '#ffcc80') : '#e0e0e0'}`,
                    }}>{l}</button>
                ))}
                {geoConfig && (
                  <button onClick={removeRestrictions} style={{ ...S.btn, fontSize: '11px', padding: '6px 12px', background: '#ffebee', color: C.red, border: `1px solid #ffcdd2` }}>
                    Supprimer les restrictions
                  </button>
                )}
              </div>

              {!geoConfig && <div style={{ fontSize: '12px', color: C.grey, fontStyle: 'italic', marginBottom: '10px' }}>Aucune restriction active — cliquez sur un mode pour activer.</div>}

              {isWhitelist && geoZones.filter(z => z.is_active).length === 0 && (
                <div style={{ background: '#fff3e0', border: '1px solid #ffcc80', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#e65100', marginBottom: '12px' }}>
                  Attention : whitelist vide — le contenu est inaccessible partout.
                </div>
              )}

              {geoConfig && (
                <>
                  {geoZones.length > 0 && (
                    <div style={{ border: '1px solid #f0ede8', borderRadius: '10px', overflow: 'hidden', marginBottom: '12px' }}>
                      {geoZones.map((z, i) => (
                        <div key={z.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', background: i % 2 === 0 ? '#fafafa' : 'white', borderBottom: i < geoZones.length - 1 ? '1px solid #f0ede8' : 'none' }}>
                          <div>
                            <span style={{ fontSize: '12px', fontWeight: '600', color: C.textPrimary }}>{z.zone_label}</span>
                            <span style={{ fontSize: '10px', color: C.grey, marginLeft: '6px' }}>{z.zone?.length === 2 ? 'Pays' : 'Continent'}</span>
                            {z.reason && <div style={{ fontSize: '11px', color: C.grey, marginTop: '1px' }}>{z.reason}</div>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ ...S.chip, fontSize: '10px',
                              background: z.is_active ? (isWhitelist ? '#e8f5e9' : '#ffebee') : '#f5f5f5',
                              color: z.is_active ? (isWhitelist ? C.green : C.red) : C.grey,
                            }}>{z.is_active ? (isWhitelist ? 'Autorise' : 'Bloque') : 'Suspendu'}</span>
                            <button onClick={() => toggleZone(z)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '10px', color: C.blue, fontWeight: '700' }}>{z.is_active ? 'Off' : 'On'}</button>
                            <button onClick={() => deleteZone(z.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, fontSize: '14px', lineHeight: 1, padding: '0 2px' }}>x</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {geoZones.length === 0 && !showZoneForm && <div style={{ fontSize: '12px', color: C.grey, fontStyle: 'italic', marginBottom: '12px' }}>Aucune entree dans la liste</div>}
                  {!showZoneForm && (
                    <button onClick={() => setShowZoneForm(true)} style={{ ...S.btn, ...S.btnSecondary, fontSize: '12px', padding: '7px 14px' }}>
                      <Icon n="plus" size={13} color={C.textPrimary} /> Ajouter continent / pays
                    </button>
                  )}
                  {showZoneForm && (
                    <div style={{ background: '#fdf8f3', borderRadius: '10px', padding: '14px', border: '1px solid #e8e0d5' }}>
                      {typeToggle(zForm, setZForm)}
                      {zForm.type === 'zone' ? (
                        <select value={zForm.zone} onChange={e => setZForm(f => ({ ...f, zone: e.target.value }))}
                          style={{ ...S.input, fontSize: '12px', padding: '7px 10px', marginBottom: '8px' }}>
                          <option value="">Continent...</option>
                          {GEO_ZONES.filter(z => !usedZoneKeys.includes(z.value)).map(z => <option key={z.value} value={z.value}>{z.label}</option>)}
                        </select>
                      ) : (
                        <select value={zForm.country} onChange={e => setZForm(f => ({ ...f, country: e.target.value }))}
                          style={{ ...S.input, fontSize: '12px', padding: '7px 10px', marginBottom: '8px' }}>
                          <option value="">Pays...</option>
                          {GEO_COUNTRIES.filter(c => !usedZoneKeys.includes(c.value)).map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                      )}
                      <input placeholder="Raison (optionnel)" value={zForm.reason}
                        onChange={e => setZForm(f => ({ ...f, reason: e.target.value }))}
                        style={{ ...S.input, fontSize: '12px', padding: '7px 10px', marginBottom: '8px' }} />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => setShowZoneForm(false)} style={{ ...S.btn, ...S.btnSecondary, flex: 1, justifyContent: 'center', fontSize: '12px', padding: '7px' }}>Annuler</button>
                        <button onClick={saveZone} disabled={zSaving || !(zForm.type === 'zone' ? zForm.zone : zForm.country)}
                          style={{ ...S.btn, ...S.btnPrimary, flex: 1, justifyContent: 'center', fontSize: '12px', padding: '7px', opacity: (zSaving || !(zForm.type === 'zone' ? zForm.zone : zForm.country)) ? 0.5 : 1 }}>
                          {zSaving ? '...' : 'Ajouter'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page détail d'un livre (plein écran) ────────────────────
function BookDetailModal({ book, onClose, onStatusChange }) {
  const c = book.contents || book
  const [status, setStatus]           = useState(book.validation_status)
  const [reason, setReason]           = useState(book.rejection_reason || '')
  const [pendingAction, setPendingAction] = useState(null) // 'reject' | 'pause' | null
  const [actionLoading, setActionLoading] = useState(false)
  const [actionMsg, setActionMsg]         = useState(null)

  // Mode édition
  const [editing, setEditing]   = useState(false)
  const [editForm, setEditForm] = useState({
    title: c.title || '',
    author: c.author || '',
    description: c.description || '',
    language: c.language || 'fr',
    access_type: c.access_type || 'subscription',
    is_purchasable: Boolean(c.is_purchasable),
    price_cents: c.price_cents != null ? String(c.price_cents) : '',
    price_currency: c.price_currency || 'EUR',
    subscription_discount_percent: c.subscription_discount_percent != null ? String(c.subscription_discount_percent) : '',
    cover_url: c.cover_url || '',
  })
  const [editSaving, setEditSaving] = useState(false)
  const [editMsg, setEditMsg]       = useState(null)
  // Données affichées (mises à jour après save)
  const [live, setLive] = useState(c)

  const isAudio = live.content_type === 'audiobook' || live.format === 'mp3' || live.format === 'm4a'
  const isPdf   = live.format === 'pdf'
  const isEpub  = !isAudio && !isPdf
  const vc = status === 'approved' ? C.green : status === 'rejected' ? C.red : status === 'paused' ? C.orange : C.grey
  const vl = status === 'approved' ? 'Actif' : status === 'rejected' ? 'Rejeté' : status === 'paused' ? 'En pause' : 'En attente'
  const langLabel = live.language === 'fr' ? 'Français' : live.language === 'en' ? 'Anglais' : live.language || '—'

  async function saveEdit() {
    setEditMsg(null)
    const needsPrice = editForm.access_type !== 'subscription'
    const priceCents = editForm.price_cents !== '' ? parseInt(editForm.price_cents, 10) : null
    if (needsPrice) {
      if (priceCents == null || isNaN(priceCents) || priceCents <= 0) {
        setEditMsg({ type: 'error', text: `Le type "${editForm.access_type}" exige un prix > 0 en centimes (ex: 990 = 9,90 EUR).` })
        return
      }
    }
    setEditSaving(true)
    const payload = {
      title: editForm.title.trim() || undefined,
      author: editForm.author.trim() || undefined,
      description: editForm.description.trim() || undefined,
      language: editForm.language || undefined,
      access_type: editForm.access_type || undefined,
      // Règle DB : si payant → is_purchasable doit être true et price_cents > 0
      is_purchasable: needsPrice ? true : editForm.is_purchasable,
      price_cents: needsPrice ? priceCents : (editForm.price_cents !== '' ? priceCents : null),
      price_currency: editForm.price_currency || 'EUR',
      subscription_discount_percent: editForm.subscription_discount_percent !== '' ? parseInt(editForm.subscription_discount_percent, 10) : null,
      cover_url: editForm.cover_url.trim() || null,
    }
    const r = await apiJson(`/content/${live.id}/metadata`, 'PUT', payload)
    setEditSaving(false)
    if (r.error) { setEditMsg({ type: 'error', text: r.error }); return }
    setLive(prev => ({ ...prev, ...r.content }))
    setEditing(false)
    setEditMsg({ type: 'success', text: 'Modifications enregistrées.' })
  }

  // URLs proxy backend — même origine, aucun CORS
  const streamUrl   = c.id ? `/admin/api/content/${c.id}/stream` : null
  const downloadHref = c.id ? `/admin/api/content/${c.id}/stream?download=1` : null

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  function handleDownload() {
    if (!downloadHref) return
    const a = document.createElement('a')
    a.href = downloadHref
    a.target = '_blank'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  async function doAction(action) {
    if ((action === 'reject' || action === 'pause') && !reason.trim()) {
      setActionMsg({ type: 'error', text: 'Veuillez saisir un motif.' }); return
    }
    setActionLoading(true); setActionMsg(null)
    let r
    if (action === 'approve') r = await api(`/content/${book.id}/approve`, { method: 'PUT' })
    else if (action === 'reject') r = await apiJson(`/content/${book.id}/reject`, 'PUT', { reason })
    else if (action === 'pause') r = await apiJson(`/content/${book.id}/pause`, 'PUT', { reason })
    else if (action === 'pending') r = await api(`/content/${book.id}/pending`, { method: 'PUT' })
    setActionLoading(false)
    if (r?.error) { setActionMsg({ type: 'error', text: r.error }); return }
    const newStatus = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : action === 'pause' ? 'paused' : 'pending'
    setStatus(newStatus); setPendingAction(null)
    const msgs = { approve: 'Contenu approuvé et publié.', reject: 'Contenu rejeté.', pause: 'Contenu mis en pause.', pending: 'Remis en attente.' }
    setActionMsg({ type: 'success', text: msgs[action] })
    if (onStatusChange) onStatusChange(book.id, newStatus)
  }

  // ── Panneau lecteur (gauche) ────────────────────────────────
  function PreviewPanel() {
    if (!c.id || !c.file_key) return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '14px', padding: '40px', textAlign: 'center' }}>
        <Icon n="info" size={40} color={C.orange} />
        <div style={{ fontSize: '14px', color: C.orange }}>Aucun fichier associé à ce contenu.</div>
      </div>
    )

    // Audio → lecteur custom (src = proxy backend, même origine)
    if (isAudio) return (
      <AudioPlayer src={streamUrl} cover={c.cover_url} title={c.title} author={c.author} durationSecs={c.duration_seconds} />
    )

    // PDF → iframe natif (proxy backend → même origine)
    if (isPdf) return (
      <iframe src={streamUrl} title="Lecteur PDF" style={{ width: '100%', height: '100%', border: 'none', display: 'block' }} />
    )

    // EPUB → lecteur epub.js hébergé sur le backend (contentId, pas d'URL R2)
    return (
      <iframe
        src={`/admin/epub-reader?contentId=${c.id}`}
        title="Lecteur EPUB"
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        sandbox="allow-scripts allow-same-origin"
      />
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: '#f4f1ec', display: 'flex', flexDirection: 'column', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* ── Barre du haut ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 24px', background: 'white', borderBottom: '1px solid #e5e0d8', flexShrink: 0, minHeight: '60px' }}>
        <button onClick={onClose} style={{ ...S.btn, ...S.btnSecondary }}>
          <Icon n="arrow-left" size={15} color={C.textPrimary} /> Retour
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
          <Icon n={isAudio ? 'music' : 'book'} size={18} color={C.terre} />
          <span style={{ fontWeight: '800', fontSize: '17px', color: C.indigo, fontFamily: 'Georgia, serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{live.title || 'Sans titre'}</span>
          {live.author && <span style={{ fontSize: '14px', color: C.textSecondary, whiteSpace: 'nowrap' }}>— {live.author}</span>}
        </div>
        <span style={{ ...S.chip, background: vc + '20', color: vc, flexShrink: 0 }}>{vl}</span>
        <span style={{ ...S.chip, background: '#f0ede8', color: '#5d4037', flexShrink: 0 }}>{(live.format || (isAudio ? 'Audio' : 'Ebook')).toUpperCase()}</span>
        <button style={{ ...S.btn, ...S.btnSecondary, flexShrink: 0, opacity: !downloadHref ? 0.5 : 1 }} disabled={!downloadHref} onClick={handleDownload}>
          <Icon n="download" size={14} color={C.textPrimary} /> Télécharger
        </button>
      </div>

      {/* ── Corps principal ── */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 380px', overflow: 'hidden' }}>

        {/* ── Gauche : lecteur ── */}
        <div style={{ overflow: 'hidden', background: isAudio ? '#1a1a2e' : 'white' }}>
          <PreviewPanel />
        </div>

        {/* ── Droite : infos + actions ── */}
        <div style={{ borderLeft: '1px solid #e5e0d8', overflowY: 'auto', background: 'white' }}>

          {/* Couverture (ebook/pdf) */}
          {!isAudio && (
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f0ede8', display: 'flex', gap: '16px', alignItems: 'flex-start', background: '#fdf8f3' }}>
              {live.cover_url
                ? <img src={live.cover_url} alt="" style={{ width: '64px', height: '92px', objectFit: 'cover', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', flexShrink: 0 }} />
                : <div style={{ width: '64px', height: '92px', background: '#f0ede8', borderRadius: '6px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon n="book" size={28} color={C.grey} />
                  </div>
              }
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: '800', fontSize: '15px', color: C.indigo, fontFamily: 'Georgia, serif', marginBottom: '4px', lineHeight: '1.3' }}>{live.title || '—'}</div>
                {live.author && <div style={{ fontSize: '13px', color: C.textSecondary, marginBottom: '6px' }}>{live.author}</div>}
                <span style={{ ...S.chip, background: vc + '20', color: vc, fontSize: '11px' }}>{vl}</span>
              </div>
              <button onClick={() => { setEditing(e => !e); setEditMsg(null) }}
                style={{ ...S.btn, background: editing ? C.terre + '15' : '#f0ede8', color: C.terre, border: `1px solid ${C.terre}33`, padding: '6px 12px', fontSize: '11px', flexShrink: 0 }}>
                <Icon n="edit" size={12} color={C.terre} /> {editing ? 'Annuler' : 'Modifier'}
              </button>
            </div>
          )}

          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '0' }}>

            {/* Feedback édition */}
            {editMsg && (
              <div style={{ background: editMsg.type === 'error' ? '#ffebee' : '#e8f5e9', border: `1px solid ${editMsg.type === 'error' ? '#ef9a9a' : '#a5d6a7'}`, borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: editMsg.type === 'error' ? '#c62828' : '#2e7d32' }}>
                {editMsg.text}
              </div>
            )}

            {/* ── FORMULAIRE D'ÉDITION ── */}
            {editing ? (
              <div style={{ marginBottom: '22px' }}>
                <div style={{ fontSize: '11px', fontWeight: '800', color: C.terre, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '14px' }}>Modification du livre</div>

                {/* Titre & Auteur */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <div>
                    <label style={S.label}>Titre</label>
                    <input style={{ ...S.input, fontSize: '13px' }} value={editForm.title}
                      onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div>
                    <label style={S.label}>Auteur</label>
                    <input style={{ ...S.input, fontSize: '13px' }} value={editForm.author}
                      onChange={e => setEditForm(f => ({ ...f, author: e.target.value }))} />
                  </div>
                </div>

                {/* Description */}
                <div style={{ marginBottom: '10px' }}>
                  <label style={S.label}>Description</label>
                  <textarea style={{ ...S.input, minHeight: '80px', resize: 'vertical', fontSize: '13px' }}
                    value={editForm.description}
                    onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
                </div>

                {/* Langue & Type de vente */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <div>
                    <label style={S.label}>Langue</label>
                    <select style={{ ...S.input, fontSize: '13px' }} value={editForm.language}
                      onChange={e => setEditForm(f => ({ ...f, language: e.target.value }))}>
                      <option value="fr">Français</option>
                      <option value="en">Anglais</option>
                      <option value="ar">Arabe</option>
                      <option value="es">Espagnol</option>
                      <option value="pt">Portugais</option>
                      <option value="de">Allemand</option>
                      <option value="it">Italien</option>
                    </select>
                  </div>
                  <div>
                    <label style={S.label}>Type de vente</label>
                    <select style={{ ...S.input, fontSize: '13px' }} value={editForm.access_type}
                      onChange={e => setEditForm(f => ({ ...f, access_type: e.target.value }))}>
                      <option value="subscription">Abonnement</option>
                      <option value="paid">Achat direct</option>
                      <option value="subscription_or_paid">Abo. ou Achat</option>
                      <option value="free">Gratuit</option>
                    </select>
                  </div>
                </div>

                {/* Prix & Devise */}
                {editForm.access_type !== 'subscription' && (
                  <div style={{ background: '#fff8f0', border: '1px solid #f0d8c0', borderRadius: '8px', padding: '8px 12px', marginBottom: '10px', fontSize: '12px', color: '#7d4e00' }}>
                    Le type <strong>{editForm.access_type}</strong> exige un prix &gt; 0 et cochera automatiquement "Achetable".
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <div>
                    <label style={S.label}>Prix (centimes) {editForm.access_type !== 'subscription' ? '*' : ''}</label>
                    <input style={{ ...S.input, fontSize: '13px' }} type="number" min="0" value={editForm.price_cents}
                      placeholder="ex: 990 = 9,90"
                      onChange={e => setEditForm(f => ({ ...f, price_cents: e.target.value }))} />
                    {editForm.price_cents !== '' && !isNaN(parseInt(editForm.price_cents)) && (
                      <div style={{ fontSize: '11px', color: C.terre, marginTop: '3px' }}>
                        = {(parseInt(editForm.price_cents) / 100).toFixed(2)} {editForm.price_currency}
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={S.label}>Devise</label>
                    <select style={{ ...S.input, fontSize: '13px' }} value={editForm.price_currency}
                      onChange={e => setEditForm(f => ({ ...f, price_currency: e.target.value }))}>
                      {['EUR','USD','XAF','XOF','GBP','CAD','MAD','TND'].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={S.label}>Remise abonnés (%)</label>
                    <input style={{ ...S.input, fontSize: '13px' }} type="number" min="0" max="100" value={editForm.subscription_discount_percent}
                      placeholder="0"
                      onChange={e => setEditForm(f => ({ ...f, subscription_discount_percent: e.target.value }))} />
                  </div>
                </div>

                {/* Cover URL */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={S.label}>URL de couverture</label>
                  <input style={{ ...S.input, fontSize: '13px' }} value={editForm.cover_url}
                    placeholder="https://..."
                    onChange={e => setEditForm(f => ({ ...f, cover_url: e.target.value }))} />
                </div>

                {/* Achetable */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: C.textSecondary }}>
                    <input type="checkbox" checked={editForm.is_purchasable}
                      onChange={e => setEditForm(f => ({ ...f, is_purchasable: e.target.checked }))} />
                    Achetable (is_purchasable)
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => { setEditing(false); setEditMsg(null) }}
                    style={{ ...S.btn, ...S.btnSecondary, flex: 1, justifyContent: 'center', fontSize: '13px' }}>
                    Annuler
                  </button>
                  <button onClick={saveEdit} disabled={editSaving}
                    style={{ ...S.btn, ...S.btnPrimary, flex: 1, justifyContent: 'center', fontSize: '13px', opacity: editSaving ? 0.6 : 1 }}>
                    {editSaving ? '…' : <><Icon n="check" size={13} color="white" /> Enregistrer</>}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Description (lecture) */}
                {live.description && (
                  <div style={{ marginBottom: '22px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '800', color: C.grey, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' }}>Description</div>
                    <p style={{ margin: 0, fontSize: '13px', color: C.textPrimary, lineHeight: '1.7', background: '#fdf8f3', borderRadius: '10px', padding: '12px 14px' }}>
                      {live.description}
                    </p>
                  </div>
                )}

                {/* Métadonnées (lecture) */}
                <div style={{ marginBottom: '22px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: C.grey, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '12px' }}>Informations</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', borderRadius: '10px', overflow: 'hidden', border: '1px solid #f0ede8' }}>
                    {[
                      ['Type', isAudio ? 'Audiobook' : 'Ebook'],
                      ['Format', (live.format || '—').toUpperCase()],
                      ['Langue', langLabel],
                      ['Type de vente', live.access_type === 'subscription' ? 'Abonnement' : live.access_type === 'paid' ? 'Achat direct' : live.access_type === 'subscription_or_paid' ? 'Abo. ou Achat' : live.access_type === 'free' ? 'Gratuit' : live.access_type || '—'],
                      ['Prix de base', live.price_cents != null ? `${(live.price_cents / 100).toFixed(2)} ${live.price_currency || 'EUR'}` : '—'],
                      live.subscription_discount_percent ? ['Remise abonnés', `${live.subscription_discount_percent}%`] : null,
                      live.duration_seconds ? ['Durée', `${Math.floor(live.duration_seconds / 60)} min ${live.duration_seconds % 60} s`] : null,
                      ['Soumis le', book.submitted_at ? new Date(book.submitted_at).toLocaleDateString('fr-FR') : '—'],
                      book.reviewed_at ? ['Examiné le', new Date(book.reviewed_at).toLocaleDateString('fr-FR')] : null,
                      ['Publié', live.is_published ? 'Oui' : 'Non'],
                      live.file_key ? ['Clé R2', live.file_key] : null,
                    ].filter(Boolean).map(([l, v], i, arr) => (
                      <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 14px', background: i % 2 === 0 ? '#fafafa' : 'white', borderBottom: i < arr.length - 1 ? '1px solid #f0ede8' : 'none' }}>
                        <span style={{ fontSize: '12px', color: C.grey, fontWeight: '600', flexShrink: 0 }}>{l}</span>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: C.textPrimary, textAlign: 'right', wordBreak: 'break-all', maxWidth: '200px' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ── Séparateur ── */}
            <div style={{ borderTop: '2px solid #f0ede8', marginBottom: '22px' }} />

            {/* ── Décision Admin ── */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <Icon n="edit" size={14} color={C.indigo} />
                <span style={{ fontSize: '12px', fontWeight: '800', color: C.indigo, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Décision Admin</span>
              </div>

              {/* Feedback */}
              {actionMsg && (
                <div style={{ background: actionMsg.type === 'error' ? '#ffebee' : '#e8f5e9', border: `1px solid ${actionMsg.type === 'error' ? '#ef9a9a' : '#a5d6a7'}`, borderRadius: '10px', padding: '11px 14px', marginBottom: '14px', fontSize: '13px', color: actionMsg.type === 'error' ? '#c62828' : '#2e7d32', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Icon n={actionMsg.type === 'error' ? 'x' : 'check-circle'} size={15} color={actionMsg.type === 'error' ? '#c62828' : '#2e7d32'} />
                  {actionMsg.text}
                </div>
              )}

              {/* Statut actuel */}
              <div style={{ background: vc + '10', border: `1px solid ${vc}30`, borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: vc, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '11px', color: C.grey, marginBottom: '1px' }}>Statut actuel</div>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: vc }}>{vl}</div>
                </div>
              </div>

              {/* Motif actuel (rejet ou pause) */}
              {(status === 'rejected' || status === 'paused') && book.rejection_reason && !pendingAction && (
                <div style={{ background: '#fff8f0', border: `1px solid ${C.orange}33`, borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', fontSize: '12px', color: '#7d4e00', lineHeight: '1.5' }}>
                  <div style={{ fontWeight: '700', marginBottom: '3px', fontSize: '10px', textTransform: 'uppercase', color: C.orange }}>Motif</div>
                  {book.rejection_reason}
                </div>
              )}

              {/* Formulaire raison (pour rejeter ou mettre en pause) */}
              {pendingAction && (
                <div style={{ background: '#fdf8f3', borderRadius: '10px', padding: '14px', border: `1px solid ${pendingAction === 'reject' ? C.red : C.orange}33`, marginBottom: '14px' }}>
                  <label style={{ ...S.label, marginBottom: '8px' }}>
                    {pendingAction === 'reject' ? 'Motif du rejet *' : 'Motif de la mise en pause *'}
                  </label>
                  <textarea
                    style={{ ...S.input, minHeight: '80px', resize: 'vertical', marginBottom: '12px', fontSize: '13px' }}
                    placeholder={pendingAction === 'reject' ? 'Expliquez le motif de rejet (visible par l\'éditeur)…' : 'Expliquez pourquoi ce contenu est mis en pause…'}
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button style={{ ...S.btn, ...S.btnSecondary, flex: 1, justifyContent: 'center', fontSize: '12px' }}
                      onClick={() => { setPendingAction(null); setReason(book.rejection_reason || '') }}>
                      Annuler
                    </button>
                    <button
                      style={{ ...S.btn, flex: 1, justifyContent: 'center', fontSize: '12px', opacity: actionLoading ? 0.6 : 1,
                        background: pendingAction === 'reject' ? C.red : C.orange, color: 'white' }}
                      disabled={actionLoading}
                      onClick={() => doAction(pendingAction)}>
                      {actionLoading ? '…' : 'Confirmer'}
                    </button>
                  </div>
                </div>
              )}

              {/* Boutons d'action */}
              {!pendingAction && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {/* En attente */}
                  <button
                    style={{ ...S.btn, justifyContent: 'center', fontSize: '12px', padding: '9px',
                      background: status === 'pending' ? '#e8e8f0' : '#f5f5f5',
                      color: status === 'pending' ? C.indigo : C.textSecondary,
                      border: `1px solid ${status === 'pending' ? C.indigo + '44' : '#e0e0e0'}`,
                      fontWeight: status === 'pending' ? '700' : '400' }}
                    disabled={actionLoading || status === 'pending'}
                    onClick={() => doAction('pending')}>
                    En attente
                  </button>

                  {/* Actif */}
                  <button
                    style={{ ...S.btn, justifyContent: 'center', fontSize: '12px', padding: '9px',
                      background: status === 'approved' ? '#e8f5e9' : '#f5f5f5',
                      color: status === 'approved' ? C.green : C.textSecondary,
                      border: `1px solid ${status === 'approved' ? C.green + '44' : '#e0e0e0'}`,
                      fontWeight: status === 'approved' ? '700' : '400' }}
                    disabled={actionLoading || status === 'approved'}
                    onClick={() => doAction('approve')}>
                    <Icon n="check-circle" size={13} color={status === 'approved' ? C.green : C.textSecondary} /> Actif
                  </button>

                  {/* En pause */}
                  <button
                    style={{ ...S.btn, justifyContent: 'center', fontSize: '12px', padding: '9px',
                      background: status === 'paused' ? '#fff3e0' : '#f5f5f5',
                      color: status === 'paused' ? C.orange : C.textSecondary,
                      border: `1px solid ${status === 'paused' ? C.orange + '44' : '#e0e0e0'}`,
                      fontWeight: status === 'paused' ? '700' : '400' }}
                    disabled={actionLoading || status === 'paused'}
                    onClick={() => { setPendingAction('pause'); setReason('') }}>
                    En pause
                  </button>

                  {/* Rejeté */}
                  <button
                    style={{ ...S.btn, justifyContent: 'center', fontSize: '12px', padding: '9px',
                      background: status === 'rejected' ? '#ffebee' : '#f5f5f5',
                      color: status === 'rejected' ? C.red : C.textSecondary,
                      border: `1px solid ${status === 'rejected' ? C.red + '44' : '#e0e0e0'}`,
                      fontWeight: status === 'rejected' ? '700' : '400' }}
                    disabled={actionLoading || status === 'rejected'}
                    onClick={() => { setPendingAction('reject'); setReason('') }}>
                    <Icon n="x" size={13} color={status === 'rejected' ? C.red : C.textSecondary} /> Rejeté
                  </button>
                </div>
              )}
            </div>

            {/* ── Prix & Restrictions Géographiques ── */}
            {c.id && <GeoPanel contentId={c.id} />}

          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Vue LISTE ───────────────────────────────────────────────
function ListView({ onSelect, reload }) {
  const [publishers, setPublishers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [form, setForm] = useState({ companyName: '', contactName: '', email: '', description: '', website: '' })
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState(null)

  function load() {
    setLoading(true)
    const qs = new URLSearchParams()
    if (statusFilter) qs.set('status', statusFilter)
    if (search) qs.set('search', search)
    api(`/publishers?${qs}`)
      .then(d => setPublishers(d.publishers || []))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [statusFilter, reload])

  async function handleInvite() {
    if (!form.companyName || !form.contactName || !form.email) {
      setInviteMsg({ type: 'error', text: 'Nom, responsable et email sont obligatoires.' })
      return
    }
    setInviting(true)
    setInviteMsg(null)
    try {
      const res = await apiJson('/publishers/invite', 'POST', {
        companyName: form.companyName, contactName: form.contactName,
        email: form.email, description: form.description,
        revenueGrid: { threshold_cad: 5, above_threshold_cad: 5, below_threshold_cad: 2.5 },
      })
      if (res.error) throw new Error(res.error)
      setInviteMsg({ type: 'success', text: `Invitation envoyée à ${form.email}` })
      setForm({ companyName: '', contactName: '', email: '', description: '', website: '' })
      load()
    } catch (e) {
      setInviteMsg({ type: 'error', text: e.message })
    } finally {
      setInviting(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: C.indigo, margin: '0 0 4px', fontFamily: 'Georgia, serif' }}>Éditeurs</h1>
          <p style={{ fontSize: '14px', color: C.textSecondary, margin: 0 }}>{publishers.length} éditeur{publishers.length !== 1 ? 's' : ''}</p>
        </div>
        <button style={{ ...S.btn, ...S.btnPrimary }} onClick={() => { setShowInvite(true); setInviteMsg(null) }}>
          ➕ Créer un éditeur
        </button>
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
        <input
          style={{ ...S.input, width: '280px' }}
          placeholder="Rechercher par nom ou email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load()}
        />
        <select style={{ ...S.input, width: '160px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={S.card}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: C.grey }}>Chargement…</div>
        ) : publishers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: C.grey }}>Aucun éditeur trouvé</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#fafafa' }}>
              <tr>
                {['Éditeur', 'Livres', 'Revenu total', 'À verser', 'Statut', 'Depuis', ''].map(h => (
                  <th key={h} style={{ ...S.thCell, textAlign: h === '' || h === 'Livres' || h === 'Revenu total' || h === 'À verser' ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {publishers.map(pub => {
                const st = STATUS[pub.status] || STATUS.pending
                return (
                  <tr key={pub.id} style={{ cursor: 'pointer' }} onClick={() => onSelect(pub.id)}
                    onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                    onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                    <td style={S.tdCell}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={S.avatar}>{pub.company_name?.charAt(0).toUpperCase()}</div>
                        <div>
                          <div style={{ fontWeight: '700', color: C.textPrimary }}>{pub.company_name}</div>
                          <div style={{ fontSize: '12px', color: C.grey }}>{pub.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ ...S.tdCell, textAlign: 'right', fontWeight: '700' }}>{pub.books_count ?? 0}</td>
                    <td style={{ ...S.tdCell, textAlign: 'right', fontWeight: '700', color: C.terre }}>{Number(pub.total_revenue_cad ?? 0).toFixed(2)} CAD</td>
                    <td style={{ ...S.tdCell, textAlign: 'right', fontWeight: '800', color: pub.pending_payout_cad > 0 ? C.orange : C.grey }}>{Number(pub.pending_payout_cad ?? 0).toFixed(2)} CAD</td>
                    <td style={S.tdCell}>
                      <span style={{ ...S.chip, background: st.bg, color: st.color }}>{st.label}</span>
                    </td>
                    <td style={{ ...S.tdCell, fontSize: '12px', color: C.grey }}>
                      {pub.activated_at ? new Date(pub.activated_at).toLocaleDateString('fr-FR') : 'Invitation envoyée'}
                    </td>
                    <td style={{ ...S.tdCell, textAlign: 'right' }}>
                      <Icon n="chevron-right" size={18} color={C.grey} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal invitation */}
      {showInvite && (
        <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) setShowInvite(false) }}>
          <div style={S.modal}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: C.indigo }}>Créer un éditeur</h2>
              <button onClick={() => setShowInvite(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.grey, display: 'flex', alignItems: 'center', padding: '4px' }}><Icon n="x" size={20} color={C.grey} /></button>
            </div>
            {inviteMsg && (
              <div style={{ background: inviteMsg.type === 'error' ? '#ffebee' : '#e8f5e9', border: `1px solid ${inviteMsg.type === 'error' ? C.red : C.green}`, borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', color: inviteMsg.type === 'error' ? '#c62828' : '#2e7d32', fontSize: '14px' }}>
                {inviteMsg.text}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              {[
                { label: "Maison d'édition *", key: 'companyName', span: 1 },
                { label: 'Responsable *', key: 'contactName', span: 1 },
                { label: 'Email *', key: 'email', span: 2 },
                { label: 'Site web', key: 'website', span: 2 },
                { label: 'Description', key: 'description', span: 2 },
              ].map(f => (
                <div key={f.key} style={{ gridColumn: `span ${f.span}` }}>
                  <label style={S.label}>{f.label}</label>
                  {f.key === 'description'
                    ? <textarea style={{ ...S.input, minHeight: '70px', resize: 'vertical' }} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
                    : <input style={S.input} type={f.key === 'email' ? 'email' : 'text'} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
                  }
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button style={{ ...S.btn, ...S.btnSecondary }} onClick={() => setShowInvite(false)}>Annuler</button>
              <button style={{ ...S.btn, ...S.btnPrimary, opacity: inviting ? 0.7 : 1 }} onClick={handleInvite} disabled={inviting}>
                {inviting ? '…' : <><Icon n="send" size={13} color="white" /> Créer et envoyer l'invitation</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Vue DÉTAIL éditeur ───────────────────────────────────────
// Presets de période
const PERIOD_PRESETS = [
  { label: 'Tout', value: 'all' },
  { label: 'Ce mois', value: 'month' },
  { label: '3 mois', value: '3months' },
  { label: '6 mois', value: '6months' },
  { label: 'Cette année', value: 'year' },
  { label: 'Personnalisé', value: 'custom' },
]
function periodToDates(preset) {
  const now = new Date()
  if (preset === 'all') return { from: null, to: null }
  if (preset === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    return { from, to: null }
  }
  if (preset === '3months') {
    const from = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString()
    return { from, to: null }
  }
  if (preset === '6months') {
    const from = new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString()
    return { from, to: null }
  }
  if (preset === 'year') {
    const from = new Date(now.getFullYear(), 0, 1).toISOString()
    return { from, to: null }
  }
  return { from: null, to: null }
}

function DetailView({ publisherId, onBack }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(0)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [showGridModal, setShowGridModal] = useState(false)
  const [newStatus, setNewStatus] = useState('')
  const [grid, setGrid] = useState({ threshold_cad: 5, above_threshold_cad: 5, below_threshold_cad: 2.5 })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [selectedBook, setSelectedBook] = useState(null)

  // Filtre période
  const [preset, setPreset] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [statsLoading, setStatsLoading] = useState(false)

  function buildQs(p, cf, ct) {
    const qs = new URLSearchParams()
    if (p === 'custom') {
      if (cf) qs.set('from', new Date(cf).toISOString())
      if (ct) qs.set('to', new Date(ct + 'T23:59:59').toISOString())
    } else {
      const { from, to } = periodToDates(p)
      if (from) qs.set('from', from)
      if (to) qs.set('to', to)
    }
    return qs.toString()
  }

  function load(p = preset, cf = customFrom, ct = customTo) {
    setLoading(true)
    const qs = buildQs(p, cf, ct)
    api(`/publishers/${publisherId}${qs ? '?' + qs : ''}`)
      .then(d => {
        setData(d)
        setNewStatus(d.publisher?.status || 'pending')
        setGrid(d.publisher?.revenue_grid || { threshold_cad: 5, above_threshold_cad: 5, below_threshold_cad: 2.5 })
      })
      .finally(() => setLoading(false))
  }

  function reloadStats(p = preset, cf = customFrom, ct = customTo) {
    setStatsLoading(true)
    const qs = buildQs(p, cf, ct)
    api(`/publishers/${publisherId}${qs ? '?' + qs : ''}`)
      .then(d => setData(prev => ({ ...prev, revenue: d.revenue, revenueByBook: d.revenueByBook })))
      .finally(() => setStatsLoading(false))
  }

  function applyPreset(p) {
    setPreset(p)
    if (p !== 'custom') reloadStats(p, customFrom, customTo)
  }

  function applyCustom() {
    reloadStats('custom', customFrom, customTo)
  }

  useEffect(() => { load() }, [publisherId])

  async function saveStatus() {
    setSaving(true)
    try {
      await apiJson(`/publishers/${publisherId}/status`, 'PUT', { status: newStatus })
      setShowStatusModal(false); load()
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }
  async function saveGrid() {
    setSaving(true)
    try {
      await apiJson(`/publishers/${publisherId}/revenue-grid`, 'PUT', grid)
      setShowGridModal(false); load()
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '60px', color: C.grey }}>Chargement…</div>
  if (!data) return null

  const { publisher, books = [], revenue, revenueByBook = [], payouts = [], nextPayoutDate } = data
  const st = STATUS[publisher.status] || STATUS.pending

  const kpis = [
    { label: 'Solde à verser', value: `${revenue?.pending?.toFixed(2) ?? '0.00'} CAD`, color: C.orange, icon: 'dollar' },
    { label: 'Revenu total', value: `${revenue?.total?.toFixed(2) ?? '0.00'} CAD`, color: C.terre, icon: 'trending-up' },
    { label: 'Livres publiés', value: books.filter(b => b.validation_status === 'approved').length, color: C.green, icon: 'book' },
    { label: 'Prochain versement', value: nextPayoutDate ? new Date(nextPayoutDate).toLocaleDateString('fr-FR') : '—', color: C.purple, icon: 'calendar' },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
        <button onClick={onBack} style={{ ...S.btn, ...S.btnSecondary }}><Icon n="arrow-left" size={15} color={C.textPrimary} /> Retour</button>
        <div style={{ ...S.avatar, width: '50px', height: '50px', fontSize: '18px' }}>{publisher.company_name?.charAt(0).toUpperCase()}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: C.indigo, margin: 0, fontFamily: 'Georgia, serif' }}>{publisher.company_name}</h1>
            <span style={{ ...S.chip, background: st.bg, color: st.color }}>{st.label}</span>
          </div>
          <p style={{ margin: 0, fontSize: '14px', color: C.textSecondary }}>{publisher.contact_name} · {publisher.email}</p>
        </div>
        <button style={{ ...S.btn, ...S.btnSecondary }} onClick={() => setShowStatusModal(true)}><Icon n="edit" size={14} color={C.textPrimary} /> Changer statut</button>
        <button style={{ ...S.btn, ...S.btnPrimary }} onClick={() => {
          sessionStorage.setItem('publisher_create_context', JSON.stringify({ id: publisher.id, company_name: publisher.company_name }))
          window.location.href = '/admin/pages/publisher-content-create'
        }}>
          <Icon n="plus" size={14} color="white" /> Nouveau contenu
        </button>
      </div>

      {/* Filtre période */}
      <div style={{ background: C.card, borderRadius: '12px', padding: '14px 18px', marginBottom: '18px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', fontWeight: '700', color: C.grey, marginRight: '4px' }}>Période :</span>
        {PERIOD_PRESETS.map(p => (
          <button key={p.value} onClick={() => applyPreset(p.value)}
            style={{ padding: '6px 14px', borderRadius: '20px', border: `1px solid ${preset === p.value ? C.terre : '#e0e0e0'}`, background: preset === p.value ? C.terre : '#f5f5f5', color: preset === p.value ? 'white' : C.textSecondary, fontSize: '12px', fontWeight: preset === p.value ? '700' : '400', cursor: 'pointer', transition: 'all 0.12s' }}>
            {p.label}
          </button>
        ))}
        {preset === 'custom' && (
          <>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              style={{ ...S.input, width: '140px', fontSize: '12px', padding: '6px 10px' }} />
            <span style={{ fontSize: '12px', color: C.grey }}>→</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              style={{ ...S.input, width: '140px', fontSize: '12px', padding: '6px 10px' }} />
            <button onClick={applyCustom}
              style={{ ...S.btn, background: C.terre, color: 'white', padding: '6px 14px', fontSize: '12px' }}>
              Appliquer
            </button>
          </>
        )}
        {statsLoading && <span style={{ fontSize: '12px', color: C.grey, fontStyle: 'italic' }}>Mise à jour…</span>}
        {preset !== 'all' && (
          <span style={{ fontSize: '11px', color: C.terre, marginLeft: 'auto', fontStyle: 'italic' }}>
            Stats filtrées — les livres et versements restent globaux
          </span>
        )}
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {kpis.map(k => (
          <div key={k.label} style={{ background: C.card, borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: k.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
              <Icon n={k.icon} size={20} color={k.color} />
            </div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: C.textSecondary, textTransform: 'uppercase', marginBottom: '4px' }}>{k.label}</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Infos + Grille */}
      <div style={{ display: 'grid', gridTemplateColumns: '6fr 4fr', gap: '20px', marginBottom: '24px' }}>
        <div style={{ ...S.card, padding: '24px' }}>
          <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '16px' }}>Informations</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {[
              ['Email', publisher.email],
              ['Responsable', publisher.contact_name],
              ['Activé le', publisher.activated_at ? new Date(publisher.activated_at).toLocaleDateString('fr-FR') : 'Pas encore activé'],
              ['Créé le', new Date(publisher.created_at).toLocaleDateString('fr-FR')],
              ['Mode de paiement', publisher.payout_method?.type === 'bank_transfer' ? 'Virement' : publisher.payout_method?.type === 'mobile_money' ? `Mobile Money (${publisher.payout_method.operator})` : publisher.payout_method?.type === 'paypal' ? 'PayPal' : 'Non renseigné'],
              ['Description', publisher.description || '—'],
            ].map(([l, v]) => (
              <div key={l}>
                <div style={{ fontSize: '12px', color: C.grey, marginBottom: '2px' }}>{l}</div>
                <div style={{ fontSize: '13px', fontWeight: '600' }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ ...S.card, padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ fontWeight: '700', fontSize: '15px' }}>Grille de revenus</div>
            <button style={{ ...S.btn, background: 'none', color: C.terre, padding: '4px 8px' }} onClick={() => setShowGridModal(true)}><Icon n="edit" size={14} color={C.terre} /> Modifier</button>
          </div>
          {[
            ['Seuil de prix', `${publisher.revenue_grid?.threshold_cad ?? 5} CAD`],
            ['Part si prix > seuil', `${publisher.revenue_grid?.above_threshold_cad ?? 5} CAD`],
            ['Part si prix ≤ seuil', `${publisher.revenue_grid?.below_threshold_cad ?? 2.5} CAD`],
          ].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${C.lightGrey}` }}>
              <span style={{ fontSize: '13px', color: C.textSecondary }}>{l}</span>
              <span style={{ fontSize: '13px', fontWeight: '800', color: C.terre }}>{v}</span>
            </div>
          ))}
          <div style={{ marginTop: '14px', padding: '10px 14px', background: '#fff8f0', borderRadius: '8px', fontSize: '12px', color: C.orange }}>
            Déjà versé : <strong>{revenue?.paid?.toFixed(2) ?? '0.00'} CAD</strong>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={S.card}>
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.lightGrey}` }}>
          {[`Livres (${books.length})`, 'Revenus par livre', `Versements (${payouts.length})`].map((t, i) => (
            <button key={t} onClick={() => setTab(i)} style={{ background: 'none', border: 'none', borderBottom: `3px solid ${tab === i ? C.terre : 'transparent'}`, padding: '14px 20px', cursor: 'pointer', fontWeight: tab === i ? '700' : '400', color: tab === i ? C.terre : C.textSecondary, fontSize: '14px', transition: 'all 0.15s' }}>
              {t}
            </button>
          ))}
        </div>
        <div style={{ padding: '0' }}>
          {tab === 0 && (
            books.length === 0 ? <div style={{ textAlign: 'center', padding: '40px', color: C.grey }}>Aucun livre soumis</div> : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#fafafa' }}>
                  <tr>{['Livre', 'Type', 'Type de vente', 'Prix', 'Statut', 'Soumis le', ''].map(h => <th key={h} style={S.thCell}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {books.map(book => {
                    const c = book.contents || book
                    const vs = book.validation_status
                    const vc = vs === 'approved' ? C.green : vs === 'rejected' ? C.red : vs === 'paused' ? C.orange : C.grey
                    const vl = vs === 'approved' ? 'Actif' : vs === 'rejected' ? 'Rejeté' : vs === 'paused' ? 'En pause' : 'En attente'
                    const isAudio = c.content_type === 'audiobook' || c.format === 'mp3' || c.format === 'm4a'
                    const accessLabel = c.access_type === 'subscription' ? 'Abonnement' : c.access_type === 'paid' ? 'Achat' : c.access_type === 'subscription_or_paid' ? 'Abo./Achat' : c.access_type === 'free' ? 'Gratuit' : '—'
                    const priceLabel = c.price_cents != null ? `${(c.price_cents / 100).toFixed(2)} ${c.price_currency || 'EUR'}` : '—'
                    return (
                      <tr key={book.id} onClick={() => setSelectedBook(book)}
                        style={{ cursor: 'pointer', transition: 'background 0.12s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#fdf8f4'}
                        onMouseLeave={e => e.currentTarget.style.background = ''}>
                        <td style={S.tdCell}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {c.cover_url ? <img src={c.cover_url} alt="" style={{ width: '30px', height: '42px', objectFit: 'cover', borderRadius: '4px' }} /> : <div style={{ width: '30px', height: '42px', background: '#f0ede8', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon n={isAudio ? 'music' : 'book'} size={14} color={C.grey} /></div>}
                            <div>
                              <div style={{ fontWeight: '700', fontSize: '13px' }}>{c.title || '—'}</div>
                              <div style={{ fontSize: '12px', color: C.grey }}>{c.author}</div>
                            </div>
                          </div>
                        </td>
                        <td style={S.tdCell}><span style={{ ...S.chip, background: '#f0ede8', color: '#5d4037' }}>{c.content_type === 'audiobook' ? 'Audio' : c.content_type === 'both' ? 'Ebook+Audio' : 'Ebook'}</span></td>
                        <td style={{ ...S.tdCell, fontSize: '12px' }}><span style={{ ...S.chip, background: '#e8f0fe', color: '#1a56db', fontSize: '11px' }}>{accessLabel}</span></td>
                        <td style={{ ...S.tdCell, fontSize: '12px', fontWeight: '700', color: c.price_cents != null ? C.terre : C.grey }}>{priceLabel}</td>
                        <td style={S.tdCell}><span style={{ ...S.chip, background: vc + '20', color: vc }}>{vl}</span></td>
                        <td style={{ ...S.tdCell, fontSize: '12px', color: C.grey }}>{book.submitted_at ? new Date(book.submitted_at).toLocaleDateString('fr-FR') : '—'}</td>
                        <td style={{ ...S.tdCell }}><Icon n="chevron-right" size={15} color={C.grey} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )
          )}
          {tab === 1 && (
            revenueByBook.length === 0 ? <div style={{ textAlign: 'center', padding: '40px', color: C.grey }}>Aucune vente</div> : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#fafafa' }}>
                  <tr>{['Livre', 'Ventes', 'Normal', 'Bonus', 'Total'].map(h => <th key={h} style={{ ...S.thCell, textAlign: h === 'Livre' ? 'left' : 'right' }}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {revenueByBook.map((row, i) => (
                    <tr key={i}>
                      <td style={S.tdCell}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {row.content?.cover_url ? <img src={row.content.cover_url} alt="" style={{ width: '24px', height: '34px', objectFit: 'cover', borderRadius: '3px' }} /> : <div style={{ width: '24px', height: '34px', background: '#f0ede8', borderRadius: '3px' }} />}
                          <div><div style={{ fontWeight: '700', fontSize: '13px' }}>{row.content?.title || '—'}</div><div style={{ fontSize: '12px', color: C.grey }}>{row.content?.author}</div></div>
                        </div>
                      </td>
                      <td style={{ ...S.tdCell, textAlign: 'right', fontWeight: '700' }}>{row.sales}</td>
                      <td style={{ ...S.tdCell, textAlign: 'right', color: C.terre, fontWeight: '700' }}>{row.normal.toFixed(2)} CAD</td>
                      <td style={{ ...S.tdCell, textAlign: 'right', color: C.or, fontWeight: '700' }}>{row.bonus.toFixed(2)} CAD</td>
                      <td style={{ ...S.tdCell, textAlign: 'right', fontWeight: '800', color: C.textPrimary }}>{row.total.toFixed(2)} CAD</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
          {tab === 2 && (
            payouts.length === 0 ? <div style={{ textAlign: 'center', padding: '40px', color: C.grey }}>Aucun versement</div> : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#fafafa' }}>
                  <tr>{['Période', 'Montant', 'Statut', 'Payé le', 'Notes'].map(h => <th key={h} style={S.thCell}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {payouts.map(p => {
                    const ps = PAYOUT_STATUS[p.status] || PAYOUT_STATUS.pending
                    return (
                      <tr key={p.id}>
                        <td style={{ ...S.tdCell, fontWeight: '600', fontSize: '13px' }}>{p.period_start ? new Date(p.period_start).toLocaleDateString('fr-FR') : '—'} → {p.period_end ? new Date(p.period_end).toLocaleDateString('fr-FR') : '—'}</td>
                        <td style={{ ...S.tdCell, fontWeight: '800', color: C.terre }}>{Number(p.amount_cad).toFixed(2)} CAD</td>
                        <td style={S.tdCell}><span style={{ ...S.chip, background: ps.color + '20', color: ps.color }}>{ps.label}</span></td>
                        <td style={{ ...S.tdCell, fontSize: '12px', color: C.grey }}>{p.paid_at ? new Date(p.paid_at).toLocaleDateString('fr-FR') : '—'}</td>
                        <td style={{ ...S.tdCell, fontSize: '12px', color: C.grey }}>{p.notes || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>

      {/* Page détail livre (plein écran) */}
      {selectedBook && (
        <BookDetailModal
          book={selectedBook}
          onClose={() => setSelectedBook(null)}
          onStatusChange={(bookId, newStatus) => {
            // Met à jour localement le statut dans la liste sans recharger toute la page
            setData(d => ({
              ...d,
              books: d.books.map(b => b.id === bookId ? { ...b, validation_status: newStatus } : b),
            }))
          }}
        />
      )}

      {/* Modal statut */}
      {showStatusModal && (
        <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) setShowStatusModal(false) }}>
          <div style={{ ...S.modal, maxWidth: '360px' }}>
            <h3 style={{ margin: '0 0 16px', color: C.indigo }}>Changer le statut</h3>
            <select style={{ ...S.input, marginBottom: '16px' }} value={newStatus} onChange={e => setNewStatus(e.target.value)}>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button style={{ ...S.btn, ...S.btnSecondary }} onClick={() => setShowStatusModal(false)}>Annuler</button>
              <button style={{ ...S.btn, ...S.btnPrimary, opacity: saving ? 0.7 : 1 }} onClick={saveStatus} disabled={saving}>{saving ? '…' : 'Enregistrer'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal grille */}
      {showGridModal && (
        <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) setShowGridModal(false) }}>
          <div style={{ ...S.modal, maxWidth: '380px' }}>
            <h3 style={{ margin: '0 0 16px', color: C.indigo }}>Modifier la grille de revenus</h3>
            {[['Seuil (CAD)', 'threshold_cad'], ['Au-dessus du seuil (CAD)', 'above_threshold_cad'], ['En-dessous du seuil (CAD)', 'below_threshold_cad']].map(([l, k]) => (
              <div key={k} style={{ marginBottom: '14px' }}>
                <label style={S.label}>{l}</label>
                <input type="number" style={S.input} value={grid[k]} onChange={e => setGrid(g => ({ ...g, [k]: +e.target.value }))} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button style={{ ...S.btn, ...S.btnSecondary }} onClick={() => setShowGridModal(false)}>Annuler</button>
              <button style={{ ...S.btn, ...S.btnPrimary, opacity: saving ? 0.7 : 1 }} onClick={saveGrid} disabled={saving}>{saving ? '…' : 'Enregistrer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Composant principal (routage interne liste ↔ détail) ─────
export default function PublishersManager() {
  const [selectedId, setSelectedId] = useState(null)
  const [reload, setReload] = useState(0)

  return (
    <div style={{ width: '100%', padding: '32px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', boxSizing: 'border-box', background: C.bg, minHeight: '100vh' }}>
      {selectedId
        ? <DetailView publisherId={selectedId} onBack={() => { setSelectedId(null); setReload(r => r + 1) }} />
        : <ListView onSelect={setSelectedId} reload={reload} />
      }
    </div>
  )
}
