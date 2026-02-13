import apiClient from './api.client';

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
      const response = await apiClient.get('/subscriptions/current');
      return response.data;
    } catch (error) {
      // Si 404, l'utilisateur n'a pas d'abonnement
      if (error.response?.status === 404) {
        return null;
      }
      console.error('Error getting subscription:', error);
      throw error;
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
      return subscription?.status === 'active';
    } catch (error) {
      return false;
    }
  }
};
