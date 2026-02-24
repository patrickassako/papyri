// Service API pour les contenus et catégories (Mobile)
import API_BASE_URL from '../config/api';
import { authFetch } from './auth.service';
import { apiClient } from './api.client';

let fallbackCatalogCache = [];
let fallbackCatalogCacheAt = 0;
const FALLBACK_CACHE_TTL_MS = 5 * 60 * 1000;

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
   * @param {string} [params.sort='published_at'] - Tri
   * @param {string} [params.order='desc'] - Ordre
   * @returns {Promise<{data: Array, meta: Object}>}
   */
  async getContents(params = {}) {
    const response = await apiClient.get('/api/contents', { params });
    // L'API retourne { success: true, data: { contents: [...], total, page, totalPages } }
    if (response.data.data) {
      const { contents = [], total = 0, page = 1, totalPages = 0 } = response.data.data;
      return {
        data: contents,
        meta: { total, page, totalPages }
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
   * Récupère les droits d'accès sur un contenu pour l'utilisateur courant
   * @param {string} id - ID du contenu
   * @returns {Promise<Object>}
   */
  async getContentAccess(id) {
    const response = await authFetch(`${API_BASE_URL}/api/contents/${id}/access`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload?.error?.message || `HTTP ${response.status}`);
      error.response = { status: response.status, data: payload };
      throw error;
    }

    return payload?.data || payload;
  },

  /**
   * Tente de débloquer un contenu via quota, bonus, puis paiement
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

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload?.error?.message || `HTTP ${response.status}`);
      error.response = { status: response.status, data: payload };
      throw error;
    }

    return payload;
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
    // L'API retourne { success: true, data: [...] }
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
    const q = String(query || '').trim();
    if (!q) {
      return { hits: [], estimatedTotalHits: 0 };
    }

    try {
      const response = await apiClient.get('/api/search', {
        params: { q, ...params }
      });
      // L'API retourne { success: true, data: { results: [...], total: X } }
      if (response.data.data) {
        return {
          hits: response.data.data.results || [],
          estimatedTotalHits: response.data.data.total || 0
        };
      }
      return response.data;
    } catch (error) {
      // Fallback robuste: si le moteur de recherche est indisponible,
      // on bascule sur un filtrage local d'un snapshot catalogue.
      const now = Date.now();
      if (!Array.isArray(fallbackCatalogCache) || fallbackCatalogCache.length === 0 || (now - fallbackCatalogCacheAt) > FALLBACK_CACHE_TTL_MS) {
        const catalog = await contentsService.getContents({ page: 1, limit: 200, sort: 'published_at', order: 'desc' });
        fallbackCatalogCache = Array.isArray(catalog?.data) ? catalog.data : [];
        fallbackCatalogCacheAt = now;
      }

      const needle = q.toLowerCase();
      const hits = fallbackCatalogCache.filter((item) => {
        const title = String(item?.title || '').toLowerCase();
        const author = String(item?.author || '').toLowerCase();
        return title.includes(needle) || author.includes(needle);
      });

      return {
        hits,
        estimatedTotalHits: hits.length,
      };
    }
  }
};
