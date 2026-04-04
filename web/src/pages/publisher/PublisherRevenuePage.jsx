/**
 * PublisherRevenuePage — /publisher/revenue
 * Résumé normal/bonus/solde + graphique mensuel + détail par livre + versements
 * Filtres période + export CSV + export PDF
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, MenuItem, Select,
  FormControl, Table, TableBody, TableCell, TableHead, TableRow,
  Chip, CircularProgress, Alert, Button, TextField,
} from '@mui/material';
import DownloadIcon              from '@mui/icons-material/Download';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import tokens from '../../config/tokens';
import { getRevenueSummary, getRevenueByBook, getPayouts, getDashboardData } from '../../services/publisher.service';
import { authFetch } from '../../services/auth.service';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const P   = tokens.colors.primary;

const PERIODS = [
  { label: '30 derniers jours', value: '30d' },
  { label: '3 mois',            value: '3m'  },
  { label: '6 mois',            value: '6m'  },
  { label: '12 mois',           value: '12m' },
  { label: 'Personnalisé',      value: 'custom' },
  { label: 'Tout',              value: 'all' },
];

const PAYOUT_STATUS = {
  pending:    { label: 'En attente', color: '#FF9800', bg: '#FFF3E0' },
  processing: { label: 'En cours',   color: '#2196F3', bg: '#E3F2FD' },
  paid:       { label: 'Versé',      color: '#4CAF50', bg: '#E8F5E9' },
  failed:     { label: 'Échoué',     color: '#F44336', bg: '#FFEBEE' },
};

function toISO(d) { return d.toISOString().split('T')[0]; }

function periodToRange(period) {
  if (period === 'all') return {};
  const now  = new Date();
  const from = new Date();
  if (period === '30d')  from.setDate(now.getDate() - 30);
  else if (period === '3m')  from.setMonth(now.getMonth() - 3);
  else if (period === '6m')  from.setMonth(now.getMonth() - 6);
  else if (period === '12m') from.setFullYear(now.getFullYear() - 1);
  return { from: from.toISOString(), to: now.toISOString() };
}

function downloadCSV(filename, rows) {
  const csv = '\uFEFF' + rows.map(r => r.join(';')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  Object.assign(document.createElement('a'), { href: url, download: filename }).click();
  URL.revokeObjectURL(url);
}

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <Box sx={{ bgcolor: '#fff', border: '1px solid #e5e0d8', borderRadius: '10px', p: 1.5, boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
      <Typography variant="caption" fontWeight={700} sx={{ display: 'block', mb: 0.5 }}>{label}</Typography>
      {payload.map(p => (
        <Typography key={p.name} variant="caption" sx={{ display: 'block', color: p.color }}>
          {p.name === 'normal' ? 'Ventes' : 'Bonus'} : {Number(p.value).toFixed(2)} CAD
        </Typography>
      ))}
    </Box>
  );
};

export default function PublisherRevenuePage() {
  const [period, setPeriod]       = useState('30d');
  const [fromDate, setFromDate]   = useState(toISO(new Date(Date.now() - 30 * 86400000)));
  const [toDate, setToDate]       = useState(toISO(new Date()));
  const [summary, setSummary]     = useState(null);
  const [books, setBooks]         = useState([]);
  const [payouts, setPayouts]     = useState([]);
  const [monthlySeries, setMonthlySeries] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError]         = useState(null);

  const getRange = useCallback(() => {
    if (period === 'custom') return { from: new Date(fromDate).toISOString(), to: new Date(toDate + 'T23:59:59').toISOString() };
    return periodToRange(period);
  }, [period, fromDate, toDate]);

  useEffect(() => {
    async function load() {
      setLoading(true); setError(null);
      try {
        const range = getRange();
        const [sumRes, booksRes, payoutsRes] = await Promise.all([
          getRevenueSummary(range),
          getRevenueByBook(range),
          getPayouts(),
        ]);
        setSummary(sumRes.summary);
        setBooks(booksRes.books || []);
        setPayouts(payoutsRes.payouts || []);

        // Graphique mensuel — série mensuelle depuis le dashboard
        getDashboardData()
          .then(d => { if (d.success) setMonthlySeries(d.monthlySeries || []); })
          .catch(() => {});
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [getRange]);

  function handleExportCSV() {
    const rows = [
      ['=== RÉSUMÉ ==='],
      ['Ventes normales (CAD)', summary?.normal?.toFixed(2)],
      ['Bonus (CAD)',           summary?.bonus?.toFixed(2)],
      ['Total généré (CAD)',    summary?.total?.toFixed(2)],
      ['Total versé (CAD)',     summary?.paid?.toFixed(2)],
      ['Solde à percevoir (CAD)', summary?.pending?.toFixed(2)],
      [],
      ['=== DÉTAIL PAR LIVRE ==='],
      ['Titre', 'Auteur', 'Ventes', 'Normal (CAD)', 'Bonus (CAD)', 'Total (CAD)'],
      ...books.map(b => [b.content?.title || '—', b.content?.author || '—', b.sales, b.normal?.toFixed(2), b.bonus?.toFixed(2), b.total?.toFixed(2)]),
      [],
      ['=== VERSEMENTS ==='],
      ['Référence', 'Période', 'Montant (CAD)', 'Statut', 'Date'],
      ...payouts.map(p => [
        p.reference || '—',
        `${p.period_start ? new Date(p.period_start).toLocaleDateString('fr-FR') : '—'} → ${p.period_end ? new Date(p.period_end).toLocaleDateString('fr-FR') : '—'}`,
        Number(p.amount_cad).toFixed(2),
        p.status,
        p.paid_at ? new Date(p.paid_at).toLocaleDateString('fr-FR') : '—',
      ]),
    ];
    downloadCSV(`revenus_editeur_${toISO(new Date())}.csv`, rows);
  }

  async function handleExportPDF() {
    setPdfLoading(true);
    try {
      const range = getRange();
      const params = new URLSearchParams();
      if (range.from) params.set('from', range.from);
      if (range.to)   params.set('to', range.to);
      const r    = await authFetch(`${API}/api/publisher/revenue/export?format=pdf&${params}`);
      const blob = await r.blob();
      const url  = URL.createObjectURL(blob);
      Object.assign(document.createElement('a'), { href: url, download: `revenus_editeur_${toISO(new Date())}.pdf` }).click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error(e); }
    finally { setPdfLoading(false); }
  }

  return (
    <Box sx={{ p: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, color: tokens.colors.onBackground.light, fontFamily: 'Playfair Display, serif' }}>
          Revenus
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <FormControl size="small">
            <Select value={period} onChange={e => setPeriod(e.target.value)} sx={{ borderRadius: '12px', minWidth: 160 }}>
              {PERIODS.map(p => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
            </Select>
          </FormControl>
          {period === 'custom' && (
            <>
              <TextField type="date" size="small" value={fromDate} onChange={e => setFromDate(e.target.value)}
                InputLabelProps={{ shrink: true }} sx={{ width: 150, '& .MuiOutlinedInput-root': { borderRadius: '12px', fontSize: '0.85rem' } }} />
              <Typography variant="caption" sx={{ color: '#9E9E9E' }}>→</Typography>
              <TextField type="date" size="small" value={toDate} onChange={e => setToDate(e.target.value)}
                InputLabelProps={{ shrink: true }} sx={{ width: 150, '& .MuiOutlinedInput-root': { borderRadius: '12px', fontSize: '0.85rem' } }} />
            </>
          )}
          <Button size="small" startIcon={<DownloadIcon />} onClick={handleExportCSV} disabled={loading || !summary}
            sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700, color: '#4CAF50', border: '1px solid #4CAF5040', '&:hover': { bgcolor: '#4CAF5010' } }}>
            CSV
          </Button>
          <Button size="small" startIcon={pdfLoading ? <CircularProgress size={14} /> : <PictureAsPdfOutlinedIcon />}
            onClick={handleExportPDF} disabled={loading || !summary || pdfLoading}
            sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700, color: P, border: `1px solid ${P}40`, '&:hover': { bgcolor: `${P}10` } }}>
            PDF
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}><CircularProgress /></Box>
      ) : (
        <>
          {/* KPIs */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {[
              { label: 'Ventes normales', value: summary?.normal?.toFixed(2), color: P,        bg: '#FFF8F0' },
              { label: 'Bonus',           value: summary?.bonus?.toFixed(2),  color: tokens.colors.secondary, bg: '#FFFBF0' },
              { label: 'Total généré',    value: summary?.total?.toFixed(2),  color: tokens.colors.accent, bg: '#F0F2F5' },
              { label: 'Solde à percevoir', value: summary?.pending?.toFixed(2), color: '#4CAF50', bg: '#F1F8F1' },
            ].map(k => (
              <Grid item xs={12} sm={6} lg={3} key={k.label}>
                <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', bgcolor: k.bg }}>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="body2" sx={{ color: '#9E9E9E', mb: 0.5 }}>{k.label}</Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: k.color }}>{k.value || '0.00'} CAD</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Graphique mensuel */}
          {monthlySeries.length > 0 && (
            <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', p: 3, mb: 4 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 3, color: tokens.colors.onBackground.light }}>
                Évolution des revenus (6 derniers mois)
              </Typography>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={monthlySeries} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rNorm" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={P}       stopOpacity={0.2} />
                      <stop offset="95%" stopColor={P}       stopOpacity={0}   />
                    </linearGradient>
                    <linearGradient id="rBonus" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={tokens.colors.secondary} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={tokens.colors.secondary} stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9E9E9E' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9E9E9E' }} axisLine={false} tickLine={false} width={45} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend formatter={v => v === 'normal' ? 'Ventes normales' : 'Bonus'} wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="normal" stroke={P}       strokeWidth={2} fill="url(#rNorm)"  name="normal" />
                  <Area type="monotone" dataKey="bonus"  stroke={tokens.colors.secondary} strokeWidth={2} fill="url(#rBonus)" name="bonus"  />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Détail par livre */}
          <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', mb: 4 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Détail par livre</Typography>
              {books.length === 0 ? (
                <Typography variant="body2" sx={{ color: '#9E9E9E', py: 2, textAlign: 'center' }}>Aucune vente sur cette période</Typography>
              ) : (
                <Table>
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#FAFAFA' }}>
                      {['Titre', 'Ventes', 'Ventes normales', 'Bonus', 'Total'].map(h => (
                        <TableCell key={h} align={h === 'Titre' ? 'left' : 'right'} sx={{ fontWeight: 600, color: '#757575' }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {books.map((b, i) => (
                      <TableRow key={b.content?.id || i} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            {b.content?.cover_url && (
                              <Box component="img" src={b.content.cover_url} sx={{ width: 32, height: 44, objectFit: 'cover', borderRadius: '4px' }} />
                            )}
                            <Box>
                              <Typography variant="body2" fontWeight={600}>{b.content?.title || '—'}</Typography>
                              <Typography variant="caption" sx={{ color: '#9E9E9E' }}>{b.content?.author}</Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell align="right"><Chip label={b.sales} size="small" sx={{ bgcolor: '#F5F5F5', fontWeight: 700 }} /></TableCell>
                        <TableCell align="right" sx={{ color: P, fontWeight: 600 }}>{b.normal?.toFixed(2)} CAD</TableCell>
                        <TableCell align="right" sx={{ color: tokens.colors.secondary, fontWeight: 600 }}>{b.bonus?.toFixed(2)} CAD</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800 }}>{b.total?.toFixed(2)} CAD</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Versements */}
          <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Historique des versements</Typography>
              {payouts.length === 0 ? (
                <Typography variant="body2" sx={{ color: '#9E9E9E', py: 2, textAlign: 'center' }}>Aucun versement enregistré</Typography>
              ) : (
                <Table>
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#FAFAFA' }}>
                      {['Référence', 'Période', 'Montant', 'Statut', 'Date'].map(h => (
                        <TableCell key={h} sx={{ fontWeight: 600, color: '#757575' }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {payouts.map(p => {
                      const cfg = PAYOUT_STATUS[p.status] || PAYOUT_STATUS.pending;
                      return (
                        <TableRow key={p.id} hover>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{p.reference || '—'}</TableCell>
                          <TableCell>
                            <Typography variant="caption" color="#757575">
                              {p.period_start && new Date(p.period_start).toLocaleDateString('fr-FR')} — {p.period_end && new Date(p.period_end).toLocaleDateString('fr-FR')}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>{Number(p.amount_cad).toFixed(2)} CAD</TableCell>
                          <TableCell>
                            <Chip label={cfg.label} size="small" sx={{ bgcolor: cfg.bg, color: cfg.color, fontWeight: 700 }} />
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" color="#757575">
                              {p.paid_at ? new Date(p.paid_at).toLocaleDateString('fr-FR') : new Date(p.created_at).toLocaleDateString('fr-FR')}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
}
