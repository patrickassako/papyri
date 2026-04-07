import { authFetch } from './auth.service';

import { API_BASE_URL } from '../config/api';

const MEMORY_FILE_CACHE = new Map();
const FILE_CACHE_NAME = 'papyri-reader-file-cache-v1';

const getCacheRequestUrl = (contentId, cacheKey) => {
  const suffix = encodeURIComponent(String(cacheKey || 'default'));
  return `${API_BASE_URL}/__reader_cache__/${encodeURIComponent(String(contentId))}?k=${suffix}`;
};

export const readingService = {
  async getSession(contentId) {
    const response = await authFetch(`${API_BASE_URL}/api/reading/${contentId}/session`);
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.error?.message || data?.message || 'Impossible de charger la session de lecture.');
    }
    return data.data;
  },

  async getChapters(contentId) {
    const response = await authFetch(`${API_BASE_URL}/api/reading/${contentId}/chapters`);
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.error?.message || data?.message || 'Impossible de charger les chapitres.');
    }
    return data.data;
  },

  async getChapterFileUrl(contentId, chapterId) {
    const response = await authFetch(`${API_BASE_URL}/api/reading/${contentId}/chapters/${chapterId}/file-url`);
    const contentType = response.headers.get('content-type') || '';
    let data;
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      await response.text();
      throw new Error(
        response.ok
          ? 'Réponse inattendue du serveur pour le chapitre.'
          : `Erreur serveur (${response.status}) lors du chargement du chapitre.`
      );
    }
    if (!response.ok || !data?.success) {
      throw new Error(data?.error?.message || data?.message || 'Impossible de charger le flux du chapitre.');
    }
    return data.data;
  },

  async saveProgress(contentId, { progressPercent, lastPosition, totalTimeSeconds }) {
    const response = await authFetch(`${API_BASE_URL}/api/reading/${contentId}/progress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        progress_percent: progressPercent,
        last_position: lastPosition ?? null,
        total_time_seconds: totalTimeSeconds ?? 0,
      }),
    });
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.error?.message || data?.message || 'Impossible de sauvegarder la progression.');
    }
    return data.data;
  },

  async getFileBuffer(contentId, onProgress = null, fallbackUrl = null, options = {}) {
    const cacheKey = options?.cacheKey || 'default';
    const memoryKey = `${contentId}:${cacheKey}`;

    const memoryHit = MEMORY_FILE_CACHE.get(memoryKey);
    if (memoryHit instanceof ArrayBuffer && memoryHit.byteLength > 0) {
      if (onProgress) onProgress(100);
      return memoryHit.slice(0);
    }

    const readFromPersistentCache = async () => {
      if (typeof window === 'undefined' || !('caches' in window)) return null;
      try {
        const cache = await window.caches.open(FILE_CACHE_NAME);
        const request = new Request(getCacheRequestUrl(contentId, cacheKey));
        const response = await cache.match(request);
        if (!response || !response.ok) return null;
        const buf = await response.arrayBuffer();
        if (!buf || buf.byteLength <= 0) return null;
        MEMORY_FILE_CACHE.set(memoryKey, buf);
        if (onProgress) onProgress(100);
        return buf.slice(0);
      } catch (_) {
        return null;
      }
    };

    const writeToPersistentCache = async (arrayBuffer) => {
      if (!(arrayBuffer instanceof ArrayBuffer) || arrayBuffer.byteLength <= 0) return;
      MEMORY_FILE_CACHE.set(memoryKey, arrayBuffer.slice(0));
      if (typeof window === 'undefined' || !('caches' in window)) return;
      try {
        const cache = await window.caches.open(FILE_CACHE_NAME);
        const request = new Request(getCacheRequestUrl(contentId, cacheKey));
        const response = new Response(arrayBuffer.slice(0), {
          headers: { 'Content-Type': 'application/octet-stream' },
        });
        await cache.put(request, response);
      } catch (_) {}
    };

    const persistentHit = await readFromPersistentCache();
    if (persistentHit) {
      return persistentHit;
    }

    const readResponseBuffer = async (response) => {
      const contentLength = response.headers.get('content-length');
      if (!onProgress || !contentLength || !response.body?.getReader) {
        const directBuffer = await response.arrayBuffer();
        await writeToPersistentCache(directBuffer);
        return directBuffer;
      }

      const total = parseInt(contentLength, 10);
      const reader = response.body.getReader();
      const chunks = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (total > 0) onProgress(Math.round((received / total) * 100));
      }

      const buffer = new Uint8Array(received);
      let position = 0;
      for (const chunk of chunks) {
        buffer.set(chunk, position);
        position += chunk.length;
      }
      const out = buffer.buffer;
      await writeToPersistentCache(out);
      return out;
    };

    const response = await authFetch(`${API_BASE_URL}/api/reading/${contentId}/file`);
    if (response.ok) {
      return readResponseBuffer(response);
    }

    let primaryMessage = 'Impossible de charger le fichier de lecture.';
    try {
      const data = await response.json();
      primaryMessage = data?.error?.message || data?.message || primaryMessage;
    } catch (_) {}

    // Fallback: fetch via signed URL when proxy endpoint fails.
    if (fallbackUrl) {
      try {
        const direct = await fetch(fallbackUrl);
        if (direct.ok) {
          const buf = await readResponseBuffer(direct);
          return buf;
        }
      } catch (_) {}
    }

    throw new Error(primaryMessage);
  },

  // ---- Highlights ----

  async getHighlights(contentId) {
    const response = await authFetch(`${API_BASE_URL}/api/reading/${contentId}/highlights`);
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.error?.message || 'Impossible de charger les surlignages.');
    }
    return data.data;
  },

  async createHighlight(contentId, { text, cfi_range, position, color, note }) {
    const response = await authFetch(`${API_BASE_URL}/api/reading/${contentId}/highlights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, cfi_range, position, color: color || 'yellow', note: note || null }),
    });
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.error?.message || 'Impossible de créer le surlignage.');
    }
    return data.data;
  },

  async deleteHighlight(contentId, highlightId) {
    const response = await authFetch(`${API_BASE_URL}/api/reading/${contentId}/highlights/${highlightId}`, {
      method: 'DELETE',
    });
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.error?.message || 'Impossible de supprimer le surlignage.');
    }
    return data;
  },

  // ---- Bookmarks ----

  async getBookmarks(contentId) {
    const response = await authFetch(`${API_BASE_URL}/api/reading/${contentId}/bookmarks`);
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.error?.message || 'Impossible de charger les marque-pages.');
    }
    return data.data;
  },

  async createBookmark(contentId, { position, label }) {
    const response = await authFetch(`${API_BASE_URL}/api/reading/${contentId}/bookmarks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ position, label: label || null }),
    });
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.error?.message || 'Impossible de créer le marque-page.');
    }
    return data.data;
  },

  async deleteBookmark(contentId, bookmarkId) {
    const response = await authFetch(`${API_BASE_URL}/api/reading/${contentId}/bookmarks/${bookmarkId}`, {
      method: 'DELETE',
    });
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.error?.message || 'Impossible de supprimer le marque-page.');
    }
    return data;
  },

  // ---- Audio playlist ----

  async getAudioPlaylist() {
    const response = await authFetch(`${API_BASE_URL}/api/reading/audio/playlist`);
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.error?.message || 'Impossible de charger la playlist audio.');
    }
    return data.data;
  },

  async addToAudioPlaylist(contentId) {
    const response = await authFetch(`${API_BASE_URL}/api/reading/audio/playlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content_id: contentId }),
    });
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.error?.message || "Impossible d'ajouter ce contenu à la playlist.");
    }
    return data.data;
  },

  async removeFromAudioPlaylist(contentId) {
    const response = await authFetch(`${API_BASE_URL}/api/reading/audio/playlist/${contentId}`, {
      method: 'DELETE',
    });
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.error?.message || 'Impossible de retirer ce contenu de la playlist.');
    }
    return data.data;
  },

  async reorderAudioPlaylist(contentIds) {
    const response = await authFetch(`${API_BASE_URL}/api/reading/audio/playlist/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content_ids: contentIds }),
    });
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.error?.message || 'Impossible de réordonner la playlist.');
    }
    return data.data;
  },

  // ---- Ebook reading list ----

  async getEbookList() {
    const response = await authFetch(`${API_BASE_URL}/api/reading/ebook/list`);
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.error?.message || 'Impossible de charger la liste de lecture.');
    }
    return data.data;
  },

  async addToEbookList(contentId) {
    const response = await authFetch(`${API_BASE_URL}/api/reading/ebook/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content_id: contentId }),
    });
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.error?.message || 'Impossible d\'ajouter à la liste de lecture.');
    }
    return data;
  },

  async removeFromEbookList(contentId) {
    const response = await authFetch(`${API_BASE_URL}/api/reading/ebook/list/${contentId}`, {
      method: 'DELETE',
    });
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.error?.message || 'Impossible de retirer de la liste de lecture.');
    }
    return data;
  },

  // ---- Reviews / Avis ----

  async getReviews(contentId) {
    const response = await fetch(`${API_BASE_URL}/api/reading/reviews/${contentId}`, {
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.error?.message || 'Impossible de charger les avis.');
    }
    return data.data;
  },

  async submitReview(contentId, { rating, body }) {
    const response = await authFetch(`${API_BASE_URL}/api/reading/reviews/${contentId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, body }),
    });
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.error?.message || 'Impossible de soumettre votre avis.');
    }
    return data.data;
  },

  async deleteReview(contentId) {
    const response = await authFetch(`${API_BASE_URL}/api/reading/reviews/${contentId}`, {
      method: 'DELETE',
    });
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.error?.message || 'Impossible de supprimer votre avis.');
    }
    return data;
  },
};
