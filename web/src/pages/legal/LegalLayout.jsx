/**
 * LegalLayout — Layout commun pour toutes les pages légales
 */
import React from 'react';
import { Box, Container, Typography, Divider } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import tokens from '../../config/tokens';
import papyriMark from '../../assets/papyri-logo-gold.png';

export function LegalSection({ title, children }) {
  return (
    <Box sx={{ mb: 4.5 }}>
      <Typography sx={{ fontFamily: 'Playfair Display, serif', fontWeight: 700, fontSize: '1.15rem', color: '#1A1A2E', mb: 1.5 }}>
        {title}
      </Typography>
      <Box sx={{ fontSize: '0.9rem', color: '#374151', lineHeight: 1.85 }}>
        {children}
      </Box>
    </Box>
  );
}

export function LegalList({ items }) {
  return (
    <Box component="ul" sx={{ pl: 2.5, mt: 1, mb: 1 }}>
      {items.map((item, i) => (
        <Box key={i} component="li" sx={{ fontSize: '0.9rem', color: '#374151', lineHeight: 1.85, mb: 0.5 }}>
          {item}
        </Box>
      ))}
    </Box>
  );
}

export function LegalSubSection({ title, children }) {
  return (
    <Box sx={{ mt: 2, mb: 1.5 }}>
      <Typography sx={{ fontWeight: 700, fontSize: '0.92rem', color: tokens.colors.accent, mb: 0.75 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

export default function LegalLayout({ title, subtitle, lastUpdated, children }) {
  const navigate = useNavigate();
  return (
    <Box sx={{ bgcolor: '#f5f4f1', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ bgcolor: '#1A1A2E', py: 4, px: 2 }}>
        <Container maxWidth="md">
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5, cursor: 'pointer', width: 'fit-content' }}
            onClick={() => navigate('/')}
          >
            <Box
              component="img"
              src={papyriMark}
              alt="Papyri"
              sx={{ width: 40, height: 40, borderRadius: '10px', objectFit: 'cover', display: 'block' }}
            />
            <Typography sx={{ fontFamily: 'Playfair Display, serif', fontWeight: 800, color: '#fff', fontSize: '1.15rem', letterSpacing: '-0.01em' }}>
              Papyri
            </Typography>
          </Box>
          <Typography
            sx={{ color: tokens.colors.secondary, cursor: 'pointer', fontSize: '0.82rem', mb: 1.5 }}
            onClick={() => navigate(-1)}
          >
            ← Retour
          </Typography>
          <Typography sx={{ fontFamily: 'Playfair Display, serif', fontSize: '1.7rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography sx={{ color: 'rgba(255,255,255,0.55)', mt: 0.75, fontSize: '0.85rem' }}>{subtitle}</Typography>
          )}
          {lastUpdated && (
            <Typography sx={{ color: 'rgba(255,255,255,0.4)', mt: 0.5, fontSize: '0.78rem' }}>
              Dernière mise à jour : {lastUpdated}
            </Typography>
          )}
        </Container>
      </Box>

      {/* Content */}
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Box sx={{ bgcolor: '#fff', borderRadius: '16px', p: { xs: 3, sm: 5 }, boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
          {children}
        </Box>

        {/* Footer navigation */}
        <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid #e5e0d8', display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          {[
            { label: 'CGU', path: '/cgu' },
            { label: 'CGV', path: '/cgv' },
            { label: 'Confidentialité', path: '/privacy' },
            { label: 'Cookies', path: '/cookies' },
            { label: 'Mentions légales', path: '/mentions-legales' },
            { label: 'Copyright', path: '/copyright' },
          ].map(link => (
            <Typography
              key={link.path}
              onClick={() => navigate(link.path)}
              sx={{ fontSize: '0.8rem', color: tokens.colors.primary, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
            >
              {link.label}
            </Typography>
          ))}
        </Box>
      </Container>
    </Box>
  );
}
