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

    const response = await fetch(`${API_BASE_URL}/subscriptions/status`, {
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
    return result.data;
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    throw error;
  }
}
