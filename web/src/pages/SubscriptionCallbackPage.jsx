import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Container, Stack, Typography } from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { subscriptionsService } from '../services/subscriptions.service';

export default function SubscriptionCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);

  const status = searchParams.get('status');
  const reference = searchParams.get('tx_ref');
  const transactionId = searchParams.get('transaction_id');

  const isSuccessCallback = useMemo(
    () => status === 'successful' && Boolean(reference) && Boolean(transactionId),
    [status, reference, transactionId]
  );

  useEffect(() => {
    const verify = async () => {
      if (!isSuccessCallback) {
        setLoading(false);
        setError('Paiement non confirmé. Vérifie le statut et réessaie.');
        return;
      }

      try {
        await subscriptionsService.verifyPayment({
          transactionId,
          reference,
        });
        setVerified(true);
      } catch (err) {
        setError(err.message || 'Impossible de confirmer le paiement.');
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [isSuccessCallback, reference, transactionId]);

  return (
    <Container maxWidth="sm" sx={{ py: 10 }}>
      <Box sx={{ bgcolor: '#fff', border: '1px solid #ece8e1', borderRadius: 3, p: 4 }}>
        <Typography sx={{ fontSize: '1.8rem', fontWeight: 800, mb: 1.5 }}>
          Callback abonnement
        </Typography>

        {loading ? (
          <Stack spacing={2} sx={{ alignItems: 'center', py: 3 }}>
            <CircularProgress />
            <Typography>Vérification du paiement en cours...</Typography>
          </Stack>
        ) : verified ? (
          <Stack spacing={2.5}>
            <Alert severity="success">Paiement confirmé. Ton abonnement est actif.</Alert>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Button variant="contained" onClick={() => navigate('/catalogue')}>
                Aller au catalogue
              </Button>
              <Button variant="outlined" onClick={() => navigate('/subscription')}>
                Voir mon abonnement
              </Button>
            </Stack>
          </Stack>
        ) : (
          <Stack spacing={2.5}>
            <Alert severity="error">{error || 'Le paiement n’a pas pu être validé.'}</Alert>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Button variant="contained" onClick={() => navigate('/pricing')}>
                Retour aux tarifs
              </Button>
              <Button variant="outlined" onClick={() => navigate('/login')}>
                Se reconnecter
              </Button>
            </Stack>
          </Stack>
        )}
      </Box>
    </Container>
  );
}
