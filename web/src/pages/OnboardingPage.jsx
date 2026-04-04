import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import tokens from '../config/tokens';
import papyriLogo from '../assets/papyri-wordmark-150x50.png';

const AVANTAGES = [
  {
    icon: AutoStoriesOutlinedIcon,
    title: 'Ebooks illimités',
    description: 'Accédez à des milliers de livres en français et en anglais.',
    color: tokens.colors.primary,
  },
  {
    icon: HeadphonesOutlinedIcon,
    title: 'Livres audio',
    description: 'Écoutez où que vous soyez — en voiture, en cuisine, en sport.',
    color: tokens.colors.accent,
  },
  {
    icon: PhoneAndroidOutlinedIcon,
    title: 'Web & mobile',
    description: 'Lisez depuis votre navigateur ou l\'application mobile.',
    color: tokens.colors.secondary,
  },
  {
    icon: WifiOffOutlinedIcon,
    title: 'Mode hors-ligne',
    description: 'Téléchargez vos livres et lisez sans connexion.',
    color: '#2E7D32',
  },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');

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
            {firstName ? `Bienvenue, ${firstName} !` : 'Bienvenue sur Papyri !'}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1.1rem', maxWidth: 520, mx: 'auto' }}>
            Votre compte est créé. Choisissez un abonnement pour accéder à toute la bibliothèque.
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
            Abonnement individuel
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 0.5, my: 1 }}>
            <Typography variant="h3" sx={{ fontWeight: 800, color: tokens.colors.accent }}>5€</Typography>
            <Typography variant="body1" color="text.secondary">/mois</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            ou <strong>50€/an</strong> — 2 mois offerts
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Accès illimité · Ebooks + Audio · Web & Mobile · Mode hors-ligne
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
          Choisir mon abonnement
        </Button>

        {/* CTA secondaire */}
        <Button
          variant="text"
          onClick={() => navigate('/catalogue')}
          sx={{ color: 'text.secondary', textTransform: 'none', fontSize: '0.9rem', fontWeight: 500 }}
        >
          Explorer le catalogue d&apos;abord
        </Button>
      </Container>
    </Box>
  );
}
