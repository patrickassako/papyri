import AsyncStorage from '@react-native-async-storage/async-storage';
import API_BASE_URL from '../config/api';

/**
 * Récupère le token d'accès depuis AsyncStorage
 */
const getAccessToken = async () => {
  try {
    return await AsyncStorage.getItem('access_token');
  } catch (error) {
    console.error('Erreur lecture access_token:', error);
    return null;
  }
};

/**
 * Récupère le refresh token depuis AsyncStorage
 */
const getRefreshToken = async () => {
  try {
    return await AsyncStorage.getItem('refresh_token');
  } catch (error) {
    console.error('Erreur lecture refresh_token:', error);
    return null;
  }
};

/**
 * Sauvegarde les tokens dans AsyncStorage
 */
const setTokens = async (accessToken, refreshToken) => {
  try {
    await AsyncStorage.setItem('access_token', accessToken);
    await AsyncStorage.setItem('refresh_token', refreshToken);
  } catch (error) {
    console.error('Erreur sauvegarde tokens:', error);
  }
};

/**
 * Supprime les tokens d'AsyncStorage
 */
const clearTokens = async () => {
  try {
    await AsyncStorage.removeItem('access_token');
    await AsyncStorage.removeItem('refresh_token');
  } catch (error) {
    console.error('Erreur suppression tokens:', error);
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

  const response = await fetch(url, {
    ...options,
    headers
  });

  // Gestion du 401 (token expiré)
  if (response.status === 401 && !options._retry) {
    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) {
        await clearTokens();
        throw new Error('No refresh token available');
      }

      // Rafraîchir le token
      const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
      });

      if (!refreshResponse.ok) {
        await clearTokens();
        throw new Error('Token refresh failed');
      }

      const refreshData = await refreshResponse.json();
      const session = refreshData?.data?.session || refreshData?.session;
      const accessToken = session?.access_token;
      const nextRefreshToken = session?.refresh_token;

      if (!accessToken || !nextRefreshToken) {
        await clearTokens();
        throw new Error('Invalid refresh response');
      }

      await setTokens(accessToken, nextRefreshToken);

      // Réessayer la requête originale
      return fetchWithAuth(url, { ...options, _retry: true });
    } catch (refreshError) {
      await clearTokens();
      throw refreshError;
    }
  }

  return response;
};

/**
 * Client API compatible avec l'interface axios
 */
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
