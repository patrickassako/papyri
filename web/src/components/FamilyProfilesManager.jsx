import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
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
import { Check, Lock, Pencil, Plus, Shield, Trash2, UserRoundCheck, Users } from 'lucide-react';
import * as familyService from '../services/family.service';
import * as authService from '../services/auth.service';
import { getActiveProfile } from '../config/profileStorage';

const avatarChoices = [
  { key: 'gold', bg: '#F5E6C8', fg: '#7A5C1B' },
  { key: 'sage', bg: '#E8F0E8', fg: '#46634A' },
  { key: 'sky', bg: '#E5ECF6', fg: '#31506B' },
  { key: 'rose', bg: '#F7E0D9', fg: '#7A4D3F' },
  { key: 'plum', bg: '#EFE6F8', fg: '#5F467B' },
  { key: 'mint', bg: '#EAF6F4', fg: '#2D6B61' },
];

function getAvatarChoice(key, fallbackIndex = 0) {
  return avatarChoices.find((choice) => choice.key === key) || avatarChoices[fallbackIndex % avatarChoices.length];
}

function ProfileCard({ profile, index, isActive, onUse, onEdit, onPin, onDelete }) {
  const avatar = getAvatarChoice(profile.avatar_key, index);
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 4,
        border: isActive ? '1px solid #f1a10a' : '1px solid #ece7dd',
        bgcolor: '#fff',
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
        <Box
          sx={{
            width: 68,
            height: 68,
            borderRadius: 3,
            bgcolor: avatar.bg,
            color: avatar.fg,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          {profile.is_owner_profile ? <UserRoundCheck size={24} /> : <Users size={24} />}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1} sx={{ mb: 0.8 }}>
            <Typography sx={{ fontWeight: 800, color: '#1f1f1f', lineHeight: 1.2, minWidth: 0, overflowWrap: 'anywhere' }}>
              {profile.name}
            </Typography>
            {isActive && <Chip label="Actif" size="small" sx={{ height: 22, fontWeight: 700, bgcolor: '#fff7e6', color: '#9b6a00', flexShrink: 0 }} />}
          </Stack>
          <Stack direction="row" spacing={0.8} useFlexGap flexWrap="wrap">
            {profile.is_owner_profile && <Chip label="Principal" size="small" sx={{ height: 22, fontWeight: 700 }} />}
            {profile.is_kid && <Chip label="Enfant" size="small" sx={{ height: 22, fontWeight: 700, bgcolor: '#edf7f6', color: '#2d6b61' }} />}
            {profile.pin_enabled && <Chip icon={<Lock size={12} />} label="PIN" size="small" sx={{ height: 22, fontWeight: 700, bgcolor: '#f4f1ec', color: '#63584a' }} />}
          </Stack>
        </Box>
      </Stack>

      <Stack spacing={1}>
        <Button variant={isActive ? 'outlined' : 'contained'} onClick={() => onUse(profile)} sx={{ textTransform: 'none', borderRadius: 3, bgcolor: isActive ? undefined : '#f1a10a', '&:hover': { bgcolor: isActive ? undefined : '#d9900a' } }}>
          {isActive ? 'Profil actif' : 'Utiliser ce profil'}
        </Button>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button fullWidth variant="outlined" startIcon={<Pencil size={14} />} onClick={() => onEdit(profile)} sx={{ textTransform: 'none', borderRadius: 3 }}>
            Modifier
          </Button>
          <Button fullWidth variant="outlined" startIcon={profile.pin_enabled ? <Shield size={14} /> : <Lock size={14} />} onClick={() => onPin(profile)} sx={{ textTransform: 'none', borderRadius: 3 }}>
            {profile.pin_enabled ? 'PIN' : 'Ajouter PIN'}
          </Button>
        </Stack>
        {!profile.is_owner_profile && (
          <Button color="error" variant="text" startIcon={<Trash2 size={14} />} onClick={() => onDelete(profile)} sx={{ textTransform: 'none', alignSelf: 'flex-start', px: 0 }}>
            Supprimer
          </Button>
        )}
      </Stack>
    </Paper>
  );
}

