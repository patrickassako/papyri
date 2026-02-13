import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  IconButton,
  InputAdornment,
  Alert
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [touched, setTouched] = useState({});

  // Check if token exists
  useEffect(() => {
    if (!token) {
      setError('Lien invalide. Veuillez demander un nouveau lien de réinitialisation.');
    }
  }, [token]);

  // Password validation
  const validatePassword = (password) => {
    if (!password) return 'Le mot de passe est obligatoire.';
    if (password.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères.';
    return null;
  };

  // Confirm password validation
  const validateConfirmPassword = (confirmPassword) => {
    if (!confirmPassword) return 'Veuillez confirmer le mot de passe.';
    if (confirmPassword !== formData.password) return 'Les mots de passe ne correspondent pas.';
    return null;
  };

  const errors = {
    password: touched.password ? validatePassword(formData.password) : null,
    confirmPassword: touched.confirmPassword ? validateConfirmPassword(formData.confirmPassword) : null
  };

  // Handle input change
  const handleChange = (field) => (event) => {
    setFormData({ ...formData, [field]: event.target.value });
  };

  // Handle blur
  const handleBlur = (field) => () => {
    setTouched({ ...touched, [field]: true });
  };

  // Check if form is valid
  const isFormValid = () => {
    return (
      !validatePassword(formData.password) &&
      !validateConfirmPassword(formData.confirmPassword) &&
      formData.password &&
      formData.confirmPassword &&
      token
    );
  };

  // Handle form submission
  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!isFormValid()) {
      setTouched({ password: true, confirmPassword: true });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: token,
          new_password: formData.password
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error?.message || 'Une erreur est survenue.');
        setLoading(false);
        return;
      }

      // Success
      setSuccess(true);
      setLoading(false);

      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      console.error('Reset password error:', err);
      setError('Erreur de connexion. Veuillez réessayer.');
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
            marginBottom: '32px',
            textAlign: 'center'
          }}
        >
          Créer un nouveau mot de passe
        </Typography>

        {/* Success Alert */}
        {success && (
          <Alert
            severity="success"
            sx={{ marginBottom: '24px' }}
          >
            Mot de passe modifié avec succès ! Redirection vers la connexion...
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

        {!success && token && (
          <>
            {/* New Password Field */}
            <Box sx={{ marginBottom: '24px' }}>
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
                Nouveau mot de passe
              </Typography>
              <TextField
                id="password"
                type={showPassword ? 'text' : 'password'}
                fullWidth
                value={formData.password}
                onChange={handleChange('password')}
                onBlur={handleBlur('password')}
                error={!!errors.password}
                helperText={errors.password || 'Minimum 8 caractères'}
                placeholder="Votre nouveau mot de passe"
                autoComplete="new-password"
                autoFocus
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
                    marginLeft: 0,
                    marginTop: '4px'
                  }
                }}
              />
            </Box>

            {/* Confirm Password Field */}
            <Box sx={{ marginBottom: '24px' }}>
              <Typography
                component="label"
                htmlFor="confirmPassword"
                sx={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'text.primary',
                  marginBottom: '8px'
                }}
              >
                Confirmer le mot de passe
              </Typography>
              <TextField
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                fullWidth
                value={formData.confirmPassword}
                onChange={handleChange('confirmPassword')}
                onBlur={handleBlur('confirmPassword')}
                error={!!errors.confirmPassword}
                helperText={errors.confirmPassword}
                placeholder="Confirmez votre mot de passe"
                autoComplete="new-password"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={showConfirmPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        edge="end"
                      >
                        {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
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
              {loading ? 'Réinitialisation en cours...' : 'Réinitialiser le mot de passe'}
            </Button>
          </>
        )}
      </Box>
    </Box>
  );
};

export default ResetPassword;
