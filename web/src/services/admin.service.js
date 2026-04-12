import { authFetch } from './auth.service';

import { API_BASE_URL as API } from '../config/api';
const BASE = `${API}/api/admin`;

async function call(path, options = {}) {
  const res = await authFetch(`${BASE}${path}`, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || 'Erreur serveur');
  return data;
}

// ── Stats ─────────────────────────────────────────────────────────────────────
export const getGlobalStats = () => call('/stats');

// ── Users ─────────────────────────────────────────────────────────────────────
export const getUsers = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return call(`/users${qs ? '?' + qs : ''}`);
};

export const searchUsers = (q) => call(`/users/search?q=${encodeURIComponent(q)}`);

export const getUser = (id) => call(`/users/${id}`);

export const updateUser = (id, data) => call(`/users/${id}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});

export const grantBook = (userId, contentId) => call(`/users/${userId}/grant-book`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ contentId }),
});

export const revokeBook = (unlockId) => call(`/users/unlocks/${unlockId}`, { method: 'DELETE' });

// ── Plans ─────────────────────────────────────────────────────────────────────
export const getPlans = () => call('/plans');

// ── Subscriptions ─────────────────────────────────────────────────────────────
export const extendSubscription = (userId, months) => call('/subscriptions/extend', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId, months }),
});

export const cancelSubscription = (userId) => call(`/subscriptions/cancel/${userId}`, { method: 'POST' });

export const updateSubscription = (subId, data) => call(`/subscriptions/${subId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});

export const deleteSubscription = (subId) => call(`/subscriptions/${subId}`, { method: 'DELETE' });

export const createSubscription = (data) => call('/subscriptions/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});

// ── RGPD ──────────────────────────────────────────────────────────────────────
export const getGdprRequests = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return call(`/gdpr-requests${qs ? '?' + qs : ''}`);
};

export const processGdprRequest = (id, data) => call(`/gdpr-requests/${id}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});

// ── Invitations ───────────────────────────────────────────────────────────────
export const getInvitations = () => call('/invitations');
export const sendInvitation = (email, role) => call('/invitations', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, role }),
});
export const cancelInvitation = (id) => call(`/invitations/${id}`, { method: 'DELETE' });
export const resendInvitation = (id) => call(`/invitations/${id}/resend`, { method: 'POST' });

// ── Roles & Permissions ───────────────────────────────────────────────────────
export const getRoles = () => call('/roles');
export const getRole  = (id) => call(`/roles/${id}`);
export const getAllPermissions = () => call('/roles/permissions/all');
export const createRole = (data) => call('/roles', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
});
export const updateRole = (id, data) => call(`/roles/${id}`, {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
});
export const setRolePermissions = (id, permission_ids) => call(`/roles/${id}/permissions`, {
  method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ permission_ids }),
});
export const deleteRole = (id) => call(`/roles/${id}`, { method: 'DELETE' });

// ── Permissions du user connecté ─────────────────────────────────────────────
export const getMyPermissions = () => call('/me/permissions');

// ── Contents ─────────────────────────────────────────────────────────────────
export const searchContents = (q) => call(`/contents/search?q=${encodeURIComponent(q)}`);

// Note: this toggles archive status (archive=true → archived; false → unarchived)
// Backend route: PATCH /api/admin/books-overview/content/:contentId/archive (no body needed — it's a toggle)
export const archiveContent = (contentId) => {
  const res = authFetch(`${API}/api/admin/books-overview/content/${contentId}/archive`, { method: 'PATCH' });
  return res.then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Erreur'); return d; });
};
