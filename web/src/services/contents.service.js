// Service API pour les contenus et catégories
import { apiClient } from './api.client';

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
    // L'API retourne { success: true, data: { contents: [...], meta: {...} } }
    if (response.data.data) {
      return {
        data: response.data.data.contents || [],
        meta: response.data.data.meta || {}
      };
    }
    return response.data;
  },

  /**
   * Récupère les détails d'un contenu
   * @param {string} id - ID du contenu
   * @returns {Promise<Object>}
   */
  async getContentById(id) {
    const response = await apiClient.get(`/api/contents/${id}`);
    return response.data;
  },

  /**
   * Récupère une URL signée pour télécharger un fichier
   * @param {string} id - ID du contenu
   * @returns {Promise<{url: string, expiresAt: string}>}
   */
  async getContentFileUrl(id) {
    const response = await apiClient.get(`/api/contents/${id}/file-url`);
    return response.data;
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
    return response.data;
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
