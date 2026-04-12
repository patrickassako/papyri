import { apiClient } from './api.client';
import { authFetch } from './auth.service';

import { API_BASE_URL } from '../config/api';

export const subscriptionsService = {
  async getPlans() {
    const response = await apiClient.get('/api/subscriptions/plans');
    return response.data?.plans || [];
  },

  async getPlansWithGeo() {
    const response = await apiClient.get('/api/subscriptions/plans');
    return {
      plans: response.data?.plans || [],
      geo: response.data?.geo || null,
    };
  },

  /**
   * Initiate checkout — supports 'flutterwave' (mobile money) and 'stripe' (card)
   * Returns { paymentLink, reference, provider, subscription }
   */
  async checkout({ planId, planCode, usersLimit, provider = 'flutterwave', promoCode }) {
    const response = await authFetch(`${API_BASE_URL}/api/subscriptions/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        planId,
        planCode,
        usersLimit,
        provider,
        promoCode: promoCode || undefined,
      }),
    });

    const data = await response.json();
    if (!response.ok || !data?.success) {
      if (response.status === 503) {
        throw new Error(
          data?.message || 'Paiement indisponible: le fournisseur de paiement n\'est pas configuré côté backend.'
        );
      }
      throw new Error(data?.message || 'Failed to initiate checkout');
    }

    return data;
  },

  /**
   * Valider un code promo avant le paiement
   * Returns { code, discountType, discountValue, discountCents, finalAmountCents, originalAmountCents }
   */
  async validatePromoCode({ code, planId, planCode, usersLimit }) {
    const response = await authFetch(`${API_BASE_URL}/api/subscriptions/promo/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, planId, planCode, usersLimit }),
    });
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.message || data?.error || 'Code promo invalide.');
    }
    return data;
  },

  /**
   * Initiate payment for one extra seat on a family subscription
   * Returns { paymentLink, provider, reference }
   */
  async buyExtraSeat({ provider = 'stripe' } = {}) {
    const response = await authFetch(`${API_BASE_URL}/api/subscriptions/buy-extra-seat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
    });
    const data = await response.json();
    if (!response.ok || !data?.success) {
      if (response.status === 503) {
        throw new Error(data?.message || 'Fournisseur de paiement non configuré.');
      }
      throw new Error(data?.message || 'Failed to initiate extra seat purchase');
    }
    return data;
  },

  /**
   * Verify a Stripe Checkout Session (called from callback page after Stripe redirect)
   */
  async verifyStripeSession(sessionId) {
    const response = await authFetch(`${API_BASE_URL}/api/subscriptions/verify-stripe-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.message || 'Failed to verify Stripe session');
    }
    return data;
  },

  async getMySubscription() {
    const response = await authFetch(`${API_BASE_URL}/api/subscriptions/me`);
    // Kid profiles are blocked by rejectKidProfile middleware — return null silently
    if (response.status === 403) return null;
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
    // Kid profiles are blocked by rejectKidProfile middleware — return null silently
    if (response.status === 403) return null;
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

  async reactivate() {
    const response = await authFetch(`${API_BASE_URL}/api/subscriptions/reactivate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.message || 'Failed to reactivate subscription');
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

  async lookupUserByEmail(email) {
    const response = await authFetch(
      `${API_BASE_URL}/users/lookup?email=${encodeURIComponent(email)}`
    );
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.message || 'Utilisateur introuvable.');
    }
    return data.data;
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

  /**
   * Download a PDF invoice for a specific payment.
   * Triggers a browser file download.
   */
  async downloadInvoice(paymentId) {
    const response = await authFetch(`${API_BASE_URL}/api/subscriptions/payments/${paymentId}/invoice`);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || 'Failed to download invoice');
    }
    const blob = await response.blob();
    // Derive filename from Content-Disposition header if present
    const disposition = response.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match ? match[1] : `invoice-${paymentId.slice(-8)}.pdf`;
    // Trigger browser download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
