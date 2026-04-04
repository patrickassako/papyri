import React, { useState, useEffect } from 'react'
import { Box, Text } from '@adminjs/design-system'

// ─── Icônes SVG inline (style Lucide, strokeWidth=1.8) ───────────────────────
const Icon = ({ d, size = 22, color = 'currentColor', fill = 'none' }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24"
    fill={fill} stroke={color} strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round"
  >
    {(Array.isArray(d) ? d : [d]).map((path, i) =>
      typeof path === 'string'
        ? <path key={i} d={path} />
        : <React.Fragment key={i}>{path}</React.Fragment>
    )}
  </svg>
)

const Icons = {
  // Revenu total
  DollarSign: (p) => <Icon size={p.size} color={p.color} d={[
    'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  ]} />,
  // Abonnés actifs
  Users: (p) => <Icon size={p.size} color={p.color} d={[
    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
    <circle key="c1" cx="9" cy="7" r="4" fill="none" stroke={p.color} strokeWidth="1.8" />,
    'M23 21v-2a4 4 0 0 0-3-3.87',
    'M16 3.13a4 4 0 0 1 0 7.75',
  ]} />,
  // Nouvelles inscriptions
  UserPlus: (p) => <Icon size={p.size} color={p.color} d={[
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    <circle key="c1" cx="9" cy="7" r="4" fill="none" stroke={p.color} strokeWidth="1.8" />,
    'M19 8v6M22 11h-6',
  ]} />,
  // Bibliothèque
  BookOpen: (p) => <Icon size={p.size} color={p.color} d={[
    'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z',
    'M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z',
  ]} />,
  // Sessions de lecture
  BookMarked: (p) => <Icon size={p.size} color={p.color} d={[
    'M4 19.5A2.5 2.5 0 0 1 6.5 17H20',
    'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
    'M9 7l2 2 4-4',
  ]} />,
  // Lectures terminées
  CheckCircle: (p) => <Icon size={p.size} color={p.color} d={[
    <circle key="c" cx="12" cy="12" r="10" fill="none" stroke={p.color} strokeWidth="1.8" />,
    'M9 12l2 2 4-4',
  ]} />,
  // Temps de lecture
  Clock: (p) => <Icon size={p.size} color={p.color} d={[
    <circle key="c" cx="12" cy="12" r="10" fill="none" stroke={p.color} strokeWidth="1.8" />,
    'M12 6v6l4 2',
  ]} />,
  // Total utilisateurs
  User: (p) => <Icon size={p.size} color={p.color} d={[
    <circle key="c" cx="12" cy="8" r="4" fill="none" stroke={p.color} strokeWidth="1.8" />,
    'M4 20c0-4 3.6-7 8-7s8 3 8 7',
  ]} />,
}

// ─── Couleurs Papyri ───
const C = {
  terre: '#B5651D',
  or: '#D4A017',
  indigo: '#2E4057',
  bg: '#f4f1ec',
  card: '#ffffff',
  green: '#27ae60',
  red: '#e74c3c',
  grey: '#8c8c8c',
  lightGrey: '#f0f0f0',
  textPrimary: '#1a1a2e',
  textSecondary: '#6b7280',
}

// ─── Styles ───
const S = {
  page: {
    width: '100%',
    minWidth: 0,
    padding: '28px 32px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    boxSizing: 'border-box',
    flex: 1,
  },
  header: {
    marginBottom: '32px',
  },
  headerTitle: {
    fontSize: '28px',
    fontWeight: '700',
    color: C.indigo,
    margin: '0 0 4px',
  },
  headerSub: {
    fontSize: '14px',
    color: C.textSecondary,
    margin: 0,
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '20px',
    marginBottom: '28px',
  },
  kpiCard: {
    background: C.card,
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    position: 'relative',
    overflow: 'hidden',
  },
  kpiIconWrap: {
    width: '44px',
    height: '44px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
    fontSize: '20px',
  },
  kpiLabel: {
    fontSize: '13px',
    fontWeight: '500',
    color: C.textSecondary,
    marginBottom: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  kpiValue: {
    fontSize: '32px',
    fontWeight: '700',
    color: C.textPrimary,
    lineHeight: '1.1',
    marginBottom: '8px',
  },
  badge: (positive) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    padding: '3px 10px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '600',
    background: positive ? '#ecfdf5' : '#fef2f2',
    color: positive ? '#059669' : '#dc2626',
  }),
  chartsRow: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: '20px',
    marginBottom: '28px',
  },
  chartCard: {
    background: C.card,
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
  },
  chartTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: C.textPrimary,
    marginBottom: '20px',
  },
  tableCard: {
    background: C.card,
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    overflow: 'hidden',
  },
  tableHeader: {
    padding: '20px 24px 12px',
    borderBottom: `1px solid ${C.lightGrey}`,
  },
  tableTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: C.textPrimary,
    margin: 0,
  },
  th: {
    padding: '12px 16px',
    textAlign: 'left',
    fontSize: '12px',
    fontWeight: '600',
    color: C.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    borderBottom: `2px solid ${C.lightGrey}`,
  },
  td: {
    padding: '12px 16px',
    fontSize: '13px',
    color: C.textPrimary,
    borderBottom: `1px solid ${C.lightGrey}`,
  },
  statusBadge: (status) => {
    const colors = {
      ACTIVE: { bg: '#ecfdf5', color: '#059669' },
      EXPIRED: { bg: '#fef2f2', color: '#dc2626' },
      CANCELLED: { bg: '#f3f4f6', color: '#6b7280' },
    }
    const c = colors[status] || colors.CANCELLED
    return {
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: '12px',
      fontSize: '11px',
      fontWeight: '600',
      background: c.bg,
      color: c.color,
    }
  },
}

