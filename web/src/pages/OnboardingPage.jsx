import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  Typography,
  Container,
  Paper,
} from '@mui/material';
import AutoStoriesOutlinedIcon from '@mui/icons-material/AutoStoriesOutlined';
import HeadphonesOutlinedIcon from '@mui/icons-material/HeadphonesOutlined';
import PhoneAndroidOutlinedIcon from '@mui/icons-material/PhoneAndroidOutlined';
import WifiOffOutlinedIcon from '@mui/icons-material/WifiOffOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import * as authService from '../services/auth.service';
import { useCurrency } from '../hooks/useCurrency';
import tokens from '../config/tokens';
import papyriLogo from '../assets/papyri-wordmark-150x50.png';

const AVANTAGES_CONFIG = [
  { icon: AutoStoriesOutlinedIcon, titleKey: 'onboarding_page.feat1Title', descKey: 'onboarding_page.feat1Desc', color: tokens.colors.primary },
  { icon: HeadphonesOutlinedIcon, titleKey: 'onboarding_page.feat2Title', descKey: 'onboarding_page.feat2Desc', color: tokens.colors.accent },
  { icon: PhoneAndroidOutlinedIcon, titleKey: 'onboarding_page.feat3Title', descKey: 'onboarding_page.feat3Desc', color: tokens.colors.secondary },
  { icon: WifiOffOutlinedIcon, titleKey: 'onboarding_page.feat4Title', descKey: 'onboarding_page.feat4Desc', color: '#2E7D32' },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { formatPrice } = useCurrency();
  const [firstName, setFirstName] = useState('');
  const AVANTAGES = AVANTAGES_CONFIG.map((a) => ({ ...a, title: t(a.titleKey), description: t(a.descKey) }));

  useEffect(() => {
    authService.getUser()
      .then((u) => {
        if (!u) { navigate('/login', { replace: true }); return; }
        const name = u.full_name || u.email || '';
        setFirstName(name.split(' ')[0]);
      })
      .catch(() => navigate('/login', { replace: true }));
  }, [navigate]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#fcfaf8', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ bgcolor: '#12193a', py: 2, textAlign: 'center', display: 'flex', justifyContent: 'center' }}>
        <Box
          component="img"
          src={papyriLogo}
          alt="Papyri"
          sx={{ height: 40, objectFit: 'contain' }}
        />
      </Box>

      <Container maxWidth="md" sx={{ flex: 1, py: 6, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Titre de bienvenue */}
        <Box sx={{ textAlign: 'center', mb: 5 }}>
          <Typography
            variant="h3"
            sx={{ fontFamily: 'Playfair Display, serif', color: tokens.colors.accent, fontWeight: 700, mb: 1.5 }}
          >
            {firstName ? t('onboarding_page.welcomeNamed', { name: firstName }) : t('onboarding_page.welcome')}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1.1rem', maxWidth: 520, mx: 'auto' }}>
            {t('onboarding_page.welcomeDesc')}
          </Typography>
        </Box>

        {/* Avantages */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' },
            gap: 2,
            width: '100%',
            mb: 5,
          }}
        >
          {AVANTAGES.map((av) => {
            const Icon = av.icon;
            return (
              <Paper
                key={av.title}
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: '14px',
                  border: '1px solid #e8e0d8',
                  bgcolor: '#fff',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <Box
                  sx={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    bgcolor: `${av.color}18`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 0.5,
                  }}
                >
                  <Icon sx={{ color: av.color, fontSize: 26 }} />
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 700, color: tokens.colors.accent, fontSize: '0.85rem' }}>
                  {av.title}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4 }}>
                  {av.description}
                </Typography>
              </Paper>
            );
          })}
        </Box>

        {/* Prix mis en avant */}
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            maxWidth: 480,
            border: `2px solid ${tokens.colors.primary}`,
            borderRadius: '16px',
            p: 3.5,
            mb: 4,
            textAlign: 'center',
            bgcolor: '#fff',
          }}
        >
          <Typography variant="overline" sx={{ color: tokens.colors.primary, fontWeight: 700, letterSpacing: 1.5 }}>
            {t('onboarding_page.individualPlan')}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 0.5, my: 1, flexWrap: 'wrap' }}>
            <Typography variant="h3" sx={{ fontWeight: 800, color: tokens.colors.accent, fontSize: { xs: '2rem', sm: '3rem' }, overflowWrap: 'anywhere' }}>{formatPrice(500)}</Typography>
            <Typography variant="body1" color="text.secondary">{t('onboarding_page.perMonth')}</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, overflowWrap: 'anywhere' }}>
            {t('onboarding_page.orAnnual', { price: formatPrice(5000) })}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('onboarding_page.fullAccess')}
          </Typography>
        </Paper>

        {/* CTA principal */}
        <Button
          variant="contained"
          size="large"
          endIcon={<ArrowForwardIcon />}
          onClick={() => navigate('/pricing')}
          sx={{
            bgcolor: tokens.colors.primary,
            color: '#fff',
            borderRadius: '28px',
            px: 5,
            py: 1.6,
            fontSize: '1rem',
            fontWeight: 700,
            textTransform: 'none',
            mb: 1.5,
            '&:hover': { bgcolor: tokens.colors.primaryDark },
          }}
        >
          {t('onboarding_page.choosePlan')}
        </Button>

        {/* CTA secondaire */}
        <Button
          variant="text"
          onClick={() => navigate('/catalogue')}
          sx={{ color: 'text.secondary', textTransform: 'none', fontSize: '0.9rem', fontWeight: 500 }}
        >
          {t('onboarding_page.exploreCatalog')}
        </Button>
      </Container>
    </Box>
  );
}
