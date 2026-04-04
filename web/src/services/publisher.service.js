import { authFetch, getAccessToken } from './auth.service';

import { API_BASE_URL as API } from '../config/api';

async function call(path, options = {}) {
  const res = await authFetch(`${API}/api/publisher${path}`, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Erreur serveur');
  return data;
}

async function adminCall(path, options = {}) {
  const res = await authFetch(`${API}/api/admin/publishers${path}`, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Erreur serveur');
  return data;
}

// ── Auth invitation ───────────────────────────────────────────

export async function verifyInvitationToken(token) {
  const res = await fetch(`${API}/api/publisher/activate/${token}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Token invalide');
  return data;
}

export async function activateAccount({ token, password, fullName }) {
  const res = await fetch(`${API}/api/publisher/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password, fullName }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Activation échouée');
  return data;
}

// ── Dashboard ─────────────────────────────────────────────────

export const getDashboardData = () => call('/dashboard-data');

// ── Profil ────────────────────────────────────────────────────

export const getMe = () => call('/me');
export const updateMe = (body) => call('/me', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export const updatePayoutMethod = (body) => call('/me/payout-method', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// ── Livres ────────────────────────────────────────────────────

export const getBooks = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return call(`/books${qs ? '?' + qs : ''}`);
};

export const submitBook  = (body) => call('/books', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export const saveDraft   = (body) => call('/books', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, isDraft: true }) });
export const updateDraft = (contentId, body) => call(`/books/${contentId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export const submitDraft = (contentId, body) => call(`/books/${contentId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, submit: true }) });
export const deleteBook  = (contentId) => call(`/books/${contentId}`, { method: 'DELETE' });

// ── Revenus ───────────────────────────────────────────────────

export const getRevenueSummary = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return call(`/revenue/summary${qs ? '?' + qs : ''}`);
};

export const getRevenueByBook = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return call(`/revenue/by-book${qs ? '?' + qs : ''}`);
};

export const getPayouts = () => call('/payouts');

// ── Codes promo ───────────────────────────────────────────────

export const getPromoQuota = () => call('/promo-codes/quota');
export const getPromoCodes = () => call('/promo-codes');
export const createPromoCode = (body) => call('/promo-codes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export const togglePromoCode = (id) => call(`/promo-codes/${id}/toggle`, { method: 'PATCH' });
export const getPromoCodeUsages = (id) => call(`/promo-codes/${id}/usages`);
export const deletePromoCode = (id) => call(`/promo-codes/${id}`, { method: 'DELETE' });

// ── Admin : codes promo éditeurs ─────────────────────────────
export const adminGetPublisherPromoCodes = (params = {}) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '')).toString();
  return adminCall(`/publisher-promo-codes${qs ? '?' + qs : ''}`);
};
export const adminTogglePublisherPromoCode = (codeId) => adminCall(`/publisher-promo-codes/${codeId}/toggle`, { method: 'PATCH' });
export const adminGetPublisherPromoCodeUsages = (codeId) => adminCall(`/publisher-promo-codes/${codeId}/usages`);
export const adminUpdatePublisherPromoLimit = (publisherId, limit) => adminCall(`/${publisherId}/promo-limit`, {
  method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ limit }),
});

// ── Prix géographiques ────────────────────────────────────────

export const getBookGeoPricing = (contentId) => call(`/books/${contentId}/geo-pricing`);
export const upsertBookGeoPricing = (contentId, body) => call(`/books/${contentId}/geo-pricing`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
export const deleteBookGeoPricing = (contentId, id) => call(`/books/${contentId}/geo-pricing/${id}`, { method: 'DELETE' });

// ── Restrictions géographiques ────────────────────────────────

export const getBookGeoRestrictions = (contentId) => call(`/books/${contentId}/geo-restrictions`);
export const setBookGeoRestrictionConfig = (contentId, mode) => call(`/books/${contentId}/geo-restrictions/config`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }),
});
export const deleteBookGeoRestrictionConfig = (contentId) => call(`/books/${contentId}/geo-restrictions`, { method: 'DELETE' });
export const upsertBookGeoZone = (contentId, body) => call(`/books/${contentId}/geo-restrictions/zones`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
export const deleteBookGeoZone = (contentId, zoneId) => call(`/books/${contentId}/geo-restrictions/zones/${zoneId}`, { method: 'DELETE' });

// ── Admin ─────────────────────────────────────────────────────
export const adminGetDashboardStats = () => adminCall('/stats/dashboard');

export const adminGetPublishers = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return adminCall(`/${qs ? '?' + qs : ''}`);
};

