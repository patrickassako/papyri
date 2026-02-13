import React from 'react';
import { Box, Typography, Container, Button } from '@mui/material';
import * as authService from '../services/auth.service';

const Home = () => {
  const user = authService.getUser();

  const handleLogout = () => {
    authService.logout();
  };

  return (
    <Container maxWidth="lg">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3
        }}
      >
        <Typography variant="h1" component="h1" color="primary">
          Bibliothèque Numérique Privée
        </Typography>

        <Typography variant="h2" component="h2">
          Bienvenue {user?.full_name} !
        </Typography>

        <Typography variant="body1" color="text.secondary">
          Votre inscription a été réussie.
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', maxWidth: 600 }}>
          Note: Cette page d'accueil est temporaire. Après avoir implémenté l'Epic 2 (Abonnement & Paiements),
          les nouveaux utilisateurs seront redirigés vers la page de choix d'abonnement.
        </Typography>

        <Button
          variant="outlined"
          onClick={handleLogout}
          sx={{
            marginTop: 2,
            borderRadius: '24px',
            padding: '12px 32px'
          }}
        >
          Se déconnecter
        </Button>
      </Box>
    </Container>
  );
};

export default Home;
