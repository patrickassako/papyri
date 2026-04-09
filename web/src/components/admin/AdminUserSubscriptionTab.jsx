import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import tokens from '../../config/tokens';
import * as adminService from '../../services/admin.service';

const C = {
  primary: tokens.colors.primary,
  green: '#27ae60',
  red: '#e74c3c',
  blue: '#2196F3',
  indigo: tokens.colors.accent,
  or: tokens.colors.secondary,
};

const PLAN_LABELS = { MONTHLY: 'Mensuel', YEARLY: 'Annuel', monthly: 'Mensuel', yearly: 'Annuel' };

function toInputDate(iso) {
  if (!iso) return '';
  return new Date(iso).toISOString().slice(0, 10);
}

export default function AdminUserSubscriptionTab({ userId, subscription, onUpdated }) {
  const [loading, setLoading] = useState(null);
  const [msg, setMsg] = useState(null);
  const [mode, setMode] = useState('view');
  const [form, setForm] = useState({});
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(false);

  useEffect(() => {
    setPlansLoading(true);
    adminService.getPlans()
      .then((d) => setPlans(d.plans || []))
      .catch(() => {})
      .finally(() => setPlansLoading(false));
  }, []);

  function openEdit() {
    setForm({
      plan_type: subscription.plan_type || 'MONTHLY',
      current_period_start: toInputDate(subscription.current_period_start),
      current_period_end: toInputDate(subscription.current_period_end),
      amount: subscription.amount ? Math.round(subscription.amount / 100) : 0,
      currency: subscription.currency || 'XAF',
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
    setLoading('extend');
    setMsg(null);
    try {
      const res = await adminService.extendSubscription(userId, months);
      setMsg({ type: 'success', text: `Prolongé de ${months} mois.` });
      onUpdated({ subscription: res.subscription });
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setLoading(null);
      setTimeout(() => setMsg(null), 3000);
    }
  }

  async function saveEdit() {
    setLoading('save');
    setMsg(null);
    try {
      const payload = {
        plan_type: form.plan_type,
        current_period_start: form.current_period_start ? new Date(form.current_period_start).toISOString() : undefined,
        current_period_end: form.current_period_end ? new Date(form.current_period_end).toISOString() : undefined,
        amount: form.amount ? Math.round(Number(form.amount) * 100) : 0,
        currency: form.currency,
      };
      const res = await adminService.updateSubscription(subscription.id, payload);
      setMsg({ type: 'success', text: 'Abonnement mis à jour.' });
      setMode('view');
      onUpdated({ subscription: res.subscription });
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setLoading(null);
      setTimeout(() => setMsg(null), 3000);
    }
  }

  async function saveCreate() {
    setLoading('create');
    setMsg(null);
    try {
      const res = await adminService.createSubscription({
        userId,
        plan_type: form.plan_type,
        current_period_start: form.current_period_start ? new Date(form.current_period_start).toISOString() : new Date().toISOString(),
        current_period_end: new Date(form.current_period_end).toISOString(),
        amount: form.amount ? Math.round(Number(form.amount) * 100) : 0,
        currency: form.currency,
      });
      setMsg({ type: 'success', text: 'Abonnement créé.' });
      setMode('view');
      onUpdated({ subscription: res.subscription });
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setLoading(null);
      setTimeout(() => setMsg(null), 3000);
    }
  }

  async function deleteSubscription() {
    if (!window.confirm('Supprimer définitivement cet abonnement ? Cette action est irréversible.')) return;
    setLoading('delete');
    setMsg(null);
    try {
      await adminService.deleteSubscription(subscription.id);
      setMsg({ type: 'success', text: 'Abonnement supprimé.' });
      setMode('view');
      onUpdated({ subscription: null });
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setLoading(null);
      setTimeout(() => setMsg(null), 3000);
    }
  }

  async function cancelSubscription() {
    if (!window.confirm('Annuler l\'abonnement actif ?')) return;
    setLoading('cancel');
    setMsg(null);
    try {
      await adminService.cancelSubscription(userId);
      setMsg({ type: 'success', text: 'Abonnement annulé.' });
      onUpdated({ subscription: null });
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setLoading(null);
      setTimeout(() => setMsg(null), 3000);
    }
  }

  function selectPlan(plan) {
    const start = form.current_period_start || toInputDate(new Date().toISOString());
    const endDate = new Date(start || Date.now());
    endDate.setDate(endDate.getDate() + plan.duration_days);
    const cycle = plan.metadata?.billing_cycle || (plan.duration_days >= 365 ? 'annual' : 'monthly');
    setForm((f) => ({
      ...f,
      plan_id: plan.id,
      plan_slug: plan.slug,
      plan_type: cycle === 'annual' ? 'YEARLY' : 'MONTHLY',
      amount: (plan.base_price_cents / 100).toFixed(2),
      currency: plan.currency,
      current_period_end: toInputDate(endDate.toISOString()),
    }));
  }

  if (mode === 'edit' || mode === 'create') {
    const isCreate = mode === 'create';
    return (
      <Box>
        {msg && <Alert severity={msg.type === 'error' ? 'error' : 'success'} sx={{ mb: 2, borderRadius: '10px' }} onClose={() => setMsg(null)}>{msg.text}</Alert>}

        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: C.indigo, mb: 2 }}>
          {isCreate ? 'Créer un abonnement' : 'Modifier l\'abonnement'}
        </Typography>

        <Typography variant="caption" sx={{ color: '#999', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', mb: 1 }}>
          Choisir un forfait
        </Typography>
        {plansLoading ? (
          <CircularProgress size={18} sx={{ mb: 2 }} />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2.5 }}>
            {plans.map((plan) => {
              const isSelected = form.plan_slug === plan.slug;
              const price = (plan.base_price_cents / 100).toFixed(2);
              const cycle = plan.metadata?.billing_cycle === 'annual' ? 'annuel' : 'mensuel';
              return (
                <Box
                  key={plan.id}
                  onClick={() => selectPlan(plan)}
                  sx={{
                    p: 1.5,
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    border: `2px solid ${isSelected ? C.primary : '#e0e0e0'}`,
                    bgcolor: isSelected ? `${C.primary}0D` : 'white',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    '&:hover': { borderColor: C.primary, bgcolor: `${C.primary}0A` },
                  }}
                >
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: isSelected ? C.primary : '#1a1a2e' }}>
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
        )}

        <Divider sx={{ mb: 2 }} />
        <Typography variant="caption" sx={{ color: '#999', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', mb: 1 }}>
          Ajustements manuels
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 2 }}>
          <Box>
            <Typography variant="caption" sx={{ color: '#999', fontWeight: 600, display: 'block', mb: 0.5 }}>Date début</Typography>
            <TextField type="date" size="small" fullWidth value={form.current_period_start}
              onChange={(e) => setForm((f) => ({ ...f, current_period_start: e.target.value }))}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: '#999', fontWeight: 600, display: 'block', mb: 0.5 }}>Date fin *</Typography>
            <TextField type="date" size="small" fullWidth value={form.current_period_end}
              onChange={(e) => setForm((f) => ({ ...f, current_period_end: e.target.value }))}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
          </Box>
        </Box>

        <Typography variant="caption" sx={{ color: '#999', fontWeight: 600, display: 'block', mb: 0.5 }}>Montant</Typography>
        <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
          <TextField size="small" type="number" value={form.amount} placeholder="0"
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
          <FormControl size="small" sx={{ minWidth: 90 }}>
            <Select value={form.currency || 'XAF'} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} sx={{ borderRadius: '10px' }}>
              {['XAF', 'EUR', 'USD', 'XOF'].map((currency) => <MenuItem key={currency} value={currency}>{currency}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button size="small" onClick={() => setMode('view')} sx={{ borderRadius: '10px', textTransform: 'none', color: '#888' }}>
            Annuler
          </Button>
          <Button size="small" variant="contained" disabled={!!loading} onClick={isCreate ? saveCreate : saveEdit}
            sx={{ borderRadius: '10px', textTransform: 'none', bgcolor: C.primary, '&:hover': { bgcolor: '#9a4f15' } }}>
            {loading ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : (isCreate ? 'Créer' : 'Enregistrer')}
          </Button>
        </Box>
      </Box>
    );
  }

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

  const info = [
    { label: 'Plan', value: PLAN_LABELS[subscription.plan_type] || subscription.plan_type },
    { label: 'Montant', value: subscription.amount ? `${Math.round(subscription.amount / 100).toLocaleString('fr-FR')} ${subscription.currency}` : '—' },
    { label: 'Début', value: subscription.current_period_start ? new Date(subscription.current_period_start).toLocaleDateString('fr-FR') : '—' },
    { label: 'Expire', value: subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString('fr-FR') : '—' },
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
        {info.map((item) => (
          <Box key={item.label} sx={{ bgcolor: '#f9f9f9', borderRadius: '10px', p: 1.5 }}>
            <Typography variant="caption" sx={{ color: '#999', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block' }}>
              {item.label}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, mt: 0.25 }}>{item.value}</Typography>
          </Box>
        ))}
      </Box>

      <Typography variant="caption" sx={{ color: '#999', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', mb: 1 }}>
        Prolonger rapidement
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
        {[{ months: 1, label: '+1 mois' }, { months: 3, label: '+3 mois' }, { months: 6, label: '+6 mois' }, { months: 12, label: '+1 an' }].map((opt) => (
          <Button key={opt.months} variant="outlined" size="small" disabled={loading === 'extend'} onClick={() => extend(opt.months)}
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
