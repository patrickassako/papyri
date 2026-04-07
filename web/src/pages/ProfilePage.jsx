import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Avatar,
  Button,
  TextField,
  MenuItem,
  LinearProgress,
  IconButton,
  Alert,
  Snackbar,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  Divider,
} from '@mui/material';
import NotificationsNoneOutlined from '@mui/icons-material/NotificationsNoneOutlined';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import PhotoCameraOutlined from '@mui/icons-material/PhotoCameraOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import WorkspacePremiumOutlined from '@mui/icons-material/WorkspacePremiumOutlined';
import CreditCardOutlined from '@mui/icons-material/CreditCardOutlined';
import ChevronRightOutlined from '@mui/icons-material/ChevronRightOutlined';
import DevicesOutlined from '@mui/icons-material/DevicesOutlined';
import MenuBookOutlined from '@mui/icons-material/MenuBookOutlined';
import FormatListNumberedOutlined from '@mui/icons-material/FormatListNumberedOutlined';
import HeadphonesOutlined from '@mui/icons-material/HeadphonesOutlined';
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined';
import RecordVoiceOverOutlined from '@mui/icons-material/RecordVoiceOverOutlined';
import LockOutlined from '@mui/icons-material/LockOutlined';
import ShareOutlined from '@mui/icons-material/ShareOutlined';
import LocalLibraryOutlined from '@mui/icons-material/LocalLibraryOutlined';
import { useTranslation } from 'react-i18next';
import tokens from '../config/tokens';
import * as authService from '../services/auth.service';
import { authFetch } from '../services/auth.service';
import { getPreferences as getNotifPrefs, updatePreferences as updateNotifPrefs } from '../services/notifications.service';
import UserSpaceSidebar from '../components/UserSpaceSidebar';
import MobileBottomNav from '../components/MobileBottomNav';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const primary = tokens.colors.primary;
const primaryDark = tokens.colors.primaryDark;
const primaryLight = tokens.colors.primaryLight;
const secondary = tokens.colors.secondary;
const bgLight = tokens.colors.backgrounds.light;
const surfaceDefault = tokens.colors.surfaces.light.default;
const surfaceVariant = tokens.colors.surfaces.light.variant;
const textMain = tokens.colors.onBackground.light;
const textMuted = '#9c7e49';

const emptyStats = {
  completedBooks: 0,
  inProgressBooks: 0,
  totalHours: 0,
  audioHours: 0,
  streakDays: 0,
};

const safeJson = async (response) => response.json().catch(() => ({}));

