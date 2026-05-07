import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, Typography, Button } from '@mui/material';
import DashboardOutlined from '@mui/icons-material/DashboardOutlined';
import AutoStoriesOutlined from '@mui/icons-material/AutoStoriesOutlined';
import AnalyticsOutlined from '@mui/icons-material/AnalyticsOutlined';
import PaymentOutlined from '@mui/icons-material/PaymentOutlined';
import MenuOutlined from '@mui/icons-material/MenuOutlined';
import LanguageOutlined from '@mui/icons-material/LanguageOutlined';
import SwitchAccountOutlined from '@mui/icons-material/SwitchAccountOutlined';
import tokens from '../config/tokens';
import { useTranslation } from 'react-i18next';
import { getActiveProfile } from '../config/profileStorage';
import * as authService from '../services/auth.service';
import AppDrawer from './AppDrawer';

export default function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [activeProfile, setActiveProfile] = useState(() => getActiveProfile());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    authService.getUser().then((u) => setUser(u || null)).catch(() => setUser(null));
  }, []);

  useEffect(() => {
    const handleProfileChange = (event) => setActiveProfile(event?.detail || null);
    window.addEventListener('papyri:profile-changed', handleProfileChange);
    return () => window.removeEventListener('papyri:profile-changed', handleProfileChange);
  }, []);

  const navItems = [
    { label: t('mobileNav.home'), icon: DashboardOutlined, route: '/dashboard' },
    { label: t('mobileNav.library'), icon: AutoStoriesOutlined, route: '/my-list' },
    { label: t('mobileNav.stats'), icon: AnalyticsOutlined, route: '/history' },
    { label: t('mobileNav.subscription'), icon: PaymentOutlined, route: '/subscription' },
    // 5e item : ouvre le drawer global (préférences, sécurité, déconnexion, etc.)
    { label: t('mobileNav.menu', { defaultValue: 'Menu' }), icon: MenuOutlined, action: 'drawer' },
  ].filter((item) => {
    // Kid profiles
    if (activeProfile?.is_kid) {
      return !['/subscription', '/profile'].includes(item.route);
    }
    // Non-owner family profiles: hide subscription. Menu drawer stays accessible.
    if (activeProfile && activeProfile.is_owner_profile === false) {
      return item.route !== '/subscription';
    }
    return true;
  });

  return (
    <>
      {/* Bottom padding so page content doesn't hide under the nav */}
      <Box sx={{ display: { xs: 'block', md: 'none' }, height: 112, flexShrink: 0 }} />

      <Box
        sx={{
          display: { xs: 'flex', md: 'none' },
          position: 'fixed',
          right: 12,
          bottom: 76,
          zIndex: 1201,
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 1,
        }}
      >
        {activeProfile?.id && (
          <Button
            variant="contained"
            startIcon={<SwitchAccountOutlined sx={{ fontSize: 16 }} />}
            onClick={() => navigate('/profiles/select')}
            sx={{
              textTransform: 'none',
              borderRadius: '999px',
              px: 1.6,
              py: 0.85,
              minHeight: 36,
              bgcolor: '#fff',
              color: tokens.colors.onBackground.light,
              fontSize: '0.76rem',
              fontWeight: 700,
              boxShadow: '0 8px 20px rgba(0,0,0,0.14)',
              maxWidth: 220,
              '&:hover': { bgcolor: '#f5f0e7' },
            }}
          >
            {t('sidebar.profile', { name: activeProfile.name })}
          </Button>
        )}
        <Button
          variant="contained"
          startIcon={<LanguageOutlined sx={{ fontSize: 16 }} />}
          onClick={() => navigate('/')}
          aria-label={t('mobileNav.visitSite')}
          sx={{
            textTransform: 'none',
            borderRadius: '999px',
            px: 1.6,
            py: 0.85,
            minHeight: 36,
            bgcolor: tokens.colors.primary,
            color: '#fff',
            fontSize: '0.78rem',
            fontWeight: 700,
            boxShadow: '0 8px 20px rgba(0,0,0,0.18)',
            '&:hover': { bgcolor: tokens.colors.primaryDark },
          }}
        >
          {t('mobileNav.visitSite')}
        </Button>
      </Box>

      <Box
        sx={{
          display: { xs: 'flex', md: 'none' },
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1200,
          bgcolor: '#fff',
          borderTop: `1px solid ${tokens.colors.surfaces.light.variant}`,
          height: 64,
          alignItems: 'center',
          justifyContent: 'space-around',
          px: 1,
          boxShadow: '0 -2px 12px rgba(0,0,0,0.06)',
        }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isAction = Boolean(item.action);
          const isActive = isAction
            ? false
            : (item.matchRoutes
              ? item.matchRoutes.some((route) => location.pathname === route || location.pathname.startsWith(`${route}/`))
              : location.pathname === item.route
                || (item.route !== '/dashboard' && location.pathname.startsWith(item.route)));
          const handleClick = () => {
            if (item.action === 'drawer') {
              setDrawerOpen(true);
            } else if (item.route) {
              navigate(item.route);
            }
          };
          return (
            <Box
              key={item.label}
              onClick={handleClick}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.3,
                flex: 1,
                cursor: 'pointer',
                color: isActive ? tokens.colors.primary : '#9c7e49',
                py: 1,
              }}
            >
              <Icon sx={{ fontSize: 22 }} />
              <Typography sx={{ fontSize: '0.62rem', fontWeight: isActive ? 700 : 500, lineHeight: 1 }}>
                {item.label}
              </Typography>
            </Box>
          );
        })}
      </Box>

      <AppDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        isAuthenticated={Boolean(user)}
        user={user}
      />
    </>
  );
}
