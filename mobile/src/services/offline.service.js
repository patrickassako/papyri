/**
 * Offline Service — Papyri
 * Téléchargement et lecture locale de contenus (ebooks + audio)
 */
import * as FileSystem from 'expo-file-system';
import * as Network from 'expo-network';
import AsyncStorage from '@react-native-async-storage/async-storage';

const OFFLINE_DIR = FileSystem.documentDirectory + 'offline/';
const META_KEY = '@papyri_offline_meta';

// ─── Helpers ───────────────────────────────────────────────────────

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(OFFLINE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(OFFLINE_DIR, { intermediates: true });
  }
}

async function readMeta() {
  try {
    const raw = await AsyncStorage.getItem(META_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function writeMeta(meta) {
  await AsyncStorage.setItem(META_KEY, JSON.stringify(meta));
}

function localPath(contentId, format) {
  const ext = format || 'bin';
  return OFFLINE_DIR + contentId + '.' + ext;
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
    const meta = await readMeta();
    const entry = meta[contentId];
    if (!entry) return false;
    if (entry.expiresAt && new Date(entry.expiresAt).getTime() <= Date.now()) return false;
    const info = await FileSystem.getInfoAsync(entry.filePath);
    return info.exists;
  } catch {
    return false;
  }
}

/**
 * Retourne le chemin local du fichier téléchargé, ou null si absent.
 * @param {string} contentId
 * @returns {Promise<string|null>}
 */
export async function getLocalFilePath(contentId) {
  try {
    const meta = await readMeta();
    const entry = meta[contentId];
    if (!entry) return null;
    if (entry.expiresAt && new Date(entry.expiresAt).getTime() <= Date.now()) return null;
    const info = await FileSystem.getInfoAsync(entry.filePath);
    return info.exists ? entry.filePath : null;
  } catch {
    return null;
  }
}

/**
 * Supprime les contenus dont la date d'expiration est dépassée.
 * @returns {Promise<number>} Nombre de fichiers supprimés
 */
export async function purgeExpiredContent() {
  const meta = await readMeta();
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
    await writeMeta(meta);
  }

  return expired.length;
}

/**
 * Retourne les métadonnées de tous les contenus téléchargés (non expirés, fichier existant).
 * Purge automatiquement les fichiers expirés.
 * @returns {Promise<Array>}
 */
export async function getDownloadedContents() {
  await purgeExpiredContent();

  const meta = await readMeta();
  const entries = Object.values(meta);
  // Vérifier que les fichiers existent encore
  const valid = await Promise.all(
    entries.map(async (e) => {
      const info = await FileSystem.getInfoAsync(e.filePath).catch(() => ({ exists: false }));
      return info.exists ? e : null;
    })
  );
  return valid.filter(Boolean);
}

/**
 * Calcule l'espace total utilisé par les téléchargements.
 * @returns {Promise<number>} Taille en octets
 */
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
export async function downloadContent({ contentId, url, format, title, type, onProgress }) {
  await ensureDir();

  const ext = format === 'audiobook' ? 'audio' : (format || 'epub');
  const filePath = localPath(contentId, ext);

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
  const meta = await readMeta();
  meta[contentId] = {
    contentId,
    title: title || 'Contenu',
    type: type || 'ebook',
    format: ext,
    filePath: result.uri,
    fileSize,
    downloadedAt: now.toISOString(),
    expiresAt,
  };
  await writeMeta(meta);

  return result.uri;
}

/**
 * Supprime un contenu téléchargé du stockage local.
 * @param {string} contentId
 */
export async function deleteDownloadedContent(contentId) {
  const meta = await readMeta();
  const entry = meta[contentId];
  if (entry) {
    await FileSystem.deleteAsync(entry.filePath, { idempotent: true }).catch(() => {});
    delete meta[contentId];
    await writeMeta(meta);
  }
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
