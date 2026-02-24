/**
 * Service pour la gestion du profil utilisateur
 * Connecte le mobile avec l'endpoint GET /users/me
 */

import { supabase } from '../config/supabase';
import API_BASE_URL from '../config/api';

/**
 * Récupère le profil complet de l'utilisateur connecté
 * Inclut : id, email, full_name, role, language, onboarding_completed, subscription
 *
 * @returns {Promise<Object>} Profil utilisateur
 */
export async function getUserProfile() {
  try {
    // Récupérer le token d'accès Supabase
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }

    // Appeler l'endpoint /users/me du backend
    const url = `${API_BASE_URL}/users/me`;
    console.log('🔍 [user.service] Calling:', url);
    console.log('🔑 [user.service] Token:', session.access_token.substring(0, 20) + '...');

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    console.log('📡 [user.service] Response status:', response.status);

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Session expired');
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    // L'API retourne { success: true, data: { id, email, full_name, ... } }
    if (result.success && result.data) {
      return result.data;
    }

    throw new Error('Invalid response format');
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw error;
  }
}

/**
 * Met à jour le profil utilisateur
 * @param {Object} updates - Champs à mettre à jour
 * @param {string} [updates.full_name] - Nom complet
 * @param {string} [updates.language] - Langue (fr, en)
 * @returns {Promise<Object>} Profil mis à jour
 */
export async function updateUserProfile(updates) {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_BASE_URL}/users/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
}

/**
 * Change le mot de passe utilisateur
 * @param {Object} payload
 * @param {string} payload.current_password
 * @param {string} payload.new_password
 * @returns {Promise<{success: boolean}>}
 */
export async function changePassword(payload) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_BASE_URL}/users/me/password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.success) {
      throw new Error(result?.error?.message || result?.message || `HTTP ${response.status}`);
    }
    return { success: true };
  } catch (error) {
    console.error('Error changing password:', error);
    throw error;
  }
}

/**
 * Upload avatar utilisateur (multipart/form-data)
 * @param {{ uri: string, name?: string, type?: string }} file
 * @returns {Promise<Object>} Profil mis à jour
 */
export async function uploadAvatar(file) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }

    if (!file?.uri) {
      throw new Error('Fichier image manquant');
    }

    const form = new FormData();
    const normalizedName = file.name || `avatar-${Date.now()}.jpg`;
    const normalizedType = file.type || 'image/jpeg';

    if (String(file.uri || '').startsWith('data:')) {
      const blob = await fetch(file.uri).then((r) => r.blob());
      form.append('avatar', blob, normalizedName);
    } else {
      form.append('avatar', {
        uri: file.uri,
        name: normalizedName,
        type: normalizedType,
      });
    }

    const response = await fetch(`${API_BASE_URL}/users/me/avatar`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: form,
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.success) {
      throw new Error(result?.error?.message || result?.message || `HTTP ${response.status}`);
    }

    return result?.data || null;
  } catch (error) {
    console.error('Error uploading avatar:', error);
    throw error;
  }
}

/**
 * Marque l'onboarding comme terminé
 * @returns {Promise<Object>} Résultat
 */
export async function completeOnboarding() {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_BASE_URL}/users/me/onboarding-complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error completing onboarding:', error);
    throw error;
  }
}

/**
 * Récupère le statut de l'abonnement
 * @returns {Promise<Object>} Statut de l'abonnement
 */
export async function getSubscriptionStatus() {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_BASE_URL}/api/subscriptions/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    throw error;
  }
}
