import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Avatar,
  Text,
  Portal,
  Dialog,
  Button,
  TextInput,
  HelperText,
  Snackbar,
} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import * as ImagePicker from 'expo-image-picker';
import BottomNavBar from '../components/BottomNavBar';
import * as userService from '../services/user.service';
import { subscriptionService } from '../services/subscription.service';
import * as homeService from '../services/home.service';
import * as authService from '../services/auth.service';

const tokens = require('../config/tokens');

function initialsFromName(name, email) {
  const raw = String(name || '').trim();
  if (raw) {
    const parts = raw.split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() || '').join('');
  }
  return String(email || 'U').charAt(0).toUpperCase();
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function resolveSubscriptionRaw(subscription, user) {
  return subscription || user?.subscription || null;
}

function resolveSubscriptionPlanLabel(subscription, user) {
  const sub = resolveSubscriptionRaw(subscription, user);
  if (!sub) return '';
  return (
    sub.plan_snapshot?.name
    || sub.planName
    || sub.plan_name
    || sub.plan_type
    || sub.plan
    || ''
  );
}

function resolveSubscriptionStatus(subscription, user) {
  const sub = resolveSubscriptionRaw(subscription, user);
  if (!sub) return '';
  return String(sub.status || '').toLowerCase();
}

function resolveSubscriptionRenewalDate(subscription, user) {
  const sub = resolveSubscriptionRaw(subscription, user);
  if (!sub) return '';
  return sub.current_period_end || sub.expires_at || '';
}

function languageLabel(code) {
  const map = { fr: 'Français', en: 'English', es: 'Español', pt: 'Português' };
  return map[code] || 'Français';
}

