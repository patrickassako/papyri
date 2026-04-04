import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, Grid, Avatar, Chip, Button,
  Table, TableBody, TableCell, TableHead, TableRow, CircularProgress,
  Alert, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Select, FormControl, InputLabel, Tab, Tabs,
  IconButton, Tooltip, Skeleton, Divider, LinearProgress, Snackbar,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DownloadIcon from '@mui/icons-material/Download';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DateRangeOutlinedIcon from '@mui/icons-material/DateRangeOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import PaymentOutlinedIcon from '@mui/icons-material/PaymentOutlined';
import PendingActionsOutlinedIcon from '@mui/icons-material/PendingActionsOutlined';
import tokens from '../../config/tokens';
import { authFetch } from '../../services/auth.service';
import {
  adminGetPublisher,
  adminUpdateStatus,
  adminUpdateRevenueGrid,
  adminApproveContent,
  adminRejectContent,
} from '../../services/publisher.service';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Quick period presets
const PRESETS = [
  { label: 'Tout',        from: '',   to: ''   },
  { label: 'Ce mois',     from: 'thisMonth', to: 'thisMonth' },
  { label: '3 mois',      from: '3m', to: '' },
  { label: '6 mois',      from: '6m', to: '' },
  { label: 'Cette année', from: 'year', to: '' },
];

function resolvePreset(from, to) {
  const now = new Date();
  const fmt = (d) => d.toISOString().split('T')[0];
  if (from === 'thisMonth') {
    return { from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), to: fmt(now) };
  }
  if (from === '3m') return { from: fmt(new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())), to: fmt(now) };
  if (from === '6m') return { from: fmt(new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())), to: fmt(now) };
  if (from === 'year') return { from: fmt(new Date(now.getFullYear(), 0, 1)), to: fmt(now) };
  return { from, to };
}

const C = {
  primary: tokens.colors.primary,
  indigo:  tokens.colors.accent,
  green:   '#27ae60',
  orange:  '#FF9800',
  blue:    '#2196F3',
  purple:  '#9C27B0',
  red:     '#e74c3c',
  or:      tokens.colors.secondary,
};

const STATUS_CONFIG = {
  active:  { label: 'Actif',    color: '#27ae60', bg: '#e8f5e9' },
  pending: { label: 'En attente', color: '#9E9E9E', bg: '#F5F5F5' },
  paused:  { label: 'Suspendu', color: '#FF9800', bg: '#FFF3E0' },
  banned:  { label: 'Banni',    color: '#e74c3c', bg: '#FFEBEE' },
};

const PAYOUT_STATUS = {
  pending:    { label: 'En attente',  color: '#FF9800', bg: '#FFF3E0' },
  processing: { label: 'En cours',    color: '#2196F3', bg: '#E3F2FD' },
  paid:       { label: 'Versé',       color: '#27ae60', bg: '#e8f5e9' },
  failed:     { label: 'Échoué',      color: '#e74c3c', bg: '#FFEBEE' },
};

const V_CONFIG = {
  approved: { label: 'Approuvé',   color: '#27ae60', bg: '#e8f5e9' },
  rejected: { label: 'Rejeté',     color: '#e74c3c', bg: '#FFEBEE' },
  pending:  { label: 'En attente', color: '#FF9800', bg: '#FFF3E0' },
};

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, color = C.primary, loading }) {
  return (
    <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
      <CardContent sx={{ p: 2.5 }}>
        {loading ? (
          <>
            <Skeleton variant="rounded" width={42} height={42} sx={{ mb: 1.5, borderRadius: '10px' }} />
            <Skeleton width="60%" height={28} sx={{ mb: 0.5 }} />
            <Skeleton width="45%" height={16} />
          </>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
            <Box sx={{ bgcolor: `${color}18`, borderRadius: '12px', p: 1.2, display: 'flex', flexShrink: 0 }}>
              {React.cloneElement(icon, { sx: { color, fontSize: 24 } })}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h5" sx={{ fontWeight: 900, color: '#1a1a2e', lineHeight: 1.1 }}>
                {value ?? '—'}
              </Typography>
              <Typography variant="body2" sx={{ color: '#666', mt: 0.3, fontSize: '0.8rem', fontWeight: 600 }}>
                {label}
              </Typography>
              {sub && (
                <Typography variant="caption" sx={{ color: '#aaa', display: 'block', mt: 0.2 }}>{sub}</Typography>
              )}
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

// ── Info field ────────────────────────────────────────────────────────────────
function InfoField({ icon, label, value }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, py: 1.5 }}>
      <Box sx={{ color: '#bbb', mt: 0.2, flexShrink: 0 }}>
        {React.cloneElement(icon, { sx: { fontSize: 18 } })}
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography variant="caption" sx={{ color: '#aaa', fontWeight: 700, textTransform: 'uppercase',
          fontSize: '10px', letterSpacing: '0.5px', display: 'block' }}>
          {label}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 600, color: '#333', mt: 0.2 }}>{value || '—'}</Typography>
      </Box>
    </Box>
  );
}

