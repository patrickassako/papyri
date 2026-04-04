/**
 * AdminPromoCodesPage — /admin/promo-codes
 * Gestion complète des codes promo (admin global + éditeurs)
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Button, IconButton, Chip, TextField,
  Table, TableHead, TableBody, TableRow, TableCell,
  Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Alert, Skeleton, Tooltip, Switch, Select,
  MenuItem, FormControl, InputAdornment, LinearProgress, Drawer,
  Divider, Avatar, Tabs, Tab, InputLabel, Snackbar,
} from '@mui/material';
import AddIcon               from '@mui/icons-material/Add';
import EditOutlinedIcon      from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon     from '@mui/icons-material/DeleteOutline';
import SearchIcon            from '@mui/icons-material/Search';
import FilterListIcon        from '@mui/icons-material/FilterList';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import ContentCopyIcon       from '@mui/icons-material/ContentCopy';
import CloseIcon             from '@mui/icons-material/Close';
import PeopleOutlineIcon     from '@mui/icons-material/PeopleOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import TuneIcon              from '@mui/icons-material/Tune';
import { authFetch } from '../../services/auth.service';
import {
  adminGetPublisherPromoCodes,
  adminTogglePublisherPromoCode,
  adminGetPublisherPromoCodeUsages,
  adminUpdatePublisherPromoLimit,
} from '../../services/publisher.service';
import tokens from '../../config/tokens';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const C = {
  indigo: tokens.colors.accent, primary: tokens.colors.primary, green: '#27ae60',
  red: '#e74c3c', orange: '#FF9800', purple: '#7B5EA7', grey: '#8c8c8c',
  bg: '#F7F6F3', textPrimary: '#1a1a2e', textSecondary: '#6b7280',
};

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusBadge(promo) {
  if (!promo.is_active) return { label: 'Inactif',   color: C.grey   };
  if (promo.isExpired)  return { label: 'Expiré',    color: C.red    };
  if (promo.isPending)  return { label: 'Pas encore', color: C.orange };
  return                       { label: 'Actif',     color: C.green  };
}

// ── Promo Form Dialog ─────────────────────────────────────────
const EMPTY = {
  code: '', description: '', discount_type: 'percent', discount_value: '',
  max_uses: '', valid_from: '', valid_until: '', applicable_plans: [], is_active: true,
};

function PromoDialog({ open, promo, onClose, onSaved }) {
  const [form, setForm]     = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);
  const [plans, setPlans]   = useState([]);
  const isEdit = !!promo?.id;

  useEffect(() => {
    authFetch(`${API}/api/admin/subscriptions-module/plans`)
      .then(r => r.json())
      .then(d => setPlans(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (promo) {
      setForm({
        code:             promo.code || '',
        description:      promo.description || '',
        discount_type:    promo.discount_type || 'percent',
        discount_value:   promo.discount_value ?? '',
        max_uses:         promo.max_uses ?? '',
        valid_from:       promo.valid_from ? promo.valid_from.split('T')[0] : '',
        valid_until:      promo.valid_until ? promo.valid_until.split('T')[0] : '',
        applicable_plans: promo.applicable_plans || [],
        is_active:        promo.is_active !== false,
      });
    } else {
      setForm(EMPTY);
    }
    setError(null);
  }, [promo, open]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function togglePlan(planId) {
    setForm(f => ({
      ...f,
      applicable_plans: f.applicable_plans.includes(planId)
        ? f.applicable_plans.filter(p => p !== planId)
        : [...f.applicable_plans, planId],
    }));
  }

  async function handleSave() {
    if (!form.code.trim()) { setError('Le code est requis.'); return; }
    if (!form.discount_value) { setError('La valeur de remise est requise.'); return; }
    setSaving(true); setError(null);
    try {
      const url    = isEdit ? `${API}/api/admin/promo-codes/${promo.id}` : `${API}/api/admin/promo-codes`;
      const method = isEdit ? 'PUT' : 'POST';
      const body   = {
        ...form,
        discount_value: Number(form.discount_value),
        max_uses: form.max_uses ? Number(form.max_uses) : null,
        valid_from: form.valid_from  || null,
        valid_until: form.valid_until || null,
        applicable_plans: form.applicable_plans.length > 0 ? form.applicable_plans : null,
      };
      const res  = await authFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      onSaved(data);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  const inputSx = { '& .MuiOutlinedInput-root': { borderRadius: '10px' } };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '20px' } }}>
      <DialogTitle sx={{ fontWeight: 700, color: C.textPrimary, pb: 1 }}>
        {isEdit ? `Modifier — ${promo?.code}` : 'Nouveau code promo'}
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        {error && <Alert severity="error" sx={{ borderRadius: '10px' }}>{error}</Alert>}

        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField label="Code *" size="small" sx={{ flex: 2, ...inputSx }}
            value={form.code}
            onChange={e => set('code', e.target.value.toUpperCase())}
            disabled={isEdit}
            inputProps={{ style: { fontFamily: 'monospace', fontWeight: 700, letterSpacing: 2 } }}
            helperText={isEdit ? 'Non modifiable' : 'Automatiquement en majuscules'} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
            <Switch checked={form.is_active} onChange={e => set('is_active', e.target.checked)}
              sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: C.green }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: C.green } }} />
            <Typography variant="body2" color={form.is_active ? C.green : C.grey} fontWeight={600}>
              {form.is_active ? 'Actif' : 'Inactif'}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 150, ...inputSx }}>
            <Select value={form.discount_type} onChange={e => set('discount_type', e.target.value)}>
              <MenuItem value="percent">Pourcentage (%)</MenuItem>
              <MenuItem value="fixed">Montant fixe (€)</MenuItem>
            </Select>
          </FormControl>
          <TextField label={`Valeur *  (${form.discount_type === 'percent' ? '%' : '€'})`} size="small" type="number"
            sx={{ flex: 1, ...inputSx }} value={form.discount_value}
            onChange={e => set('discount_value', e.target.value)}
            helperText={form.discount_type === 'percent' && form.discount_value ? `Soit ${form.discount_value}% de réduction` : ''} />
          <TextField label="Max utilisations" size="small" type="number" sx={{ flex: 1, ...inputSx }}
            value={form.max_uses} onChange={e => set('max_uses', e.target.value)}
            helperText="Vide = illimité" />
        </Box>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField label="Valide à partir du" size="small" type="date" sx={{ flex: 1, ...inputSx }}
            value={form.valid_from} onChange={e => set('valid_from', e.target.value)}
            InputLabelProps={{ shrink: true }} />
          <TextField label="Expire le" size="small" type="date" sx={{ flex: 1, ...inputSx }}
            value={form.valid_until} onChange={e => set('valid_until', e.target.value)}
            InputLabelProps={{ shrink: true }} />
        </Box>

        <Box>
          <Typography variant="caption" color={C.textSecondary} fontWeight={600} sx={{ display: 'block', mb: 1 }}>
            Plans applicables{' '}
            <Typography component="span" variant="caption" color={C.grey}>(vide = tous les plans)</Typography>
          </Typography>
          {plans.length === 0 ? (
            <Typography variant="caption" color={C.grey}>Chargement des plans…</Typography>
          ) : (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {plans.map(plan => {
                const selected = form.applicable_plans.includes(plan.id);
                return (
                  <Chip
                    key={plan.id}
                    label={
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', py: 0.25 }}>
                        <Typography variant="caption" fontWeight={700} sx={{ lineHeight: 1.2, fontSize: '0.75rem' }}>
                          {plan.display_name || plan.name}
                        </Typography>
                        <Typography variant="caption" sx={{ fontSize: '0.65rem', opacity: 0.75 }}>
                          {plan.base_price_cents != null ? `${(plan.base_price_cents / 100).toFixed(2)} €` : ''}
                          {plan.billing_period ? ` / ${plan.billing_period}` : ''}
                        </Typography>
                      </Box>
                    }
                    onClick={() => togglePlan(plan.id)}
                    sx={{
                      cursor: 'pointer', height: 'auto', py: 0.5,
                      bgcolor: selected ? C.indigo : '#f0ede8',
                      color:   selected ? '#fff' : C.textSecondary,
                      '& .MuiChip-label': { px: 1.5 },
                      border: selected ? `2px solid ${C.indigo}` : '2px solid transparent',
                    }}
                  />
                );
              })}
            </Box>
          )}
        </Box>

        <TextField label="Description / Note interne" size="small" fullWidth multiline rows={2} sx={inputSx}
          value={form.description} onChange={e => set('description', e.target.value)}
          placeholder="Note interne sur l'usage de ce code…" />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none', color: C.grey }}>Annuler</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '10px', bgcolor: C.indigo, '&:hover': { bgcolor: '#1a2d47' } }}>
          {saving ? 'Enregistrement…' : isEdit ? 'Mettre à jour' : 'Créer le code'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Usage Detail Drawer ────────────────────────────────────────
function UsageDrawer({ promo, open, onClose }) {
  const [usages, setUsages]     = useState([]);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    if (!open || !promo) return;
    setLoading(true);
    authFetch(`${API}/api/admin/promo-codes/${promo.id}/usages`)
      .then(r => r.json()).then(d => setUsages(Array.isArray(d) ? d : []))
      .catch(() => {}).finally(() => setLoading(false));
  }, [open, promo]);

  const badge = promo ? statusBadge(promo) : {};

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: '100vw', sm: 420 }, bgcolor: C.bg } }}>
      <Box sx={{ bgcolor: C.indigo, p: 3, color: '#fff', position: 'relative' }}>
        <IconButton onClick={onClose} size="small" sx={{ position: 'absolute', top: 12, right: 12, color: 'rgba(255,255,255,0.6)', '&:hover': { color: '#fff' } }}>
          <CloseIcon fontSize="small" />
        </IconButton>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5 }}>
          <Box sx={{ width: 52, height: 52, borderRadius: '14px', bgcolor: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LocalOfferOutlinedIcon sx={{ fontSize: 26, color: '#fff' }} />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={900} sx={{ fontFamily: 'monospace', letterSpacing: 2 }}>{promo?.code}</Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
              <Chip label={badge.label} size="small"
                sx={{ bgcolor: `${badge.color}30`, color: '#fff', fontWeight: 700, fontSize: '0.68rem', height: 20 }} />
              {promo?.publisher
                ? <Chip label={`Éditeur: ${promo.publisher.company_name}`} size="small"
                    sx={{ bgcolor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)', fontSize: '0.68rem', height: 20 }} />
                : <Chip label="Global — Papyri" size="small"
                    sx={{ bgcolor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)', fontSize: '0.68rem', height: 20 }} />
              }
            </Box>
          </Box>
        </Box>
      </Box>

      <Box sx={{ p: 2.5, overflowY: 'auto' }}>
        {/* Détails du code */}
        <Typography variant="overline" color={C.textSecondary} fontWeight={700} sx={{ letterSpacing: 1, fontSize: '0.68rem' }}>
          Détails
        </Typography>
        <Card sx={{ borderRadius: '14px', boxShadow: 'none', border: '1px solid #ece8e0', mt: 1, mb: 2.5 }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            {[
              ['Remise', promo?.discount_type === 'percent' ? `${promo?.discount_value}%` : `${promo?.discount_value} €`],
              ['Utilisations', promo?.max_uses ? `${promo?.used_count} / ${promo?.max_uses}` : `${promo?.used_count} (illimité)`],
              ['Valide du', fmtDate(promo?.valid_from)],
              ['Expire le', fmtDate(promo?.valid_until)],
              ['Plans', promo?.applicable_plans?.join(', ') || 'Tous les plans'],
              ['Créé le', fmtDate(promo?.created_at)],
            ].map(([label, value]) => (
              <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', py: 1, borderBottom: '1px solid #f0eee9', '&:last-child': { border: 0 } }}>
                <Typography variant="caption" color={C.textSecondary} fontWeight={600}>{label}</Typography>
                <Typography variant="body2" fontWeight={600} color={C.textPrimary}>{value}</Typography>
              </Box>
            ))}
            {promo?.max_uses && (
              <Box sx={{ mt: 1.5 }}>
                <LinearProgress variant="determinate"
                  value={Math.min(100, Math.round((promo.used_count / promo.max_uses) * 100))}
                  sx={{ height: 6, borderRadius: 3, bgcolor: `${C.indigo}15`, '& .MuiLinearProgress-bar': { bgcolor: C.indigo } }} />
                <Typography variant="caption" color={C.textSecondary} sx={{ mt: 0.5, display: 'block' }}>
                  {Math.round((promo.used_count / promo.max_uses) * 100)}% du quota utilisé
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Historique utilisations */}
        <Typography variant="overline" color={C.textSecondary} fontWeight={700} sx={{ letterSpacing: 1, fontSize: '0.68rem' }}>
          Utilisations ({usages.length})
        </Typography>
        <Card sx={{ borderRadius: '14px', boxShadow: 'none', border: '1px solid #ece8e0', mt: 1 }}>
          <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
            {loading ? (
              <Box sx={{ p: 2 }}>{[1,2,3].map(i => <Skeleton key={i} height={40} sx={{ mb: 0.5 }} />)}</Box>
            ) : usages.length === 0 ? (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <PeopleOutlineIcon sx={{ fontSize: 32, color: '#ccc', mb: 0.5 }} />
                <Typography variant="body2" color={C.textSecondary}>Pas encore utilisé</Typography>
              </Box>
            ) : usages.map((u, i) => (
              <Box key={u.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.25, borderBottom: i < usages.length - 1 ? '1px solid #f0eee9' : 'none' }}>
                <Avatar sx={{ width: 30, height: 30, fontSize: '0.75rem', bgcolor: `${C.indigo}15`, color: C.indigo }}>
                  {u.profiles?.full_name?.[0]?.toUpperCase() || '?'}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600} noWrap>{u.profiles?.full_name || 'Inconnu'}</Typography>
                  <Typography variant="caption" color={C.textSecondary} noWrap>{u.profiles?.email}</Typography>
                </Box>
                <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                  <Typography variant="body2" fontWeight={700} color={C.green}>-{u.discount_applied} €</Typography>
                  <Typography variant="caption" color={C.textSecondary}>{fmtDate(u.used_at)}</Typography>
                </Box>
              </Box>
            ))}
          </CardContent>
        </Card>
      </Box>
    </Drawer>
  );
}