export default function FamilyProfilesManager({ onProfileChange, onSummaryChange }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [profiles, setProfiles] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [activeProfileId, setActiveProfileId] = useState(getActiveProfile()?.id || null);
  const [editor, setEditor] = useState({ open: false, profile: null, name: '', avatar_key: 'gold', is_kid: false });
  const [pinDialog, setPinDialog] = useState({ open: false, profile: null, pin: '', emailCode: '', challengeId: '', verificationToken: '', emailTarget: '', step: 'pin' });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, profile: null });

  const refreshProfiles = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await familyService.getProfiles();
      setProfiles(data?.profiles || []);
      setSubscription(data?.subscription || null);
      setActiveProfileId(getActiveProfile()?.id || null);
      if (onSummaryChange) onSummaryChange(data || null);
    } catch (err) {
      setError(err.message || 'Impossible de charger les profils.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshProfiles();
  }, []);

  useEffect(() => {
    const handleProfileChange = (event) => {
      setActiveProfileId(event?.detail?.id || null);
      if (onProfileChange) onProfileChange(event?.detail || null);
    };
    window.addEventListener('papyri:profile-changed', handleProfileChange);
    return () => window.removeEventListener('papyri:profile-changed', handleProfileChange);
  }, [onProfileChange]);

  const remainingSlots = useMemo(() => {
    const limit = Number(subscription?.profiles_limit || 0);
    return Math.max(0, limit - profiles.filter((profile) => profile.is_active).length);
  }, [profiles, subscription]);

  const maxReached = Number(subscription?.profiles_limit || 0) >= Number(subscription?.max_profiles || 10);

  const openCreate = () => {
    setEditor({ open: true, profile: null, name: '', avatar_key: avatarChoices[0].key, is_kid: false });
  };

  const openEdit = (profile) => {
    setEditor({
      open: true,
      profile,
      name: profile.name || '',
      avatar_key: profile.avatar_key || avatarChoices[0].key,
      is_kid: Boolean(profile.is_kid),
    });
  };

  const closeEditor = () => setEditor({ open: false, profile: null, name: '', avatar_key: avatarChoices[0].key, is_kid: false });

  const handleSaveProfile = async () => {
    if (!editor.name.trim()) {
      setError('Le nom du profil est requis.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      if (editor.profile) {
        await familyService.updateProfile(editor.profile.id, {
          name: editor.name.trim(),
          avatar_key: editor.avatar_key,
          is_kid: editor.is_kid,
        });
        setMessage('Profil mis a jour.');
      } else {
        await familyService.createProfile({
          name: editor.name.trim(),
          avatar_key: editor.avatar_key,
          is_kid: editor.is_kid,
        });
        setMessage('Profil cree.');
      }
      closeEditor();
      await refreshProfiles();
    } catch (err) {
      setError(err.message || 'Impossible d enregistrer le profil.');
    } finally {
      setSaving(false);
    }
  };

  const handleUseProfile = async (profile) => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await familyService.selectProfile(profile.id);
      setActiveProfileId(profile.id);
      setMessage(`Profil actif: ${profile.name}.`);
    } catch (err) {
      setError(err.message || 'Impossible de changer de profil.');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePin = async () => {
    if (!pinDialog.profile) return;
    if (!/^\d{4,6}$/.test(pinDialog.pin)) {
      setError('Le PIN doit contenir 4 a 6 chiffres.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await familyService.setProfilePin(pinDialog.profile.id, pinDialog.pin, pinDialog.verificationToken);
      setMessage('Code PIN enregistre.');
      setPinDialog({ open: false, profile: null, pin: '', emailCode: '', challengeId: '', verificationToken: '', emailTarget: '', step: 'pin' });
      await refreshProfiles();
    } catch (err) {
      setError(err.message || 'Impossible d enregistrer le PIN.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePin = async () => {
    if (!pinDialog.profile) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await familyService.removeProfilePin(pinDialog.profile.id, pinDialog.verificationToken);
      setMessage('Code PIN retire.');
      setPinDialog({ open: false, profile: null, pin: '', emailCode: '', challengeId: '', verificationToken: '', emailTarget: '', step: 'pin' });
      await refreshProfiles();
    } catch (err) {
      setError(err.message || 'Impossible de retirer le PIN.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProfile = async () => {
    if (!deleteDialog.profile) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await familyService.deleteProfile(deleteDialog.profile.id);
      setMessage('Profil supprime.');
      setDeleteDialog({ open: false, profile: null });
      await refreshProfiles();
    } catch (err) {
      setError(err.message || 'Impossible de supprimer le profil.');
    } finally {
      setSaving(false);
    }
  };

  const handleStartOwnerVerification = async () => {
    if (!pinDialog.profile?.is_owner_profile) return;
    setSaving(true);
    setError('');
    try {
      const result = await authService.startProfilePinEmailVerification();
      setPinDialog((prev) => ({
        ...prev,
        challengeId: result.challenge_id,
        emailTarget: result.email || '',
        verificationToken: '',
        emailCode: '',
        step: 'email',
      }));
      setMessage(`Code email envoye ${result.email ? `a ${result.email}` : ''}.`);
    } catch (err) {
      setError(err.message || 'Impossible d envoyer le code email.');
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyOwnerEmailCode = async () => {
    if (!pinDialog.challengeId || !/^\d{6}$/.test(pinDialog.emailCode)) {
      setError('Le code email est requis.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = await authService.verifyProfilePinEmailVerification(pinDialog.challengeId, pinDialog.emailCode);
      setPinDialog((prev) => ({
        ...prev,
        verificationToken: result.verification_token,
        step: 'verified',
      }));
      setMessage('Verification email validee.');
    } catch (err) {
      setError(err.message || 'Code email invalide.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, borderRadius: 4, border: '1px solid #ece7dd' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1.5}>
          <Box>
            <Typography sx={{ fontWeight: 800, color: '#262626', fontSize: '1rem' }}>
              Profils famille
            </Typography>
            <Typography sx={{ color: '#7f7669', fontSize: '0.88rem', mt: 0.5 }}>
              {profiles.length}/{subscription?.profiles_limit || 0} profils utilises. {subscription?.included_profiles || 3} inclus, jusqu a {subscription?.max_profiles || 10}.
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ width: { xs: '100%', sm: 'auto' } }}>
            <Button variant="outlined" onClick={refreshProfiles} sx={{ textTransform: 'none', borderRadius: 3, width: { xs: '100%', sm: 'auto' } }}>
              Actualiser
            </Button>
            <Button variant="contained" startIcon={<Plus size={16} />} disabled={saving || remainingSlots <= 0} onClick={openCreate} sx={{ textTransform: 'none', borderRadius: 3, bgcolor: '#f1a10a', width: { xs: '100%', sm: 'auto' }, '&:hover': { bgcolor: '#d9900a' } }}>
              Nouveau profil
            </Button>
          </Stack>
        </Stack>

        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 2 }}>
          <Chip label={`${remainingSlots} place${remainingSlots > 1 ? 's' : ''} restante${remainingSlots > 1 ? 's' : ''}`} size="small" sx={{ fontWeight: 700, bgcolor: '#edf7f6', color: '#2d6b61' }} />
          {maxReached && <Chip label="Limite maximale atteinte" size="small" sx={{ fontWeight: 700, bgcolor: '#fff3e0', color: '#b25a00' }} />}
          {activeProfileId && <Chip label="Profil actif detecte" size="small" sx={{ fontWeight: 700, bgcolor: '#fff7e6', color: '#9b6a00' }} />}
        </Stack>

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        {message && <Alert severity="success" sx={{ mt: 2 }}>{message}</Alert>}
      </Paper>

      {loading ? (
        <Box sx={{ minHeight: 220, display: 'grid', placeItems: 'center' }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' },
            gap: 2,
          }}
        >
          {profiles.map((profile, index) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              index={index}
              isActive={activeProfileId === profile.id}
              onUse={handleUseProfile}
              onEdit={openEdit}
              onPin={(target) => setPinDialog({ open: true, profile: target, pin: '', emailCode: '', challengeId: '', verificationToken: '', emailTarget: '', step: 'pin' })}
              onDelete={(target) => setDeleteDialog({ open: true, profile: target })}
            />
          ))}
        </Box>
      )}

      <Dialog open={editor.open} onClose={() => !saving && closeEditor()} fullWidth maxWidth="sm">
        <DialogTitle>{editor.profile ? 'Modifier le profil' : 'Creer un profil'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Nom du profil"
              value={editor.name}
              onChange={(event) => setEditor((prev) => ({ ...prev, name: event.target.value.slice(0, 80) }))}
            />
            <Box>
              <Typography sx={{ fontWeight: 700, color: '#51483d', mb: 1 }}>Avatar</Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {avatarChoices.map((choice) => {
                  const selected = editor.avatar_key === choice.key;
                  return (
                    <Button
                      key={choice.key}
                      onClick={() => setEditor((prev) => ({ ...prev, avatar_key: choice.key }))}
                      sx={{
                        minWidth: 44,
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        bgcolor: choice.bg,
                        color: choice.fg,
                        border: selected ? '2px solid #f1a10a' : '1px solid #ddd',
                        p: 0,
                      }}
                    >
                      {selected ? <Check size={16} /> : null}
                    </Button>
                  );
                })}
              </Stack>
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, color: '#51483d', mb: 1 }}>Type de profil</Typography>
              <Stack direction="row" spacing={1}>
                <Button variant={!editor.is_kid ? 'contained' : 'outlined'} onClick={() => setEditor((prev) => ({ ...prev, is_kid: false }))} sx={{ textTransform: 'none', borderRadius: 3, bgcolor: !editor.is_kid ? '#f1a10a' : undefined, '&:hover': { bgcolor: !editor.is_kid ? '#d9900a' : undefined } }}>
                  Standard
                </Button>
                <Button variant={editor.is_kid ? 'contained' : 'outlined'} onClick={() => setEditor((prev) => ({ ...prev, is_kid: true }))} sx={{ textTransform: 'none', borderRadius: 3, bgcolor: editor.is_kid ? '#f1a10a' : undefined, '&:hover': { bgcolor: editor.is_kid ? '#d9900a' : undefined } }}>
                  Enfant
                </Button>
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={closeEditor} disabled={saving}>Annuler</Button>
          <Button variant="contained" onClick={handleSaveProfile} disabled={saving || !editor.name.trim()} sx={{ bgcolor: '#f1a10a', '&:hover': { bgcolor: '#d9900a' } }}>
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={pinDialog.open} onClose={() => !saving && setPinDialog({ open: false, profile: null, pin: '', emailCode: '', challengeId: '', verificationToken: '', emailTarget: '', step: 'pin' })} fullWidth maxWidth="xs">
        <DialogTitle>Code PIN du profil</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography sx={{ color: '#6f6559' }}>
              {pinDialog.profile?.pin_enabled
                ? `Modifiez ou retirez le PIN de ${pinDialog.profile?.name}.`
                : `Definissez un PIN de 4 a 6 chiffres pour ${pinDialog.profile?.name}.`}
            </Typography>
            <TextField
              fullWidth
              label="Code PIN"
              value={pinDialog.pin}
              onChange={(event) => setPinDialog((prev) => ({ ...prev, pin: event.target.value.replace(/\D/g, '').slice(0, 6) }))}
              inputProps={{ inputMode: 'numeric', maxLength: 6 }}
            />
            {pinDialog.profile?.is_owner_profile && (
              <>
                {pinDialog.step === 'pin' && (
                  <Button variant="outlined" onClick={handleStartOwnerVerification} disabled={saving} sx={{ textTransform: 'none', alignSelf: 'flex-start' }}>
                    Envoyer le code email
                  </Button>
                )}
                {pinDialog.step !== 'pin' && (
                  <>
                    <TextField
                      fullWidth
                      label="Code email"
                      value={pinDialog.emailCode}
                      onChange={(event) => setPinDialog((prev) => ({ ...prev, emailCode: event.target.value.replace(/\D/g, '').slice(0, 6) }))}
                      helperText={pinDialog.emailTarget ? `Code envoye a ${pinDialog.emailTarget}.` : 'Entrez le code recu par email.'}
                      inputProps={{ inputMode: 'numeric', maxLength: 6 }}
                    />
                    {pinDialog.step === 'email' && (
                      <Button variant="outlined" onClick={handleVerifyOwnerEmailCode} disabled={saving || pinDialog.emailCode.length !== 6} sx={{ textTransform: 'none', alignSelf: 'flex-start' }}>
                        Verifier le code
                      </Button>
                    )}
                    {pinDialog.step === 'verified' && (
                      <Alert severity="success">Verification email validee. Vous pouvez maintenant enregistrer le nouveau PIN.</Alert>
                    )}
                  </>
                )}
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          {pinDialog.profile?.pin_enabled && (
            <Button color="error" onClick={handleRemovePin} disabled={saving}>
              Retirer le PIN
            </Button>
          )}
          <Button onClick={() => setPinDialog({ open: false, profile: null, pin: '', emailCode: '', challengeId: '', verificationToken: '', emailTarget: '', step: 'pin' })} disabled={saving}>
            Annuler
          </Button>
          <Button variant="contained" onClick={handleSavePin} disabled={saving || pinDialog.pin.length < 4 || (pinDialog.profile?.is_owner_profile && !pinDialog.verificationToken)} sx={{ bgcolor: '#f1a10a', '&:hover': { bgcolor: '#d9900a' } }}>
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialog.open} onClose={() => !saving && setDeleteDialog({ open: false, profile: null })} fullWidth maxWidth="xs">
        <DialogTitle>Supprimer ce profil ?</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#6f6559' }}>
            Le profil <b>{deleteDialog.profile?.name}</b> sera desactive. Sa place restera disponible dans votre quota de profils.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDeleteDialog({ open: false, profile: null })} disabled={saving}>Annuler</Button>
          <Button color="error" variant="contained" onClick={handleDeleteProfile} disabled={saving}>
            {saving ? 'Suppression...' : 'Supprimer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
