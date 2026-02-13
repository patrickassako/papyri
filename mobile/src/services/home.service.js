/**
 * Service pour la page d'accueil
 * Connecte le mobile avec l'endpoint GET /home
 */

import { supabase } from '../config/supabase';
import API_BASE_URL from '../config/api';

/**
 * Récupère les données de la page d'accueil
 * - Contenus en cours de lecture (continue_reading)
 * - Nouveautés (new_releases)
 * - Populaires (popular)
 * - Recommandations (recommended)
 *
 * @returns {Promise<Object>} Données de la page d'accueil
 */
export async function getHomeData() {
  try {
    // Récupérer le token d'accès Supabase
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }

    // Appeler l'endpoint /home du backend
    const url = `${API_BASE_URL}/home`;
    console.log('🔍 [home.service] Calling:', url);
    console.log('🔑 [home.service] Token:', session.access_token.substring(0, 20) + '...');

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    console.log('📡 [home.service] Response status:', response.status);

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Session expired');
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    // L'API retourne { success: true, data: { continue_reading, new_releases, popular, recommended } }
    if (result.success && result.data) {
      return result.data;
    }

    throw new Error('Invalid response format');
  } catch (error) {
    console.error('Error fetching home data:', error);
    throw error;
  }
}

/**
 * Récupère l'historique de lecture complet
 * @param {number} page - Numéro de page
 * @param {number} limit - Nombre d'éléments par page
 * @returns {Promise<Object>} Historique de lecture avec pagination
 */
export async function getReadingHistory(page = 1, limit = 20) {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `${API_BASE_URL}/reading-history?page=${page}&limit=${limit}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error fetching reading history:', error);
    throw error;
  }
}

/**
 * Récupère la position de lecture pour un contenu spécifique
 * @param {string} contentId - ID du contenu
 * @returns {Promise<Object>} Position de lecture
 */
export async function getReadingPosition(contentId) {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `${API_BASE_URL}/reading-history/${contentId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Pas encore de position enregistrée
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Error fetching reading position:', error);
    throw error;
  }
}

/**
 * Sauvegarde la position de lecture
 * @param {string} contentId - ID du contenu
 * @param {Object} data - Données de progression
 * @param {number} data.progress_percent - Pourcentage de progression
 * @param {Object} data.last_position - Dernière position (chapter/cfi pour ebook, position_seconds pour audio)
 * @returns {Promise<Object>} Résultat de la sauvegarde
 */
export async function saveReadingPosition(contentId, data) {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `${API_BASE_URL}/reading-history/${contentId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(data),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error saving reading position:', error);
    throw error;
  }
}
