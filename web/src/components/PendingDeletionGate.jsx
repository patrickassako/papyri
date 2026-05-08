import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  CircularProgress,
  Alert,
} from '@mui/material';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import RestoreOutlinedIcon from '@mui/icons-material/RestoreOutlined';
import { useTranslation } from 'react-i18next';
import { authFetch } from '../services/auth.service';
import * as authService from '../services/auth.service';
import { API_BASE_URL } from '../config/api';

/**
 * Wrap any authenticated layout. If the current user has a pending GDPR
 * deletion request, show a blocking screen with two actions: cancel deletion
 * or sign out. The user cannot use the app while a deletion is pending.
 *
 * Public routes (login, landing, etc.) should NOT be wrapped — only the
 * authenticated layouts.
 */
export default function PendingDeletionGate({ children }) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith('fr') ? 'fr-FR' : 'en-US';
  const [loading, setLoading] = useState(true);
  const [pendingRequest, setPendingRequest] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const fetchStatus = async () => {
    try {
      const res = await authFetch(`${API_BASE_URL}/users/me/gdpr-requests`);
      if (!res.ok) {
        setPendingRequest(null);
        setLoading(false);
        return;
      }
      const data = await res.json().catch(() => ({}));
      const pending = (data?.data || []).find(
        (r) => r.request_type === 'deletion' && r.status === 'pending'
      );
      setPendingRequest(pending || null);
    } catch (_) {
      // If unauthenticated or network error, let the children render — auth-lost
      // listener will kick in elsewhere if needed.
      setPendingRequest(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Re-check when window regains focus (after user comes back to tab)
    const handleFocus = () => fetchStatus();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancel = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await authFetch(`${API_BASE_URL}/users/me/gdpr-request/cancel`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Cancel failed');
      }
      setPendingRequest(null);
    } catch (err) {
      setError(err.message || t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (_) {}
    navigate('/');
  };

  if (loading) return null; // brief flash; let parent loading handle it

  if (!pendingRequest) return children;

  const deadline = pendingRequest.deadline_at
    ? new Date(pendingRequest.deadline_at).toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' })
    : null;

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: '#fdf6ec', p: 3 }}>
      <Paper elevation={0} sx={{ maxWidth: 520, width: '100%', p: { xs: 3, md: 5 }, borderRadius: 4, border: '1px solid #f1d9a8', bgcolor: '#fff', textAlign: 'center' }}>
        <Box sx={{ mx: 'auto', mb: 2, width: 72, height: 72, borderRadius: '50%', bgcolor: '#fff5e6', display: 'grid', placeItems: 'center' }}>
          <WarningAmberOutlinedIcon sx={{ fontSize: 36, color: '#dc2626' }} />
        </Box>
        <Typography sx={{ fontWeight: 800, fontSize: '1.4rem', color: '#1c160d', mb: 1 }}>
          {t('deletionGate.title', { defaultValue: 'Suppression du compte en cours' })}
        </Typography>
        <Typography sx={{ color: '#5f513d', mb: 1, fontSize: '0.95rem', lineHeight: 1.55 }}>
          {t('deletionGate.body', {
            defaultValue: 'Vous avez demandé la suppression de votre compte. L\'application est temporairement indisponible.',
          })}
        </Typography>
        {deadline && (
          <Typography sx={{ color: '#9c7e49', mb: 3, fontSize: '0.88rem', fontWeight: 600 }}>
            {t('deletionGate.deadline', { date: deadline, defaultValue: `Suppression définitive prévue le ${deadline}.` })}
          </Typography>
        )}

        {error && <Alert severity="error" sx={{ mb: 2, textAlign: 'left' }}>{error}</Alert>}

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center">
          <Button
            variant="contained"
            startIcon={busy ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <RestoreOutlinedIcon />}
            disabled={busy}
            onClick={handleCancel}
            sx={{
              bgcolor: '#1F7A39',
              color: '#fff',
              fontWeight: 700,
              textTransform: 'none',
              borderRadius: 3,
              px: 2.5,
              '&:hover': { bgcolor: '#176028' },
            }}
          >
            {t('deletionGate.cancelDeletion', { defaultValue: 'Annuler la suppression' })}
          </Button>
          <Button
            variant="outlined"
            startIcon={<LogoutIcon />}
            disabled={busy}
            onClick={handleLogout}
            sx={{
              borderColor: '#c0392b',
              color: '#c0392b',
              fontWeight: 700,
              textTransform: 'none',
              borderRadius: 3,
              px: 2.5,
              '&:hover': { borderColor: '#a93226', bgcolor: '#fdf0ef' },
            }}
          >
            {t('deletionGate.logout', { defaultValue: 'Se déconnecter' })}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