// ── Book cover placeholder ────────────────────────────────────────────────────
function BookCover({ url, w = 36, h = 48 }) {
  return url
    ? <Box component="img" src={url} alt=""
        sx={{ width: w, height: h, objectFit: 'cover', borderRadius: '5px', flexShrink: 0 }} />
    : <Box sx={{ width: w, height: h, bgcolor: '#F0EDE8', borderRadius: '5px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <MenuBookOutlinedIcon sx={{ fontSize: 14, color: '#C7B9B0' }} />
      </Box>;
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminPublisherDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const [tab, setTab]       = useState(0);

  // Period filter
  const [activePreset, setActivePreset] = useState('Tout');
  const [periodFrom, setPeriodFrom]     = useState('');
  const [periodTo, setPeriodTo]         = useState('');
  const [exporting, setExporting]       = useState(false);

  // Dialogs
  const [statusDialog, setStatusDialog] = useState(false);
  const [newStatus, setNewStatus]       = useState('');
  const [savingStatus, setSavingStatus] = useState(false);

  const [gridDialog, setGridDialog]   = useState(false);
  const [grid, setGrid]               = useState({ threshold_cad: 5, above_threshold_cad: 5, below_threshold_cad: 2.5 });
  const [savingGrid, setSavingGrid]   = useState(false);

  const [bookDialog, setBookDialog]   = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectMode, setRejectMode]   = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'error' });
  const showError = (msg) => setSnack({ open: true, msg, severity: 'error' });

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { from, to } = resolvePreset(periodFrom, periodTo);
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to)   params.set('to', to);
      const res = await adminGetPublisher(id, params);
      setData(res);
      setNewStatus(res.publisher?.status || 'pending');
      setGrid(res.publisher?.revenue_grid || { threshold_cad: 5, above_threshold_cad: 5, below_threshold_cad: 2.5 });
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [id, periodFrom, periodTo]);

  useEffect(() => { load(); }, [load]);

  async function handleExport(format) {
    setExporting(true);
    try {
      const { from, to } = resolvePreset(periodFrom, periodTo);
      const params = new URLSearchParams({ format });
      if (from) params.set('from', from);
      if (to)   params.set('to', to);
      const res = await authFetch(`${API}/api/admin/publishers/${id}/export?${params}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `editeur-${data?.publisher?.company_name?.replace(/\s+/g, '-') || id}-${Date.now()}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error('Export error:', e); }
    finally { setExporting(false); }
  }

  function applyPreset(preset) {
    setActivePreset(preset.label);
    if (preset.from === '' && preset.to === '') {
      setPeriodFrom(''); setPeriodTo('');
    } else {
      setPeriodFrom(preset.from); setPeriodTo(preset.to);
    }
  }

  async function handleStatusSave() {
    setSavingStatus(true);
    try { await adminUpdateStatus(id, newStatus); setStatusDialog(false); await load(); }
    catch (e) { showError(e.message); }
    finally { setSavingStatus(false); }
  }

  async function handleGridSave() {
    setSavingGrid(true);
    try { await adminUpdateRevenueGrid(id, grid); setGridDialog(false); await load(); }
    catch (e) { showError(e.message); }
    finally { setSavingGrid(false); }
  }

  async function handleApprove(book) {
    setActionLoading(true);
    try {
      await adminApproveContent(book.id);
      const updated = { ...book, validation_status: 'approved' };
      setData(prev => ({ ...prev, books: prev.books.map(b => b.id === book.id ? updated : b) }));
      setBookDialog(updated);
    } catch (e) { showError(e.message); }
    finally { setActionLoading(false); }
  }

  async function handleReject(book) {
    if (!rejectReason.trim()) return;
    setActionLoading(true);
    try {
      await adminRejectContent(book.id, rejectReason);
      const updated = { ...book, validation_status: 'rejected' };
      setData(prev => ({ ...prev, books: prev.books.map(b => b.id === book.id ? updated : b) }));
      setBookDialog(updated);
      setRejectMode(false); setRejectReason('');
    } catch (e) { showError(e.message); }
    finally { setActionLoading(false); }
  }

  // ── Loading skeleton ──
  if (loading) {
    return (
      <Box sx={{ p: 4 }}>
        <Box sx={{ display: 'flex', gap: 2, mb: 4, alignItems: 'center' }}>
          <Skeleton variant="circular" width={40} height={40} />
          <Skeleton variant="circular" width={64} height={64} />
          <Box sx={{ flex: 1 }}>
            <Skeleton width="30%" height={36} sx={{ mb: 0.5 }} />
            <Skeleton width="20%" height={20} />
          </Box>
        </Box>
        <Grid container spacing={2.5} sx={{ mb: 4 }}>
          {[...Array(4)].map((_, i) => (
            <Grid key={i} size={{ xs: 6, md: 3 }}>
              <Card sx={{ borderRadius: '16px' }}>
                <CardContent sx={{ p: 2.5 }}>
                  <Skeleton variant="rounded" width={42} height={42} sx={{ mb: 1.5 }} />
                  <Skeleton width="60%" height={28} sx={{ mb: 0.5 }} />
                  <Skeleton width="45%" height={16} />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
        <Card sx={{ borderRadius: '16px' }}>
          <CardContent sx={{ p: 3 }}>
            {[...Array(5)].map((_, i) => <Skeleton key={i} height={44} sx={{ mb: 1, borderRadius: '8px' }} />)}
          </CardContent>
        </Card>
      </Box>
    );
  }

  if (error) return <Box sx={{ p: 4 }}><Alert severity="error" sx={{ borderRadius: '12px' }}>{error}</Alert></Box>;
  if (!data) return null;

  const { publisher, books = [], revenue, revenueByBook = [], payouts = [], nextPayoutDate } = data;
  const cfg = STATUS_CONFIG[publisher.status] || STATUS_CONFIG.pending;

  const approvedCount = books.filter(b => b.validation_status === 'approved').length;
  const pendingCount  = books.filter(b => b.validation_status === 'pending').length;
  const rejectedCount = books.filter(b => b.validation_status === 'rejected').length;

  const payoutMethod =
    publisher.payout_method?.type === 'bank_transfer' ? 'Virement bancaire' :
    publisher.payout_method?.type === 'mobile_money'  ? `Mobile Money · ${publisher.payout_method.operator || ''}` :
    publisher.payout_method?.type === 'paypal'        ? `PayPal · ${publisher.payout_method.email || ''}` : 'Non renseigné';

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, bgcolor: '#F7F6F3', minHeight: '100vh' }}>

      {/* ── Hero Header ── */}
      <Box sx={{
        bgcolor: '#fff', borderRadius: '20px', p: 3, mb: 3,
        boxShadow: '0 2px 14px rgba(0,0,0,0.06)',
        display: 'flex', alignItems: 'flex-start', gap: 2.5, flexWrap: 'wrap',
      }}>
        <IconButton onClick={() => navigate('/admin/publishers')}
          sx={{ bgcolor: '#F5F5F5', borderRadius: '10px', '&:hover': { bgcolor: '#EBEBEB' } }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>

        {/* Avatar */}
        <Avatar sx={{
          bgcolor: C.primary, width: 64, height: 64,
          fontSize: '1.6rem', fontWeight: 900, flexShrink: 0,
          boxShadow: `0 4px 14px ${C.primary}44`,
        }}>
          {publisher.company_name?.charAt(0).toUpperCase()}
        </Avatar>

        {/* Identity */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 0.5 }}>
            <Typography variant="h4" sx={{
              fontWeight: 900, color: C.indigo, fontFamily: 'Playfair Display, serif', lineHeight: 1.2,
            }}>
              {publisher.company_name}
            </Typography>
            <Chip label={cfg.label} size="small" sx={{
              bgcolor: cfg.bg, color: cfg.color, fontWeight: 800,
              border: `1.5px solid ${cfg.color}44`, fontSize: '12px',
            }} />
            {pendingCount > 0 && (
              <Chip label={`${pendingCount} en attente`} size="small" sx={{
                bgcolor: '#FFF3E0', color: C.orange, fontWeight: 700,
                border: `1.5px solid ${C.orange}44`, fontSize: '11px',
              }} />
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 2.5, flexWrap: 'wrap' }}>
            <Typography variant="body2" sx={{ color: '#888', display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <PersonOutlineIcon sx={{ fontSize: 15 }} />{publisher.contact_name || '—'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#888', display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <MailOutlineIcon sx={{ fontSize: 15 }} />{publisher.email}
            </Typography>
            <Typography variant="caption" sx={{ color: '#bbb', display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CalendarTodayOutlinedIcon sx={{ fontSize: 13 }} />
              Depuis le {new Date(publisher.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </Typography>
          </Box>
        </Box>

        {/* Actions */}
        <Box sx={{ display: 'flex', gap: 1, flexShrink: 0, flexWrap: 'wrap' }}>
          <Button variant="outlined" size="small" startIcon={<EditOutlinedIcon sx={{ fontSize: 16 }} />}
            onClick={() => setGridDialog(true)}
            sx={{ textTransform: 'none', borderRadius: '10px', fontWeight: 700,
              borderColor: '#ddd', color: '#555', '&:hover': { borderColor: C.primary, color: C.primary } }}>
            Grille
          </Button>
          <Button variant="contained" size="small" startIcon={<EditOutlinedIcon sx={{ fontSize: 16 }} />}
            onClick={() => setStatusDialog(true)}
            sx={{
              textTransform: 'none', borderRadius: '10px', fontWeight: 700,
              bgcolor: cfg.color, boxShadow: 'none',
              '&:hover': { bgcolor: cfg.color, filter: 'brightness(0.9)' },
            }}>
            Statut : {cfg.label}
          </Button>
        </Box>
      </Box>

      {/* ── Filtre période + Export ── */}
      <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', mb: 3, p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <DateRangeOutlinedIcon sx={{ color: C.primary, fontSize: 20, flexShrink: 0 }} />
          <Typography variant="body2" fontWeight={700} color={C.indigo} sx={{ mr: 0.5, flexShrink: 0 }}>
            Période :
          </Typography>

          {/* Preset chips */}
          {PRESETS.map(preset => (
            <Chip
              key={preset.label}
              label={preset.label}
              size="small"
              onClick={() => applyPreset(preset)}
              sx={{
                cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem',
                bgcolor: activePreset === preset.label ? C.primary : '#F0EDE8',
                color:   activePreset === preset.label ? '#fff' : '#666',
                border: 'none',
                '&:hover': { bgcolor: activePreset === preset.label ? C.primary : '#E8E3DC' },
              }}
            />
          ))}

          {/* Custom range */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 0.5 }}>
            <TextField
              type="date" size="small" value={activePreset === 'Tout' || !['Ce mois','3 mois','6 mois','Cette année'].includes(activePreset) ? periodFrom : resolvePreset(periodFrom, periodTo).from}
              onChange={e => { setActivePreset('Personnalisé'); setPeriodFrom(e.target.value); }}
              inputProps={{ max: periodTo || undefined }}
              sx={{ width: 150, '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: '0.8rem' } }}
              InputLabelProps={{ shrink: true }}
            />
            <Typography variant="body2" color="#aaa">→</Typography>
            <TextField
              type="date" size="small" value={activePreset === 'Tout' || !['Ce mois','3 mois','6 mois','Cette année'].includes(activePreset) ? periodTo : resolvePreset(periodFrom, periodTo).to}
              onChange={e => { setActivePreset('Personnalisé'); setPeriodTo(e.target.value); }}
              inputProps={{ min: periodFrom || undefined }}
              sx={{ width: 150, '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: '0.8rem' } }}
              InputLabelProps={{ shrink: true }}
            />
          </Box>

          <Box sx={{ flex: 1 }} />

          {/* Export buttons */}
          <Button
            variant="outlined" size="small"
            startIcon={exporting ? <CircularProgress size={14} color="inherit" /> : <DownloadIcon sx={{ fontSize: 16 }} />}
            onClick={() => handleExport('csv')} disabled={exporting || loading}
            sx={{ textTransform: 'none', borderRadius: '10px', fontWeight: 600, borderColor: C.green, color: C.green, '&:hover': { borderColor: C.green, bgcolor: `${C.green}08` } }}
          >
            CSV
          </Button>
          <Button
            variant="outlined" size="small"
            startIcon={exporting ? <CircularProgress size={14} color="inherit" /> : <DownloadIcon sx={{ fontSize: 16 }} />}
            onClick={() => handleExport('pdf')} disabled={exporting || loading}
            sx={{ textTransform: 'none', borderRadius: '10px', fontWeight: 600, borderColor: C.primary, color: C.primary, '&:hover': { borderColor: C.primary, bgcolor: `${C.primary}08` } }}
          >
            PDF
          </Button>
        </Box>
      </Card>

      {/* ── KPIs ── */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <KpiCard icon={<AccountBalanceWalletOutlinedIcon />} label="Solde à verser"
            value={`${revenue?.pending?.toFixed(2) ?? '0.00'} CAD`} color={C.orange} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <KpiCard icon={<TrendingUpOutlinedIcon />} label="Revenu total"
            value={`${revenue?.total?.toFixed(2) ?? '0.00'} CAD`}
            sub={`Dont ${revenue?.paid?.toFixed(2) ?? '0.00'} CAD versés`}
            color={C.primary} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <KpiCard icon={<MenuBookOutlinedIcon />} label="Livres approuvés"
            value={approvedCount}
            sub={`${books.length} soumis · ${pendingCount} en attente`}
            color={C.green} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <KpiCard icon={<CalendarTodayOutlinedIcon />} label="Prochain versement"
            value={nextPayoutDate ? new Date(nextPayoutDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '—'}
            sub="1er du mois prochain"
            color={C.purple} />
        </Grid>
      </Grid>

      {/* ── Infos + Grille de revenus ── */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Infos éditeur */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ borderRadius: '18px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: C.indigo, mb: 1 }}>
                Informations éditeur
              </Typography>
              <Divider sx={{ mb: 1.5 }} />
              <Grid container>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <InfoField icon={<MailOutlineIcon />} label="Email" value={publisher.email} />
                  <InfoField icon={<PersonOutlineIcon />} label="Responsable" value={publisher.contact_name} />
                  <InfoField icon={<PaymentOutlinedIcon />} label="Mode de paiement" value={payoutMethod} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <InfoField icon={<CalendarTodayOutlinedIcon />} label="Activé le"
                    value={publisher.activated_at
                      ? new Date(publisher.activated_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
                      : 'Pas encore activé'} />
                  <InfoField icon={<CalendarTodayOutlinedIcon />} label="Inscrit le"
                    value={new Date(publisher.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })} />
                  <InfoField icon={<MenuBookOutlinedIcon />} label="Catalogue"
                    value={`${approvedCount} approuvé · ${pendingCount} en attente · ${rejectedCount} rejeté`} />
                </Grid>
              </Grid>
              {publisher.description && (
                <Box sx={{ mt: 1.5, p: 2, bgcolor: '#FAFAFA', borderRadius: '12px' }}>
                  <Typography variant="caption" sx={{ color: '#9E9E9E', fontWeight: 700, textTransform: 'uppercase',
                    fontSize: '10px', letterSpacing: '0.5px', display: 'block', mb: 0.5 }}>
                    Description
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#555', lineHeight: 1.7 }}>
                    {publisher.description}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Grille de revenus */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ borderRadius: '18px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: C.indigo }}>
                  Grille de revenus
                </Typography>
                <Button size="small" startIcon={<EditOutlinedIcon sx={{ fontSize: 14 }} />}
                  onClick={() => setGridDialog(true)}
                  sx={{ textTransform: 'none', color: C.primary, fontWeight: 700, fontSize: '0.8rem',
                    '&:hover': { bgcolor: `${C.primary}10` } }}>
                  Modifier
                </Button>
              </Box>
              <Divider sx={{ mb: 2 }} />

              {/* Visual grid */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2.5 }}>
                {[
                  { label: 'Seuil de déclenchement', value: `${publisher.revenue_grid?.threshold_cad ?? 5} CAD`, color: C.indigo, icon: '⚖️' },
                  { label: `Part éditeur si prix > seuil`, value: `${publisher.revenue_grid?.above_threshold_cad ?? 5} CAD`, color: C.green, icon: '📈' },
                  { label: `Part éditeur si prix ≤ seuil`, value: `${publisher.revenue_grid?.below_threshold_cad ?? 2.5} CAD`, color: C.orange, icon: '📉' },
                ].map(({ label, value, color, icon }) => (
                  <Box key={label} sx={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    p: 1.5, bgcolor: `${color}0C`, borderRadius: '12px',
                    border: `1px solid ${color}22`,
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ fontSize: '1rem' }}>{icon}</Typography>
                      <Typography variant="body2" sx={{ color: '#555', fontSize: '0.82rem' }}>{label}</Typography>
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 900, color, fontSize: '1rem' }}>{value}</Typography>
                  </Box>
                ))}
              </Box>

              <Divider sx={{ mb: 2 }} />

              {/* Revenue summary */}
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                {[
                  { label: 'Total généré', value: `${revenue?.total?.toFixed(2) ?? '0.00'}`, color: C.indigo },
                  { label: 'Versé', value: `${revenue?.paid?.toFixed(2) ?? '0.00'}`, color: C.green },
                  { label: 'En attente', value: `${revenue?.pending?.toFixed(2) ?? '0.00'}`, color: C.orange },
                  { label: 'Versements', value: payouts.length, color: C.blue },
                ].map(({ label, value, color }) => (
                  <Box key={label} sx={{ bgcolor: '#FAFAFA', borderRadius: '10px', p: 1.5, textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ fontWeight: 900, color, fontSize: '1.1rem' }}>{value}</Typography>
                    <Typography variant="caption" sx={{ color: '#aaa', display: 'block', fontWeight: 600 }}>{label}</Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── Tabs ── */}
      <Card sx={{ borderRadius: '18px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <Box sx={{ borderBottom: '1px solid #F0F0F0', px: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)}
            TabIndicatorProps={{ style: { backgroundColor: C.primary } }}
            sx={{ minHeight: 48 }}>
            {[
              `Catalogue (${books.length})`,
              `Revenus par livre`,
              `Versements (${payouts.length})`,
            ].map((label, i) => (
              <Tab key={i} label={label} sx={{
                textTransform: 'none', fontWeight: 700, fontSize: '0.88rem', minHeight: 48, px: 2,
                color: tab === i ? C.primary : '#888',
                '&.Mui-selected': { color: C.primary },
              }} />
            ))}
          </Tabs>
          {tab === 0 && (
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon sx={{ fontSize: 16 }} />}
              onClick={() => navigate(`/admin/publishers/${id}/create-content`)}
              sx={{
                textTransform: 'none', borderRadius: '10px', fontWeight: 700,
                bgcolor: C.primary, boxShadow: 'none', mr: 1,
                '&:hover': { bgcolor: C.primary, filter: 'brightness(0.9)' },
              }}
            >
              Ajouter un contenu
            </Button>
          )}
        </Box>

        {/* ── Tab 0 : Catalogue ── */}
        {tab === 0 && (
          books.length === 0 ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <MenuBookOutlinedIcon sx={{ fontSize: 48, color: '#E0E0E0', mb: 1 }} />
              <Typography variant="body2" sx={{ color: '#BDBDBD', fontWeight: 600 }}>Aucun livre soumis</Typography>
            </Box>
          ) : (
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#FAFAFA' }}>
                  {['Livre', 'Type', 'Statut', 'Soumis le', ''].map(h => (
                    <TableCell key={h} sx={{ fontWeight: 700, color: '#9E9E9E', fontSize: '11px',
                      textTransform: 'uppercase', letterSpacing: '0.5px',
                      border: 0, py: 1.5, pl: h === 'Livre' ? 3 : undefined }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {books.map((book) => {
                  const content = book.contents || book;
                  const vc = V_CONFIG[book.validation_status] || V_CONFIG.pending;
                  return (
                    <TableRow key={book.id} hover
                      onClick={() => navigate(`/admin/publishers/${id}/books/${book.id}`)}
                      sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#FFF8F0' } }}>
                      <TableCell sx={{ border: 0, py: 1.5, pl: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <BookCover url={content.cover_url} />
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>{content.title || '—'}</Typography>
                            <Typography variant="caption" sx={{ color: '#9E9E9E' }}>{content.author}</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ border: 0, py: 1.5 }}>
                        <Chip
                          label={content.content_type === 'audio' ? 'Audio' : content.content_type === 'both' ? 'Ebook+Audio' : 'Ebook'}
                          size="small"
                          sx={{ bgcolor: '#F0EDE8', color: '#5D4037', fontWeight: 700, fontSize: '11px', height: 22 }} />
                      </TableCell>
                      <TableCell sx={{ border: 0, py: 1.5 }}>
                        <Chip label={vc.label} size="small"
                          sx={{ bgcolor: vc.bg, color: vc.color, fontWeight: 700, fontSize: '11px', height: 22 }} />
                      </TableCell>
                      <TableCell sx={{ border: 0, py: 1.5 }}>
                        <Typography variant="caption" sx={{ color: '#9E9E9E' }}>
                          {book.submitted_at ? new Date(book.submitted_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ border: 0, py: 1.5, pr: 2, textAlign: 'right' }}>
                        {book.validation_status === 'pending' && (
                          <PendingActionsOutlinedIcon sx={{ fontSize: 18, color: C.orange, verticalAlign: 'middle' }} />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )
        )}

        {/* ── Tab 1 : Revenus par livre ── */}
        {tab === 1 && (
          revenueByBook.length === 0 ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <TrendingUpOutlinedIcon sx={{ fontSize: 48, color: '#E0E0E0', mb: 1 }} />
              <Typography variant="body2" sx={{ color: '#BDBDBD', fontWeight: 600 }}>Aucune vente enregistrée</Typography>
            </Box>
          ) : (
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#FAFAFA' }}>
                  {['Livre', 'Ventes', 'Revenus normaux', 'Bonus', 'Total'].map((h, i) => (
                    <TableCell key={h} align={i === 0 ? 'left' : 'right'}
                      sx={{ fontWeight: 700, color: '#9E9E9E', fontSize: '11px', textTransform: 'uppercase',
                        letterSpacing: '0.5px', border: 0, py: 1.5, pl: i === 0 ? 3 : undefined, pr: i === 4 ? 3 : undefined }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {revenueByBook.map((row, i) => (
                  <TableRow key={row.content?.id || i} hover sx={{ '&:hover': { bgcolor: '#FAFAFA' } }}>
                    <TableCell sx={{ border: 0, py: 1.5, pl: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <BookCover url={row.content?.cover_url} w={28} h={38} />
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>{row.content?.title || '—'}</Typography>
                          <Typography variant="caption" sx={{ color: '#9E9E9E' }}>{row.content?.author}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell align="right" sx={{ border: 0, py: 1.5 }}>
                      <Chip label={row.sales} size="small"
                        sx={{ bgcolor: '#E3F2FD', color: C.blue, fontWeight: 800, fontSize: '12px', height: 22 }} />
                    </TableCell>
                    <TableCell align="right" sx={{ border: 0, py: 1.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: C.primary }}>
                        {row.normal.toFixed(2)} <Typography component="span" variant="caption" sx={{ color: '#aaa' }}>CAD</Typography>
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ border: 0, py: 1.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: C.or }}>
                        {row.bonus.toFixed(2)} <Typography component="span" variant="caption" sx={{ color: '#aaa' }}>CAD</Typography>
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ border: 0, py: 1.5, pr: 3 }}>
                      <Typography variant="body2" sx={{ fontWeight: 900, color: C.indigo, fontSize: '1rem' }}>
                        {row.total.toFixed(2)} <Typography component="span" variant="caption" sx={{ color: '#aaa' }}>CAD</Typography>
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
                {/* Total row */}
                <TableRow sx={{ bgcolor: '#FAFAFA', borderTop: '2px solid #F0F0F0' }}>
                  <TableCell sx={{ border: 0, py: 1.5, pl: 3 }}>
                    <Typography variant="body2" sx={{ fontWeight: 800, color: C.indigo }}>Total</Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ border: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 800 }}>
                      {revenueByBook.reduce((s, r) => s + r.sales, 0)} ventes
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ border: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 800, color: C.primary }}>
                      {revenueByBook.reduce((s, r) => s + r.normal, 0).toFixed(2)} CAD
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ border: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 800, color: C.or }}>
                      {revenueByBook.reduce((s, r) => s + r.bonus, 0).toFixed(2)} CAD
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ border: 0, pr: 3 }}>
                    <Typography variant="body2" sx={{ fontWeight: 900, color: C.indigo, fontSize: '1rem' }}>
                      {revenueByBook.reduce((s, r) => s + r.total, 0).toFixed(2)} CAD
                    </Typography>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )
        )}

        {/* ── Tab 2 : Versements ── */}
        {tab === 2 && (
          payouts.length === 0 ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <AccountBalanceWalletOutlinedIcon sx={{ fontSize: 48, color: '#E0E0E0', mb: 1 }} />
              <Typography variant="body2" sx={{ color: '#BDBDBD', fontWeight: 600 }}>Aucun versement effectué</Typography>
              {revenue?.pending > 0 && (
                <Typography variant="caption" sx={{ color: C.orange, display: 'block', mt: 0.5, fontWeight: 700 }}>
                  {revenue.pending.toFixed(2)} CAD en attente de versement
                </Typography>
              )}
            </Box>
          ) : (
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#FAFAFA' }}>
                  {['Période', 'Montant', 'Statut', 'Payé le', 'Notes'].map((h, i) => (
                    <TableCell key={h}
                      align={h === 'Montant' ? 'right' : 'left'}
                      sx={{ fontWeight: 700, color: '#9E9E9E', fontSize: '11px', textTransform: 'uppercase',
                        letterSpacing: '0.5px', border: 0, py: 1.5,
                        pl: i === 0 ? 3 : undefined, pr: i === 4 ? 3 : undefined }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {payouts.map((p) => {
                  const ps = PAYOUT_STATUS[p.status] || PAYOUT_STATUS.pending;
                  return (
                    <TableRow key={p.id} hover sx={{ '&:hover': { bgcolor: '#FAFAFA' } }}>
                      <TableCell sx={{ border: 0, py: 1.5, pl: 3 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: C.indigo }}>
                          {p.period_start ? new Date(p.period_start).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }) : '—'}
                          {' → '}
                          {p.period_end ? new Date(p.period_end).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }) : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ border: 0, py: 1.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 900, color: C.primary, fontSize: '1rem' }}>
                          {Number(p.amount_cad).toFixed(2)} <Typography component="span" variant="caption" sx={{ color: '#aaa' }}>CAD</Typography>
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ border: 0, py: 1.5 }}>
                        <Chip label={ps.label} size="small"
                          sx={{ bgcolor: ps.bg, color: ps.color, fontWeight: 700, fontSize: '11px', height: 22 }} />
                      </TableCell>
                      <TableCell sx={{ border: 0, py: 1.5 }}>
                        <Typography variant="caption" sx={{ color: '#9E9E9E' }}>
                          {p.paid_at ? new Date(p.paid_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ border: 0, py: 1.5, pr: 3 }}>
                        <Typography variant="caption" sx={{ color: '#9E9E9E' }}>{p.notes || '—'}</Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )
        )}
      </Card>

      {/* ── Dialog : Changer statut ── */}
      <Dialog open={statusDialog} onClose={() => setStatusDialog(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: '18px' } }}>
        <DialogTitle sx={{ fontWeight: 800, color: C.indigo }}>Changer le statut</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#888', mb: 2 }}>
            Le statut actuel est <strong style={{ color: cfg.color }}>{cfg.label}</strong>.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <Box key={k} onClick={() => setNewStatus(k)}
                sx={{
                  p: 1.5, borderRadius: '12px', cursor: 'pointer',
                  border: `2px solid ${newStatus === k ? v.color : '#eee'}`,
                  bgcolor: newStatus === k ? `${v.color}0D` : '#fff',
                  display: 'flex', alignItems: 'center', gap: 1.5,
                  transition: 'all 0.12s',
                }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: v.color, flexShrink: 0 }} />
                <Typography variant="body2" sx={{ fontWeight: newStatus === k ? 800 : 600, color: newStatus === k ? v.color : '#555' }}>
                  {v.label}
                </Typography>
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button onClick={() => setStatusDialog(false)} sx={{ textTransform: 'none', color: '#888' }}>Annuler</Button>
          <Button variant="contained" onClick={handleStatusSave} disabled={savingStatus}
            startIcon={savingStatus ? <CircularProgress size={14} color="inherit" /> : null}
            sx={{ bgcolor: C.primary, borderRadius: '10px', textTransform: 'none', fontWeight: 700,
              boxShadow: 'none', '&:hover': { bgcolor: '#8B4513' } }}>
            Appliquer
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Dialog : Grille de revenus ── */}
      <Dialog open={gridDialog} onClose={() => setGridDialog(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: '18px' } }}>
        <DialogTitle sx={{ fontWeight: 800, color: C.indigo }}>Modifier la grille de revenus</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#888', mb: 2.5 }}>
            Ces montants définissent la part en CAD versée à l'éditeur selon le prix de vente du livre.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[
              { key: 'threshold_cad', label: '⚖️  Seuil de prix (CAD)', help: 'Prix à partir duquel la part supérieure s\'applique' },
              { key: 'above_threshold_cad', label: '📈  Part si prix > seuil (CAD)', help: 'Part versée pour un livre au prix au-dessus du seuil' },
              { key: 'below_threshold_cad', label: '📉  Part si prix ≤ seuil (CAD)', help: 'Part versée pour un livre au prix en-dessous du seuil' },
            ].map(({ key, label, help }) => (
              <Box key={key}>
                <TextField label={label} type="number" value={grid[key]}
                  onChange={e => setGrid(g => ({ ...g, [key]: +e.target.value }))}
                  fullWidth size="small"
                  helperText={help}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button onClick={() => setGridDialog(false)} sx={{ textTransform: 'none', color: '#888' }}>Annuler</Button>
          <Button variant="contained" onClick={handleGridSave} disabled={savingGrid}
            startIcon={savingGrid ? <CircularProgress size={14} color="inherit" /> : null}
            sx={{ bgcolor: C.primary, borderRadius: '10px', textTransform: 'none', fontWeight: 700,
              boxShadow: 'none', '&:hover': { bgcolor: '#8B4513' } }}>
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Dialog : Détail livre ── */}
      {bookDialog && (() => {
        const bc = bookDialog.contents || bookDialog;
        const vc = V_CONFIG[bookDialog.validation_status] || V_CONFIG.pending;
        return (
          <Dialog open onClose={() => { setBookDialog(null); setRejectMode(false); setRejectReason(''); }}
            maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '18px' } }}>
            <DialogTitle sx={{ pb: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <BookCover url={bc.cover_url} w={48} h={64} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 900, lineHeight: 1.2, color: C.indigo }}>
                    {bc.title || '—'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#9E9E9E' }}>{bc.author}</Typography>
                </Box>
                <Chip label={vc.label} size="small"
                  sx={{ bgcolor: vc.bg, color: vc.color, fontWeight: 800, border: `1.5px solid ${vc.color}44` }} />
              </Box>
            </DialogTitle>

            <DialogContent dividers>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 2 }}>
                {[
                  { label: 'Type', value: bc.content_type === 'audio' ? 'Audio' : bc.content_type === 'both' ? 'Ebook + Audio' : 'Ebook' },
                  { label: 'Soumis le', value: bookDialog.submitted_at ? new Date(bookDialog.submitted_at).toLocaleDateString('fr-FR') : '—' },
                  { label: 'Langue', value: bc.language || '—' },
                  { label: 'ISBN', value: bc.isbn || '—' },
                ].map(({ label, value }) => (
                  <Box key={label} sx={{ bgcolor: '#FAFAFA', borderRadius: '10px', p: 1.5 }}>
                    <Typography variant="caption" sx={{ color: '#9E9E9E', display: 'block', fontWeight: 700,
                      textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.5px' }}>{label}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, mt: 0.3 }}>{value}</Typography>
                  </Box>
                ))}
              </Box>

              {bc.description && (
                <Box sx={{ mb: 2, p: 1.5, bgcolor: '#FAFAFA', borderRadius: '10px' }}>
                  <Typography variant="caption" sx={{ color: '#9E9E9E', fontWeight: 700,
                    textTransform: 'uppercase', fontSize: '10px', display: 'block', mb: 0.5 }}>
                    Description
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#555', lineHeight: 1.7 }}>{bc.description}</Typography>
                </Box>
              )}

              {rejectMode && (
                <TextField label="Motif de rejet *" value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  fullWidth multiline rows={3} autoFocus
                  placeholder="Ex: Le fichier EPUB contient des erreurs de formatage..."
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
              )}
            </DialogContent>

            <DialogActions sx={{ p: 2.5, gap: 1 }}>
              <Button onClick={() => { setBookDialog(null); setRejectMode(false); setRejectReason(''); }}
                sx={{ textTransform: 'none', color: '#888' }}>Fermer</Button>
              {bookDialog.validation_status === 'pending' && !rejectMode && (
                <>
                  <Button variant="outlined" startIcon={<CancelOutlinedIcon />}
                    onClick={() => setRejectMode(true)}
                    sx={{ textTransform: 'none', fontWeight: 700, color: C.red, borderColor: C.red,
                      borderRadius: '10px', '&:hover': { bgcolor: '#FFEBEE' } }}>
                    Rejeter
                  </Button>
                  <Button variant="contained"
                    startIcon={actionLoading ? <CircularProgress size={14} color="inherit" /> : <CheckCircleOutlineIcon />}
                    onClick={() => handleApprove(bookDialog)} disabled={actionLoading}
                    sx={{ textTransform: 'none', fontWeight: 700, bgcolor: C.green, borderRadius: '10px',
                      boxShadow: 'none', '&:hover': { bgcolor: '#1e8449' } }}>
                    Approuver
                  </Button>
                </>
              )}
              {rejectMode && (
                <>
                  <Button onClick={() => setRejectMode(false)} sx={{ textTransform: 'none', color: '#888' }}>Annuler</Button>
                  <Button variant="contained"
                    startIcon={actionLoading ? <CircularProgress size={14} color="inherit" /> : <CancelOutlinedIcon />}
                    onClick={() => handleReject(bookDialog)} disabled={actionLoading || !rejectReason.trim()}
                    sx={{ textTransform: 'none', fontWeight: 700, bgcolor: C.red, borderRadius: '10px',
                      boxShadow: 'none', '&:hover': { bgcolor: '#c0392b' } }}>
                    Confirmer le rejet
                  </Button>
                </>
              )}
            </DialogActions>
          </Dialog>
        );
      })()}

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.severity} onClose={() => setSnack(s => ({ ...s, open: false }))} sx={{ borderRadius: '10px' }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
