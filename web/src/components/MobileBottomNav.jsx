import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, Typography, Button } from '@mui/material';
import DashboardOutlined from '@mui/icons-material/DashboardOutlined';
import AutoStoriesOutlined from '@mui/icons-material/AutoStoriesOutlined';
import AnalyticsOutlined from '@mui/icons-material/AnalyticsOutlined';
import PaymentOutlined from '@mui/icons-material/PaymentOutlined';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import LanguageOutlined from '@mui/icons-material/LanguageOutlined';
import tokens from '../config/tokens';
import { useTranslation } from 'react-i18next';

export default function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const navItems = [
    { label: t('mobileNav.home'), icon: DashboardOutlined, route: '/dashboard' },
    { label: t('mobileNav.library'), icon: AutoStoriesOutlined, route: '/my-list' },
    { label: t('mobileNav.stats'), icon: AnalyticsOutlined, route: '/history' },
    { label: t('mobileNav.subscription'), icon: PaymentOutlined, route: '/subscription' },
    { label: t('mobileNav.settings'), icon: SettingsOutlined, route: '/profile', matchRoutes: ['/profile', '/devices', '/security'] },
  ];

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
        }}
      >
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
          const isActive = item.matchRoutes
            ? item.matchRoutes.some((route) => location.pathname === route || location.pathname.startsWith(`${route}/`))
            : location.pathname === item.route
              || (item.route !== '/dashboard' && location.pathname.startsWith(item.route));
          return (
            <Box
              key={item.route}
              onClick={() => navigate(item.route)}
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
    </>
  );
}
