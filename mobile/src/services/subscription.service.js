import API_BASE_URL from '../config/api';
import { supabase } from '../config/supabase';
import { apiClient } from './api.client';

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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        return null;
      }

      const response = await fetch(`${API_BASE_URL}/api/subscriptions/me`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data?.success) {
        if (data.subscription) return data.subscription;
        if (data.data?.subscription) return data.data.subscription;
        return null;
      }
      return null;
    } catch (error) {
      // Si 404, l'utilisateur n'a pas d'abonnement
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return null;

      const response = await fetch(`${API_BASE_URL}/api/subscriptions/me`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(payload?.error || payload?.message || `HTTP ${response.status}`);
      }

      if (!payload?.success) return null;
      return payload;
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

      const response = await fetch(`${API_BASE_URL}/api/subscriptions/usage/me`, {
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
      if (!session?.access_token) {
        return [];
      }

      const response = await fetch(`${API_BASE_URL}/api/subscriptions/payment-history`, {
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
};
