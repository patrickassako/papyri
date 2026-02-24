import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import {
  Avatar,
  Button,
  Text,
  Divider,
  Portal,
  Dialog,
  TextInput,
  HelperText,
  Banner,
  ActivityIndicator,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_BASE_URL from '../config/api';

// Import shared design tokens
const tokens = require('../config/tokens');

const ProfileScreen = ({ navigation }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Edit Profile Dialog
  const [editDialogVisible, setEditDialogVisible] = useState(false);
  const [editFormData, setEditFormData] = useState({
    full_name: '',
    language: 'fr',
  });
  const [editLoading, setEditLoading] = useState(false);

  // Change Password Dialog
  const [passwordDialogVisible, setPasswordDialogVisible] = useState(false);
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

  // Language Selector Dialog
  const [languageDialogVisible, setLanguageDialogVisible] = useState(false);

  // Language options
  const languageOptions = [
    { value: 'fr', label: 'Français' },
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Español' },
    { value: 'pt', label: 'Português' },
  ];

  // Fetch user profile
  const fetchProfile = async () => {
    try {
      setError(null);

      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        navigation.replace('Login');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/users/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          await AsyncStorage.removeItem('access_token');
          await AsyncStorage.removeItem('refresh_token');
          navigation.replace('Login');
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
      setRefreshing(false);
    } catch (err) {
      console.error('Fetch profile error:', err);
      setError(err.message);
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // Handle refresh
  const onRefresh = () => {
    setRefreshing(true);
    fetchProfile();
  };

  // Handle edit profile
  const handleEditProfile = async () => {
    try {
      setEditLoading(true);
      setError(null);
      setSuccess(null);

      const token = await AsyncStorage.getItem('access_token');
      const response = await fetch(`${API_BASE_URL}/users/me`, {
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
      setEditDialogVisible(false);
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

      const token = await AsyncStorage.getItem('access_token');
      const response = await fetch(`${API_BASE_URL}/users/me/password`, {
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

      setPasswordDialogVisible(false);
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

  // Handle logout
  const handleLogout = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');

      // Call logout endpoint
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      // Clear tokens
      await AsyncStorage.removeItem('access_token');
      await AsyncStorage.removeItem('refresh_token');

      // Navigate to login
      navigation.replace('Login');
    } catch (err) {
      console.error('Logout error:', err);
      // Even if logout fails, clear tokens and navigate
      await AsyncStorage.removeItem('access_token');
      await AsyncStorage.removeItem('refresh_token');
      navigation.replace('Login');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={tokens.colors.primary} />
      </View>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[tokens.colors.primary]} />
        }
      >
        {/* Success Banner */}
        {success && (
          <Banner
            visible={!!success}
            icon="check-circle"
            style={styles.successBanner}
            actions={[
              {
                label: 'Fermer',
                onPress: () => setSuccess(null),
              },
            ]}
          >
            {success}
          </Banner>
        )}

        {/* Error Banner */}
        {error && (
          <Banner
            visible={!!error}
            icon="alert-circle"
            style={styles.errorBanner}
            actions={[
              {
                label: 'Fermer',
                onPress: () => setError(null),
              },
            ]}
          >
            {error}
          </Banner>
        )}

        {/* Profile Header */}
        <View style={styles.header}>
          <Avatar.Text
            size={80}
            label={user.full_name ? user.full_name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
            style={styles.avatar}
            labelStyle={styles.avatarLabel}
          />
          <Text variant="headlineMedium" style={styles.name}>
            {user.full_name || 'Utilisateur'}
          </Text>
          <Text variant="bodyMedium" style={styles.email}>
            {user.email}
          </Text>
          <Button
            mode="outlined"
            icon="pencil"
            onPress={() => setEditDialogVisible(true)}
            style={styles.editButton}
            labelStyle={styles.editButtonLabel}
          >
            Modifier le profil
          </Button>
        </View>

        <Divider style={styles.divider} />

        {/* Profile Information */}
        <View style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Informations
          </Text>

          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="account" size={20} color={tokens.colors.onSurface.light} />
            <View style={styles.infoContent}>
              <Text variant="bodySmall" style={styles.infoLabel}>
                Nom complet
              </Text>
              <Text variant="bodyMedium" style={styles.infoValue}>
                {user.full_name || '—'}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="email" size={20} color={tokens.colors.onSurface.light} />
            <View style={styles.infoContent}>
              <Text variant="bodySmall" style={styles.infoLabel}>
                Email
              </Text>
              <Text variant="bodyMedium" style={styles.infoValue}>
                {user.email}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="translate" size={20} color={tokens.colors.onSurface.light} />
            <View style={styles.infoContent}>
              <Text variant="bodySmall" style={styles.infoLabel}>
                Langue
              </Text>
              <Text variant="bodyMedium" style={styles.infoValue}>
                {languageOptions.find(opt => opt.value === user.language)?.label || 'Français'}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="calendar" size={20} color={tokens.colors.onSurface.light} />
            <View style={styles.infoContent}>
              <Text variant="bodySmall" style={styles.infoLabel}>
                Membre depuis
              </Text>
              <Text variant="bodyMedium" style={styles.infoValue}>
                {new Date(user.created_at).toLocaleDateString('fr-FR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </Text>
            </View>
          </View>

          {user.subscription && (
            <>
              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="credit-card" size={20} color={tokens.colors.onSurface.light} />
                <View style={styles.infoContent}>
                  <Text variant="bodySmall" style={styles.infoLabel}>
                    Abonnement
                  </Text>
                  <Text variant="bodyMedium" style={styles.infoValue}>
                    {user.subscription.plan} - {user.subscription.status}
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <MaterialCommunityIcons name="cash" size={20} color={tokens.colors.onSurface.light} />
                <View style={styles.infoContent}>
                  <Text variant="bodySmall" style={styles.infoLabel}>
                    Prix
                  </Text>
                  <Text variant="bodyMedium" style={styles.infoValue}>
                    {user.subscription.price_eur} EUR
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>

        <Divider style={styles.divider} />

        {/* Security Section */}
        <View style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Sécurité
          </Text>

          <Button
            mode="outlined"
            icon="lock"
            onPress={() => setPasswordDialogVisible(true)}
            style={styles.securityButton}
          >
            Changer le mot de passe
          </Button>
        </View>

        <Divider style={styles.divider} />

        {/* Logout Section */}
        <View style={styles.section}>
          <Button
            mode="contained"
            icon="logout"
            onPress={handleLogout}
            style={styles.logoutButton}
            buttonColor={tokens.colors.semantic.error}
          >
            Se déconnecter
          </Button>
        </View>
      </ScrollView>

      {/* Edit Profile Dialog */}
      <Portal>
        <Dialog visible={editDialogVisible} onDismiss={() => setEditDialogVisible(false)}>
          <Dialog.Title>Modifier le profil</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Nom complet"
              value={editFormData.full_name}
              onChangeText={(text) => setEditFormData({ ...editFormData, full_name: text })}
              mode="outlined"
              style={styles.dialogInput}
              maxLength={255}
            />

            <Button
              mode="outlined"
              onPress={() => {
                setLanguageDialogVisible(true);
              }}
              style={styles.languageButton}
            >
              {languageOptions.find(opt => opt.value === editFormData.language)?.label || 'Français'}
            </Button>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditDialogVisible(false)} disabled={editLoading}>
              Annuler
            </Button>
            <Button onPress={handleEditProfile} disabled={editLoading} loading={editLoading}>
              Enregistrer
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Language Selector Dialog */}
      <Portal>
        <Dialog visible={languageDialogVisible} onDismiss={() => setLanguageDialogVisible(false)}>
          <Dialog.Title>Choisir une langue</Dialog.Title>
          <Dialog.Content>
            {languageOptions.map((option) => (
              <Button
                key={option.value}
                mode={editFormData.language === option.value ? 'contained' : 'outlined'}
                onPress={() => {
                  setEditFormData({ ...editFormData, language: option.value });
                  setLanguageDialogVisible(false);
                }}
                style={styles.languageOption}
              >
                {option.label}
              </Button>
            ))}
          </Dialog.Content>
        </Dialog>
      </Portal>

      {/* Change Password Dialog */}
      <Portal>
        <Dialog
          visible={passwordDialogVisible}
          onDismiss={() => {
            setPasswordDialogVisible(false);
            setPasswordError(null);
          }}
        >
          <Dialog.Title>Changer le mot de passe</Dialog.Title>
          <Dialog.Content>
            {passwordError && (
              <Banner visible={!!passwordError} icon="alert-circle" style={styles.errorBanner}>
                {passwordError}
              </Banner>
            )}

            <TextInput
              label="Mot de passe actuel"
              value={passwordFormData.current_password}
              onChangeText={(text) =>
                setPasswordFormData({ ...passwordFormData, current_password: text })
              }
              secureTextEntry={!showPasswords.current}
              mode="outlined"
              style={styles.dialogInput}
              right={
                <TextInput.Icon
                  icon={showPasswords.current ? 'eye-off' : 'eye'}
                  onPress={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                />
              }
            />

            <TextInput
              label="Nouveau mot de passe"
              value={passwordFormData.new_password}
              onChangeText={(text) =>
                setPasswordFormData({ ...passwordFormData, new_password: text })
              }
              secureTextEntry={!showPasswords.new}
              mode="outlined"
              style={styles.dialogInput}
              right={
                <TextInput.Icon
                  icon={showPasswords.new ? 'eye-off' : 'eye'}
                  onPress={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                />
              }
            />
            <HelperText type="info">Minimum 8 caractères</HelperText>

            <TextInput
              label="Confirmer le mot de passe"
              value={passwordFormData.confirm_password}
              onChangeText={(text) =>
                setPasswordFormData({ ...passwordFormData, confirm_password: text })
              }
              secureTextEntry={!showPasswords.confirm}
              mode="outlined"
              style={styles.dialogInput}
              right={
                <TextInput.Icon
                  icon={showPasswords.confirm ? 'eye-off' : 'eye'}
                  onPress={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                />
              }
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => {
                setPasswordDialogVisible(false);
                setPasswordError(null);
              }}
              disabled={passwordLoading}
            >
              Annuler
            </Button>
            <Button onPress={handleChangePassword} disabled={passwordLoading} loading={passwordLoading}>
              Changer
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.backgrounds.light,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: tokens.colors.backgrounds.light,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  successBanner: {
    backgroundColor: '#E8F5E9',
    marginBottom: 16,
  },
  errorBanner: {
    backgroundColor: '#FFEBEE',
    marginBottom: 16,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  avatar: {
    backgroundColor: tokens.colors.primary,
  },
  avatarLabel: {
    fontSize: 32,
    fontWeight: '600',
  },
  name: {
    fontSize: 24,
    fontWeight: '600',
    color: tokens.colors.onSurface.light,
    marginTop: 16,
  },
  email: {
    fontSize: 14,
    color: tokens.colors.onSurface.light,
    marginTop: 4,
  },
  editButton: {
    marginTop: 16,
    borderColor: tokens.colors.primary,
  },
  editButtonLabel: {
    color: tokens.colors.primary,
  },
  divider: {
    marginVertical: 8,
  },
  section: {
    padding: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: tokens.colors.onSurface.light,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: tokens.colors.onSurface.light,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: tokens.colors.onSurface.light,
  },
  securityButton: {
    borderColor: tokens.colors.neutral[300],
  },
  logoutButton: {
    marginTop: 8,
  },
  dialogInput: {
    marginBottom: 16,
  },
  languageButton: {
    marginTop: 8,
    borderColor: tokens.colors.primary,
  },
  languageOption: {
    marginBottom: 8,
  },
});

export default ProfileScreen;
