import React from 'react';
import {
  Box,
  Button,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import papyriWordmark from '../assets/papyri-wordmark-150x50.png';
import LanguageToggle from './LanguageToggle';

const primary = '#f4a825';

export default function PublicHeader({
  activeKey = '',
  isAuthenticated = false,
  authenticatedCtaPath = '/dashboard',
  background = '#f8f7f5',
}) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const navTextSx = (isActive) => ({
    fontSize: '0.9rem',
    cursor: isActive ? 'default' : 'pointer',
    color: isActive ? primary : '#1c160d',
    fontWeight: isActive ? 700 : 400,
  });

  return (
    <Box
      sx={{
        borderBottom: '1px solid rgba(244,168,37,0.14)',
        bgcolor: background,
        position: 'sticky',
        top: 0,
        zIndex: 30,
      }}
    >
      <Container maxWidth="lg" sx={{ height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box
          component="img"
          src={papyriWordmark}
          alt="Papyri"
          onClick={() => navigate('/')}
          sx={{ width: '150px', height: '50px', objectFit: 'contain', objectPosition: 'left center', display: 'block', cursor: 'pointer' }}
        />

        <Stack direction="row" spacing={3} alignItems="center" sx={{ display: { xs: 'none', md: 'flex' } }}>
          <Typography sx={navTextSx(activeKey === 'catalogue')} onClick={activeKey === 'catalogue' ? undefined : () => navigate('/catalogue')}>
            {t('publicNav.library')}
          </Typography>
          <Typography sx={navTextSx(activeKey === 'nouveautes')} onClick={activeKey === 'nouveautes' ? undefined : () => navigate('/catalogue?sort=newest')}>
            {t('publicNav.newReleases')}
          </Typography>
          <Typography sx={navTextSx(activeKey === 'pricing')} onClick={activeKey === 'pricing' ? undefined : () => navigate('/pricing')}>
            {t('publicNav.pricing')}
          </Typography>
          <Typography sx={navTextSx(activeKey === 'login')} onClick={activeKey === 'login' ? undefined : () => navigate('/login')}>
            {t('publicNav.login')}
          </Typography>
          <LanguageToggle variant="icon" />
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ display: { xs: 'block', md: 'none' } }}>
            <LanguageToggle variant="icon" />
          </Box>
          <Button
            sx={{ bgcolor: primary, color: '#111', borderRadius: '9px', fontWeight: 800, '&:hover': { bgcolor: '#e29d22' } }}
            onClick={() => navigate(isAuthenticated ? authenticatedCtaPath : '/register')}
          >
            {isAuthenticated ? t('publicNav.mySpace') : t('publicNav.register')}
          </Button>
        </Stack>
      </Container>
    </Box>
  );
}
