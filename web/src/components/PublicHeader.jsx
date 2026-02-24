import React from 'react';
import {
  Box,
  Button,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';

const primary = '#f4a825';

export default function PublicHeader({
  activeKey = '',
  isAuthenticated = false,
  authenticatedCtaPath = '/dashboard',
  background = '#f8f7f5',
}) {
  const navigate = useNavigate();

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
        <Typography sx={{ fontWeight: 800, fontSize: '1.03rem', cursor: 'pointer' }} onClick={() => navigate('/')}>
          Papyri
        </Typography>

        <Stack direction="row" spacing={3} sx={{ display: { xs: 'none', md: 'flex' } }}>
          <Typography sx={navTextSx(activeKey === 'catalogue')} onClick={activeKey === 'catalogue' ? undefined : () => navigate('/catalogue')}>
            Bibliothèque
          </Typography>
          <Typography sx={navTextSx(false)}>Nouveautés</Typography>
          <Typography sx={navTextSx(activeKey === 'pricing')} onClick={activeKey === 'pricing' ? undefined : () => navigate('/pricing')}>
            Tarifs
          </Typography>
          <Typography sx={navTextSx(false)}>À propos</Typography>
        </Stack>

        <Button
          sx={{ bgcolor: primary, color: '#111', borderRadius: '9px', fontWeight: 800, '&:hover': { bgcolor: '#e29d22' } }}
          onClick={() => navigate(isAuthenticated ? authenticatedCtaPath : '/register')}
        >
          {isAuthenticated ? 'Mon espace' : "S'inscrire"}
        </Button>
      </Container>
    </Box>
  );
}
