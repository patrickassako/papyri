import API_BASE_URL from '../config/api';
import { supabase } from '../config/supabase';
import { apiClient } from './api.client';

/** Fetch avec timeout (ms) */
async function fetchWithTimeout(url, options = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

/**
 * Appel interne : GET /api/subscriptions/me → retourne le payload brut ou null
 */
const _fetchSubscriptionPayload = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return null;

  const response = await fetchWithTimeout(`${API_BASE_URL}/api/subscriptions/me`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(payload?.error || payload?.message || `HTTP ${response.status}`);
  if (!payload?.success) return null;
  return payload;
};

/**
 * Service pour gérer les abonnements
 */
export const subscriptionService = {
  /**
   * Obtenir l'abonnement actuel de l'utilisateur
   * @returns {Promise<Object>} Abonnement actuel ou null
   */
  getCurrentSubscription: async () => {
    try {
      const payload = await _fetchSubscriptionPayload();
      if (!payload) return null;
      return payload.subscription ?? payload.data?.subscription ?? null;
    } catch (error) {
      console.error('Error getting subscription:', error);
      return null;
    }
  },

  /**
   * Obtenir l'état brut abonnement retourné par /api/subscriptions/me
   * @returns {Promise<Object|null>}
   */
  getMySubscriptionStatus: async () => {
    try {
      return await _fetchSubscriptionPayload();
    } catch (error) {
      console.error('Error getting subscription status:', error);
      return null;
    }
  },

  /**
   * Créer un nouvel abonnement
   * @param {string} plan - 'monthly' ou 'yearly'
   * @param {string} paymentGateway - 'stripe' ou 'flutterwave'
   * @returns {Promise<Object>}
   */
  createSubscription: async (plan, paymentGateway) => {
    const response = await apiClient.post('/subscriptions', {
      plan,
      payment_gateway: paymentGateway
    });
    return response.data;
  },

  /**
   * Annuler l'abonnement actuel
   * @returns {Promise<Object>}
   */
  cancelSubscription: async () => {
    const response = await apiClient.post('/subscriptions/current/cancel');
    return response.data;
  },

  /**
   * Vérifier si l'utilisateur a un abonnement actif
   * @returns {Promise<boolean>}
   */
  hasActiveSubscription: async () => {
    try {
      const subscription = await subscriptionService.getCurrentSubscription();
      const status = String(subscription?.status || '').toLowerCase();
      return status === 'active';
    } catch (error) {
      return false;
    }
  },

  /**
   * Récupère l'usage abonnement courant (quota + bonus)
   * @returns {Promise<Object|null>}
   */
  getMyUsage: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        return null;
      }

      const response = await fetchWithTimeout(`${API_BASE_URL}/api/subscriptions/usage/me`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(payload?.error || payload?.message || `HTTP ${response.status}`);
        error.response = { status: response.status, data: payload };
        throw error;
      }

      return payload?.data || null;
    } catch (error) {
      console.error('Error getting usage:', error);
      return null;
    }
  },

  /**
   * Récupère l'historique de paiements abonnement
   * @returns {Promise<Array>}
   */
  getPaymentHistory: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token || !session?.user?.id) {
        return [];
      }

      const response = await fetchWithTimeout(`${API_BASE_URL}/api/subscriptions/payment-history`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error(payload?.error || payload?.message || `HTTP ${response.status}`);
      }

      if (!payload?.success) return [];
      return Array.isArray(payload?.payments) ? payload.payments : [];
    } catch (error) {
      console.error('Error getting payment history:', error);
      return [];
    }
  },

  /**
   * Valider un code promo avant le paiement
   * Returns { code, discountType, discountValue, discountCents, finalAmountCents, originalAmountCents }
   */
  validatePromoCode: async ({ code, planId, planCode, usersLimit }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Non authentifié');

    const response = await fetch(`${API_BASE_URL}/api/subscriptions/promo/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ code: code?.trim().toUpperCase(), planId, planCode, usersLimit }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.success) {
      throw new Error(data?.message || data?.error || 'Code promo invalide.');
    }
    return data;
  },

  /**
   * Récupère la liste des plans disponibles (public)
   * Envoie x-country-code basé sur la locale du device pour la tarification géolocalisée.
   * Returns { plans, geo }
   */
  getPlans: async () => {
    // Extract country code from device locale (e.g. "fr-CM" → "CM")
    let countryCode = null;
    try {
      const locale = Intl.DateTimeFormat().resolvedOptions().locale || '';
      const parts = locale.split(/[-_]/);
      if (parts.length > 1) countryCode = parts[parts.length - 1].toUpperCase();
    } catch (_) {}

    const headers = { 'Content-Type': 'application/json' };
    if (countryCode && /^[A-Z]{2}$/.test(countryCode)) {
      headers['x-country-code'] = countryCode;
    }

    const response = await fetchWithTimeout(`${API_BASE_URL}/api/subscriptions/plans`, {
      method: 'GET',
      headers,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || 'Impossible de charger les plans.');
    return { plans: data.plans || [], geo: data.geo || null };
  },

  /**
   * Initier un paiement d'abonnement (Flutterwave ou Stripe)
   * source: 'mobile' → callback vers papyri://payment/callback
   * Returns { paymentLink, provider, reference, subscription }
   */
  checkout: async ({ planId, planCode, usersLimit, provider = 'flutterwave', promoCode } = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Non authentifié');

    const response = await fetch(`${API_BASE_URL}/api/subscriptions/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        planId,
        planCode,
        usersLimit,
        provider,
        source: 'mobile', // tell backend to use papyri:// deep link callback
        promoCode: promoCode ? promoCode.trim().toUpperCase() : undefined,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.success) {
      if (response.status === 503) {
        throw new Error(data?.message || 'Paiement indisponible : fournisseur non configuré.');
      }
      throw new Error(data?.message || data?.error || 'Échec du paiement.');
    }
    return data;
  },

  /**
   * Vérifier un paiement Flutterwave (appelé depuis le callback deep link)
   */
  verifyPayment: async ({ transactionId, reference }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Non authentifié');

    const response = await fetchWithTimeout(`${API_BASE_URL}/api/subscriptions/verify-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ transactionId, reference }),
    }, 30000);

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.success) {
      throw new Error(data?.message || data?.error || 'Vérification échouée.');
    }
    return data;
  },

  /**
   * Vérifier une session Stripe (appelé depuis le callback deep link)
   */
  verifyStripeSession: async ({ sessionId }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Non authentifié');

    const response = await fetchWithTimeout(`${API_BASE_URL}/api/subscriptions/verify-stripe-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ sessionId }),
    }, 30000);

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.success) {
      throw new Error(data?.message || data?.error || 'Vérification Stripe échouée.');
    }
    return data;
  },
};
