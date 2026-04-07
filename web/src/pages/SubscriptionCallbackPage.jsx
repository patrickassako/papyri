import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Container, Stack, Typography } from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { subscriptionsService } from '../services/subscriptions.service';

export default function SubscriptionCallbackPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);

  // Common params
  const status = searchParams.get('status');
  const provider = searchParams.get('provider'); // 'stripe' | null (Flutterwave)

  // Flutterwave params
  const reference = searchParams.get('tx_ref');
  const transactionId = searchParams.get('transaction_id');

  // Stripe params
  const sessionId = searchParams.get('session_id');

  const isStripe = provider === 'stripe' && Boolean(sessionId) && status === 'successful';
  const isFlutterwave = !provider && Boolean(reference) && Boolean(transactionId) && status === 'successful';

  const isSuccessCallback = isStripe || isFlutterwave;

  useEffect(() => {
    const verify = async () => {
      if (!isSuccessCallback) {
        setLoading(false);
        setError(t('subscriptionCallback.unconfirmed'));
        return;
      }

      try {
        if (isStripe) {
          await subscriptionsService.verifyStripeSession(sessionId);
        } else {
          await subscriptionsService.verifyPayment({ transactionId, reference });
        }
        setVerified(true);
      } catch (err) {
        setError(err.message || t('subscriptionCallback.cannotConfirm'));
      } finally {
        setLoading(false);
      }
    };

    verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const providerLabel = isStripe ? t('subscriptionCallback.stripeLabel') : t('subscriptionCallback.flutterwaveLabel');

  return (
    <Container maxWidth="sm" sx={{ py: 10 }}>
      <Box sx={{ bgcolor: '#fff', border: '1px solid #ece8e1', borderRadius: 3, p: 4 }}>
        <Typography sx={{ fontSize: '1.8rem', fontWeight: 800, mb: 0.5 }}>
          {t('subscriptionCallback.pageTitle')}
        </Typography>
        {!loading && (
          <Typography sx={{ color: '#aaa', fontSize: '0.85rem', mb: 2 }}>
            {t('subscriptionCallback.via', { provider: providerLabel })}
          </Typography>
        )}

        {loading ? (
          <Stack spacing={2} sx={{ alignItems: 'center', py: 3 }}>
            <CircularProgress />
            <Typography>{t('subscriptionCallback.verifying')}</Typography>
          </Stack>
        ) : verified ? (
          <Stack spacing={2.5}>
            <Alert severity="success">
              {t('subscriptionCallback.confirmed')}
            </Alert>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Button variant="contained" onClick={() => navigate('/catalogue')}>
                {t('subscriptionCallback.gotoCatalog')}
              </Button>
              <Button variant="outlined" onClick={() => navigate('/subscription')}>
                {t('subscriptionCallback.gotoSubscription')}
              </Button>
            </Stack>
          </Stack>
        ) : (
          <Stack spacing={2.5}>
            <Alert severity="error">{error || t('subscriptionCallback.cannotConfirm')}</Alert>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Button variant="contained" onClick={() => navigate('/pricing')}>
                {t('subscriptionCallback.gotoPricing')}
              </Button>
              <Button variant="outlined" onClick={() => navigate('/login')}>
                {t('subscriptionCallback.reconnect')}
              </Button>
            </Stack>
          </Stack>
        )}
      </Box>
    </Container>
  );
}
