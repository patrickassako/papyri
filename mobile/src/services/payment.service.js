/**
 * payment.service — wraps the Stripe PaymentSheet flow for both subscriptions
 * and paid content unlocks. Returns the same shape from both code paths so the
 * UI can use a single helper to present the sheet.
 *
 * Backend contracts:
 *   POST /api/subscriptions/payment-sheet         -> initSubscriptionSheet
 *   POST /api/contents/:id/payment-sheet          -> initContentUnlockSheet
 *   POST /api/subscriptions/verify-payment-intent -> verifyPaymentIntent
 */
import API_BASE_URL from '../config/api';
import { supabase } from '../config/supabase';

async function authedFetch(path, body) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('NOT_AUTHENTICATED');

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body || {}),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.success === false) {
    const err = new Error(data?.message || data?.error || `HTTP ${res.status}`);
    err.code = data?.error || `HTTP_${res.status}`;
    throw err;
  }
  return data;
}

export const paymentService = {
  initSubscriptionSheet: async ({ planId, planCode, usersLimit, promoCode } = {}) => {
    return authedFetch('/api/subscriptions/payment-sheet', {
      planId, planCode, usersLimit, promoCode,
    });
  },

  initContentUnlockSheet: async (contentId, { profileId } = {}) => {
    return authedFetch(`/api/contents/${contentId}/payment-sheet`, profileId ? { profileId } : {});
  },

  verifyPaymentIntent: async (paymentIntentId) => {
    return authedFetch('/api/subscriptions/verify-payment-intent', { paymentIntentId });
  },
};
