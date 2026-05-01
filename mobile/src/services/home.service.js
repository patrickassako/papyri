/**
 * Service pour la page d'accueil
 * Utilise authFetch — envoie automatiquement X-Profile-Id et Authorization.
 */

import { authFetch } from './auth.service';
import API_BASE_URL from '../config/api';

export async function getHomeData() {
  const response = await authFetch(`${API_BASE_URL}/home`);
  if (!response.ok) {
    if (response.status === 401) throw new Error('Session expired');
    throw new Error(`HTTP ${response.status}`);
  }
  const result = await response.json();
  if (result.success && result.data) return result.data;
  throw new Error('Invalid response format');
}

export async function getReadingHistory(page = 1, limit = 20) {
  const response = await authFetch(
    `${API_BASE_URL}/reading-history?page=${page}&limit=${limit}`
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function getReadingPosition(contentId) {
  const response = await authFetch(`${API_BASE_URL}/reading-history/${contentId}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const result = await response.json();
  return result.data;
}

export async function saveReadingPosition(contentId, data) {
  const response = await authFetch(`${API_BASE_URL}/reading-history/${contentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
