import API_BASE_URL from '../config/api';
import { authFetch } from './auth.service';

async function request(path, options = {}) {
  const response = await authFetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || `HTTP ${response.status}`;
    const error = new Error(message);
    error.response = { status: response.status, data: payload };
    throw error;
  }

  return payload;
}

async function requestRaw(path, options = {}) {
  const response = await authFetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    let payload = {};
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }
    const message = payload?.error?.message || payload?.message || `HTTP ${response.status}`;
    const error = new Error(message);
    error.response = { status: response.status, data: payload };
    throw error;
  }

  return response;
}

export const readingService = {
  async getSession(contentId) {
    const payload = await request(`/api/reading/${contentId}/session`, { method: 'GET' });
    if (!payload?.success) {
      throw new Error(payload?.error?.message || payload?.message || 'Impossible de charger la session de lecture.');
    }
    return payload.data;
  },

  async getContentFile(contentId) {
    const response = await requestRaw(`/api/reading/${contentId}/file`, {
      method: 'GET',
      headers: {
        Accept: 'text/plain, text/html, application/xhtml+xml, application/xml, */*',
      },
    });

    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    const text = await response.text();
    return { contentType, text };
  },

  async getContentFileArrayBuffer(contentId) {
    const response = await requestRaw(`/api/reading/${contentId}/file`, {
      method: 'GET',
      headers: {
        Accept: 'application/epub+zip, application/pdf, application/octet-stream, */*',
      },
    });
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    const buffer = await response.arrayBuffer();
    return { contentType, buffer };
  },

  async getChapters(contentId) {
    const payload = await request(`/api/reading/${contentId}/chapters`, { method: 'GET' });
    if (!payload?.success) {
      throw new Error(payload?.error?.message || payload?.message || 'Impossible de charger les chapitres.');
    }
    return payload.data;
  },

  async getChapterFileUrl(contentId, chapterId) {
    const payload = await request(`/api/reading/${contentId}/chapters/${chapterId}/file-url`, { method: 'GET' });
    if (!payload?.success) {
      throw new Error(payload?.error?.message || payload?.message || 'Impossible de charger le flux du chapitre.');
    }
    return payload.data;
  },

  async saveProgress(contentId, { progressPercent, lastPosition, totalTimeSeconds }) {
    const payload = await request(`/api/reading/${contentId}/progress`, {
      method: 'POST',
      body: JSON.stringify({
        progress_percent: progressPercent,
        last_position: lastPosition ?? null,
        total_time_seconds: totalTimeSeconds ?? 0,
      }),
    });

    if (!payload?.success) {
      throw new Error(payload?.error?.message || payload?.message || 'Impossible de sauvegarder la progression.');
    }
    return payload.data;
  },

  async getAudioPlaylist() {
    const payload = await request('/api/reading/audio/playlist', { method: 'GET' });
    if (!payload?.success) {
      throw new Error(payload?.error?.message || 'Impossible de charger la playlist audio.');
    }
    return payload.data;
  },

  async addToAudioPlaylist(contentId) {
    const payload = await request('/api/reading/audio/playlist', {
      method: 'POST',
      body: JSON.stringify({ content_id: contentId }),
    });
    if (!payload?.success) {
      throw new Error(payload?.error?.message || "Impossible d'ajouter ce contenu à la playlist.");
    }
    return payload.data;
  },

  async removeFromAudioPlaylist(contentId) {
    const payload = await request(`/api/reading/audio/playlist/${contentId}`, {
      method: 'DELETE',
    });
    if (!payload?.success) {
      throw new Error(payload?.error?.message || 'Impossible de retirer ce contenu de la playlist.');
    }
    return payload.data;
  },

  async reorderAudioPlaylist(contentIds) {
    const payload = await request('/api/reading/audio/playlist/reorder', {
      method: 'PUT',
      body: JSON.stringify({ content_ids: contentIds }),
    });
    if (!payload?.success) {
      throw new Error(payload?.error?.message || 'Impossible de réordonner la playlist.');
    }
    return payload.data;
  },

  async getHistory({ page = 1, limit = 20 } = {}) {
    const payload = await request(`/reading-history?page=${page}&limit=${limit}`, { method: 'GET' });
    return {
      items: payload.data || [],
      pagination: payload.pagination || { page, limit, total: 0, total_pages: 0 },
      stats: payload.stats || null,
    };
  },

  // ── Bookmarks ──────────────────────────────────────────

  async getBookmarks(contentId) {
    const payload = await request(`/api/reading/${contentId}/bookmarks`, { method: 'GET' });
    if (!payload?.success) throw new Error(payload?.error?.message || 'Impossible de charger les marque-pages.');
    return payload.data;
  },

  async addBookmark(contentId, position, label) {
    const payload = await request(`/api/reading/${contentId}/bookmarks`, {
      method: 'POST',
      body: JSON.stringify({ position, label: label || null }),
    });
    if (!payload?.success) throw new Error(payload?.error?.message || "Impossible d'ajouter le marque-page.");
    return payload.data;
  },

  async deleteBookmark(contentId, bookmarkId) {
    const payload = await request(`/api/reading/${contentId}/bookmarks/${bookmarkId}`, { method: 'DELETE' });
    if (!payload?.success) throw new Error(payload?.error?.message || 'Impossible de supprimer le marque-page.');
    return payload.data;
  },

  // ── Highlights ─────────────────────────────────────────

  async getHighlights(contentId) {
    const payload = await request(`/api/reading/${contentId}/highlights`, { method: 'GET' });
    if (!payload?.success) throw new Error(payload?.error?.message || 'Impossible de charger les surlignages.');
    return payload.data;
  },

  async addHighlight(contentId, { text, cfiRange, position, color, note }) {
    const payload = await request(`/api/reading/${contentId}/highlights`, {
      method: 'POST',
      body: JSON.stringify({ text, cfi_range: cfiRange, position, color: color || 'yellow', note: note || null }),
    });
    if (!payload?.success) throw new Error(payload?.error?.message || "Impossible d'ajouter le surlignage.");
    return payload.data;
  },

  async deleteHighlight(contentId, highlightId) {
    const payload = await request(`/api/reading/${contentId}/highlights/${highlightId}`, { method: 'DELETE' });
    if (!payload?.success) throw new Error(payload?.error?.message || 'Impossible de supprimer le surlignage.');
    return payload.data;
  },

  // ── Liste de lecture / Favoris ─────────────────────────────────────────

  async getReadingList() {
    const payload = await request('/api/reading/ebook/list', { method: 'GET' });
    if (!payload?.success) return [];
    return payload?.data?.items || [];
  },

  async addToReadingList(contentId) {
    const payload = await request('/api/reading/ebook/list', {
      method: 'POST',
      body: JSON.stringify({ content_id: contentId }),
    });
    if (!payload?.success) throw new Error(payload?.error?.message || "Impossible d'ajouter aux favoris.");
    return payload.data;
  },

  async removeFromReadingList(contentId) {
    const payload = await request(`/api/reading/ebook/list/${contentId}`, { method: 'DELETE' });
    if (!payload?.success) throw new Error(payload?.error?.message || 'Impossible de retirer des favoris.');
    return payload.data;
  },
};
