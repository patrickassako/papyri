import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  Linking,
  AppState,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { subscriptionService } from '../services/subscription.service';

const tokens = require('../config/tokens');
const PENDING_KEY = '@papyri_pending_payment';

/* ─── Helpers ─────────────────────────────────────────────────── */
function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatAmount(amount, currency) {
  if (!Number.isFinite(Number(amount))) return '—';
  return `${Number(amount).toFixed(2)} ${currency || 'EUR'}`;
}

function resolvePlanName(subscription) {
  if (!subscription) return '';
  return subscription?.plan_snapshot?.name || subscription?.planName || subscription?.plan_type || subscription?.plan || '';
}

function formatMoney(cents, currency) {
  const amount = Number(cents || 0) / 100;
  return `${amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2)} ${currency || 'EUR'}`;
}

function formatPlanPrice(plan, extraProfiles = 0) {
  const baseCents = plan.localizedPriceCents != null ? plan.localizedPriceCents : (plan.basePriceCents || 0);
  const extraCents = plan.localizedExtraProfilePriceCents != null
    ? plan.localizedExtraProfilePriceCents
    : (plan.extraProfilePriceCents != null ? plan.extraProfilePriceCents : (plan.extraUserPriceCents || 0));
  const currency = plan.localizedCurrency || plan.currency || 'EUR';
  const totalCents = baseCents + Math.max(0, extraProfiles) * extraCents;
  return formatMoney(totalCents, currency);
}

function isYearlyPlan(plan) {
  const slug = String(plan.slug || '').toLowerCase();
  const cycle = String(plan?.metadata?.billing_cycle || '').toLowerCase();
  if (cycle === 'annual' || cycle === 'yearly') return true;
  return Number(plan.durationDays || 30) >= 365 || slug.includes('annual') || slug.includes('yearly') || slug.includes('annuel');
}

function isFamilyPlan(plan) {
  return Number(plan.includedUsers || 1) > 1;
}

