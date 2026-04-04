import React, { useState, useEffect, useCallback } from 'react';
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
  Switch,
  List,
} from 'react-native-paper';
import {
  getPreferences,
  updatePreferences,
  registerForPushNotifications,
} from '../services/notifications.service';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_BASE_URL from '../config/api';

// Import shared design tokens
const tokens = require('../config/tokens');

const ProfileScreen = ({ navigation }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Notification preferences
  const [notifPrefs, setNotifPrefs] = useState(null);
  const [notifLoading, setNotifLoading] = useState(false);
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

  // RGPD
  const [exportLoading, setExportLoading]         = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [deleteConfirm, setDeleteConfirm]         = useState('');
  const [deleteLoading, setDeleteLoading]         = useState(false);

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

  // Charger les préférences de notification
  useEffect(() => {
    getPreferences().then((prefs) => { if (prefs) setNotifPrefs(prefs); }).catch(() => {});
    // Enregistrer le token push si pas encore fait
    registerForPushNotifications().catch(() => {});
  }, []);

  const handleToggleNotif = useCallback(async (key, value) => {
    if (!notifPrefs) return;
    const updated = { ...notifPrefs, [key]: value };
    setNotifPrefs(updated);
    try {
      await updatePreferences({ [key]: value });
    } catch {
      setNotifPrefs(notifPrefs); // rollback
    }
  }, [notifPrefs]);

  // RGPD — export données
  const handleDataExport = async () => {
    setExportLoading(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      const r = await fetch(`${API_BASE_URL}/users/me/data-export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error('Erreur export');
      setSuccess('Export demandé. Les données seront disponibles par email ou téléchargement.');
    } catch (e) {
      setError('Erreur lors de l\'export des données.');
    } finally {
      setExportLoading(false);
    }
  };

  // RGPD — suppression compte
  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'SUPPRIMER') return;
    setDeleteLoading(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      const r = await fetch(`${API_BASE_URL}/users/me`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error('Erreur suppression');
      await AsyncStorage.multiRemove(['access_token', 'refresh_token']);
      navigation.replace('Login');
    } catch (e) {
      setError('Erreur lors de la suppression du compte.');
      setDeleteLoading(false);
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

        {/* Notifications Section */}
        <Divider style={styles.divider} />
        <View style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            🔔 Notifications
          </Text>
          {notifPrefs ? (
            <>
              <List.Item
                title="Notifications push"
                description="Activer/désactiver toutes les notifications"
                left={(p) => <List.Icon {...p} icon="bell" color={tokens.colors.primary} />}
                right={() => (
                  <Switch
                    value={Boolean(notifPrefs.push_enabled)}
                    onValueChange={(v) => handleToggleNotif('push_enabled', v)}
                    color={tokens.colors.primary}
                  />
                )}
              />
              <List.Item
                title="Nouveaux contenus"
                description="Alertes lors de l'ajout de nouveaux livres"
                left={(p) => <List.Icon {...p} icon="book-plus" color="#B5651D" />}
                right={() => (
                  <Switch
                    value={Boolean(notifPrefs.new_content)}
                    onValueChange={(v) => handleToggleNotif('new_content', v)}
                    color={tokens.colors.primary}
                    disabled={!notifPrefs.push_enabled}
                  />
                )}
              />
              <List.Item
                title="Rappels de lecture"
                description="Rappels pour reprendre votre lecture"
                left={(p) => <List.Icon {...p} icon="book-open-variant" color="#2E4057" />}
                right={() => (
                  <Switch
                    value={Boolean(notifPrefs.reading_reminders)}
                    onValueChange={(v) => handleToggleNotif('reading_reminders', v)}
                    color={tokens.colors.primary}
                    disabled={!notifPrefs.push_enabled}
                  />
                )}
              />
              <List.Item
                title="Abonnement"
                description="Expiration, renouvellement, promotions"
                left={(p) => <List.Icon {...p} icon="credit-card" color="#D4A017" />}
                right={() => (
                  <Switch
                    value={Boolean(notifPrefs.subscription_updates)}
                    onValueChange={(v) => handleToggleNotif('subscription_updates', v)}
                    color={tokens.colors.primary}
                    disabled={!notifPrefs.push_enabled}
                  />
                )}
              />
            </>
          ) : (
            <ActivityIndicator size="small" color={tokens.colors.primary} />
          )}
        </View>

        {/* Security Section */}
        <Divider style={styles.divider} />
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

        {/* RGPD Section */}
        <View style={styles.section}>
          <Text variant="labelLarge" style={styles.sectionTitle}>Données &amp; confidentialité</Text>
          <Text style={styles.rgpdInfo}>
            Conformément au RGPD, vous pouvez télécharger vos données ou supprimer votre compte.
          </Text>
          <Button
            mode="outlined"
            icon="download"
            onPress={handleDataExport}
            loading={exportLoading}
            disabled={exportLoading}
            style={styles.rgpdButton}
            textColor={tokens.colors.primary}
          >
            Télécharger mes données
          </Button>
          <Button
            mode="outlined"
            icon="delete-forever"
            onPress={() => setDeleteDialogVisible(true)}
            style={[styles.rgpdButton, styles.deleteButton]}
            textColor={tokens.colors.semantic.error}
          >
            Supprimer mon compte
          </Button>
        </View>

        <Divider style={styles.divider} />

        {/* Légal Section */}
        <View style={styles.section}>
          <Text variant="labelLarge" style={styles.sectionTitle}>Mentions légales</Text>
          {[
            { label: "Conditions Générales d'Utilisation", type: 'cgu', icon: 'file-document-outline' },
            { label: 'Conditions Générales de Vente', type: 'cgv', icon: 'receipt' },
            { label: 'Politique de confidentialité', type: 'privacy', icon: 'shield-lock-outline' },
            { label: 'Politique de cookies', type: 'cookies', icon: 'cookie-outline' },
            { label: 'Mentions légales', type: 'mentions', icon: 'information-outline' },
            { label: 'Copyright & Signalement', type: 'copyright', icon: 'copyright' },
          ].map((item) => (
            <List.Item
              key={item.type}
              title={item.label}
              titleStyle={styles.listItemTitle}
              left={(props) => <List.Icon {...props} icon={item.icon} color={tokens.colors.primary} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" color="#9c7e49" />}
              onPress={() => navigation.navigate('Legal', { type: item.type })}
              style={styles.listItem}
            />
          ))}
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

      {/* Delete Account Confirmation Dialog */}
      <Portal>
        <Dialog visible={deleteDialogVisible} onDismiss={() => { setDeleteDialogVisible(false); setDeleteConfirm(''); }}>
          <Dialog.Title>Supprimer mon compte</Dialog.Title>
          <Dialog.Content>
            <Text style={{ fontSize: 14, color: '#374151', marginBottom: 12 }}>
              Cette action est irréversible. Votre compte, vos données de lecture et vos informations personnelles seront supprimés définitivement.
            </Text>
            <Text style={{ fontSize: 14, color: '#374151', marginBottom: 8 }}>
              Tapez <Text style={{ fontWeight: '700', color: '#B91C1C' }}>SUPPRIMER</Text> pour confirmer :
            </Text>
            <TextInput
              mode="outlined"
              value={deleteConfirm}
              onChangeText={setDeleteConfirm}
              placeholder="SUPPRIMER"
              autoCapitalize="characters"
              style={{ marginBottom: 4 }}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => { setDeleteDialogVisible(false); setDeleteConfirm(''); }} disabled={deleteLoading}>
              Annuler
            </Button>
            <Button
              onPress={handleDeleteAccount}
              disabled={deleteConfirm !== 'SUPPRIMER' || deleteLoading}
              loading={deleteLoading}
              textColor="#B91C1C"
            >
              Supprimer
            </Button>
          </Dialog.Actions>
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
  rgpdInfo: {
    fontSize: 13,
    color: tokens.colors.onSurface.light,
    opacity: 0.7,
    marginBottom: 12,
    lineHeight: 19,
  },
  rgpdButton: {
    marginBottom: 8,
    borderColor: tokens.colors.primary,
  },
  deleteButton: {
    borderColor: tokens.colors.semantic.error,
  },
  listItem: {
    paddingHorizontal: 0,
    paddingVertical: 2,
  },
  listItemTitle: {
    fontSize: 14,
    color: tokens.colors.onSurface.light,
  },
});

export default ProfileScreen;
