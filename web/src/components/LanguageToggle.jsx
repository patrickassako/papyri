import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Menu, MenuItem, Typography } from '@mui/material';
import LanguageOutlined from '@mui/icons-material/LanguageOutlined';
import tokens from '../config/tokens';

const LANG_OPTIONS = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
];

export default function LanguageToggle({ variant = 'default', sx = {} }) {
  const { i18n } = useTranslation();
  const [anchorEl, setAnchorEl] = useState(null);
  const currentLang = i18n.language?.startsWith('fr') ? 'fr' : 'en';
  const isOpen = Boolean(anchorEl);

  const triggerSx = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
    gap: variant === 'icon' ? 0.5 : 0.75,
    cursor: 'pointer',
    px: variant === 'icon' ? 1.2 : 1.5,
    py: variant === 'icon' ? 0.5 : 0.75,
    borderRadius: '20px',
    border: `1px solid ${tokens.colors.surfaces.light.variant}`,
    bgcolor: isOpen ? tokens.colors.surfaces.light.variant : 'transparent',
    transition: 'background-color 0.18s ease, border-color 0.18s ease',
    '&:hover': { bgcolor: tokens.colors.surfaces.light.variant },
    userSelect: 'none',
    ...sx,
  }), [isOpen, sx, variant]);

  const openMenu = (event) => setAnchorEl(event.currentTarget);
  const closeMenu = () => setAnchorEl(null);

  const handleSelect = (lang) => {
    i18n.changeLanguage(lang);
    closeMenu();
  };

  return (
    <>
      <Box
        onClick={openMenu}
        onMouseEnter={openMenu}
        sx={triggerSx}
      >
        <LanguageOutlined sx={{ fontSize: variant === 'icon' ? 16 : 17, color: '#9c7e49' }} />
        <Typography sx={{ fontSize: variant === 'icon' ? '0.78rem' : '0.82rem', fontWeight: 700, color: '#9c7e49', lineHeight: 1 }}>
          {currentLang.toUpperCase()}
        </Typography>
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={isOpen}
        onClose={closeMenu}
        MenuListProps={{
          onMouseLeave: closeMenu,
          sx: { py: 0.5 },
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            elevation: 0,
            sx: {
              mt: 0.75,
              borderRadius: '14px',
              border: `1px solid ${tokens.colors.surfaces.light.variant}`,
              boxShadow: '0 10px 28px rgba(17, 12, 5, 0.12)',
              overflow: 'hidden',
            },
          },
        }}
      >
        {LANG_OPTIONS.map((option) => {
          const active = option.code === currentLang;
          return (
            <MenuItem
              key={option.code}
              onClick={() => handleSelect(option.code)}
              sx={{
                minWidth: 90,
                fontSize: '0.85rem',
                fontWeight: active ? 800 : 600,
                color: active ? tokens.colors.primary : tokens.colors.onBackground.light,
                bgcolor: active ? `${tokens.colors.primary}14` : 'transparent',
                '&:hover': {
                  bgcolor: active ? `${tokens.colors.primary}1c` : '#f8f3ea',
                },
              }}
            >
              {option.label}
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