// ─── KPI Card Component ───
const KPICard = ({ icon: IconComp, iconBg, iconColor, label, value, trend, trendPositive, subtitle }) => (
  <div style={S.kpiCard}>
    <div style={{ ...S.kpiIconWrap, background: iconBg || `${C.terre}15` }}>
      {IconComp && <IconComp size={22} color={iconColor || C.terre} />}
    </div>
    <div style={S.kpiLabel}>{label}</div>
    <div style={S.kpiValue}>{value}</div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {trend !== undefined && (
        <span style={S.badge(trendPositive !== false)}>
          {trendPositive !== false ? '↑' : '↓'} {trend}
        </span>
      )}
      {subtitle && <span style={{ fontSize: '12px', color: C.textSecondary }}>{subtitle}</span>}
    </div>
  </div>
)

// ─── SVG Area Chart Component ───
const AreaChart = ({ data, color = C.terre }) => {
  if (!data || data.length === 0) return <div style={{ color: C.grey, textAlign: 'center', padding: '40px 0' }}>Aucune donnée</div>

  const width = 500
  const height = 200
  const padX = 40
  const padY = 30
  const padBottom = 40
  const chartW = width - padX * 2
  const chartH = height - padY - padBottom

  const maxVal = Math.max(...data.map(d => d.count), 1)
  const step = chartW / Math.max(data.length - 1, 1)

  const points = data.map((d, i) => ({
    x: padX + i * step,
    y: padY + chartH - (d.count / maxVal) * chartH,
  }))

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const areaPath = `${linePath} L${points[points.length - 1].x},${padY + chartH} L${points[0].x},${padY + chartH} Z`

  // Y-axis grid lines
  const gridLines = 4
  const yLabels = []
  for (let i = 0; i <= gridLines; i++) {
    const val = Math.round((maxVal / gridLines) * i)
    const y = padY + chartH - (i / gridLines) * chartH
    yLabels.push({ val, y })
  }

  return (
    <svg viewBox={`0 0 ${width} ${height + 10}`} style={{ width: '100%', height: 'auto' }}>
      {/* Grid lines */}
      {yLabels.map((l, i) => (
        <g key={i}>
          <line x1={padX} y1={l.y} x2={width - padX} y2={l.y} stroke="#e5e7eb" strokeWidth="1" />
          <text x={padX - 8} y={l.y + 4} textAnchor="end" fontSize="11" fill={C.textSecondary}>{l.val}</text>
        </g>
      ))}

      {/* Area fill */}
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#areaGrad)" />

      {/* Line */}
      <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* Dots */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill={C.card} stroke={color} strokeWidth="2" />
          {/* Value label above dot */}
          <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize="11" fontWeight="600" fill={C.textPrimary}>
            {data[i].count}
          </text>
        </g>
      ))}

      {/* X-axis labels */}
      {data.map((d, i) => (
        <text key={i} x={padX + i * step} y={height} textAnchor="middle" fontSize="12" fill={C.textSecondary}>
          {d.month}
        </text>
      ))}
    </svg>
  )
}

