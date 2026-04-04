import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Card, CardContent, TextField, Button, Alert, CircularProgress } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import tokens from '../../config/tokens';
import { verifyInvitationToken, activateAccount } from '../../services/publisher.service';
import papyriLogo from '../../assets/papyri-wordmark-150x50.png';

export default function PublisherActivatePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');

  const [tokenInfo, setTokenInfo] = useState(null);
  const [tokenError, setTokenError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({ password: '', confirm: '' });
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) { setTokenError('Token manquant.'); setLoading(false); return; }
    verifyInvitationToken(token)
      .then(res => setTokenInfo(res.publisher))
      .catch(e => setTokenError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleActivate() {
    setError(null);
    if (form.password !== form.confirm) { setError('Les mots de passe ne correspondent pas.'); return; }
    if (form.password.length < 8) { setError('Minimum 8 caractères.'); return; }
    setActivating(true);
    try {
      await activateAccount({ token, password: form.password, fullName: tokenInfo?.contactName });
      setDone(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setActivating(false);
    }
  }

  if (loading) {
    return <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '100vh', bgcolor: '#FAFAFA', p: 3 }}>
      <Card sx={{ borderRadius: '20px', boxShadow: '0 8px 32px rgba(0,0,0,0.1)', maxWidth: 480, width: '100%' }}>
        <CardContent sx={{ p: 5 }}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box component="img" src={papyriLogo} alt="Papyri" sx={{ height: 42, objectFit: 'contain', mb: 1 }} />
            <Typography variant="body2" sx={{ color: '#9E9E9E' }}>Espace Éditeur</Typography>
          </Box>

          {tokenError ? (
            <Box sx={{ textAlign: 'center' }}>
              <ErrorOutlineIcon sx={{ fontSize: 64, color: '#F44336', mb: 2 }} />
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Lien invalide</Typography>
              <Typography variant="body2" sx={{ color: '#757575' }}>{tokenError}</Typography>
            </Box>
          ) : done ? (
            <Box sx={{ textAlign: 'center' }}>
              <CheckCircleOutlineIcon sx={{ fontSize: 64, color: '#4CAF50', mb: 2 }} />
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Compte activé !</Typography>
              <Typography variant="body2" sx={{ color: '#757575', mb: 3 }}>
                Votre compte éditeur est maintenant actif. Vous pouvez vous connecter.
              </Typography>
              <Button variant="contained" onClick={() => navigate('/login')} sx={{ bgcolor: tokens.colors.primary, borderRadius: '12px', textTransform: 'none', fontWeight: 700 }}>
                Se connecter
              </Button>
            </Box>
          ) : (
            <>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                Bienvenue, {tokenInfo?.contactName} !
              </Typography>
              <Typography variant="body2" sx={{ color: '#757575', mb: 3 }}>
                Créez votre mot de passe pour activer votre compte éditeur <strong>{tokenInfo?.companyName}</strong>.
              </Typography>

              {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>{error}</Alert>}

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Mot de passe *"
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  fullWidth
                  helperText="Minimum 8 caractères"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                />
                <TextField
                  label="Confirmer le mot de passe *"
                  type="password"
                  value={form.confirm}
                  onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                  fullWidth
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                />
                <Button
                  variant="contained"
                  onClick={handleActivate}
                  disabled={activating || !form.password || !form.confirm}
                  startIcon={activating ? <CircularProgress size={16} color="inherit" /> : null}
                  fullWidth
                  sx={{ bgcolor: tokens.colors.primary, borderRadius: '12px', textTransform: 'none', fontWeight: 700, py: 1.5, mt: 1 }}
                >
                  Activer mon compte
                </Button>
              </Box>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
