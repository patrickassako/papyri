import { authFetch } from './auth.service';
import API_URL from '../config/api';

/**
 * Returns the pending deletion request for the current user, or null.
 */
export async function getPendingDeletionRequest() {
  try {
    const res = await authFetch(`${API_URL}/users/me/gdpr-requests`);
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    const list = Array.isArray(data?.data) ? data.data : [];
    return list.find((r) => r.request_type === 'deletion' && r.status === 'pending') || null;
  } catch {
    return null;
  }
}

/**
 * Cancel the pending deletion request.
 */
export async function cancelDeletionRequest() {
  const res = await authFetch(`${API_URL}/users/me/gdpr-request/cancel`, {
    method: 'POST',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `HTTP ${res.status}`);
  }
  return data?.data || null;
}
