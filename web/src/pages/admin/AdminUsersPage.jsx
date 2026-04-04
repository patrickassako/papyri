import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Box, Typography, Card, TextField, InputAdornment, Table, TableBody,
  TableCell, TableHead, TableRow, Chip, Avatar, IconButton, Drawer,
  Tabs, Tab, Button, CircularProgress, Alert, Divider, LinearProgress,
  Select, MenuItem as MuiMenuItem, FormControl, Tooltip, Skeleton,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from '@mui/material';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import tokens from '../../config/tokens';
import * as adminService from '../../services/admin.service';
import * as authService from '../../services/auth.service';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import papyriExportLogoUrl from '../../assets/papyri-export-logo.jpg';

const C = { primary: tokens.colors.primary, green: '#27ae60', red: '#e74c3c', blue: '#2196F3', indigo: tokens.colors.accent, or: tokens.colors.secondary, purple: '#7b1fa2' };

// ── Helpers ───────────────────────────────────────────────────────────────────
// Rôles par défaut (fallback si l'API n'est pas encore chargée)
const DEFAULT_ROLE_OPTS = [
  { value: 'user',      label: 'Utilisateur',   color: '#666',    bg: '#f5f5f5' },
  { value: 'admin',     label: 'Admin',          color: C.purple,  bg: '#ede7f6' },
  { value: 'publisher', label: 'Éditeur',        color: C.or,      bg: '#fff8e1' },
];

// Couleur selon le nom du rôle
function getRoleStyle(name) {
  if (name === 'admin')     return { color: C.purple, bg: '#ede7f6' };
  if (name === 'publisher') return { color: C.or,     bg: '#fff8e1' };
  if (name === 'user')      return { color: '#666',   bg: '#f5f5f5' };
  return { color: C.indigo, bg: '#e8eaf6' };
}

let ROLE_OPTS = DEFAULT_ROLE_OPTS; // sera remplacé dynamiquement
const PLAN_LABELS = { MONTHLY: 'Mensuel', YEARLY: 'Annuel', monthly: 'Mensuel', yearly: 'Annuel' };

function RoleChip({ role, roleOpts }) {
  const opts = roleOpts || ROLE_OPTS;
  const r = opts.find(o => o.value === role);
  const style = r ? { color: r.color, bg: r.bg } : getRoleStyle(role);
  const label = r ? r.label : role;
  return <Chip label={label} size="small" sx={{ bgcolor: style.bg, color: style.color, fontWeight: 700, fontSize: '11px', height: 22 }} />;
}

function StatusChip({ active }) {
  return (
    <Chip
      label={active ? 'Actif' : 'Bloqué'}
      size="small"
      icon={active ? <CheckCircleOutlineIcon sx={{ fontSize: '13px !important' }} /> : <BlockOutlinedIcon sx={{ fontSize: '13px !important' }} />}
      sx={{ bgcolor: active ? '#e8f5e9' : '#ffebee', color: active ? C.green : C.red, fontWeight: 700, fontSize: '11px', height: 22 }}
    />
  );
}

function ProgressBar({ percent }) {
  const pct = Math.min(100, Math.max(0, Number(percent) || 0));
  const color = pct >= 100 ? C.green : pct >= 50 ? C.blue : C.primary;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <LinearProgress variant="determinate" value={pct}
        sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: `${color}22`, '& .MuiLinearProgress-bar': { bgcolor: color } }} />
      <Typography variant="caption" sx={{ fontWeight: 700, color, minWidth: 34 }}>{pct.toFixed(0)}%</Typography>
    </Box>
  );
}

