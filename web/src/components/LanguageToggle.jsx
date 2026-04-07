import React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Typography } from '@mui/material';
import LanguageOutlined from '@mui/icons-material/LanguageOutlined';
import tokens from '../config/tokens';

export default function LanguageToggle({ variant = 'default', sx = {} }) {
  const { i18n } = useTranslation();
  const currentLang = i18n.language?.startsWith('fr') ? 'fr' : 'en';

  const toggle = () => {
    const next = currentLang === 'fr' ? 'en' : 'fr';
    i18n.changeLanguage(next);
  };

  if (variant === 'icon') {
    return (
      <Box
        onClick={toggle}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          cursor: 'pointer',
          px: 1.2,
          py: 0.5,
          borderRadius: '20px',
          border: `1px solid ${tokens.colors.surfaces.light.variant}`,
          bgcolor: 'transparent',
          '&:hover': { bgcolor: tokens.colors.surfaces.light.variant },
          userSelect: 'none',
          ...sx,
        }}
      >
        <LanguageOutlined sx={{ fontSize: 16, color: '#9c7e49' }} />
        <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#9c7e49', lineHeight: 1 }}>
          {currentLang.toUpperCase()}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      onClick={toggle}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        cursor: 'pointer',
        px: 1.5,
        py: 0.75,
        borderRadius: '20px',
        border: `1px solid ${tokens.colors.surfaces.light.variant}`,
        bgcolor: 'transparent',
        '&:hover': { bgcolor: tokens.colors.surfaces.light.variant },
        userSelect: 'none',
        ...sx,
      }}
    >
      <LanguageOutlined sx={{ fontSize: 17, color: '#9c7e49' }} />
      <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#9c7e49', lineHeight: 1 }}>
        {currentLang === 'fr' ? 'EN' : 'FR'}
      </Typography>
    </Box>
  );
}