function dayKey(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function computeProfileStats(historyItems) {
  const completedIds = new Set();
  const inProgressIds = new Set();
  const activeDays = new Set();
  let totalSeconds = 0;
  let audioSeconds = 0;

  historyItems.forEach((item) => {
    const progress = Number(item.progress_percent || 0);
    const completed = Boolean(item.is_completed) || progress >= 100;
    const id = item.content_id || item.id;
    if (id && completed) completedIds.add(id);
    if (id && progress > 0 && progress < 100) inProgressIds.add(id);

    const seconds = Number(item.total_time_seconds || 0);
    totalSeconds += seconds;
    if (String(item.content_type || '').toLowerCase() === 'audiobook') {
      audioSeconds += seconds;
    }

    const key = dayKey(item.last_read_at);
    if (key) activeDays.add(key);
  });

  let streakDays = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  while (activeDays.has(dayKey(cursor))) {
    streakDays += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return {
    completedBooks: completedIds.size,
    inProgressBooks: inProgressIds.size,
    totalHours: Math.round(totalSeconds / 3600),
    audioHours: Math.round(audioSeconds / 3600),
    streakDays,
  };
}

function formatMemberSince(createdAt, t, locale = 'fr-FR') {
  if (!createdAt) return t('profile.memberSinceRecently');
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) return t('profile.memberSinceRecently');
  const label = parsed.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  return t('profile.memberSince', { date: label.charAt(0).toUpperCase() + label.slice(1) });
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith('fr') ? 'fr-FR' : 'en-US';
  const [user, setUser] = useState(null);
  const [exportLoading, setExportLoading]       = useState(false);
  const [gdprRequestSent, setGdprRequestSent]   = useState(false);
  const [gdprLoading, setGdprLoading]           = useState(false);
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    email: '',
    language: 'fr',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [stats, setStats] = useState(emptyStats);
  const [subscriptionData, setSubscriptionData] = useState(null);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [notifPrefs, setNotifPrefs] = useState(null);
  const [notifSaving, setNotifSaving] = useState(false);

  const subscriptionLabel = useMemo(() => {
    if (!subscriptionData) return t('profile.noActiveSubscription');
    const { isActive, cancelAtPeriodEnd, endDateRaw, hasSubscription } = subscriptionData;
    const endDate = endDateRaw ? new Date(endDateRaw).toLocaleDateString(locale) : '';
    if (isActive && cancelAtPeriodEnd && endDate) return t('profile.cancelledUntil', { date: endDate });
    if (isActive && endDate) return t('profile.activeUntil', { date: endDate });
    if (isActive) return t('profile.activeSubscription');
    if (hasSubscription) return t('profile.inactiveSubscription');
    return t('profile.noActiveSubscription');
  }, [subscriptionData, i18n.language, locale, t]);

  useEffect(() => {
    async function loadProfile() {
      try {
        const [userRes, historyRes, subscriptionRes, notifRes] = await Promise.allSettled([
          authFetch(`${API_URL}/users/me`),
          authFetch(`${API_URL}/reading-history?page=1&limit=100`),
          authFetch(`${API_URL}/api/subscriptions/me`),
          getNotifPrefs(),
        ]);

        if (notifRes.status === 'fulfilled' && notifRes.value) {
          setNotifPrefs(notifRes.value);
        }

        if (userRes.status === 'fulfilled' && userRes.value.ok) {
          const payload = await safeJson(userRes.value);
          const currentUser = payload?.data || null;
          if (currentUser) {
            setUser(currentUser);
            setAvatarPreview(currentUser.avatar_url || '');
            setProfileForm({
              full_name: currentUser.full_name || '',
              email: currentUser.email || '',
              language: currentUser.language || 'fr',
            });
          }
        } else {
          const fallbackUser = await authService.getUser();
          if (fallbackUser) {
            setUser(fallbackUser);
            setAvatarPreview(fallbackUser.avatar_url || '');
            setProfileForm({
              full_name: fallbackUser.full_name || '',
              email: fallbackUser.email || '',
              language: fallbackUser.language || 'fr',
            });
          }
        }

        if (historyRes.status === 'fulfilled' && historyRes.value.ok) {
          const payload = await safeJson(historyRes.value);
          const items = Array.isArray(payload?.data) ? payload.data : [];
          setStats(computeProfileStats(items));
        }

        if (subscriptionRes.status === 'fulfilled' && subscriptionRes.value.ok) {
          const payload = await safeJson(subscriptionRes.value);
          const isActive = Boolean(payload?.isActive);
          const subscription = payload?.subscription || null;
          setHasActiveSubscription(isActive);
          const cancelAtPeriodEnd = Boolean(subscription?.cancel_at_period_end);
          const endDateRaw = subscription?.current_period_end || null;
          setSubscriptionData({
            isActive,
            cancelAtPeriodEnd,
            endDateRaw,
            hasSubscription: Boolean(payload?.hasSubscription),
          });
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
        setErrorMsg(t('profile.cannotLoad'));
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  useEffect(() => () => {
    if (avatarPreview && avatarPreview.startsWith('blob:')) {
      URL.revokeObjectURL(avatarPreview);
    }
  }, [avatarPreview]);

  const handleFormChange = (field) => (e) => {
    setProfileForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const openAvatarDialog = () => {
    setAvatarFile(null);
    setAvatarPreview(user?.avatar_url || '');
    setAvatarDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const response = await authFetch(`${API_URL}/users/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: profileForm.full_name,
          language: profileForm.language,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error?.message || t('profile.saveError'));
      }
      const payload = await safeJson(response);
      setSuccessMsg(t('profile.saveSuccess'));
      // Update local user state
      setUser((prev) => ({
        ...prev,
        ...payload?.data,
        full_name: profileForm.full_name,
        language: profileForm.language,
      }));
    } catch (err) {
      setErrorMsg(err.message || t('profile.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAvatar = async () => {
    if (!avatarFile) {
      setErrorMsg(t('profile.selectImageFirst'));
      return;
    }

    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const formData = new FormData();
      formData.append('avatar', avatarFile);
      const response = await authFetch(`${API_URL}/users/me/avatar`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const payload = await safeJson(response);
        throw new Error(payload?.error?.message || t('profile.avatarUpdateError'));
      }

      const payload = await safeJson(response);
      setUser((prev) => ({ ...prev, ...payload?.data }));
      setAvatarFile(null);
      setAvatarPreview(payload?.data?.avatar_url || '');
      setAvatarDialogOpen(false);
      setSuccessMsg(t('profile.avatarUpdateSuccess'));
    } catch (err) {
      setErrorMsg(err.message || t('profile.avatarUpdateError'));
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    if (!file) return;

    if (!String(file.type || '').startsWith('image/')) {
      setErrorMsg(t('profile.mustBeImage'));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg(t('profile.imageTooLarge'));
      return;
    }

    setErrorMsg('');
    setAvatarFile(file);
    if (avatarPreview && avatarPreview.startsWith('blob:')) {
      URL.revokeObjectURL(avatarPreview);
    }
    const localPreview = URL.createObjectURL(file);
    setAvatarPreview(localPreview);
  };

  const handleNotifToggle = async (key, value) => {
    const updated = { ...(notifPrefs || {}), [key]: value };
    setNotifPrefs(updated);
    setNotifSaving(true);
    try {
      const saved = await updateNotifPrefs(updated);
      if (saved) setNotifPrefs(saved);
    } catch (_) {
      setNotifPrefs((prev) => ({ ...(prev || {}), [key]: !value }));
    } finally {
      setNotifSaving(false);
    }
  };

  const memberSinceLabel = useMemo(() => formatMemberSince(user?.created_at, t, locale), [user?.created_at, i18n.language, t, locale]);

  const handleShareSuccesses = async () => {
    const name = user?.full_name?.split(' ')[0] || 'Un lecteur Papyri';
    const text = [
      `📚 ${name} sur Papyri :`,
      `• ${stats.completedBooks} livre${stats.completedBooks > 1 ? 's' : ''} terminé${stats.completedBooks > 1 ? 's' : ''}`,
      `• ${stats.totalHours}h de lecture`,
      stats.streakDays > 0 ? `• ${stats.streakDays} jours de série en cours 🔥` : null,
      ``,
      `Rejoins-moi sur Papyri — la bibliothèque numérique 📖`,
    ].filter(Boolean).join('\n');

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Mes succès Papyri', text });
      } catch (_) {
        // user cancelled — do nothing
      }
    } else {
      try {
        await navigator.clipboard.writeText(text);
        setSuccessMsg(t('profile.copiedToClipboard'));
      } catch (_) {
        setSuccessMsg(t('profile.cannotShare'));
      }
    }
  };
  const nextBadgeTarget = 50;
  const nextBadgeProgress = Math.min(100, Math.round((stats.completedBooks / nextBadgeTarget) * 100));
  const remainingForNextBadge = Math.max(0, nextBadgeTarget - stats.completedBooks);

  const badges = useMemo(() => ([
    {
      id: 1,
      name: 'Dévoreur de classiques',
      icon: LocalLibraryOutlined,
      unlocked: stats.completedBooks >= 10,
      date: stats.completedBooks >= 10 ? 'Objectif atteint' : `${stats.completedBooks}/10 livres`,
      gradient: ['#FEF3C7', '#FDE68A'],
      borderColor: '#F59E0B',
      iconColor: '#92400E',
    },
    {
      id: 2,
      name: 'Série de lecture',
      icon: CalendarMonthOutlined,
      unlocked: stats.streakDays >= 7,
      date: stats.streakDays >= 7 ? `${stats.streakDays} jours de suite` : `${stats.streakDays}/7 jours`,
      gradient: ['#FFEDD5', '#FEE2E2'],
      borderColor: '#FB923C',
      iconColor: '#9A3412',
    },
    {
      id: 3,
      name: 'Auditeur fidèle',
      icon: RecordVoiceOverOutlined,
      unlocked: stats.audioHours >= 10,
      date: stats.audioHours >= 10 ? `${stats.audioHours}h audio` : `${stats.audioHours}/10h audio`,
      gradient: ['#DBEAFE', '#E0E7FF'],
      borderColor: '#60A5FA',
      iconColor: '#1E3A5F',
    },
    {
      id: 4,
      name: 'Bibliophile Expert',
      icon: WorkspacePremiumOutlined,
      unlocked: stats.completedBooks >= 50,
      date: stats.completedBooks >= 50 ? 'Niveau légendaire' : `${stats.completedBooks}/50 livres`,
      gradient: ['#E5E7EB', '#E5E7EB'],
      borderColor: '#9CA3AF',
      iconColor: '#6B7280',
    },
  ]), [stats.audioHours, stats.completedBooks, stats.streakDays]);

  const handleDataExport = async () => {
    setExportLoading(true);
    try {
      const r    = await authFetch(`${API_URL}/users/me/data-export`);
      const blob = await r.blob();
      const url  = URL.createObjectURL(blob);
      const a    = Object.assign(document.createElement('a'), { href: url, download: `mes-donnees-papyri-${new Date().toISOString().split('T')[0]}.json` });
      a.click(); URL.revokeObjectURL(url);
    } catch (e) { setErrorMsg(t('profile.exportError')); }
    finally { setExportLoading(false); }
  };

  const handleGdprRequest = async () => {
    setGdprLoading(true);
    try {
      await authFetch(`${API_URL}/users/me/gdpr-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_type: 'deletion' }),
      });
      setGdprRequestSent(true);
      setSuccessMsg(t('profile.gdprRequestSent'));
    } catch (e) {
      setErrorMsg(e.message?.includes('409') || e.message?.includes('en cours') ? t('profile.gdprAlreadyPending') : t('profile.gdprSubmitError'));
    } finally {
      setGdprLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: bgLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress sx={{ color: primary }} />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: bgLight, display: 'flex' }}>
      <UserSpaceSidebar user={user} activeKey="preferences" subscriptionLabel={subscriptionLabel} />

      <Box sx={{ flex: 1 }}>
      {/* Page Content */}
      <Box sx={{ maxWidth: 1200, mx: 'auto', px: { xs: 1.25, sm: 2, md: 4 }, py: { xs: 1.5, md: 4 } }}>
        {/* Page Header */}
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'flex-start' }, justifyContent: 'space-between', mb: 3, gap: 1.5 }}>
          <Box>
            <Typography
              variant="h4"
              component="h1"
              sx={{
                fontWeight: 700,
                color: textMain,
                fontFamily: '"Newsreader", Georgia, serif',
                fontSize: { xs: '1.9rem', sm: '2.2rem', md: '3rem' },
                mb: 0.5,
                letterSpacing: '-0.033em',
              }}
            >
              {t('profile.pageTitle')}
            </Typography>
            <Typography
              sx={{
                color: textMuted,
                fontSize: '0.95rem',
              }}
            >
              {t('profile.pageSubtitle')}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<SettingsOutlined />}
            sx={{
              borderColor: surfaceVariant,
              color: textMain,
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 500,
              alignSelf: { xs: 'stretch', sm: 'auto' },
              '&:hover': {
                borderColor: primary,
                bgcolor: `${primary}08`,
              },
            }}
          >
            {t('common.settings')}
          </Button>
        </Box>

        <Box
          sx={{
            display: { xs: 'grid', md: 'none' },
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 1,
            mb: 2.5,
          }}
        >
          {[
            { label: t('profile.statCompleted'), value: `${stats.completedBooks}` },
            { label: t('profile.statInProgress'), value: `${stats.inProgressBooks}` },
            { label: t('profile.statStreak'), value: `${stats.streakDays}j` },
          ].map((item) => (
            <Paper key={item.label} elevation={0} sx={{ p: 1.4, borderRadius: 3, border: `1px solid ${surfaceVariant}` }}>
              <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {item.label}
              </Typography>
              <Typography sx={{ mt: 0.25, fontSize: '1rem', fontWeight: 800, color: textMain }}>
                {item.value}
              </Typography>
            </Paper>
          ))}
        </Box>

        <Paper
          elevation={0}
          sx={{
            display: { xs: 'block', md: 'none' },
            p: 1.25,
            mb: 2.5,
            borderRadius: '12px',
            border: `1px solid ${surfaceVariant}`,
          }}
        >
          <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
            {t('common.settings')}
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1 }}>
            {[
              { label: t('common.profile'), icon: SettingsOutlined, active: true, onClick: () => navigate('/profile') },
              { label: t('common.devices'), icon: DevicesOutlined, onClick: () => navigate('/devices') },
              { label: t('common.security'), icon: LockOutlined, onClick: () => navigate('/security') },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.label}
                  onClick={item.onClick}
                  sx={{
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.5,
                    borderRadius: '12px',
                    py: 1.1,
                    px: 0.75,
                    textTransform: 'none',
                    color: item.active ? primary : textMain,
                    bgcolor: item.active ? `${primary}12` : surfaceVariant,
                    '&:hover': { bgcolor: item.active ? `${primary}18` : `${primary}0D` },
                  }}
                >
                  <Icon sx={{ fontSize: 20 }} />
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, lineHeight: 1.1, textAlign: 'center' }}>
                    {item.label}
                  </Typography>
                </Button>
              );
            })}
          </Box>
        </Paper>

        {/* Two-column layout */}
        <Grid container spacing={3}>
          {/* Left Column (4/12) */}
          <Grid size={{ xs: 12, md: 4 }}>
            {/* Profile Card */}
            <Paper
              elevation={0}
              sx={{
                p: { xs: 2, md: 3 },
                borderRadius: '12px',
                overflow: 'hidden',
                position: 'relative',
                border: `1px solid ${surfaceVariant}`,
                mb: 3,
              }}
            >
              {/* Gradient Overlay */}
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: 96,
                  background: `linear-gradient(to bottom, ${primary}1A, transparent)`,
                  borderRadius: '12px 12px 0 0',
                }}
              />

              {/* Avatar */}
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2, position: 'relative', zIndex: 1, pt: { xs: 1.5, md: 2 } }}>
                <Box sx={{ position: 'relative' }}>
                  <Avatar
                    src={user?.avatar_url}
                    onClick={openAvatarDialog}
                    sx={{
                      width: { xs: 104, md: 128 },
                      height: { xs: 104, md: 128 },
                      border: '4px solid #fff',
                      boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
                      fontSize: { xs: '2.25rem', md: '3rem' },
                      bgcolor: primary,
                      cursor: 'pointer',
                      '&:hover .camera-overlay': {
                        opacity: 1,
                      },
                    }}
                  >
                    {user?.full_name?.[0]?.toUpperCase() || 'U'}
                  </Avatar>
                  {/* Camera overlay on hover */}
                  <Box
                    className="camera-overlay"
                    onClick={openAvatarDialog}
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      bgcolor: 'rgba(0,0,0,0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0,
                      transition: 'opacity 0.2s',
                      cursor: 'pointer',
                    }}
                  >
                    <PhotoCameraOutlined sx={{ color: '#fff', fontSize: 32 }} />
                  </Box>
                  {/* Edit badge */}
                  <Box
                    onClick={openAvatarDialog}
                    sx={{
                      position: 'absolute',
                      bottom: 4,
                      right: 4,
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      bgcolor: surfaceDefault,
                      border: `2px solid ${surfaceVariant}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                    }}
                  >
                    <EditOutlined sx={{ fontSize: 16, color: textMain }} />
                  </Box>
                </Box>
              </Box>

              {/* Name */}
              <Typography
                variant="h6"
                sx={{
                  textAlign: 'center',
                  fontWeight: 700,
                  color: textMain,
                  mb: 1,
                }}
              >
                {user?.full_name || 'Jean Dupont'}
              </Typography>

              {/* Premium Badge */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.5,
                  mb: 1,
                }}
              >
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.5,
                    bgcolor: `${primary}1A`,
                    color: primary,
                    px: 1.5,
                    py: 0.5,
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                  }}
                >
                  <WorkspacePremiumOutlined sx={{ fontSize: 16 }} />
                  {hasActiveSubscription ? t('profile.premiumMember') : t('profile.standardMember')}
                </Box>
              </Box>

              {/* Member since */}
              <Typography
                sx={{
                  textAlign: 'center',
                  color: textMuted,
                  fontSize: '0.8rem',
                  mb: 3,
                }}
              >
                {memberSinceLabel}
              </Typography>

              {/* Edit Form */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box>
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: textMain, mb: 0.5 }}>
                    {t('profile.fullName')}
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    value={profileForm.full_name}
                    onChange={handleFormChange('full_name')}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '8px',
                        '& fieldset': {
                          borderColor: surfaceVariant,
                        },
                        '&:hover fieldset': {
                          borderColor: primaryLight,
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: primary,
                        },
                      },
                    }}
                  />
                </Box>

                <Box>
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: textMain, mb: 0.5 }}>
                    {t('profile.email')}
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    type="email"
                    value={profileForm.email}
                    disabled
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '8px',
                        '& fieldset': {
                          borderColor: surfaceVariant,
                        },
                        '&:hover fieldset': {
                          borderColor: primaryLight,
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: primary,
                        },
                      },
                    }}
                  />
                </Box>

                <Box>
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: textMain, mb: 0.5 }}>
                    {t('profile.language')}
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    select
                    value={profileForm.language}
                    onChange={handleFormChange('language')}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '8px',
                        '& fieldset': {
                          borderColor: surfaceVariant,
                        },
                        '&:hover fieldset': {
                          borderColor: primaryLight,
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: primary,
                        },
                      },
                    }}
                  >
                    <MenuItem value="fr">Français</MenuItem>
                    <MenuItem value="en">English</MenuItem>
                    <MenuItem value="es">Español</MenuItem>
                    <MenuItem value="pt">Português</MenuItem>
                  </TextField>
                </Box>

                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleSave}
                  disabled={saving}
                  sx={{
                    bgcolor: primary,
                    color: '#fff',
                    borderRadius: '8px',
                    textTransform: 'none',
                    fontWeight: 600,
                    py: 1.2,
                    boxShadow: 'none',
                    '&:hover': {
                      bgcolor: primaryDark,
                      boxShadow: '0 4px 12px rgba(181,101,29,0.3)',
                    },
                    '&:disabled': {
                      bgcolor: `${primary}80`,
                      color: '#fff',
                    },
                  }}
                >
                  {saving ? t('common.loading') : t('profile.saveChanges')}
                </Button>
              </Box>
            </Paper>

            {/* Security & Account Card */}
            <Paper
              elevation={0}
              sx={{
                borderRadius: '12px',
                overflow: 'hidden',
                border: `1px solid ${surfaceVariant}`,
              }}
            >
              <Typography
                sx={{
                  fontWeight: 700,
                  color: textMain,
                  fontSize: '0.95rem',
                  px: 3,
                  pt: 2.5,
                  pb: 1,
                }}
              >
                {t('profile.securityAccount')}
              </Typography>

              {/* Manage subscription */}
              <Box
                onClick={() => navigate('/subscription')}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  px: 3,
                  py: 1.5,
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                  '&:hover': { bgcolor: `${surfaceVariant}80` },
                }}
              >
                <CreditCardOutlined sx={{ fontSize: 20, color: textMuted, mr: 1.5 }} />
                <Typography sx={{ flex: 1, fontSize: '0.875rem', color: textMain }}>
                  {t('subscription.manageSubscription')}
                </Typography>
                <ChevronRightOutlined sx={{ fontSize: 20, color: textMuted }} />
              </Box>

              <Divider sx={{ mx: 3 }} />

              {/* Notifications */}
              <Typography
                variant="overline"
                sx={{ fontWeight: 700, color: textMuted, fontSize: '0.7rem', px: 3, pt: 2, pb: 0.5, display: 'block' }}
              >
                  {t('profile.notifications')}
              </Typography>
              {[
                { key: 'push_enabled',          icon: NotificationsNoneOutlined, label: t('profile.pushNotifications') },
                { key: 'new_content',            icon: null,                       label: t('profile.newContent'), indent: true, depends: 'push_enabled' },
                { key: 'reading_reminders',      icon: null,                       label: t('profile.readingReminders'), indent: true, depends: 'push_enabled' },
                { key: 'subscription_updates',   icon: null,                       label: t('profile.subscriptionUpdates'), indent: true, depends: 'push_enabled' },
              ].map(({ key, icon: Icon, label, indent, depends }) => {
                const disabled = notifSaving || (depends && !notifPrefs?.[depends]);
                const checked = Boolean(notifPrefs?.[key]);
                return (
                  <Box
                    key={key}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      px: indent ? 5 : 3,
                      py: 0.75,
                      opacity: disabled && depends ? 0.45 : 1,
                    }}
                  >
                    {Icon && <Icon sx={{ fontSize: 18, color: textMuted, mr: 1.5 }} />}
                    <Typography sx={{ flex: 1, fontSize: '0.85rem', color: textMain }}>
                      {label}
                    </Typography>
                    <Switch
                      size="small"
                      checked={checked}
                      disabled={disabled}
                      onChange={(e) => handleNotifToggle(key, e.target.checked)}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': { color: primary },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: primary },
                      }}
                    />
                  </Box>
                );
              })}
              <Box sx={{ pb: 2 }} />

              <Divider sx={{ mx: 3 }} />

              {/* RGPD */}
              <Typography variant="overline" sx={{ fontWeight: 700, color: textMuted, fontSize: '0.7rem', px: 3, pt: 2, pb: 0.5, display: 'block' }}>
                {t('profile.dataPrivacy')}
              </Typography>
              <Box sx={{ px: 3, pb: 1 }}>
                <Typography sx={{ fontSize: '0.75rem', color: textMuted, mb: 1.5, lineHeight: 1.5 }}>
                  {t('profile.gdprDesc')}
                </Typography>
                <Button
                  fullWidth variant="outlined" size="small"
                  disabled={exportLoading}
                  onClick={handleDataExport}
                  sx={{ mb: 1, borderRadius: '10px', textTransform: 'none', fontWeight: 600, fontSize: '0.8rem', borderColor: primary, color: primary, '&:hover': { bgcolor: `${primary}10` } }}
                >
                  {exportLoading ? t('common.loading') : t('profile.downloadData')}
                </Button>
                <Button
                  fullWidth variant="outlined" size="small"
                  disabled={gdprLoading || gdprRequestSent}
                  onClick={handleGdprRequest}
                  sx={{ mb: 1, borderRadius: '10px', textTransform: 'none', fontWeight: 600, fontSize: '0.8rem', borderColor: '#dc2626', color: '#dc2626', '&:hover': { bgcolor: '#fee2e2' } }}
                >
                  {gdprLoading ? t('common.loading') : gdprRequestSent ? t('profile.gdprRequestSent') : t('profile.deleteAccount')}
                </Button>
              </Box>
              <Box sx={{ pb: 2 }} />
            </Paper>
          </Grid>

          {/* Right Column (8/12) */}
          <Grid size={{ xs: 12, md: 8 }}>
            {/* Stats Cards */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              {[
                { icon: MenuBookOutlined, value: stats.completedBooks, label: t('profile.statCompletedLabel'), color: primary },
                { icon: FormatListNumberedOutlined, value: stats.inProgressBooks, label: t('profile.statInProgressLabel'), color: secondary },
                { icon: HeadphonesOutlined, value: `${stats.totalHours}h`, label: t('profile.statTotalTimeLabel'), color: tokens.colors.accent },
              ].map((stat) => (
                <Grid size={{ xs: 4, sm: 4 }} key={stat.label}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: { xs: 1.6, md: 3 },
                      borderRadius: '12px',
                      textAlign: 'center',
                      border: `1px solid ${surfaceVariant}`,
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      cursor: 'default',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                      },
                    }}
                  >
                    <Box
                      sx={{
                        width: { xs: 44, md: 56 },
                        height: { xs: 44, md: 56 },
                        borderRadius: '50%',
                        bgcolor: `${stat.color}14`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 1.5,
                      }}
                    >
                      <stat.icon sx={{ fontSize: { xs: 22, md: 28 }, color: stat.color }} />
                    </Box>
                    <Typography
                      sx={{
                        fontSize: { xs: '1.35rem', md: '2rem' },
                        fontWeight: 800,
                        color: textMain,
                        lineHeight: 1.1,
                      }}
                    >
                      {stat.value}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: textMuted,
                        letterSpacing: '0.08em',
                        mt: 0.5,
                      }}
                    >
                      {stat.label}
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>

            {/* Next Badge Progress */}
            <Paper
              elevation={0}
              sx={{
                p: { xs: 2, md: 3 },
                borderRadius: '12px',
                border: `1px solid ${surfaceVariant}`,
                mb: 3,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                <Box>
                  <Typography
                    sx={{
                      fontWeight: 700,
                      color: textMain,
                      fontSize: '1rem',
                      mb: 0.5,
                    }}
                  >
                    Prochain Badge : Bibliophile Expert
                  </Typography>
                  <Typography
                    sx={{
                      color: textMuted,
                      fontSize: '0.85rem',
                    }}
                  >
                    Lisez 50 livres pour d&eacute;bloquer ce badge l&eacute;gendaire.
                  </Typography>
                </Box>
                <Typography
                  sx={{
                    fontSize: '1.5rem',
                    fontWeight: 800,
                    color: primary,
                    whiteSpace: 'nowrap',
                    ml: 2,
                  }}
                >
                  {stats.completedBooks}/{nextBadgeTarget}
                </Typography>
              </Box>

              <LinearProgress
                variant="determinate"
                value={nextBadgeProgress}
                sx={{
                  height: 10,
                  borderRadius: '5px',
                  bgcolor: `${primary}1A`,
                  mb: 1,
                  '& .MuiLinearProgress-bar': {
                    borderRadius: '5px',
                    bgcolor: primary,
                  },
                }}
              />

              <Typography
                sx={{
                  fontSize: '0.8rem',
                  color: textMuted,
                  fontWeight: 500,
                }}
              >
                {remainingForNextBadge > 0 ? `Plus que ${remainingForNextBadge} livres !` : 'Objectif atteint !'}
              </Typography>
            </Paper>

            {/* Badges & Accomplissements */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography
                  sx={{
                    fontWeight: 700,
                    color: textMain,
                    fontSize: '1.1rem',
                  }}
                >
                  Badges &amp; Accomplissements
                </Typography>
                <Typography
                  component="a"
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  sx={{
                    color: primary,
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                    cursor: 'pointer',
                    '&:hover': { textDecoration: 'underline' },
                  }}
                >
                  Voir tout
                </Typography>
              </Box>

              <Grid container spacing={2}>
                {badges.map((badge) => {
                  const BadgeIcon = badge.icon;
                  return (
                    <Grid size={{ xs: 6, sm: 3 }} key={badge.id}>
                      <Box
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          textAlign: 'center',
                          opacity: badge.unlocked ? 1 : 0.6,
                        }}
                      >
                        <Box
                          sx={{
                            position: 'relative',
                            width: { xs: 80, md: 96 },
                            height: { xs: 80, md: 96 },
                            borderRadius: '50%',
                            background: `linear-gradient(135deg, ${badge.gradient[0]}, ${badge.gradient[1]})`,
                            border: `4px solid ${badge.borderColor}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            mb: 1.5,
                          }}
                        >
                          <BadgeIcon sx={{ fontSize: { xs: 34, md: 40 }, color: badge.iconColor }} />
                          {/* Lock overlay for locked badges */}
                          {!badge.unlocked && (
                            <Box
                              sx={{
                                position: 'absolute',
                                bottom: -2,
                                right: -2,
                                width: 28,
                                height: 28,
                                borderRadius: '50%',
                                bgcolor: '#6B7280',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '2px solid #fff',
                              }}
                            >
                              <LockOutlined sx={{ fontSize: 14, color: '#fff' }} />
                            </Box>
                          )}
                        </Box>
                        <Typography
                          sx={{
                            fontWeight: 700,
                            color: textMain,
                            fontSize: '0.8rem',
                            lineHeight: 1.3,
                            mb: 0.5,
                          }}
                        >
                          {badge.name}
                        </Typography>
                        <Typography
                          sx={{
                            color: textMuted,
                            fontSize: '0.7rem',
                          }}
                        >
                          {badge.date}
                        </Typography>
                      </Box>
                    </Grid>
                  );
                })}
              </Grid>
            </Box>

            {/* Share Button */}
            <Box sx={{ display: 'flex', justifyContent: { xs: 'stretch', md: 'flex-end' } }}>
              <Button
                variant="outlined"
                startIcon={<ShareOutlined />}
                onClick={handleShareSuccesses}
                sx={{
                  borderColor: primary,
                  color: primary,
                  borderRadius: '50px',
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 3,
                  width: { xs: '100%', md: 'auto' },
                  '&:hover': {
                    bgcolor: primary,
                    color: '#fff',
                    borderColor: primary,
                  },
                }}
              >
                Partager mes succ&egrave;s
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Box>
      </Box>

      <Dialog open={avatarDialogOpen} onClose={() => setAvatarDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Modifier la photo de profil</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1, mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar src={avatarPreview || user?.avatar_url} alt={user?.full_name || 'Photo de profil'} sx={{ width: 84, height: 84, bgcolor: primary }}>
              {user?.full_name?.[0]?.toUpperCase() || 'U'}
            </Avatar>
            <Box>
              <Button component="label" variant="outlined" sx={{ textTransform: 'none', mb: 1 }}>
                Choisir une image
                <input hidden type="file" accept="image/*" onChange={handleAvatarFileChange} />
              </Button>
              <Typography sx={{ fontSize: '0.82rem', color: textMuted }}>
                PNG/JPG/WebP, max 5MB.
              </Typography>
              {avatarFile && (
                <Typography sx={{ fontSize: '0.8rem', color: textMain, mt: 0.5 }}>
                  {avatarFile.name}
                </Typography>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAvatarDialogOpen(false)} sx={{ textTransform: 'none' }}>
            Annuler
          </Button>
          <Button onClick={handleSaveAvatar} disabled={saving} variant="contained" sx={{ textTransform: 'none', bgcolor: primary, '&:hover': { bgcolor: primaryDark } }}>
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success Snackbar */}
      <Snackbar
        open={!!successMsg}
        autoHideDuration={4000}
        onClose={() => setSuccessMsg('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSuccessMsg('')} severity="success" variant="filled" sx={{ width: '100%' }}>
          {successMsg}
        </Alert>
      </Snackbar>

      {/* Error Snackbar */}
      <Snackbar
        open={!!errorMsg}
        autoHideDuration={5000}
        onClose={() => setErrorMsg('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setErrorMsg('')} severity="error" variant="filled" sx={{ width: '100%' }}>
          {errorMsg}
        </Alert>
      </Snackbar>
      <MobileBottomNav />
    </Box>
  );
}
