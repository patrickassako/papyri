import React, { useState, useEffect } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import tokens from '../config/tokens';

const STORAGE_KEY = 'papyri_cookie_consent';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ accepted: true, date: new Date().toISOString() }));
    setVisible(false);
  };

  const reject = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ accepted: false, date: new Date().toISOString() }));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <Box sx={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
      bgcolor: '#1A1A2E', color: '#fff',
      px: { xs: 2, sm: 4 }, py: 2,
      display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2,
      boxShadow: '0 -4px 24px rgba(0,0,0,0.25)',
      borderTop: `3px solid ${tokens.colors.primary}`,
    }}>
      <Typography sx={{ flex: 1, fontSize: '0.82rem', color: 'rgba(255,255,255,0.82)', minWidth: 200 }}>
        Nous utilisons des cookies essentiels au fonctionnement du service (session, préférences) et des cookies analytiques anonymisés.{' '}
        <Box component="span"
          onClick={() => navigate('/privacy')}
          sx={{ color: tokens.colors.secondary, cursor: 'pointer', textDecoration: 'underline', fontSize: 'inherit' }}
        >
          Politique de confidentialité
        </Box>
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
        <Button size="small" onClick={reject}
          sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff' } }}>
          Refuser
        </Button>
        <Button size="small" onClick={accept} variant="contained"
          sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.78rem', bgcolor: tokens.colors.primary, borderRadius: '8px', '&:hover': { bgcolor: '#9e5519' } }}>
          Accepter
        </Button>
      </Box>
    </Box>
  );
}
