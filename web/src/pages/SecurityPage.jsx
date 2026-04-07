import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  InputAdornment,
  IconButton,
  Alert,
  Snackbar,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Chip,
  LinearProgress,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import PhoneAndroidOutlinedIcon from '@mui/icons-material/PhoneAndroidOutlined';
import MailOutlineOutlinedIcon from '@mui/icons-material/MailOutlineOutlined';
import DeleteForeverOutlinedIcon from '@mui/icons-material/DeleteForeverOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import tokens from '../config/tokens';
import * as authService from '../services/auth.service';
import { supabase } from '../config/supabase';
import UserSpaceSidebar from '../components/UserSpaceSidebar';
import MobileBottomNav from '../components/MobileBottomNav';

const primary = tokens.colors.primary;
const bgLight = tokens.colors.backgrounds.light;
const surfaceDefault = tokens.colors.surfaces.light.default;
const surfaceVariant = tokens.colors.surfaces.light.variant;
const textMain = tokens.colors.onBackground.light;
const textMuted = '#9c7e49';

/* ─── Section card ─────────────────────────────────────────── */
function SectionCard({ icon, title, subtitle, children }) {
  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: '16px',
        border: `1px solid ${surfaceVariant}`,
        bgcolor: surfaceDefault,
        overflow: 'hidden',
        mb: 3,
      }}
    >
      <Box sx={{ px: { xs: 2, md: 3 }, py: { xs: 2, md: 2.5 }, display: 'flex', alignItems: 'flex-start', gap: { xs: 1.5, md: 2 }, borderBottom: `1px solid ${surfaceVariant}` }}>
        <Box sx={{ width: 40, height: 40, borderRadius: '10px', bgcolor: `${primary}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {React.cloneElement(icon, { sx: { fontSize: 20, color: primary } })}
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: textMain }}>{title}</Typography>
          <Typography sx={{ fontSize: '0.82rem', color: textMuted, mt: 0.25 }}>{subtitle}</Typography>
        </Box>
      </Box>
      <Box sx={{ px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}>{children}</Box>
    </Paper>
  );
}

/* ─── Password strength ─────────────────────────────────────── */
function getStrength(password) {
  if (!password) return null;
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
  if (score <= 2) return { pct: 33, label: 'weak', color: '#c0392b' };
  if (score <= 3) return { pct: 66, label: 'fair', color: '#e67e22' };
  return { pct: 100, label: 'strong', color: '#27ae60' };
}

/* ══════════════════════════════════════════════════════════════
   SecurityPage
══════════════════════════════════════════════════════════════ */
export default function SecurityPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [user, setUser] = useState(null);
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });

  /* password */
  const [pwdForm, setPwdForm] = useState({ current: '', next: '', confirm: '' });
  const [showPwd, setShowPwd] = useState({ current: false, next: false, confirm: false });
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState('');

  /* 2FA */
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaFactor, setMfaFactor] = useState(null);
  const [mfaMethod, setMfaMethod] = useState('none');
  const [mfaDialog, setMfaDialog] = useState(false); // 'setup' | 'disable' | false
  const [mfaStep, setMfaStep] = useState('qr'); // 'qr' | 'verify'
  const [mfaEnrollData, setMfaEnrollData] = useState(null); // { id, totp: { uri, secret } }
  const [mfaChallengeId, setMfaChallengeId] = useState(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaError, setMfaError] = useState('');

  /* delete account */
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const notify = (msg, severity = 'success') => setSnack({ open: true, msg, severity });

  /* Load user + MFA status */
  useEffect(() => {
    authService.getUser().then(setUser).catch(() => {});
    loadMfaStatus();
  }, []);

  async function loadMfaStatus() {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const preferredMethod = authData?.user?.user_metadata?.mfa_method || 'none';
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) return;
      const totpFactor = data?.totp?.find((f) => f.status === 'verified');
      setMfaEnabled(Boolean(totpFactor));
      setMfaFactor(totpFactor || null);
      setMfaMethod(totpFactor ? 'totp' : preferredMethod);
    } catch (_) {}
  }

  async function updatePreferredMfaMethod(method) {
    setMfaLoading(true);
    setMfaError('');
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          mfa_method: method,
        },
      });
      if (error) throw error;
      setMfaMethod(method);
      notify(
        method === 'email'
          ? t('security.mfaEmailActivated')
          : method === 'none'
            ? t('security.mfaDeactivated')
            : t('security.mfaAppSetAsMain')
      );
    } catch (err) {
      setMfaError(err.message || t('security.mfaUpdateError'));
    } finally {
      setMfaLoading(false);
    }
  }

  /* ── Change password ─────────────────────────── */
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwdError('');

    if (pwdForm.next !== pwdForm.confirm) {
      setPwdError(t('security.passwordsMismatch'));
      return;
    }
    if (pwdForm.next.length < 8) {
      setPwdError(t('security.passwordTooShort'));
      return;
    }

    setPwdLoading(true);
    try {
      await authService.updatePassword(pwdForm.current, pwdForm.next);
      setPwdForm({ current: '', next: '', confirm: '' });
      notify(t('security.passwordChangedSuccess'));
    } catch (err) {
      setPwdError(err.message || t('security.passwordChangeError'));
    } finally {
      setPwdLoading(false);
    }
  };

  /* ── 2FA setup ───────────────────────────────── */
  const handleOpenSetup = async () => {
    setMfaError('');
    setMfaCode('');
    setMfaStep('qr');
    setMfaLoading(true);
    setMfaDialog('setup');
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
      if (error) throw error;
      setMfaEnrollData(data);
    } catch (err) {
      setMfaError(err.message || 'Impossible de démarrer la configuration.');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleMfaContinue = async () => {
    setMfaError('');
    setMfaLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.challenge({ factorId: mfaEnrollData.id });
      if (error) throw error;
      setMfaChallengeId(data.id);
      setMfaStep('verify');
    } catch (err) {
      setMfaError(err.message || 'Erreur lors de la vérification.');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleMfaVerify = async () => {
    if (mfaCode.length !== 6) return;
    setMfaError('');
    setMfaLoading(true);
    try {
      const { error } = await supabase.auth.mfa.verify({
        factorId: mfaEnrollData.id,
        challengeId: mfaChallengeId,
        code: mfaCode,
      });
      if (error) throw error;
      setMfaDialog(false);
      await loadMfaStatus();
      setMfaMethod('totp');
      await supabase.auth.updateUser({ data: { mfa_method: 'totp' } });
      notify(t('security.mfa2faActivated'));
    } catch (err) {
      setMfaError(t('security.mfaCodeIncorrect'));
    } finally {
      setMfaLoading(false);
    }
  };

  const handleMfaDisable = async () => {
    if (!mfaFactor) return;
    setMfaLoading(true);
    setMfaError('');
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: mfaFactor.id });
      if (error) throw error;
      setMfaDialog(false);
      setMfaEnabled(false);
      setMfaFactor(null);
      if (mfaMethod === 'totp') {
        await supabase.auth.updateUser({ data: { mfa_method: 'none' } });
        setMfaMethod('none');
      }
      notify(t('security.mfa2faDeactivated'), 'info');
    } catch (err) {
      setMfaError(err.message || t('security.mfaDisableError'));
    } finally {
      setMfaLoading(false);
    }
  };

  /* ── Delete account ──────────────────────────── */
  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'SUPPRIMER') return;
    setDeleteLoading(true);
    try {
      await authService.authFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/users/me`, { method: 'DELETE' });
      await authService.logout();
      navigate('/');
    } catch (err) {
      notify(t('security.deleteAccountError'), 'error');
      setDeleteLoading(false);
      setDeleteDialog(false);
    }
  };

  const strength = getStrength(pwdForm.next);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: bgLight, display: 'flex' }}>
      <UserSpaceSidebar user={user} activeKey="security" />

      <Box sx={{ flex: 1, px: { xs: 1.25, sm: 2, md: 4 }, py: { xs: 1.5, md: 4 }, maxWidth: 760, mx: 'auto', width: '100%' }}>
        <Box sx={{ mb: 4 }}>
          <Typography
            variant="h1"
            sx={{ fontFamily: '"Newsreader", Georgia, serif', fontSize: { xs: '1.85rem', sm: '2rem', md: '2.6rem' }, fontWeight: 800, color: textMain, lineHeight: 1.2 }}
          >
            {t('security.title')}
          </Typography>
          <Typography sx={{ fontSize: '0.95rem', color: textMuted, mt: 0.5 }}>
            {t('security.subtitle')}
          </Typography>
        </Box>

        <Box
          sx={{
            display: { xs: 'grid', md: 'none' },
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 1,
            mb: 2.5,
          }}
        >
          {[
            { label: '2FA', value: mfaMethod === 'email' ? 'Email' : mfaEnabled ? 'App' : t('security.inactive') },
            { label: t('security.account'), value: user?.email ? t('security.protected') : 'Session' },
          ].map((item) => (
            <Paper key={item.label} elevation={0} sx={{ p: 1.4, borderRadius: 3, border: `1px solid ${surfaceVariant}` }}>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {item.label}
              </Typography>
              <Typography sx={{ fontSize: '0.98rem', fontWeight: 800, color: textMain, mt: 0.3 }}>
                {item.value}
              </Typography>
            </Paper>
          ))}
        </Box>

        {/* ── Mot de passe ─────────────────────────────── */}
        <SectionCard
          icon={<LockOutlinedIcon />}
          title={t('security.passwordSection')}
          subtitle={t('security.passwordSectionSubtitle')}
        >
          <Box component="form" onSubmit={handleChangePassword} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {pwdError && <Alert severity="error" onClose={() => setPwdError('')}>{pwdError}</Alert>}

            {['current', 'next', 'confirm'].map((field) => {
              const labels = { current: t('profile.currentPassword'), next: t('auth.newPassword'), confirm: t('auth.confirmPassword') };
              return (
                <Box key={field}>
                  <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: textMain, mb: 0.75 }}>{labels[field]}</Typography>
                  <TextField
                    fullWidth
                    size="small"
                    type={showPwd[field] ? 'text' : 'password'}
                    value={pwdForm[field]}
                    onChange={(e) => setPwdForm((p) => ({ ...p, [field]: e.target.value }))}
                    placeholder={field === 'current' ? t('auth.currentPasswordPlaceholder') : t('auth.passwordMinChars')}
                    autoComplete={field === 'current' ? 'current-password' : 'new-password'}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={() => setShowPwd((p) => ({ ...p, [field]: !p[field] }))}>
                            {showPwd[field] ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                  />
                  {field === 'next' && strength && (
                    <Box sx={{ mt: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography sx={{ fontSize: '0.75rem', color: textMuted }}>{t('security.passwordStrength')}</Typography>
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: strength.color }}>{t(`security.${strength.label}`)}</Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={strength.pct}
                        sx={{ height: 4, borderRadius: 2, bgcolor: surfaceVariant, '& .MuiLinearProgress-bar': { bgcolor: strength.color, borderRadius: 2 } }}
                      />
                    </Box>
                  )}
                </Box>
              );
            })}

            <Button
              type="submit"
              variant="contained"
              disabled={!pwdForm.current || !pwdForm.next || !pwdForm.confirm || pwdLoading}
              sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' }, borderRadius: '10px', textTransform: 'none', fontWeight: 600, bgcolor: primary, '&:hover': { bgcolor: tokens.colors.primaryDark } }}
            >
              {pwdLoading ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : t('auth.updatePassword')}
            </Button>
          </Box>
        </SectionCard>

        {/* ── Double authentification ────────────────── */}
        <SectionCard
          icon={<ShieldOutlinedIcon />}
          title={t('security.twoFactor')}
          subtitle={t('security.twoFactorSubtitle')}
        >
          <Box sx={{ display: 'grid', gap: 1.5 }}>
            <Paper elevation={0} sx={{ p: 2, borderRadius: '12px', border: `1px solid ${surfaceVariant}`, bgcolor: mfaMethod === 'email' ? `${primary}10` : '#fff' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <MailOutlineOutlinedIcon sx={{ color: mfaMethod === 'email' ? primary : textMuted, fontSize: 28 }} />
                  <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.92rem', color: textMain }}>
                      {t('security.emailCode')}
                    </Typography>
                    <Typography sx={{ fontSize: '0.78rem', color: textMuted }}>
                      {t('security.emailCodeDesc')}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Chip
                    label={mfaMethod === 'email' ? t('security.active') : t('security.recommended')}
                    size="small"
                    sx={{
                      bgcolor: mfaMethod === 'email' ? '#e8f8f0' : '#fff3e0',
                      color: mfaMethod === 'email' ? '#27ae60' : '#e67e22',
                      fontWeight: 700,
                    }}
                  />
                  <Button
                    size="small"
                    variant={mfaMethod === 'email' ? 'outlined' : 'contained'}
                    disabled={mfaLoading}
                    onClick={() => updatePreferredMfaMethod(mfaMethod === 'email' ? 'none' : 'email')}
                    sx={{
                      borderRadius: '8px',
                      textTransform: 'none',
                      fontWeight: 700,
                      ...(mfaMethod === 'email'
                        ? { borderColor: primary, color: primary, '&:hover': { borderColor: primary, bgcolor: `${primary}10` } }
                        : { bgcolor: primary, '&:hover': { bgcolor: tokens.colors.primaryDark } }),
                    }}
                  >
                    {mfaMethod === 'email' ? t('security.disable') : t('security.enable')}
                  </Button>
                </Box>
              </Box>
            </Paper>

            <Paper elevation={0} sx={{ p: 2, borderRadius: '12px', border: `1px solid ${surfaceVariant}`, bgcolor: mfaMethod === 'totp' ? `${primary}10` : '#fff' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <PhoneAndroidOutlinedIcon sx={{ color: mfaMethod === 'totp' ? primary : (mfaEnabled ? '#27ae60' : textMuted), fontSize: 28 }} />
                  <Box>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', color: textMain }}>
                      {t('security.authenticatorApp')}
                    </Typography>
                    <Typography sx={{ fontSize: '0.78rem', color: textMuted }}>
                      {t('security.authenticatorAppDesc')}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                  <Chip
                    icon={mfaEnabled ? <CheckCircleOutlinedIcon /> : <WarningAmberOutlinedIcon />}
                    label={mfaEnabled ? (mfaMethod === 'totp' ? t('security.active') : t('security.available')) : t('security.notConfigured')}
                    size="small"
                    sx={{
                      bgcolor: mfaEnabled ? '#e8f8f0' : '#fff3e0',
                      color: mfaEnabled ? '#27ae60' : '#e67e22',
                      fontWeight: 700,
                      '& .MuiChip-icon': { color: 'inherit' },
                    }}
                  />
                  {mfaEnabled && (
                    <Button
                      variant={mfaMethod === 'totp' ? 'outlined' : 'contained'}
                      size="small"
                      disabled={mfaLoading}
                      onClick={() => updatePreferredMfaMethod(mfaMethod === 'totp' ? 'none' : 'totp')}
                      sx={{
                        borderRadius: '8px',
                        textTransform: 'none',
                        fontWeight: 700,
                        ...(mfaMethod === 'totp'
                          ? { borderColor: primary, color: primary, '&:hover': { borderColor: primary, bgcolor: `${primary}10` } }
                          : { bgcolor: primary, '&:hover': { bgcolor: tokens.colors.primaryDark } }),
                      }}
                    >
                      {mfaMethod === 'totp' ? t('security.disable') : t('security.useThisMethod')}
                    </Button>
                  )}
                  <Button
                    variant={mfaEnabled ? 'outlined' : 'contained'}
                    size="small"
                    onClick={() => mfaEnabled ? setMfaDialog('disable') : handleOpenSetup()}
                    sx={{
                      borderRadius: '8px',
                      textTransform: 'none',
                      fontWeight: 600,
                      width: { xs: '100%', sm: 'auto' },
                      ...(mfaEnabled
                        ? { borderColor: '#c0392b', color: '#c0392b', '&:hover': { bgcolor: '#fdf0ef', borderColor: '#c0392b' } }
                        : { bgcolor: primary, '&:hover': { bgcolor: tokens.colors.primaryDark } }),
                    }}
                  >
                    {mfaEnabled ? t('security.removeApp') : t('security.configureApp')}
                  </Button>
                </Box>
              </Box>
            </Paper>
          </Box>

          {(mfaMethod === 'none' && !mfaEnabled) && (
            <Alert severity="info" icon={<ShieldOutlinedIcon />} sx={{ mt: 2.5, borderRadius: '10px', fontSize: '0.82rem' }}>
              {t('security.enableAtLeastEmail')}
            </Alert>
          )}
          {mfaError && <Alert severity="error" sx={{ mt: 2.5, borderRadius: '10px', fontSize: '0.82rem' }}>{mfaError}</Alert>}
        </SectionCard>

        {/* ── Supprimer le compte ────────────────────── */}
        <SectionCard
          icon={<DeleteForeverOutlinedIcon />}
          title={t('security.deleteAccountTitle')}
          subtitle={t('security.deleteAccountSubtitle')}
        >
          <Alert severity="warning" sx={{ mb: 2.5, borderRadius: '10px', fontSize: '0.82rem' }}>
            {t('security.deleteAccountWarning')}
          </Alert>
          <Button
            variant="outlined"
            startIcon={<DeleteForeverOutlinedIcon />}
            onClick={() => setDeleteDialog(true)}
            sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600, borderColor: '#c0392b', color: '#c0392b', '&:hover': { bgcolor: '#fdf0ef', borderColor: '#c0392b' } }}
          >
            {t('security.deleteMyAccount')}
          </Button>
        </SectionCard>
      </Box>

      {/* ════ Dialog: setup 2FA ════════════════════════════════ */}
      <Dialog open={mfaDialog === 'setup'} onClose={() => setMfaDialog(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1.1rem' }}>{t('security.setup2faTitle')}</DialogTitle>
        <DialogContent>
          {mfaLoading && mfaStep === 'qr' && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
          )}

          {!mfaLoading && mfaStep === 'qr' && mfaEnrollData && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2.5, pt: 1 }}>
              <Typography sx={{ fontSize: '0.875rem', color: textMuted, textAlign: 'center' }}>
                {t('security.scan2faDesc')}
              </Typography>
              <Box sx={{ p: 2, bgcolor: '#fff', borderRadius: '12px', border: `1px solid ${surfaceVariant}` }}>
                <QRCodeSVG value={mfaEnrollData.totp.uri} size={180} level="M" />
              </Box>
              <Box sx={{ width: '100%', bgcolor: surfaceVariant, borderRadius: '10px', p: 1.5 }}>
                <Typography sx={{ fontSize: '0.72rem', color: textMuted, mb: 0.5 }}>{t('security.manualCode')}</Typography>
                <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: textMain, letterSpacing: '0.1em', wordBreak: 'break-all' }}>
                  {mfaEnrollData.totp.secret}
                </Typography>
              </Box>
            </Box>
          )}

          {mfaStep === 'verify' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <Typography sx={{ fontSize: '0.875rem', color: textMuted }}>
                {t('security.mfaVerifyDesc')}
              </Typography>
              <TextField
                fullWidth
                label={t('security.mfaCodeLabel')}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputProps={{ inputMode: 'numeric', maxLength: 6 }}
                placeholder="000000"
                autoFocus
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', letterSpacing: '0.3em', fontSize: '1.2rem' } }}
              />
              {mfaError && <Alert severity="error">{mfaError}</Alert>}
            </Box>
          )}

          {mfaError && mfaStep === 'qr' && <Alert severity="error" sx={{ mt: 2 }}>{mfaError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setMfaDialog(false)} sx={{ borderRadius: '8px', textTransform: 'none', color: textMuted }}>{t('common.cancel')}</Button>
          {mfaStep === 'qr' && (
            <Button
              variant="contained"
              onClick={handleMfaContinue}
              disabled={!mfaEnrollData || mfaLoading}
              sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, bgcolor: primary }}
            >
              {mfaLoading ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : t('common.next')}
            </Button>
          )}
          {mfaStep === 'verify' && (
            <Button
              variant="contained"
              onClick={handleMfaVerify}
              disabled={mfaCode.length !== 6 || mfaLoading}
              sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, bgcolor: primary }}
            >
              {mfaLoading ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : t('security.activate')}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* ════ Dialog: disable 2FA ══════════════════════════════ */}
      <Dialog open={mfaDialog === 'disable'} onClose={() => setMfaDialog(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1.1rem', color: '#c0392b' }}>{t('security.disable2faDialogTitle')}</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.875rem', color: textMuted }}>
            {t('security.disable2faDialogDesc')}
          </Typography>
          {mfaError && <Alert severity="error" sx={{ mt: 2 }}>{mfaError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setMfaDialog(false)} sx={{ borderRadius: '8px', textTransform: 'none', color: textMuted }}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            onClick={handleMfaDisable}
            disabled={mfaLoading}
            sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, bgcolor: '#c0392b', '&:hover': { bgcolor: '#a93226' } }}
          >
            {mfaLoading ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : t('security.deactivate')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ════ Dialog: delete account ═══════════════════════════ */}
      <Dialog open={deleteDialog} onClose={() => { setDeleteDialog(false); setDeleteConfirm(''); }} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1.1rem', color: '#c0392b' }}>{t('security.deleteDialogTitle')}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Alert severity="error" sx={{ borderRadius: '10px' }}>
            {t('security.deleteDialogWarning')}
          </Alert>
          <Typography sx={{ fontSize: '0.875rem', color: textMuted }}>
            {t('security.deleteDialogHint')}
          </Typography>
          <TextField
            fullWidth
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="SUPPRIMER"
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => { setDeleteDialog(false); setDeleteConfirm(''); }} sx={{ borderRadius: '8px', textTransform: 'none', color: textMuted }}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            onClick={handleDeleteAccount}
            disabled={deleteConfirm !== 'SUPPRIMER' || deleteLoading}
            sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, bgcolor: '#c0392b', '&:hover': { bgcolor: '#a93226' } }}
          >
            {deleteLoading ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : t('security.deleteForever')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))} sx={{ borderRadius: '10px' }}>{snack.msg}</Alert>
      </Snackbar>
      <MobileBottomNav />
    </Box>
  );
}
