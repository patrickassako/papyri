/**
 * AdminSubscriptionsPage
 * Route: /admin/subscriptions
 * Tabs: Métriques | Plans | Abonnés
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Chip, Button, IconButton,
  Table, TableHead, TableBody, TableRow, TableCell, Avatar,
  Tabs, Tab, TextField, InputAdornment, Select, MenuItem, FormControl,
  Skeleton, Alert, Pagination, Tooltip, Divider, Switch,
  Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress,
  LinearProgress, Drawer,
} from '@mui/material';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import PeopleIcon from '@mui/icons-material/People';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DownloadIcon from '@mui/icons-material/Download';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import SortIcon from '@mui/icons-material/Sort';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import EuroIcon from '@mui/icons-material/Euro';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { authFetch } from '../../services/auth.service';
import tokens from '../../config/tokens';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminSection from '../../components/admin/AdminSection';
import AdminEmptyState from '../../components/admin/AdminEmptyState';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const C = {
  terre: tokens.colors.primary, indigo: tokens.colors.accent, green: '#27ae60',
  red: '#e74c3c', orange: '#FF9800', grey: '#8c8c8c',
  purple: '#7B5EA7', lightGrey: '#f0f0f0',
  textPrimary: '#1a1a2e', textSecondary: '#6b7280', bg: '#F7F6F3',
};

const STATUS_CFG = {
  ACTIVE:    { label: 'Actif',     color: C.green  },
  EXPIRED:   { label: 'Expiré',    color: C.grey   },
  CANCELLED: { label: 'Résilié',   color: C.red    },
  INACTIVE:  { label: 'Inactif',   color: C.orange },
};

function fmtPrice(cents, currency = 'EUR') {
  if (!cents && cents !== 0) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(cents / 100);
}
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtMonthLabel(key) {
  const [y, m] = key.split('-');
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
}

// ── Stat Card ─────────────────────────────────────────────────
function StatCard({ icon, label, value, color = C.indigo, sub, loading, onClick }) {
  return (
    <Card
      onClick={onClick}
      sx={{
        borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', height: '100%',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.15s, box-shadow 0.15s',
        ...(onClick && { '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(0,0,0,0.12)' } }),
      }}
    >
      <CardContent sx={{ p: 2.5, position: 'relative' }}>
        <Box sx={{ width: 40, height: 40, borderRadius: '12px', bgcolor: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1.5 }}>
          {React.cloneElement(icon, { sx: { color, fontSize: 22 } })}
        </Box>
        {loading ? (
          <><Skeleton width={70} height={32} /><Skeleton width={100} height={16} /></>
        ) : (
          <>
            <Typography variant="h5" fontWeight={800} color={C.textPrimary} lineHeight={1}>{value ?? '—'}</Typography>
            <Typography variant="caption" color={C.textSecondary} fontWeight={500} display="block" sx={{ mt: 0.5 }}>{label}</Typography>
            {sub && <Typography variant="caption" color={color} display="block" sx={{ mt: 0.25, fontWeight: 600 }}>{sub}</Typography>}
          </>
        )}
        {onClick && !loading && (
          <ChevronRightIcon sx={{ position: 'absolute', bottom: 10, right: 10, fontSize: 16, color: `${color}80` }} />
        )}
      </CardContent>
    </Card>
  );
}

// ── Mini bar chart (revenue by month) ────────────────────────
function RevenueChart({ data, loading }) {
  if (loading) return <Skeleton variant="rounded" height={120} sx={{ borderRadius: '12px' }} />;
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.revenue), 1);

  return (
    <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', p: 2.5 }}>
      <Typography variant="subtitle2" fontWeight={700} color={C.textPrimary} sx={{ mb: 2 }}>
        Revenus — 6 derniers mois
      </Typography>
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-end', height: 100 }}>
        {data.map(d => (
          <Box key={d.month} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="caption" color={C.textSecondary} sx={{ fontSize: '0.6rem' }}>
              {d.revenue > 0 ? `${d.revenue.toFixed(0)}€` : ''}
            </Typography>
            <Box
              sx={{
                width: '100%',
                height: Math.max(4, (d.revenue / max) * 80),
                bgcolor: d.revenue > 0 ? C.indigo : C.lightGrey,
                borderRadius: '4px 4px 0 0',
                transition: 'height 0.4s',
              }}
            />
            <Typography variant="caption" color={C.textSecondary} sx={{ fontSize: '0.62rem' }}>
              {fmtMonthLabel(d.month)}
            </Typography>
          </Box>
        ))}
      </Box>
    </Card>
  );
}

// ── Plan Card ─────────────────────────────────────────────────
function PlanCard({ plan, onEdit, onToggle }) {
  return (
    <Card
      sx={{
        borderRadius: '16px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        border: plan.is_active ? `2px solid ${C.indigo}20` : `2px solid ${C.grey}30`,
        opacity: plan.is_active ? 1 : 0.65,
        transition: 'all 0.2s',
        height: '100%',
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={800} color={C.textPrimary}>{plan.display_name}</Typography>
            <Typography variant="caption" color={C.textSecondary}>{plan.slug}</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Modifier">
              <IconButton size="small" onClick={() => onEdit(plan)} sx={{ color: C.indigo }}>
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={plan.is_active ? 'Désactiver' : 'Activer'}>
              <Switch
                checked={plan.is_active}
                onChange={() => onToggle(plan)}
                size="small"
                sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: C.green }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: C.green } }}
              />
            </Tooltip>
          </Box>
        </Box>

        {/* Price */}
        <Typography variant="h4" fontWeight={900} color={C.indigo} lineHeight={1} sx={{ mb: 0.25 }}>
          {fmtPrice(plan.base_price_cents, plan.currency)}
        </Typography>
        <Typography variant="caption" color={C.textSecondary} sx={{ mb: 2, display: 'block' }}>
          / {plan.duration_days} jours
        </Typography>

        <Divider sx={{ mb: 1.5 }} />

        {/* Stats */}
        <Grid container spacing={1} sx={{ mb: 1.5 }}>
          <Grid size={6}>
            <Typography variant="caption" color={C.textSecondary} display="block">Abonnés actifs</Typography>
            <Typography variant="body2" fontWeight={800} color={C.green}>{plan.activeSubscribers}</Typography>
          </Grid>
          <Grid size={6}>
            <Typography variant="caption" color={C.textSecondary} display="block">Total historique</Typography>
            <Typography variant="body2" fontWeight={700} color={C.textPrimary}>{plan.totalSubscribers}</Typography>
          </Grid>
          {plan.text_quota_per_user > 0 && (
            <Grid size={6}>
              <Typography variant="caption" color={C.textSecondary} display="block">Quota ebook</Typography>
              <Typography variant="body2" fontWeight={600}>{plan.text_quota_per_user}</Typography>
            </Grid>
          )}
          {plan.audio_quota_per_user > 0 && (
            <Grid size={6}>
              <Typography variant="caption" color={C.textSecondary} display="block">Quota audio</Typography>
              <Typography variant="body2" fontWeight={600}>{plan.audio_quota_per_user}</Typography>
            </Grid>
          )}
        </Grid>

        {/* Progress bar: active / total */}
        {plan.totalSubscribers > 0 && (
          <Box>
            <LinearProgress
              variant="determinate"
              value={Math.round((plan.activeSubscribers / plan.totalSubscribers) * 100)}
              sx={{ height: 5, borderRadius: 3, bgcolor: `${C.green}20`, '& .MuiLinearProgress-bar': { bgcolor: C.green, borderRadius: 3 } }}
            />
            <Typography variant="caption" color={C.textSecondary} sx={{ mt: 0.5, display: 'block', fontSize: '0.65rem' }}>
              {Math.round((plan.activeSubscribers / plan.totalSubscribers) * 100)}% actifs
            </Typography>
          </Box>
        )}

        {plan.description && (
          <Typography variant="caption" color={C.textSecondary} sx={{ mt: 1.5, display: 'block', fontStyle: 'italic', lineHeight: 1.5 }}>
            {plan.description}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

// ── Plan Form Dialog ──────────────────────────────────────────
const EMPTY_FORM = {
  slug: '', display_name: '', description: '',
  base_price_cents: '', currency: 'EUR', duration_days: '30',
  included_users: '1', text_quota_per_user: '0', audio_quota_per_user: '0',
  is_active: true,
};

function PlanDialog({ open, plan, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const isEdit = !!plan?.id;

  useEffect(() => {
    if (plan) {
      setForm({
        slug:                plan.slug || '',
        display_name:        plan.display_name || '',
        description:         plan.description || '',
        base_price_cents:    plan.base_price_cents || '',
        currency:            plan.currency || 'EUR',
        duration_days:       plan.duration_days || '30',
        included_users:      plan.included_users || '1',
        text_quota_per_user: plan.text_quota_per_user || '0',
        audio_quota_per_user:plan.audio_quota_per_user || '0',
        is_active:           plan.is_active !== false,
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setError(null);
  }, [plan, open]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSave() {
    setSaving(true); setError(null);
    try {
      const url = isEdit
        ? `${API}/api/admin/subscriptions-module/plans/${plan.id}`
        : `${API}/api/admin/subscriptions-module/plans`;
      const res = await authFetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onSaved(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const inputSx = { '& .MuiOutlinedInput-root': { borderRadius: '10px' } };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '20px' } }}>
      <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
        {isEdit ? `Modifier — ${plan?.display_name}` : 'Nouveau plan d\'abonnement'}
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        {error && <Alert severity="error" sx={{ borderRadius: '10px' }}>{error}</Alert>}

        <Grid container spacing={2}>
          <Grid size={8}>
            <TextField label="Nom affiché *" size="small" fullWidth sx={inputSx}
              value={form.display_name} onChange={e => set('display_name', e.target.value)} />
          </Grid>
          <Grid size={4}>
            <TextField label="Slug *" size="small" fullWidth sx={inputSx}
              value={form.slug} onChange={e => set('slug', e.target.value.toLowerCase().replace(/\s+/g, '-'))}
              disabled={isEdit} helperText={isEdit ? 'Non modifiable' : ''} />
          </Grid>
          <Grid size={5}>
            <TextField label="Prix (centimes) *" size="small" fullWidth sx={inputSx} type="number"
              value={form.base_price_cents} onChange={e => set('base_price_cents', e.target.value)}
              helperText={form.base_price_cents ? `= ${(parseInt(form.base_price_cents) / 100).toFixed(2)} ${form.currency}` : ''} />
          </Grid>
          <Grid size={3}>
            <FormControl size="small" fullWidth sx={inputSx}>
              <Select value={form.currency} onChange={e => set('currency', e.target.value)}>
                {['EUR', 'USD', 'XAF', 'GBP'].map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={4}>
            <TextField label="Durée (jours) *" size="small" fullWidth sx={inputSx} type="number"
              value={form.duration_days} onChange={e => set('duration_days', e.target.value)}
              helperText={form.duration_days == 30 ? '≈ 1 mois' : form.duration_days == 365 ? '≈ 1 an' : ''} />
          </Grid>
          <Grid size={4}>
            <TextField label="Quota ebook / user" size="small" fullWidth sx={inputSx} type="number"
              value={form.text_quota_per_user} onChange={e => set('text_quota_per_user', e.target.value)} />
          </Grid>
          <Grid size={4}>
            <TextField label="Quota audio / user" size="small" fullWidth sx={inputSx} type="number"
              value={form.audio_quota_per_user} onChange={e => set('audio_quota_per_user', e.target.value)} />
          </Grid>
          <Grid size={4}>
            <TextField label="Utilisateurs inclus" size="small" fullWidth sx={inputSx} type="number"
              value={form.included_users} onChange={e => set('included_users', e.target.value)} />
          </Grid>
          <Grid size={8}>
            <TextField label="Description (optionnelle)" size="small" fullWidth sx={inputSx} multiline rows={2}
              value={form.description} onChange={e => set('description', e.target.value)} />
          </Grid>
          <Grid size={4}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
              <Switch checked={form.is_active} onChange={e => set('is_active', e.target.checked)}
                sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: C.green }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: C.green } }} />
              <Typography variant="body2" color={form.is_active ? C.green : C.grey} fontWeight={600}>
                {form.is_active ? 'Actif' : 'Inactif'}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none', color: C.textSecondary }}>Annuler</Button>
        <Button
          onClick={handleSave} disabled={saving} variant="contained"
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '10px', bgcolor: C.indigo, '&:hover': { bgcolor: '#1a2d47' } }}
        >
          {saving ? 'Enregistrement…' : isEdit ? 'Mettre à jour' : 'Créer le plan'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Subscriber Detail Drawer ──────────────────────────────────
function SubscriberDetailDrawer({ sub, open, onClose }) {
  if (!sub) return null;
  const statusCfg = STATUS_CFG[sub.status] || { label: sub.status, color: C.grey };

  function DetailRow({ label, children }) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', py: 1.25, borderBottom: '1px solid #f0eee9' }}>
        <Typography variant="caption" color={C.textSecondary} fontWeight={600} sx={{ minWidth: 120 }}>{label}</Typography>
        <Box sx={{ textAlign: 'right' }}>{children}</Box>
      </Box>
    );
  }

  const initials = sub.user?.full_name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: '100vw', sm: 420 }, bgcolor: C.bg } }}>
      {/* Header */}
      <Box sx={{ bgcolor: C.indigo, p: 3, color: '#fff', position: 'relative' }}>
        <IconButton onClick={onClose} size="small" sx={{ position: 'absolute', top: 12, right: 12, color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.1)' } }}>
          <CloseIcon fontSize="small" />
        </IconButton>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mt: 1 }}>
          <Avatar src={sub.user?.avatar_url || undefined}
            sx={{ width: 56, height: 56, fontSize: '1.2rem', bgcolor: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 800 }}>
            {initials}
          </Avatar>
          <Box>
            <Typography variant="h6" fontWeight={800} lineHeight={1.2}>{sub.user?.full_name || 'Inconnu'}</Typography>
            <Typography variant="body2" sx={{ opacity: 0.75, mt: 0.25 }}>{sub.user?.email}</Typography>
            <Chip
              label={statusCfg.label} size="small"
              sx={{ mt: 1, bgcolor: `${statusCfg.color}30`, color: '#fff', fontWeight: 700, fontSize: '0.7rem', height: 22 }}
            />
          </Box>
        </Box>
      </Box>

      <Box sx={{ p: 2.5, overflowY: 'auto' }}>

        {/* Abonnement */}
        <Typography variant="overline" color={C.textSecondary} fontWeight={700} sx={{ letterSpacing: 1, fontSize: '0.68rem' }}>
          Abonnement
        </Typography>
        <Card sx={{ borderRadius: '14px', boxShadow: 'none', border: '1px solid #ece8e0', mt: 1, mb: 2.5 }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <DetailRow label="Plan">
              <Typography variant="body2" fontWeight={700} color={C.textPrimary}>{sub.plan?.display_name || '—'}</Typography>
              {sub.plan?.slug && <Typography variant="caption" color={C.textSecondary}>{sub.plan.slug}</Typography>}
            </DetailRow>
            <DetailRow label="Montant">
              <Typography variant="body2" fontWeight={800} color={C.indigo}>{sub.amount} {sub.currency}</Typography>
            </DetailRow>
            <DetailRow label="Statut">
              <Chip label={statusCfg.label} size="small"
                sx={{ bgcolor: `${statusCfg.color}15`, color: statusCfg.color, fontWeight: 700, fontSize: '0.7rem', height: 22 }} />
            </DetailRow>
            <DetailRow label="Provider">
              <Typography variant="body2" fontWeight={600} sx={{ textTransform: 'capitalize' }}>{sub.provider || '—'}</Typography>
            </DetailRow>
          </CardContent>
        </Card>

        {/* Période */}
        <Typography variant="overline" color={C.textSecondary} fontWeight={700} sx={{ letterSpacing: 1, fontSize: '0.68rem' }}>
          Période
        </Typography>
        <Card sx={{ borderRadius: '14px', boxShadow: 'none', border: '1px solid #ece8e0', mt: 1, mb: 2.5 }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <DetailRow label="Début">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'flex-end' }}>
                <CalendarTodayOutlinedIcon sx={{ fontSize: 13, color: C.textSecondary }} />
                <Typography variant="body2">{fmtDate(sub.current_period_start)}</Typography>
              </Box>
            </DetailRow>
            <DetailRow label="Fin">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'flex-end' }}>
                <CalendarTodayOutlinedIcon sx={{ fontSize: 13, color: C.textSecondary }} />
                <Typography variant="body2" fontWeight={600}>{fmtDate(sub.current_period_end)}</Typography>
              </Box>
            </DetailRow>
            <DetailRow label="Souscrit le">
              <Typography variant="body2" color={C.textSecondary}>{fmtDate(sub.created_at)}</Typography>
            </DetailRow>
            {sub.cancel_at_period_end && (
              <Box sx={{ mt: 1.5, p: 1.5, bgcolor: `${C.orange}12`, borderRadius: '10px', display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <WarningAmberOutlinedIcon sx={{ color: C.orange, fontSize: 18, mt: 0.1 }} />
                <Typography variant="caption" color={C.orange} fontWeight={600}>
                  Résiliation prévue à la fin de la période en cours
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* IDs */}
        <Typography variant="overline" color={C.textSecondary} fontWeight={700} sx={{ letterSpacing: 1, fontSize: '0.68rem' }}>
          Référence
        </Typography>
        <Card sx={{ borderRadius: '14px', boxShadow: 'none', border: '1px solid #ece8e0', mt: 1 }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <DetailRow label="ID abonnement">
              <Typography variant="caption" color={C.textSecondary} sx={{ fontFamily: 'monospace', fontSize: '0.65rem', wordBreak: 'break-all' }}>
                {sub.id}
              </Typography>
            </DetailRow>
            <DetailRow label="ID utilisateur">
              <Typography variant="caption" color={C.textSecondary} sx={{ fontFamily: 'monospace', fontSize: '0.65rem', wordBreak: 'break-all' }}>
                {sub.user_id}
              </Typography>
            </DetailRow>
          </CardContent>
        </Card>
      </Box>
    </Drawer>
  );
}

// ── Main Page ─────────────────────────────────────────────────
const LIMIT = 25;

export default function AdminSubscriptionsPage() {
  const [tab, setTab] = useState(0);

  // Stats
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Plans
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [planDialog, setPlanDialog] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);

  // Subscribers
  const [subscribers, setSubscribers] = useState([]);
  const [subTotal, setSubTotal] = useState(0);
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [subPage, setSubPage] = useState(1);
  const [subSearch, setSubSearch] = useState('');
  const [subDebouncedSearch, setSubDebouncedSearch] = useState('');
  const [subFilterPlan, setSubFilterPlan] = useState('');
  const [subFilterStatus, setSubFilterStatus] = useState('');
  const [subFilterProvider, setSubFilterProvider] = useState('');
  const [subSort, setSubSort] = useState('recent');

  // Export
  const [exporting, setExporting] = useState(false);

  // Subscriber detail drawer
  const [selectedSub, setSelectedSub] = useState(null);
  const [subDetailOpen, setSubDetailOpen] = useState(false);

  // Errors
  const [errorSubs, setErrorSubs] = useState(null);

  // ── Navigate to Abonnés tab with pre-applied filters ────────
  function goToSubscribersWithFilter({ status = '', planId = '', provider = '' } = {}) {
    setSubFilterStatus(status);
    setSubFilterPlan(planId);
    setSubFilterProvider(provider);
    setSubSearch('');
    setSubPage(1);
    setTab(2);
  }

  // ── Fetch stats ────────────────────────────────────────────
  useEffect(() => {
    setLoadingStats(true);
    authFetch(`${API}/api/admin/subscriptions-module/stats`)
      .then(r => r.json()).then(d => setStats(d)).catch(() => {})
      .finally(() => setLoadingStats(false));
  }, []);

  // ── Fetch plans ────────────────────────────────────────────
  const loadPlans = useCallback(() => {
    setLoadingPlans(true);
    authFetch(`${API}/api/admin/subscriptions-module/plans`)
      .then(r => r.json()).then(d => setPlans(Array.isArray(d) ? d : []))
      .catch(() => {}).finally(() => setLoadingPlans(false));
  }, []);

  useEffect(() => { loadPlans(); }, [loadPlans]);

  // ── Debounce search ────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => { setSubDebouncedSearch(subSearch); setSubPage(1); }, 350);
    return () => clearTimeout(t);
  }, [subSearch]);

  useEffect(() => { setSubPage(1); }, [subFilterPlan, subFilterStatus, subFilterProvider, subSort]);

  // ── Fetch subscribers ──────────────────────────────────────
  const loadSubs = useCallback(() => {
    setLoadingSubs(true);
    setErrorSubs(null);
    const params = new URLSearchParams({ page: String(subPage), limit: String(LIMIT), sort: subSort });
    if (subDebouncedSearch) params.set('search', subDebouncedSearch);
    if (subFilterPlan)     params.set('planId', subFilterPlan);
    if (subFilterStatus)   params.set('status', subFilterStatus);
    if (subFilterProvider) params.set('provider', subFilterProvider);

    authFetch(`${API}/api/admin/subscriptions-module/subscribers?${params}`)
      .then(r => r.json())
      .then(d => { setSubscribers(d.subscribers || []); setSubTotal(d.total || 0); })
      .catch(e => setErrorSubs(e.message))
      .finally(() => setLoadingSubs(false));
  }, [subPage, subDebouncedSearch, subFilterPlan, subFilterStatus, subFilterProvider, subSort]);

  useEffect(() => { if (tab === 2) loadSubs(); }, [loadSubs, tab]);

  // ── Toggle plan ────────────────────────────────────────────
  async function handleToggle(plan) {
    await authFetch(`${API}/api/admin/subscriptions-module/plans/${plan.id}/toggle`, { method: 'PATCH' });
    loadPlans();
  }

  // ── Plan saved ─────────────────────────────────────────────
  function handlePlanSaved() {
    setPlanDialog(false);
    setEditingPlan(null);
    loadPlans();
  }

  // ── Export ─────────────────────────────────────────────────
  async function handleExport(format) {
    setExporting(true);
    try {
      const params = new URLSearchParams({ format });
      if (subFilterPlan)     params.set('planId', subFilterPlan);
      if (subFilterStatus)   params.set('status', subFilterStatus);
      if (subFilterProvider) params.set('provider', subFilterProvider);

      const res = await authFetch(`${API}/api/admin/subscriptions-module/export?${params}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `abonnes-${Date.now()}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export error:', e);
    } finally {
      setExporting(false);
    }
  }

  const subPages = Math.ceil(subTotal / LIMIT);

  const chipSx = (active, color) => ({
    cursor: 'pointer', fontWeight: 600, fontSize: '0.72rem',
    bgcolor: active ? (color || C.indigo) : (color ? `${color}15` : '#e8e2d8'),
    color: active ? '#fff' : (color || C.textSecondary),
    border: 'none', transition: 'all 0.15s',
    '&:hover': { bgcolor: active ? (color || C.indigo) : (color ? `${color}28` : '#ddd7ce') },
  });

  return (
    <Box sx={{ bgcolor: C.bg, minHeight: '100vh' }}>
      {/* ── Header ─────────────────────────────────────────── */}
      <Box sx={{ bgcolor: '#fff', height: 60, display: 'flex', alignItems: 'center', px: 3, borderBottom: '1px solid #e5e0d8', position: 'sticky', top: 0, zIndex: 10, gap: 1 }}>
        <CreditCardOutlinedIcon sx={{ color: C.indigo, mr: 1 }} />
        <Typography variant="h6" fontWeight={700} color={C.textPrimary} sx={{ flex: 1 }}>
          Gestion des abonnements
        </Typography>
        {tab === 1 && (
          <Button variant="contained" size="small" startIcon={<AddIcon />}
            onClick={() => { setEditingPlan(null); setPlanDialog(true); }}
            sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700, bgcolor: C.indigo, '&:hover': { bgcolor: '#1a2d47' } }}>
            Nouveau plan
          </Button>
        )}
        {tab === 2 && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" size="small" startIcon={exporting ? <CircularProgress size={14} /> : <DownloadIcon />}
              onClick={() => handleExport('csv')} disabled={exporting}
              sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600, borderColor: C.green, color: C.green }}>
              CSV
            </Button>
            <Button variant="outlined" size="small" startIcon={exporting ? <CircularProgress size={14} /> : <DownloadIcon />}
              onClick={() => handleExport('pdf')} disabled={exporting}
              sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600, borderColor: C.red, color: C.red }}>
              PDF
            </Button>
          </Box>
        )}
      </Box>

      {/* ── Tabs ───────────────────────────────────────────── */}
      <Box sx={{ bgcolor: '#fff', borderBottom: '1px solid #e5e0d8', px: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ '& .MuiTab-root': { textTransform: 'none', fontWeight: 600 }, '& .Mui-selected': { color: C.indigo }, '& .MuiTabs-indicator': { bgcolor: C.indigo } }}>
          <Tab label="Métriques" />
          <Tab label={`Plans (${plans.length})`} />
          <Tab label="Abonnés" />
        </Tabs>
      </Box>

      <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1300, mx: 'auto' }}>
        <AdminPageHeader
          title="Gestion des abonnements"
          subtitle="Plans, métriques et abonnés."
          actions={
            tab === 1 ? (
              <Button variant="contained" size="small" startIcon={<AddIcon />}
                onClick={() => { setEditingPlan(null); setPlanDialog(true); }}
                sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700, bgcolor: C.indigo, '&:hover': { bgcolor: '#1a2d47' } }}>
                Nouveau plan
              </Button>
            ) : tab === 2 ? (
              <>
                <Button variant="outlined" size="small" startIcon={exporting ? <CircularProgress size={14} /> : <DownloadIcon />}
                  onClick={() => handleExport('csv')} disabled={exporting}
                  sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600, borderColor: C.green, color: C.green }}>
                  CSV
                </Button>
                <Button variant="outlined" size="small" startIcon={exporting ? <CircularProgress size={14} /> : <DownloadIcon />}
                  onClick={() => handleExport('pdf')} disabled={exporting}
                  sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600, borderColor: C.red, color: C.red }}>
                  PDF
                </Button>
              </>
            ) : null
          }
        />

        {/* ══════════════ TAB 0 : MÉTRIQUES ══════════════════ */}
        {tab === 0 && (
          <AdminSection title="Métriques">
            {/* KPI cards */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              {[
                { icon: <CheckCircleOutlineIcon />, label: 'Abonnés actifs',    value: stats?.activeCount?.toLocaleString('fr-FR'),    color: C.green,  onClick: () => goToSubscribersWithFilter({ status: 'ACTIVE' }) },
                { icon: <PeopleIcon />,             label: 'Total abonnements', value: stats?.totalCount?.toLocaleString('fr-FR'),      color: C.indigo, onClick: () => goToSubscribersWithFilter() },
                { icon: <CancelOutlinedIcon />,     label: 'Résiliés',          value: stats?.cancelledCount?.toLocaleString('fr-FR'), color: C.red,    onClick: () => goToSubscribersWithFilter({ status: 'CANCELLED' }) },
                { icon: <AccessTimeIcon />,         label: 'Expirés',           value: stats?.expiredCount?.toLocaleString('fr-FR'),   color: C.grey,   onClick: () => goToSubscribersWithFilter({ status: 'EXPIRED' }) },
                { icon: <TrendingUpIcon />,         label: 'Nouveaux ce mois',  value: stats?.newThisMonth?.toLocaleString('fr-FR'),   color: C.orange, onClick: () => goToSubscribersWithFilter() },
                { icon: <EuroIcon />,               label: 'Revenus totaux',
                  value: stats?.totalRevenue != null ? `${stats.totalRevenue.toFixed(2)} €` : '—',
                  color: C.purple, onClick: () => goToSubscribersWithFilter() },
              ].map((c, i) => (
                <Grid size={{ xs: 6, sm: 4, md: 2 }} key={i}>
                  <StatCard {...c} loading={loadingStats} />
                </Grid>
              ))}
            </Grid>

            {/* Revenue chart + Provider breakdown */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12, md: 8 }}>
                <RevenueChart data={stats?.monthlyRevenue} loading={loadingStats} />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', p: 2.5, height: '100%' }}>
                  <Typography variant="subtitle2" fontWeight={700} color={C.textPrimary} sx={{ mb: 2 }}>
                    Abonnés actifs par provider
                  </Typography>
                  {loadingStats ? (
                    <><Skeleton height={30} /><Skeleton height={30} /></>
                  ) : stats?.byProvider && Object.entries(stats.byProvider).length > 0 ? (
                    Object.entries(stats.byProvider).map(([provider, count]) => (
                      <Box
                        key={provider}
                        onClick={() => goToSubscribersWithFilter({ provider, status: 'ACTIVE' })}
                        sx={{ mb: 1.5, cursor: 'pointer', borderRadius: '8px', p: 0.75, mx: -0.75, transition: 'background 0.15s', '&:hover': { bgcolor: `${C.indigo}08` } }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5, alignItems: 'center' }}>
                          <Typography variant="body2" fontWeight={600} sx={{ textTransform: 'capitalize' }}>{provider}</Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography variant="body2" fontWeight={700} color={C.indigo}>{count}</Typography>
                            <ChevronRightIcon sx={{ fontSize: 14, color: `${C.indigo}60` }} />
                          </Box>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={Math.round((count / (stats.activeCount || 1)) * 100)}
                          sx={{ height: 6, borderRadius: 3, bgcolor: `${C.indigo}15`, '& .MuiLinearProgress-bar': { bgcolor: C.indigo, borderRadius: 3 } }}
                        />
                      </Box>
                    ))
                  ) : (
                    <AdminEmptyState title="Aucune donnée" subtitle="Aucun provider actif à afficher." />
                  )}
                </Card>
              </Grid>
            </Grid>

            {/* Plans summary table */}
            <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <CardContent sx={{ p: 0 }}>
                <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #f0eee9', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CreditCardOutlinedIcon sx={{ color: C.indigo, fontSize: 20 }} />
                  <Typography variant="subtitle1" fontWeight={700} color={C.textPrimary}>Résumé des plans</Typography>
                </Box>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#faf9f7' }}>
                      {['Plan', 'Prix', 'Durée', 'Actifs', 'Total', 'Statut'].map(h => (
                        <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.72rem', color: C.textSecondary, py: 1.25 }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loadingPlans ? [1,2,3].map(i => (
                      <TableRow key={i}>{[1,2,3,4,5,6].map(j => <TableCell key={j}><Skeleton height={20} /></TableCell>)}</TableRow>
                    )) : plans.map(p => (
                      <TableRow
                        key={p.id}
                        onClick={() => goToSubscribersWithFilter({ planId: p.id })}
                        sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#f0ede8' }, '&:last-child td': { border: 0 } }}
                      >
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" fontWeight={700}>{p.display_name}</Typography>
                          </Box>
                          <Typography variant="caption" color={C.textSecondary}>{p.slug}</Typography>
                        </TableCell>
                        <TableCell><Typography variant="body2" fontWeight={600}>{fmtPrice(p.base_price_cents, p.currency)}</Typography></TableCell>
                        <TableCell><Typography variant="body2">{p.duration_days}j</Typography></TableCell>
                        <TableCell><Typography variant="body2" fontWeight={700} color={C.green}>{p.activeSubscribers}</Typography></TableCell>
                        <TableCell><Typography variant="body2">{p.totalSubscribers}</Typography></TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Chip label={p.is_active ? 'Actif' : 'Inactif'} size="small"
                              sx={{ bgcolor: p.is_active ? `${C.green}18` : `${C.grey}18`, color: p.is_active ? C.green : C.grey, fontWeight: 600, fontSize: '0.68rem', height: 22 }} />
                            <ChevronRightIcon sx={{ fontSize: 14, color: `${C.indigo}50` }} />
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </AdminSection>
        )}

        {/* ══════════════ TAB 1 : PLANS ══════════════════════ */}
        {tab === 1 && (
          <AdminSection title="Plans">
            {loadingPlans ? (
              <Grid container spacing={2}>
                {[1,2,3].map(i => <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}><Skeleton variant="rounded" height={280} sx={{ borderRadius: '16px' }} /></Grid>)}
              </Grid>
            ) : plans.length === 0 ? (
              <Box sx={{ py: 4 }}>
                <AdminEmptyState title="Aucun plan créé" subtitle="Crée un premier plan pour démarrer le module abonnements." />
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <Button variant="contained" startIcon={<AddIcon />} sx={{ borderRadius: '10px', textTransform: 'none', bgcolor: C.indigo }}
                    onClick={() => { setEditingPlan(null); setPlanDialog(true); }}>
                    Créer le premier plan
                  </Button>
                </Box>
              </Box>
            ) : (
              <Grid container spacing={2}>
                {plans.map(p => (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={p.id}>
                    <PlanCard
                      plan={p}
                      onEdit={plan => { setEditingPlan(plan); setPlanDialog(true); }}
                      onToggle={handleToggle}
                    />
                  </Grid>
                ))}
              </Grid>
            )}
          </AdminSection>
        )}

        {/* ══════════════ TAB 2 : ABONNÉS ════════════════════ */}
        {tab === 2 && (
          <AdminSection title="Abonnés">
            {/* Toolbar row 1 */}
            <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
              <TextField
                size="small" placeholder="Nom, email…" value={subSearch}
                onChange={e => setSubSearch(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: C.grey, fontSize: 18 }} /></InputAdornment> }}
                sx={{ flex: 1, minWidth: 200, '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: '#fff' } }}
              />
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <Select value={subSort} onChange={e => setSubSort(e.target.value)}
                  startAdornment={<SortIcon sx={{ color: C.grey, fontSize: 18, mr: 0.5 }} />}
                  sx={{ borderRadius: '10px', bgcolor: '#fff' }}>
                  <MenuItem value="recent">Plus récents</MenuItem>
                  <MenuItem value="amount">Montant ↓</MenuItem>
                </Select>
              </FormControl>
              <Typography variant="body2" color={C.textSecondary} sx={{ display: { xs: 'none', md: 'block' }, flex: 1 }}>
                {loadingSubs ? '' : `${subTotal} abonné${subTotal > 1 ? 's' : ''}`}
              </Typography>
            </Box>

            {/* Filter chips row 2 */}
            <Box sx={{ display: 'flex', gap: 1, mb: 2.5, flexWrap: 'wrap', alignItems: 'center' }}>
              <FilterListIcon sx={{ color: C.grey, fontSize: 18 }} />

              {/* By plan */}
              {[{ value: '', label: 'Tous plans' }, ...plans.map(p => ({ value: p.id, label: p.display_name, color: C.indigo }))].map(f => (
                <Chip key={f.value} label={f.label} size="small"
                  onClick={() => setSubFilterPlan(f.value)}
                  sx={chipSx(subFilterPlan === f.value, f.color)} />
              ))}

              <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: '#ccc', mx: 0.5 }} />

              {/* By status */}
              {[
                { value: '', label: 'Tous statuts' },
                { value: 'ACTIVE',    label: 'Actifs',   color: C.green  },
                { value: 'EXPIRED',   label: 'Expirés',  color: C.grey   },
                { value: 'CANCELLED', label: 'Résiliés', color: C.red    },
                { value: 'INACTIVE',  label: 'Inactifs', color: C.orange },
              ].map(f => (
                <Chip key={f.value} label={f.label} size="small"
                  onClick={() => setSubFilterStatus(f.value)}
                  sx={chipSx(subFilterStatus === f.value, f.color)} />
              ))}

              <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: '#ccc', mx: 0.5 }} />

              {/* By provider */}
              {[
                { value: '', label: 'Tous providers' },
                { value: 'stripe',       label: 'Stripe',      color: C.purple },
                { value: 'flutterwave',  label: 'Flutterwave', color: C.orange },
              ].map(f => (
                <Chip key={f.value} label={f.label} size="small"
                  onClick={() => setSubFilterProvider(f.value)}
                  sx={chipSx(subFilterProvider === f.value, f.color)} />
              ))}

              {(subFilterPlan || subFilterStatus || subFilterProvider || subSearch) && (
                <Chip label="Réinitialiser" size="small"
                  onClick={() => { setSubFilterPlan(''); setSubFilterStatus(''); setSubFilterProvider(''); setSubSearch(''); }}
                  sx={{ fontWeight: 600, fontSize: '0.72rem', bgcolor: 'transparent', border: `1px solid #ccc`, color: C.textSecondary }} />
              )}
            </Box>

            {errorSubs && <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>{errorSubs}</Alert>}

            {/* Subscribers table */}
            <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <CardContent sx={{ p: 0 }}>
                <Box sx={{ overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#faf9f7' }}>
                        {['Abonné', 'Plan', 'Montant', 'Statut', 'Provider', 'Fin période', 'Inscrit le'].map(h => (
                          <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.72rem', color: C.textSecondary, py: 1.5, '&:first-of-type': { pl: 3 }, '&:last-of-type': { pr: 3 } }}>
                            {h}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {loadingSubs ? [1,2,3,4,5].map(i => (
                        <TableRow key={i}>{[1,2,3,4,5,6,7].map(j => <TableCell key={j} sx={{ py: 1.5 }}><Skeleton height={20} /></TableCell>)}</TableRow>
                      )) : subscribers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} sx={{ py: 3 }}>
                            <AdminEmptyState title="Aucun abonné trouvé" subtitle="Aucun résultat avec les filtres actuels." />
                          </TableCell>
                        </TableRow>
                      ) : subscribers.map((s, i) => {
                        const statusCfg = STATUS_CFG[s.status] || { label: s.status, color: C.grey };
                        return (
                          <TableRow
                            key={s.id}
                            onClick={() => { setSelectedSub(s); setSubDetailOpen(true); }}
                            sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#f0ede8' }, '&:last-child td': { border: 0 } }}
                          >
                            <TableCell sx={{ py: 1.5, pl: 3 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <Avatar src={s.user.avatar_url || undefined}
                                  sx={{ width: 32, height: 32, fontSize: '0.8rem', bgcolor: `${C.indigo}20`, color: C.indigo }}>
                                  {s.user.full_name?.[0]?.toUpperCase() || '?'}
                                </Avatar>
                                <Box sx={{ minWidth: 0 }}>
                                  <Typography variant="body2" fontWeight={700} color={C.textPrimary} noWrap>{s.user.full_name || 'Inconnu'}</Typography>
                                  <Typography variant="caption" color={C.textSecondary} noWrap display="block">{s.user.email}</Typography>
                                </Box>
                              </Box>
                            </TableCell>
                            <TableCell sx={{ py: 1.5 }}>
                              <Typography variant="body2" fontWeight={600}>{s.plan?.display_name || '—'}</Typography>
                            </TableCell>
                            <TableCell sx={{ py: 1.5 }}>
                              <Typography variant="body2" fontWeight={700} color={C.indigo}>
                                {s.amount} {s.currency}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ py: 1.5 }}>
                              <Chip label={statusCfg.label} size="small"
                                sx={{ bgcolor: `${statusCfg.color}18`, color: statusCfg.color, fontWeight: 600, fontSize: '0.68rem', height: 22 }} />
                            </TableCell>
                            <TableCell sx={{ py: 1.5 }}>
                              <Typography variant="body2" color={C.textSecondary} sx={{ textTransform: 'capitalize' }}>{s.provider || '—'}</Typography>
                            </TableCell>
                            <TableCell sx={{ py: 1.5 }}>
                              <Typography variant="body2" color={C.textSecondary}>{fmtDate(s.current_period_end)}</Typography>
                            </TableCell>
                            <TableCell sx={{ py: 1.5, pr: 3 }}>
                              <Typography variant="body2" color={C.textSecondary}>{fmtDate(s.created_at)}</Typography>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Box>

                {!loadingSubs && subPages > 1 && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 2.5 }}>
                    <Pagination count={subPages} page={subPage} onChange={(_, v) => setSubPage(v)} size="small" shape="rounded" />
                  </Box>
                )}
              </CardContent>
            </Card>
          </AdminSection>
        )}
      </Box>

      {/* Subscriber Detail Drawer */}
      <SubscriberDetailDrawer
        sub={selectedSub}
        open={subDetailOpen}
        onClose={() => { setSubDetailOpen(false); setTimeout(() => setSelectedSub(null), 300); }}
      />

      {/* Plan Dialog */}
      <PlanDialog
        open={planDialog}
        plan={editingPlan}
        onClose={() => { setPlanDialog(false); setEditingPlan(null); }}
        onSaved={handlePlanSaved}
      />
    </Box>
  );
}
