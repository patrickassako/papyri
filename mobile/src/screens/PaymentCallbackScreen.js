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

export default function PaymentCallbackScreen({ route, navigation }) {
  const { t } = useTranslation();
  const params = route?.params || {};
  const [status, setStatus] = useState('verifying'); // 'verifying' | 'success' | 'error' | 'cancelled'
  const [message, setMessage] = useState('');
  const didVerify = useRef(false);

  useEffect(() => {
    if (didVerify.current) return;
    didVerify.current = true;
    verify();
  }, []);

  async function verify() {
    // Params can come from deep link query string or from navigation params
    const provider = params.provider || 'flutterwave';
    const paymentStatus = String(params.status || '').toLowerCase();

    if (paymentStatus === 'cancelled') {
      await AsyncStorage.removeItem(PENDING_KEY).catch(() => {});
      setStatus('cancelled');
      return;
    }

    try {
      if (provider === 'stripe') {
        const sessionId = params.session_id;
        if (!sessionId) throw new Error(t('paymentCallback.missingSession'));
        await subscriptionService.verifyStripeSession({ sessionId });
      } else {
        // Flutterwave: tx_ref + transaction_id
        const txRef = params.tx_ref;
        const transactionId = params.transaction_id;
        if (!txRef && !transactionId) throw new Error(t('paymentCallback.missingParams'));
        await subscriptionService.verifyPayment({
          transactionId: transactionId || txRef,
          reference: txRef || transactionId,
        });
      }

      await AsyncStorage.removeItem(PENDING_KEY).catch(() => {});
      setStatus('success');
    } catch (err) {
      setMessage(err.message || t('paymentCallback.verifyFailed'));
      setStatus('error');
    }
  }

  const goToSubscription = () => {
    navigation.replace('Subscription');
  };

  if (status === 'verifying') {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={tokens.colors.primary} />
        <Text style={styles.verifyText}>{t('paymentCallback.verifying')}</Text>
      </SafeAreaView>
    );
  }

  if (status === 'success') {
    return (
      <SafeAreaView style={styles.center}>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="check-circle" size={72} color="#1F7A39" />
        </View>
        <Text style={styles.successTitle}>{t('paymentCallback.successTitle')}</Text>
        <Text style={styles.successBody}>{t('paymentCallback.successBody')}</Text>
        <TouchableOpacity style={styles.btn} onPress={goToSubscription} activeOpacity={0.8}>
          <Text style={styles.btnText}>{t('paymentCallback.viewSubscription')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (status === 'cancelled') {
    return (
      <SafeAreaView style={styles.center}>
        <MaterialCommunityIcons name="close-circle-outline" size={64} color="#8a7d73" />
        <Text style={styles.cancelTitle}>{t('paymentCallback.cancelTitle')}</Text>
        <Text style={styles.cancelBody}>{t('paymentCallback.cancelBody')}</Text>
        <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => navigation.replace('Subscription')} activeOpacity={0.8}>
          <Text style={[styles.btnText, styles.btnSecondaryText]}>{t('paymentCallback.back')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.center}>
      <MaterialCommunityIcons name="alert-circle-outline" size={64} color="#ad3f3f" />
      <Text style={styles.errorTitle}>{t('paymentCallback.errorTitle')}</Text>
      <Text style={styles.errorBody}>{message || t('paymentCallback.errorBody')}</Text>
      <TouchableOpacity style={styles.btn} onPress={verify} activeOpacity={0.8}>
        <Text style={styles.btnText}>{t('paymentCallback.retry')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.btn, styles.btnSecondary, { marginTop: 10 }]} onPress={() => navigation.replace('Subscription')} activeOpacity={0.8}>
        <Text style={[styles.btnText, styles.btnSecondaryText]}>{t('paymentCallback.back')}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F2EE', paddingHorizontal: 32 },
  iconCircle: { marginBottom: 16 },
  verifyText: { marginTop: 16, fontSize: 15, color: '#867a71' },
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
