import { authFetch } from './auth.service';
import { getActiveProfile, setActiveProfile, clearActiveProfile } from '../config/profileStorage';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function parseJson(response, fallback) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.success) {
    throw new Error(data?.message || fallback);
  }
  return data;
}

export async function getProfiles() {
  const response = await authFetch(`${API_BASE_URL}/api/family/profiles`);
  const data = await parseJson(response, 'Impossible de charger les profils.');
  return data.data;
}

export async function createProfile(payload) {
  const response = await authFetch(`${API_BASE_URL}/api/family/profiles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await parseJson(response, 'Impossible de creer le profil.');
  return data.data;
}

export async function updateProfile(profileId, payload) {
  const response = await authFetch(`${API_BASE_URL}/api/family/profiles/${profileId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await parseJson(response, 'Impossible de modifier le profil.');
  return data.data;
}

export async function deleteProfile(profileId, verificationToken = '') {
  const response = await authFetch(`${API_BASE_URL}/api/family/profiles/${profileId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ verification_token: verificationToken }),
  });
  const data = await parseJson(response, 'Impossible de supprimer le profil.');
  return data.data;
}

export async function setProfilePin(profileId, pin, verificationToken = '') {
  const response = await authFetch(`${API_BASE_URL}/api/family/profiles/${profileId}/set-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin, verification_token: verificationToken }),
  });
  const data = await parseJson(response, 'Impossible de definir le code PIN.');
  return data.data;
}

export async function removeProfilePin(profileId, verificationToken = '') {
  const response = await authFetch(`${API_BASE_URL}/api/family/profiles/${profileId}/remove-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ verification_token: verificationToken }),
  });
  const data = await parseJson(response, 'Impossible de retirer le code PIN.');
  return data.data;
}

export async function verifyProfilePin(profileId, pin) {
  const response = await authFetch(`${API_BASE_URL}/api/family/profiles/${profileId}/verify-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  });
  return parseJson(response, 'Code PIN invalide.');
}

export async function selectProfile(profileId, pin = null) {
  const response = await authFetch(`${API_BASE_URL}/api/family/select-profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profileId, pin }),
  });
  const data = await parseJson(response, 'Impossible de selectionner le profil.');
  if (data?.data?.id) {
    setActiveProfile(data.data);
  }
  return data.data;
}

export async function resolveProfileRequirement() {
  try {
    const result = await getProfiles();
    const profiles = result?.profiles || [];
    if (!profiles.length) return { needsSelection: false, isFamily: false, profiles: [] };

    const active = getActiveProfile();
    const matching = active?.id ? profiles.find((profile) => profile.id === active.id) : null;
    if (!matching) {
      clearActiveProfile();
      return { needsSelection: true, isFamily: true, profiles };
    }

    setActiveProfile(matching);
    return { needsSelection: false, isFamily: true, profiles, activeProfile: matching };
  } catch (error) {
    const msg = String(error?.message || '');
    if (msg.includes('abonnement famille') || msg.includes('Aucun abonnement actif')) {
      clearActiveProfile();
      return { needsSelection: false, isFamily: false, profiles: [] };
    }
    throw error;
  }
}