export default function ProfileScreen({ navigation }) {
  const [tab, setTab] = useState('account');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [recent, setRecent] = useState([]);
  const [history, setHistory] = useState([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [wifiOnly, setWifiOnly] = useState(false);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState('');
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [profileForm, setProfileForm] = useState({ full_name: '', language: 'fr' });
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  const loadData = useCallback(async () => {
    try {
      setError('');
      const [profile, currentSub, homeData, historyData] = await Promise.all([
        userService.getUserProfile().catch(() => null),
        subscriptionService.getCurrentSubscription().catch(() => null),
        homeService.getHomeData().catch(() => null),
        homeService.getReadingHistory(1, 20).catch(() => null),
      ]);

      if (!profile) {
        navigation.replace('Login');
        return;
      }

      setUser(profile);
      setProfileForm({
        full_name: profile.full_name || '',
        language: profile.language || 'fr',
      });
      setSubscription(currentSub);
      setRecent(Array.isArray(homeData?.continue_reading) ? homeData.continue_reading.slice(0, 6) : []);
      setHistory(Array.isArray(historyData?.data) ? historyData.data : []);
    } catch (e) {
      setError('Impossible de charger le profil.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigation]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleSaveProfile = async () => {
    try {
      setProfileSaving(true);
      const updated = await userService.updateUserProfile({
        full_name: String(profileForm.full_name || '').trim(),
        language: profileForm.language || 'fr',
      });
      setUser((prev) => ({ ...(prev || {}), ...(updated || {}) }));
      setProfileDialogOpen(false);
      setSnackbar('Profil mis à jour.');
    } catch (e) {
      setSnackbar(e?.message || 'Erreur mise à jour profil.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async () => {
    const current = String(passwordForm.current_password || '');
    const next = String(passwordForm.new_password || '');
    const confirm = String(passwordForm.confirm_password || '');

    if (!current || !next || !confirm) {
      setSnackbar('Tous les champs mot de passe sont requis.');
      return;
    }
    if (next.length < 8) {
      setSnackbar('Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (next !== confirm) {
      setSnackbar('Les mots de passe ne correspondent pas.');
      return;
    }

    try {
      setPasswordSaving(true);
      await userService.changePassword({
        current_password: current,
        new_password: next,
      });
      setPasswordDialogOpen(false);
      setPasswordForm({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
      setSnackbar('Mot de passe modifié.');
    } catch (e) {
      setSnackbar(e?.message || 'Erreur changement mot de passe.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handlePickAndUploadAvatar = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission?.status !== 'granted') {
        setSnackbar("Permission galerie refusée.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.85,
        base64: true,
      });

      if (result?.canceled) return;
      const asset = result?.assets?.[0];
      if (!asset?.uri) {
        setSnackbar('Image invalide.');
        return;
      }

      setAvatarUploading(true);
      const dataUri = asset.base64
        ? `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`
        : null;
      const uploaded = await userService.uploadAvatar({
        uri: dataUri || asset.uri,
        name: asset.fileName || `avatar-${Date.now()}.jpg`,
        type: asset.mimeType || 'image/jpeg',
      });
      setUser((prev) => ({ ...(prev || {}), ...(uploaded || {}) }));
      setSnackbar('Avatar mis à jour.');
    } catch (e) {
      setSnackbar(e?.message || 'Erreur upload avatar.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
    } finally {
      navigation.replace('Login');
    }
  };

  const avatarInitials = useMemo(
    () => initialsFromName(user?.full_name, user?.email),
    [user?.full_name, user?.email]
  );

  const activePlan = String(resolveSubscriptionPlanLabel(subscription, user)).trim();
  const activeStatus = resolveSubscriptionStatus(subscription, user);
  const hasActiveSubscription = activeStatus === 'active' || activeStatus === 'trialing';
  const recentItems = useMemo(() => {
    if (Array.isArray(recent) && recent.length > 0) return recent;
    if (!Array.isArray(history)) return [];
    return history.slice(0, 6).map((item) => ({
      id: item.content_id || item.id,
      content_id: item.content_id || item.id,
      title: item.title,
      author: item.author,
      content_type: item.content_type,
      progress_percent: item.progress_percent || 0,
      cover_url: item.cover_url || null,
    }));
  }, [recent, history]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={tokens.colors.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Session expirée.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.replace('Login')}>
          <Text style={styles.primaryButtonText}>Se reconnecter</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[tokens.colors.primary]}
          />
        )}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#171412" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profil</Text>
          <TouchableOpacity style={styles.iconButton} onPress={() => setProfileDialogOpen(true)}>
            <MaterialCommunityIcons name="cog-outline" size={22} color="#171412" />
          </TouchableOpacity>
        </View>

        <View style={styles.profileTop}>
          {user.avatar_url ? (
            <Avatar.Image size={96} source={{ uri: user.avatar_url }} />
          ) : (
            <Avatar.Text size={96} label={avatarInitials} style={styles.avatarFallback} color="#FFFFFF" />
          )}
          <TouchableOpacity style={styles.avatarEdit} onPress={handlePickAndUploadAvatar} disabled={avatarUploading}>
            {avatarUploading ? (
              <ActivityIndicator size={12} color="#fff" />
            ) : (
              <MaterialCommunityIcons name="pencil" size={14} color="#fff" />
            )}
          </TouchableOpacity>
          <Text style={styles.name}>{user.full_name || 'Utilisateur'}</Text>
          <Text style={styles.email}>{user.email}</Text>
        </View>

        <View style={styles.tabs}>
          <TouchableOpacity style={styles.tabBtn} onPress={() => setTab('account')}>
            <Text style={[styles.tabText, tab === 'account' && styles.tabTextActive]}>Mon Compte</Text>
            {tab === 'account' ? <View style={styles.tabUnderline} /> : null}
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabBtn} onPress={() => setTab('history')}>
            <Text style={[styles.tabText, tab === 'history' && styles.tabTextActive]}>Historique</Text>
            {tab === 'history' ? <View style={styles.tabUnderline} /> : null}
          </TouchableOpacity>
        </View>

        {tab === 'account' ? (
          <>
            <View style={styles.subscriptionCard}>
              <View style={styles.subscriptionHead}>
                <View style={styles.subscriptionIconWrap}>
                  <MaterialCommunityIcons name="diamond-stone" size={18} color={tokens.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.subscriptionTitle}>
                    {hasActiveSubscription ? 'Abonnement Premium' : 'Aucun abonnement actif'}
                  </Text>
                  <Text style={styles.subscriptionSub}>
                    {hasActiveSubscription
                      ? `Renouvellement le ${formatDate(resolveSubscriptionRenewalDate(subscription, user))}`
                      : 'Activez un plan pour lire/écouter sans limite'}
                  </Text>
                </View>
              </View>
              <View style={styles.subscriptionFoot}>
                <Text style={styles.subscriptionPrice}>
                  {activePlan
                    ? `${activePlan} ${Number.isFinite(Number(subscription?.amount))
                      ? `· ${Number(subscription.amount).toFixed(2)} ${subscription?.currency || 'EUR'}`
                      : (Number.isFinite(Number(subscription?.price_eur)) ? `· ${subscription.price_eur}€` : '')
                    }`.trim()
                    : 'Gratuit'}
                </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Subscription')}>
                  <Text style={styles.manageLink}>Gérer</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Lectures récentes</Text>
                <TouchableOpacity onPress={() => navigation.navigate('History')}>
                  <Text style={styles.seeAll}>Voir tout</Text>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentRow}>
                {recentItems.length === 0 ? (
                  <View style={styles.emptyRecent}>
                    <Text style={styles.emptyRecentText}>Aucune lecture en cours</Text>
                  </View>
                ) : recentItems.map((item) => (
                  <TouchableOpacity
                    key={item.content_id || item.id}
                    style={styles.recentCard}
                    onPress={() => navigation.navigate('ContentDetail', { contentId: item.content_id || item.id })}
                  >
                    <Image
                      source={{ uri: item.cover_url || 'https://placehold.co/200x280/EEE/AAA?text=Book' }}
                      style={styles.recentCover}
                    />
                    <Text numberOfLines={1} style={styles.recentProgress}>{Math.round(item.progress_percent || 0)}%</Text>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${Math.max(2, Math.round(item.progress_percent || 0))}%` }]} />
                    </View>
                    <View style={styles.recentTypeRow}>
                      <MaterialCommunityIcons
                        name={item.content_type === 'audiobook' ? 'headphones' : 'book-open-page-variant'}
                        size={12}
                        color="#867465"
                      />
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Préférences</Text>
              <View style={styles.prefCard}>
                <View style={styles.prefRow}>
                  <View style={styles.prefLeft}>
                    <MaterialCommunityIcons name="bell-outline" size={20} color="#867465" />
                    <Text style={styles.prefText}>Notifications</Text>
                  </View>
                  <Switch
                    value={notificationsEnabled}
                    onValueChange={setNotificationsEnabled}
                    thumbColor={notificationsEnabled ? '#fff' : '#f5f5f5'}
                    trackColor={{ false: '#d9d9de', true: tokens.colors.primary }}
                  />
                </View>
                <View style={styles.divider} />
                <TouchableOpacity
                  style={styles.prefRow}
                  onPress={() => setProfileDialogOpen(true)}
                >
                  <View style={styles.prefLeft}>
                    <MaterialCommunityIcons name="web" size={20} color="#867465" />
                    <Text style={styles.prefText}>Langue de l'app</Text>
                  </View>
                  <View style={styles.prefRight}>
                    <Text style={styles.prefMeta}>{languageLabel(user.language)}</Text>
                    <MaterialCommunityIcons name="chevron-right" size={20} color="#a1958c" />
                  </View>
                </TouchableOpacity>
                <View style={styles.divider} />
                <TouchableOpacity style={styles.prefRow} onPress={() => setPasswordDialogOpen(true)}>
                  <View style={styles.prefLeft}>
                    <MaterialCommunityIcons name="lock-outline" size={20} color="#867465" />
                    <Text style={styles.prefText}>Mot de passe</Text>
                  </View>
                  <View style={styles.prefRight}>
                    <MaterialCommunityIcons name="chevron-right" size={20} color="#a1958c" />
                  </View>
                </TouchableOpacity>
                <View style={styles.divider} />
                <View style={styles.prefRow}>
                  <View style={styles.prefLeft}>
                    <MaterialCommunityIcons name="wifi" size={20} color="#867465" />
                    <Text style={styles.prefText}>Téléchargements Wi-Fi</Text>
                  </View>
                  <Switch
                    value={wifiOnly}
                    onValueChange={setWifiOnly}
                    thumbColor={wifiOnly ? '#fff' : '#f5f5f5'}
                    trackColor={{ false: '#d9d9de', true: tokens.colors.primary }}
                  />
                </View>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Historique de lecture</Text>
            <View style={styles.historyCard}>
              {history.length === 0 ? (
                <Text style={styles.emptyRecentText}>Aucune activité récente.</Text>
              ) : history.slice(0, 12).map((item) => (
                <TouchableOpacity
                  key={item.id || item.content_id}
                  style={styles.historyRow}
                  onPress={() => navigation.navigate('ContentDetail', { contentId: item.content_id })}
                >
                  <View style={styles.historyLeft}>
                    <Image
                      source={{ uri: item.cover_url || 'https://placehold.co/80x100/EEE/AAA?text=Book' }}
                      style={styles.historyThumb}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyTitle} numberOfLines={1}>{item.title || 'Contenu'}</Text>
                      <Text style={styles.historyMeta}>
                        {item.is_completed ? 'Terminé' : 'En cours'} · {Math.round(item.progress_percent || 0)}%
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.historyDate}>{formatDate(item.last_read_at)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {error ? <Text style={styles.errorInline}>{error}</Text> : null}

        <TouchableOpacity style={styles.logoutRow} onPress={handleLogout}>
          <MaterialCommunityIcons name="logout-variant" size={20} color="#a07e67" />
          <Text style={styles.logoutText}>Déconnexion</Text>
        </TouchableOpacity>
        <Text style={styles.versionText}>Version 2.4.0</Text>
      </ScrollView>

      <Portal>
        <Dialog visible={profileDialogOpen} onDismiss={() => setProfileDialogOpen(false)}>
          <Dialog.Title>Modifier le profil</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              label="Nom complet"
              value={profileForm.full_name}
              onChangeText={(text) => setProfileForm((prev) => ({ ...prev, full_name: text }))}
            />
            <View style={styles.languageChips}>
              {[
                { value: 'fr', label: 'Français' },
                { value: 'en', label: 'English' },
                { value: 'es', label: 'Español' },
                { value: 'pt', label: 'Português' },
              ].map((lang) => (
                <TouchableOpacity
                  key={lang.value}
                  style={[
                    styles.languageChip,
                    profileForm.language === lang.value && styles.languageChipActive,
                  ]}
                  onPress={() => setProfileForm((prev) => ({ ...prev, language: lang.value }))}
                >
                  <Text
                    style={[
                      styles.languageChipText,
                      profileForm.language === lang.value && styles.languageChipTextActive,
                    ]}
                  >
                    {lang.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <HelperText type="info">Tu peux aussi changer l’avatar en touchant l’icône crayon.</HelperText>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setProfileDialogOpen(false)} disabled={profileSaving}>Annuler</Button>
            <Button onPress={handleSaveProfile} loading={profileSaving} disabled={profileSaving}>Enregistrer</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Portal>
        <Dialog visible={passwordDialogOpen} onDismiss={() => setPasswordDialogOpen(false)}>
          <Dialog.Title>Changer le mot de passe</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              secureTextEntry
              label="Mot de passe actuel"
              value={passwordForm.current_password}
              onChangeText={(text) => setPasswordForm((prev) => ({ ...prev, current_password: text }))}
              style={styles.dialogInput}
            />
            <TextInput
              mode="outlined"
              secureTextEntry
              label="Nouveau mot de passe"
              value={passwordForm.new_password}
              onChangeText={(text) => setPasswordForm((prev) => ({ ...prev, new_password: text }))}
              style={styles.dialogInput}
            />
            <TextInput
              mode="outlined"
              secureTextEntry
              label="Confirmer le mot de passe"
              value={passwordForm.confirm_password}
              onChangeText={(text) => setPasswordForm((prev) => ({ ...prev, confirm_password: text }))}
            />
            <HelperText type="info">Minimum 8 caractères.</HelperText>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPasswordDialogOpen(false)} disabled={passwordSaving}>Annuler</Button>
            <Button onPress={handleChangePassword} loading={passwordSaving} disabled={passwordSaving}>Valider</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={!!snackbar}
        onDismiss={() => setSnackbar('')}
        duration={2500}
      >
        {snackbar}
      </Snackbar>

      <BottomNavBar navigation={navigation} activeTab="Profile" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2EE',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F2EE',
  },
  errorText: {
    color: '#6b5e55',
    marginBottom: 14,
  },
  primaryButton: {
    backgroundColor: tokens.colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 104,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 30,
    fontFamily: 'Playfair Display',
    fontWeight: '700',
    color: '#171412',
  },
  profileTop: {
    alignItems: 'center',
    marginTop: 14,
  },
  avatarFallback: {
    backgroundColor: '#B87949',
  },
  avatarEdit: {
    position: 'absolute',
    right: '35%',
    top: 72,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: tokens.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#F5F2EE',
  },
  name: {
    marginTop: 14,
    fontSize: 34,
    lineHeight: 38,
    fontFamily: 'Playfair Display',
    fontWeight: '700',
    color: '#171412',
    textAlign: 'center',
  },
  email: {
    marginTop: 4,
    color: '#8A7D73',
    fontSize: 16,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E3DCD5',
    marginTop: 22,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  tabText: {
    color: '#958b83',
    fontSize: 17,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#171412',
    fontWeight: '700',
  },
  tabUnderline: {
    marginTop: 10,
    width: '100%',
    height: 3,
    backgroundColor: tokens.colors.primary,
  },
  subscriptionCard: {
    marginTop: 18,
    borderRadius: 18,
    backgroundColor: '#fff',
    padding: 16,
  },
  subscriptionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  subscriptionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F5EEE6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscriptionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#171412',
  },
  subscriptionSub: {
    fontSize: 14,
    color: '#8A7D73',
    marginTop: 2,
  },
  subscriptionFoot: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subscriptionPrice: {
    color: '#8A7D73',
    fontSize: 15,
  },
  manageLink: {
    color: tokens.colors.primary,
    fontWeight: '700',
    fontSize: 22,
    fontFamily: 'Playfair Display',
  },
  section: {
    marginTop: 22,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 30,
    color: '#171412',
    fontFamily: 'Playfair Display',
    fontWeight: '700',
  },
  seeAll: {
    color: tokens.colors.primary,
    fontWeight: '600',
    fontSize: 15,
  },
  recentRow: {
    gap: 12,
  },
  recentCard: {
    width: 112,
    borderRadius: 12,
    backgroundColor: '#fff',
    padding: 8,
  },
  recentCover: {
    width: '100%',
    height: 132,
    borderRadius: 8,
    backgroundColor: '#EFEAE3',
  },
  recentProgress: {
    marginTop: 6,
    color: '#6E6259',
    fontWeight: '700',
    fontSize: 12,
  },
  progressTrack: {
    marginTop: 4,
    width: '100%',
    height: 4,
    borderRadius: 99,
    backgroundColor: '#e8e1da',
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 99,
    backgroundColor: tokens.colors.primary,
  },
  recentTypeRow: {
    marginTop: 6,
    alignItems: 'flex-end',
  },
  emptyRecent: {
    borderRadius: 12,
    backgroundColor: '#fff',
    padding: 16,
    minWidth: 180,
  },
  emptyRecentText: {
    color: '#8a7d73',
  },
  prefCard: {
    marginTop: 10,
    borderRadius: 16,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
  },
  prefRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  prefLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  prefText: {
    color: '#171412',
    fontSize: 16,
  },
  prefRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  prefMeta: {
    color: '#8a7d73',
    fontSize: 14,
  },
  divider: {
    height: 1,
    backgroundColor: '#ECE6E0',
  },
  historyCard: {
    marginTop: 10,
    borderRadius: 16,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  historyRow: {
    minHeight: 74,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1ece7',
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    paddingRight: 10,
  },
  historyThumb: {
    width: 34,
    height: 46,
    borderRadius: 4,
    backgroundColor: '#EFEAE3',
  },
  historyTitle: {
    color: '#171412',
    fontSize: 14,
    fontWeight: '600',
  },
  historyMeta: {
    color: '#8a7d73',
    fontSize: 12,
    marginTop: 2,
  },
  historyDate: {
    color: '#8a7d73',
    fontSize: 12,
  },
  errorInline: {
    marginTop: 14,
    textAlign: 'center',
    color: '#ad3f3f',
  },
  logoutRow: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logoutText: {
    color: '#a07e67',
    fontSize: 20,
    fontWeight: '600',
    fontFamily: 'Playfair Display',
  },
  versionText: {
    textAlign: 'center',
    marginTop: 8,
    color: '#a39a92',
    fontSize: 13,
  },
  dialogInput: {
    marginBottom: 10,
  },
  languageChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  languageChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d8d0ca',
    backgroundColor: '#f7f3ef',
  },
  languageChipActive: {
    backgroundColor: '#f0dfcd',
    borderColor: tokens.colors.primary,
  },
  languageChipText: {
    color: '#6e6259',
    fontSize: 12,
    fontWeight: '600',
  },
  languageChipTextActive: {
    color: '#2f241c',
  },
});
