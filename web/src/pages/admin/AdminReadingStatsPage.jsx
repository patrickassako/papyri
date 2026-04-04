/**
 * AdminReadingStatsPage — /admin/analytics/reading
 * Statistiques de lecture avec filtres période + type + export CSV
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Card, Typography, Skeleton, LinearProgress, Chip, Avatar,
  Button, TextField, Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import AutoStoriesOutlinedIcon  from '@mui/icons-material/AutoStoriesOutlined';
import CheckCircleOutlineIcon   from '@mui/icons-material/CheckCircleOutline';
import TimerOutlinedIcon        from '@mui/icons-material/TimerOutlined';
import MenuBookOutlinedIcon     from '@mui/icons-material/MenuBookOutlined';
import HeadphonesOutlinedIcon   from '@mui/icons-material/HeadphonesOutlined';
import DownloadIcon             from '@mui/icons-material/Download';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import CircularProgress         from '@mui/material/CircularProgress';
import DateRangeOutlinedIcon    from '@mui/icons-material/DateRangeOutlined';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { authFetch } from '../../services/auth.service';
import tokens from '../../config/tokens';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const C = {
  indigo: tokens.colors.accent, primary: tokens.colors.primary, green: '#27ae60',
  orange: '#FF9800', purple: '#7B5EA7',
  grey: '#8c8c8c', bg: '#F7F6F3', textPrimary: '#1a1a2e', textSecondary: '#6b7280',
};

const TYPE_COLORS = { ebook: C.indigo, audiobook: C.primary, unknown: C.grey };
const TYPE_ICONS  = { ebook: MenuBookOutlinedIcon, audiobook: HeadphonesOutlinedIcon };

const PRESETS = [
  { label: '7 jours',    days: 7   },
  { label: '30 jours',   days: 30  },
  { label: '3 mois',     days: 90  },
  { label: '6 mois',     days: 180 },
  { label: 'Cette année',days: 365 },
];

function toISO(d) { return d.toISOString().split('T')[0]; }

function resolvePreset(days) {
  const to   = new Date();
  const from = new Date(Date.now() - days * 86400000);
  return { from: toISO(from), to: toISO(to) };
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
        <Typography key={p.name} variant="caption" sx={{ display: 'block', color: p.color }}>{p.name}: {p.value}</Typography>
      ))}
    </Box>
  );
};

export default function AdminReadingStatsPage() {
  const [data, setData]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Filters
  const [activePreset, setActivePreset] = useState(1); // 30 jours
  const [from, setFrom] = useState(() => resolvePreset(30).from);
  const [to,   setTo]   = useState(() => resolvePreset(30).to);
  const [typeFilter, setTypeFilter] = useState('all');

  const load = useCallback(() => {
    setLoading(true); setError(null);
    const params = new URLSearchParams({ from, to });
    if (typeFilter !== 'all') params.set('type', typeFilter);

    authFetch(`${API}/api/admin/analytics/reading?${params}`)
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setData(d); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [from, to, typeFilter]);

  useEffect(() => { load(); }, [load]);

  function applyPreset(idx) {
    setActivePreset(idx);
    const { from: f, to: t } = resolvePreset(PRESETS[idx].days);
    setFrom(f); setTo(t);
  }

  async function handleExportPDF() {
    setPdfLoading(true);
    try {
      const params = new URLSearchParams({ from, to });
      if (typeFilter !== 'all') params.set('type', typeFilter);
      const r    = await authFetch(`${API}/api/admin/analytics/reading/export?${params}`);
      const blob = await r.blob();
      const url  = URL.createObjectURL(blob);
      const a    = Object.assign(document.createElement('a'), { href: url, download: `lecture_${from}_${to}.pdf` });
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
      ['Type', typeFilter === 'all' ? 'Tous' : typeFilter],
      ['Sessions totales', s.totalSessions],
      ['Livres terminés', s.completed],
      ['Taux de complétion (%)', s.completionRate],
      ['Temps moyen / session (min)', s.avgMinutes],
      ['Total heures lues', s.totalHours],
      [],
      ['=== SESSIONS PAR JOUR ==='],
      ['Date', 'Sessions'],
      ...(data.dailySeries || []).map(d => [d.date, d.count]),
      [],
      ['=== TOP LIVRES ==='],
      ['Titre', 'Type', 'Lecteurs', 'Terminés', 'Taux complétion (%)', 'Temps moy (min)'],
      ...(data.topBooks || []).map(b => [
        b.content?.title || '—',
        b.content?.content_type || '—',
        b.readers,
        b.completed,
        b.completionRate,
        b.avgMinutes,
      ]),
      [],
      ['=== RÉPARTITION TYPE ==='],
      ['Type', 'Sessions'],
      ...(data.byType || []).map(t => [t.type, t.count]),
    ];
    downloadCSV(`lecture_${from}_${to}.csv`, rows);
  }

  const s = data?.summary || {};
  const maxReaders = data?.topBooks?.[0]?.readers || 1;

  return (
    <Box sx={{ bgcolor: C.bg, minHeight: '100vh' }}>

      {/* Header */}
      <Box sx={{ bgcolor: '#fff', height: 60, display: 'flex', alignItems: 'center', px: 3, borderBottom: '1px solid #e5e0d8', position: 'sticky', top: 0, zIndex: 10, gap: 1 }}>
        <AutoStoriesOutlinedIcon sx={{ color: C.indigo, mr: 1 }} />
        <Typography variant="h6" fontWeight={700} color={C.textPrimary} sx={{ flex: 1 }}>Statistiques de lecture</Typography>
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
            <FormControl size="small" sx={{ minWidth: 150, '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}>
              <InputLabel>Type de contenu</InputLabel>
              <Select value={typeFilter} label="Type de contenu" onChange={e => setTypeFilter(e.target.value)}>
                <MenuItem value="all">Tous</MenuItem>
                <MenuItem value="ebook">Ebooks</MenuItem>
                <MenuItem value="audiobook">Audiobooks</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Card>

        {error && <Box sx={{ p: 2, bgcolor: `${C.primary}10`, borderRadius: '12px', color: C.primary, fontSize: '0.85rem' }}>{error}</Box>}

        {/* ── KPIs ── */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <KpiCard label="Sessions de lecture" value={s.totalSessions ?? '—'} icon={AutoStoriesOutlinedIcon} color={C.indigo} loading={loading} />
          <KpiCard label="Taux de complétion" value={`${s.completionRate ?? '—'} %`} sub={`${s.completed ?? 0} terminés`} icon={CheckCircleOutlineIcon} color={C.green} loading={loading} />
          <KpiCard label="Temps moy. / session" value={`${s.avgMinutes ?? '—'} min`} icon={TimerOutlinedIcon} color={C.orange} loading={loading} />
          <KpiCard label="Total heures lues" value={`${s.totalHours ?? '—'} h`} icon={TimerOutlinedIcon} color={C.purple} loading={loading} />
        </Box>

        {/* ── Sessions quotidiennes ── */}
        <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', p: 3 }}>
          <Typography variant="subtitle1" fontWeight={700} color={C.textPrimary} sx={{ mb: 2 }}>
            Sessions par jour
          </Typography>
          {loading ? <Skeleton variant="rectangular" height={200} sx={{ borderRadius: '10px' }} /> : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data?.dailySeries || []} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="readGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.primary} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={C.primary} stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.textSecondary }} axisLine={false} tickLine={false}
                  interval={Math.max(0, Math.floor((data?.dailySeries?.length || 30) / 8) - 1)} />
                <YAxis tick={{ fontSize: 10, fill: C.textSecondary }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="count" name="Sessions" stroke={C.primary} strokeWidth={2.5}
                  fill="url(#readGrad)" dot={false} activeDot={{ r: 4, fill: C.primary }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Box sx={{ display: 'flex', gap: 3, flexWrap: { xs: 'wrap', md: 'nowrap' } }}>

          {/* Top 10 livres */}
          <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', p: 3, flex: 2 }}>
            <Typography variant="subtitle1" fontWeight={700} color={C.textPrimary} sx={{ mb: 2 }}>
              Top 10 — livres les plus lus
            </Typography>
            {loading ? (
              [1,2,3,4,5].map(i => <Skeleton key={i} height={48} sx={{ mb: 1, borderRadius: '8px' }} />)
            ) : (data?.topBooks || []).length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <AutoStoriesOutlinedIcon sx={{ fontSize: 40, opacity: 0.15, display: 'block', mx: 'auto', mb: 1 }} />
                <Typography variant="body2" color={C.textSecondary}>Aucune donnée sur cette période</Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {(data?.topBooks || []).map((book, idx) => {
                  const TypeIcon = TYPE_ICONS[book.content?.content_type] || MenuBookOutlinedIcon;
                  const barPct   = Math.round((book.readers / maxReaders) * 100);
                  return (
                    <Box key={book.content?.id || idx}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                        <Typography variant="caption" fontWeight={900} color={C.textSecondary} sx={{ width: 20, textAlign: 'right', flexShrink: 0 }}>
                          {idx + 1}
                        </Typography>
                        {book.content?.cover_url ? (
                          <Avatar src={book.content.cover_url} variant="rounded" sx={{ width: 32, height: 32, borderRadius: '6px' }} />
                        ) : (
                          <Box sx={{ width: 32, height: 32, borderRadius: '6px', bgcolor: `${C.indigo}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <TypeIcon sx={{ fontSize: 16, color: C.indigo }} />
                          </Box>
                        )}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={700} color={C.textPrimary} noWrap>
                            {book.content?.title || 'Titre inconnu'}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                            <Typography variant="caption" color={C.textSecondary}>{book.readers} lecteur(s)</Typography>
                            <Typography variant="caption" color={C.green}>✓ {book.completionRate}%</Typography>
                            <Typography variant="caption" color={C.textSecondary}>~{book.avgMinutes} min</Typography>
                          </Box>
                        </Box>
                      </Box>
                      <Box sx={{ pl: '52px' }}>
                        <LinearProgress variant="determinate" value={barPct}
                          sx={{ height: 4, borderRadius: 2, bgcolor: '#f0ede8',
                            '& .MuiLinearProgress-bar': { bgcolor: idx === 0 ? C.primary : C.indigo, borderRadius: 2 } }} />
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Card>

          {/* Droite : type + complétion */}
          <Box sx={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 3 }}>

            <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', p: 3 }}>
              <Typography variant="subtitle1" fontWeight={700} color={C.textPrimary} sx={{ mb: 2 }}>
                Ebooks vs Audiobooks
              </Typography>
              {loading ? <Skeleton variant="rectangular" height={140} sx={{ borderRadius: '10px' }} /> : (
                <>
                  <ResponsiveContainer width="100%" height={110}>
                    <PieChart>
                      <Pie data={data?.byType || []} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={48} paddingAngle={4}>
                        {(data?.byType || []).map((e, i) => <Cell key={i} fill={TYPE_COLORS[e.type] || C.grey} />)}
                      </Pie>
                      <Tooltip formatter={(v, n) => [v, n]} />
                    </PieChart>
                  </ResponsiveContainer>
                  {(data?.byType || []).map(t => (
                    <Box key={t.type} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.75 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: TYPE_COLORS[t.type] || C.grey }} />
                        <Typography variant="body2" color={C.textSecondary} sx={{ textTransform: 'capitalize' }}>{t.type}</Typography>
                      </Box>
                      <Typography variant="body2" fontWeight={700} color={C.textPrimary}>{t.count}</Typography>
                    </Box>
                  ))}
                </>
              )}
            </Card>

            <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', p: 3 }}>
              <Typography variant="subtitle1" fontWeight={700} color={C.textPrimary} sx={{ mb: 2 }}>
                Complétion globale
              </Typography>
              {loading ? <Skeleton variant="rectangular" height={80} sx={{ borderRadius: '10px' }} /> : (
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h3" fontWeight={900} color={C.green}>{s.completionRate ?? 0}%</Typography>
                  <LinearProgress variant="determinate" value={s.completionRate || 0}
                    sx={{ my: 1.5, height: 10, borderRadius: 5, bgcolor: '#f0ede8',
                      '& .MuiLinearProgress-bar': { bgcolor: C.green, borderRadius: 5 } }} />
                  <Typography variant="caption" color={C.textSecondary}>
                    {s.completed ?? 0} terminés sur {s.totalSessions ?? 0} sessions
                  </Typography>
                </Box>
              )}
            </Card>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
