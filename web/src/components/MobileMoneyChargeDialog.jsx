/**
 * MobileMoneyChargeDialog — web equivalent of the mobile MobileMoneyChargeModal.
 *
 * Drives the in-app Mobile Money flow:
 *   1) country picker
 *   2) operator picker (if multiple)
 *   3) customer info (fullname + phone)
 *   4) charge → wait/poll → success | failed
 *
 * Props:
 *   open          boolean
 *   onClose       () => void
 *   onSuccess     ({ type, reference, contentId? }) => void
 *   intent        'subscription' | 'content_unlock' | 'extra_seat'
 *   payload       { planId?, contentId?, targetUsersLimit?, usersLimit? }
 *   defaultFullname?  string
 */
import React, { useEffect, useState, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, MenuItem, List, ListItemButton, ListItemText,
  CircularProgress, Box, Typography, IconButton, Alert, Divider,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon     from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import { authFetch } from '../services/auth.service';
import { useTranslation } from 'react-i18next';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const POLL_INTERVAL_MS = 5000;
const POLL_MAX_ATTEMPTS = 24;

export default function MobileMoneyChargeDialog({
  open, onClose, onSuccess, intent, payload = {}, defaultFullname = '',
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [countries, setCountries] = useState([]);
  const [country, setCountry] = useState(null);
  const [operator, setOperator] = useState(null);
  const [fullname, setFullname] = useState(defaultFullname || '');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [chargeResp, setChargeResp] = useState(null);
  const [pollAttempt, setPollAttempt] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const pollTimer = useRef(null);

  useEffect(() => {
    if (open) {
      setStep(1); setCountry(null); setOperator(null);
      setFullname(defaultFullname || ''); setPhone('');
      setError(''); setChargeResp(null);
      setPollAttempt(0); setStatusMessage('');
      loadCountries();
    } else if (pollTimer.current) { clearTimeout(pollTimer.current); pollTimer.current = null; }
    return () => { if (pollTimer.current) clearTimeout(pollTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function loadCountries() {
    try {
      const r = await fetch(`${API}/api/payments/mobile-money/options`);
      const d = await r.json();
      if (d?.countries) setCountries(d.countries);
    } catch (_) {}
  }

  function pickCountry(c) {
    setCountry(c);
    if (c.operators?.length > 1) setStep(2);
    else { setOperator(c.operators?.[0] || null); setStep(3); }
  }

  async function submitCharge() {
    if (!fullname.trim()) { setError(t('mmModal.errFullname')); return; }
    if (!phone.trim()) { setError(t('mmModal.errPhone')); return; }
    setError(''); setBusy(true);
    try {
      const body = {
        intent,
        country: country.country,
        operator: operator?.code || null,
        phone: phone.trim(),
        fullname: fullname.trim(),
        ...(payload.planId ? { planId: payload.planId } : {}),
        ...(payload.contentId ? { contentId: payload.contentId } : {}),
        ...(payload.targetUsersLimit ? { targetUsersLimit: payload.targetUsersLimit } : {}),
        ...(payload.usersLimit ? { usersLimit: payload.usersLimit } : {}),
      };
      const r = await authFetch(`${API}/api/payments/mobile-money/charge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok || !d?.success) throw new Error(d?.error || t('mmModal.errPay'));
      setChargeResp(d);
      // Hosted page mode (e.g. Cameroun MoMo): full redirect.
      if (d.mode === 'hosted' && d.paymentLink) {
        window.location.href = d.paymentLink;
        return;
      }
      setStep(5);
      if (d.mode === 'redirect' && d.redirectUrl) {
        window.open(d.redirectUrl, '_blank');
      }
      setTimeout(() => pollStatus(d.reference, 0), 4000);
    } catch (e) {
      setError(e.message || t('mmModal.errPay'));
    } finally { setBusy(false); }
  }

  async function cancelCurrentCharge() {
    if (pollTimer.current) { clearTimeout(pollTimer.current); pollTimer.current = null; }
    const reference = chargeResp?.reference;
    if (reference) {
      try {
        await authFetch(`${API}/api/payments/${reference}/cancel`, { method: 'POST' });
      } catch (_) {}
    }
    onClose();
  }

  async function pollStatus(reference, attempt) {
    if (!reference) return;
    try {
      const r = await authFetch(`${API}/api/payments/${reference}/status`);
      const d = await r.json();
      if (d?.status === 'success') {
        setStep(6);
        if (typeof onSuccess === 'function') onSuccess({ type: d.type, reference, contentId: d.contentId });
        return;
      }
      if (d?.status === 'failed') {
        setStatusMessage(d.message || '');
        setStep(7); return;
      }
      if (attempt + 1 >= POLL_MAX_ATTEMPTS) {
        setStatusMessage(t('mmModal.timeoutBody'));
        setStep(7); return;
      }
      setPollAttempt(attempt + 1);
      pollTimer.current = setTimeout(() => pollStatus(reference, attempt + 1), POLL_INTERVAL_MS);
    } catch (_) {
      if (attempt + 1 < POLL_MAX_ATTEMPTS) {
        pollTimer.current = setTimeout(() => pollStatus(reference, attempt + 1), POLL_INTERVAL_MS);
      }
    }
  }

  // While we're waiting for the USSD confirmation (step 5) the dialog must
  // not be dismissible by backdrop click / Escape — only the "Annuler le
  // paiement" button can leave that screen, otherwise the user thinks the
  // payment was cancelled while it's still pending on Flutterwave's side.
  const isLockedStep = step === 5;
  const handleDialogClose = (_event, reason) => {
    if (isLockedStep && (reason === 'backdropClick' || reason === 'escapeKeyDown')) return;
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleDialogClose}
      maxWidth="xs"
      fullWidth
      disableEscapeKeyDown={isLockedStep}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {step > 1 && step < 5 && (
            <IconButton size="small" onClick={() => setStep(s => Math.max(1, s - 1))}>
              <ArrowBackIcon fontSize="small" />
            </IconButton>
          )}
          <Typography variant="subtitle1" fontWeight={800}>
            {step === 1 && t('mmModal.country')}
            {step === 2 && t('mmModal.operator')}
            {step === 3 && t('mmModal.info')}
            {step === 5 && t('mmModal.waitingTitle')}
            {step === 6 && t('mmModal.successTitle')}
            {step === 7 && t('mmModal.failedTitle')}
          </Typography>
        </Box>
        {!isLockedStep && (
          <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
        )}
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ p: 0 }}>
        {step === 1 && (
          <List>
            {countries.map(c => (
              <ListItemButton key={c.country} onClick={() => pickCountry(c)}>
                <ListItemText primary={c.label} secondary={`${c.currency} · +${c.dialingCode}`} />
              </ListItemButton>
            ))}
          </List>
        )}

        {step === 2 && country && (
          <List>
            {country.operators.map(op => (
              <ListItemButton key={op.code} onClick={() => { setOperator(op); setStep(3); }}>
                <ListItemText primary={op.label} />
              </ListItemButton>
            ))}
          </List>
        )}

        {step === 3 && country && (
          <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="caption" color="text.secondary">
              {country.label}{operator ? ` · ${operator.label}` : ''}
            </Typography>
            <TextField label={t('mmModal.fullname')} value={fullname} onChange={(e) => setFullname(e.target.value)}
              size="small" fullWidth />
            <TextField
              label={t('mmModal.phone')}
              value={phone} onChange={(e) => setPhone(e.target.value)}
              size="small" fullWidth
              InputProps={{ startAdornment: <Box sx={{ pr: 1, color: 'text.secondary', fontWeight: 700 }}>+{country.dialingCode}</Box> }}
              placeholder="6 71 23 45 67"
            />
            {error && <Alert severity="error">{error}</Alert>}
            <Button variant="contained" onClick={submitCharge} disabled={busy} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, py: 1.2 }}>
              {busy ? <CircularProgress size={20} color="inherit" /> : t('mmModal.pay')}
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
              {t('mmModal.noteSecure')}
            </Typography>
          </Box>
        )}

        {step === 5 && (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <PhoneIphoneIcon sx={{ fontSize: 56, color: 'primary.main' }} />
            <Typography variant="h6" fontWeight={800} sx={{ mt: 1 }}>
              {t('mmModal.waitingTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
              {chargeResp?.instructions || t('mmModal.waitingBody')}
            </Typography>
            {chargeResp?.ussdCode && (
              <Typography variant="h4" color="primary" fontWeight={800} sx={{ my: 1 }}>
                {chargeResp.ussdCode}
              </Typography>
            )}
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, mt: 2 }}>
              <CircularProgress size={16} />
              <Typography variant="caption" color="text.secondary">
                {t('mmModal.checking')} {pollAttempt}/{POLL_MAX_ATTEMPTS}
              </Typography>
            </Box>
            {chargeResp?.amount && chargeResp?.currency && (
              <Typography variant="subtitle2" sx={{ mt: 1 }}>
                {chargeResp.amount} {chargeResp.currency}
              </Typography>
            )}
            <Button onClick={cancelCurrentCharge} sx={{ mt: 3, textTransform: 'none' }} color="inherit">
              {t('mmModal.cancel')}
            </Button>
          </Box>
        )}

        {step === 6 && (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <CheckCircleIcon sx={{ fontSize: 72, color: 'success.main' }} />
            <Typography variant="h6" fontWeight={800} sx={{ mt: 1, color: 'success.main' }}>
              {t('mmModal.successTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {t('mmModal.successBody')}
            </Typography>
          </Box>
        )}

        {step === 7 && (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <ErrorOutlineIcon sx={{ fontSize: 64, color: 'error.main' }} />
            <Typography variant="h6" fontWeight={800} sx={{ mt: 1, color: 'error.main' }}>
              {t('mmModal.failedTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
              {statusMessage || t('mmModal.failedBody')}
            </Typography>
            <Button onClick={() => setStep(3)} variant="outlined" sx={{ borderRadius: 2, textTransform: 'none' }}>
              {t('mmModal.retry')}
            </Button>
          </Box>
        )}
      </DialogContent>

      {(step === 6 || step === 7) && (
        <DialogActions>
          <Button onClick={onClose} sx={{ textTransform: 'none' }}>{t('mmModal.close')}</Button>
        </DialogActions>
      )}
    </Dialog>
  );
}
