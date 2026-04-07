import React, { useEffect, useRef, useState } from 'react';
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
import MailOutlineOutlinedIcon from '@mui/icons-material/MailOutlineOutlined';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../config/supabase';
import * as authService from '../services/auth.service';
import * as familyService from '../services/family.service';
import papyriLogo from '../assets/papyri-wordmark-150x50.png';

export default function MfaVerifyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const emailChallengeId = location.state?.challengeId || '';
  const emailTarget = location.state?.email || '';
  const emailMode = location.state?.method === 'email';

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState(emailMode ? t('auth.mfaCodeSent', { email: emailTarget }) : '');
  const [factorId, setFactorId] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (emailMode) {
      setTimeout(() => inputRef.current?.focus(), 100);
      return;
    }

    supabase.auth.mfa.listFactors().then(({ data }) => {
      const factor = data?.totp?.find((f) => f.status === 'verified');
      if (!factor) {
        redirectAfterLogin();
        return;
      }
      setFactorId(factor.id);
      setTimeout(() => inputRef.current?.focus(), 100);
    });
  }, [emailMode]); // eslint-disable-line react-hooks/exhaustive-deps

  async function redirectAfterLogin() {
    const user = await authService.getUser().catch(() => null);
    const role = user?.role;
    if (role === 'admin') navigate('/admin/dashboard', { replace: true });
    else if (role === 'publisher') navigate('/publisher/dashboard', { replace: true });
    else {
      const familyRequirement = await familyService.resolveProfileRequirement().catch(() => null);
      if (familyRequirement?.needsSelection) {
        navigate('/profiles/select', { replace: true });
        return;
      }
      navigate('/dashboard', { replace: true });
    }
  }

  const handleVerify = async (e) => {
    e?.preventDefault();
    if (code.length !== 6) return;
    setError('');
    setInfo('');
    setLoading(true);

    try {
      if (emailMode) {
        await authService.verifyEmailMfa(emailChallengeId, code);
      } else {
        const { data: challengeData, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId });
        if (challengeErr) throw challengeErr;

        const { error: verifyErr } = await supabase.auth.mfa.verify({
          factorId,
          challengeId: challengeData.id,
          code,
        });
        if (verifyErr) throw verifyErr;

        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session) {
          authService.syncSession(sessionData.session);
        }
      }

      await redirectAfterLogin();
    } catch (err) {
      setError(
        emailMode
          ? (err.message || t('auth.mfaCodeInvalid'))
          : t('auth.mfaCodeInvalidApp')
      );
      setCode('');
      setTimeout(() => inputRef.current?.focus(), 50);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!emailMode || !emailChallengeId) return;
    setError('');
    setInfo('');
    setResending(true);
    try {
      await authService.resendEmailMfa(emailChallengeId);
      setInfo(t('auth.mfaCodeResent', { email: emailTarget }));
    } catch (err) {
      setError(err.message || t('auth.mfaResendFailed'));
    } finally {
      setResending(false);
    }
  };

  const handleLogout = async () => {
    await authService.logout();
  };

  const title = emailMode ? t('auth.mfaEmailTitle') : t('auth.mfaTitle');
  const subtitle = emailMode
    ? t('auth.mfaEmailSubtitle', { email: emailTarget || t('auth.yourEmail') })
    : t('auth.mfaAppSubtitle');

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
        <Box
          component="img"
          src={papyriLogo}
          alt="Papyri"
          onClick={() => navigate('/')}
          sx={{ height: 44, objectFit: 'contain', cursor: 'pointer', mb: 4 }}
        />

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
          {emailMode
            ? <MailOutlineOutlinedIcon sx={{ fontSize: 32, color: '#f29e0d' }} />
            : <ShieldOutlinedIcon sx={{ fontSize: 32, color: '#f29e0d' }} />}
        </Box>

        <Typography variant="h1" sx={{ fontSize: { xs: '22px', sm: '26px' }, fontWeight: 700, textAlign: 'center', mb: 1 }}>
          {title}
        </Typography>
        <Typography sx={{ fontSize: '14px', color: 'text.secondary', textAlign: 'center', mb: 4, lineHeight: 1.6 }}>
          {subtitle}
        </Typography>

        {info && (
          <Alert severity="info" onClose={() => setInfo('')} sx={{ width: '100%', mb: 2.5, borderRadius: '10px' }}>
            {info}
          </Alert>
        )}

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
          disabled={loading || (!emailMode && !factorId)}
        />

        <Button
          type="submit"
          fullWidth
          disabled={code.length !== 6 || loading || (!emailMode && !factorId)}
          sx={{
            height: 48,
            borderRadius: '24px',
            fontSize: '15px',
            fontWeight: 700,
            textTransform: 'none',
            bgcolor: '#f29e0d',
            color: '#fff',
            mb: 1.5,
            '&:hover': { bgcolor: '#d4870a' },
            '&.Mui-disabled': { bgcolor: 'rgba(0,0,0,0.12)', color: 'rgba(0,0,0,0.26)' },
          }}
        >
          {loading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : t('auth.mfaConfirm')}
        </Button>

        {emailMode && (
          <Button
            type="button"
            variant="text"
            disabled={resending || loading}
            onClick={handleResend}
            sx={{ textTransform: 'none', fontWeight: 600, mb: 2 }}
          >
            {resending ? t('auth.mfaResending') : t('auth.mfaResend')}
          </Button>
        )}

        <Typography sx={{ fontSize: '13px', color: 'text.secondary', textAlign: 'center' }}>
          {t('auth.mfaNotYou')}{' '}
          <Link
            component="button"
            type="button"
            onClick={handleLogout}
            sx={{ color: 'primary.main', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
          >
            {t('common.logout')}
          </Link>
        </Typography>
      </Box>
    </Box>
  );
}
