import { authFetch } from './auth.service';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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

  async getFileBuffer(contentId, onProgress = null) {
    const response = await authFetch(`${API_BASE_URL}/api/reading/${contentId}/file`);
    if (!response.ok) {
      let message = 'Impossible de charger le fichier de lecture.';
      try {
        const data = await response.json();
        message = data?.error?.message || data?.message || message;
      } catch (_) {}
      throw new Error(message);
    }

    // If no progress callback or no content-length, fallback to simple arrayBuffer
    const contentLength = response.headers.get('content-length');
    if (!onProgress || !contentLength) {
      return response.arrayBuffer();
    }

    // Stream with progress tracking
    const total = parseInt(contentLength, 10);
    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      received += value.length;

      // Call progress callback with percentage
      if (onProgress && total > 0) {
        onProgress(Math.round((received / total) * 100));
      }
    }

    // Combine all chunks into a single ArrayBuffer
    const buffer = new Uint8Array(received);
    let position = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, position);
      position += chunk.length;
    }

    return buffer.buffer;
  },
};
