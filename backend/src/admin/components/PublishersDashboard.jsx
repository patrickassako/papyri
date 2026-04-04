import React, { useState, useEffect, useCallback } from 'react'

const C = {
  terre: '#B5651D', or: '#D4A017', indigo: '#2E4057',
  green: '#27ae60', red: '#e74c3c', blue: '#2196F3', purple: '#9C27B0',
  orange: '#FF9800', grey: '#8c8c8c', lightGrey: '#f0f0f0',
  card: '#ffffff', bg: '#f4f1ec',
  textPrimary: '#1a1a2e', textSecondary: '#6b7280',
}

const S = {
  page: { width: '100%', padding: '32px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', boxSizing: 'border-box', background: C.bg, minHeight: '100vh' },
  header: { marginBottom: '28px' },
  title: { fontSize: '26px', fontWeight: '800', color: C.indigo, margin: '0 0 4px', fontFamily: 'Georgia, serif' },
  sub: { fontSize: '14px', color: C.textSecondary, margin: 0 },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '28px' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' },
  grid12: { display: 'grid', gridTemplateColumns: '5fr 7fr', gap: '20px', marginBottom: '20px' },
  card: { background: C.card, borderRadius: '14px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  kpiIcon: { width: '44px', height: '44px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' },
  kpiLabel: { fontSize: '12px', fontWeight: '600', color: C.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' },
  kpiValue: { fontSize: '30px', fontWeight: '800', color: C.textPrimary, lineHeight: 1.1, marginBottom: '4px' },
  kpiSub: { fontSize: '12px', color: C.grey },
  sectionTitle: { fontSize: '16px', fontWeight: '700', color: C.textPrimary, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' },
  row: { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: `1px solid ${C.lightGrey}` },
  rowLast: { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0' },
  avatar: { width: '36px', height: '36px', borderRadius: '50%', background: C.terre, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '14px', flexShrink: 0 },
  rank: { fontSize: '13px', fontWeight: '800', color: '#ccc', minWidth: '20px' },
  badge: { padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' },
  barWrap: { height: '7px', background: C.lightGrey, borderRadius: '4px', overflow: 'hidden', marginTop: '4px' },
  tableHead: { display: 'grid', gap: '8px', padding: '8px 0', borderBottom: `2px solid ${C.lightGrey}`, marginBottom: '4px', fontSize: '12px', fontWeight: '700', color: C.grey, textTransform: 'uppercase' },
  tableRow: { display: 'grid', gap: '8px', padding: '10px 0', borderBottom: `1px solid ${C.lightGrey}`, alignItems: 'center' },
}

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
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
    return { from: from.toISOString(), to: null }
  }
  if (preset === '3months') {
    const from = new Date(now); from.setMonth(from.getMonth() - 3)
    return { from: from.toISOString(), to: null }
  }
  if (preset === '6months') {
    const from = new Date(now); from.setMonth(from.getMonth() - 6)
    return { from: from.toISOString(), to: null }
  }
  if (preset === 'year') {
    const from = new Date(now.getFullYear(), 0, 1)
    return { from: from.toISOString(), to: null }
  }
  return { from: null, to: null }
}

// Feather-style SVG icon helper
function Icon({ n, size = 18, color = 'currentColor', style }) {
  const p = {
    building:       '<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    'check-circle': '<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    dollar:         '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>',
    mail:           '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
    award:          '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>',
    'book-open':    '<path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>',
    'bar-chart':    '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
    clock:          '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    check:          '<polyline points="20 6 9 17 4 12"/>',
    calendar:       '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
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

function KpiCard({ label, value, sub, color, icon }) {
  return (
    <div style={S.card}>
      <div style={{ ...S.kpiIcon, background: color + '18' }}>
        <Icon n={icon} size={22} color={color} />
      </div>
      <div style={S.kpiLabel}>{label}</div>
      <div style={{ ...S.kpiValue, color }}>{value}</div>
      {sub && <div style={S.kpiSub}>{sub}</div>}
    </div>
  )
}

export default function PublishersDashboard() {
  const [stats, setStats]         = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [statsLoading, setStatsLoading] = useState(false)

  // Period filter state
  const [preset, setPreset]       = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo]   = useState('')

  function buildQuery() {
    if (preset === 'custom') {
      const params = new URLSearchParams()
      if (customFrom) params.set('from', new Date(customFrom).toISOString())
      if (customTo)   params.set('to',   new Date(customTo + 'T23:59:59').toISOString())
      return params.toString()
    }
    const { from, to } = periodToDates(preset)
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to)   params.set('to',   to)
    return params.toString()
  }

  const loadStats = useCallback((qs) => {
    setStatsLoading(true)
    const url = '/admin/api/publisher-stats' + (qs ? '?' + qs : '')
    fetch(url, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setStats(d); setError(null) })
      .catch(e => setError(e.message))
      .finally(() => { setLoading(false); setStatsLoading(false) })
  }, [])

  // Initial load
  useEffect(() => { loadStats('') }, [loadStats])

  function applyFilter() { loadStats(buildQuery()) }

  function handlePreset(v) {
    setPreset(v)
    if (v !== 'custom') {
      const { from, to } = periodToDates(v)
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to)   params.set('to',   to)
      loadStats(params.toString())
    }
  }

  if (loading) return <div style={{ ...S.page, display: 'grid', placeItems: 'center' }}><div style={{ fontSize: '16px', color: C.grey }}>Chargement…</div></div>
  if (error) return <div style={S.page}><div style={{ background: '#ffebee', border: '1px solid #f44336', borderRadius: '10px', padding: '16px', color: '#c62828' }}>{error}</div></div>

  const maxCat = stats.trendingCategories[0]?.count || 1

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.title}>Tableau de bord — Éditeurs</h1>
        <p style={S.sub}>Vue d'ensemble du module éditeurs partenaires</p>
      </div>

      {/* Period filter bar */}
      <div style={{ ...S.card, marginBottom: '24px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: C.textSecondary, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Icon n="calendar" size={14} color={C.textSecondary} /> Période :
          </span>
          {PERIOD_PRESETS.map(p => (
            <button key={p.value} onClick={() => handlePreset(p.value)} style={{
              padding: '5px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '600',
              border: preset === p.value ? `2px solid ${C.terre}` : `2px solid ${C.lightGrey}`,
              background: preset === p.value ? C.terre : 'white',
              color: preset === p.value ? 'white' : C.textSecondary,
              cursor: 'pointer', transition: 'all 0.15s',
            }}>{p.label}</button>
          ))}
          {preset === 'custom' && (
            <>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                style={{ padding: '5px 10px', borderRadius: '8px', border: `1px solid ${C.lightGrey}`, fontSize: '13px' }} />
              <span style={{ fontSize: '13px', color: C.grey }}>→</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                style={{ padding: '5px 10px', borderRadius: '8px', border: `1px solid ${C.lightGrey}`, fontSize: '13px' }} />
              <button onClick={applyFilter} style={{
                padding: '5px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '600',
                border: 'none', background: C.indigo, color: 'white', cursor: 'pointer',
              }}>Appliquer</button>
            </>
          )}
          {statsLoading && (
            <span style={{ fontSize: '12px', color: C.grey, marginLeft: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Icon n="refresh-cw" size={13} color={C.grey} /> Actualisation…
            </span>
          )}
        </div>
        {preset !== 'all' && (
          <div style={{ marginTop: '10px', fontSize: '12px', color: C.grey }}>
            <Icon n="check-circle" size={12} color={C.green} style={{ marginRight: '4px' }} />
            Les KPIs <strong>Solde à verser</strong>, <strong>Top éditeurs</strong> et <strong>Top livres</strong> reflètent la période sélectionnée.
            Les compteurs <strong>Éditeurs actifs</strong>, <strong>Contenus à valider</strong> et <strong>Invitations</strong> sont toujours globaux.
          </div>
        )}
      </div>

      {/* KPIs */}
      <div style={S.grid4}>
        <KpiCard label="Éditeurs actifs" value={stats.publishers.active} sub={`${stats.publishers.total} total · ${stats.publishers.pending} en attente`} color={C.terre} icon="building" />
        <KpiCard label="Contenus à valider" value={stats.pendingContent} sub={stats.pendingContent > 0 ? 'En attente de validation' : 'File vide'} color={stats.pendingContent > 0 ? C.orange : C.green} icon="check-circle" />
        <KpiCard label="Solde à verser" value={`${stats.totalPendingPayout.toFixed(2)} CAD`} sub="Revenus non versés" color={C.blue} icon="dollar" />
        <KpiCard label="Invitations en attente" value={stats.publishers.pending} sub="Comptes non activés" color={C.purple} icon="mail" />
      </div>

      <div style={S.grid2}>
        {/* Top éditeurs */}
        <div style={S.card}>
          <div style={S.sectionTitle}>
            <Icon n="award" size={16} color={C.or} /> Top Éditeurs
          </div>
          {stats.topPublishers.length === 0
            ? <p style={{ color: C.grey, textAlign: 'center', padding: '24px 0' }}>Aucune vente enregistrée</p>
            : stats.topPublishers.map((pub, i) => (
              <div key={pub.id} style={i < stats.topPublishers.length - 1 ? S.row : S.rowLast}>
                <span style={S.rank}>#{i + 1}</span>
                <div style={S.avatar}>{pub.company_name?.charAt(0).toUpperCase()}</div>
                <span style={{ flex: 1, fontWeight: '600', fontSize: '14px' }}>{pub.company_name}</span>
                <span style={{ fontWeight: '800', color: C.terre, fontSize: '14px' }}>{pub.total_cad.toFixed(2)} CAD</span>
              </div>
            ))
          }
        </div>

        {/* Top livres */}
        <div style={S.card}>
          <div style={S.sectionTitle}>
            <Icon n="book-open" size={16} color={C.indigo} /> Livres les plus vendus
          </div>
          {stats.topBooks.length === 0
            ? <p style={{ color: C.grey, textAlign: 'center', padding: '24px 0' }}>Aucune vente enregistrée</p>
            : stats.topBooks.map((book, i) => (
              <div key={book.id} style={i < stats.topBooks.length - 1 ? S.row : S.rowLast}>
                <span style={S.rank}>#{i + 1}</span>
                {book.cover_url
                  ? <img src={book.cover_url} alt="" style={{ width: '32px', height: '44px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} />
                  : <div style={{ width: '32px', height: '44px', background: '#f0ede8', borderRadius: '4px', flexShrink: 0 }} />
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '600', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.title || '—'}</div>
                  <div style={{ fontSize: '12px', color: C.grey }}>{book.author}</div>
                </div>
                <span style={{ ...S.badge, background: '#e8f5e9', color: C.green }}>{book.count} vente{book.count > 1 ? 's' : ''}</span>
              </div>
            ))
          }
        </div>
      </div>

      <div style={S.grid12}>
        {/* Catégories tendance */}
        <div style={S.card}>
          <div style={S.sectionTitle}>
            <Icon n="bar-chart" size={16} color={C.blue} /> Catégories tendance
          </div>
          {stats.trendingCategories.length === 0
            ? <p style={{ color: C.grey, textAlign: 'center', padding: '24px 0' }}>Aucune donnée</p>
            : stats.trendingCategories.map(cat => (
              <div key={cat.name} style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600' }}>{cat.name}</span>
                  <span style={{ fontSize: '12px', color: C.grey }}>{cat.count} livres</span>
                </div>
                <div style={S.barWrap}>
                  <div style={{ height: '100%', background: C.terre, borderRadius: '4px', width: `${(cat.count / maxCat) * 100}%`, transition: 'width 0.5s' }} />
                </div>
              </div>
            ))
          }
        </div>

        {/* Contenus en attente */}
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={S.sectionTitle}>
              <Icon n="clock" size={16} color={C.orange} /> Contenus en attente de validation
            </div>
            {stats.pendingContent > 5 && (
              <span style={{ ...S.badge, background: '#fff3e0', color: C.orange }}>+{stats.pendingContent - 5} autres</span>
            )}
          </div>
          {stats.pendingItems.length === 0
            ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: C.green, fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Icon n="check-circle" size={18} color={C.green} /> File vide
              </div>
            )
            : (
              <>
                <div style={{ ...S.tableHead, gridTemplateColumns: '2fr 1.5fr 1fr' }}>
                  <span>Titre</span><span>Éditeur</span><span>Soumis le</span>
                </div>
                {stats.pendingItems.map(item => (
                  <div key={item.id} style={{ ...S.tableRow, gridTemplateColumns: '2fr 1.5fr 1fr' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {item.contents?.cover_url
                        ? <img src={item.contents.cover_url} alt="" style={{ width: '24px', height: '34px', objectFit: 'cover', borderRadius: '3px' }} />
                        : <div style={{ width: '24px', height: '34px', background: '#f0ede8', borderRadius: '3px' }} />
                      }
                      <span style={{ fontSize: '13px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.contents?.title || '—'}
                      </span>
                    </div>
                    <span style={{ fontSize: '13px', color: C.textSecondary }}>{item.publishers?.company_name || '—'}</span>
                    <span style={{ fontSize: '12px', color: C.grey }}>{new Date(item.submitted_at).toLocaleDateString('fr-FR')}</span>
                  </div>
                ))}
              </>
            )
          }
        </div>
      </div>
    </div>
  )
}
