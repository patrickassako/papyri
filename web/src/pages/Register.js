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
  Link
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import * as authService from '../services/auth.service';

const Register = () => {
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

  // Email validation
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) return 'L\'email est obligatoire.';
    if (!emailRegex.test(email)) return 'Format d\'email invalide.';
    return null;
  };

  // Password validation
  const validatePassword = (password) => {
    if (!password) return 'Le mot de passe est obligatoire.';
    if (password.length < 8) return 'Le mot de passe doit contenir au minimum 8 caractères.';
    return null;
  };

  // Full name validation
  const validateFullName = (name) => {
    if (!name) return 'Le nom complet est obligatoire.';
    if (name.length < 2) return 'Le nom doit contenir au minimum 2 caractères.';
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

    if (score <= 2) return { score: 33, label: 'Faible', color: '#C25450' };
    if (score <= 3) return { score: 66, label: 'Moyen', color: '#D4A017' };
    return { score: 100, label: 'Fort', color: '#4A7C59' };
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
      formData.full_name
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

      // Success - redirect to home (will be changed to subscription page in Epic 2)
      window.location.href = '/';
    } catch (error) {
      console.error('Registration error:', error);
      setApiError(error.message || 'Erreur de connexion. Veuillez réessayer.');
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
        {/* Header */}
        <Typography
          variant="h1"
          sx={{
            fontSize: { xs: '28px', sm: '32px' },
            fontWeight: 600,
            color: 'text.primary',
            marginBottom: '32px',
            textAlign: 'center'
          }}
        >
          Créer mon compte
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
            Nom complet
          </Typography>
          <TextField
            id="full_name"
            fullWidth
            value={formData.full_name}
            onChange={handleChange('full_name')}
            onBlur={handleBlur('full_name')}
            error={touched.full_name && !!errors.full_name}
            helperText={touched.full_name && errors.full_name}
            placeholder="Votre nom complet"
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
            Email
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
            placeholder="votre.email@exemple.com"
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
            Mot de passe
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
            placeholder="Minimum 8 caractères"
            autoComplete="new-password"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
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
                Force du mot de passe :
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
          {loading ? 'Création en cours...' : 'Créer mon compte'}
        </Button>

        {/* Login Link */}
        <Typography
          sx={{
            fontSize: '14px',
            color: 'text.secondary',
            textAlign: 'center'
          }}
        >
          Vous avez déjà un compte ?{' '}
          <Link
            href="/login"
            sx={{
              color: 'primary.main',
              textDecoration: 'none',
              fontWeight: 600,
              '&:hover': {
                textDecoration: 'underline'
              }
            }}
          >
            Se connecter
          </Link>
        </Typography>
      </Box>
    </Box>
  );
};

export default Register;
