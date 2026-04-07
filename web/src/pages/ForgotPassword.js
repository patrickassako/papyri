import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  Link
} from '@mui/material';
import { useTranslation } from 'react-i18next';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const ForgotPassword = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [touched, setTouched] = useState(false);

  // Email validation
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) return t('auth.emailRequired');
    if (!emailRegex.test(email)) return t('auth.emailInvalid');
    return null;
  };

  const emailError = touched ? validateEmail(email) : null;

  // Handle form submission
  const handleSubmit = async (event) => {
    event.preventDefault();

    const validationError = validateEmail(email);
    if (validationError) {
      setTouched(true);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error?.message || t('common.error'));
        setLoading(false);
        return;
      }

      // Success
      setSuccess(true);
      setLoading(false);
    } catch (err) {
      console.error('Forgot password error:', err);
      setError(t('errors.networkError'));
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: { xs: '32px 16px', sm: '32px 24px' },
        backgroundColor: 'background.default'
      }}
    >
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{
          width: '100%',
          maxWidth: '400px',
        }}
      >
        {/* Header */}
        <Typography
          variant="h2"
          sx={{
            fontSize: { xs: '24px', sm: '28px' },
            fontWeight: 600,
            color: 'text.primary',
            marginBottom: '16px',
            textAlign: 'center'
          }}
        >
          {t('auth.forgotPasswordTitle')}
        </Typography>

        <Typography
          variant="body1"
          sx={{
            fontSize: '16px',
            color: 'text.secondary',
            marginBottom: '32px',
            textAlign: 'center'
          }}
        >
          {t('auth.forgotPasswordDesc')}
        </Typography>

        {/* Success Alert */}
        {success && (
          <Alert
            severity="success"
            sx={{ marginBottom: '24px' }}
          >
            {t('auth.forgotPasswordSuccess')}
          </Alert>
        )}

        {/* Error Alert */}
        {error && (
          <Alert
            severity="error"
            sx={{ marginBottom: '24px' }}
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        )}

        {!success && (
          <>
            {/* Email Field */}
            <Box sx={{ marginBottom: '24px' }}>
              <Typography
                component="label"
                htmlFor="email"
                sx={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'text.primary',
                  marginBottom: '8px'
                }}
              >
                {t('auth.email')}
              </Typography>
              <TextField
                id="email"
                type="email"
                fullWidth
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setTouched(true)}
                error={!!emailError}
                helperText={emailError}
                placeholder={t('auth.emailPlaceholder')}
                autoComplete="email"
                autoFocus
                sx={{
                  '& .MuiOutlinedInput-root': {
                    height: '48px',
                    borderRadius: '8px',
                    fontSize: '16px',
                    '&.Mui-error': {
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#C25450',
                      }
                    }
                  },
                  '& .MuiFormHelperText-root': {
                    fontSize: '12px',
                    color: '#C25450',
                    marginLeft: 0,
                    marginTop: '4px'
                  }
                }}
              />
            </Box>

            {/* Submit Button */}
            <Button
              type="submit"
              fullWidth
              disabled={loading}
              sx={{
                height: '48px',
                borderRadius: '24px',
                fontSize: '16px',
                fontWeight: 600,
                textTransform: 'none',
                backgroundColor: 'primary.main',
                color: '#FFFFFF',
                marginBottom: '16px',
                '&:hover': {
                  backgroundColor: 'primary.dark',
                },
                '&.Mui-disabled': {
                  backgroundColor: 'rgba(0, 0, 0, 0.12)',
                  color: 'rgba(0, 0, 0, 0.26)',
                  opacity: 0.4
                }
              }}
            >
              {loading ? t('auth.sending') : t('auth.sendResetLink')}
            </Button>
          </>
        )}

        {/* Back to Login Link */}
        <Box sx={{ textAlign: 'center', marginTop: '16px' }}>
          <Link
            href="/login"
            sx={{
              color: 'primary.main',
              textDecoration: 'none',
              fontSize: '14px',
              '&:hover': {
                textDecoration: 'underline'
              }
            }}
          >
            {t('auth.backToLogin')}
          </Link>
        </Box>
      </Box>
    </Box>
  );
};

export default ForgotPassword;
