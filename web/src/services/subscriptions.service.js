import { apiClient } from './api.client';
import { authFetch } from './auth.service';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const subscriptionsService = {
  async getPlans() {
    const response = await apiClient.get('/api/subscriptions/plans');
    return response.data?.plans || [];
  },

  async checkout({ planId, planCode, usersLimit }) {
    const response = await authFetch(`${API_BASE_URL}/api/subscriptions/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        planId,
        planCode,
        usersLimit,
      }),
    });

    const data = await response.json();
    if (!response.ok || !data?.success) {
      if (response.status === 503) {
        throw new Error(
          'Paiement indisponible: configure FLUTTERWAVE_PUBLIC_KEY et FLUTTERWAVE_SECRET_KEY côté backend.'
        );
      }
      throw new Error(data?.message || 'Failed to initiate checkout');
    }

    return data;
  },

  async getMySubscription() {
    const response = await authFetch(`${API_BASE_URL}/api/subscriptions/me`);
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.message || 'Failed to get subscription status');
    }
    return data;
  },

  async cancel({ immediately = false } = {}) {
    const response = await authFetch(`${API_BASE_URL}/api/subscriptions/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ immediately }),
    });
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.message || 'Failed to cancel subscription');
    }
    return data;
  },

  async getPaymentHistory() {
    const response = await authFetch(`${API_BASE_URL}/api/subscriptions/payment-history`);
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.message || 'Failed to get payment history');
    }
    return data;
  },

  async getMyUsage() {
    const response = await authFetch(`${API_BASE_URL}/api/subscriptions/usage/me`);
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.message || 'Failed to get usage');
    }
    return data;
  },

  async getMyBonuses({ includeExpired = false } = {}) {
    const qs = includeExpired ? '?includeExpired=true' : '';
    const response = await authFetch(`${API_BASE_URL}/api/subscriptions/bonuses/me${qs}`);
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.message || 'Failed to get bonuses');
    }
    return data;
  },

  async getMembers() {
    const response = await authFetch(`${API_BASE_URL}/api/subscriptions/members`);
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.message || 'Failed to get members');
    }
    return data;
  },

  async addMember(userId) {
    const response = await authFetch(`${API_BASE_URL}/api/subscriptions/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    });
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.message || 'Failed to add member');
    }
    return data;
  },

  async removeMember(userId) {
    const response = await authFetch(`${API_BASE_URL}/api/subscriptions/members/${userId}`, {
      method: 'DELETE',
    });
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.message || 'Failed to remove member');
    }
    return data;
  },

  async updateUsersLimit(usersLimit) {
    const response = await authFetch(`${API_BASE_URL}/api/subscriptions/users-limit`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ usersLimit }),
    });
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.message || 'Failed to update users limit');
    }
    return data;
  },

  async renew() {
    const response = await authFetch(`${API_BASE_URL}/api/subscriptions/renew`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.message || 'Failed to initiate renewal');
    }
    return data;
  },

  async resume() {
    const response = await authFetch(`${API_BASE_URL}/api/subscriptions/resume`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.message || 'Failed to resume subscription');
    }
    return data;
  },

  async changePlan({ planId, planCode, usersLimit }) {
    const response = await authFetch(`${API_BASE_URL}/api/subscriptions/change-plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        planId,
        planCode,
        usersLimit,
      }),
    });
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.message || 'Failed to schedule plan change');
    }
    return data;
  },

  async verifyPayment({ transactionId, reference }) {
    const response = await authFetch(`${API_BASE_URL}/api/subscriptions/verify-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transactionId,
        reference,
      }),
    });

    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.message || 'Failed to verify payment');
    }

    return data;
  },
};
