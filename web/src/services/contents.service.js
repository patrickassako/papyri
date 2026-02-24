// Service API pour les contenus et catégories
import { apiClient } from './api.client';
import { authFetch } from './auth.service';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Service de gestion des contenus (catalogue)
 */
export const contentsService = {
  /**
   * Liste les contenus avec filtres et pagination
   * @param {Object} params - Paramètres de requête
   * @param {number} [params.page=1] - Numéro de page
   * @param {number} [params.limit=20] - Éléments par page
   * @param {string} [params.content_type] - Type (ebook|audiobook)
   * @param {string} [params.language] - Langue (fr|en)
   * @param {string} [params.category] - Slug de catégorie
   * @param {string} [params.sort='published_at'] - Tri (published_at|title|created_at)
   * @param {string} [params.order='desc'] - Ordre (asc|desc)
   * @returns {Promise<{data: Array, meta: Object}>}
   */
  async getContents(params = {}) {
    const response = await apiClient.get('/api/contents', { params });
    // L'API retourne { success: true, data: { contents: [...], total, page, totalPages } }
    const result = response.data.data || response.data;
    return {
      data: result.contents || [],
      meta: {
        total: result.total || 0,
        page: result.page || 1,
        totalPages: result.totalPages || 1,
      }
    };
  },

  /**
   * Récupère les détails d'un contenu
   * @param {string} id - ID du contenu
   * @returns {Promise<Object>}
   */
  async getContentById(id) {
    const response = await apiClient.get(`/api/contents/${id}`);
    return response.data.data || response.data;
  },

  /**
   * Récupère les informations d'accès du contenu pour l'utilisateur connecté
   * @param {string} id - ID du contenu
   * @returns {Promise<Object>}
   */
  async getContentAccess(id) {
    const response = await authFetch(`${API_BASE_URL}/api/contents/${id}/access`);
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.error?.message || data?.message || 'Impossible de récupérer l\'accès au contenu.');
    }
    return data.data;
  },

  /**
   * Tente de débloquer un contenu (quota/bonus/paiement)
   * @param {string} id - ID du contenu
   * @returns {Promise<Object>}
   */
  async unlockContent(id) {
    const response = await authFetch(`${API_BASE_URL}/api/contents/${id}/unlock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const data = await response.json();

    if (response.status === 402) {
      return {
        success: false,
        paymentRequired: true,
        data: data?.data || {},
        message: data?.error?.message || data?.message || 'Paiement requis.',
      };
    }

    if (!response.ok || !data?.success) {
      throw new Error(data?.error?.message || data?.message || 'Impossible de débloquer le contenu.');
    }

    return {
      success: true,
      paymentRequired: false,
      data: data.data,
    };
  },

  /**
   * Vérifie un paiement Flutterwave pour déblocage de contenu
   * @param {string} id - ID du contenu
   * @param {{transactionId: string, reference: string}} params
   * @returns {Promise<Object>}
   */
  async verifyUnlockPayment(id, { transactionId, reference }) {
    const response = await authFetch(`${API_BASE_URL}/api/contents/${id}/unlock/verify-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transactionId,
        reference,
      }),
    });

    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.error?.message || data?.message || 'Impossible de vérifier le paiement.');
    }
    return data.data || {};
  },

  /**
   * Récupère une URL signée pour télécharger un fichier
   * @param {string} id - ID du contenu
   * @returns {Promise<{url: string, expiresAt: string}>}
   */
  async getContentFileUrl(id) {
    const response = await authFetch(`${API_BASE_URL}/api/contents/${id}/file-url`);
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.error?.message || data?.message || 'Impossible de récupérer le fichier sécurisé.');
    }
    return data.data;
  },

  /**
   * Liste toutes les catégories
   * @returns {Promise<Array>}
   */
  async getCategories() {
    const response = await apiClient.get('/api/categories');
    return response.data.data || response.data;
  },

  /**
   * Récupère les détails d'une catégorie par slug
   * @param {string} slug - Slug de la catégorie
   * @returns {Promise<Object>}
   */
  async getCategoryBySlug(slug) {
    const response = await apiClient.get(`/api/categories/${slug}`);
    return response.data.data || response.data;
  },

  /**
   * Recherche des contenus avec Meilisearch
   * @param {string} query - Terme de recherche
   * @param {Object} params - Filtres additionnels
   * @returns {Promise<{hits: Array, estimatedTotalHits: number}>}
   */
  async search(query, params = {}) {
    const response = await apiClient.get('/api/search', {
      params: { q: query, ...params }
    });
    // L'API retourne { success: true, data: { results: [...], total: X } }
    if (response.data.data) {
      return {
        hits: response.data.data.results || [],
        estimatedTotalHits: response.data.data.total || 0
      };
    }
    return response.data;
  }
};
