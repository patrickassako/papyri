import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Link,
} from '@mui/material';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import * as authService from '../services/auth.service';
import papyriLogo from '../assets/papyri-wordmark-150x50.png';

export default function MfaVerifyPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [factorId, setFactorId] = useState(null);
  const inputRef = useRef(null);

  /* Récupérer le facteur TOTP vérifié de l'utilisateur */
  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data }) => {
      const factor = data?.totp?.find((f) => f.status === 'verified');
      if (!factor) {
        // Pas de 2FA configurée — rediriger directement
        redirectAfterLogin();
        return;
      }
      setFactorId(factor.id);
      setTimeout(() => inputRef.current?.focus(), 100);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function redirectAfterLogin() {
    const user = await authService.getUser().catch(() => null);
    const role = user?.role;
    if (role === 'admin') navigate('/admin/dashboard', { replace: true });
    else if (role === 'publisher') navigate('/publisher/dashboard', { replace: true });
    else navigate('/dashboard', { replace: true });
  }

  const handleVerify = async (e) => {
    e?.preventDefault();
    if (code.length !== 6 || !factorId) return;
    setError('');
    setLoading(true);

    try {
      /* Créer un challenge */
      const { data: challengeData, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeErr) throw challengeErr;

      /* Vérifier le code */
      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      });
      if (verifyErr) throw verifyErr;

      /* Synchroniser la session Supabase enrichie (aal2) dans le storage */
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session) {
        authService.syncSession(sessionData.session);
      }

      await redirectAfterLogin();
    } catch (err) {
      setError('Code incorrect ou expiré. Vérifiez votre application et réessayez.');
      setCode('');
      setTimeout(() => inputRef.current?.focus(), 50);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await authService.logout();
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        px: 2,
      }}
    >
      <Box
        component="form"
        onSubmit={handleVerify}
        sx={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
      >
        {/* Logo */}
        <Box
          component="img"
          src={papyriLogo}
          alt="Papyri"
          onClick={() => navigate('/')}
          sx={{ height: 44, objectFit: 'contain', cursor: 'pointer', mb: 4 }}
        />

        {/* Icône */}
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: '16px',
            bgcolor: 'rgba(242, 158, 13, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 3,
          }}
        >
          <ShieldOutlinedIcon sx={{ fontSize: 32, color: '#f29e0d' }} />
        </Box>

        <Typography variant="h1" sx={{ fontSize: { xs: '22px', sm: '26px' }, fontWeight: 700, textAlign: 'center', mb: 1 }}>
          Vérification en deux étapes
        </Typography>
        <Typography sx={{ fontSize: '14px', color: 'text.secondary', textAlign: 'center', mb: 4, lineHeight: 1.6 }}>
          Ouvrez votre application d'authentification et entrez le code à 6 chiffres affiché pour <strong>Papyri</strong>.
        </Typography>

        {error && (
          <Alert severity="error" onClose={() => setError('')} sx={{ width: '100%', mb: 2.5, borderRadius: '10px' }}>
            {error}
          </Alert>
        )}

        <TextField
          inputRef={inputRef}
          fullWidth
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000 000"
          inputProps={{ inputMode: 'numeric', maxLength: 6, style: { textAlign: 'center', fontSize: '1.8rem', letterSpacing: '0.3em', fontWeight: 700 } }}
          sx={{
            mb: 3,
            '& .MuiOutlinedInput-root': {
              borderRadius: '12px',
              height: 72,
            },
          }}
          disabled={loading || !factorId}
        />

        <Button
          type="submit"
          fullWidth
          disabled={code.length !== 6 || loading || !factorId}
          sx={{
            height: 48,
            borderRadius: '24px',
            fontSize: '15px',
            fontWeight: 700,
            textTransform: 'none',
            bgcolor: '#f29e0d',
            color: '#fff',
            mb: 2,
            '&:hover': { bgcolor: '#d4870a' },
            '&.Mui-disabled': { bgcolor: 'rgba(0,0,0,0.12)', color: 'rgba(0,0,0,0.26)' },
          }}
        >
          {loading
            ? <CircularProgress size={20} sx={{ color: '#fff' }} />
            : 'Confirmer'}
        </Button>

        <Typography sx={{ fontSize: '13px', color: 'text.secondary', textAlign: 'center' }}>
          Ce n'est pas vous ?{' '}
          <Link
            component="button"
            type="button"
            onClick={handleLogout}
            sx={{ color: 'primary.main', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
          >
            Se déconnecter
          </Link>
        </Typography>
      </Box>
    </Box>
  );
}
