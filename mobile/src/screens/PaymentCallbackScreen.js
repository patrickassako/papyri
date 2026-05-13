import React, { useEffect, useRef, useState } from 'react';
import {
  View, StyleSheet, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { subscriptionService } from '../services/subscription.service';
import { useTranslation } from 'react-i18next';

const tokens = require('../config/tokens');
const PENDING_KEY = '@papyri_pending_payment';

// USSD polling: Mobile Money LIVE waits for user to confirm by USSD.
// We poll every 6s for up to 3 minutes (30 attempts).
const POLL_INTERVAL_MS = 6000;
const POLL_MAX_ATTEMPTS = 30;

export default function PaymentCallbackScreen({ route, navigation }) {
  const { t } = useTranslation();
  const params = route?.params || {};
  // 'verifying' | 'pending_ussd' | 'success' | 'error' | 'cancelled'
  const [status, setStatus] = useState('verifying');
  const [message, setMessage] = useState('');
  const [pendingMeta, setPendingMeta] = useState(null); // { origin, kind, contentId, ... }
  const [pollAttempt, setPollAttempt] = useState(0);
  const didVerify = useRef(false);
  const pollTimer = useRef(null);

  useEffect(() => {
    if (didVerify.current) return;
    didVerify.current = true;
    bootstrap();
    return () => { if (pollTimer.current) clearTimeout(pollTimer.current); };
  }, []);

  async function loadPendingMeta() {
    try {
      const raw = await AsyncStorage.getItem(PENDING_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      setPendingMeta(parsed);
      return parsed;
    } catch (_) { return null; }
  }

  async function bootstrap() {
    await loadPendingMeta();
    verify(0);
  }

  function navigateToOrigin() {
    const screen = pendingMeta?.origin?.screen;
    const originParams = pendingMeta?.origin?.params || {};
    if (screen) {
      navigation.replace(screen, originParams);
    } else {
      navigation.replace('Subscription');
    }
  }

  async function verify(attempt) {
    const provider = params.provider || pendingMeta?.provider || 'flutterwave';
    const paymentStatus = String(params.status || '').toLowerCase();

    if (paymentStatus === 'cancelled' && attempt === 0) {
      await AsyncStorage.removeItem(PENDING_KEY).catch(() => {});
      setStatus('cancelled');
      return;
    }

    try {
      let verifyResult = null;
      if (provider === 'stripe') {
        const sessionId = params.session_id;
        if (!sessionId) throw new Error(t('paymentCallback.missingSession'));
        verifyResult = await subscriptionService.verifyStripeSession({ sessionId });
      } else {
        // Flutterwave: tx_ref + transaction_id (fallback to PENDING_KEY)
        const txRef = params.tx_ref || pendingMeta?.tx_ref || pendingMeta?.reference;
        const transactionId = params.transaction_id || pendingMeta?.transaction_id || pendingMeta?.reference;
        if (!txRef && !transactionId) throw new Error(t('paymentCallback.missingParams'));
        verifyResult = await subscriptionService.verifyPayment({
          transactionId: transactionId || txRef,
          reference: txRef || transactionId,
        });
      }

      // ── Mobile Money USSD pending: keep polling ──
      if (verifyResult?.status === 'pending') {
        if (attempt < POLL_MAX_ATTEMPTS) {
          setStatus('pending_ussd');
          setPollAttempt(attempt + 1);
          pollTimer.current = setTimeout(() => verify(attempt + 1), POLL_INTERVAL_MS);
          return;
        }
        // Stop polling — leave the user with a "we'll notify you" screen.
        setStatus('pending_ussd');
        setMessage(t('paymentCallback.ussdTimeout', 'Le paiement est toujours en cours. Vous serez notifié à la confirmation.'));
        return;
      }

      await AsyncStorage.removeItem(PENDING_KEY).catch(() => {});

      // Content unlock → jump back to the book detail
      if (verifyResult?.type === 'content_unlock' && verifyResult.contentId) {
        navigation.replace('ContentDetail', { contentId: verifyResult.contentId });
        return;
      }

      setStatus('success');
    } catch (err) {
      setMessage(err.message || t('paymentCallback.verifyFailed'));
      setStatus('error');
    }
  }

  // ── verifying ──
  if (status === 'verifying') {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={tokens.colors.primary} />
        <Text style={styles.verifyText}>{t('paymentCallback.verifying')}</Text>
      </SafeAreaView>
    );
  }

  // ── pending_ussd (Mobile Money waiting for USSD confirm) ──
  if (status === 'pending_ussd') {
    const stopped = pollAttempt >= POLL_MAX_ATTEMPTS;
    return (
      <SafeAreaView style={styles.center}>
        <MaterialCommunityIcons name="cellphone-message" size={64} color={tokens.colors.primary} />
        <Text style={styles.successTitle}>
          {t('paymentCallback.ussdTitle', 'Confirmez sur votre téléphone')}
        </Text>
        <Text style={styles.successBody}>
          {stopped
            ? (message || t('paymentCallback.ussdTimeout', 'Le paiement est toujours en cours. Vous serez notifié à la confirmation.'))
            : t('paymentCallback.ussdBody', 'Composez le code USSD reçu par SMS et validez avec votre code Mobile Money. Le paiement se confirmera automatiquement.')}
        </Text>
        {!stopped && (
          <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ActivityIndicator size="small" color={tokens.colors.primary} />
            <Text style={styles.pollText}>
              {t('paymentCallback.ussdPolling', 'Vérification…')} {pollAttempt}/{POLL_MAX_ATTEMPTS}
            </Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.btn, styles.btnSecondary, { marginTop: 24 }]}
          onPress={() => {
            if (pollTimer.current) clearTimeout(pollTimer.current);
            navigateToOrigin();
          }}
          activeOpacity={0.8}
        >
          <Text style={[styles.btnText, styles.btnSecondaryText]}>
            {t('paymentCallback.back')}
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── success ──
  if (status === 'success') {
    return (
      <SafeAreaView style={styles.center}>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="check-circle" size={72} color="#1F7A39" />
        </View>
        <Text style={styles.successTitle}>{t('paymentCallback.successTitle')}</Text>
        <Text style={styles.successBody}>{t('paymentCallback.successBody')}</Text>
        <TouchableOpacity
          style={styles.btn}
          onPress={() => navigation.replace('Subscription')}
          activeOpacity={0.8}
        >
          <Text style={styles.btnText}>{t('paymentCallback.viewSubscription')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── cancelled ──
  if (status === 'cancelled') {
    return (
      <SafeAreaView style={styles.center}>
        <MaterialCommunityIcons name="close-circle-outline" size={64} color="#8a7d73" />
        <Text style={styles.cancelTitle}>{t('paymentCallback.cancelTitle')}</Text>
        <Text style={styles.cancelBody}>{t('paymentCallback.cancelBody')}</Text>
        <TouchableOpacity
          style={[styles.btn, styles.btnSecondary]}
          onPress={navigateToOrigin}
          activeOpacity={0.8}
        >
          <Text style={[styles.btnText, styles.btnSecondaryText]}>{t('paymentCallback.back')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── error ──
  return (
    <SafeAreaView style={styles.center}>
      <MaterialCommunityIcons name="alert-circle-outline" size={64} color="#ad3f3f" />
      <Text style={styles.errorTitle}>{t('paymentCallback.errorTitle')}</Text>
      <Text style={styles.errorBody}>{message || t('paymentCallback.errorBody')}</Text>
      <TouchableOpacity style={styles.btn} onPress={() => verify(0)} activeOpacity={0.8}>
        <Text style={styles.btnText}>{t('paymentCallback.retry')}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.btn, styles.btnSecondary, { marginTop: 10 }]}
        onPress={navigateToOrigin}
        activeOpacity={0.8}
      >
        <Text style={[styles.btnText, styles.btnSecondaryText]}>{t('paymentCallback.back')}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F2EE', paddingHorizontal: 32 },
  iconCircle: { marginBottom: 16 },
  verifyText: { marginTop: 16, fontSize: 15, color: '#867a71' },
  pollText: { fontSize: 13, color: '#867a71' },
  successTitle: { fontSize: 26, fontWeight: '800', color: '#1F7A39', textAlign: 'center', marginTop: 8 },
  successBody: { fontSize: 14, color: '#6e5544', textAlign: 'center', marginTop: 8, lineHeight: 21, marginBottom: 28 },
  cancelTitle: { fontSize: 22, fontWeight: '700', color: '#4a4440', textAlign: 'center', marginTop: 12 },
  cancelBody: { fontSize: 14, color: '#8a7d73', textAlign: 'center', marginTop: 8, lineHeight: 21, marginBottom: 28 },
  errorTitle: { fontSize: 22, fontWeight: '700', color: '#ad3f3f', textAlign: 'center', marginTop: 12 },
  errorBody: { fontSize: 13, color: '#8a7d73', textAlign: 'center', marginTop: 8, lineHeight: 20, marginBottom: 24 },
  btn: {
    height: 50, borderRadius: 14, backgroundColor: tokens.colors.primary,
    paddingHorizontal: 32, alignItems: 'center', justifyContent: 'center', width: '100%',
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnSecondary: { backgroundColor: '#EDE8E2' },
  btnSecondaryText: { color: '#4a4440' },
});
