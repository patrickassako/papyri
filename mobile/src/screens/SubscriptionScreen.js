import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Text } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { subscriptionService } from '../services/subscription.service';

const tokens = require('../config/tokens');

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatAmount(amount, currency) {
  if (!Number.isFinite(Number(amount))) return '—';
  const c = currency || 'EUR';
  return `${Number(amount).toFixed(2)} ${c}`;
}

function resolvePlanName(subscription) {
  if (!subscription) return '';
  return subscription?.plan_snapshot?.name || subscription?.planName || subscription?.plan_type || subscription?.plan || '';
}

export default function SubscriptionScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [statusPayload, setStatusPayload] = useState(null);
  const [usage, setUsage] = useState(null);
  const [payments, setPayments] = useState([]);

  const load = useCallback(async () => {
    try {
      setError('');
      const [statusResult, usageResult, paymentResult] = await Promise.all([
        subscriptionService.getMySubscriptionStatus(),
        subscriptionService.getMyUsage(),
        subscriptionService.getPaymentHistory(),
      ]);
      setStatusPayload(statusResult || null);
      setUsage(usageResult || null);
      setPayments(Array.isArray(paymentResult) ? paymentResult : []);
    } catch (e) {
      setError('Impossible de charger les données abonnement.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const subscription = statusPayload?.subscription || null;
  const hasSubscription = statusPayload?.hasSubscription === true || !!subscription;
  const isActive = statusPayload?.isActive === true || String(subscription?.status || '').toLowerCase() === 'active';

  const planName = useMemo(() => resolvePlanName(subscription), [subscription]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={tokens.colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
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
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#171412" />
          </TouchableOpacity>
          <Text style={styles.title}>Abonnement</Text>
          <View style={styles.iconBtn} />
        </View>

        <View style={styles.notice}>
          <MaterialCommunityIcons name="information-outline" size={18} color="#8a6a53" />
          <Text style={styles.noticeText}>
            Paiement indisponible sur mobile. Gestion et paiement uniquement sur l’application web.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Statut</Text>
            <View style={[styles.statusPill, isActive ? styles.statusActive : styles.statusInactive]}>
              <Text style={[styles.statusText, isActive ? styles.statusTextActive : styles.statusTextInactive]}>
                {isActive ? 'Actif' : (hasSubscription ? 'Inactif' : 'Aucun plan')}
              </Text>
            </View>
          </View>
          <View style={styles.separator} />
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Plan</Text>
            <Text style={styles.value}>{planName || '—'}</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Échéance</Text>
            <Text style={styles.value}>{formatDate(subscription?.current_period_end || subscription?.expires_at)}</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Montant</Text>
            <Text style={styles.value}>{formatAmount(subscription?.amount, subscription?.currency)}</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Places</Text>
            <Text style={styles.value}>{Number(subscription?.users_limit || 1)}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Usage du cycle</Text>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Textes débloqués</Text>
            <Text style={styles.value}>
              {Number(usage?.usage?.text_unlocked_count || 0)} / {Number(usage?.usage?.text_quota || 0)}
            </Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Audios débloqués</Text>
            <Text style={styles.value}>
              {Number(usage?.usage?.audio_unlocked_count || 0)} / {Number(usage?.usage?.audio_quota || 0)}
            </Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Bonus texte</Text>
            <Text style={styles.value}>{Number(usage?.bonuses?.text || 0)}</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Bonus audio</Text>
            <Text style={styles.value}>{Number(usage?.bonuses?.audio || 0)}</Text>
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Bonus flex</Text>
            <Text style={styles.value}>{Number(usage?.bonuses?.flex || 0)}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Historique paiements</Text>
          {payments.length === 0 ? (
            <Text style={styles.emptyText}>Aucun paiement enregistré.</Text>
          ) : (
            payments.slice(0, 10).map((payment) => (
              <View key={payment.id} style={styles.paymentRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.paymentTitle}>
                    {payment?.metadata?.payment_type === 'subscription_renewal' ? 'Renouvellement' : 'Abonnement'}
                  </Text>
                  <Text style={styles.paymentMeta}>{formatDate(payment.created_at)}</Text>
                </View>
                <Text style={styles.paymentAmount}>{formatAmount(payment.amount, payment.currency)}</Text>
              </View>
            ))
          )}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F2EE' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F2EE' },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  header: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: {
    fontFamily: 'Playfair Display',
    fontSize: 30,
    color: '#171412',
    fontWeight: '700',
  },
  notice: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F6ECDD',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  noticeText: { color: '#6e5544', flex: 1, lineHeight: 19 },
  card: {
    marginTop: 14,
    borderRadius: 16,
    backgroundColor: '#fff',
    padding: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Playfair Display',
    fontWeight: '700',
    color: '#171412',
    marginBottom: 6,
  },
  rowBetween: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  separator: {
    height: 1,
    backgroundColor: '#EEE8E2',
    marginVertical: 6,
  },
  label: { color: '#867a71', fontSize: 14 },
  value: { color: '#171412', fontSize: 14, fontWeight: '700' },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusActive: { backgroundColor: '#E8F5EB' },
  statusInactive: { backgroundColor: '#F2ECE7' },
  statusText: { fontSize: 12, fontWeight: '700' },
  statusTextActive: { color: '#1F7A39' },
  statusTextInactive: { color: '#8a7d73' },
  emptyText: { color: '#8a7d73', marginTop: 4 },
  paymentRow: {
    minHeight: 46,
    borderTopWidth: 1,
    borderTopColor: '#F0EBE6',
    paddingTop: 8,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  paymentTitle: { color: '#171412', fontWeight: '700' },
  paymentMeta: { color: '#8a7d73', fontSize: 12, marginTop: 2 },
  paymentAmount: { color: '#171412', fontWeight: '700' },
  errorText: { marginTop: 12, color: '#ad3f3f', textAlign: 'center' },
});
