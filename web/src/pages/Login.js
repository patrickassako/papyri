import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  IconButton,
  InputAdornment,
  Alert,
  Link
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import * as authService from '../services/auth.service';

const Login = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: '',
    password: ''
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
    return null;
  };

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

    setErrors({ ...errors, [field]: error });
  };

  // Check if form is valid
  const isFormValid = () => {
    return (
      !validateEmail(formData.email) &&
      !validatePassword(formData.password) &&
      formData.email &&
      formData.password
    );
  };

  // Handle form submission
  const handleSubmit = async (event) => {
    event.preventDefault();

    // Validate all fields
    const emailError = validateEmail(formData.email);
    const passwordError = validatePassword(formData.password);

    if (emailError || passwordError) {
      setErrors({
        email: emailError,
        password: passwordError
      });
      setTouched({ email: true, password: true });
      return;
    }

    setLoading(true);
    setApiError(null);

    try {
      await authService.login(formData.email, formData.password);

      // Success - redirect to home
      navigate('/');
    } catch (error) {
      console.error('Login error:', error);
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
          variant="h1"
          sx={{
            fontSize: { xs: '28px', sm: '32px' },
            fontWeight: 600,
            color: 'text.primary',
            marginBottom: '32px',
            textAlign: 'center'
          }}
        >
          Se connecter
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

        {/* Email Field */}
        <Box sx={{ marginBottom: '16px' }}>
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
        <Box sx={{ marginBottom: '8px' }}>
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
            placeholder="Votre mot de passe"
            autoComplete="current-password"
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

        {/* Forgot Password Link */}
        <Box sx={{ marginBottom: '24px', textAlign: 'right' }}>
          <Link
            href="/forgot-password"
            sx={{
              color: 'primary.main',
              textDecoration: 'none',
              fontSize: '14px',
              '&:hover': {
                textDecoration: 'underline'
              }
            }}
          >
            Mot de passe oublié ?
          </Link>
        </Box>

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
          {loading ? 'Connexion en cours...' : 'Se connecter'}
        </Button>

        {/* Register Link */}
        <Typography
          sx={{
            fontSize: '14px',
            color: 'text.secondary',
            textAlign: 'center'
          }}
        >
          Vous n'avez pas encore de compte ?{' '}
          <Link
            href="/register"
            sx={{
              color: 'primary.main',
              textDecoration: 'none',
              fontWeight: 600,
              '&:hover': {
                textDecoration: 'underline'
              }
            }}
          >
            Créer un compte
          </Link>
        </Typography>
      </Box>
    </Box>
  );
};

export default Login;
