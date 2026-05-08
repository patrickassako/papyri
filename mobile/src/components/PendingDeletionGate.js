import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, AppState } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { getPendingDeletionRequest, cancelDeletionRequest } from '../services/gdpr.service';
import * as authService from '../services/auth.service';

const tokens = require('../config/tokens');

/**
 * Wrap the authenticated app shell. When the user has a pending GDPR deletion
 * request, this gate shows a blocking screen with two options: cancel deletion,
 * or sign out. Otherwise renders children.
 */
export default function PendingDeletionGate({ children, isAuthenticated }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith('fr') ? 'fr-FR' : 'en-US';
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const fetchStatus = useCallback(async () => {
    if (!isAuthenticated) {
      setPending(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await getPendingDeletionRequest();
      setPending(result);
    } catch (_) {
      setPending(null);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchStatus();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') fetchStatus();
    });
    return () => sub.remove();
  }, [fetchStatus]);

  const handleCancel = async () => {
    setBusy(true);
    setError('');
    try {
      await cancelDeletionRequest();
      setPending(null);
    } catch (err) {
      setError(err?.message || t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    try { await authService.logout(); } catch (_) {}
    // Auth-lost listener in App.js resets navigation to Login.
  };

  // While loading, render the children — if a pending request is found we'll
  // overlay them on next render. No full-screen loader to avoid a flash.
  if (loading || !pending) return children;

  const deadline = pending.deadline_at
    ? new Date(pending.deadline_at).toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' })
    : null;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.center}>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="alert-circle-outline" size={36} color="#dc2626" />
        </View>
        <Text style={styles.title}>
          {t('deletionGate.title', { defaultValue: 'Suppression du compte en cours' })}
        </Text>
        <Text style={styles.body}>
          {t('deletionGate.body', {
            defaultValue: 'Vous avez demandé la suppression de votre compte. L\'application est temporairement indisponible.',
          })}
        </Text>
        {deadline ? (
          <Text style={styles.deadline}>
            {t('deletionGate.deadline', { date: deadline, defaultValue: `Suppression définitive prévue le ${deadline}.` })}
          </Text>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <MaterialCommunityIcons name="alert-outline" size={16} color="#c0392b" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.btn, styles.btnPrimary, busy && styles.btnDisabled]}
          onPress={handleCancel}
          disabled={busy}
          activeOpacity={0.8}
        >
          {busy
            ? <ActivityIndicator size="small" color="#fff" />
            : <MaterialCommunityIcons name="restore" size={18} color="#fff" />}
          <Text style={styles.btnPrimaryText}>
            {t('deletionGate.cancelDeletion', { defaultValue: 'Annuler la suppression' })}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.btnSecondary]}
          onPress={handleLogout}
          disabled={busy}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="logout" size={18} color="#c0392b" />
          <Text style={styles.btnSecondaryText}>
            {t('deletionGate.logout', { defaultValue: 'Se déconnecter' })}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fdf6ec' },
  container: { flex: 1, backgroundColor: '#fdf6ec' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  iconCircle: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: '#fff5e6',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    fontFamily: 'Playfair Display',
    fontSize: 22, fontWeight: '700',
    color: '#1c160d', textAlign: 'center', marginBottom: 10,
  },
  body: {
    fontSize: 14, color: '#5f513d',
    textAlign: 'center', lineHeight: 21, marginBottom: 8,
  },
  deadline: {
    fontSize: 13, color: '#9c7e49',
    textAlign: 'center', fontWeight: '700', marginBottom: 24,
  },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fdf0ef', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    marginBottom: 14, alignSelf: 'stretch',
  },
  errorText: { color: '#c0392b', fontSize: 13, flex: 1 },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    width: '100%', height: 50, borderRadius: 14,
    marginTop: 10,
  },
  btnDisabled: { opacity: 0.6 },
  btnPrimary: { backgroundColor: '#1F7A39' },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5, borderColor: '#c0392b',
  },
  btnSecondaryText: { color: '#c0392b', fontWeight: '700', fontSize: 15 },
});