function formatTime(sec) {
  if (!sec) return '—';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`;
}

// ── Panel : Tab Profil ────────────────────────────────────────────────────────
function TabProfile({ profile, onUpdated, currentUserId, roleOpts = DEFAULT_ROLE_OPTS }) {
  const [editing, setEditing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState(null);
  const [form, setForm]         = useState({ full_name: profile.full_name || '', role: profile.role || 'user', is_active: profile.is_active });
  const [confirm, setConfirm]   = useState(null); // { title, body, onConfirm }

  useEffect(() => {
    setForm({ full_name: profile.full_name || '', role: profile.role || 'user', is_active: profile.is_active });
    setEditing(false);
  }, [profile.id]);

  const isSelf = profile.id === currentUserId;

  function requestSave() {
    // Require confirmation for critical changes
    const promotingToAdmin  = form.role === 'admin' && profile.role !== 'admin';
    const demotingFromAdmin = form.role !== 'admin' && profile.role === 'admin';
    const blocking          = form.is_active === false && profile.is_active === true;

    if (isSelf && (demotingFromAdmin || blocking)) {
      setMsg({ type: 'error', text: 'Vous ne pouvez pas modifier votre propre rôle admin ni désactiver votre compte.' });
      setTimeout(() => setMsg(null), 4000);
      return;
    }

    if (promotingToAdmin) {
      setConfirm({
        title: 'Accorder les droits administrateur ?',
        body: `${profile.email} aura un accès complet au back-office. Cette action est enregistrée dans l'audit trail.`,
        onConfirm: doSave,
      });
      return;
    }
    if (demotingFromAdmin) {
      setConfirm({
        title: 'Retirer les droits administrateur ?',
        body: `${profile.email} perdra l'accès au back-office. Cette action est enregistrée dans l'audit trail.`,
        onConfirm: doSave,
      });
      return;
    }
    if (blocking) {
      setConfirm({
        title: 'Bloquer cet utilisateur ?',
        body: `${profile.email} ne pourra plus se connecter. L'accès est coupé immédiatement.`,
        onConfirm: doSave,
      });
      return;
    }
    doSave();
  }

  async function doSave() {
    setConfirm(null);
    setSaving(true); setMsg(null);
    try {
      const res = await adminService.updateUser(profile.id, form);
      setMsg({ type: 'success', text: 'Profil mis à jour.' });
      setEditing(false);
      onUpdated(res.profile);
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
    finally { setSaving(false); }
    setTimeout(() => setMsg(null), 3000);
  }

  const field = (label, content) => (
    <Box sx={{ mb: 2 }}>
      <Typography variant="caption" sx={{ color: '#999', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', mb: 0.5 }}>{label}</Typography>
      {content}
    </Box>
  );

  return (
    <Box>
      {msg && <Alert severity={msg.type === 'error' ? 'error' : 'success'} sx={{ mb: 2, borderRadius: '10px' }} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        {!editing
          ? <Button size="small" startIcon={<EditOutlinedIcon />} onClick={() => setEditing(true)} variant="outlined"
              sx={{ borderRadius: '10px', textTransform: 'none', borderColor: C.indigo, color: C.indigo }}>
              Modifier
            </Button>
          : <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" onClick={() => setEditing(false)} sx={{ borderRadius: '10px', textTransform: 'none', color: '#666' }}>Annuler</Button>
              <Button size="small" startIcon={saving ? <CircularProgress size={14} /> : <SaveOutlinedIcon />}
                onClick={requestSave} disabled={saving} variant="contained"
                sx={{ borderRadius: '10px', textTransform: 'none', bgcolor: C.primary, '&:hover': { bgcolor: '#9a4f15' } }}>
                Enregistrer
              </Button>
            </Box>
        }
      </Box>

      {field('Email', <Typography variant="body2" sx={{ color: '#555', fontFamily: 'monospace', fontSize: 13 }}>{profile.email}</Typography>)}

      {field('Nom d\'affichage',
        editing
          ? <TextField fullWidth size="small" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
          : <Typography variant="body2">{profile.full_name || '—'}</Typography>
      )}

      {field('Rôle',
        editing
          ? <FormControl size="small" sx={{ minWidth: 160 }}>
              <Select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                sx={{ borderRadius: '10px' }}>
                {roleOpts.map(o => <MuiMenuItem key={o.value} value={o.value}>{o.label}</MuiMenuItem>)}
              </Select>
            </FormControl>
          : <RoleChip role={profile.role} roleOpts={roleOpts} />
      )}

      {field('Statut',
        editing
          ? <Box sx={{ display: 'flex', gap: 1 }}>
              {[{ v: true, label: 'Actif' }, { v: false, label: 'Bloqué' }].map(opt => (
                <Button key={String(opt.v)} size="small" onClick={() => setForm(f => ({ ...f, is_active: opt.v }))}
                  variant={form.is_active === opt.v ? 'contained' : 'outlined'}
                  sx={{
                    borderRadius: '10px', textTransform: 'none', fontWeight: 700,
                    ...(form.is_active === opt.v
                      ? { bgcolor: opt.v ? C.green : C.red, '&:hover': { bgcolor: opt.v ? '#219150' : '#c0392b' } }
                      : { borderColor: opt.v ? C.green : C.red, color: opt.v ? C.green : C.red }),
                  }}>
                  {opt.label}
                </Button>
              ))}
            </Box>
          : <StatusChip active={profile.is_active} />
      )}

      {field('Membre depuis',
        <Typography variant="body2" sx={{ color: '#555' }}>
          {profile.created_at ? new Date(profile.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
        </Typography>
      )}

      {field('ID', <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#aaa', wordBreak: 'break-all' }}>{profile.id}</Typography>)}

      {/* Confirmation dialog for critical role/status changes */}
      <Dialog open={Boolean(confirm)} onClose={() => setConfirm(null)} PaperProps={{ sx: { borderRadius: '16px', p: 1 } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1rem', pb: 0.5 }}>{confirm?.title}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: '0.875rem', color: '#555' }}>{confirm?.body}</DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setConfirm(null)} sx={{ borderRadius: '10px', textTransform: 'none', color: '#666' }}>Annuler</Button>
          <Button onClick={() => confirm?.onConfirm()} variant="contained" autoFocus
            sx={{ borderRadius: '10px', textTransform: 'none', bgcolor: C.primary, '&:hover': { bgcolor: '#9a4f15' } }}>
            Confirmer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ── Panel : Tab Abonnement ────────────────────────────────────────────────────
function toInputDate(iso) {
  if (!iso) return '';
  return new Date(iso).toISOString().slice(0, 10);
}

function TabSubscription({ userId, subscription, onUpdated }) {
  const [loading, setLoading] = useState(null);
  const [msg, setMsg]         = useState(null);
  const [mode, setMode]       = useState('view'); // 'view' | 'edit' | 'create'
  const [form, setForm]       = useState({});
  const [plans, setPlans]     = useState([]);
  const [plansLoading, setPlansLoading] = useState(false);

  useEffect(() => {
    setPlansLoading(true);
    adminService.getPlans()
      .then(d => setPlans(d.plans || []))
      .catch(() => {})
      .finally(() => setPlansLoading(false));
  }, []);

  function openEdit() {
    setForm({
      plan_type:            subscription.plan_type || 'MONTHLY',
      current_period_start: toInputDate(subscription.current_period_start),
      current_period_end:   toInputDate(subscription.current_period_end),
      amount:               subscription.amount ? Math.round(subscription.amount / 100) : 0,
      currency:             subscription.currency || 'XAF',
    });
    setMode('edit');
  }

  function openCreate() {
    const today = toInputDate(new Date().toISOString());
    const nextYear = toInputDate(new Date(Date.now() + 365 * 86400000).toISOString());
    setForm({ plan_type: 'MONTHLY', current_period_start: today, current_period_end: nextYear, amount: 0, currency: 'XAF' });
    setMode('create');
  }

  async function extend(months) {
    setLoading('extend'); setMsg(null);
    try {
      const res = await adminService.extendSubscription(userId, months);
      setMsg({ type: 'success', text: `Prolongé de ${months} mois.` });
      onUpdated({ subscription: res.subscription });
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
    finally { setLoading(null); setTimeout(() => setMsg(null), 3000); }
  }

  async function saveEdit() {
    setLoading('save'); setMsg(null);
    try {
      const payload = {
        plan_type:            form.plan_type,
        current_period_start: form.current_period_start ? new Date(form.current_period_start).toISOString() : undefined,
        current_period_end:   form.current_period_end   ? new Date(form.current_period_end).toISOString()   : undefined,
        amount:   form.amount ? Math.round(Number(form.amount) * 100) : 0,
        currency: form.currency,
      };
      const res = await adminService.updateSubscription(subscription.id, payload);
      setMsg({ type: 'success', text: 'Abonnement mis à jour.' });
      setMode('view');
      onUpdated({ subscription: res.subscription });
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
    finally { setLoading(null); setTimeout(() => setMsg(null), 3000); }
  }

  async function saveCreate() {
    setLoading('create'); setMsg(null);
    try {
      const res = await adminService.createSubscription({
        userId,
        plan_type:            form.plan_type,
        current_period_start: form.current_period_start ? new Date(form.current_period_start).toISOString() : new Date().toISOString(),
        current_period_end:   new Date(form.current_period_end).toISOString(),
        amount:   form.amount ? Math.round(Number(form.amount) * 100) : 0,
        currency: form.currency,
      });
      setMsg({ type: 'success', text: 'Abonnement créé.' });
      setMode('view');
      onUpdated({ subscription: res.subscription });
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
    finally { setLoading(null); setTimeout(() => setMsg(null), 3000); }
  }

  async function deleteSubscription() {
    if (!window.confirm('Supprimer définitivement cet abonnement ? Cette action est irréversible.')) return;
    setLoading('delete'); setMsg(null);
    try {
      await adminService.deleteSubscription(subscription.id);
      setMsg({ type: 'success', text: 'Abonnement supprimé.' });
      setMode('view');
      onUpdated({ subscription: null });
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
    finally { setLoading(null); setTimeout(() => setMsg(null), 3000); }
  }

  async function cancelSubscription() {
    if (!window.confirm('Annuler l\'abonnement actif ?')) return;
    setLoading('cancel'); setMsg(null);
    try {
      await adminService.cancelSubscription(userId);
      setMsg({ type: 'success', text: 'Abonnement annulé.' });
      onUpdated({ subscription: null });
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
    finally { setLoading(null); setTimeout(() => setMsg(null), 3000); }
  }

  // Sélectionner un forfait → pré-remplir montant + date fin
  function selectPlan(plan) {
    const start = form.current_period_start || toInputDate(new Date().toISOString());
    const endDate = new Date(start || Date.now());
    endDate.setDate(endDate.getDate() + plan.duration_days);
    const cycle = plan.metadata?.billing_cycle || (plan.duration_days >= 365 ? 'annual' : 'monthly');
    setForm(f => ({
      ...f,
      plan_id:   plan.id,
      plan_slug: plan.slug,
      plan_type: cycle === 'annual' ? 'YEARLY' : 'MONTHLY',
      amount:    (plan.base_price_cents / 100).toFixed(2),
      currency:  plan.currency,
      current_period_end: toInputDate(endDate.toISOString()),
    }));
  }

  // ── Formulaire (edit ou create) ──
  if (mode === 'edit' || mode === 'create') {
    const isCreate = mode === 'create';
    return (
      <Box>
        {msg && <Alert severity={msg.type === 'error' ? 'error' : 'success'} sx={{ mb: 2, borderRadius: '10px' }} onClose={() => setMsg(null)}>{msg.text}</Alert>}

        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: C.indigo, mb: 2 }}>
          {isCreate ? 'Créer un abonnement' : 'Modifier l\'abonnement'}
        </Typography>

        {/* Sélecteur de forfait */}
        <Typography variant="caption" sx={{ color: '#999', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', mb: 1 }}>
          Choisir un forfait
        </Typography>
        {plansLoading
          ? <CircularProgress size={18} sx={{ mb: 2 }} />
          : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2.5 }}>
              {plans.map(plan => {
                const isSelected = form.plan_slug === plan.slug;
                const price = (plan.base_price_cents / 100).toFixed(2);
                const cycle = plan.metadata?.billing_cycle === 'annual' ? 'annuel' : 'mensuel';
                return (
                  <Box key={plan.id} onClick={() => selectPlan(plan)}
                    sx={{
                      p: 1.5, borderRadius: '12px', cursor: 'pointer', transition: 'all 0.15s',
                      border: `2px solid ${isSelected ? C.primary : '#e0e0e0'}`,
                      bgcolor: isSelected ? `${C.primary}0D` : 'white',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      '&:hover': { borderColor: C.primary, bgcolor: `${C.primary}0A` },
                    }}>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: isSelected ? C.primary : C.textPrimary }}>
                        {plan.display_name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#999' }}>
                        {plan.description}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right', flexShrink: 0, ml: 2 }}>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: isSelected ? C.primary : C.indigo }}>
                        {price} {plan.currency}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#aaa' }}>/{cycle}</Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )
        }

        <Divider sx={{ mb: 2 }} />
        <Typography variant="caption" sx={{ color: '#999', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', mb: 1 }}>
          Ajustements manuels
        </Typography>

        {/* Dates */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 2 }}>
          <Box>
            <Typography variant="caption" sx={{ color: '#999', fontWeight: 600, display: 'block', mb: 0.5 }}>Date début</Typography>
            <TextField type="date" size="small" fullWidth value={form.current_period_start}
              onChange={e => setForm(f => ({ ...f, current_period_start: e.target.value }))}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: '#999', fontWeight: 600, display: 'block', mb: 0.5 }}>Date fin *</Typography>
            <TextField type="date" size="small" fullWidth value={form.current_period_end}
              onChange={e => setForm(f => ({ ...f, current_period_end: e.target.value }))}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
          </Box>
        </Box>

        {/* Montant */}
        <Typography variant="caption" sx={{ color: '#999', fontWeight: 600, display: 'block', mb: 0.5 }}>Montant</Typography>
        <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
          <TextField size="small" type="number" value={form.amount} placeholder="0"
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
          <FormControl size="small" sx={{ minWidth: 90 }}>
            <Select value={form.currency || 'XAF'} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
              sx={{ borderRadius: '10px' }}>
              {['XAF', 'EUR', 'USD', 'XOF'].map(c => <MuiMenuItem key={c} value={c}>{c}</MuiMenuItem>)}
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button size="small" onClick={() => setMode('view')} sx={{ borderRadius: '10px', textTransform: 'none', color: '#888' }}>Annuler</Button>
          <Button size="small" variant="contained" disabled={!!loading}
            onClick={isCreate ? saveCreate : saveEdit}
            sx={{ borderRadius: '10px', textTransform: 'none', bgcolor: C.primary, '&:hover': { bgcolor: '#9a4f15' } }}>
            {loading ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : (isCreate ? 'Créer' : 'Enregistrer')}
          </Button>
        </Box>
      </Box>
    );
  }

  // ── Vue sans abonnement ──
  if (!subscription) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <CreditCardOutlinedIcon sx={{ fontSize: 40, color: '#ccc' }} />
        <Typography variant="body2" sx={{ color: '#aaa', mt: 1, mb: 2 }}>Aucun abonnement actif</Typography>
        {msg && <Alert severity={msg.type === 'error' ? 'error' : 'success'} sx={{ mb: 2, borderRadius: '10px', textAlign: 'left' }} onClose={() => setMsg(null)}>{msg.text}</Alert>}
        <Button variant="contained" size="small" onClick={openCreate}
          sx={{ borderRadius: '10px', textTransform: 'none', bgcolor: C.primary, '&:hover': { bgcolor: '#9a4f15' } }}>
          + Créer un abonnement
        </Button>
      </Box>
    );
  }

  // ── Vue normale ──
  const info = [
    { label: 'Plan',    value: PLAN_LABELS[subscription.plan_type] || subscription.plan_type },
    { label: 'Montant', value: subscription.amount ? `${Math.round(subscription.amount / 100).toLocaleString('fr-FR')} ${subscription.currency}` : '—' },
    { label: 'Début',   value: subscription.current_period_start ? new Date(subscription.current_period_start).toLocaleDateString('fr-FR') : '—' },
    { label: 'Expire',  value: subscription.current_period_end   ? new Date(subscription.current_period_end).toLocaleDateString('fr-FR') : '—' },
  ];

  return (
    <Box>
      {msg && <Alert severity={msg.type === 'error' ? 'error' : 'success'} sx={{ mb: 2, borderRadius: '10px' }} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Chip label="Actif" size="small" sx={{ bgcolor: '#e8f5e9', color: C.green, fontWeight: 700 }} />
        <Button size="small" startIcon={<EditOutlinedIcon sx={{ fontSize: 14 }} />} onClick={openEdit}
          variant="outlined" sx={{ borderRadius: '10px', textTransform: 'none', borderColor: C.indigo, color: C.indigo, fontSize: 12 }}>
          Modifier
        </Button>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 3 }}>
        {info.map(it => (
          <Box key={it.label} sx={{ bgcolor: '#f9f9f9', borderRadius: '10px', p: 1.5 }}>
            <Typography variant="caption" sx={{ color: '#999', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block' }}>{it.label}</Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, mt: 0.25 }}>{it.value}</Typography>
          </Box>
        ))}
      </Box>

      <Typography variant="caption" sx={{ color: '#999', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', mb: 1 }}>Prolonger rapidement</Typography>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
        {[{ months: 1, label: '+1 mois' }, { months: 3, label: '+3 mois' }, { months: 6, label: '+6 mois' }, { months: 12, label: '+1 an' }].map(opt => (
          <Button key={opt.months} variant="outlined" size="small"
            disabled={loading === 'extend'}
            onClick={() => extend(opt.months)}
            sx={{ borderRadius: '10px', textTransform: 'none', borderColor: C.blue, color: C.blue, fontSize: 12 }}>
            {loading === 'extend' ? <CircularProgress size={12} /> : opt.label}
          </Button>
        ))}
      </Box>

      <Divider sx={{ mb: 2 }} />
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button variant="outlined" size="small" disabled={!!loading} onClick={cancelSubscription}
          sx={{ borderRadius: '10px', textTransform: 'none', borderColor: C.or, color: C.or, fontSize: 12 }}>
          {loading === 'cancel' ? <CircularProgress size={12} /> : 'Annuler'}
        </Button>
        <Button variant="outlined" size="small" disabled={!!loading} onClick={deleteSubscription}
          sx={{ borderRadius: '10px', textTransform: 'none', borderColor: C.red, color: C.red, fontSize: 12 }}>
          {loading === 'delete' ? <CircularProgress size={12} /> : 'Supprimer'}
        </Button>
      </Box>
    </Box>
  );
}

// ── Panel : Tab Accès livres ──────────────────────────────────────────────────
function TabUnlocks({ userId, unlocks, setUnlocks }) {
  const [grantOpen, setGrantOpen] = useState(false);
  const [revoking, setRevoking]   = useState(null);
  const [msg, setMsg]             = useState(null);
  const [searchQ, setSearchQ]     = useState('');
  const [searchRes, setSearchRes] = useState([]);
  const [searching, setSearching] = useState(false);
  const [granting, setGranting]   = useState(null);
  const debounce = useRef(null);

  function searchContent(q) {
    clearTimeout(debounce.current);
    if (!q.trim()) { setSearchRes([]); return; }
    debounce.current = setTimeout(() => {
      setSearching(true);
      adminService.searchContents(q)
        .then(d => setSearchRes(d.contents || []))
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 300);
  }

  async function revoke(unlock) {
    if (!window.confirm(`Retirer l'accès à "${unlock.contents?.title}" ?`)) return;
    setRevoking(unlock.id);
    try {
      await adminService.revokeBook(unlock.id);
      setUnlocks(prev => prev.filter(u => u.id !== unlock.id));
      setMsg({ type: 'success', text: 'Accès retiré.' });
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
    finally { setRevoking(null); setTimeout(() => setMsg(null), 3000); }
  }

  async function grant(content) {
    setGranting(content.id);
    try {
      const res = await adminService.grantBook(userId, content.id);
      setUnlocks(prev => [res.unlock, ...prev]);
      setMsg({ type: 'success', text: `Accès accordé : ${content.title}` });
      setGrantOpen(false);
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
    finally { setGranting(null); }
  }

  const SOURCE_LABELS = {
    quota: { label: 'Quota', color: C.blue, bg: '#e3f2fd' },
    bonus: { label: 'Bonus', color: C.or, bg: '#fff8e1' },
    paid: { label: 'Achat', color: C.green, bg: '#e8f5e9' },
    admin_grant: { label: 'Admin', color: C.primary, bg: '#fff3e0' },
  };

  return (
    <Box>
      {msg && <Alert severity={msg.type === 'error' ? 'error' : 'success'} sx={{ mb: 2, borderRadius: '10px' }} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button size="small" variant="contained" startIcon={<AddOutlinedIcon />}
          onClick={() => setGrantOpen(true)}
          sx={{ borderRadius: '10px', textTransform: 'none', bgcolor: C.primary, '&:hover': { bgcolor: '#9a4f15' } }}>
          Attribuer un livre
        </Button>
      </Box>

      {grantOpen && (
        <Box sx={{ mb: 2, p: 2, bgcolor: '#fafafa', borderRadius: '12px', border: '1px solid #eee' }}>
          <TextField fullWidth size="small" placeholder="Rechercher un titre ou un auteur…"
            value={searchQ} onChange={e => { setSearchQ(e.target.value); searchContent(e.target.value); }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchOutlinedIcon sx={{ fontSize: 18, color: '#aaa' }} /></InputAdornment> }}
            sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
            autoFocus
          />
          {searching && <Box sx={{ textAlign: 'center', py: 1 }}><CircularProgress size={18} /></Box>}
          {searchRes.map(c => (
            <Box key={c.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1, borderBottom: '1px solid #f0f0f0' }}>
              {c.cover_url
                ? <img src={c.cover_url} alt="" style={{ width: 28, height: 40, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                : <Box sx={{ width: 28, height: 40, bgcolor: '#eee', borderRadius: '4px', flexShrink: 0 }} />
              }
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</Typography>
                <Typography variant="caption" sx={{ color: '#aaa' }}>{c.author}</Typography>
              </Box>
              <Button size="small" variant="contained" disabled={granting === c.id} onClick={() => grant(c)}
                sx={{ flexShrink: 0, borderRadius: '8px', textTransform: 'none', bgcolor: C.primary, '&:hover': { bgcolor: '#9a4f15' }, fontSize: '12px', py: 0.5 }}>
                {granting === c.id ? <CircularProgress size={12} sx={{ color: '#fff' }} /> : 'Attribuer'}
              </Button>
            </Box>
          ))}
          {!searching && searchQ.trim() && searchRes.length === 0 && (
            <Typography variant="caption" sx={{ color: '#aaa', textAlign: 'center', display: 'block', py: 1 }}>Aucun résultat</Typography>
          )}
          <Button size="small" onClick={() => { setGrantOpen(false); setSearchQ(''); setSearchRes([]); }}
            sx={{ mt: 1, textTransform: 'none', color: '#aaa' }}>Fermer</Button>
        </Box>
      )}

      {unlocks.length === 0
        ? <Typography variant="body2" sx={{ color: '#aaa', textAlign: 'center', py: 3 }}>Aucun accès attribué</Typography>
        : unlocks.map(u => {
          const c = u.contents;
          const src = SOURCE_LABELS[u.source] || { label: u.source, color: '#666', bg: '#f5f5f5' };
          return (
            <Box key={u.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.2, borderBottom: '1px solid #f5f5f5' }}>
              {c?.cover_url
                ? <img src={c.cover_url} alt="" style={{ width: 28, height: 40, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                : <Box sx={{ width: 28, height: 40, bgcolor: '#eee', borderRadius: '4px', flexShrink: 0 }} />
              }
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c?.title || '—'}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
                  <Typography variant="caption" sx={{ color: '#aaa' }}>{c?.author}</Typography>
                  <Chip label={src.label} size="small" sx={{ bgcolor: src.bg, color: src.color, fontWeight: 700, fontSize: '10px', height: 18 }} />
                </Box>
              </Box>
              <Tooltip title="Retirer l'accès">
                <IconButton size="small" disabled={revoking === u.id} onClick={() => revoke(u)}
                  sx={{ color: C.red, '&:hover': { bgcolor: '#ffebee' } }}>
                  {revoking === u.id ? <CircularProgress size={14} /> : <DeleteOutlineOutlinedIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
            </Box>
          );
        })
      }
    </Box>
  );
}

// ── Panel : Tab Historique ────────────────────────────────────────────────────
function TabHistory({ history }) {
  if (!history.length) return (
    <Typography variant="body2" sx={{ color: '#aaa', textAlign: 'center', py: 3 }}>Aucune lecture enregistrée</Typography>
  );
  return (
    <Box>
      {history.map(h => {
        const c = h.contents;
        return (
          <Box key={h.id} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, py: 1.5, borderBottom: '1px solid #f5f5f5' }}>
            {c?.cover_url
              ? <img src={c.cover_url} alt="" style={{ width: 28, height: 40, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
              : <Box sx={{ width: 28, height: 40, bgcolor: '#eee', borderRadius: '4px', flexShrink: 0 }} />
            }
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c?.title || '—'}</Typography>
              <ProgressBar percent={h.progress_percent} />
              <Box sx={{ display: 'flex', gap: 1.5, mt: 0.5 }}>
                <Typography variant="caption" sx={{ color: '#aaa' }}>{formatTime(h.total_time_seconds)}</Typography>
                <Typography variant="caption" sx={{ color: '#aaa' }}>
                  {h.last_read_at ? new Date(h.last_read_at).toLocaleDateString('fr-FR') : ''}
                </Typography>
                {h.is_completed && <Chip label="Terminé" size="small" sx={{ bgcolor: '#e8f5e9', color: C.green, fontWeight: 700, fontSize: '10px', height: 16 }} />}
              </Box>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

// ── Side Panel ────────────────────────────────────────────────────────────────
function UserPanel({ userId, onClose, onUserUpdated, currentUserId, roleOpts }) {
  const [data, setData]       = useState(null);
  const [unlocks, setUnlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [tab, setTab]         = useState(0);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    adminService.getUser(userId)
      .then(d => { setData(d); setUnlocks(d.unlocks || []); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  function handleProfileUpdated(profile) {
    setData(prev => ({ ...prev, profile }));
    onUserUpdated(userId, { ...data, profile });
  }
  function handleSubUpdated({ subscription }) {
    setData(prev => ({ ...prev, subscription }));
  }

  return (
    <Box sx={{ width: 600, display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Panel header */}
      <Box sx={{ p: 2.5, borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 1.5 }}>
        {data && (
          <Avatar sx={{ width: 40, height: 40, bgcolor: C.indigo, fontWeight: 700 }}>
            {(data.profile.full_name || data.profile.email || '?').charAt(0).toUpperCase()}
          </Avatar>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {loading
            ? <><Skeleton width={120} height={18} /><Skeleton width={160} height={14} sx={{ mt: 0.5 }} /></>
            : <>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {data?.profile.full_name || '—'}
                </Typography>
                <Typography variant="caption" sx={{ color: '#999' }}>{data?.profile.email}</Typography>
              </>
          }
        </Box>
        <IconButton size="small" onClick={onClose}><CloseOutlinedIcon fontSize="small" /></IconButton>
      </Box>

      {loading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} /></Box>}
      {error && <Alert severity="error" sx={{ m: 2, borderRadius: '10px' }}>{error}</Alert>}

      {data && !loading && (
        <>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2, borderBottom: '1px solid #eee', minHeight: 44 }}
            TabIndicatorProps={{ style: { backgroundColor: C.primary } }}>
            {['Profil', 'Abonnement', `Accès (${unlocks.length})`, `Lectures (${data.history?.length || 0})`].map((label, i) => (
              <Tab key={i} label={label} sx={{ textTransform: 'none', fontWeight: 600, fontSize: '13px', minHeight: 44, px: 1.5, color: tab === i ? C.primary : '#888', '&.Mui-selected': { color: C.primary } }} />
            ))}
          </Tabs>

          <Box sx={{ flex: 1, overflow: 'auto', p: 2.5 }}>
            {tab === 0 && <TabProfile profile={data.profile} onUpdated={handleProfileUpdated} currentUserId={currentUserId} roleOpts={roleOpts} />}
            {tab === 1 && <TabSubscription userId={userId} subscription={data.subscription} onUpdated={handleSubUpdated} />}
            {tab === 2 && <TabUnlocks userId={userId} unlocks={unlocks} setUnlocks={setUnlocks} />}
            {tab === 3 && <TabHistory history={data.history || []} />}
          </Box>
        </>
      )}
    </Box>
  );
}

// ── Dialog : Inviter un utilisateur ──────────────────────────────────────────
function InviteDialog({ open, onClose, roleOpts, onInvited }) {
  const [email, setEmail]   = useState('');
  const [role, setRole]     = useState('user');
  const [sending, setSending] = useState(false);
  const [msg, setMsg]       = useState(null);

  useEffect(() => {
    if (open) { setEmail(''); setRole('user'); setMsg(null); }
  }, [open]);

  async function send() {
    if (!email.trim()) return;
    setSending(true); setMsg(null);
    try {
      await adminService.sendInvitation(email.trim(), role);
      setMsg({ type: 'success', text: `Invitation envoyée à ${email.trim()}` });
      onInvited();
      setTimeout(() => { onClose(); setMsg(null); }, 1500);
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
    finally { setSending(false); }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { borderRadius: '16px' } }}>
      <DialogTitle sx={{ fontWeight: 800, fontSize: '1.05rem', pb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <PersonAddOutlinedIcon sx={{ color: C.primary }} />
        Inviter un utilisateur
      </DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        {msg && (
          <Alert severity={msg.type === 'error' ? 'error' : 'success'}
            sx={{ mb: 2, borderRadius: '10px' }} onClose={() => setMsg(null)}>
            {msg.text}
          </Alert>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Adresse email" size="small" fullWidth type="email"
            value={email} onChange={e => setEmail(e.target.value)}
            placeholder="exemple@email.com"
            onKeyDown={e => { if (e.key === 'Enter') send(); }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
          />
          <FormControl size="small" fullWidth>
            <Typography variant="caption" sx={{ mb: 0.5, color: '#888', fontWeight: 600 }}>Rôle assigné</Typography>
            <Select value={role} onChange={e => setRole(e.target.value)} sx={{ borderRadius: '10px' }}>
              {roleOpts.map(o => (
                <MuiMenuItem key={o.value} value={o.value}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: o.color }} />
                    {o.label}
                  </Box>
                </MuiMenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography variant="caption" sx={{ color: '#aaa', lineHeight: 1.5 }}>
            L'utilisateur recevra un email avec un lien pour créer son mot de passe.
            Le lien expire dans 7 jours.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} sx={{ borderRadius: '10px', textTransform: 'none', color: '#666' }}>
          Annuler
        </Button>
        <Button onClick={send} variant="contained"
          disabled={sending || !email.trim()}
          startIcon={sending ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : <SendOutlinedIcon />}
          sx={{ borderRadius: '10px', textTransform: 'none', bgcolor: C.primary, '&:hover': { bgcolor: '#9a4f15' } }}>
          Envoyer l'invitation
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Section : Invitations en attente ─────────────────────────────────────────
function PendingInvitations({ invitations, roleOpts, onCancel, onResend }) {
  const pending = invitations.filter(i => !i.accepted_at);
  if (!pending.length) return null;

  return (
    <Box sx={{ mb: 3 }}>
      <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: C.indigo,
        textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1.5,
        display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <MailOutlineIcon sx={{ fontSize: 16 }} />
        Invitations en attente ({pending.length})
      </Typography>
      <Card sx={{ borderRadius: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        {pending.map((inv, idx) => {
          const roleOpt = roleOpts.find(r => r.value === inv.role);
          const isExpired = new Date(inv.expires_at) < new Date();
          return (
            <Box key={inv.id} sx={{
              display: 'flex', alignItems: 'center', gap: 2, px: 2.5, py: 1.5,
              borderBottom: idx < pending.length - 1 ? '1px solid #f5f5f5' : 'none',
              bgcolor: isExpired ? '#fff9f9' : 'white',
            }}>
              <MailOutlineIcon sx={{ fontSize: 18, color: isExpired ? '#e74c3c' : '#bbb', flexShrink: 0 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {inv.email}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
                  <Chip label={roleOpt?.label || inv.role} size="small"
                    sx={{ height: 18, fontSize: '10px', fontWeight: 700,
                      bgcolor: roleOpt?.bg || '#f5f5f5', color: roleOpt?.color || '#666' }} />
                  <Typography variant="caption" sx={{ color: isExpired ? '#e74c3c' : '#bbb' }}>
                    {isExpired ? 'Expirée' : `Expire le ${new Date(inv.expires_at).toLocaleDateString('fr-FR')}`}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                <Tooltip title="Renvoyer l'invitation">
                  <IconButton size="small" onClick={() => onResend(inv)}
                    sx={{ color: C.indigo, '&:hover': { bgcolor: '#e8eaf6' } }}>
                    <RefreshOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Annuler l'invitation">
                  <IconButton size="small" onClick={() => onCancel(inv)}
                    sx={{ color: C.red, '&:hover': { bgcolor: '#ffebee' } }}>
                    <DeleteOutlineOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          );
        })}
      </Card>
    </Box>
  );
}

// ── Filter chips definition ───────────────────────────────────────────────────
const FILTERS = [
  { key: 'all',       label: 'Tous',        role: undefined, is_active: undefined },
  { key: 'user',      label: 'Utilisateurs', role: 'user',   is_active: undefined },
  { key: 'admin',     label: 'Admins',       role: 'admin',  is_active: undefined },
  { key: 'publisher', label: 'Éditeurs',     role: 'publisher', is_active: undefined },
  { key: 'blocked',   label: 'Bloqués',      role: undefined, is_active: false },
];

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminUsersPage() {
  const [users, setUsers]               = useState([]);
  const [total, setTotal]               = useState(0);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [search, setSearch]             = useState('');
  const [page, setPage]                 = useState(1);
  const [selectedId, setSelectedId]     = useState(null);
  const [activeFilter, setActiveFilter]   = useState('all');
  const [currentUserId, setCurrentUserId] = useState(null);
  const [roleOpts, setRoleOpts]           = useState(DEFAULT_ROLE_OPTS);
  const [inviteOpen, setInviteOpen]       = useState(false);
  const [invitations, setInvitations]     = useState([]);
  const LIMIT = 20;
  const debounce = useRef(null);
  const [exporting, setExporting] = useState(null); // 'excel' | 'pdf' | null

  // Récupère TOUS les utilisateurs correspondant aux filtres actifs
  async function fetchAllForExport() {
    const f = FILTERS.find(x => x.key === activeFilter) || FILTERS[0];
    const params = { q: search, page: 1, limit: 9999 };
    if (f.role      !== undefined) params.role      = f.role;
    if (f.is_active !== undefined) params.is_active = f.is_active;
    const d = await adminService.getUsers(params);
    return d.users || [];
  }

  function userToRow(u) {
    const sub = u.subscription;
    const planLabel = sub
      ? (PLAN_LABELS[sub.plan_type] || sub.plan_type || 'Actif')
      : '—';
    const subStatus = sub
      ? (sub.status === 'active' ? 'Actif' : sub.status === 'cancelled' ? 'Annulé' : sub.status || 'Inactif')
      : '—';
    return {
      Nom:               u.full_name  || '—',
      Email:             u.email      || '—',
      Rôle:              u.role       || '—',
      Statut:            u.is_active === false ? 'Bloqué' : 'Actif',
      'Type abonnement': planLabel,
      'Statut abonnement': subStatus,
      Inscription:       u.created_at ? new Date(u.created_at).toLocaleDateString('fr-FR') : '—',
    };
  }

  async function loadLogoBase64() {
    const res = await fetch(papyriExportLogoUrl);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  }

  async function handleExportExcel() {
    setExporting('excel');
    try {
      const all = await fetchAllForExport();
      const filterLabel = FILTERS.find(f => f.key === activeFilter)?.label || 'Tous';
      const dateStr = new Date().toLocaleDateString('fr-FR');

      // Lignes d'en-tête branding
      const headerRows = [
        ['Papyri — Export Utilisateurs'],
        [`Filtre : ${filterLabel}${search ? ` | Recherche : "${search}"` : ''} | Exporté le ${dateStr} | ${all.length} utilisateur${all.length > 1 ? 's' : ''}`],
        [], // ligne vide
      ];

      const dataRows = all.map(userToRow);
      const ws = XLSX.utils.aoa_to_sheet(headerRows);
      XLSX.utils.sheet_add_json(ws, dataRows, { origin: headerRows.length, skipHeader: false });

      // Style largeurs colonnes
      ws['!cols'] = [{ wch: 28 }, { wch: 34 }, { wch: 14 }, { wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 14 }];

      // Fusionner la ligne titre
      ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Utilisateurs');
      XLSX.writeFile(wb, `papyri_utilisateurs_${filterLabel}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) { setError(e.message); }
    finally { setExporting(null); }
  }

  async function handleExportPDF() {
    setExporting('pdf');
    try {
      const [all, logoBase64] = await Promise.all([fetchAllForExport(), loadLogoBase64()]);
      const rows = all.map(userToRow);
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const filterLabel = FILTERS.find(f => f.key === activeFilter)?.label || 'Tous';
      const dateStr = new Date().toLocaleDateString('fr-FR');
      const pageW = doc.internal.pageSize.getWidth();

      // Logo 120×65 mm
      doc.addImage(logoBase64, 'JPEG', 14, 6, 120, 65);

      // Ligne de séparation
      doc.setDrawColor(220, 220, 220);
      doc.line(14, 75, pageW - 14, 75);

      // Infos export à droite
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(160, 160, 160);
      doc.text(`Exporté le ${dateStr}`, pageW - 14, 20, { align: 'right' });
      doc.text(`${rows.length} utilisateur${rows.length > 1 ? 's' : ''}`, pageW - 14, 27, { align: 'right' });

      // Titre + filtre
      doc.setFontSize(11);
      doc.setTextColor(44, 62, 80);
      doc.setFont('helvetica', 'bold');
      doc.text('Gestion des utilisateurs', 14, 83);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text(`Filtre : ${filterLabel}${search ? ` · Recherche : "${search}"` : ''}`, 14, 90);

      autoTable(doc, {
        startY: 95,
        head: [Object.keys(rows[0] || userToRow({}))],
        body: rows.map(r => Object.values(r)),
        headStyles: {
          fillColor: [26, 26, 46],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 8.5,
          cellPadding: 3,
        },
        bodyStyles: { fontSize: 8.5, cellPadding: 2.5, textColor: [50, 50, 50] },
        alternateRowStyles: { fillColor: [248, 249, 252] },
        columnStyles: {
          0: { cellWidth: 38 },
          1: { cellWidth: 55 },
          2: { cellWidth: 22 },
          3: { cellWidth: 18 },
          4: { cellWidth: 28 },
          5: { cellWidth: 28 },
          6: { cellWidth: 24 },
        },
        margin: { left: 14, right: 14 },
        didDrawPage: (data) => {
          // Pied de page
          const pageCount = doc.internal.getNumberOfPages();
          doc.setFontSize(7);
          doc.setTextColor(180, 180, 180);
          doc.text(
            `Papyri · Page ${data.pageNumber} / ${pageCount}`,
            pageW / 2, doc.internal.pageSize.getHeight() - 6,
            { align: 'center' }
          );
        },
      });

      doc.save(`papyri_utilisateurs_${filterLabel}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) { setError(e.message); }
    finally { setExporting(null); }
  }

  const loadInvitations = useCallback(() => {
    adminService.getInvitations()
      .then(d => setInvitations(d.invitations || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    authService.getUser().then(u => { if (u?.id) setCurrentUserId(u.id); }).catch(() => {});
    // Charger les rôles dynamiquement
    adminService.getRoles()
      .then(d => {
        const opts = (d.roles || []).map(r => {
          const style = getRoleStyle(r.name);
          return { value: r.name, label: r.display_name, ...style };
        });
        setRoleOpts(opts.length ? opts : DEFAULT_ROLE_OPTS);
        ROLE_OPTS = opts.length ? opts : DEFAULT_ROLE_OPTS;
      })
      .catch(() => {});
    loadInvitations();
  }, [loadInvitations]);

  function fetchUsers(q, p, filterKey = activeFilter) {
    const f = FILTERS.find(x => x.key === filterKey) || FILTERS[0];
    const params = { q, page: p, limit: LIMIT };
    if (f.role      !== undefined) params.role      = f.role;
    if (f.is_active !== undefined) params.is_active = f.is_active;
    setLoading(true); setError(null);
    adminService.getUsers(params)
      .then(d => { setUsers(d.users || []); setTotal(d.total || 0); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchUsers('', 1, 'all'); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSearch(q) {
    setSearch(q); setPage(1);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => fetchUsers(q, 1), 350);
  }

  function handleFilterChange(key) {
    setActiveFilter(key); setSearch(''); setPage(1);
    fetchUsers('', 1, key);
  }

  function handleUserUpdated(id, updatedData) {
    setUsers(prev => prev.map(u =>
      u.id === id ? { ...u, ...updatedData.profile } : u
    ));
  }

  async function handleCancelInvitation(inv) {
    try {
      await adminService.cancelInvitation(inv.id);
      setInvitations(prev => prev.filter(i => i.id !== inv.id));
    } catch (e) { setError(e.message); }
  }

  async function handleResendInvitation(inv) {
    try {
      await adminService.resendInvitation(inv.id);
      loadInvitations();
    } catch (e) { setError(e.message); }
  }

  const pages = Math.ceil(total / LIMIT);

  return (
    <Box sx={{ p: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: C.indigo, fontFamily: 'Playfair Display, serif', mb: 0.5 }}>
            Gestion des utilisateurs
          </Typography>
          <Typography variant="body2" sx={{ color: '#888' }}>
            {total.toLocaleString('fr-FR')} utilisateur{total > 1 ? 's' : ''}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Tooltip title="Exporter Excel (filtre actif)">
            <Button
              variant="outlined"
              size="small"
              startIcon={exporting === 'excel' ? <CircularProgress size={14} /> : <FileDownloadOutlinedIcon />}
              onClick={handleExportExcel}
              disabled={!!exporting}
              sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600, borderColor: '#27ae60', color: '#27ae60', '&:hover': { bgcolor: '#e8f5e9', borderColor: '#27ae60' } }}
            >
              Excel
            </Button>
          </Tooltip>
          <Tooltip title="Exporter PDF (filtre actif)">
            <Button
              variant="outlined"
              size="small"
              startIcon={exporting === 'pdf' ? <CircularProgress size={14} /> : <FileDownloadOutlinedIcon />}
              onClick={handleExportPDF}
              disabled={!!exporting}
              sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600, borderColor: '#e74c3c', color: '#e74c3c', '&:hover': { bgcolor: '#ffebee', borderColor: '#e74c3c' } }}
            >
              PDF
            </Button>
          </Tooltip>
          <Button variant="contained" startIcon={<PersonAddOutlinedIcon />}
            onClick={() => setInviteOpen(true)}
            sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700,
              bgcolor: C.primary, '&:hover': { bgcolor: '#9a4f15' } }}>
            Inviter
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }}>{error}</Alert>}

      {/* Invitations en attente */}
      <PendingInvitations
        invitations={invitations}
        roleOpts={roleOpts}
        onCancel={handleCancelInvitation}
        onResend={handleResendInvitation}
      />

      {/* Search + Filters */}
      <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Rechercher par email ou nom…"
          value={search}
          onChange={e => handleSearch(e.target.value)}
          sx={{ maxWidth: 320, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchOutlinedIcon sx={{ color: '#aaa', fontSize: 20 }} /></InputAdornment>
          }}
        />
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          {FILTERS.map(f => (
            <Chip
              key={f.key}
              label={f.label}
              size="small"
              onClick={() => handleFilterChange(f.key)}
              sx={{
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '12px',
                height: 28,
                bgcolor: activeFilter === f.key ? C.indigo : '#f0f0f0',
                color:   activeFilter === f.key ? '#fff' : '#666',
                '&:hover': { bgcolor: activeFilter === f.key ? C.indigo : '#e0e0e0' },
              }}
            />
          ))}
        </Box>
      </Box>

      {/* Table */}
      <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: '#fafafa' }}>
              {['Utilisateur', 'Rôle', 'Statut', 'Abonnement', 'Inscription', ''].map(h => (
                <TableCell key={h} sx={{ fontWeight: 700, fontSize: '11px', color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px', border: 0, py: 1.5 }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading
              ? [...Array(6)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(6)].map((_, j) => (
                      <TableCell key={j} sx={{ border: 0, py: 1.5 }}><Skeleton height={24} /></TableCell>
                    ))}
                  </TableRow>
                ))
              : users.map(u => (
                  <TableRow key={u.id}
                    onClick={() => setSelectedId(u.id)}
                    sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#fafafa' }, bgcolor: selectedId === u.id ? '#fff8f0' : 'transparent', transition: 'background 0.1s' }}>
                    <TableCell sx={{ border: 0, py: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{ width: 34, height: 34, bgcolor: C.indigo, fontSize: 13, fontWeight: 700 }}>
                          {(u.full_name || u.email || '?').charAt(0).toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>{u.full_name || '—'}</Typography>
                          <Typography variant="caption" sx={{ color: '#999' }}>{u.email}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ border: 0, py: 1.5 }}><RoleChip role={u.role} roleOpts={roleOpts} /></TableCell>
                    <TableCell sx={{ border: 0, py: 1.5 }}><StatusChip active={u.is_active} /></TableCell>
                    <TableCell sx={{ border: 0, py: 1.5 }}>
                      {u.subscription
                        ? <Chip label={PLAN_LABELS[u.subscription.plan_type] || u.subscription.plan_type} size="small"
                            sx={{ bgcolor: '#e3f2fd', color: C.blue, fontWeight: 700, fontSize: '11px', height: 22 }} />
                        : <Typography variant="caption" sx={{ color: '#ccc' }}>—</Typography>
                      }
                    </TableCell>
                    <TableCell sx={{ border: 0, py: 1.5 }}>
                      <Typography variant="caption" sx={{ color: '#999' }}>
                        {u.created_at ? new Date(u.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ border: 0, py: 1.5, textAlign: 'right' }}>
                      <IconButton size="small" sx={{ color: C.primary }}>
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
            }
          </TableBody>
        </Table>

        {/* Pagination */}
        {pages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, p: 2, borderTop: '1px solid #f0f0f0' }}>
            <Button size="small" disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); fetchUsers(search, p); }}
              sx={{ borderRadius: '8px', textTransform: 'none' }}>← Préc.</Button>
            <Typography variant="body2" sx={{ color: '#888' }}>Page {page} / {pages}</Typography>
            <Button size="small" disabled={page >= pages} onClick={() => { const p = page + 1; setPage(p); fetchUsers(search, p); }}
              sx={{ borderRadius: '8px', textTransform: 'none' }}>Suiv. →</Button>
          </Box>
        )}
      </Card>

      {/* Side Drawer */}
      <Drawer
        anchor="right"
        open={Boolean(selectedId)}
        onClose={() => setSelectedId(null)}
        PaperProps={{ sx: { width: 600, boxShadow: '-4px 0 24px rgba(0,0,0,0.08)' } }}
      >
        {selectedId && (
          <UserPanel
            userId={selectedId}
            onClose={() => setSelectedId(null)}
            onUserUpdated={handleUserUpdated}
            currentUserId={currentUserId}
            roleOpts={roleOpts}
          />
        )}
      </Drawer>

      {/* Dialog invitation */}
      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        roleOpts={roleOpts}
        onInvited={loadInvitations}
      />
    </Box>
  );
}
