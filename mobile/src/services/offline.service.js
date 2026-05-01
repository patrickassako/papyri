/**
 * Offline Service — Papyri
 * Téléchargement et lecture locale de contenus (ebooks + audio)
 */
import * as FileSystem from 'expo-file-system';
import * as Network from 'expo-network';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getProxiedImageUrl } from '../utils/imageProxy';
import { supabase } from '../config/supabase';

const OFFLINE_DIR_BASE = FileSystem.documentDirectory + 'offline/';

// ─── Clés scopées par utilisateur ─────────────────────────────────

async function getCurrentUserId() {
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.user?.id) return data.session.user.id;
  } catch {}
  return 'anonymous';
}

function metaKey(userId) {
  return `@papyri_offline_meta_${userId}`;
}

function offlineDir(userId) {
  return `${OFFLINE_DIR_BASE}${userId}/`;
}

// ─── Helpers ───────────────────────────────────────────────────────

async function ensureDir(userId) {
  const dir = offlineDir(userId);
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

async function readMeta(userId) {
  try {
    const raw = await AsyncStorage.getItem(metaKey(userId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function writeMeta(userId, meta) {
  await AsyncStorage.setItem(metaKey(userId), JSON.stringify(meta));
}

function localPath(userId, contentId, format) {
  const ext = format || 'bin';
  return offlineDir(userId) + contentId + '.' + ext;
}

// Migre les données stockées sous 'anonymous' vers le vrai userId
async function migrateAnonymousData(uid) {
  if (uid === 'anonymous') return;
  try {
    const anonMeta = await readMeta('anonymous');
    if (Object.keys(anonMeta).length === 0) return;

    await ensureDir(uid);
    const userMeta = await readMeta(uid);
    const anonDir = offlineDir('anonymous');
    const userDir = offlineDir(uid);

    for (const entry of Object.values(anonMeta)) {
      if (userMeta[entry.contentId]) continue; // déjà migré

      // Migrer le fichier principal
      if (entry.filePath) {
        const newPath = entry.filePath.replace(anonDir, userDir);
        const info = await FileSystem.getInfoAsync(entry.filePath);
        if (info.exists) {
          await FileSystem.moveAsync({ from: entry.filePath, to: newPath }).catch(() => {});
          entry.filePath = newPath;
        }
      }

      // Migrer les chapitres audio
      if (Array.isArray(entry.chapters)) {
        for (const ch of entry.chapters) {
          if (ch.filePath) {
            const newChPath = ch.filePath.replace(anonDir, userDir);
            const info = await FileSystem.getInfoAsync(ch.filePath);
            if (info.exists) {
              await FileSystem.moveAsync({ from: ch.filePath, to: newChPath }).catch(() => {});
              ch.filePath = newChPath;
            }
          }
        }
      }

      userMeta[entry.contentId] = entry;
    }

    await writeMeta(uid, userMeta);
    await AsyncStorage.removeItem(metaKey('anonymous'));
    await FileSystem.deleteAsync(anonDir, { idempotent: true }).catch(() => {});
  } catch {}
}

// ─── API publique ──────────────────────────────────────────────────

/**
 * Vérifie si le réseau est disponible.
 * @returns {Promise<boolean>}
 */
export async function isOnline() {
  try {
    const state = await Network.getNetworkStateAsync();
    return state.isConnected === true && state.isInternetReachable !== false;
  } catch {
    return true; // optimistic default
  }
}

/**
 * Vérifie si un contenu est déjà téléchargé et le fichier local existe.
 * @param {string} contentId
 * @returns {Promise<boolean>}
 */
export async function isContentDownloaded(contentId) {
  try {
    const uid = await getCurrentUserId();
    const meta = await readMeta(uid);
    const entry = meta[contentId];
    if (!entry) return false;
    if (entry.expiresAt && new Date(entry.expiresAt).getTime() <= Date.now()) return false;
    const info = await FileSystem.getInfoAsync(entry.filePath);
    return info.exists;
  } catch {
    return false;
  }
}

export async function getLocalFilePath(contentId) {
  try {
    const uid = await getCurrentUserId();
    const meta = await readMeta(uid);
    const entry = meta[contentId];
    if (!entry) return null;
    if (entry.expiresAt && new Date(entry.expiresAt).getTime() <= Date.now()) return null;
    const info = await FileSystem.getInfoAsync(entry.filePath);
    return info.exists ? entry.filePath : null;
  } catch {
    return null;
  }
}

export async function getOfflineEntry(contentId) {
  try {
    const uid = await getCurrentUserId();
    const meta = await readMeta(uid);
    const entry = meta[contentId];
    if (!entry) return null;
    if (entry.expiresAt && new Date(entry.expiresAt).getTime() <= Date.now()) return null;
    const info = await FileSystem.getInfoAsync(entry.filePath);
    return info.exists ? entry : null;
  } catch {
    return null;
  }
}

export async function purgeExpiredContent() {
  const uid = await getCurrentUserId();
  const meta = await readMeta(uid);
  const now = Date.now();
  const expired = Object.values(meta).filter(
    (e) => e.expiresAt && new Date(e.expiresAt).getTime() <= now
  );

  await Promise.all(
    expired.map(async (e) => {
      await FileSystem.deleteAsync(e.filePath, { idempotent: true }).catch(() => {});
      delete meta[e.contentId];
    })
  );

  if (expired.length > 0) {
    await writeMeta(uid, meta);
  }

  return expired.length;
}

export async function getDownloadedContents() {
  const uid = await getCurrentUserId();
  await migrateAnonymousData(uid);
  await purgeExpiredContent();
  const meta = await readMeta(uid);
  const entries = Object.values(meta);
  const valid = await Promise.all(
    entries.map(async (e) => {
      const info = await FileSystem.getInfoAsync(e.filePath).catch(() => ({ exists: false }));
      return info.exists ? e : null;
    })
  );
  return valid.filter(Boolean);
}

export async function getStorageUsage() {
  const contents = await getDownloadedContents();
  return contents.reduce((sum, e) => sum + (e.fileSize || 0), 0);
}

/**
 * Télécharge un contenu vers le stockage local.
 * @param {object} options
 * @param {string} options.contentId
 * @param {string} options.url - URL signée du fichier
 * @param {string} options.format - 'epub' | 'pdf' | 'mp3' | 'm4a' | 'audio'
 * @param {string} options.title
 * @param {string} options.type - 'ebook' | 'audiobook'
 * @param {function} [options.onProgress] - callback(percent: 0-100)
 * @returns {Promise<string>} chemin local du fichier
 */
export async function downloadContent({ contentId, url, format, title, author, cover_url, type, onProgress }) {
  const uid = await getCurrentUserId();
  await ensureDir(uid);

  const ext = format === 'audiobook' ? 'audio' : (format || 'epub');
  const filePath = localPath(uid, contentId, ext);

  // Supprimer l'ancien fichier si existe
  const existing = await FileSystem.getInfoAsync(filePath);
  if (existing.exists) {
    await FileSystem.deleteAsync(filePath, { idempotent: true });
  }

  const downloadResumable = FileSystem.createDownloadResumable(
    url,
    filePath,
    {},
    (progress) => {
      if (onProgress && progress.totalBytesExpectedToWrite > 0) {
        const pct = Math.round(
          (progress.totalBytesWritten / progress.totalBytesExpectedToWrite) * 100
        );
        onProgress(pct);
      }
    }
  );

  const result = await downloadResumable.downloadAsync();
  if (!result || !result.uri) {
    throw new Error('Téléchargement échoué.');
  }

  // Récupérer la taille du fichier
  const fileInfo = await FileSystem.getInfoAsync(result.uri, { size: true });
  const fileSize = fileInfo.size || 0;

  // Sauvegarder les métadonnées (expiration 30 jours)
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const meta = await readMeta(uid);
  meta[contentId] = {
    contentId,
    title: title || 'Contenu',
    author: author || '',
    cover_url: getProxiedImageUrl(cover_url) || '',
    type: type || 'ebook',
    format: ext,
    filePath: result.uri,
    fileSize,
    downloadedAt: now.toISOString(),
    expiresAt,
  };
  await writeMeta(uid, meta);

  return result.uri;
}

/**
 * Supprime un contenu téléchargé du stockage local.
 * @param {string} contentId
 */
export async function deleteDownloadedContent(contentId) {
  const uid = await getCurrentUserId();
  const meta = await readMeta(uid);
  const entry = meta[contentId];
  if (entry) {
    if (entry.filePath) {
      await FileSystem.deleteAsync(entry.filePath, { idempotent: true }).catch(() => {});
    }
    if (Array.isArray(entry.chapters)) {
      await Promise.all(
        entry.chapters.map((ch) =>
          ch.filePath ? FileSystem.deleteAsync(ch.filePath, { idempotent: true }).catch(() => {}) : Promise.resolve()
        )
      );
    }
    delete meta[contentId];
    await writeMeta(uid, meta);
  }
}

/**
 * Retourne le chemin local d'un chapitre spécifique téléchargé.
 * @param {string} contentId
 * @param {string|number} chapterId
 * @returns {Promise<string|null>}
 */
export async function getLocalChapterPath(contentId, chapterId) {
  try {
    const uid = await getCurrentUserId();
    const meta = await readMeta(uid);
    const entry = meta[contentId];
    if (!entry) return null;
    if (entry.expiresAt && new Date(entry.expiresAt).getTime() <= Date.now()) return null;
    if (!Array.isArray(entry.chapters)) return null;
    const chapter = entry.chapters.find((ch) => String(ch.chapterId) === String(chapterId));
    if (!chapter?.filePath) return null;
    const info = await FileSystem.getInfoAsync(chapter.filePath);
    return info.exists ? chapter.filePath : null;
  } catch {
    return null;
  }
}

/**
 * Télécharge tous les chapitres d'un audiobook.
 * @param {object} options
 * @param {string} options.contentId
 * @param {Array} options.chapters - [{ id, title, index }]
 * @param {Function} options.getChapterUrl - async (chapterId) => string
 * @param {string} options.title
 * @param {string} options.author
 * @param {string} options.cover_url
 * @param {number} options.duration_seconds
 * @param {Function} [options.onProgress] - (percent: 0-100)
 * @returns {Promise<void>}
 */
export async function downloadAudiobookChapters({
  contentId, chapters, getChapterUrl, title, author, cover_url, duration_seconds, onProgress,
}) {
  const uid = await getCurrentUserId();
  await ensureDir(uid);

  const total = chapters.length;
  const downloadedChapters = [];
  let totalSize = 0;

  for (let i = 0; i < total; i++) {
    const chapter = chapters[i];
    const chapterUrl = await getChapterUrl(chapter.id);
    if (!chapterUrl) continue;

    const filePath = offlineDir(uid) + contentId + '_ch' + (chapter.index || i + 1) + '.audio';

    // Supprimer l'ancien si existe
    const existing = await FileSystem.getInfoAsync(filePath);
    if (existing.exists) {
      await FileSystem.deleteAsync(filePath, { idempotent: true });
    }

    const downloadResumable = FileSystem.createDownloadResumable(
      chapterUrl,
      filePath,
      {},
      (progress) => {
        if (onProgress && progress.totalBytesExpectedToWrite > 0) {
          // Progression globale = chapitres terminés + avancement du chapitre courant
          const chapterPct = progress.totalBytesWritten / progress.totalBytesExpectedToWrite;
          const globalPct = Math.round(((i + chapterPct) / total) * 100);
          onProgress(globalPct);
        }
      }
    );

    const result = await downloadResumable.downloadAsync();
    if (!result?.uri) throw new Error(`Téléchargement du chapitre ${i + 1} échoué.`);

    const fileInfo = await FileSystem.getInfoAsync(result.uri, { size: true });
    totalSize += fileInfo.size || 0;

    downloadedChapters.push({
      chapterId: chapter.id,
      index: chapter.index || i + 1,
      title: chapter.title || `Chapitre ${i + 1}`,
      filePath: result.uri,
    });
  }

  // Sauvegarder les métadonnées
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const meta = await readMeta(uid);
  meta[contentId] = {
    contentId,
    title: title || 'Audiobook',
    author: author || '',
    cover_url: getProxiedImageUrl(cover_url) || '',
    type: 'audiobook',
    format: 'audio',
    filePath: downloadedChapters[0]?.filePath || null,
    chapters: downloadedChapters,
    fileSize: totalSize,
    duration_seconds: duration_seconds || 0,
    downloadedAt: now.toISOString(),
    expiresAt,
  };
  await writeMeta(uid, meta);
}

/**
 * Formate une taille en octets en chaîne lisible.
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 o';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}
