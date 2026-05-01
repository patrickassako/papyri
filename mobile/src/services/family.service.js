import API_BASE_URL from '../config/api';
import { getAccessToken } from './auth.service';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ACTIVE_PROFILE_KEY = '@papyri_active_profile';

async function authHeaders() {
  const token = await getAccessToken();
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function apiFetch(path, options = {}) {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE_URL}/api/family${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || 'Erreur réseau');
  return data;
}

// ── Profils ───────────────────────────────────────────────────────────────

// Normalize backend field names → mobile component names
function normalizeProfile(p) {
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    avatar_color: p.avatar_color || p.avatar_key || null,
    is_owner: p.is_owner || p.is_owner_profile || false,
    is_child: p.is_child || p.is_kid || false,
    has_pin: p.has_pin || p.pin_enabled || false,
    position: p.position,
    last_used_at: p.last_used_at,
  };
}

export async function listProfiles() {
  const data = await apiFetch('/profiles');
  // Backend returns { subscription: {...}, profiles: [...] }
  const raw = data.data?.profiles || data.data || [];
  const arr = Array.isArray(raw) ? raw : [];
  return arr.map(normalizeProfile);
}

export async function createProfile(payload) {
  // payload: { name, avatar_color?, is_child?, age_restriction? }
  const data = await apiFetch('/profiles', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.data;
}

export async function updateProfile(profileId, payload) {
  const data = await apiFetch(`/profiles/${profileId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return data.data;
}

export async function deleteProfile(profileId) {
  const data = await apiFetch(`/profiles/${profileId}`, { method: 'DELETE' });
  return data.data;
}

export async function setPin(profileId, pin) {
  const data = await apiFetch(`/profiles/${profileId}/set-pin`, {
    method: 'POST',
    body: JSON.stringify({ pin }),
  });
  return data.data;
}

export async function removePin(profileId) {
  const data = await apiFetch(`/profiles/${profileId}/remove-pin`, { method: 'POST' });
  return data.data;
}

export async function verifyPin(profileId, pin) {
  const data = await apiFetch(`/profiles/${profileId}/verify-pin`, {
    method: 'POST',
    body: JSON.stringify({ pin }),
  });
  return data;
}

export async function selectProfile(profileId, pin = null) {
  const body = { profileId };
  if (pin) body.pin = pin;
  const data = await apiFetch('/select-profile', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return data.data;
}

// ── Active profile (local cache) ──────────────────────────────────────────

export async function saveActiveProfile(profile) {
  await AsyncStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(profile));
}

export async function getActiveProfile() {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function clearActiveProfile() {
  await AsyncStorage.removeItem(ACTIVE_PROFILE_KEY);
}

// Avatar colors palette
export const AVATAR_COLORS = [
  '#B5651D', '#2E4057', '#4CAF50', '#9C27B0',
  '#F44336', '#2196F3', '#FF9800', '#009688',
];
