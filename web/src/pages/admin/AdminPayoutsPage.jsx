/**
 * AdminPayoutsPage
 * Onglet 1 — "À verser"    : revenus non versés groupés par éditeur
 * Onglet 2 — "Historique"  : tous les versements créés avec statuts
 * Onglet 3 — "Planification": config fréquence + versements planifiés
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, Table, TableBody, TableCell,
  TableHead, TableRow, Chip, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Alert, CircularProgress, MenuItem,
  Select, FormControl, InputLabel, Avatar, Tabs, Tab, Stack,
  IconButton, Tooltip, InputAdornment, Divider, Switch, FormControlLabel,
  useTheme, useMediaQuery, List, ListItem, ListItemText, ListItemIcon,
} from '@mui/material';
import AccountBalanceIcon        from '@mui/icons-material/AccountBalance';
import SendIcon                  from '@mui/icons-material/Send';
import EditNoteIcon              from '@mui/icons-material/EditNote';
import SendOutlinedIcon          from '@mui/icons-material/SendOutlined';
import SearchIcon                from '@mui/icons-material/Search';
import RefreshIcon               from '@mui/icons-material/Refresh';
import BoltIcon                  from '@mui/icons-material/Bolt';
import ScheduleIcon              from '@mui/icons-material/Schedule';
import EventIcon                 from '@mui/icons-material/Event';
import CheckCircleIcon           from '@mui/icons-material/CheckCircle';
import WarningAmberIcon          from '@mui/icons-material/WarningAmber';
import SaveIcon                  from '@mui/icons-material/Save';
import CalendarMonthIcon         from '@mui/icons-material/CalendarMonth';
import tokens from '../../config/tokens';
import {
  adminGetPayoutsOverview,
  adminGetPayoutsHistory,
  adminCreatePayout,
  adminCreateAllPayouts,
  adminUpdatePayoutStatus,
  adminGetScheduleConfig,
  adminUpdateScheduleConfig,
  adminGetSchedulePreview,
  adminGetScheduledPayouts,
  adminScheduleNow,
} from '../../services/publisher.service';

const P = tokens.colors.primary;

const STATUS_CFG = {
  pending:    { label: 'En attente',  color: '#FF9800', bg: '#FFF3E0' },
  processing: { label: 'En cours',    color: '#2196F3', bg: '#E3F2FD' },
  paid:       { label: 'Versé',       color: '#4CAF50', bg: '#E8F5E9' },
  failed:     { label: 'Échoué',      color: '#F44336', bg: '#FFEBEE' },
};

// Transitions de statut autorisées
const NEXT_STATUSES = {
  pending:    ['processing', 'paid', 'failed'],
  processing: ['paid', 'failed', 'pending'],
  paid:       ['failed'],
  failed:     ['pending', 'processing'],
};

function StatusChip({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.pending;
  return (
    <Chip
      label={cfg.label}
      size="small"
      sx={{ bgcolor: cfg.bg, color: cfg.color, fontWeight: 700, border: `1px solid ${cfg.color}33`, minWidth: 90 }}
    />
  );
}

function PayoutMethodLabel({ method }) {
  if (!method) return <Typography variant="caption" sx={{ color: '#BDBDBD' }}>Non défini</Typography>;
  const text =
    method.type === 'bank_transfer' ? `Virement — ${method.bank_name || ''}`.trim() :
    method.type === 'mobile_money'  ? `Mobile Money (${method.operator || ''})`.trim() :
    method.type === 'paypal'        ? `PayPal — ${method.paypal_email || ''}`.trim() :
    method.type;
  return <Typography variant="caption" sx={{ color: '#9E9E9E' }}>{text}</Typography>;
}

const FREQ_OPTIONS = [
  { value: 'weekly',    label: 'Hebdomadaire',    hint: 'Chaque semaine le jour sélectionné' },
  { value: 'biweekly',  label: 'Bimensuel',       hint: 'Toutes les 2 semaines' },
  { value: 'monthly',   label: 'Mensuel',          hint: 'Une fois par mois à la date sélectionnée' },
  { value: 'quarterly', label: 'Trimestriel',      hint: 'En janvier, avril, juillet et octobre' },
];
const DAY_OF_WEEK_OPTIONS = [
  { value: 0, label: 'Dimanche' }, { value: 1, label: 'Lundi' }, { value: 2, label: 'Mardi' },
  { value: 3, label: 'Mercredi' }, { value: 4, label: 'Jeudi' }, { value: 5, label: 'Vendredi' },
  { value: 6, label: 'Samedi' },
];

/* ══════════════════════════════════════════════════════════════ */
export default function AdminPayoutsPage() {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [tab, setTab] = useState(0);

  /* ── Onglet 1 : À verser ─────────────────────────────────── */
  const [overview, setOverview]         = useState([]);
  const [overviewTotal, setOverviewTotal] = useState(0);
  const [ovLoading, setOvLoading]       = useState(true);
  const [ovError, setOvError]           = useState(null);

  const loadOverview = useCallback(async () => {
    setOvLoading(true); setOvError(null);
    try {
      const res = await adminGetPayoutsOverview();
      setOverview(res.payouts || []);
      setOverviewTotal((res.payouts || []).reduce((s, p) => s + p.total_cad, 0));
    } catch (e) { setOvError(e.message); }
    finally { setOvLoading(false); }
  }, []);

  /* ── Onglet 3 : Planification ───────────────────────────── */
  const [schedConfig, setSchedConfig]     = useState(null);
  const [schedForm, setSchedForm]         = useState(null); // copy editable
  const [schedSaving, setSchedSaving]     = useState(false);
  const [schedSaveOk, setSchedSaveOk]     = useState(false);
  const [schedError, setSchedError]       = useState(null);
  const [preview, setPreview]             = useState(null);
  const [prevLoading, setPrevLoading]     = useState(false);
  const [scheduled, setScheduled]         = useState([]);
  const [schedLoading, setSchedLoading]   = useState(false);
  const [schedNowLoading, setSchedNowLoading] = useState(false);
  const [schedNowResult, setSchedNowResult]   = useState(null);

  const loadScheduleConfig = useCallback(async () => {
    try {
      const res = await adminGetScheduleConfig();
      setSchedConfig(res.config);
      setSchedForm({ ...res.config });
    } catch (e) { setSchedError(e.message); }
  }, []);

  const loadSchedulePreview = useCallback(async () => {
    setPrevLoading(true);
    try {
      const res = await adminGetSchedulePreview();
      setPreview(res);
    } catch (e) { console.error('loadSchedulePreview:', e); }
    finally { setPrevLoading(false); }
  }, []);

  const loadScheduledPayouts = useCallback(async () => {
    setSchedLoading(true);
    try {
      const res = await adminGetScheduledPayouts({ limit: 50 });
      setScheduled(res.payouts || []);
    } catch (e) { console.error('loadScheduledPayouts:', e); }
    finally { setSchedLoading(false); }
  }, []);

  async function handleSaveConfig() {
    setSchedSaving(true); setSchedError(null); setSchedSaveOk(false);
    try {
      const res = await adminUpdateScheduleConfig({
        frequency:      schedForm.frequency,
        day_of_month:   parseInt(schedForm.day_of_month),
        day_of_week:    parseInt(schedForm.day_of_week),
        is_active:      schedForm.is_active,
        min_amount_cad: parseFloat(schedForm.min_amount_cad),
        notes:          schedForm.notes || null,
      });
      setSchedConfig(res.config);
      setSchedSaveOk(true);
      await loadSchedulePreview();
    } catch (e) { setSchedError(e.message); }
    finally { setSchedSaving(false); }
  }

  async function handleScheduleNow() {
    setSchedNowLoading(true); setSchedNowResult(null);
    try {
      const res = await adminScheduleNow();
      setSchedNowResult(res);
      await loadScheduledPayouts();
      await loadOverview();
    } catch (e) { setSchedNowResult({ error: e.message }); }
    finally { setSchedNowLoading(false); }
  }

  useEffect(() => {
    if (tab === 2) {
      loadScheduleConfig();
      loadSchedulePreview();
      loadScheduledPayouts();
    }
  }, [tab, loadScheduleConfig, loadSchedulePreview, loadScheduledPayouts]);

  /* ── Onglet 2 : Historique ───────────────────────────────── */
  const [history, setHistory]           = useState([]);
  const [histTotal, setHistTotal]       = useState(0);
  const [histLoading, setHistLoading]   = useState(false);
  const [histError, setHistError]       = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch]             = useState('');
  const [page, setPage]                 = useState(1);
  const LIMIT = 20;

  const loadHistory = useCallback(async () => {
    setHistLoading(true); setHistError(null);
    try {
      const res = await adminGetPayoutsHistory({ status: statusFilter, page, limit: LIMIT });
      setHistory(res.payouts || []);
      setHistTotal(res.total || 0);
    } catch (e) { setHistError(e.message); }
    finally { setHistLoading(false); }
  }, [statusFilter, page]);

  useEffect(() => { loadOverview(); }, [loadOverview]);
  useEffect(() => { if (tab === 1) loadHistory(); }, [tab, loadHistory]);

  /* ── Dialog : Créer versement (par éditeur) ──────────────── */
  const [createDialog, setCreateDialog] = useState(null);
  const [createForm, setCreateForm]     = useState({ periodStart: '', periodEnd: '', notes: '' });
  const [creating, setCreating]         = useState(false);
  const [createError, setCreateError]   = useState(null);

  function openCreate(payout) {
    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    setCreateForm({ periodStart: start, periodEnd: end, notes: '' });
    setCreateError(null);
    setCreateDialog({ publisherId: payout.publisher.id, companyName: payout.publisher.company_name, totalCad: payout.total_cad });
  }

  async function handleCreate() {
    if (!createForm.periodStart || !createForm.periodEnd) {
      setCreateError('Les dates de début et fin sont requises.'); return;
    }
    setCreating(true);
    try {
      await adminCreatePayout({ publisherId: createDialog.publisherId, ...createForm });
      setCreateDialog(null);
      await loadOverview();
      if (tab === 1) await loadHistory();
    } catch (e) { setCreateError(e.message); }
    finally { setCreating(false); }
  }

  /* ── Dialog : Tout verser ────────────────────────────────── */
  const [allDialog, setAllDialog]     = useState(false);
  const [allForm, setAllForm]         = useState({ periodStart: '', periodEnd: '', notes: '' });
  const [allCreating, setAllCreating] = useState(false);
  const [allResult, setAllResult]     = useState(null);

  async function handleCreateAll() {
    setAllCreating(true); setAllResult(null);
    try {
      const res = await adminCreateAllPayouts(allForm);
      setAllResult(res);
      await loadOverview();
      if (tab === 1) await loadHistory();
    } catch (e) { setAllResult({ error: e.message }); }
    finally { setAllCreating(false); }
  }

  /* ── Dialog : Modifier statut ────────────────────────────── */
  const [statusDialog, setStatusDialog] = useState(null); // { id, reference, companyName, currentStatus, amountCad }
  const [newStatus, setNewStatus]       = useState('');
  const [statusNotes, setStatusNotes]   = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError]   = useState(null);

  function openStatus(payout) {
    const next = NEXT_STATUSES[payout.status] || ['paid'];
    setNewStatus(next[0]);
    setStatusNotes('');
    setStatusError(null);
    setStatusDialog({
      id: payout.id, reference: payout.reference,
      companyName: payout.publishers?.company_name || '—',
      currentStatus: payout.status,
      amountCad: payout.amount_cad,
    });
  }

  async function handleStatusUpdate() {
    setStatusSaving(true); setStatusError(null);
    try {
      await adminUpdatePayoutStatus(statusDialog.id, newStatus, statusNotes);
      setStatusDialog(null);
      await loadHistory();
    } catch (e) { setStatusError(e.message); }
    finally { setStatusSaving(false); }
  }

  /* ── Filtered history (client-side search) ───────────────── */
  const filtered = search.trim()
    ? history.filter(p =>
        p.publishers?.company_name?.toLowerCase().includes(search.toLowerCase()) ||
        p.reference?.toLowerCase().includes(search.toLowerCase()))
    : history;

  /* ══════════════════════════════════════════════════════════ */
  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, maxWidth: 1200, mx: 'auto' }}>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#1A1A2E', fontFamily: 'Playfair Display, serif' }}>
            Versements
          </Typography>
          <Typography variant="body2" sx={{ color: '#9E9E9E', mt: 0.5 }}>
            Gestion des paiements aux éditeurs
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<BoltIcon />}
          onClick={() => {
            const now   = new Date();
            const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
            setAllForm({ periodStart: start, periodEnd: end, notes: '' });
            setAllResult(null);
            setAllDialog(true);
          }}
          disabled={overview.length === 0}
          sx={{ borderColor: P, color: P, borderRadius: '12px', textTransform: 'none', fontWeight: 700,
            '&:hover': { bgcolor: `${P}0A`, borderColor: P } }}
        >
          Tout verser ({overview.length})
        </Button>
      </Box>

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          mb: 3,
          '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, minWidth: 0 },
          '& .Mui-selected': { color: P },
          '& .MuiTabs-indicator': { bgcolor: P },
        }}
      >
        <Tab label={`À verser${overview.length ? ` (${overview.length})` : ''}`} />
        <Tab label="Historique" />
        <Tab label="Planification automatique" icon={<ScheduleIcon sx={{ fontSize: 16 }} />} iconPosition="start" />
      </Tabs>

      {/* ═══════════════ ONGLET 1 : À VERSER ═════════════════ */}
      {tab === 0 && (
        <>
          {ovError && <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }}>{ovError}</Alert>}

          {/* Total banner */}
          {overviewTotal > 0 && (
            <Card sx={{ borderRadius: '16px', mb: 3, bgcolor: '#FFF8F0', border: `1px solid ${P}33`, boxShadow: 'none' }}>
              <CardContent sx={{ p: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ bgcolor: `${P}1A`, borderRadius: '12px', p: 1.5, display: 'flex' }}>
                    <AccountBalanceIcon sx={{ color: P, fontSize: 26 }} />
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#9E9E9E' }}>Total à verser</Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: P, lineHeight: 1 }}>
                      {overviewTotal.toFixed(2)} CAD
                    </Typography>
                  </Box>
                </Box>
                <Typography variant="caption" sx={{ color: '#9E9E9E' }}>
                  {overview.length} éditeur{overview.length > 1 ? 's' : ''} concerné{overview.length > 1 ? 's' : ''}
                </Typography>
              </CardContent>
            </Card>
          )}

          <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            {ovLoading ? (
              <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}><CircularProgress sx={{ color: P }} /></Box>
            ) : overview.length === 0 ? (
              <Box sx={{ py: 10, textAlign: 'center' }}>
                <AccountBalanceIcon sx={{ fontSize: 48, color: '#E0E0E0', mb: 1.5 }} />
                <Typography variant="body1" sx={{ color: '#9E9E9E', fontWeight: 600 }}>
                  Aucun revenu en attente de versement
                </Typography>
                <Typography variant="caption" sx={{ color: '#BDBDBD' }}>
                  Tous les éditeurs ont été payés
                </Typography>
              </Box>
            ) : isMobile ? (
              /* Mobile : cards */
              <Stack spacing={0} divider={<Divider />}>
                {overview.map((payout, idx) => (
                  <Box key={payout.publisher?.id || idx} sx={{ p: 2.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                      <Avatar sx={{ bgcolor: P, width: 38, height: 38, fontSize: '0.95rem', fontWeight: 700 }}>
                        {payout.publisher?.company_name?.charAt(0).toUpperCase()}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={700} noWrap>{payout.publisher?.company_name}</Typography>
                        <PayoutMethodLabel method={payout.publisher?.payout_method} />
                      </Box>
                      <Typography variant="body1" fontWeight={800} color={P}>
                        {payout.total_cad.toFixed(2)} CAD
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
                      <Box sx={{ flex: 1, bgcolor: '#F5F5F5', borderRadius: '8px', p: 1, textAlign: 'center' }}>
                        <Typography variant="caption" color="#9E9E9E">Ventes</Typography>
                        <Typography variant="body2" fontWeight={700} color={P}>{payout.normal.toFixed(2)}</Typography>
                      </Box>
                      <Box sx={{ flex: 1, bgcolor: '#F5F5F5', borderRadius: '8px', p: 1, textAlign: 'center' }}>
                        <Typography variant="caption" color="#9E9E9E">Bonus</Typography>
                        <Typography variant="body2" fontWeight={700} color={tokens.colors.secondary}>{payout.bonus.toFixed(2)}</Typography>
                      </Box>
                    </Box>
                    <Button fullWidth variant="contained" size="small" startIcon={<SendIcon />}
                      onClick={() => openCreate(payout)}
                      sx={{ bgcolor: P, borderRadius: '10px', textTransform: 'none', fontWeight: 700 }}>
                      Créer le versement
                    </Button>
                  </Box>
                ))}
              </Stack>
            ) : (
              /* Desktop : table */
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#FAFAFA' }}>
                    <TableCell sx={{ fontWeight: 600, color: '#757575', pl: 3 }}>Éditeur</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#757575' }}>Mode de paiement</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, color: '#757575' }}>Ventes normales</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, color: '#757575' }}>Bonus</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, color: '#757575' }}>Total</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, color: '#757575', pr: 3 }}>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {overview.map((payout, idx) => (
                    <TableRow key={payout.publisher?.id || idx} hover>
                      <TableCell sx={{ pl: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar sx={{ bgcolor: P, width: 36, height: 36, fontSize: '0.9rem', fontWeight: 700 }}>
                            {payout.publisher?.company_name?.charAt(0).toUpperCase()}
                          </Avatar>
                          <Typography variant="body2" fontWeight={700}>{payout.publisher?.company_name}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <PayoutMethodLabel method={payout.publisher?.payout_method} />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={600} color={P}>{payout.normal.toFixed(2)} CAD</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={600} color={tokens.colors.secondary}>{payout.bonus.toFixed(2)} CAD</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={800} color="#1A1A2E">{payout.total_cad.toFixed(2)} CAD</Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ pr: 3 }}>
                        <Button size="small" variant="contained" startIcon={<SendIcon sx={{ fontSize: 14 }} />}
                          onClick={() => openCreate(payout)}
                          sx={{ bgcolor: P, borderRadius: '8px', textTransform: 'none', fontWeight: 700, fontSize: '0.8rem' }}>
                          Verser
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </>
      )}

      {/* ═══════════════ ONGLET 2 : HISTORIQUE ════════════════ */}
      {tab === 1 && (
        <>
          {/* Filtres */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              placeholder="Référence ou éditeur…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              size="small"
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: '#BDBDBD', fontSize: 18 }} /></InputAdornment> }}
              sx={{ width: { xs: '100%', sm: 260 }, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
            />
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Statut</InputLabel>
              <Select value={statusFilter} label="Statut" onChange={e => { setStatusFilter(e.target.value); setPage(1); }} sx={{ borderRadius: '12px' }}>
                <MenuItem value="">Tous</MenuItem>
                {Object.entries(STATUS_CFG).map(([k, v]) => (
                  <MenuItem key={k} value={k}>{v.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Tooltip title="Rafraîchir">
              <IconButton onClick={loadHistory} size="small" sx={{ color: '#9E9E9E' }}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Box sx={{ ml: 'auto' }}>
              <Typography variant="caption" sx={{ color: '#9E9E9E' }}>
                {histTotal} versement{histTotal > 1 ? 's' : ''}
              </Typography>
            </Box>
          </Box>

          {histError && <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }}>{histError}</Alert>}

          <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            {histLoading ? (
              <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}><CircularProgress sx={{ color: P }} /></Box>
            ) : filtered.length === 0 ? (
              <Box sx={{ py: 10, textAlign: 'center' }}>
                <SendOutlinedIcon sx={{ fontSize: 48, color: '#E0E0E0', mb: 1.5 }} />
                <Typography variant="body1" sx={{ color: '#9E9E9E', fontWeight: 600 }}>Aucun versement trouvé</Typography>
              </Box>
            ) : isMobile ? (
              /* Mobile : cards */
              <Stack spacing={0} divider={<Divider />}>
                {filtered.map(payout => (
                  <Box key={payout.id} sx={{ p: 2.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
                      <Box>
                        <Typography variant="body2" fontWeight={700}>{payout.publishers?.company_name || '—'}</Typography>
                        <Typography variant="caption" sx={{ color: '#9E9E9E', fontFamily: 'monospace' }}>{payout.reference}</Typography>
                      </Box>
                      <StatusChip status={payout.status} />
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
                      <Typography variant="body1" fontWeight={800} color={P}>
                        {Number(payout.amount_cad).toFixed(2)} CAD
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="caption" sx={{ color: '#BDBDBD' }}>
                          {new Date(payout.created_at).toLocaleDateString('fr-FR')}
                        </Typography>
                        {NEXT_STATUSES[payout.status]?.length > 0 && (
                          <Tooltip title="Modifier le statut">
                            <IconButton size="small" onClick={() => openStatus(payout)} sx={{ color: P }}>
                              <EditNoteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Stack>
            ) : (
              /* Desktop : table */
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#FAFAFA' }}>
                    <TableCell sx={{ fontWeight: 600, color: '#757575', pl: 3 }}>Référence</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#757575' }}>Éditeur</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#757575' }}>Mode</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, color: '#757575' }}>Montant</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#757575' }}>Période</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#757575' }}>Statut</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#757575' }}>Créé le</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#757575', pr: 3 }}>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map(payout => (
                    <TableRow key={payout.id} hover>
                      <TableCell sx={{ pl: 3 }}>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#757575', fontWeight: 600 }}>
                          {payout.reference}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar sx={{ bgcolor: P, width: 32, height: 32, fontSize: '0.8rem', fontWeight: 700 }}>
                            {payout.publishers?.company_name?.charAt(0).toUpperCase()}
                          </Avatar>
                          <Typography variant="body2" fontWeight={600}>{payout.publishers?.company_name || '—'}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <PayoutMethodLabel method={payout.payout_method} />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={800} color={P}>
                          {Number(payout.amount_cad).toFixed(2)} CAD
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ color: '#757575' }}>
                          {payout.period_start
                            ? `${new Date(payout.period_start).toLocaleDateString('fr-FR')} → ${new Date(payout.period_end).toLocaleDateString('fr-FR')}`
                            : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell><StatusChip status={payout.status} /></TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ color: '#9E9E9E' }}>
                          {new Date(payout.created_at).toLocaleDateString('fr-FR')}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ pr: 3 }}>
                        {NEXT_STATUSES[payout.status]?.length > 0 ? (
                          <Tooltip title="Modifier le statut">
                            <IconButton size="small" onClick={() => openStatus(payout)} sx={{ color: P }}>
                              <EditNoteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Typography variant="caption" sx={{ color: '#E0E0E0' }}>—</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>

          {/* Pagination simple */}
          {histTotal > LIMIT && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mt: 3 }}>
              <Button size="small" disabled={page === 1} onClick={() => setPage(p => p - 1)}
                sx={{ textTransform: 'none', color: P }}>← Précédent</Button>
              <Typography variant="caption" sx={{ color: '#9E9E9E' }}>
                Page {page} / {Math.ceil(histTotal / LIMIT)}
              </Typography>
              <Button size="small" disabled={page >= Math.ceil(histTotal / LIMIT)} onClick={() => setPage(p => p + 1)}
                sx={{ textTransform: 'none', color: P }}>Suivant →</Button>
            </Box>
          )}
        </>
      )}

      {/* ═══════════════ ONGLET 3 : PLANIFICATION ════════════ */}
      {tab === 2 && (
        <>
          {schedError && <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }}>{schedError}</Alert>}

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3, mb: 3 }}>

            {/* ─── Config ─────────────────────────────────────── */}
            <Card sx={{ borderRadius: '20px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                  <Box sx={{ bgcolor: `${P}15`, borderRadius: '10px', p: 1, display: 'flex' }}>
                    <ScheduleIcon sx={{ color: P, fontSize: 20 }} />
                  </Box>
                  <Typography variant="subtitle1" fontWeight={700}>Configuration de la planification</Typography>
                </Box>

                {!schedForm ? (
                  <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}><CircularProgress sx={{ color: P }} /></Box>
                ) : (
                  <Stack spacing={2.5}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={!!schedForm.is_active}
                          onChange={e => setSchedForm(f => ({ ...f, is_active: e.target.checked }))}
                          sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: P }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: P } }}
                        />
                      }
                      label={<Typography variant="body2" fontWeight={600}>{schedForm.is_active ? 'Planification activée' : 'Planification désactivée'}</Typography>}
                    />

                    <FormControl fullWidth size="small">
                      <InputLabel>Fréquence</InputLabel>
                      <Select value={schedForm.frequency} label="Fréquence"
                        onChange={e => setSchedForm(f => ({ ...f, frequency: e.target.value }))}
                        sx={{ borderRadius: '12px' }}>
                        {FREQ_OPTIONS.map(f => (
                          <MenuItem key={f.value} value={f.value}>
                            <Box>
                              <Typography variant="body2" fontWeight={600}>{f.label}</Typography>
                              <Typography variant="caption" sx={{ color: '#9E9E9E' }}>{f.hint}</Typography>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    {(schedForm.frequency === 'monthly' || schedForm.frequency === 'quarterly') && (
                      <TextField
                        label="Jour du mois (1-28)"
                        type="number"
                        size="small"
                        value={schedForm.day_of_month}
                        onChange={e => setSchedForm(f => ({ ...f, day_of_month: Math.min(28, Math.max(1, parseInt(e.target.value) || 1)) }))}
                        inputProps={{ min: 1, max: 28 }}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                      />
                    )}

                    {(schedForm.frequency === 'weekly' || schedForm.frequency === 'biweekly') && (
                      <FormControl fullWidth size="small">
                        <InputLabel>Jour de la semaine</InputLabel>
                        <Select value={schedForm.day_of_week} label="Jour de la semaine"
                          onChange={e => setSchedForm(f => ({ ...f, day_of_week: e.target.value }))}
                          sx={{ borderRadius: '12px' }}>
                          {DAY_OF_WEEK_OPTIONS.map(d => (
                            <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}

                    <TextField
                      label="Montant minimum (CAD)"
                      type="number"
                      size="small"
                      value={schedForm.min_amount_cad}
                      onChange={e => setSchedForm(f => ({ ...f, min_amount_cad: e.target.value }))}
                      helperText="Les éditeurs sous ce seuil ne sont pas inclus"
                      inputProps={{ min: 0, step: 0.5 }}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                    />

                    <TextField
                      label="Notes (optionnel)"
                      size="small"
                      value={schedForm.notes || ''}
                      onChange={e => setSchedForm(f => ({ ...f, notes: e.target.value }))}
                      multiline rows={2}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                    />

                    {schedSaveOk && <Alert severity="success" sx={{ borderRadius: '10px' }}>Configuration sauvegardée ✓</Alert>}

                    <Button variant="contained" startIcon={schedSaving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                      onClick={handleSaveConfig} disabled={schedSaving}
                      sx={{ bgcolor: P, borderRadius: '12px', textTransform: 'none', fontWeight: 700 }}>
                      {schedSaving ? 'Sauvegarde…' : 'Sauvegarder la configuration'}
                    </Button>
                  </Stack>
                )}
              </CardContent>
            </Card>

            {/* ─── Aperçu ─────────────────────────────────────── */}
            <Card sx={{ borderRadius: '20px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{ bgcolor: `${tokens.colors.accent}15`, borderRadius: '10px', p: 1, display: 'flex' }}>
                      <CalendarMonthIcon sx={{ color: tokens.colors.accent, fontSize: 20 }} />
                    </Box>
                    <Typography variant="subtitle1" fontWeight={700}>Aperçu des prochains versements</Typography>
                  </Box>
                  <IconButton size="small" onClick={loadSchedulePreview} sx={{ color: '#9E9E9E' }}>
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </Box>

                {prevLoading ? (
                  <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}><CircularProgress sx={{ color: P }} size={28} /></Box>
                ) : preview ? (
                  <Stack spacing={2}>
                    {/* Prochaines dates */}
                    <Box>
                      <Typography variant="caption" sx={{ color: '#757575', fontWeight: 600, mb: 1, display: 'block' }}>
                        PROCHAINES DATES
                      </Typography>
                      <Stack spacing={1}>
                        {(preview.upcomingDates || []).map((date, i) => (
                          <Box key={date} sx={{
                            display: 'flex', alignItems: 'center', gap: 1.5,
                            p: 1.2, borderRadius: '10px',
                            bgcolor: i === 0 ? `${P}10` : '#F9F9F9',
                            border: i === 0 ? `1px solid ${P}30` : '1px solid transparent',
                          }}>
                            <EventIcon sx={{ fontSize: 16, color: i === 0 ? P : '#BDBDBD' }} />
                            <Typography variant="body2" fontWeight={i === 0 ? 700 : 500} color={i === 0 ? P : '#757575'}>
                              {new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                            </Typography>
                            {i === 0 && <Chip label="Prochain" size="small" sx={{ ml: 'auto', bgcolor: `${P}15`, color: P, fontWeight: 700, fontSize: '0.65rem', height: 18 }} />}
                          </Box>
                        ))}
                      </Stack>
                    </Box>

                    <Divider sx={{ borderColor: '#F0EDE8' }} />

                    {/* Résumé */}
                    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                      <Box sx={{ flex: 1, minWidth: 100, bgcolor: '#E8F5E9', borderRadius: '10px', p: 1.5, textAlign: 'center' }}>
                        <Typography variant="h6" fontWeight={800} color="#4CAF50">{preview.eligible?.length || 0}</Typography>
                        <Typography variant="caption" color="#4CAF50">Éligibles</Typography>
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 100, bgcolor: '#FFF3E0', borderRadius: '10px', p: 1.5, textAlign: 'center' }}>
                        <Typography variant="h6" fontWeight={800} color="#FF9800">{preview.belowMin?.length || 0}</Typography>
                        <Typography variant="caption" color="#FF9800">Sous le seuil</Typography>
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 100, bgcolor: `${P}10`, borderRadius: '10px', p: 1.5, textAlign: 'center' }}>
                        <Typography variant="body2" fontWeight={800} color={P}>{(preview.totalAmount || 0).toFixed(2)}</Typography>
                        <Typography variant="caption" color={P}>CAD total</Typography>
                      </Box>
                    </Box>

                    {/* Éditeurs éligibles */}
                    {preview.eligible?.length > 0 && (
                      <Box>
                        <Typography variant="caption" sx={{ color: '#757575', fontWeight: 600, mb: 1, display: 'block' }}>
                          ÉDITEURS CONCERNÉS
                        </Typography>
                        <Stack spacing={0.5}>
                          {preview.eligible.slice(0, 5).map(e => (
                            <Box key={e.publisherId} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1, py: 0.5, borderRadius: '8px', '&:hover': { bgcolor: '#F9F9F9' } }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <CheckCircleIcon sx={{ fontSize: 14, color: '#4CAF50' }} />
                                <Typography variant="caption" fontWeight={600}>{e.name}</Typography>
                              </Box>
                              <Typography variant="caption" fontWeight={700} color={P}>{e.amount.toFixed(2)} CAD</Typography>
                            </Box>
                          ))}
                          {preview.eligible.length > 5 && (
                            <Typography variant="caption" sx={{ color: '#9E9E9E', pl: 1 }}>
                              + {preview.eligible.length - 5} autre(s)…
                            </Typography>
                          )}
                        </Stack>
                      </Box>
                    )}

                    {/* Bouton planifier */}
                    {schedNowResult && !schedNowResult.error && (
                      <Alert severity="success" sx={{ borderRadius: '10px' }}>
                        {schedNowResult.created?.length || 0} versement(s) planifié(s) pour le {schedNowResult.scheduledFor}
                      </Alert>
                    )}
                    {schedNowResult?.error && <Alert severity="error" sx={{ borderRadius: '10px' }}>{schedNowResult.error}</Alert>}

                    <Button
                      fullWidth variant="contained"
                      startIcon={schedNowLoading ? <CircularProgress size={16} color="inherit" /> : <BoltIcon />}
                      onClick={handleScheduleNow}
                      disabled={schedNowLoading || !preview.eligible?.length}
                      sx={{ bgcolor: P, borderRadius: '12px', textTransform: 'none', fontWeight: 700 }}
                    >
                      {schedNowLoading ? 'Planification…' : `Planifier ${preview.eligible?.length || 0} versements maintenant`}
                    </Button>
                  </Stack>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body2" sx={{ color: '#9E9E9E' }}>Chargement de l'aperçu…</Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Box>

          {/* ─── Versements planifiés ─────────────────────────── */}
          <Card sx={{ borderRadius: '20px', boxShadow: '0 2px 16px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <CardContent sx={{ p: 3, pb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="subtitle1" fontWeight={700}>
                  Versements planifiés ({scheduled.length})
                </Typography>
                <IconButton size="small" onClick={loadScheduledPayouts} sx={{ color: '#9E9E9E' }}>
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </Box>
            </CardContent>

            {schedLoading ? (
              <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}><CircularProgress sx={{ color: P }} /></Box>
            ) : scheduled.length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <ScheduleIcon sx={{ fontSize: 40, color: '#E0E0E0', mb: 1 }} />
                <Typography variant="body2" sx={{ color: '#9E9E9E' }}>Aucun versement planifié</Typography>
                <Typography variant="caption" sx={{ color: '#BDBDBD' }}>Utilisez "Planifier maintenant" pour créer des versements automatiques</Typography>
              </Box>
            ) : (
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#FAFAFA' }}>
                    <TableCell sx={{ fontWeight: 600, color: '#757575', pl: 3 }}>Éditeur</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#757575' }}>Référence</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, color: '#757575' }}>Montant</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#757575' }}>Mode de paiement</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#757575' }}>Date prévue</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#757575', pr: 3 }}>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {scheduled.map(payout => {
                    const scheduledDate = payout.scheduled_for ? new Date(payout.scheduled_for + 'T00:00:00') : null;
                    const isPast = scheduledDate && scheduledDate <= new Date();
                    return (
                      <TableRow key={payout.id} hover>
                        <TableCell sx={{ pl: 3 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Avatar sx={{ bgcolor: P, width: 32, height: 32, fontSize: '0.8rem', fontWeight: 700 }}>
                              {payout.publishers?.company_name?.charAt(0).toUpperCase()}
                            </Avatar>
                            <Typography variant="body2" fontWeight={600}>{payout.publishers?.company_name || '—'}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#757575' }}>{payout.reference}</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight={800} color={P}>{Number(payout.amount_cad).toFixed(2)} CAD</Typography>
                        </TableCell>
                        <TableCell>
                          <PayoutMethodLabel method={payout.payout_method} />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {isPast
                              ? <WarningAmberIcon sx={{ fontSize: 14, color: '#FF9800' }} />
                              : <EventIcon sx={{ fontSize: 14, color: '#9E9E9E' }} />}
                            <Typography variant="body2" fontWeight={600} color={isPast ? '#FF9800' : '#1A1A2E'}>
                              {scheduledDate ? scheduledDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ pr: 3 }}>
                          <Tooltip title="Modifier le statut">
                            <IconButton size="small" onClick={() => openStatus(payout)} sx={{ color: P }}>
                              <EditNoteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </>
      )}

      {/* ═══ Dialog : Créer un versement ══════════════════════ */}
      <Dialog open={!!createDialog} onClose={() => setCreateDialog(null)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: '20px' } }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 0 }}>
          Créer un versement
          <Typography variant="body2" sx={{ color: '#9E9E9E', fontWeight: 400, mt: 0.5 }}>
            {createDialog?.companyName}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          {createError && <Alert severity="error" sx={{ mb: 2, borderRadius: '10px' }}>{createError}</Alert>}
          <Box sx={{ bgcolor: '#FFF8F0', borderRadius: '12px', p: 2, mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="body2" sx={{ color: '#9E9E9E' }}>Montant à verser</Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: P }}>
              {createDialog?.totalCad?.toFixed(2)} CAD
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField label="Début de période *" type="date" value={createForm.periodStart}
              onChange={e => setCreateForm(f => ({ ...f, periodStart: e.target.value }))}
              InputLabelProps={{ shrink: true }} fullWidth
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
            <TextField label="Fin de période *" type="date" value={createForm.periodEnd}
              onChange={e => setCreateForm(f => ({ ...f, periodEnd: e.target.value }))}
              InputLabelProps={{ shrink: true }} fullWidth
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
          </Box>
          <TextField label="Notes internes (optionnel)" value={createForm.notes}
            onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))}
            fullWidth multiline rows={2}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1, gap: 1 }}>
          <Button onClick={() => setCreateDialog(null)} sx={{ textTransform: 'none', color: '#757575' }}>Annuler</Button>
          <Button variant="contained" onClick={handleCreate} disabled={creating}
            startIcon={creating ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
            sx={{ bgcolor: P, borderRadius: '12px', textTransform: 'none', fontWeight: 700 }}>
            Confirmer le versement
          </Button>
        </DialogActions>
      </Dialog>

      {/* ═══ Dialog : Tout verser ══════════════════════════════ */}
      <Dialog open={allDialog} onClose={() => !allCreating && setAllDialog(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: '20px' } }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 0 }}>
          Verser à tous les éditeurs
          <Typography variant="body2" sx={{ color: '#9E9E9E', fontWeight: 400, mt: 0.5 }}>
            {overview.length} éditeur{overview.length > 1 ? 's' : ''} · {overviewTotal.toFixed(2)} CAD au total
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          {allResult && !allResult.error && (
            <Alert severity="success" sx={{ mb: 2, borderRadius: '10px' }}>
              {allResult.created?.length || 0} versement{allResult.created?.length > 1 ? 's' : ''} créé{allResult.created?.length > 1 ? 's' : ''}
              {allResult.errors?.length > 0 && ` · ${allResult.errors.length} erreur(s)`}
            </Alert>
          )}
          {allResult?.error && <Alert severity="error" sx={{ mb: 2, borderRadius: '10px' }}>{allResult.error}</Alert>}
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField label="Début de période" type="date" value={allForm.periodStart}
              onChange={e => setAllForm(f => ({ ...f, periodStart: e.target.value }))}
              InputLabelProps={{ shrink: true }} fullWidth
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
            <TextField label="Fin de période" type="date" value={allForm.periodEnd}
              onChange={e => setAllForm(f => ({ ...f, periodEnd: e.target.value }))}
              InputLabelProps={{ shrink: true }} fullWidth
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
          </Box>
          <TextField label="Notes (optionnel)" value={allForm.notes}
            onChange={e => setAllForm(f => ({ ...f, notes: e.target.value }))}
            fullWidth multiline rows={2}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1, gap: 1 }}>
          <Button onClick={() => setAllDialog(false)} disabled={allCreating}
            sx={{ textTransform: 'none', color: '#757575' }}>
            {allResult ? 'Fermer' : 'Annuler'}
          </Button>
          {!allResult && (
            <Button variant="contained" onClick={handleCreateAll} disabled={allCreating}
              startIcon={allCreating ? <CircularProgress size={16} color="inherit" /> : <BoltIcon />}
              sx={{ bgcolor: P, borderRadius: '12px', textTransform: 'none', fontWeight: 700 }}>
              Créer {overview.length} versements
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* ═══ Dialog : Modifier le statut ══════════════════════ */}
      <Dialog open={!!statusDialog} onClose={() => !statusSaving && setStatusDialog(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: '20px' } }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 0 }}>
          Modifier le statut
          <Typography variant="body2" sx={{ color: '#9E9E9E', fontWeight: 400, mt: 0.5 }}>
            {statusDialog?.reference} · {statusDialog?.companyName}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          {statusError && <Alert severity="error" sx={{ mb: 2, borderRadius: '10px' }}>{statusError}</Alert>}
          <Box sx={{ bgcolor: '#F5F5F5', borderRadius: '12px', p: 2, mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" sx={{ color: '#9E9E9E' }}>Statut actuel</Typography>
              <StatusChip status={statusDialog?.currentStatus} />
            </Box>
            <Typography variant="h6" fontWeight={800} color={P}>
              {Number(statusDialog?.amountCad || 0).toFixed(2)} CAD
            </Typography>
          </Box>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Nouveau statut</InputLabel>
            <Select value={newStatus} label="Nouveau statut" onChange={e => setNewStatus(e.target.value)}
              sx={{ borderRadius: '12px' }}>
              {(NEXT_STATUSES[statusDialog?.currentStatus] || []).map(s => (
                <MenuItem key={s} value={s}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <StatusChip status={s} />
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField label="Notes (optionnel)" value={statusNotes}
            onChange={e => setStatusNotes(e.target.value)}
            fullWidth multiline rows={2}
            placeholder="Référence de transaction, commentaire…"
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1, gap: 1 }}>
          <Button onClick={() => setStatusDialog(null)} disabled={statusSaving}
            sx={{ textTransform: 'none', color: '#757575' }}>Annuler</Button>
          <Button variant="contained" onClick={handleStatusUpdate} disabled={statusSaving}
            startIcon={statusSaving ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ bgcolor: P, borderRadius: '12px', textTransform: 'none', fontWeight: 700 }}>
            Confirmer
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}
