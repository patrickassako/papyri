import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { subscriptionService } from '../services/subscription.service';
import API_BASE_URL from '../config/api';

const tokens = require('../config/tokens');

const IS_IOS = Platform.OS === 'ios';

/* ─── Helpers ─────────────────────────────────────────────────── */
function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatAmount(amount, currency) {
  if (!Number.isFinite(Number(amount))) return '—';
  return `${Number(amount).toFixed(2)} ${currency || 'EUR'}`;
}

function resolvePlanName(subscription) {
  if (!subscription) return '';
  return subscription?.plan_snapshot?.name || subscription?.planName || subscription?.plan_type || subscription?.plan || '';
}

/* ─── Composant iOS uniquement ────────────────────────────────── */
function IosNotice() {
  return (
    <View style={styles.iosNotice}>
      <MaterialCommunityIcons name="crown-outline" size={28} color="#8a6a53" />
      <Text style={styles.iosNoticeTitle}>Gérez votre abonnement</Text>
      <Text style={styles.iosNoticeBody}>
        La souscription et la gestion de votre abonnement s'effectuent depuis notre site web.
      </Text>
      <TouchableOpacity
        style={styles.iosWebBtn}
        onPress={() => Linking.openURL('https://papyri.app')}
      >
        <MaterialCommunityIcons name="web" size={18} color="#fff" />
        <Text style={styles.iosWebBtnText}>Accéder au site web</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ─── Plan card Android ───────────────────────────────────────── */
function PlanCard({ plan, selected, onSelect }) {
  const isYearly = String(plan.slug || plan.code || '').includes('year') ||
    String(plan.name || '').toLowerCase().includes('annuel');
  const priceDisplay = `${Number(plan.price).toFixed(2)} ${plan.currency || 'EUR'}`;
  const periodLabel = isYearly ? '/ an' : '/ mois';

  return (
    <TouchableOpacity
      style={[styles.planCard, selected && styles.planCardSelected]}
      onPress={() => onSelect(plan)}
      activeOpacity={0.8}
    >
      {isYearly && (
        <View style={styles.planBadge}>
          <Text style={styles.planBadgeText}>MEILLEURE OFFRE</Text>
        </View>
      )}
      <View style={styles.planCardRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.planName, selected && styles.planNameSelected]}>{plan.name}</Text>
          {plan.description ? (
            <Text style={styles.planDesc} numberOfLines={2}>{plan.description}</Text>
          ) : null}
        </View>
        <View style={styles.planPriceBlock}>
          <Text style={[styles.planPrice, selected && styles.planPriceSelected]}>{priceDisplay}</Text>
          <Text style={styles.planPeriod}>{periodLabel}</Text>
        </View>
      </View>
      <View style={[styles.planRadio, selected && styles.planRadioSelected]}>
        {selected && <View style={styles.planRadioDot} />}
      </View>
    </TouchableOpacity>
  );
}

/* ─── Ecran principal ─────────────────────────────────────────── */
export default function SubscriptionScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [statusPayload, setStatusPayload] = useState(null);
  const [usage, setUsage] = useState(null);
  const [payments, setPayments] = useState([]);

  // Android only
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoResult, setPromoResult] = useState(null);
  const [promoError, setPromoError] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      const fetches = [
        subscriptionService.getMySubscriptionStatus(),
        subscriptionService.getMyUsage(),
        subscriptionService.getPaymentHistory(),
      ];
      // Plans seulement sur Android
      if (!IS_IOS) {
        fetches.push(
          fetch(`${API_BASE_URL}/api/subscriptions/plans`)
            .then((r) => r.json())
            .then((d) => d?.data || d?.plans || [])
            .catch(() => [])
        );
      }
      const [statusResult, usageResult, paymentResult, plansResult] = await Promise.all(fetches);
      setStatusPayload(statusResult || null);
      setUsage(usageResult || null);
      setPayments(Array.isArray(paymentResult) ? paymentResult : []);
      if (!IS_IOS && Array.isArray(plansResult)) {
        setPlans(plansResult);
        if (plansResult.length > 0 && !selectedPlan) {
          // Sélectionner mensuel par défaut
          const monthly = plansResult.find((p) =>
            !String(p.slug || p.code || '').includes('year') &&
            !String(p.name || '').toLowerCase().includes('annuel')
          );
          setSelectedPlan(monthly || plansResult[0]);
        }
      }
    } catch (e) {
      setError('Impossible de charger les données abonnement.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const subscription = statusPayload?.subscription || null;
  const hasSubscription = statusPayload?.hasSubscription === true || !!subscription;
  const isActive = statusPayload?.isActive === true || String(subscription?.status || '').toLowerCase() === 'active';
  const planName = useMemo(() => resolvePlanName(subscription), [subscription]);

  /* ── Validation code promo (Android) ─────────────────────────── */
  const handleValidatePromo = useCallback(async () => {
    if (!promoCode.trim() || !selectedPlan) return;
    setPromoLoading(true);
    setPromoError('');
    setPromoResult(null);
    try {
      const result = await subscriptionService.validatePromoCode({
        code: promoCode.trim(),
        planId: selectedPlan.id,
        planCode: selectedPlan.slug || selectedPlan.code,
        usersLimit: 1,
      });
      setPromoResult(result);
    } catch (err) {
      setPromoError(err.message || 'Code promo invalide.');
    } finally {
      setPromoLoading(false);
    }
  }, [promoCode, selectedPlan]);

  /* ── Checkout Flutterwave (Android) ───────────────────────────── */
  const handleCheckout = useCallback(async () => {
    if (!selectedPlan) return;
    setCheckoutLoading(true);
    setError('');
    try {
      const result = await subscriptionService.checkout({
        planId: selectedPlan.id,
        planCode: selectedPlan.slug || selectedPlan.code,
        usersLimit: 1,
        provider: 'flutterwave',
        promoCode: promoResult ? promoCode.trim() : undefined,
      });
      const url = result?.paymentLink || result?.data?.paymentLink;
      if (url) {
        await Linking.openURL(url);
      } else {
        setError('Lien de paiement non disponible. Réessayez.');
      }
    } catch (err) {
      setError(err.message || 'Erreur lors du paiement.');
    } finally {
      setCheckoutLoading(false);
    }
  }, [selectedPlan, promoResult, promoCode]);

  /* ── Prix affiché après promo ─────────────────────────────────── */
  const displayPrice = useMemo(() => {
    if (!selectedPlan) return null;
    if (promoResult) {
      const final = (promoResult.finalAmountCents / 100).toFixed(2);
      const orig = (promoResult.originalAmountCents / 100).toFixed(2);
      return { final, orig, currency: selectedPlan.currency || 'EUR' };
    }
    return { final: Number(selectedPlan.price).toFixed(2), orig: null, currency: selectedPlan.currency || 'EUR' };
  }, [selectedPlan, promoResult]);

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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[tokens.colors.primary]} />
        )}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#171412" />
          </TouchableOpacity>
          <Text style={styles.title}>Abonnement</Text>
          <View style={styles.iconBtn} />
        </View>

        {/* iOS : message redirection web */}
        {IS_IOS && <IosNotice />}

        {/* Statut abonnement actuel */}
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

        {/* Usage */}
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
        </View>

        {/* ── Android uniquement : choix de plan + paiement ─────── */}
        {!IS_IOS && plans.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {isActive ? 'Changer de plan' : 'Choisir un plan'}
            </Text>
            <Text style={styles.androidSubtitle}>Paiement via Mobile Money (Flutterwave)</Text>

            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                selected={selectedPlan?.id === plan.id}
                onSelect={(p) => {
                  setSelectedPlan(p);
                  setPromoResult(null);
                  setPromoError('');
                }}
              />
            ))}

            {/* Champ code promo */}
            <View style={styles.promoRow}>
              <TextInput
                style={styles.promoInput}
                placeholder="Code promo (ex: BIENVENUE)"
                placeholderTextColor="#b0a090"
                value={promoCode}
                onChangeText={(v) => {
                  setPromoCode(v);
                  setPromoResult(null);
                  setPromoError('');
                }}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={[styles.promoBtn, (!promoCode.trim() || promoLoading) && styles.promoBtnDisabled]}
                onPress={handleValidatePromo}
                disabled={!promoCode.trim() || promoLoading}
              >
                {promoLoading
                  ? <ActivityIndicator size={14} color="#fff" />
                  : <Text style={styles.promoBtnText}>Appliquer</Text>
                }
              </TouchableOpacity>
            </View>

            {/* Résultat promo */}
            {promoResult && (
              <View style={styles.promoSuccess}>
                <MaterialCommunityIcons name="check-circle" size={16} color="#1F7A39" />
                <Text style={styles.promoSuccessText}>
                  Code «{promoResult.code}» : {promoResult.discountType === 'percent'
                    ? `-${promoResult.discountValue}%`
                    : `-${(promoResult.discountCents / 100).toFixed(2)} €`}
                </Text>
              </View>
            )}
            {promoError ? (
              <Text style={styles.promoErrorText}>{promoError}</Text>
            ) : null}

            {/* Récapitulatif prix */}
            {displayPrice && (
              <View style={styles.priceSummary}>
                {displayPrice.orig && (
                  <Text style={styles.priceOrig}>{displayPrice.orig} {displayPrice.currency}</Text>
                )}
                <Text style={styles.priceFinal}>{displayPrice.final} {displayPrice.currency}</Text>
              </View>
            )}

            {/* Bouton payer */}
            <TouchableOpacity
              style={[styles.payBtn, (!selectedPlan || checkoutLoading) && styles.payBtnDisabled]}
              onPress={handleCheckout}
              disabled={!selectedPlan || checkoutLoading}
              activeOpacity={0.85}
            >
              {checkoutLoading ? (
                <ActivityIndicator size={18} color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="cellphone" size={20} color="#fff" />
                  <Text style={styles.payBtnText}>Payer via Mobile Money</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Historique paiements */}
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
  content: { paddingHorizontal: 20, paddingBottom: 40 },
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

  // iOS notice
  iosNotice: {
    marginTop: 16,
    backgroundColor: '#FBF4EB',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#EFE0CB',
  },
  iosNoticeTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#3d2b1a',
    textAlign: 'center',
  },
  iosNoticeBody: {
    fontSize: 14,
    color: '#6e5544',
    textAlign: 'center',
    lineHeight: 21,
  },
  iosWebBtn: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: tokens.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
  },
  iosWebBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },


  // Cards
  card: {
    marginTop: 14,
    borderRadius: 16,
    backgroundColor: '#fff',
    padding: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Playfair Display',
    fontWeight: '700',
    color: '#171412',
    marginBottom: 8,
  },
  androidSubtitle: {
    fontSize: 12,
    color: '#9c7e49',
    marginBottom: 12,
    marginTop: -4,
  },
  rowBetween: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  separator: { height: 1, backgroundColor: '#EEE8E2', marginVertical: 6 },
  label: { color: '#867a71', fontSize: 14 },
  value: { color: '#171412', fontSize: 14, fontWeight: '700' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
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

  // Plan cards
  planCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E8DDD4',
    padding: 14,
    marginBottom: 10,
    position: 'relative',
    overflow: 'hidden',
  },
  planCardSelected: {
    borderColor: tokens.colors.primary,
    backgroundColor: `${tokens.colors.primary}08`,
  },
  planBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: tokens.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderBottomLeftRadius: 10,
  },
  planBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  planCardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  planName: { fontSize: 15, fontWeight: '700', color: '#171412' },
  planNameSelected: { color: tokens.colors.primary },
  planDesc: { fontSize: 12, color: '#8a7d73', marginTop: 2, lineHeight: 17 },
  planPriceBlock: { alignItems: 'flex-end' },
  planPrice: { fontSize: 18, fontWeight: '800', color: '#171412' },
  planPriceSelected: { color: tokens.colors.primary },
  planPeriod: { fontSize: 11, color: '#8a7d73', marginTop: 1 },
  planRadio: {
    position: 'absolute',
    bottom: 12,
    right: 14,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#C9B8A8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planRadioSelected: { borderColor: tokens.colors.primary },
  planRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: tokens.colors.primary },

  // Promo
  promoRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    marginBottom: 4,
  },
  promoInput: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E8DDD4',
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#171412',
    backgroundColor: '#FAFAF8',
  },
  promoBtn: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: tokens.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoBtnDisabled: { opacity: 0.45 },
  promoBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  promoSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    marginBottom: 2,
  },
  promoSuccessText: { color: '#1F7A39', fontSize: 13, fontWeight: '600' },
  promoErrorText: { color: '#ad3f3f', fontSize: 13, marginTop: 4, marginBottom: 2 },

  // Prix final
  priceSummary: {
    alignItems: 'flex-end',
    marginTop: 10,
    marginBottom: 4,
    gap: 2,
  },
  priceOrig: {
    fontSize: 13,
    color: '#9c7e49',
    textDecorationLine: 'line-through',
  },
  priceFinal: {
    fontSize: 22,
    fontWeight: '800',
    color: tokens.colors.primary,
  },

  // Bouton payer
  payBtn: {
    marginTop: 12,
    height: 52,
    borderRadius: 14,
    backgroundColor: tokens.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  payBtnDisabled: { opacity: 0.45 },
  payBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
