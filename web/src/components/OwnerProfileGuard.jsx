import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Paper, Stack } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useTranslation } from 'react-i18next';
import { isOwnerContext, getActiveProfile } from '../config/profileStorage';

/**
 * Wrap any page reserved to the family owner profile (or solo accounts).
 * Non-owner profiles see a friendly "this section is owner-only" screen
 * instead of the protected content.
 *
 * Usage:
 *   <OwnerProfileGuard>
 *     <SubscriptionPage />
 *   </OwnerProfileGuard>
 */
export default function OwnerProfileGuard({ children }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState(() => isOwnerContext());

  useEffect(() => {
    const handleProfileChange = () => setAllowed(isOwnerContext());
    window.addEventListener('papyri:profile-changed', handleProfileChange);
    return () => window.removeEventListener('papyri:profile-changed', handleProfileChange);
  }, []);

  if (allowed) return <>{children}</>;

  const activeProfile = getActiveProfile();
  return (
    <Box sx={{ minHeight: '70vh', display: 'grid', placeItems: 'center', p: 3 }}>
      <Paper elevation={0} sx={{ p: { xs: 3, md: 5 }, borderRadius: 4, border: '1px solid #ece7dd', maxWidth: 480, textAlign: 'center', bgcolor: '#fff' }}>
        <Box sx={{ mx: 'auto', mb: 2, width: 64, height: 64, borderRadius: '50%', bgcolor: '#fff5e6', display: 'grid', placeItems: 'center' }}>
          <LockOutlinedIcon sx={{ fontSize: 32, color: '#f1a10a' }} />
        </Box>
        <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', color: '#1c160d', mb: 1 }}>
          {t('owner.restrictedTitle', { defaultValue: 'Section réservée au profil principal' })}
        </Typography>
        <Typography sx={{ color: '#7b6b51', mb: 3, fontSize: '0.95rem' }}>
          {t('owner.restrictedBody', {
            profileName: activeProfile?.name || '',
            defaultValue: `Le profil "${activeProfile?.name || ''}" n'a pas accès à cette page. Seul le profil principal peut gérer l'abonnement, la famille et les préférences du compte.`,
          })}
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center">
          <Button variant="contained" sx={{ bgcolor: '#f1a10a', textTransform: 'none', borderRadius: 3, '&:hover': { bgcolor: '#d9900a' } }} onClick={() => navigate('/home')}>
            {t('common.backHome', { defaultValue: 'Retour à l\'accueil' })}
          </Button>
          <Button variant="outlined" sx={{ textTransform: 'none', borderRadius: 3 }} onClick={() => navigate('/profiles/select')}>
            {t('owner.switchProfile', { defaultValue: 'Changer de profil' })}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
