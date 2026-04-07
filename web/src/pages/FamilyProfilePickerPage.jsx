import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Lock, Smile, User, UserRoundCheck } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as familyService from '../services/family.service';
import papyriLogo from '../assets/papyri-wordmark-150x50.png';

const avatarPalette = ['#F5E6C8', '#E8F0E8', '#E5ECF6', '#F7E0D9', '#EFE6F8', '#EAF6F4'];

function profileIcon(profile) {
  if (profile?.is_owner_profile) return <UserRoundCheck size={26} />;
  if (profile?.is_kid) return <Smile size={26} />;
  return <User size={26} />;
}

export default function FamilyProfilePickerPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const redirectTo = location.state?.from || '/dashboard';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profiles, setProfiles] = useState([]);
  const [subscriptionMeta, setSubscriptionMeta] = useState(null);
  const [pinDialog, setPinDialog] = useState({ open: false, profile: null });
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [submittingPin, setSubmittingPin] = useState(false);
  const [selectingProfileId, setSelectingProfileId] = useState('');

  useEffect(() => {
    let active = true;
    familyService.getProfiles()
      .then((data) => {
        if (!active) return;
        setProfiles(data?.profiles || []);
        setSubscriptionMeta(data?.subscription || null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || t('familyPicker.cannotLoad'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);

  const title = useMemo(() => {
    const limit = subscriptionMeta?.profiles_limit;
    return limit ? t('familyPicker.titleWithCount', { count: profiles.length, limit }) : t('familyPicker.title');
  }, [profiles.length, subscriptionMeta, t]);

  const handleSelect = async (profile) => {
    if (selectingProfileId || submittingPin) return;
    setError('');
    if (profile?.pin_enabled) {
      setPin('');
      setPinError('');
      setPinDialog({ open: true, profile });
      return;
    }

    try {
      setSelectingProfileId(profile.id);
      await familyService.selectProfile(profile.id);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message || t('familyPicker.cannotSelect'));
      setSelectingProfileId('');
    }
  };

  const handlePinSubmit = async () => {
    if (!pinDialog.profile) return;
    setSubmittingPin(true);
    setSelectingProfileId(pinDialog.profile.id);
    setPinError('');
    try {
      await familyService.selectProfile(pinDialog.profile.id, pin);
      setPinDialog({ open: false, profile: null });
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setPinError(err.message || t('familyPicker.pinError'));
      setSelectingProfileId('');
    } finally {
      setSubmittingPin(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        px: { xs: 2, sm: 3 },
        py: { xs: 4, md: 6 },
        bgcolor: '#faf7f1',
      }}
    >
      <Stack spacing={3} sx={{ maxWidth: 900, mx: 'auto' }}>
        <Box sx={{ textAlign: 'center' }}>
          <Box component="img" src={papyriLogo} alt="Papyri" sx={{ height: 44, objectFit: 'contain', mb: 3 }} />
          <Typography sx={{ fontSize: { xs: '2rem', md: '2.6rem' }, fontWeight: 800, color: '#1f1f1f', mb: 1 }}>
            {title}
          </Typography>
          <Typography sx={{ color: '#7f7669', maxWidth: 520, mx: 'auto' }}>
            {t('familyPicker.subtitle')}
          </Typography>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        {loading ? (
          <Box sx={{ minHeight: 260, display: 'grid', placeItems: 'center' }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2, minmax(0, 1fr))',
                sm: 'repeat(3, minmax(0, 1fr))',
                md: 'repeat(4, minmax(0, 1fr))',
              },
              gap: 2.2,
            }}
          >
            {profiles.map((profile, index) => (
              <Paper
                key={profile.id}
                elevation={0}
                onClick={() => handleSelect(profile)}
                sx={{
                  p: 2,
                  borderRadius: 4,
                  border: '1px solid #ece7dd',
                  cursor: selectingProfileId ? 'progress' : 'pointer',
                  opacity: selectingProfileId && selectingProfileId !== profile.id ? 0.6 : 1,
                  pointerEvents: selectingProfileId ? 'none' : 'auto',
                  transition: 'transform .18s ease, border-color .18s ease, box-shadow .18s ease',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    borderColor: '#f1a10a',
                    boxShadow: '0 12px 28px rgba(0,0,0,0.08)',
                  },
                }}
              >
                <Box
                  sx={{
                    width: '100%',
                    aspectRatio: '1 / 1',
                    borderRadius: 3,
                    bgcolor: avatarPalette[index % avatarPalette.length],
                    display: 'grid',
                    placeItems: 'center',
                    color: '#5f5342',
                    mb: 1.5,
                  }}
                >
                  {profileIcon(profile)}
                </Box>
                <Typography sx={{ fontWeight: 800, color: '#1f1f1f', textAlign: 'center', mb: 0.5 }}>
                  {profile.name}
                </Typography>
                {selectingProfileId === profile.id && (
                  <Box sx={{ display: 'grid', placeItems: 'center', my: 1 }}>
                    <CircularProgress size={20} />
                  </Box>
                )}
                <Stack direction="row" spacing={0.8} justifyContent="center" flexWrap="wrap">
                  {profile.is_owner_profile && (
                    <Typography sx={{ fontSize: '0.72rem', color: '#9b6a00', fontWeight: 700 }}>{t('familyPicker.owner')}</Typography>
                  )}
                  {profile.is_kid && (
                    <Typography sx={{ fontSize: '0.72rem', color: '#2f6d5f', fontWeight: 700 }}>{t('familyPicker.kid')}</Typography>
                  )}
                  {profile.pin_enabled && (
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Lock size={12} />
                      <Typography sx={{ fontSize: '0.72rem', color: '#63584a', fontWeight: 700 }}>PIN</Typography>
                    </Stack>
                  )}
                </Stack>
              </Paper>
            ))}
          </Box>
        )}
      </Stack>

      <Dialog
        open={pinDialog.open}
        onClose={() => {
          if (submittingPin) return;
          setPinDialog({ open: false, profile: null });
          setSelectingProfileId('');
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>{t('familyPicker.pinDialogTitle')}</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#6f6559', mb: 2 }}>
            {t('familyPicker.pinDialogDesc', { name: pinDialog.profile?.name })}
          </Typography>
          <TextField
            fullWidth
            autoFocus
            label={t('familyPicker.pinLabel')}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputProps={{ inputMode: 'numeric', maxLength: 6 }}
          />
          {pinError && <Alert severity="error" sx={{ mt: 2 }}>{pinError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={() => {
              setPinDialog({ open: false, profile: null });
              setSelectingProfileId('');
            }}
            disabled={submittingPin}
          >
            {t('familyPicker.cancel')}
          </Button>
          <Button variant="contained" onClick={handlePinSubmit} disabled={submittingPin || pin.length < 4} sx={{ bgcolor: '#f1a10a', '&:hover': { bgcolor: '#d9900a' } }}>
            {submittingPin ? t('familyPicker.verifying') : t('familyPicker.continue')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
