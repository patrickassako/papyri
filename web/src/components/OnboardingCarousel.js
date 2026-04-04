import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Modal,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { ChevronRight, Close } from '@mui/icons-material';

// Import shared design tokens
import tokens from '../../../shared/tokens';

// Onboarding screens data
const screens = [
  {
    id: 1,
    title: 'Ta Bibliothèque Sans Limites',
    description:
      "Plus de 500 titres, lus depuis n'importe où, même sans réseau. Ebooks, audiobooks, contenus exclusifs — tout en un.",
    illustration: (
      <svg width="100%" height="100%" viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Books illustration */}
        <rect x="80" y="100" width="60" height="80" fill={tokens.colors.primary} rx="4" />
        <rect x="150" y="80" width="60" height="100" fill={tokens.colors.secondary} rx="4" />
        <rect x="220" y="90" width="60" height="90" fill={tokens.colors.accent} rx="4" />
        <rect x="290" y="110" width="60" height="70" fill={tokens.colors.primary} opacity="0.7" rx="4" />
        <circle cx="200" cy="50" r="30" fill={tokens.colors.secondary} opacity="0.3" />
        <text x="200" y="260" textAnchor="middle" fill={tokens.colors.primary} fontSize="48" fontWeight="bold">📚</text>
      </svg>
    ),
    cta: 'Suivant',
  },
  {
    id: 2,
    title: 'Tout Fonctionne Partout',
    description:
      'Commence sur ton téléphone, continue sur ton ordinateur. Tes livres et ta progression te suivent automatiquement.',
    illustration: (
      <svg width="100%" height="100%" viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Multi-device illustration */}
        <rect x="80" y="80" width="100" height="140" fill={tokens.colors.accent} rx="8" />
        <rect x="90" y="90" width="80" height="120" fill="#FBF7F2" rx="4" />
        <rect x="220" y="60" width="140" height="100" fill={tokens.colors.primary} rx="8" />
        <rect x="230" y="70" width="120" height="80" fill="#FBF7F2" rx="4" />
        <circle cx="350" cy="120" r="15" fill={tokens.colors.secondary} />
        <path d="M 180 150 Q 210 130 220 120" stroke={tokens.colors.secondary} strokeWidth="3" fill="none" />
        <text x="200" y="260" textAnchor="middle" fill={tokens.colors.primary} fontSize="48" fontWeight="bold">🔄</text>
      </svg>
    ),
    cta: 'Suivant',
  },
  {
    id: 3,
    title: 'Prêt(e) ?',
    description: "Plus de 500 histoires t'attendent. Commence ta première lecture dès maintenant.",
    illustration: (
      <svg width="100%" height="100%" viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Happy reader illustration */}
        <circle cx="200" cy="120" r="60" fill={tokens.colors.secondary} opacity="0.3" />
        <circle cx="200" cy="110" r="45" fill={tokens.colors.primary} />
        <rect x="170" y="160" width="60" height="90" fill={tokens.colors.accent} rx="8" />
        <rect x="140" y="180" width="50" height="70" fill={tokens.colors.primary} rx="4" />
        <text x="200" y="270" textAnchor="middle" fill={tokens.colors.primary} fontSize="48" fontWeight="bold">✨</text>
      </svg>
    ),
    cta: 'Commencer à lire',
  },
];

const OnboardingCarousel = ({ onComplete, onSkip }) => {
  const [activeStep, setActiveStep] = useState(0);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleNext = () => {
    if (activeStep === screens.length - 1) {
      // Last screen - complete onboarding
      onComplete();
    } else {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleSkip = () => {
    onSkip();
  };

  const currentScreen = screens[activeStep];

  return (
    <Modal
      open={true}
      disableEscapeKeyDown
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Box
        sx={{
          width: isMobile ? '100%' : '90%',
          maxWidth: 600,
          height: isMobile ? '100%' : 'auto',
          maxHeight: isMobile ? '100%' : '90vh',
          backgroundColor: tokens.colors.backgrounds.light,
          borderRadius: isMobile ? 0 : 4,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Skip Button */}
        <IconButton
          onClick={handleSkip}
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            zIndex: 10,
            color: tokens.colors.text.secondary,
          }}
          aria-label="Passer l'onboarding"
        >
          <Close />
        </IconButton>

        {/* Illustration */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 4,
            minHeight: isMobile ? '40%' : '50%',
          }}
        >
          {currentScreen.illustration}
        </Box>

        {/* Content */}
        <Box
          sx={{
            padding: 4,
            textAlign: 'center',
          }}
        >
          {/* Title */}
          <Typography
            variant="h4"
            sx={{
              fontFamily: tokens.typography.fontFamilies.heading,
              fontSize: isMobile ? 24 : 26,
              fontWeight: 700,
              color: tokens.colors.primary,
              marginBottom: 3,
              lineHeight: 1.25,
            }}
          >
            {currentScreen.title}
          </Typography>

          {/* Description */}
          <Typography
            variant="body1"
            sx={{
              fontSize: 16,
              fontWeight: 400,
              color: tokens.colors.text.primary,
              marginBottom: 4,
              lineHeight: 1.5,
            }}
          >
            {currentScreen.description}
          </Typography>

          {/* Dots Indicators */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              gap: 1,
              marginBottom: 3,
            }}
          >
            {screens.map((screen, index) => (
              <Box
                key={screen.id}
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor:
                    index === activeStep ? tokens.colors.primary : tokens.colors.neutral[300],
                  transition: 'background-color 0.3s',
                }}
              />
            ))}
          </Box>

          {/* Buttons */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <Button
              variant="text"
              onClick={handleSkip}
              sx={{
                color: tokens.colors.primary,
                textTransform: 'none',
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              Passer
            </Button>

            <Button
              variant="contained"
              onClick={handleNext}
              endIcon={activeStep !== screens.length - 1 && <ChevronRight />}
              sx={{
                backgroundColor: tokens.colors.primary,
                color: 'white',
                textTransform: 'none',
                fontSize: 16,
                fontWeight: 600,
                paddingX: 4,
                paddingY: 1.5,
                borderRadius: 24,
                '&:hover': {
                  backgroundColor: tokens.colors.primaryDark,
                },
              }}
            >
              {currentScreen.cta}
            </Button>
          </Box>
        </Box>
      </Box>
    </Modal>
  );
};

export default OnboardingCarousel;
