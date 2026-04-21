import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Animated,
  Platform,
} from 'react-native';
import {
  Text,
  Divider,
  Portal,
  Dialog,
  TextInput,
  Button,
  Switch,
  List,
  ActivityIndicator,
  Snackbar,
  Banner,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  getUserProfile,
  updateUserProfile,
  changePassword,
} from '../services/user.service';
import {
  getPreferences,
  updatePreferences,
  registerForPushNotifications,
} from '../services/notifications.service';
import { logout } from '../services/auth.service';
import { changeLanguage, SUPPORTED_LANGUAGES } from '../i18n';

const tokens = require('../config/tokens');

// ── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name, email) {
  if (name?.trim()) {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  }
  if (email) return email[0].toUpperCase();
  return '?';
}

function formatDate(dateStr, locale) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(locale === 'en' ? 'en-GB' : 'fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function getSubStatusColor(status) {
  switch (status) {
    case 'active': return '#22c55e';
    case 'cancelled': return '#f97316';
    case 'expired': return '#ef4444';
    default: return '#9ca3af';
  }
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ProfileScreen({ navigation }) {
  const { t, i18n } = useTranslation();

  // ── Data state ──
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState(null);

  // ── Feedback ──
  const [snackMsg, setSnackMsg] = useState('');
  const [snackError, setSnackError] = useState(false);

  // ── Dialog visibility ──
  const [editNameVisible, setEditNameVisible] = useState(false);
  const [changePassVisible, setChangePassVisible] = useState(false);
  const [langDialogVisible, setLangDialogVisible] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [dangerExpanded, setDangerExpanded] = useState(false);

  // ── Edit name form ──
  const [editName, setEditName] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // ── Change password form ──
  const [passForm, setPassForm] = useState({ current: '', next: '', confirm: '' });
  const [showPass, setShowPass] = useState({ current: false, next: false, confirm: false });
  const [passLoading, setPassLoading] = useState(false);
  const [passError, setPassError] = useState('');

  // ── Delete account ──
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Avatar pulse animation ──
  const avatarScale = useRef(new Animated.Value(1)).current;
  const pulseAvatar = () => {
    Animated.sequence([
      Animated.timing(avatarScale, { toValue: 0.92, duration: 100, useNativeDriver: true }),
      Animated.timing(avatarScale, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  };

  // ── Load data ──
  const fetchProfile = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const profile = await getUserProfile();
      setUser(profile);
      setEditName(profile?.full_name || '');
    } catch {
      showSnack(t('errors.networkError'), true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    fetchProfile();
    getPreferences().then(p => { if (p) setNotifPrefs(p); }).catch(() => {});
    registerForPushNotifications().catch(() => {});
  }, [fetchProfile]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchProfile(true);
  };

  // ── Feedback helper ──
  const showSnack = (msg, isError = false) => {
    setSnackMsg(msg);
    setSnackError(isError);
  };

  // ── Edit name ──
  const handleSaveName = async () => {
    if (!editName.trim()) return;
    setEditLoading(true);
    try {
      const updated = await updateUserProfile({ full_name: editName.trim() });
      setUser(prev => ({ ...prev, full_name: updated?.full_name || editName.trim() }));
      setEditNameVisible(false);
      showSnack(t('common.success'));
    } catch {
      showSnack(t('common.error'), true);
    } finally {
      setEditLoading(false);
    }
  };

  // ── Change password ──
  const handleChangePassword = async () => {
    setPassError('');
    if (!passForm.current || !passForm.next || !passForm.confirm) {
      setPassError(t('auth.fieldRequired'));
      return;
    }
    if (passForm.next !== passForm.confirm) {
      setPassError(t('auth.passwordMismatch'));
      return;
    }
    if (passForm.next.length < 8) {
      setPassError(t('auth.weakPassword'));
      return;
    }
    setPassLoading(true);
    try {
      await changePassword({ current_password: passForm.current, new_password: passForm.next });
      setChangePassVisible(false);
      setPassForm({ current: '', next: '', confirm: '' });
      showSnack(t('common.success'));
    } catch (e) {
      setPassError(e?.message || t('common.error'));
    } finally {
      setPassLoading(false);
    }
  };

  // ── Notifications toggle ──
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

  // ── Language change ──
  const handleLangChange = async (code) => {
    setLangDialogVisible(false);
    await changeLanguage(code);
  };

  // ── Logout ──
  const handleLogout = async () => {
    try { await logout(); } catch {}
    navigation.replace('Login');
  };

  // ── Delete account ──
  const handleDeleteAccount = async () => {
    if (deleteConfirm.toUpperCase() !== 'SUPPRIMER') return;
    setDeleteLoading(true);
    try {
      await logout();
      navigation.replace('Login');
    } catch {
      showSnack(t('common.error'), true);
      setDeleteLoading(false);
    }
  };

  // ── Subscription helpers ──
  const sub = user?.subscription;
  const subStatusLabel = () => {
    if (!sub) return t('profile.noSubscription');
    switch (sub.status) {
      case 'active': return t('subscription.active');
      case 'cancelled': return t('subscription.cancelled');
      case 'expired': return t('subscription.expired');
      default: return sub.status;
    }
  };

  // ── Loading state ──
  if (loading && !user) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top']}>
        <ActivityIndicator size="large" color={tokens.colors.primary} />
      </SafeAreaView>
    );
  }

  // ── Current app language label ──
  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === i18n.language) || SUPPORTED_LANGUAGES[0];
  const firstName = user?.full_name?.split(' ')[0] || '';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[tokens.colors.primary]}
            tintColor={tokens.colors.primary}
          />
        }
      >
        {/* ── HEADER ─────────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => { pulseAvatar(); setEditNameVisible(true); }}
          >
            <Animated.View style={[styles.avatarWrap, { transform: [{ scale: avatarScale }] }]}>
              <Text style={styles.avatarText}>
                {getInitials(user?.full_name, user?.email)}
              </Text>
              <View style={styles.avatarEditBadge}>
                <MaterialCommunityIcons name="pencil" size={10} color="#fff" />
              </View>
            </Animated.View>
          </TouchableOpacity>

          <Text style={styles.headerName}>{user?.full_name || t('common.unknown')}</Text>
          <Text style={styles.headerEmail}>{user?.email}</Text>

          {/* Subscription pill */}
          {sub ? (
            <View style={[styles.subPill, { borderColor: getSubStatusColor(sub.status) }]}>
              <View style={[styles.subPillDot, { backgroundColor: getSubStatusColor(sub.status) }]} />
              <Text style={[styles.subPillText, { color: getSubStatusColor(sub.status) }]}>
                {subStatusLabel()}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.subPillCTA}
              onPress={() => navigation.navigate('Subscription')}
            >
              <MaterialCommunityIcons name="crown-outline" size={14} color="#fff" />
              <Text style={styles.subPillCTAText}>{t('profile.subscribeNow')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── ABONNEMENT ─────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <MaterialCommunityIcons name="crown" size={20} color="#D4A017" />
            <Text style={styles.cardTitle}>{t('profile.subscription')}</Text>
          </View>

          {sub ? (
            <>
              <View style={styles.subInfoRow}>
                <Text style={styles.subLabel}>{t('subscription.plan')}</Text>
                <Text style={styles.subValue}>
                  {sub.plan === 'monthly' ? t('subscription.monthly') : sub.plan === 'yearly' ? t('subscription.yearly') : sub.plan}
                </Text>
              </View>
              {sub.expires_at && (
                <View style={styles.subInfoRow}>
                  <Text style={styles.subLabel}>
                    {sub.status === 'active' ? t('subscription.renewsOn', { date: formatDate(sub.expires_at, i18n.language) }) : t('subscription.expiresOn', { date: formatDate(sub.expires_at, i18n.language) })}
                  </Text>
                </View>
              )}
              {sub.price_eur && (
                <View style={styles.subInfoRow}>
                  <Text style={styles.subLabel}>{t('common.subscription')}</Text>
                  <Text style={styles.subValue}>{sub.price_eur} €</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.subManageBtn}
                onPress={() => navigation.navigate('Subscription')}
              >
                <Text style={styles.subManageBtnText}>{t('profile.manageSubscription')}</Text>
                <MaterialCommunityIcons name="chevron-right" size={16} color={tokens.colors.primary} />
              </TouchableOpacity>
            </>
          ) : (
            <View>
              <Text style={styles.subNone}>{t('profile.noSubscription')}</Text>
              <TouchableOpacity
                style={styles.subSubscribeBtn}
                onPress={() => navigation.navigate('Subscription')}
              >
                <MaterialCommunityIcons name="crown-outline" size={16} color="#fff" />
                <Text style={styles.subSubscribeBtnText}>{t('profile.subscribeNow')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── MON COMPTE ─────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('profile.myAccount')}</Text>
          <View style={styles.listCard}>
            <ListRow
              icon="account-edit-outline"
              title={t('profile.editProfile')}
              value={user?.full_name || '—'}
              onPress={() => { setEditName(user?.full_name || ''); setEditNameVisible(true); }}
            />
            <Divider style={styles.rowDivider} />
            <ListRow
              icon="lock-outline"
              title={t('profile.changePassword')}
              onPress={() => { setPassForm({ current: '', next: '', confirm: '' }); setPassError(''); setChangePassVisible(true); }}
            />
            <Divider style={styles.rowDivider} />
            <ListRow
              icon="devices"
              title={t('profile.myDevices')}
              value={t('profile.devicesDesc')}
              onPress={() => navigation.navigate('Subscription')}
              chevron
            />
          </View>
        </View>

        {/* ── PRÉFÉRENCES ────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('settings.title')}</Text>
          <View style={styles.listCard}>
            {/* Language */}
            <ListRow
              icon="translate"
              title={t('common.language')}
              value={`${currentLang.flag}  ${currentLang.label}`}
              onPress={() => setLangDialogVisible(true)}
              chevron
            />

            {/* Notifications */}
            {notifPrefs && (
              <>
                <Divider style={styles.rowDivider} />
                <SwitchRow
                  icon="bell-outline"
                  iconColor={tokens.colors.primary}
                  title={t('settings.notifications')}
                  value={Boolean(notifPrefs.push_enabled)}
                  onToggle={v => handleToggleNotif('push_enabled', v)}
                />
                <Divider style={styles.rowDivider} />
                <SwitchRow
                  icon="book-plus-outline"
                  iconColor="#B5651D"
                  title={t('settings.notifNew')}
                  value={Boolean(notifPrefs.new_content)}
                  onToggle={v => handleToggleNotif('new_content', v)}
                  disabled={!notifPrefs.push_enabled}
                />
                <Divider style={styles.rowDivider} />
                <SwitchRow
                  icon="book-open-outline"
                  iconColor="#2E4057"
                  title={t('settings.notifReminder')}
                  value={Boolean(notifPrefs.reading_reminders)}
                  onToggle={v => handleToggleNotif('reading_reminders', v)}
                  disabled={!notifPrefs.push_enabled}
                />
              </>
            )}
          </View>
        </View>

        {/* ── FAMILLE ────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('profile.familyAccounts')}</Text>
          <View style={styles.listCard}>
            <ListRow
              icon="account-group-outline"
              title={t('profile.manageProfiles')}
              onPress={() => navigation.navigate('Family')}
              chevron
            />
            <Divider style={styles.rowDivider} />
            <ListRow
              icon="account-switch-outline"
              title={t('profile.switchProfile')}
              onPress={() => navigation.navigate('ProfileSelector', { fromSettings: true })}
              chevron
            />
          </View>
        </View>

        {/* ── LÉGAL ──────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('profile.legal')}</Text>
          <View style={styles.listCard}>
            {[
              { label: t('profile.termsOfUse'), type: 'cgu', icon: 'file-document-outline' },
              { label: 'CGV', type: 'cgv', icon: 'receipt' },
              { label: t('profile.privacy'), type: 'privacy', icon: 'shield-lock-outline' },
              { label: 'Cookies', type: 'cookies', icon: 'cookie-outline' },
            ].map((item, i, arr) => (
              <React.Fragment key={item.type}>
                <ListRow
                  icon={item.icon}
                  title={item.label}
                  onPress={() => navigation.navigate('Legal', { type: item.type })}
                  chevron
                />
                {i < arr.length - 1 && <Divider style={styles.rowDivider} />}
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* ── INFOS COMPTE ───────────────────────────────────── */}
        {user?.created_at && (
          <Text style={styles.memberSince}>
            {i18n.language === 'en'
              ? `Member since ${formatDate(user.created_at, 'en')}`
              : `Membre depuis ${formatDate(user.created_at, 'fr')}`}
          </Text>
        )}

        {/* ── DÉCONNEXION ────────────────────────────────────── */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <MaterialCommunityIcons name="logout" size={20} color="#fff" />
            <Text style={styles.logoutBtnText}>{t('profile.logoutButton')}</Text>
          </TouchableOpacity>
        </View>

        {/* ── ZONE DE DANGER ─────────────────────────────────── */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.dangerToggle}
            onPress={() => setDangerExpanded(v => !v)}
          >
            <MaterialCommunityIcons
              name={dangerExpanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color="#9ca3af"
            />
            <Text style={styles.dangerToggleText}>{t('profile.dangerZone')}</Text>
          </TouchableOpacity>

          {dangerExpanded && (
            <View style={styles.dangerCard}>
              <Text style={styles.dangerDesc}>
                {t('profile.deleteAccount')} — action irréversible.
              </Text>
              <TouchableOpacity
                style={styles.dangerBtn}
                onPress={() => { setDeleteConfirm(''); setDeleteDialogVisible(true); }}
              >
                <MaterialCommunityIcons name="delete-forever-outline" size={18} color="#ef4444" />
                <Text style={styles.dangerBtnText}>{t('profile.deleteAccount')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── DIALOGS ──────────────────────────────────────────── */}

      {/* Edit name */}
      <Portal>
        <Dialog visible={editNameVisible} onDismiss={() => setEditNameVisible(false)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>{t('profile.editProfile')}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label={t('profile.fullName')}
              value={editName}
              onChangeText={setEditName}
              mode="outlined"
              autoFocus
              maxLength={100}
              outlineColor="#e5e0dc"
              activeOutlineColor={tokens.colors.primary}
              style={styles.dialogInput}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditNameVisible(false)} textColor="#9ca3af">{t('common.cancel')}</Button>
            <Button
              onPress={handleSaveName}
              loading={editLoading}
              disabled={editLoading || !editName.trim()}
              textColor={tokens.colors.primary}
            >
              {t('common.save')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Change password */}
      <Portal>
        <Dialog
          visible={changePassVisible}
          onDismiss={() => { setChangePassVisible(false); setPassError(''); }}
          style={styles.dialog}
        >
          <Dialog.Title style={styles.dialogTitle}>{t('profile.changePassword')}</Dialog.Title>
          <Dialog.Content>
            {passError ? (
              <Banner visible icon="alert-circle" style={styles.errorBanner}>{passError}</Banner>
            ) : null}
            <PassField
              label={t('auth.passwordLabel') + ' (actuel)'}
              value={passForm.current}
              onChange={v => setPassForm(f => ({ ...f, current: v }))}
              show={showPass.current}
              onToggle={() => setShowPass(s => ({ ...s, current: !s.current }))}
            />
            <PassField
              label={t('auth.passwordLabel') + ' (nouveau)'}
              value={passForm.next}
              onChange={v => setPassForm(f => ({ ...f, next: v }))}
              show={showPass.next}
              onToggle={() => setShowPass(s => ({ ...s, next: !s.next }))}
            />
            <PassField
              label={t('auth.confirmPasswordLabel')}
              value={passForm.confirm}
              onChange={v => setPassForm(f => ({ ...f, confirm: v }))}
              show={showPass.confirm}
              onToggle={() => setShowPass(s => ({ ...s, confirm: !s.confirm }))}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => { setChangePassVisible(false); setPassError(''); }}
              textColor="#9ca3af"
              disabled={passLoading}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onPress={handleChangePassword}
              loading={passLoading}
              disabled={passLoading}
              textColor={tokens.colors.primary}
            >
              {t('common.save')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Language picker */}
      <Portal>
        <Dialog visible={langDialogVisible} onDismiss={() => setLangDialogVisible(false)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>{t('common.language')}</Dialog.Title>
          <Dialog.Content>
            {SUPPORTED_LANGUAGES.map(lang => (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.langOption,
                  i18n.language === lang.code && styles.langOptionActive,
                ]}
                onPress={() => handleLangChange(lang.code)}
              >
                <Text style={styles.langFlag}>{lang.flag}</Text>
                <Text style={[
                  styles.langLabel,
                  i18n.language === lang.code && styles.langLabelActive,
                ]}>
                  {lang.label}
                </Text>
                {i18n.language === lang.code && (
                  <MaterialCommunityIcons name="check" size={18} color={tokens.colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setLangDialogVisible(false)} textColor="#9ca3af">{t('common.close')}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Delete account */}
      <Portal>
        <Dialog
          visible={deleteDialogVisible}
          onDismiss={() => { setDeleteDialogVisible(false); setDeleteConfirm(''); }}
          style={styles.dialog}
        >
          <Dialog.Title style={[styles.dialogTitle, { color: '#ef4444' }]}>
            {t('profile.deleteAccount')}
          </Dialog.Title>
          <Dialog.Content>
            <Text style={styles.deleteWarning}>
              Cette action est irréversible. Toutes vos données seront supprimées définitivement.
            </Text>
            <Text style={styles.deleteInstruction}>
              Tapez <Text style={styles.deleteKeyword}>SUPPRIMER</Text> pour confirmer :
            </Text>
            <TextInput
              mode="outlined"
              value={deleteConfirm}
              onChangeText={setDeleteConfirm}
              placeholder="SUPPRIMER"
              autoCapitalize="characters"
              outlineColor="#fca5a5"
              activeOutlineColor="#ef4444"
              style={{ marginTop: 8 }}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => { setDeleteDialogVisible(false); setDeleteConfirm(''); }}
              disabled={deleteLoading}
              textColor="#9ca3af"
            >
              {t('common.cancel')}
            </Button>
            <Button
              onPress={handleDeleteAccount}
              disabled={deleteConfirm.toUpperCase() !== 'SUPPRIMER' || deleteLoading}
              loading={deleteLoading}
              textColor="#ef4444"
            >
              {t('common.delete')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Snackbar */}
      <Snackbar
        visible={!!snackMsg}
        onDismiss={() => setSnackMsg('')}
        duration={3000}
        style={snackError ? styles.snackError : styles.snackSuccess}
        action={{ label: t('common.close'), onPress: () => setSnackMsg('') }}
      >
        {snackMsg}
      </Snackbar>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ListRow({ icon, title, value, onPress, chevron }) {
  const colors = require('../config/tokens').colors;
  return (
    <TouchableOpacity style={styles.listRow} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.listRowIcon}>
        <MaterialCommunityIcons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={styles.listRowBody}>
        <Text style={styles.listRowTitle}>{title}</Text>
        {value ? <Text style={styles.listRowValue} numberOfLines={1}>{value}</Text> : null}
      </View>
      {chevron && (
        <MaterialCommunityIcons name="chevron-right" size={20} color="#c4b9ae" />
      )}
    </TouchableOpacity>
  );
}

function SwitchRow({ icon, iconColor, title, value, onToggle, disabled }) {
  const colors = require('../config/tokens').colors;
  return (
    <View style={[styles.switchRow, disabled && { opacity: 0.4 }]}>
      <View style={styles.switchRowLeft}>
        <View style={[styles.switchIconBox, { backgroundColor: `${iconColor}18` }]}>
          <MaterialCommunityIcons name={icon} size={18} color={iconColor} />
        </View>
        <Text style={styles.switchRowTitle}>{title}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        color={colors.primary}
        disabled={disabled}
      />
    </View>
  );
}

function PassField({ label, value, onChange, show, onToggle }) {
  const colors = require('../config/tokens').colors;
  return (
    <TextInput
      label={label}
      value={value}
      onChangeText={onChange}
      secureTextEntry={!show}
      mode="outlined"
      outlineColor="#e5e0dc"
      activeOutlineColor={colors.primary}
      style={styles.dialogInput}
      right={
        <TextInput.Icon
          icon={show ? 'eye-off' : 'eye'}
          onPress={onToggle}
          color="#9ca3af"
        />
      }
    />
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const tokens_ref = require('../config/tokens');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f1ec',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f1ec',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 32 },

  // ── Header ──
  header: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 28,
    paddingHorizontal: 24,
    backgroundColor: '#fff',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 16,
  },
  avatarWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: tokens_ref.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: tokens_ref.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2E4057',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  headerName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#171412',
    marginBottom: 4,
    textAlign: 'center',
  },
  headerEmail: {
    fontSize: 14,
    color: '#867465',
    marginBottom: 12,
    textAlign: 'center',
  },
  subPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  subPillDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  subPillText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  subPillCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: tokens_ref.colors.primary,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  subPillCTAText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  // ── Card ──
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#171412',
  },

  // ── Subscription card ──
  subInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subLabel: {
    fontSize: 13,
    color: '#867465',
  },
  subValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#171412',
  },
  subManageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(181,101,29,0.08)',
  },
  subManageBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens_ref.colors.primary,
  },
  subNone: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 14,
  },
  subSubscribeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: tokens_ref.colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
  },
  subSubscribeBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  // ── Section ──
  section: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9ca3af',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 4,
  },

  // ── List card ──
  listCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  listRowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(181,101,29,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  listRowBody: {
    flex: 1,
  },
  listRowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#171412',
  },
  listRowValue: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 1,
  },
  rowDivider: {
    marginLeft: 64,
    backgroundColor: '#f3ede8',
  },

  // ── Switch row ──
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  switchRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  switchIconBox: {
    width: 34,
    height: 34,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  switchRowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#171412',
    flex: 1,
  },

  // ── Member since ──
  memberSince: {
    fontSize: 12,
    color: '#c4b9ae',
    textAlign: 'center',
    marginBottom: 12,
  },

  // ── Logout ──
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#ef4444',
    borderRadius: 14,
    paddingVertical: 14,
  },
  logoutBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  // ── Danger zone ──
  dangerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  dangerToggleText: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  dangerCard: {
    backgroundColor: '#fff5f5',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#fca5a5',
    padding: 16,
    marginTop: 8,
  },
  dangerDesc: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
    lineHeight: 18,
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#ef4444',
    borderRadius: 10,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  dangerBtnText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },

  // ── Dialogs ──
  dialog: {
    borderRadius: 20,
    backgroundColor: '#fff',
  },
  dialogTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#171412',
  },
  dialogInput: {
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  errorBanner: {
    backgroundColor: '#fff5f5',
    marginBottom: 12,
    borderRadius: 10,
  },

  // ── Language picker ──
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
    backgroundColor: '#f9fafb',
  },
  langOptionActive: {
    backgroundColor: 'rgba(181,101,29,0.08)',
  },
  langFlag: {
    fontSize: 22,
  },
  langLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
  },
  langLabelActive: {
    fontWeight: '700',
    color: tokens_ref.colors.primary,
  },

  // ── Delete ──
  deleteWarning: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 14,
  },
  deleteInstruction: {
    fontSize: 13,
    color: '#374151',
  },
  deleteKeyword: {
    fontWeight: '700',
    color: '#ef4444',
  },

  // ── Snackbar ──
  snackSuccess: {
    backgroundColor: '#22c55e',
  },
  snackError: {
    backgroundColor: '#ef4444',
  },
});
