/**
 * AdminRevenueAnalyticsPage — /admin/analytics/revenue
 * MRR, ARR, churn, revenu mensuel, par plan, par provider
 * Filtres période + export CSV
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Card, Typography, CircularProgress, Chip, Skeleton,
  Button, TextField, Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import TrendingUpIcon             from '@mui/icons-material/TrendingUp';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import PeopleOutlinedIcon         from '@mui/icons-material/PeopleOutlined';
import TrendingDownOutlinedIcon   from '@mui/icons-material/TrendingDownOutlined';
import DownloadIcon               from '@mui/icons-material/Download';
import PictureAsPdfOutlinedIcon  from '@mui/icons-material/PictureAsPdfOutlined';
import DateRangeOutlinedIcon      from '@mui/icons-material/DateRangeOutlined';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, Legend,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { authFetch } from '../../services/auth.service';
import tokens from '../../config/tokens';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const C = {
  indigo: tokens.colors.accent, primary: tokens.colors.primary, green: '#27ae60',
  red: '#e74c3c', orange: '#FF9800', purple: '#7B5EA7',
  grey: '#8c8c8c', bg: '#F7F6F3', textPrimary: '#1a1a2e', textSecondary: '#6b7280',
};

const PROVIDER_COLORS = { stripe: '#635BFF', flutterwave: '#F5A623', unknown: C.grey };
const PIE_COLORS = [C.indigo, C.primary, C.green, C.purple, C.orange];

const PRESETS = [
  { label: 'Ce mois',    days: 30  },
  { label: '3 mois',     days: 90  },
  { label: '6 mois',     days: 180 },
  { label: 'Cette année',days: 365 },
  { label: 'Tout',       days: 0   },
];

function toISO(d) { return d.toISOString().split('T')[0]; }

function resolvePreset(days) {
  const to   = new Date();
  const from = days === 0 ? new Date('2020-01-01') : new Date(Date.now() - days * 86400000);
  return { from: toISO(from), to: toISO(to) };
}

function fmt(n, d = 2) {
  if (n == null) return '—';
  return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function downloadCSV(filename, rows) {
  const bom = '\uFEFF';
  const csv = bom + rows.map(r => r.join(';')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click(); URL.revokeObjectURL(url);
}

function KpiCard({ label, value, sub, icon: Icon, color, loading }) {
  return (
    <Card sx={{ borderRadius: '14px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', p: 2.5, flex: 1, minWidth: 150 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
        <Box sx={{ width: 36, height: 36, borderRadius: '10px', bgcolor: `${color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon sx={{ color, fontSize: 18 }} />
        </Box>
        <Typography variant="caption" fontWeight={600} color={C.textSecondary}>{label}</Typography>
      </Box>
      {loading ? <Skeleton width={80} height={32} /> : (
        <Typography variant="h5" fontWeight={900} color={color}>{value}</Typography>
      )}
      {sub && !loading && <Typography variant="caption" color={C.textSecondary}>{sub}</Typography>}
    </Card>
  );
}

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <Box sx={{ bgcolor: '#fff', border: '1px solid #e5e0d8', borderRadius: '10px', p: 1.5, boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
      <Typography variant="caption" fontWeight={700} color={C.textPrimary} sx={{ display: 'block', mb: 0.5 }}>{label}</Typography>
      {payload.map(p => (
        <Typography key={p.name} variant="caption" sx={{ display: 'block', color: p.color }}>
          {p.name}: {fmt(p.value)} €
        </Typography>
      ))}
    </Box>
  );
};

export default function AdminRevenueAnalyticsPage() {
  const [data, setData]               = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [plans, setPlans]             = useState([]);
  const [pdfLoading, setPdfLoading]   = useState(false);
  const [acctLoading, setAcctLoading] = useState(false);

  // Filters
  const [activePreset, setActivePreset] = useState(3); // "Cette année"
  const [from, setFrom] = useState(() => resolvePreset(365).from);
  const [to,   setTo]   = useState(() => resolvePreset(365).to);
  const [provider, setProvider] = useState('all');
  const [planId,   setPlanId]   = useState('all');

  const load = useCallback(() => {
    setLoading(true); setError(null);
    const params = new URLSearchParams({ from, to });
    if (provider !== 'all') params.set('provider', provider);
    if (planId   !== 'all') params.set('plan', planId);

    authFetch(`${API}/api/admin/analytics/revenue?${params}`)
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setData(d); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [from, to, provider, planId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    authFetch(`${API}/api/admin/subscriptions-module/plans`)
      .then(r => r.json()).then(d => setPlans(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  function applyPreset(idx) {
    setActivePreset(idx);
    const { from: f, to: t } = resolvePreset(PRESETS[idx].days);
    setFrom(f); setTo(t);
  }

  async function handleExportAccounting() {
    setAcctLoading(true);
    try {
      const params = new URLSearchParams({ from, to });
      const r    = await authFetch(`${API}/api/admin/analytics/accounting-export?${params}`);
      const blob = await r.blob();
      const url  = URL.createObjectURL(blob);
      const a    = Object.assign(document.createElement('a'), { href: url, download: `comptabilite_${from}_${to}.csv` });
      a.click(); URL.revokeObjectURL(url);
    } catch (e) { console.error(e); }
    finally { setAcctLoading(false); }
  }

  async function handleExportPDF() {
    setPdfLoading(true);
    try {
      const params = new URLSearchParams({ from, to });
      if (provider !== 'all') params.set('provider', provider);
      if (planId   !== 'all') params.set('plan', planId);
      const r    = await authFetch(`${API}/api/admin/analytics/revenue/export?${params}`);
      const blob = await r.blob();
      const url  = URL.createObjectURL(blob);
      const a    = Object.assign(document.createElement('a'), { href: url, download: `revenus_${from}_${to}.pdf` });
      a.click(); URL.revokeObjectURL(url);
    } catch (e) { console.error(e); }
    finally { setPdfLoading(false); }
  }

  function handleExportCSV() {
    if (!data) return;
    const s = data.summary;
    const rows = [
      ['=== RÉSUMÉ ==='],
      ['Période', `${data.range?.from} → ${data.range?.to}`],
      ['Revenu total (€)', s.totalRevenue],
      ['MRR (€)', s.mrr],
      ['ARR projeté (€)', s.arr],
      ['Abonnés actifs', s.activeSubscribers],
      ['Churn (%)', s.churnRate],
      ['Résiliations période', s.churned],
      [],
      ['=== REVENU MENSUEL ==='],
      ['Mois', 'Revenu (€)'],
      ...(data.monthlySeries || []).map(m => [m.month, m.revenue]),
      [],
      ['=== PAR PROVIDER ==='],
      ['Provider', 'Montant (€)'],
      ...(data.byProvider || []).map(p => [p.provider, p.amount]),
      [],
      ['=== PAR PLAN ==='],
      ['Plan', 'Période', 'Abonnés actifs', 'MRR (€)'],
      ...(data.byPlan || []).map(p => [p.name, p.period, p.activeCount, fmt(p.mrr)]),
    ];
    downloadCSV(`revenus_${from}_${to}.csv`, rows);
  }

  const s = data?.summary || {};

  return (
    <Box sx={{ bgcolor: C.bg, minHeight: '100vh' }}>

      {/* Header */}
      <Box sx={{ bgcolor: '#fff', height: 60, display: 'flex', alignItems: 'center', px: 3, borderBottom: '1px solid #e5e0d8', position: 'sticky', top: 0, zIndex: 10, gap: 1 }}>
        <TrendingUpIcon sx={{ color: C.indigo, mr: 1 }} />
        <Typography variant="h6" fontWeight={700} color={C.textPrimary} sx={{ flex: 1 }}>Analytiques revenus</Typography>
        <Button size="small" startIcon={acctLoading ? <CircularProgress size={14} /> : <DownloadIcon />}
          onClick={handleExportAccounting} disabled={!data || loading || acctLoading}
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '8px', color: C.purple, border: `1px solid ${C.purple}40`, '&:hover': { bgcolor: `${C.purple}10` } }}>
          Export comptable
        </Button>
        <Button size="small" startIcon={<DownloadIcon />} onClick={handleExportCSV} disabled={!data || loading}
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '8px', color: C.green, border: `1px solid ${C.green}40`, '&:hover': { bgcolor: `${C.green}10` } }}>
          CSV
        </Button>
        <Button size="small" startIcon={pdfLoading ? <CircularProgress size={14} /> : <PictureAsPdfOutlinedIcon />}
          onClick={handleExportPDF} disabled={!data || loading || pdfLoading}
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '8px', color: C.primary, border: `1px solid ${C.primary}40`, '&:hover': { bgcolor: `${C.primary}10` } }}>
          PDF
        </Button>
      </Box>

      <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1100, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>

        {/* ── Barre de filtres ── */}
        <Card sx={{ borderRadius: '14px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', px: 2.5, py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <DateRangeOutlinedIcon sx={{ color: C.textSecondary, fontSize: 18 }} />
            <Typography variant="caption" fontWeight={600} color={C.textSecondary}>Période :</Typography>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
              {PRESETS.map((p, i) => (
                <Chip key={i} label={p.label} size="small" onClick={() => applyPreset(i)}
                  sx={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem',
                    bgcolor: activePreset === i ? C.primary : '#f0ede8',
                    color:   activePreset === i ? '#fff' : C.textSecondary }} />
              ))}
            </Box>
            <TextField type="date" size="small" value={from} onChange={e => { setFrom(e.target.value); setActivePreset(null); }}
              InputLabelProps={{ shrink: true }} sx={{ width: 150, '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: '0.8rem' } }} />
            <Typography variant="caption" color={C.grey}>→</Typography>
            <TextField type="date" size="small" value={to} onChange={e => { setTo(e.target.value); setActivePreset(null); }}
              InputLabelProps={{ shrink: true }} sx={{ width: 150, '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: '0.8rem' } }} />
            <Box sx={{ flex: 1 }} />
            <FormControl size="small" sx={{ minWidth: 130, '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}>
              <InputLabel>Provider</InputLabel>
              <Select value={provider} label="Provider" onChange={e => setProvider(e.target.value)}>
                <MenuItem value="all">Tous</MenuItem>
                <MenuItem value="stripe">Stripe</MenuItem>
                <MenuItem value="flutterwave">Flutterwave</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 150, '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}>
              <InputLabel>Plan</InputLabel>
              <Select value={planId} label="Plan" onChange={e => setPlanId(e.target.value)}>
                <MenuItem value="all">Tous les plans</MenuItem>
                {plans.map(p => <MenuItem key={p.id} value={p.id}>{p.display_name}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
        </Card>

        {error && <Box sx={{ p: 2, bgcolor: `${C.red}10`, borderRadius: '12px', color: C.red, fontSize: '0.85rem' }}>{error}</Box>}

        {/* ── KPIs ── */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <KpiCard label="Revenu total" value={`${fmt(s.totalRevenue)} €`} icon={AccountBalanceOutlinedIcon} color={C.indigo} loading={loading} />
          <KpiCard label="MRR (mois en cours)" value={`${fmt(s.mrr)} €`} sub="Revenu mensuel récurrent" icon={TrendingUpIcon} color={C.green} loading={loading} />
          <KpiCard label="ARR projeté" value={`${fmt(s.arr)} €`} sub="MRR × 12" icon={TrendingUpIcon} color={C.primary} loading={loading} />
          <KpiCard label="Abonnés actifs" value={s.activeSubscribers ?? '—'} icon={PeopleOutlinedIcon} color={C.purple} loading={loading} />
          <KpiCard label="Churn (période)" value={`${s.churnRate ?? '—'} %`} sub={`${s.churned ?? 0} résiliation(s)`}
            icon={TrendingDownOutlinedIcon} color={s.churnRate > 5 ? C.red : C.orange} loading={loading} />
        </Box>

        {/* ── Revenu mensuel ── */}
        <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', p: 3 }}>
          <Typography variant="subtitle1" fontWeight={700} color={C.textPrimary} sx={{ mb: 2 }}>
            Évolution des revenus
          </Typography>
          {loading ? <Skeleton variant="rectangular" height={240} sx={{ borderRadius: '10px' }} /> : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={data?.monthlySeries || []} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.indigo} stopOpacity={0.18} />
                    <stop offset="95%" stopColor={C.indigo} stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.textSecondary }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: C.textSecondary }} axisLine={false} tickLine={false} tickFormatter={v => `${v} €`} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="revenue" name="Revenu" stroke={C.indigo} strokeWidth={2.5}
                  fill="url(#revGrad)" dot={{ fill: C.indigo, r: 3 }} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* ── Évolution abonnés ── */}
        <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', p: 3 }}>
          <Typography variant="subtitle1" fontWeight={700} color={C.textPrimary} sx={{ mb: 2 }}>
            Évolution des abonnés
          </Typography>
          {loading ? <Skeleton variant="rectangular" height={240} sx={{ borderRadius: '10px' }} /> : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data?.subscriberSeries || []} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.textSecondary }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: C.textSecondary }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: '1px solid #e5e0d8', fontSize: 12 }}
                  formatter={(v, n) => [v, n === 'active' ? 'Abonnés actifs' : n === 'newSubs' ? 'Nouveaux' : 'Résiliations']}
                  labelStyle={{ fontWeight: 700 }}
                />
                <Legend formatter={v => v === 'active' ? 'Abonnés actifs' : v === 'newSubs' ? 'Nouveaux' : 'Résiliations'} wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="active"  stroke={C.indigo}  strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} name="active" />
                <Line type="monotone" dataKey="newSubs" stroke={C.green}   strokeWidth={1.5} dot={{ r: 2 }} strokeDasharray="4 2" name="newSubs" />
                <Line type="monotone" dataKey="churned" stroke={C.red}     strokeWidth={1.5} dot={{ r: 2 }} strokeDasharray="4 2" name="churned" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Box sx={{ display: 'flex', gap: 3, flexWrap: { xs: 'wrap', md: 'nowrap' } }}>

          {/* Par provider */}
          <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', p: 3, flex: 1, minWidth: 240 }}>
            <Typography variant="subtitle1" fontWeight={700} color={C.textPrimary} sx={{ mb: 2 }}>Par provider</Typography>
            {loading ? <Skeleton variant="rectangular" height={180} sx={{ borderRadius: '10px' }} /> : (
              <>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={data?.byProvider || []} dataKey="amount" nameKey="provider" cx="50%" cy="50%" outerRadius={60} paddingAngle={3}>
                      {(data?.byProvider || []).map((e, i) => (
                        <Cell key={i} fill={PROVIDER_COLORS[e.provider] || PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, n) => [`${fmt(v)} €`, n]} />
                  </PieChart>
                </ResponsiveContainer>
                {(data?.byProvider || []).map((p, i) => (
                  <Box key={p.provider} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.75 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: PROVIDER_COLORS[p.provider] || PIE_COLORS[i % PIE_COLORS.length] }} />
                      <Typography variant="body2" color={C.textSecondary} sx={{ textTransform: 'capitalize' }}>{p.provider}</Typography>
                    </Box>
                    <Typography variant="body2" fontWeight={700} color={C.textPrimary}>{fmt(p.amount)} €</Typography>
                  </Box>
                ))}
              </>
            )}
          </Card>

          {/* Par plan */}
          <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', p: 3, flex: 2, minWidth: 300 }}>
            <Typography variant="subtitle1" fontWeight={700} color={C.textPrimary} sx={{ mb: 2 }}>Abonnés & MRR par plan</Typography>
            {loading ? <Skeleton variant="rectangular" height={200} sx={{ borderRadius: '10px' }} /> : (
              <>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={data?.byPlan || []} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: C.textSecondary }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: C.textSecondary }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v, n) => [n === 'MRR' ? `${fmt(v)} €` : v, n]} />
                    <Bar dataKey="activeCount" name="Abonnés" fill={`${C.indigo}60`} radius={[4,4,0,0]} />
                    <Bar dataKey="mrr" name="MRR" fill={C.primary} radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
                {(data?.byPlan || []).map(p => (
                  <Box key={p.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.75, borderBottom: '1px solid #f0ede8' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" fontWeight={600} color={C.textPrimary}>{p.name}</Typography>
                      <Chip label={p.period} size="small" sx={{ height: 18, fontSize: '0.62rem', bgcolor: '#f0ede8', color: C.grey }} />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2.5 }}>
                      <Typography variant="body2" color={C.textSecondary}>{p.activeCount} abonnés</Typography>
                      <Typography variant="body2" fontWeight={700} color={C.green}>{fmt(p.mrr)} €/mois</Typography>
                    </Box>
                  </Box>
                ))}
              </>
            )}
          </Card>
        </Box>
      </Box>
    </Box>
  );
}