export const adminInvitePublisher = (body) => adminCall('/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export const adminGetPublisher = (id, params) => {
  const qs = params ? params.toString() : '';
  return adminCall(`/${id}${qs ? '?' + qs : ''}`);
};
export const adminUpdateStatus = (id, status) => adminCall(`/${id}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
export const adminDeletePublisher = (id) => adminCall(`/${id}`, { method: 'DELETE' });
export const adminUpdateRevenueGrid = (id, grid) => adminCall(`/${id}/revenue-grid`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(grid) });

export const adminGetPendingContent = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return adminCall(`/content/pending${qs ? '?' + qs : ''}`);
};
export const adminApproveContent = (id) => adminCall(`/content/${id}/approve`, { method: 'PUT' });
export const adminRejectContent  = (id, reason) => adminCall(`/content/${id}/reject`,  { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) });
export const adminPauseContent   = (id, reason) => adminCall(`/content/${id}/pause`,   { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) });
export const adminResetContent   = (id) => adminCall(`/content/${id}/pending`, { method: 'PUT' });

// Direct admin book endpoints (not publisher-prefixed)
async function adminBookCall(path, options = {}) {
  const res = await authFetch(`${API}/api/admin/books${path}`, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || 'Erreur serveur');
  return data;
}
export const adminGetBook = (bookId) => adminBookCall(`/${bookId}`);
export const adminGetBookFileUrl = (bookId) => `${API}/api/admin/books/${bookId}/file`;
export const adminUpdateBookMetadata = (bookId, body) => adminBookCall(`/${bookId}/metadata`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

// ── Upload R2 (éditeur) ───────────────────────────────────────

async function uploadWithProgress(endpoint, formData, onProgress) {
  const token = await getAccessToken();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API}/api/publisher${endpoint}`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 400) reject(new Error(data.error || 'Upload échoué'));
        else resolve(data);
      } catch {
        reject(new Error('Réponse invalide du serveur'));
      }
    };
    xhr.onerror = () => reject(new Error('Erreur réseau lors de l\'upload'));
    xhr.send(formData);
  });
}

export async function uploadCover(file, onProgress) {
  const fd = new FormData();
  fd.append('cover', file);
  return uploadWithProgress('/upload-cover', fd, onProgress);
}

export async function uploadContent(file, onProgress) {
  const fd = new FormData();
  fd.append('file', file);
  return uploadWithProgress('/upload-content', fd, onProgress);
}

export async function extractMetadata(file) {
  const fd = new FormData();
  fd.append('file', file);
  const token = await getAccessToken();
  const res = await fetch(`${API}/api/publisher/extract-metadata`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Extraction de métadonnées échouée');
  return data;
}

// ── Réclamations ──────────────────────────────────────────────

export const getClaims = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return call(`/claims${qs ? '?' + qs : ''}`);
};
export const createClaim = (body) => call('/claims', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// ── Admin réclamations ────────────────────────────────────────

export const adminGetClaims = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return adminCall(`/claims${qs ? '?' + qs : ''}`);
};
export const adminReplyClaim = (id, body) => adminCall(`/claims/${id}/reply`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export const adminUpdateClaimStatus = (id, status) => adminCall(`/claims/${id}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });

// ── Planification versements ──────────────────────────────────
export const adminGetScheduleConfig   = ()       => adminCall('/payouts/schedule-config');
export const adminUpdateScheduleConfig= (body)   => adminCall('/payouts/schedule-config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export const adminGetSchedulePreview  = ()       => adminCall('/payouts/schedule-preview');
export const adminGetScheduledPayouts = (params = {}) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '')).toString();
  return adminCall(`/payouts/scheduled${qs ? '?' + qs : ''}`);
};
export const adminScheduleNow = () => adminCall('/payouts/schedule-now', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });

export const adminGetPayoutsOverview = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return adminCall(`/payouts/overview${qs ? '?' + qs : ''}`);
};
export const adminGetPayoutsHistory = (params = {}) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '')).toString();
  return adminCall(`/payouts/history${qs ? '?' + qs : ''}`);
};
export const adminCreatePayout = (body) => adminCall('/payouts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export const adminCreateAllPayouts = (body) => adminCall('/payouts/all', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export const adminUpdatePayoutStatus = (id, status, notes) => adminCall(`/payouts/${id}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, notes }) });
