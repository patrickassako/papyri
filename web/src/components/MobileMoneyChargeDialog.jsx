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

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const POLL_INTERVAL_MS = 5000;
const POLL_MAX_ATTEMPTS = 36;

export default function MobileMoneyChargeDialog({
  open, onClose, onSuccess, intent, payload = {}, defaultFullname = '',
}) {
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
    if (!fullname.trim()) { setError('Nom complet requis'); return; }
    if (!phone.trim()) { setError('Numéro requis'); return; }
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
      if (!r.ok || !d?.success) throw new Error(d?.error || 'Échec du paiement');
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
      setError(e.message || 'Erreur');
    } finally { setBusy(false); }
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
        setStatusMessage('Le paiement est toujours en cours. Vous serez notifié dès la confirmation.');
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

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {step > 1 && step < 5 && (
            <IconButton size="small" onClick={() => setStep(s => Math.max(1, s - 1))}>
              <ArrowBackIcon fontSize="small" />
            </IconButton>
          )}
          <Typography variant="subtitle1" fontWeight={800}>
            {step === 1 && 'Choisissez votre pays'}
            {step === 2 && 'Choisissez votre opérateur'}
            {step === 3 && 'Vos informations'}
            {step === 5 && 'Confirmez sur votre téléphone'}
            {step === 6 && 'Paiement confirmé'}
            {step === 7 && 'Paiement non confirmé'}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
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
            <TextField label="Nom complet" value={fullname} onChange={(e) => setFullname(e.target.value)}
              size="small" fullWidth />
            <TextField
              label="Numéro de téléphone"
              value={phone} onChange={(e) => setPhone(e.target.value)}
              size="small" fullWidth
              InputProps={{ startAdornment: <Box sx={{ pr: 1, color: 'text.secondary', fontWeight: 700 }}>+{country.dialingCode}</Box> }}
              placeholder="6 71 23 45 67"
            />
            {error && <Alert severity="error">{error}</Alert>}
            <Button variant="contained" onClick={submitCharge} disabled={busy} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, py: 1.2 }}>
              {busy ? <CircularProgress size={20} color="inherit" /> : 'Payer maintenant'}
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
              Vous serez débité directement via votre opérateur. Aucune carte requise.
            </Typography>
          </Box>
        )}

        {step === 5 && (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <PhoneIphoneIcon sx={{ fontSize: 56, color: 'primary.main' }} />
            <Typography variant="h6" fontWeight={800} sx={{ mt: 1 }}>
              Confirmez sur votre téléphone
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
              {chargeResp?.instructions ||
                'Un code USSD vient d\'être envoyé sur votre téléphone. Validez avec votre code PIN Mobile Money pour finaliser le paiement.'}
            </Typography>
            {chargeResp?.ussdCode && (
              <Typography variant="h4" color="primary" fontWeight={800} sx={{ my: 1 }}>
                {chargeResp.ussdCode}
              </Typography>
            )}
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, mt: 2 }}>
              <CircularProgress size={16} />
              <Typography variant="caption" color="text.secondary">
                Vérification… {pollAttempt}/{POLL_MAX_ATTEMPTS}
              </Typography>
            </Box>
            {chargeResp?.amount && chargeResp?.currency && (
              <Typography variant="subtitle2" sx={{ mt: 1 }}>
                {chargeResp.amount} {chargeResp.currency}
              </Typography>
            )}
          </Box>
        )}

        {step === 6 && (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <CheckCircleIcon sx={{ fontSize: 72, color: 'success.main' }} />
            <Typography variant="h6" fontWeight={800} sx={{ mt: 1, color: 'success.main' }}>
              Paiement confirmé !
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Votre achat est validé.
            </Typography>
          </Box>
        )}

        {step === 7 && (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <ErrorOutlineIcon sx={{ fontSize: 64, color: 'error.main' }} />
            <Typography variant="h6" fontWeight={800} sx={{ mt: 1, color: 'error.main' }}>
              Paiement non confirmé
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
              {statusMessage || 'Nous n\'avons pas pu confirmer votre paiement. Réessayez ou choisissez un autre moyen.'}
            </Typography>
            <Button onClick={() => setStep(3)} variant="outlined" sx={{ borderRadius: 2, textTransform: 'none' }}>
              Réessayer
            </Button>
          </Box>
        )}
      </DialogContent>

      {(step === 6 || step === 7) && (
        <DialogActions>
          <Button onClick={onClose} sx={{ textTransform: 'none' }}>Fermer</Button>
        </DialogActions>
      )}
    </Dialog>
  );
}
