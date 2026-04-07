import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  IconButton,
  InputAdornment,
  Alert,
  LinearProgress,
  Link,
  Checkbox,
  FormControlLabel
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as authService from '../services/auth.service';
import tokens from '../config/tokens';
import papyriLogo from '../assets/papyri-wordmark-150x50.png';

const Register = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: ''
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [cguAccepted, setCguAccepted] = useState(false);

  // Email validation
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) return t('auth.emailRequired');
    if (!emailRegex.test(email)) return t('auth.emailInvalid');
    return null;
  };

  // Password validation
  const validatePassword = (password) => {
    if (!password) return t('auth.passwordRequired');
    if (password.length < 8) return t('auth.passwordTooShort');
    return null;
  };

  // Full name validation
  const validateFullName = (name) => {
    if (!name) return t('auth.nameRequired');
    if (name.length < 2) return t('auth.nameTooShort');
    return null;
  };

  // Password strength calculation
  const getPasswordStrength = (password) => {
    if (!password) return { score: 0, label: '', color: '' };

    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;

    if (score <= 2) return { score: 33, label: t('security.weak'), color: '#C25450' };
    if (score <= 3) return { score: 66, label: t('security.fair'), color: tokens.colors.secondary };
    return { score: 100, label: t('security.strong'), color: '#4A7C59' };
  };

  const passwordStrength = getPasswordStrength(formData.password);

  // Handle input change
  const handleChange = (field) => (event) => {
    setFormData({ ...formData, [field]: event.target.value });
    setApiError(null); // Clear API error on input change
  };

  // Handle blur (validation on blur)
  const handleBlur = (field) => () => {
    setTouched({ ...touched, [field]: true });

    let error = null;
    if (field === 'email') error = validateEmail(formData.email);
    if (field === 'password') error = validatePassword(formData.password);
    if (field === 'full_name') error = validateFullName(formData.full_name);

    setErrors({ ...errors, [field]: error });
  };

  // Check if form is valid
  const isFormValid = () => {
    return (
      !validateEmail(formData.email) &&
      !validatePassword(formData.password) &&
      !validateFullName(formData.full_name) &&
      formData.email &&
      formData.password &&
      formData.full_name &&
      cguAccepted
    );
  };

  // Handle form submission
  const handleSubmit = async (event) => {
    event.preventDefault();

    // Validate all fields
    const emailError = validateEmail(formData.email);
    const passwordError = validatePassword(formData.password);
    const nameError = validateFullName(formData.full_name);

    if (emailError || passwordError || nameError) {
      setErrors({
        email: emailError,
        password: passwordError,
        full_name: nameError
      });
      setTouched({ email: true, password: true, full_name: true });
      return;
    }

    setLoading(true);
    setApiError(null);

    try {
      await authService.register(formData.email, formData.password, formData.full_name);

      // Success - redirect to onboarding
      navigate('/onboarding');
    } catch (error) {
      console.error('Registration error:', error);
      setApiError(error.message || t('auth.registerError'));
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
        padding: { xs: '16px', sm: '24px' },
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
        {/* Logo */}
        <Box sx={{ textAlign: 'center', marginBottom: '32px' }}>
          <Box
            component="img"
            src={papyriLogo}
            alt="Papyri"
            onClick={() => navigate('/')}
            sx={{ height: 44, objectFit: 'contain', cursor: 'pointer', display: 'inline-block' }}
          />
        </Box>

        {/* Header */}
        <Typography
          variant="h1"
          sx={{
            fontSize: { xs: '24px', sm: '28px' },
            fontWeight: 600,
            color: 'text.primary',
            marginBottom: '32px',
            textAlign: 'center'
          }}
        >
          {t('auth.registerTitle')}
        </Typography>

        {/* API Error Alert */}
        {apiError && (
          <Alert
            severity="error"
            sx={{ marginBottom: '24px' }}
            onClose={() => setApiError(null)}
          >
            {apiError}
          </Alert>
        )}

        {/* Full Name Field */}
        <Box sx={{ marginBottom: '24px' }}>
          <Typography
            component="label"
            htmlFor="full_name"
            sx={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 600,
              color: 'text.primary',
              marginBottom: '8px'
            }}
          >
            {t('auth.fullName')}
          </Typography>
          <TextField
            id="full_name"
            fullWidth
            value={formData.full_name}
            onChange={handleChange('full_name')}
            onBlur={handleBlur('full_name')}
            error={touched.full_name && !!errors.full_name}
            helperText={touched.full_name && errors.full_name}
            placeholder={t('auth.fullNamePlaceholder')}
            autoComplete="name"
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
            value={formData.email}
            onChange={handleChange('email')}
            onBlur={handleBlur('email')}
            error={touched.email && !!errors.email}
            helperText={touched.email && errors.email}
            placeholder={t('auth.emailPlaceholder')}
            autoComplete="email"
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

        {/* Password Field */}
        <Box sx={{ marginBottom: '16px' }}>
          <Typography
            component="label"
            htmlFor="password"
            sx={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 600,
              color: 'text.primary',
              marginBottom: '8px'
            }}
          >
            {t('auth.password')}
          </Typography>
          <TextField
            id="password"
            type={showPassword ? 'text' : 'password'}
            fullWidth
            value={formData.password}
            onChange={handleChange('password')}
            onBlur={handleBlur('password')}
            error={touched.password && !!errors.password}
            helperText={touched.password && errors.password}
            placeholder={t('auth.passwordMinChars')}
            autoComplete="new-password"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
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

        {/* Password Strength Indicator */}
        {formData.password && (
          <Box sx={{ marginBottom: '24px' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
              <Typography
                sx={{
                  fontSize: '12px',
                  color: 'text.secondary'
                }}
              >
                {t('security.passwordStrength')} :
              </Typography>
              <Typography
                sx={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: passwordStrength.color,
                  marginLeft: '8px'
                }}
              >
                {passwordStrength.label}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={passwordStrength.score}
              sx={{
                height: '4px',
                borderRadius: '2px',
                backgroundColor: '#E0E0E0',
                '& .MuiLinearProgress-bar': {
                  backgroundColor: passwordStrength.color,
                  borderRadius: '2px'
                }
              }}
            />
          </Box>
        )}

        {/* CGU acceptance */}
        <FormControlLabel
          sx={{ mb: 2, alignItems: 'flex-start' }}
          control={
            <Checkbox
              checked={cguAccepted}
              onChange={(e) => setCguAccepted(e.target.checked)}
              size="small"
              sx={{ mt: '-2px', color: 'primary.main', '&.Mui-checked': { color: 'primary.main' } }}
            />
          }
          label={
            <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary', lineHeight: 1.5 }}>
              {t('auth.acceptTermsPre')}{' '}
              <Link href="/cgu" target="_blank" sx={{ color: 'primary.main', fontWeight: 600 }}>
                {t('auth.termsLink')}
              </Link>
              {' '}{t('auth.acceptTermsMid')}{' '}
              <Link href="/privacy" target="_blank" sx={{ color: 'primary.main', fontWeight: 600 }}>
                {t('auth.privacyLink')}
              </Link>
            </Typography>
          }
        />

        {/* Submit Button */}
        <Button
          type="submit"
          fullWidth
          disabled={!isFormValid() || loading}
          sx={{
            height: '48px',
            borderRadius: '24px',
            fontSize: '16px',
            fontWeight: 600,
            textTransform: 'none',
            backgroundColor: 'primary.main',
            color: '#FFFFFF',
            marginBottom: '24px',
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
          {loading ? t('auth.registering') : t('auth.registerTitle')}
        </Button>

        {/* Login Link */}
        <Typography sx={{ fontSize: '14px', color: 'text.secondary', textAlign: 'center' }}>
          {t('auth.hasAccount')}{' '}
          <Link
            component="button"
            onClick={() => navigate('/login')}
            sx={{
              color: 'primary.main',
              textDecoration: 'none',
              fontWeight: 600,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              '&:hover': { textDecoration: 'underline' }
            }}
          >
            {t('auth.loginButton')}
          </Link>
        </Typography>

        {/* Back to home */}
        <Typography sx={{ fontSize: '13px', color: 'text.secondary', textAlign: 'center', marginTop: '16px' }}>
          <Link
            component="button"
            onClick={() => navigate('/')}
            sx={{
              color: 'text.secondary',
              textDecoration: 'none',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              '&:hover': { color: 'primary.main', textDecoration: 'underline' }
            }}
          >
            {t('auth.backToHome')}
          </Link>
        </Typography>
      </Box>
    </Box>
  );
};

export default Register;
