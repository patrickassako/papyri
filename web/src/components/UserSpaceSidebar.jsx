import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Avatar, Button, IconButton } from '@mui/material';
import DashboardOutlined from '@mui/icons-material/DashboardOutlined';
import AutoStoriesOutlined from '@mui/icons-material/AutoStoriesOutlined';
import MenuBookOutlined from '@mui/icons-material/MenuBookOutlined';
import AnalyticsOutlined from '@mui/icons-material/AnalyticsOutlined';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import PaymentOutlined from '@mui/icons-material/PaymentOutlined';
import DevicesOutlined from '@mui/icons-material/DevicesOutlined';
import SecurityOutlined from '@mui/icons-material/SecurityOutlined';
import WorkspacePremiumOutlined from '@mui/icons-material/WorkspacePremiumOutlined';
import LogoutOutlined from '@mui/icons-material/LogoutOutlined';
import PhotoCameraOutlined from '@mui/icons-material/PhotoCameraOutlined';
import tokens from '../config/tokens';
import * as authService from '../services/auth.service';
import NotificationBell from './NotificationBell';
import LanguageToggle from './LanguageToggle';
import papyriLogo from '../assets/papyri-wordmark-150x50.png';
import { useTranslation } from 'react-i18next';

export default function UserSpaceSidebar({
  user,
  activeKey = 'overview',
  subscriptionLabel,
}) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const navItems = [
    { label: t('sidebar.overview'), icon: DashboardOutlined, key: 'overview', route: '/dashboard' },
    { label: t('sidebar.myLibrary'), icon: AutoStoriesOutlined, key: 'library', route: '/my-list' },
    { label: t('sidebar.catalog'), icon: MenuBookOutlined, key: 'catalog', route: '/library-catalog' },
    { label: t('sidebar.stats'), icon: AnalyticsOutlined, key: 'stats', route: '/history' },
    { label: t('sidebar.preferences'), icon: SettingsOutlined, key: 'preferences', route: '/profile' },
    { label: t('sidebar.subscription'), icon: PaymentOutlined, key: 'subscription', route: '/subscription' },
    { label: t('sidebar.devices'), icon: DevicesOutlined, key: 'devices', route: '/devices' },
    { label: t('sidebar.security'), icon: SecurityOutlined, key: 'security', route: '/security' },
  ];

  const resolvedSubscriptionLabel = subscriptionLabel || t('sidebar.activeSubscription');

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const userName = user?.full_name || 'Utilisateur';
  const userEmail = user?.email || '';
  const userAvatar = user?.avatar_url || '';

  return (
    <Box
      sx={{
        width: '25%',
        maxWidth: 320,
        minWidth: 260,
        position: 'sticky',
        top: 0,
        height: '100vh',
        bgcolor: '#fff',
        borderRight: `1px solid ${tokens.colors.surfaces.light.variant}`,
        display: { xs: 'none', md: 'flex' },
        flexDirection: 'column',
        overflow: 'auto',
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <Box sx={{ px: 3, py: 2, borderBottom: `1px solid ${tokens.colors.surfaces.light.variant}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box component="img" src={papyriLogo} alt="Papyri" sx={{ height: 36, objectFit: 'contain' }} />
      </Box>

      <Box sx={{ p: 3, textAlign: 'center', borderBottom: `1px solid ${tokens.colors.surfaces.light.variant}`, position: 'relative' }}>
        <Box sx={{ position: 'absolute', top: 12, right: 12 }}>
          <NotificationBell />
        </Box>
        <Box sx={{ position: 'relative', display: 'inline-block', mb: 1.5 }}>
          <Avatar
            src={userAvatar}
            alt={userName}
            sx={{
              width: 80,
              height: 80,
              bgcolor: tokens.colors.primaryLight,
              fontSize: '2rem',
              color: '#fff',
              fontWeight: 600,
            }}
          >
            {userName.charAt(0).toUpperCase()}
          </Avatar>
          <IconButton
            size="small"
            aria-label={t('sidebar.editPhoto')}
            sx={{
              position: 'absolute',
              bottom: 0,
              right: -4,
              bgcolor: tokens.colors.primary,
              color: '#fff',
              width: 28,
              height: 28,
              '&:hover': { bgcolor: tokens.colors.primaryDark },
            }}
          >
            <PhotoCameraOutlined sx={{ fontSize: 14 }} />
          </IconButton>
        </Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: tokens.colors.onBackground.light, lineHeight: 1.3 }}>
          {userName}
        </Typography>
        <Typography variant="body2" sx={{ color: '#9c7e49', mt: 0.25 }}>
          {userEmail}
        </Typography>
      </Box>

      <Box sx={{ flex: 1, p: 2, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeKey === item.key;
          return (
            <Button
              key={item.key}
              onClick={() => item.route && navigate(item.route)}
              disabled={item.disabled || !item.route}
              startIcon={<Icon />}
              fullWidth
              sx={{
                justifyContent: 'flex-start',
                borderRadius: '12px',
                px: 2,
                py: 1.25,
                textTransform: 'none',
                fontSize: '0.9rem',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? tokens.colors.primary : tokens.colors.onBackground.light,
                bgcolor: isActive ? `${tokens.colors.primary}1A` : 'transparent',
                '&:hover': {
                  bgcolor: isActive
                    ? `${tokens.colors.primary}1A`
                    : tokens.colors.surfaces.light.variant,
                },
                '&.Mui-disabled': {
                  color: '#b5b0a7',
                  bgcolor: 'transparent',
                  cursor: 'not-allowed',
                },
                gap: 1,
              }}
            >
              {item.label}
            </Button>
          );
        })}
      </Box>

      <Box sx={{ p: 2, borderTop: `1px solid ${tokens.colors.surfaces.light.variant}` }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            bgcolor: `${tokens.colors.secondary}1A`,
            borderRadius: '12px',
            px: 2,
            py: 1.25,
            mb: 1.5,
          }}
        >
          <WorkspacePremiumOutlined sx={{ color: tokens.colors.secondary, fontSize: 22 }} />
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 700, color: tokens.colors.onBackground.light, lineHeight: 1.2 }}>
              {t('sidebar.premiumMember')}
            </Typography>
            <Typography variant="caption" sx={{ color: '#9c7e49' }}>
              {resolvedSubscriptionLabel}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
          <Button
            onClick={() => navigate('/')}
            sx={{
              flex: 1,
              justifyContent: 'flex-start',
              borderRadius: '12px',
              px: 2,
              py: 1.25,
              textTransform: 'none',
              fontSize: '0.9rem',
              fontWeight: 600,
              color: tokens.colors.primary,
              bgcolor: `${tokens.colors.primary}14`,
              '&:hover': { bgcolor: `${tokens.colors.primary}22` },
              gap: 1,
            }}
          >
            {t('sidebar.visitSite')}
          </Button>
          <LanguageToggle variant="icon" />
        </Box>

        <Button
          onClick={handleLogout}
          startIcon={<LogoutOutlined />}
          fullWidth
          sx={{
            justifyContent: 'flex-start',
            borderRadius: '12px',
            px: 2,
            py: 1.25,
            textTransform: 'none',
            fontSize: '0.9rem',
            fontWeight: 500,
            color: tokens.colors.semantic.error,
            '&:hover': { bgcolor: `${tokens.colors.semantic.error}0D` },
            gap: 1,
          }}
        >
          {t('sidebar.logout')}
        </Button>

        {/* Legal links */}
        <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${tokens.colors.surfaces.light.variant}`, display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
          {[
            { label: t('legal.cgu'), path: '/cgu' },
            { label: t('legal.cgv'), path: '/cgv' },
            { label: t('legal.privacy'), path: '/privacy' },
            { label: t('legal.cookies'), path: '/cookies' },
            { label: t('legal.legalNotice'), path: '/mentions-legales' },
            { label: t('legal.copyright'), path: '/copyright' },
          ].map(link => (
            <Typography
              key={link.path}
              onClick={() => navigate(link.path)}
              sx={{ fontSize: '0.72rem', color: '#9c7e49', cursor: 'pointer', '&:hover': { color: tokens.colors.primary, textDecoration: 'underline' } }}
            >
              {link.label}
            </Typography>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
