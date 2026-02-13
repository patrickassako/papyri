import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Avatar,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Alert,
  CircularProgress,
  Divider,
  Grid,
  InputAdornment,
  IconButton,
} from '@mui/material';
import {
  Edit as EditIcon,
  Lock as LockIcon,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';

// Import shared design tokens
import tokens from '../../../shared/tokens';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const Profile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Edit Profile Modal
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    full_name: '',
    language: '',
  });
  const [editLoading, setEditLoading] = useState(false);

  // Change Password Modal
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordFormData, setPasswordFormData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState(null);

  // Fetch user profile
  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('access_token');
      if (!token) {
        window.location.href = '/login';
        return;
      }

      const response = await fetch(`${API_URL}/users/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
          return;
        }
        throw new Error(data.error?.message || 'Erreur lors du chargement du profil.');
      }

      setUser(data.data);
      setEditFormData({
        full_name: data.data.full_name || '',
        language: data.data.language || 'fr',
      });
      setLoading(false);
    } catch (err) {
      console.error('Fetch profile error:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // Handle edit profile
  const handleEditProfile = async () => {
    try {
      setEditLoading(true);
      setError(null);
      setSuccess(null);

      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_URL}/users/me`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editFormData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Erreur lors de la mise à jour du profil.');
      }

      setUser(data.data);
      setEditDialogOpen(false);
      setSuccess('Profil mis à jour avec succès.');
      setEditLoading(false);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Edit profile error:', err);
      setError(err.message);
      setEditLoading(false);
    }
  };

  // Handle change password
  const handleChangePassword = async () => {
    try {
      setPasswordLoading(true);
      setPasswordError(null);
      setError(null);
      setSuccess(null);

      // Validate passwords match
      if (passwordFormData.new_password !== passwordFormData.confirm_password) {
        setPasswordError('Les mots de passe ne correspondent pas.');
        setPasswordLoading(false);
        return;
      }

      // Validate password length
      if (passwordFormData.new_password.length < 8) {
        setPasswordError('Le mot de passe doit contenir au moins 8 caractères.');
        setPasswordLoading(false);
        return;
      }

      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_URL}/users/me/password`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          current_password: passwordFormData.current_password,
          new_password: passwordFormData.new_password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Erreur lors du changement de mot de passe.');
      }

      setPasswordDialogOpen(false);
      setPasswordFormData({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
      setSuccess('Mot de passe modifié avec succès.');
      setPasswordLoading(false);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Change password error:', err);
      setPasswordError(err.message);
      setPasswordLoading(false);
    }
  };

  // Language options
  const languageOptions = [
    { value: 'fr', label: 'Français' },
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Español' },
    { value: 'pt', label: 'Português' },
  ];

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          backgroundColor: tokens.colors.backgrounds.light,
        }}
      >
        <CircularProgress sx={{ color: tokens.colors.primary }} />
      </Box>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: tokens.colors.backgrounds.light,
        py: 6,
      }}
    >
      <Container maxWidth="md">
        {/* Success Alert */}
        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {success}
          </Alert>
        )}

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Profile Card */}
        <Paper
          elevation={0}
          sx={{
            p: 4,
            borderRadius: 2,
            border: `1px solid ${tokens.colors.neutral[200]}`,
          }}
        >
          {/* Header with Avatar */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
            <Avatar
              src={user.avatar_url}
              sx={{
                width: 80,
                height: 80,
                mr: 3,
                backgroundColor: tokens.colors.primary,
                fontSize: 32,
                fontWeight: 600,
              }}
            >
              {user.full_name ? user.full_name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography
                variant="h4"
                sx={{
                  fontFamily: tokens.typography.fontFamilies.heading,
                  fontWeight: 600,
                  color: tokens.colors.text.primary,
                  mb: 0.5,
                }}
              >
                {user.full_name || 'Utilisateur'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {user.email}
              </Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => setEditDialogOpen(true)}
              sx={{
                borderColor: tokens.colors.primary,
                color: tokens.colors.primary,
                '&:hover': {
                  borderColor: tokens.colors.primary,
                  backgroundColor: `${tokens.colors.primary}10`,
                },
              }}
            >
              Modifier
            </Button>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Profile Information */}
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Nom complet
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {user.full_name || '—'}
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Email
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {user.email}
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Langue
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {languageOptions.find(opt => opt.value === user.language)?.label || 'Français'}
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Rôle
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500, textTransform: 'capitalize' }}>
                {user.role}
              </Typography>
            </Grid>

            {user.subscription && (
              <>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    Abonnement
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500, textTransform: 'capitalize' }}>
                    {user.subscription.plan} - {user.subscription.status}
                  </Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    Prix
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {user.subscription.price_eur} EUR
                  </Typography>
                </Grid>
              </>
            )}

            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Membre depuis
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {new Date(user.created_at).toLocaleDateString('fr-FR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </Typography>
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* Security Section */}
          <Box>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 600,
                color: tokens.colors.text.primary,
                mb: 2,
              }}
            >
              Sécurité
            </Typography>
            <Button
              variant="outlined"
              startIcon={<LockIcon />}
              onClick={() => setPasswordDialogOpen(true)}
              sx={{
                borderColor: tokens.colors.neutral[300],
                color: tokens.colors.text.primary,
                '&:hover': {
                  borderColor: tokens.colors.primary,
                  backgroundColor: `${tokens.colors.primary}10`,
                },
              }}
            >
              Changer le mot de passe
            </Button>
          </Box>
        </Paper>

        {/* Edit Profile Dialog */}
        <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Modifier le profil</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <TextField
                fullWidth
                label="Nom complet"
                value={editFormData.full_name}
                onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
                sx={{ mb: 3 }}
                inputProps={{ maxLength: 255 }}
              />

              <TextField
                fullWidth
                select
                label="Langue"
                value={editFormData.language}
                onChange={(e) => setEditFormData({ ...editFormData, language: e.target.value })}
              >
                {languageOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setEditDialogOpen(false)} disabled={editLoading}>
              Annuler
            </Button>
            <Button
              variant="contained"
              onClick={handleEditProfile}
              disabled={editLoading}
              sx={{
                backgroundColor: tokens.colors.primary,
                '&:hover': {
                  backgroundColor: tokens.colors.primaryDark,
                },
              }}
            >
              {editLoading ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Change Password Dialog */}
        <Dialog open={passwordDialogOpen} onClose={() => setPasswordDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Changer le mot de passe</DialogTitle>
          <DialogContent>
            {passwordError && (
              <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
                {passwordError}
              </Alert>
            )}

            <Box sx={{ pt: 2 }}>
              <TextField
                fullWidth
                label="Mot de passe actuel"
                type={showPasswords.current ? 'text' : 'password'}
                value={passwordFormData.current_password}
                onChange={(e) =>
                  setPasswordFormData({ ...passwordFormData, current_password: e.target.value })
                }
                sx={{ mb: 3 }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                        edge="end"
                      >
                        {showPasswords.current ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                fullWidth
                label="Nouveau mot de passe"
                type={showPasswords.new ? 'text' : 'password'}
                value={passwordFormData.new_password}
                onChange={(e) =>
                  setPasswordFormData({ ...passwordFormData, new_password: e.target.value })
                }
                sx={{ mb: 3 }}
                helperText="Minimum 8 caractères"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                        edge="end"
                      >
                        {showPasswords.new ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                fullWidth
                label="Confirmer le nouveau mot de passe"
                type={showPasswords.confirm ? 'text' : 'password'}
                value={passwordFormData.confirm_password}
                onChange={(e) =>
                  setPasswordFormData({ ...passwordFormData, confirm_password: e.target.value })
                }
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                        edge="end"
                      >
                        {showPasswords.confirm ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setPasswordDialogOpen(false)} disabled={passwordLoading}>
              Annuler
            </Button>
            <Button
              variant="contained"
              onClick={handleChangePassword}
              disabled={passwordLoading}
              sx={{
                backgroundColor: tokens.colors.primary,
                '&:hover': {
                  backgroundColor: tokens.colors.primaryDark,
                },
              }}
            >
              {passwordLoading ? 'Changement...' : 'Changer'}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
};

export default Profile;