// ── Publisher Promo Codes Tab ──────────────────────────────────
const PUB_STATUS = {
  active:    { label: 'Actif',    bgcolor: '#E8F5E9', color: '#2E7D32' },
  expired:   { label: 'Expiré',   bgcolor: '#FFEBEE', color: '#C62828' },
  inactive:  { label: 'Inactif',  bgcolor: '#F5F5F5', color: '#757575' },
  exhausted: { label: 'Épuisé',   bgcolor: '#FFF3E0', color: '#E65100' },
};
function pubCodeStatus(c) {
  if (!c.is_active) return 'inactive';
  if (c.isExpired) return 'expired';
  if (c.max_uses && c.used_count >= c.max_uses) return 'exhausted';
  return 'active';
}

function PublisherPromoTab() {
  const [codes, setCodes]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [toggling, setToggling]     = useState(null);
  const [usageCode, setUsageCode]   = useState(null);
  const [usages, setUsages]         = useState([]);
  const [usagesLoading, setUsagesLoading] = useState(false);
  const [limitDialog, setLimitDialog] = useState(null);
  const [limitValue, setLimitValue] = useState('');
  const [limitSaving, setLimitSaving] = useState(false);
  const [limitError, setLimitError] = useState(null);
  const [publishers, setPublishers] = useState([]);
  const [publishersLoading, setPublishersLoading] = useState(true);

  const loadCodes = useCallback(() => {
    setLoading(true); setError(null);
    const params = {};
    if (statusFilter) params.status = statusFilter;
    adminGetPublisherPromoCodes(params)
      .then(res => setCodes(res.codes || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => { loadCodes(); }, [loadCodes]);

  useEffect(() => {
    authFetch(`${API}/api/admin/publishers?limit=200`)
      .then(r => r.json())
      .then(d => setPublishers(d.publishers || []))
      .catch(() => {})
      .finally(() => setPublishersLoading(false));
  }, []);

  async function openUsages(code) {
    setUsageCode(code); setUsages([]); setUsagesLoading(true);
    try {
      const res = await adminGetPublisherPromoCodeUsages(code.id);
      setUsages(res.usages || []);
    } catch { setUsages([]); }
    finally { setUsagesLoading(false); }
  }

  async function handleToggle(codeId) {
    setToggling(codeId);
    try {
      const res = await adminTogglePublisherPromoCode(codeId);
      setCodes(prev => prev.map(c => c.id === codeId ? { ...c, is_active: res.code.is_active } : c));
    } catch (e) { showError(e.message); }
    finally { setToggling(null); }
  }

  async function handleSaveLimit() {
    const val = parseInt(limitValue);
    if (isNaN(val) || val < 1 || val > 500) { setLimitError('Valeur entre 1 et 500.'); return; }
    setLimitSaving(true); setLimitError(null);
    try {
      const res = await adminUpdatePublisherPromoLimit(limitDialog.publisher.id, val);
      setPublishers(prev => prev.map(p => p.id === res.publisher.id ? { ...p, promo_monthly_limit: res.publisher.promo_monthly_limit } : p));
      setLimitDialog(null);
    } catch (e) { setLimitError(e.message); }
    finally { setLimitSaving(false); }
  }

  const fmtD = (iso) => iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const fmtDT = (iso) => iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  const activeCount  = codes.filter(c => pubCodeStatus(c) === 'active').length;
  const expiredCount = codes.filter(c => pubCodeStatus(c) === 'expired').length;
  const totalUsages  = codes.reduce((acc, c) => acc + (c.used_count || 0), 0);

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1100, mx: 'auto' }}>
      {/* Stats */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        {[
          { label: 'Codes actifs',       value: activeCount,  color: C.green  },
          { label: 'Codes expirés',      value: expiredCount, color: C.red    },
          { label: 'Total utilisations', value: totalUsages,  color: C.primary},
        ].map(s => (
          <Card key={s.label} sx={{ borderRadius: '14px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', px: 2.5, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="h5" fontWeight={900} color={s.color}>{loading ? '—' : s.value}</Typography>
            <Typography variant="body2" color={C.textSecondary} fontWeight={600}>{s.label}</Typography>
          </Card>
        ))}
      </Box>

      {/* Limites par éditeur */}
      <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <TuneIcon sx={{ color: C.primary, fontSize: 20 }} />
            <Typography variant="subtitle1" fontWeight={700} color={C.textPrimary}>Limites mensuelles par éditeur</Typography>
          </Box>
          {publishersLoading ? <CircularProgress size={24} sx={{ color: C.primary }} /> : publishers.length === 0 ? (
            <Typography variant="body2" color={C.textSecondary}>Aucun éditeur actif.</Typography>
          ) : (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
              {publishers.filter(p => p.status === 'active').map(pub => {
                const limit = pub.promo_monthly_limit ?? 50;
                const used  = codes.filter(c => c.publisher_id === pub.id).length;
                const pct   = Math.min(100, (used / limit) * 100);
                return (
                  <Card key={pub.id} sx={{ borderRadius: '12px', boxShadow: 'none', border: '1px solid #ece8e0', minWidth: 200, flex: '1 1 200px' }}>
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                        <Typography variant="body2" fontWeight={700} color={C.textPrimary} noWrap sx={{ flex: 1 }}>{pub.company_name}</Typography>
                        <Tooltip title="Modifier la limite">
                          <IconButton size="small" onClick={() => { setLimitDialog({ publisher: pub }); setLimitValue(String(limit)); setLimitError(null); }}
                            sx={{ ml: 0.5, color: C.grey, '&:hover': { color: C.primary } }}>
                            <EditOutlinedIcon sx={{ fontSize: 15 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" color={C.textSecondary}>Ce mois</Typography>
                        <Typography variant="caption" fontWeight={700} color={pct >= 90 ? C.red : C.textPrimary}>{used} / {limit}</Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={pct}
                        sx={{ height: 5, borderRadius: 3, bgcolor: '#f0ede8', '& .MuiLinearProgress-bar': { bgcolor: pct >= 90 ? C.red : pct >= 70 ? C.orange : C.primary, borderRadius: 3 } }} />
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Filtre statut */}
      <Box sx={{ mb: 2.5 }}>
        <FormControl size="small" sx={{ minWidth: 180, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}>
          <InputLabel>Statut</InputLabel>
          <Select value={statusFilter} label="Statut" onChange={e => setStatusFilter(e.target.value)}>
            <MenuItem value="">Tous</MenuItem>
            {Object.entries(PUB_STATUS).map(([k, v]) => <MenuItem key={k} value={k}>{v.label}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: '10px' }}>{error}</Alert>}

      {/* Table codes éditeurs */}
      <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#faf9f7' }}>
                {['Éditeur', 'Code', 'Réduction', 'Utilisations', 'Validité', 'Statut', 'Actif'].map((h, i) => (
                  <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.72rem', color: C.textSecondary, py: 1.5, pl: i === 0 ? 3 : undefined }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                [1,2,3].map(i => <TableRow key={i}>{[1,2,3,4,5,6,7].map(j => <TableCell key={j} sx={{ py: 1.5 }}><Skeleton height={18} /></TableCell>)}</TableRow>)
              ) : codes.length === 0 ? (
                <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', py: 7, color: C.textSecondary }}>
                  <LocalOfferOutlinedIcon sx={{ fontSize: 40, opacity: 0.2, display: 'block', mx: 'auto', mb: 1 }} />
                  Aucun code promo éditeur
                </TableCell></TableRow>
              ) : codes.map(c => {
                const st = pubCodeStatus(c);
                const cfg = PUB_STATUS[st];
                return (
                  <TableRow key={c.id} hover sx={{ cursor: 'pointer', '&:last-child td': { border: 0 } }} onClick={() => openUsages(c)}>
                    <TableCell sx={{ py: 1.5, pl: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{ width: 28, height: 28, bgcolor: `${C.indigo}20`, color: C.indigo, fontSize: '0.75rem', fontWeight: 700 }}>
                          {(c.publisher?.company_name || 'E').charAt(0).toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={600} color={C.textPrimary} sx={{ fontSize: '0.83rem' }}>{c.publisher?.company_name || '—'}</Typography>
                          <Typography variant="caption" color={C.textSecondary}>{c.publisher?.contact_name}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: 1, color: C.indigo }}>{c.code}</TableCell>
                    <TableCell>
                      <Chip label={c.discount_type === 'percent' ? `-${c.discount_value}%` : `-${c.discount_value} €`} size="small"
                        sx={{ bgcolor: `${C.primary}12`, color: C.primary, fontWeight: 700, fontSize: '0.72rem', height: 22 }} />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <PeopleOutlineIcon sx={{ fontSize: 14, color: C.grey }} />
                        <Typography variant="body2" fontWeight={c.used_count > 0 ? 700 : 400} color={c.used_count > 0 ? C.textPrimary : C.grey}>
                          {c.max_uses ? `${c.used_count} / ${c.max_uses}` : `${c.used_count} / ∞`}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color={c.isExpired ? C.red : C.textSecondary} fontWeight={c.isExpired ? 700 : 400}>{fmtD(c.valid_until)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={cfg.label} size="small" sx={{ bgcolor: cfg.bgcolor, color: cfg.color, fontWeight: 700, fontSize: '0.68rem', height: 22 }} />
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Switch size="small" checked={!!c.is_active} onChange={() => handleToggle(c.id)} disabled={toggling === c.id}
                        sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: C.green }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: C.green } }} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      </Card>

      {/* Drawer utilisations */}
      <Drawer anchor="right" open={!!usageCode} onClose={() => setUsageCode(null)} PaperProps={{ sx: { width: { xs: '100vw', sm: 420 }, bgcolor: C.bg } }}>
        {usageCode && (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box sx={{ bgcolor: C.primary, p: 3, color: '#fff', position: 'relative' }}>
              <IconButton onClick={() => setUsageCode(null)} size="small" sx={{ position: 'absolute', top: 12, right: 12, color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#fff' } }}>
                <CloseIcon fontSize="small" />
              </IconButton>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5 }}>
                <Box sx={{ bgcolor: 'rgba(255,255,255,0.15)', borderRadius: '12px', p: 1.5, display: 'flex' }}><LocalOfferOutlinedIcon sx={{ fontSize: 22 }} /></Box>
                <Box>
                  <Typography variant="h6" sx={{ fontFamily: 'monospace', fontWeight: 900, letterSpacing: 2 }}>{usageCode.code}</Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)' }}>
                    {usageCode.publisher?.company_name} · {usageCode.discount_type === 'percent' ? `-${usageCode.discount_value}%` : `-${usageCode.discount_value} €`}
                  </Typography>
                </Box>
              </Box>
            </Box>
            <Box sx={{ p: 2.5, flex: 1, overflowY: 'auto' }}>
              <Card sx={{ borderRadius: '12px', boxShadow: 'none', border: '1px solid #ece8e0', mb: 2.5 }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                    {[
                      ['Statut', <Chip label={PUB_STATUS[pubCodeStatus(usageCode)].label} size="small" sx={{ bgcolor: PUB_STATUS[pubCodeStatus(usageCode)].bgcolor, color: PUB_STATUS[pubCodeStatus(usageCode)].color, fontWeight: 700 }} />],
                      ['Utilisations', usageCode.max_uses ? `${usageCode.used_count} / ${usageCode.max_uses}` : `${usageCode.used_count} / ∞`],
                      ['Début', fmtD(usageCode.valid_from)],
                      ['Fin', fmtD(usageCode.valid_until)],
                    ].map(([label, val]) => (
                      <Box key={label}>
                        <Typography variant="caption" color={C.textSecondary} fontWeight={600} sx={{ display: 'block', mb: 0.25 }}>{label}</Typography>
                        {typeof val === 'string' ? <Typography variant="body2" color={C.textPrimary} fontWeight={600}>{val}</Typography> : val}
                      </Box>
                    ))}
                  </Box>
                </CardContent>
              </Card>
              <Typography variant="overline" color={C.textSecondary} fontWeight={700} sx={{ fontSize: '0.68rem', letterSpacing: 1 }}>
                Historique des utilisations
              </Typography>
              {usagesLoading ? (
                <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}><CircularProgress size={28} sx={{ color: C.primary }} /></Box>
              ) : usages.length === 0 ? (
                <Box sx={{ py: 5, textAlign: 'center' }}>
                  <PeopleOutlineIcon sx={{ fontSize: 40, color: '#ccc', mb: 1 }} />
                  <Typography variant="body2" color={C.textSecondary}>Aucune utilisation.</Typography>
                </Box>
              ) : (
                <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {usages.map(u => (
                    <Card key={u.id} sx={{ borderRadius: '12px', boxShadow: 'none', border: '1px solid #ece8e0' }}>
                      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar sx={{ width: 32, height: 32, bgcolor: `${C.indigo}15`, color: C.indigo, fontSize: '0.8rem', fontWeight: 700 }}>
                            {(u.profiles?.full_name || u.profiles?.email || '?').charAt(0).toUpperCase()}
                          </Avatar>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={700} color={C.textPrimary} noWrap>{u.profiles?.full_name || u.profiles?.email || 'Inconnu'}</Typography>
                            <Typography variant="caption" color={C.textSecondary}>{fmtDT(u.used_at)}</Typography>
                          </Box>
                          <Chip label={`-${u.discount_applied} €`} size="small" sx={{ bgcolor: `${C.primary}12`, color: C.primary, fontWeight: 700 }} />
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              )}
            </Box>
          </Box>
        )}
      </Drawer>

      {/* Dialog limite mensuelle */}
      <Dialog open={!!limitDialog} onClose={() => setLimitDialog(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 700, color: C.textPrimary }}>Limite mensuelle</DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          {limitError && <Alert severity="error" sx={{ mb: 2, borderRadius: '10px' }}>{limitError}</Alert>}
          <Typography variant="body2" color={C.textSecondary} sx={{ mb: 2 }}>Éditeur : <strong>{limitDialog?.publisher?.company_name}</strong></Typography>
          <TextField label="Codes / mois *" type="number" value={limitValue} onChange={e => setLimitValue(e.target.value)}
            fullWidth inputProps={{ min: 1, max: 500 }} helperText="Entre 1 et 500 codes par mois"
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setLimitDialog(null)} sx={{ textTransform: 'none', color: C.grey }}>Annuler</Button>
          <Button variant="contained" onClick={handleSaveLimit} disabled={limitSaving}
            startIcon={limitSaving ? <CircularProgress size={14} color="inherit" /> : null}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '10px', bgcolor: C.primary, '&:hover': { bgcolor: '#9e5519' } }}>
            {limitSaving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function AdminPromoCodesPage() {
  const [tab, setTab]               = useState(0);
  const [promos, setPromos]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterScope, setFilterScope]   = useState('');
  const [dialog, setDialog]         = useState(false);
  const [editing, setEditing]       = useState(null);
  const [detailPromo, setDetailPromo]   = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]         = useState(false);
  const [deleteError, setDeleteError]   = useState(null);
  const [copied, setCopied]             = useState(null);

  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'error' });
  const showError = (msg) => setSnack({ open: true, msg, severity: 'error' });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStatus) params.set('status', filterStatus);
    if (filterScope)  params.set('scope', filterScope);
    if (debouncedSearch) params.set('search', debouncedSearch);
    authFetch(`${API}/api/admin/promo-codes?${params}`)
      .then(r => r.json())
      .then(d => setPromos(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filterStatus, filterScope, debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  async function handleToggle(promo, e) {
    e.stopPropagation();
    await authFetch(`${API}/api/admin/promo-codes/${promo.id}/toggle`, { method: 'PATCH' });
    load();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true); setDeleteError(null);
    try {
      const res  = await authFetch(`${API}/api/admin/promo-codes/${deleteTarget.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      setPromos(prev => prev.filter(p => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e) { setDeleteError(e.message); }
    finally { setDeleting(false); }
  }

  function handleSaved(promo) {
    setPromos(prev => {
      const idx = prev.findIndex(p => p.id === promo.id);
      const enriched = { ...promo, isExpired: promo.valid_until ? new Date(promo.valid_until) < new Date() : false, isPending: promo.valid_from ? new Date(promo.valid_from) > new Date() : false, usageRate: promo.max_uses ? Math.round((promo.used_count / promo.max_uses) * 100) : null };
      if (idx >= 0) { const n = [...prev]; n[idx] = enriched; return n; }
      return [enriched, ...prev];
    });
    setDialog(false); setEditing(null);
  }

  function copyCode(code, e) {
    e.stopPropagation();
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(code);
    setTimeout(() => setCopied(null), 1500);
  }

  const chipSx = (active, color) => ({
    cursor: 'pointer', fontWeight: 600, fontSize: '0.72rem',
    bgcolor: active ? (color || C.indigo) : '#e8e2d8',
    color: active ? '#fff' : C.textSecondary,
    border: 'none', transition: 'all 0.15s',
    '&:hover': { bgcolor: active ? (color || C.indigo) : '#ddd7ce' },
  });

  const activeCount   = promos.filter(p => p.is_active && !p.isExpired && !p.isPending).length;
  const expiredCount  = promos.filter(p => p.isExpired).length;
  const globalCount   = promos.filter(p => !p.publisher_id).length;

  return (
    <Box sx={{ bgcolor: C.bg, minHeight: '100vh' }}>

      {/* Header */}
      <Box sx={{ bgcolor: '#fff', borderBottom: '1px solid #e5e0d8', position: 'sticky', top: 0, zIndex: 10 }}>
        <Box sx={{ height: 60, display: 'flex', alignItems: 'center', px: 3, gap: 1 }}>
          <LocalOfferOutlinedIcon sx={{ color: C.indigo, mr: 1 }} />
          <Typography variant="h6" fontWeight={700} color={C.textPrimary} sx={{ flex: 1 }}>
            Codes promo
          </Typography>
          {tab === 0 && (
            <Button variant="contained" size="small" startIcon={<AddIcon />}
              onClick={() => { setEditing(null); setDialog(true); }}
              sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700, bgcolor: C.indigo, boxShadow: 'none', '&:hover': { bgcolor: '#1a2d47' } }}>
              Nouveau code
            </Button>
          )}
        </Box>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}
          sx={{
            px: 3, minHeight: 36,
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: '0.85rem', minHeight: 36, py: 0.5, color: C.textSecondary },
            '& .Mui-selected': { color: C.indigo, fontWeight: 700 },
            '& .MuiTabs-indicator': { bgcolor: C.indigo, height: 3, borderRadius: '3px 3px 0 0' },
          }}>
          <Tab label="Tous les codes" />
          <Tab label="Codes éditeurs" />
        </Tabs>
      </Box>

      {tab === 1 && <PublisherPromoTab />}

      {tab === 0 && (
      <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1100, mx: 'auto' }}>

        {/* Stats */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          {[
            { label: 'Total',   value: promos.length, color: C.indigo  },
            { label: 'Actifs',  value: activeCount,   color: C.green   },
            { label: 'Expirés', value: expiredCount,  color: C.red     },
            { label: 'Globaux', value: globalCount,   color: C.primary },
          ].map(s => (
            <Card key={s.label} sx={{ borderRadius: '14px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', px: 2.5, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography variant="h5" fontWeight={900} color={s.color}>{s.value}</Typography>
              <Typography variant="body2" color={C.textSecondary} fontWeight={600}>{s.label}</Typography>
            </Card>
          ))}
        </Box>

        {/* Toolbar */}
        <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField size="small" placeholder="Rechercher un code…" value={search}
            onChange={e => setSearch(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: C.grey, fontSize: 18 }} /></InputAdornment> }}
            sx={{ flex: 1, minWidth: 200, '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: '#fff' } }} />
        </Box>

        {/* Filters */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2.5, flexWrap: 'wrap', alignItems: 'center' }}>
          <FilterListIcon sx={{ color: C.grey, fontSize: 18 }} />
          {[
            { value: '', label: 'Tous' },
            { value: 'active',   label: 'Actifs',    color: C.green  },
            { value: 'inactive', label: 'Inactifs',  color: C.grey   },
            { value: 'expired',  label: 'Expirés',   color: C.red    },
          ].map(f => (
            <Chip key={f.value} label={f.label} size="small"
              onClick={() => setFilterStatus(f.value)}
              sx={chipSx(filterStatus === f.value, f.color)} />
          ))}

          <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: '#ccc', mx: 0.5 }} />

          {[
            { value: '', label: 'Tous types' },
            { value: 'global',    label: 'Globaux',  color: C.primary },
            { value: 'publisher', label: 'Éditeurs', color: C.purple  },
          ].map(f => (
            <Chip key={f.value} label={f.label} size="small"
              onClick={() => setFilterScope(f.value)}
              sx={chipSx(filterScope === f.value, f.color)} />
          ))}

          {(filterStatus || filterScope || search) && (
            <Chip label="Réinitialiser" size="small"
              onClick={() => { setFilterStatus(''); setFilterScope(''); setSearch(''); }}
              sx={{ fontWeight: 600, fontSize: '0.72rem', bgcolor: 'transparent', border: '1px solid #ccc', color: C.textSecondary }} />
          )}
        </Box>

        {/* Table */}
        <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#faf9f7' }}>
                  {['Code', 'Remise', 'Utilisations', 'Validité', 'Plans', 'Statut', 'Scope', 'Actif', ''].map((h, i) => (
                    <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.72rem', color: C.textSecondary, py: 1.5, pl: i === 0 ? 3 : undefined }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  [1,2,3,4].map(i => (
                    <TableRow key={i}>{[1,2,3,4,5,6,7,8,9].map(j => <TableCell key={j} sx={{ py: 1.5 }}><Skeleton height={18} /></TableCell>)}</TableRow>
                  ))
                ) : promos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} sx={{ textAlign: 'center', py: 7, color: C.textSecondary }}>
                      <LocalOfferOutlinedIcon sx={{ fontSize: 40, opacity: 0.2, display: 'block', mx: 'auto', mb: 1 }} />
                      Aucun code promo
                    </TableCell>
                  </TableRow>
                ) : promos.map(promo => {
                  const badge = statusBadge(promo);
                  return (
                    <TableRow key={promo.id}
                      onClick={() => setDetailPromo(promo)}
                      sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#f5f2ee' }, '&:last-child td': { border: 0 } }}>

                      {/* Code */}
                      <TableCell sx={{ py: 1.5, pl: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" fontWeight={900} sx={{ fontFamily: 'monospace', letterSpacing: 1.5, color: C.indigo }}>
                            {promo.code}
                          </Typography>
                          <Tooltip title={copied === promo.code ? '✓ Copié !' : 'Copier'}>
                            <IconButton size="small" onClick={e => copyCode(promo.code, e)} sx={{ p: 0.3, color: C.grey }}>
                              {copied === promo.code
                                ? <CheckCircleOutlineIcon sx={{ fontSize: 14, color: C.green }} />
                                : <ContentCopyIcon sx={{ fontSize: 14 }} />
                              }
                            </IconButton>
                          </Tooltip>
                        </Box>
                        {promo.description && (
                          <Typography variant="caption" color={C.textSecondary} noWrap sx={{ display: 'block', maxWidth: 160 }}>
                            {promo.description}
                          </Typography>
                        )}
                      </TableCell>

                      {/* Remise */}
                      <TableCell sx={{ py: 1.5 }}>
                        <Chip
                          label={promo.discount_type === 'percent' ? `${promo.discount_value}%` : `${promo.discount_value} €`}
                          size="small"
                          sx={{ bgcolor: `${C.primary}15`, color: C.primary, fontWeight: 800, fontSize: '0.78rem', height: 22 }}
                        />
                      </TableCell>

                      {/* Utilisations */}
                      <TableCell sx={{ py: 1.5 }}>
                        <Typography variant="body2" fontWeight={700}>
                          {promo.used_count}
                          <Typography component="span" variant="caption" color={C.textSecondary}>
                            {promo.max_uses ? ` / ${promo.max_uses}` : ' / ∞'}
                          </Typography>
                        </Typography>
                        {promo.usageRate !== null && (
                          <LinearProgress variant="determinate" value={Math.min(100, promo.usageRate)}
                            sx={{ height: 3, mt: 0.5, borderRadius: 2, width: 60, bgcolor: `${C.indigo}15`, '& .MuiLinearProgress-bar': { bgcolor: promo.usageRate >= 90 ? C.red : C.indigo } }} />
                        )}
                      </TableCell>

                      {/* Validité */}
                      <TableCell sx={{ py: 1.5 }}>
                        <Typography variant="caption" color={C.textSecondary} display="block">
                          {promo.valid_from ? fmtDate(promo.valid_from) : '—'}
                        </Typography>
                        <Typography variant="caption" color={promo.isExpired ? C.red : C.textSecondary} display="block" fontWeight={promo.isExpired ? 700 : 400}>
                          → {promo.valid_until ? fmtDate(promo.valid_until) : '∞'}
                        </Typography>
                      </TableCell>

                      {/* Plans */}
                      <TableCell sx={{ py: 1.5 }}>
                        <Typography variant="caption" color={C.textSecondary}>
                          {promo.applicable_plans?.length > 0 ? promo.applicable_plans.join(', ') : 'Tous'}
                        </Typography>
                      </TableCell>

                      {/* Statut */}
                      <TableCell sx={{ py: 1.5 }}>
                        <Chip label={badge.label} size="small"
                          sx={{ bgcolor: `${badge.color}15`, color: badge.color, fontWeight: 700, fontSize: '0.68rem', height: 22 }} />
                      </TableCell>

                      {/* Scope */}
                      <TableCell sx={{ py: 1.5 }}>
                        {promo.publisher
                          ? <Tooltip title={promo.publisher.company_name}>
                              <Chip label="Éditeur" size="small" sx={{ bgcolor: `${C.purple}15`, color: C.purple, fontWeight: 600, fontSize: '0.68rem', height: 22 }} />
                            </Tooltip>
                          : <Chip label="Global" size="small" sx={{ bgcolor: `${C.primary}15`, color: C.primary, fontWeight: 600, fontSize: '0.68rem', height: 22 }} />
                        }
                      </TableCell>

                      {/* Toggle */}
                      <TableCell sx={{ py: 1.5 }} onClick={e => e.stopPropagation()}>
                        <Switch size="small" checked={promo.is_active} onChange={e => handleToggle(promo, e)}
                          sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: C.green }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: C.green } }} />
                      </TableCell>

                      {/* Actions */}
                      <TableCell sx={{ py: 1.5, pr: 2 }} onClick={e => e.stopPropagation()}>
                        <Box sx={{ display: 'flex', gap: 0.25 }}>
                          <Tooltip title="Modifier">
                            <IconButton size="small" onClick={e => { e.stopPropagation(); setEditing(promo); setDialog(true); }}
                              sx={{ color: C.indigo, '&:hover': { bgcolor: `${C.indigo}10` } }}>
                              <EditOutlinedIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Supprimer">
                            <IconButton size="small" onClick={e => { e.stopPropagation(); setDeleteTarget(promo); setDeleteError(null); }}
                              sx={{ color: C.red, '&:hover': { bgcolor: `${C.red}10` } }}>
                              <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        </Card>
      </Box>
      )}

      {/* Dialogs (tab 0) */}
      <PromoDialog open={dialog} promo={editing}
        onClose={() => { setDialog(false); setEditing(null); }} onSaved={handleSaved} />

      <UsageDrawer open={!!detailPromo} promo={detailPromo}
        onClose={() => { setDetailPromo(null); }} />

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '18px' } }}>
        <DialogTitle sx={{ fontWeight: 700, color: C.red }}>Supprimer le code</DialogTitle>
        <DialogContent>
          {deleteError
            ? <Alert severity="error" sx={{ borderRadius: '10px' }}>{deleteError}</Alert>
            : <Typography variant="body2" color={C.textSecondary}>
                Supprimer le code <strong style={{ fontFamily: 'monospace', letterSpacing: 1.5 }}>{deleteTarget?.code}</strong> ?
                Cette action est irréversible.
              </Typography>
          }
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setDeleteTarget(null)} sx={{ textTransform: 'none', color: C.grey }}>Annuler</Button>
          {!deleteError && (
            <Button variant="contained" onClick={handleDelete} disabled={deleting}
              startIcon={deleting ? <CircularProgress size={14} color="inherit" /> : null}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '10px', bgcolor: C.red, '&:hover': { bgcolor: '#c0392b' } }}>
              {deleting ? 'Suppression…' : 'Supprimer'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.severity} onClose={() => setSnack(s => ({ ...s, open: false }))} sx={{ borderRadius: '10px' }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
