import { supabase } from '../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_BASE_URL from '../config/api';

const ACTIVE_PROFILE_KEY = '@papyri_active_profile';

const getActiveProfileId = async () => {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_PROFILE_KEY);
    if (!raw) return null;
    const profile = JSON.parse(raw);
    return profile?.id || null;
  } catch {
    return null;
  }
};

// Code pays extrait de la locale de l'appareil (ex: "fr-CM" → "CM")
const _rawLocale = Intl.DateTimeFormat().resolvedOptions().locale || '';
const DEVICE_COUNTRY = (() => {
  try {
    const region = new Intl.Locale(_rawLocale).region;
    if (region && /^[A-Z]{2}$/.test(region)) return region;
  } catch {}
  // Fallback: prendre le dernier segment s'il fait 2 lettres
  const parts = _rawLocale.split('-');
  const last = parts[parts.length - 1].toUpperCase();
  return last.length === 2 ? last : null;
})();

/**
 * Récupère le token d'accès depuis la session Supabase active
 */
const getAccessToken = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  } catch (error) {
    console.error('Erreur lecture session Supabase:', error);
    return null;
  }
};

/**
 * Construit l'URL complète avec query params
 */
const buildUrl = (url, params) => {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  if (!params) return fullUrl;

  const searchParams = new URLSearchParams();
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null) {
      searchParams.append(key, params[key]);
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `${fullUrl}?${queryString}` : fullUrl;
};

/**
 * Effectue une requête fetch avec gestion des tokens
 */
const fetchWithAuth = async (url, options = {}) => {
  // Ajouter le token d'accès
  const token = await getAccessToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (DEVICE_COUNTRY) {
    headers['X-Country-Code'] = DEVICE_COUNTRY;
  }

  // Injecter le profil famille actif si sélectionné
  const profileId = await getActiveProfileId();
  if (profileId) {
    headers['X-Profile-Id'] = profileId;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  // Gestion du 401 (token expiré) — laisser Supabase rafraîchir la session
  if (response.status === 401 && !options._retry) {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session) {
        await supabase.auth.signOut();
        throw new Error('Session expired');
      }
      // Réessayer avec le nouveau token
      return fetchWithAuth(url, { ...options, _retry: true });
    } catch (refreshError) {
      throw refreshError;
    }
  }

  return response;
};

/**
 * Client API compatible avec l'interface axios
 */
export { DEVICE_COUNTRY };

export const apiClient = {
  /**
   * GET request
   */
  async get(url, config = {}) {
    const fullUrl = buildUrl(url, config.params);
    const response = await fetchWithAuth(fullUrl, {
      method: 'GET',
      ...config
    });

    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.response = {
        status: response.status,
        data: await response.json().catch(() => ({}))
      };
      throw error;
    }

    const data = await response.json();
    return { data };
  },

  /**
   * POST request
   */
  async post(url, data, config = {}) {
    const fullUrl = buildUrl(url);
    const response = await fetchWithAuth(fullUrl, {
      method: 'POST',
      body: JSON.stringify(data),
      ...config
    });

    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.response = {
        status: response.status,
        data: await response.json().catch(() => ({}))
      };
      throw error;
    }

    const responseData = await response.json();
    return { data: responseData };
  },

  /**
   * PUT request
   */
  async put(url, data, config = {}) {
    const fullUrl = buildUrl(url);
    const response = await fetchWithAuth(fullUrl, {
      method: 'PUT',
      body: JSON.stringify(data),
      ...config
    });

    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.response = {
        status: response.status,
        data: await response.json().catch(() => ({}))
      };
      throw error;
    }

    const responseData = await response.json();
    return { data: responseData };
  },

  /**
   * DELETE request
   */
  async delete(url, config = {}) {
    const fullUrl = buildUrl(url);
    const response = await fetchWithAuth(fullUrl, {
      method: 'DELETE',
      ...config
    });

    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.response = {
        status: response.status,
        data: await response.json().catch(() => ({}))
      };
      throw error;
    }

    const data = await response.json();
    return { data };
  }
};