// ─── Donut Chart Component (CSS conic-gradient) ───
const DonutChart = ({ segments }) => {
  if (!segments || segments.length === 0) return null
  const total = segments.reduce((s, d) => s + d.value, 0)
  if (total === 0) return <div style={{ color: C.grey, textAlign: 'center', padding: '40px 0' }}>Aucun contenu</div>

  // Build conic-gradient
  let cumDeg = 0
  const stops = []
  segments.forEach((seg) => {
    const deg = (seg.value / total) * 360
    stops.push(`${seg.color} ${cumDeg}deg ${cumDeg + deg}deg`)
    cumDeg += deg
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
      <div style={{ position: 'relative', width: '160px', height: '160px' }}>
        <div style={{
          width: '160px',
          height: '160px',
          borderRadius: '50%',
          background: `conic-gradient(${stops.join(', ')})`,
        }} />
        <div style={{
          position: 'absolute',
          top: '30px', left: '30px',
          width: '100px', height: '100px',
          borderRadius: '50%',
          background: C.card,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ fontSize: '22px', fontWeight: '700', color: C.textPrimary }}>{total}</div>
          <div style={{ fontSize: '11px', color: C.textSecondary }}>Total</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
        {segments.map((seg, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: seg.color }} />
              <span style={{ fontSize: '13px', color: C.textPrimary }}>{seg.label}</span>
            </div>
            <span style={{ fontSize: '13px', fontWeight: '600', color: C.textPrimary }}>
              {seg.value} ({total > 0 ? Math.round((seg.value / total) * 100) : 0}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Dashboard ───
const Dashboard = () => {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/admin/api/dashboard-stats', { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(data => { setStats(data); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <Box style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px', height: '40px', border: `3px solid ${C.lightGrey}`, borderTopColor: C.terre,
            borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <Text style={{ color: C.textSecondary }}>Chargement du tableau de bord...</Text>
        </div>
      </Box>
    )
  }

  if (error) {
    return (
      <Box style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px',
          padding: '24px', maxWidth: '500px', margin: '0 auto',
        }}>
          <div style={{ fontSize: '16px', fontWeight: '600', color: '#dc2626', marginBottom: '8px' }}>Erreur de chargement</div>
          <div style={{ fontSize: '14px', color: '#7f1d1d' }}>{error}</div>
        </div>
      </Box>
    )
  }

  if (!stats) return null

  const totalRevenue = stats.subscriptions?.totalRevenue || 0
  const currency = stats.subscriptions?.currency || 'XAF'
  const activeSubscribers = stats.subscriptions?.active || 0
  const newUsersMonth = stats.newUsersThisMonth || 0
  const totalContents = stats.contents?.total || 0

  // Trend data — compare to previous period (simplified: we show the raw value as trend)
  const monthlyData = stats.monthlySignups || []
  const currentMonthSignups = monthlyData.length > 0 ? monthlyData[monthlyData.length - 1].count : 0
  const prevMonthSignups = monthlyData.length > 1 ? monthlyData[monthlyData.length - 2].count : 0

  const formatCurrency = (val) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`
    if (val >= 1000) return `${(val / 1000).toFixed(0)}K`
    return val.toLocaleString('fr-FR')
  }

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <h1 style={S.headerTitle}>Apercu de la croissance</h1>
        <p style={S.headerSub}>
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* KPI Cards */}
      <div style={S.kpiGrid}>
        <KPICard
          icon={Icons.DollarSign}
          iconBg={`${C.or}20`}
          iconColor={C.or}
          label="Revenu Total"
          value={`${formatCurrency(totalRevenue)} ${currency}`}
          trend={activeSubscribers > 0 ? `${activeSubscribers} actifs` : undefined}
          trendPositive={true}
          subtitle="abonnements"
        />
        <KPICard
          icon={Icons.Users}
          iconBg={`${C.terre}15`}
          iconColor={C.terre}
          label="Abonnés Actifs"
          value={activeSubscribers}
          trend={stats.subscriptions?.expired > 0 ? `${stats.subscriptions.expired} expirés` : undefined}
          trendPositive={stats.subscriptions?.expired === 0}
        />
        <KPICard
          icon={Icons.UserPlus}
          iconBg={`${C.green}15`}
          iconColor={C.green}
          label="Nouvelles Inscriptions"
          value={newUsersMonth}
          trend={prevMonthSignups > 0
            ? `${currentMonthSignups >= prevMonthSignups ? '+' : ''}${currentMonthSignups - prevMonthSignups} vs mois dernier`
            : `ce mois`}
          trendPositive={currentMonthSignups >= prevMonthSignups}
          subtitle="ce mois-ci"
        />
        <KPICard
          icon={Icons.BookOpen}
          iconBg={`${C.indigo}15`}
          iconColor={C.indigo}
          label="Taille Bibliothèque"
          value={totalContents}
          trend={`${stats.contents?.ebooks || 0} ebooks, ${stats.contents?.audiobooks || 0} audio`}
          trendPositive={true}
        />
      </div>

      {/* Charts Row */}
      <div style={S.chartsRow}>
        {/* Area Chart — Croissance Utilisateurs */}
        <div style={S.chartCard}>
          <div style={S.chartTitle}>Croissance Utilisateurs (6 mois)</div>
          <AreaChart data={monthlyData} color={C.terre} />
        </div>

        {/* Donut Chart — Répartition par type */}
        <div style={S.chartCard}>
          <div style={S.chartTitle}>Répartition du catalogue</div>
          <DonutChart segments={[
            { label: 'Ebooks', value: stats.contents?.ebooks || 0, color: C.terre },
            { label: 'Audiobooks', value: stats.contents?.audiobooks || 0, color: C.or },
            { label: 'Catégories', value: stats.contents?.categories || 0, color: C.indigo },
          ]} />
        </div>
      </div>

      {/* Recent Subscriptions Table */}
      <div style={S.tableCard}>
        <div style={S.tableHeader}>
          <h3 style={S.tableTitle}>Abonnements Récents</h3>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={S.th}>Utilisateur</th>
              <th style={S.th}>Plan</th>
              <th style={S.th}>Montant</th>
              <th style={S.th}>Date</th>
              <th style={S.th}>Statut</th>
            </tr>
          </thead>
          <tbody>
            {(stats.recentSubscriptions || []).map((sub, i) => (
              <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#fafafa' : C.card }}>
                <td style={S.td}>
                  <div style={{ fontWeight: '500' }}>{sub.user_name}</div>
                  <div style={{ fontSize: '11px', color: C.textSecondary }}>{sub.user_email}</div>
                </td>
                <td style={S.td}>
                  <span style={{
                    padding: '2px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '500',
                    background: sub.plan_type === 'annual' ? `${C.or}20` : `${C.terre}15`,
                    color: sub.plan_type === 'annual' ? C.or : C.terre,
                  }}>
                    {sub.plan_type === 'annual' ? 'Annuel' : sub.plan_type === 'monthly' ? 'Mensuel' : sub.plan_type}
                  </span>
                </td>
                <td style={{ ...S.td, fontWeight: '600' }}>{sub.amount} {sub.currency}</td>
                <td style={{ ...S.td, color: C.textSecondary }}>
                  {new Date(sub.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td style={S.td}>
                  <span style={S.statusBadge(sub.status)}>
                    {sub.status === 'ACTIVE' ? 'Actif' : sub.status === 'EXPIRED' ? 'Expiré' : sub.status === 'CANCELLED' ? 'Annulé' : sub.status}
                  </span>
                </td>
              </tr>
            ))}
            {(!stats.recentSubscriptions || stats.recentSubscriptions.length === 0) && (
              <tr>
                <td colSpan="5" style={{ ...S.td, textAlign: 'center', color: C.textSecondary, padding: '32px 16px' }}>
                  Aucun abonnement récent
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Quick Stats Footer */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginTop: '28px' }}>
        {[
          { IconComp: Icons.BookMarked, color: C.terre,  bg: `${C.terre}12`,  label: 'Sessions de lecture',  value: stats.reading?.total || 0 },
          { IconComp: Icons.CheckCircle, color: C.green,  bg: `${C.green}12`,  label: 'Lectures terminées',   value: stats.reading?.completed || 0 },
          { IconComp: Icons.Clock,       color: C.indigo, bg: `${C.indigo}12`, label: 'Temps de lecture',     value: `${stats.reading?.totalTimeHours || 0}h` },
          { IconComp: Icons.User,        color: C.or,     bg: `${C.or}15`,     label: 'Total utilisateurs',   value: stats.users?.total || 0 },
        ].map(({ IconComp, color, bg, label, value }, i) => (
          <div key={i} style={{ ...S.chartCard, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '42px', height: '42px', borderRadius: '10px',
              background: bg, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <IconComp size={20} color={color} />
            </div>
            <div>
              <div style={{ fontSize: '12px', color: C.textSecondary, marginBottom: '2px' }}>{label}</div>
              <div style={{ fontSize: '22px', fontWeight: '700', color: C.textPrimary, lineHeight: 1 }}>{value}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Dashboard