/* ─── Plan card ───────────────────────────────────────────────── */
function PlanCard({ plan, selected, profilesCount, onSelect, onProfilesChange }) {
  const yearly = isYearlyPlan(plan);
  const family = isFamilyPlan(plan);
  const minProfiles = Number(plan.includedUsers || 1);
  const maxProfiles = Number(plan.maxProfiles || minProfiles);
  const extraProfiles = family ? Math.max(0, profilesCount - minProfiles) : 0;
  const creditsTotal = Number(plan.creditsPerCycle || 0) * Math.max(profilesCount, minProfiles);
  const lifetime = Boolean(plan.creditsGrantLifetimeAccess);

  return (
    <TouchableOpacity
      style={[styles.planCard, selected && styles.planCardSelected]}
      onPress={() => onSelect(plan)}
      activeOpacity={0.8}
    >
      {yearly && (
        <View style={styles.planBadge}>
          <Text style={styles.planBadgeText}>-20% / AN</Text>
        </View>
      )}
      <View style={styles.planCardRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.planName, selected && styles.planNameSelected]}>{plan.name}</Text>
          {plan.description ? (
            <Text style={styles.planDesc} numberOfLines={3}>{plan.description}</Text>
          ) : null}
        </View>
        <View style={styles.planPriceBlock}>
          <Text style={[styles.planPrice, selected && styles.planPriceSelected]}>{formatPlanPrice(plan, extraProfiles)}</Text>
          <Text style={styles.planPeriod}>{yearly ? '/ an' : '/ mois'}</Text>
        </View>
      </View>

      {/* Bullets */}
      <View style={styles.planBullets}>
        <Text style={styles.planBullet}>· Catalogue premium illimité</Text>
        <Text style={styles.planBullet}>· Téléchargement hors-ligne</Text>
        {creditsTotal > 0 ? (
          <Text style={styles.planBullet}>
            · {creditsTotal} crédit{creditsTotal > 1 ? 's' : ''} / 12 mois — {lifetime ? 'accès à vie' : 'accès tant qu\'abonné'}
          </Text>
        ) : null}
        <Text style={styles.planBullet}>· {plan.discountPercentPaidBooks || 30}% sur les livres payants</Text>
      </View>

      {/* Family profile selector */}
      {family && selected && maxProfiles > minProfiles ? (
        <View style={styles.profileSelector}>
          <Text style={styles.profileSelectorLabel}>Profils ({profilesCount} / {maxProfiles})</Text>
          <View style={styles.profileSelectorRow}>
            <TouchableOpacity
              style={[styles.profileBtn, profilesCount <= minProfiles && styles.profileBtnDisabled]}
              onPress={() => profilesCount > minProfiles && onProfilesChange(profilesCount - 1)}
              disabled={profilesCount <= minProfiles}
            >
              <MaterialCommunityIcons name="minus" size={18} color={profilesCount <= minProfiles ? '#c8c4c0' : tokens.colors.primary} />
            </TouchableOpacity>
            <Text style={styles.profileCount}>{profilesCount}</Text>
            <TouchableOpacity
              style={[styles.profileBtn, profilesCount >= maxProfiles && styles.profileBtnDisabled]}
              onPress={() => profilesCount < maxProfiles && onProfilesChange(profilesCount + 1)}
              disabled={profilesCount >= maxProfiles}
            >
              <MaterialCommunityIcons name="plus" size={18} color={profilesCount >= maxProfiles ? '#c8c4c0' : tokens.colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <View style={[styles.planRadio, selected && styles.planRadioSelected]}>
        {selected && <View style={styles.planRadioDot} />}
      </View>
    </TouchableOpacity>
  );
}

/* ─── Écran principal ─────────────────────────────────────────── */
export default function SubscriptionScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Subscription status
  const [statusPayload, setStatusPayload] = useState(null);
  const [usage, setUsage] = useState(null);
  const [payments, setPayments] = useState([]);

  // Plans
  const [plans, setPlans] = useState([]);
  const [geo, setGeo] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [profilesCount, setProfilesCount] = useState(1);

  // Payment modal
  const [modalVisible, setModalVisible] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoResult, setPromoResult] = useState(null);
  const [promoError, setPromoError] = useState('');
  const [checkoutBusy, setCheckoutBusy] = useState(''); // provider being loaded

  // Pending payment resume (AppState)
  const appStateRef = useRef(AppState.currentState);
  const pendingPaymentRef = useRef(null);

  /* ── Data loading ── */
  const load = useCallback(async () => {
    try {
      setError('');
      const [statusResult, usageResult, paymentResult, plansResult] = await Promise.all([
        subscriptionService.getMySubscriptionStatus(),
        subscriptionService.getMyUsage(),
        subscriptionService.getPaymentHistory(),
        subscriptionService.getPlans().catch(() => ({ plans: [] })),
      ]);
      setStatusPayload(statusResult || null);
      setUsage(usageResult || null);
      setPayments(Array.isArray(paymentResult) ? paymentResult : []);
      setPlans(Array.isArray(plansResult.plans) ? plansResult.plans : []);
      setGeo(plansResult.geo || null);
    } catch (e) {
      setError('Impossible de charger les données abonnement.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  /* ── AppState: detect return from browser → navigate to callback screen ── */
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      // App came back to foreground from background/inactive
      if (nextState === 'active' && (prev === 'background' || prev === 'inactive')) {
        try {
          const raw = await AsyncStorage.getItem(PENDING_KEY);
          if (!raw) return;
          const pending = JSON.parse(raw);
          pendingPaymentRef.current = pending;
          // Navigate to callback screen which will verify + show result
          navigation.navigate('PaymentCallback', pending);
        } catch (_) {}
      }
    });
    return () => sub.remove();
  }, [navigation]);

  /* ── Promo validation ── */
  const handleValidatePromo = async () => {
    const code = promoCode.trim().toUpperCase();
    if (!code || !selectedPlan) return;
    setPromoLoading(true);
    setPromoError('');
    setPromoResult(null);
    try {
      const result = await subscriptionService.validatePromoCode({
        code,
        planId: selectedPlan.id,
        usersLimit: Math.max(profilesCount, Number(selectedPlan.includedUsers || 1)),
      });
      setPromoResult(result);
    } catch (err) {
      setPromoError(err.message || 'Code promo invalide.');
    } finally {
      setPromoLoading(false);
    }
  };

  /* ── Checkout ── */
  const doCheckout = async (provider) => {
    if (!selectedPlan) return;
    setCheckoutBusy(provider);
    try {
      const response = await subscriptionService.checkout({
        planId: selectedPlan.id,
        usersLimit: Math.max(profilesCount, Number(selectedPlan.includedUsers || 1)),
        provider,
        promoCode: promoResult ? promoCode.trim().toUpperCase() : undefined,
      });

      if (!response.paymentLink) throw new Error('Lien de paiement introuvable.');

      // Store pending payment so AppState listener can resume verification
      const pending = {
        provider,
        reference: response.reference || null,
        planId: selectedPlan.id,
        planName: selectedPlan.name,
      };
      await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(pending));

      setModalVisible(false);
      setPromoCode('');
      setPromoResult(null);
      setPromoError('');

      // Open payment in browser
      await Linking.openURL(response.paymentLink);
    } catch (err) {
      setError(err.message || 'Erreur de paiement. Réessayez.');
    } finally {
      setCheckoutBusy('');
    }
  };

  /* ── Derived state ── */
  const subscription = statusPayload?.subscription || null;
  const hasSubscription = statusPayload?.hasSubscription === true || !!subscription;
  const isActive = statusPayload?.isActive === true || String(subscription?.status || '').toLowerCase() === 'active';
  const planName = useMemo(() => resolvePlanName(subscription), [subscription]);

  // Show plans when no active subscription; also filter out already-subscribed plan
  const availablePlans = useMemo(() => plans.filter((p) => {
    if (!isActive) return true;
    const currentSlug = String(subscription?.plan_type || '').toLowerCase();
    return !p.slug?.includes(currentSlug);
  }), [plans, isActive, subscription]);

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

        {/* Statut */}
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

        {/* Crédits */}
        {hasSubscription ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Mes crédits</Text>
            <View style={styles.rowBetween}>
              <Text style={styles.label}>Crédits restants</Text>
              <Text style={styles.value}>
                {Number(usage?.bonusAvailableTotal || usage?.bonus_available_total || 0)}
              </Text>
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.label}>Catalogue premium</Text>
              <Text style={styles.value}>Illimité</Text>
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.label}>Réduction livres payants</Text>
              <Text style={styles.value}>{Number(subscription?.plan_snapshot?.discountPercentPaidBooks || 30)}%</Text>
            </View>
            <Text style={styles.creditHint}>
              {subscription?.plan_snapshot?.creditsGrantLifetimeAccess
                ? 'Chaque crédit utilisé donne un accès à vie au livre choisi.'
                : 'Chaque crédit utilisé donne accès au livre tant que votre abonnement est actif.'}
            </Text>
          </View>
        ) : null}

        {/* Plans disponibles */}
        {availablePlans.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{isActive ? 'Changer de plan' : 'Choisir un plan'}</Text>
            <Text style={styles.androidSubtitle}>Paiement sécurisé via Stripe ou Mobile Money</Text>
            {geo?.currency && geo.currency !== 'EUR' ? (
              <View style={styles.geoRow}>
                <MaterialCommunityIcons name="map-marker-outline" size={13} color="#9c7e49" />
                <Text style={styles.geoText}>
                  Prix affichés en {geo.currency}
                  {geo.country ? ` · ${geo.country}` : ''}
                </Text>
              </View>
            ) : null}

            {availablePlans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                selected={selectedPlan?.id === plan.id}
                profilesCount={selectedPlan?.id === plan.id ? profilesCount : Number(plan.includedUsers || 1)}
                onSelect={(p) => {
                  setSelectedPlan(p);
                  setProfilesCount(Number(p.includedUsers || 1));
                }}
                onProfilesChange={setProfilesCount}
              />
            ))}

            <TouchableOpacity
              style={[styles.payBtn, !selectedPlan && styles.payBtnDisabled]}
              onPress={() => selectedPlan && setModalVisible(true)}
              disabled={!selectedPlan}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="credit-card-outline" size={20} color="#fff" />
              <Text style={styles.payBtnText}>
                {selectedPlan
                  ? `Payer ${formatPlanPrice(selectedPlan, Math.max(0, profilesCount - Number(selectedPlan.includedUsers || 1)))}`
                  : 'Sélectionnez un plan'}
              </Text>
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

      {/* ── Modal choix mode de paiement ── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => !checkoutBusy && setModalVisible(false)} />

          <View style={styles.modalSheet}>
            {/* Poignée */}
            <View style={styles.sheetHandle} />

            <Text style={styles.modalTitle}>Mode de paiement</Text>
            {selectedPlan ? (
              <Text style={styles.modalSubtitle}>
                Plan {selectedPlan.name} · {formatPlanPrice(selectedPlan, Math.max(0, profilesCount - Number(selectedPlan.includedUsers || 1)))}
              </Text>
            ) : null}

            {/* Code promo */}
            <View style={styles.promoRow}>
              <TextInput
                style={styles.promoInput}
                placeholder="Code promo (optionnel)"
                placeholderTextColor="#a89a8d"
                value={promoCode}
                onChangeText={(v) => { setPromoCode(v.toUpperCase()); setPromoResult(null); setPromoError(''); }}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!checkoutBusy}
              />
              <TouchableOpacity
                style={[styles.promoBtn, (!promoCode.trim() || promoLoading) && styles.promoBtnDisabled]}
                onPress={handleValidatePromo}
                disabled={!promoCode.trim() || promoLoading || !!checkoutBusy}
              >
                {promoLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.promoBtnText}>Appliquer</Text>}
              </TouchableOpacity>
            </View>

            {promoResult ? (
              <View style={styles.promoSuccessBox}>
                <MaterialCommunityIcons name="tag-check-outline" size={16} color="#1F7A39" />
                <Text style={styles.promoSuccessText}>
                  Code « {promoResult.code} » appliqué — {
                    promoResult.discountType === 'percent'
                      ? `-${promoResult.discountValue}%`
                      : `-${(promoResult.discountCents / 100).toFixed(2)} ${selectedPlan?.currency || 'EUR'}`
                  }
                </Text>
              </View>
            ) : null}
            {promoError ? <Text style={styles.promoErrorText}>{promoError}</Text> : null}

            {/* Bouton Stripe */}
            <TouchableOpacity
              style={[styles.providerBtn, styles.providerBtnStripe, !!checkoutBusy && styles.providerBtnDisabled]}
              onPress={() => doCheckout('stripe')}
              disabled={!!checkoutBusy}
              activeOpacity={0.8}
            >
              {checkoutBusy === 'stripe'
                ? <ActivityIndicator size="small" color="#5469d4" style={styles.providerIcon} />
                : <Text style={[styles.providerIcon, { fontSize: 26 }]}>💳</Text>}
              <View style={styles.providerInfo}>
                <Text style={styles.providerName}>Carte bancaire</Text>
                <Text style={styles.providerSub}>Visa, Mastercard — via Stripe</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#c8c4c0" />
            </TouchableOpacity>

            {/* Bouton Flutterwave */}
            <TouchableOpacity
              style={[styles.providerBtn, styles.providerBtnFw, !!checkoutBusy && styles.providerBtnDisabled]}
              onPress={() => doCheckout('flutterwave')}
              disabled={!!checkoutBusy}
              activeOpacity={0.8}
            >
              {checkoutBusy === 'flutterwave'
                ? <ActivityIndicator size="small" color="#f9a825" style={styles.providerIcon} />
                : <Text style={[styles.providerIcon, { fontSize: 26 }]}>📱</Text>}
              <View style={styles.providerInfo}>
                <Text style={styles.providerName}>Mobile Money</Text>
                <Text style={styles.providerSub}>Wave, Orange Money, MTN…</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#c8c4c0" />
            </TouchableOpacity>

            <Text style={styles.modalNote}>
              Vous serez redirigé vers votre navigateur pour finaliser le paiement.
            </Text>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => !checkoutBusy && setModalVisible(false)}
              disabled={!!checkoutBusy}
            >
              <Text style={styles.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const tokens2 = require('../config/tokens');

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

  // Cards
  card: { marginTop: 14, borderRadius: 16, backgroundColor: '#fff', padding: 14 },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Playfair Display',
    fontWeight: '700',
    color: '#171412',
    marginBottom: 8,
  },
  androidSubtitle: { fontSize: 12, color: '#9c7e49', marginBottom: 6, marginTop: -4 },
  geoRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  geoText: { fontSize: 11, color: '#9c7e49', fontStyle: 'italic' },
  rowBetween: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  separator: { height: 1, backgroundColor: '#EEE8E2', marginVertical: 6 },
  label: { color: '#867a71', fontSize: 14, flexShrink: 0 },
  value: { color: '#171412', fontSize: 14, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
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
    borderRadius: 14, borderWidth: 1.5, borderColor: '#E8DDD4',
    padding: 14, marginBottom: 10,
    position: 'relative', overflow: 'hidden',
  },
  planCardSelected: {
    borderColor: tokens.colors.primary,
    backgroundColor: `${tokens.colors.primary}08`,
  },
  planBadge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: tokens.colors.primary,
    paddingHorizontal: 8, paddingVertical: 3, borderBottomLeftRadius: 10,
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
    position: 'absolute', bottom: 12, right: 14,
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: '#C9B8A8',
    alignItems: 'center', justifyContent: 'center',
  },
  planRadioSelected: { borderColor: tokens.colors.primary },
  planRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: tokens.colors.primary },

  // Bullets liste features
  planBullets: { marginTop: 10, gap: 4 },
  planBullet: { fontSize: 12, color: '#6e5544', lineHeight: 17 },

  // Profile selector famille
  profileSelector: {
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#EFE7DD',
  },
  profileSelectorLabel: {
    fontSize: 11, color: '#9c7e49', textTransform: 'uppercase',
    letterSpacing: 0.5, fontWeight: '700', marginBottom: 8,
  },
  profileSelectorRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  profileBtn: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1.5, borderColor: tokens.colors.primary,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff',
  },
  profileBtnDisabled: { borderColor: '#E8DDD4' },
  profileCount: { fontSize: 18, fontWeight: '800', color: '#171412', minWidth: 30, textAlign: 'center' },

  // Hint crédits
  creditHint: { fontSize: 12, color: '#8a7d73', fontStyle: 'italic', marginTop: 10, lineHeight: 17 },

  // Pay button
  payBtn: {
    marginTop: 12, height: 52, borderRadius: 14,
    backgroundColor: tokens.colors.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  payBtnDisabled: { opacity: 0.45 },
  payBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingBottom: 34, paddingTop: 12,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#DDD', alignSelf: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#171412', marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: '#8a7d73', marginBottom: 16 },

  // Promo
  promoRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  promoInput: {
    flex: 1, height: 44, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#E8DDD4',
    paddingHorizontal: 12, fontSize: 14, color: '#171412',
    backgroundColor: '#FAFAF8',
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  promoBtn: {
    height: 44, paddingHorizontal: 14, borderRadius: 10,
    backgroundColor: tokens.colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  promoBtnDisabled: { opacity: 0.45 },
  promoBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  promoSuccessBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#E8F5EB', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7, marginBottom: 10,
  },
  promoSuccessText: { fontSize: 13, color: '#1F7A39', fontWeight: '600', flex: 1 },
  promoErrorText: { color: '#ad3f3f', fontSize: 12, marginBottom: 8 },

  // Provider buttons
  providerBtn: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, borderWidth: 1.5,
    padding: 14, marginTop: 10, gap: 12,
  },
  providerBtnStripe: { borderColor: '#5469d4', backgroundColor: '#f5f5ff' },
  providerBtnFw: { borderColor: '#f9a825', backgroundColor: '#fffbf0' },
  providerBtnDisabled: { opacity: 0.5 },
  providerIcon: { width: 36, textAlign: 'center' },
  providerInfo: { flex: 1 },
  providerName: { fontSize: 15, fontWeight: '700', color: '#171412' },
  providerSub: { fontSize: 12, color: '#8a7d73', marginTop: 2 },

  modalNote: {
    fontSize: 11, color: '#a89a8d', textAlign: 'center',
    marginTop: 14, marginBottom: 6, lineHeight: 16,
  },
  cancelBtn: {
    marginTop: 6, height: 44, alignItems: 'center', justifyContent: 'center',
  },
  cancelBtnText: { color: '#8a7d73', fontWeight: '600', fontSize: 14 },
});
