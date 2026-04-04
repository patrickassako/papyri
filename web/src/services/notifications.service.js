/**
 * Notifications Service — Web (Firebase)
 * Gestion des permissions, tokens FCM et historique
 */

import { authFetch } from './auth.service';

import { API_BASE_URL } from '../config/api';

const FIREBASE_CONFIG = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

let messagingInstance = null;

/**
 * Initialise Firebase Messaging (lazy)
 */
async function getMessaging() {
  if (messagingInstance) return messagingInstance;

  if (!FIREBASE_CONFIG.projectId || !FIREBASE_CONFIG.apiKey) {
    console.warn('[notifications] Firebase non configuré (variables VITE_FIREBASE_* manquantes)');
    return null;
  }

  const { initializeApp, getApps } = await import('firebase/app');
  const { getMessaging: getFCM, isSupported } = await import('firebase/messaging');

  const supported = await isSupported();
  if (!supported) {
    console.warn('[notifications] Firebase Messaging non supporté dans ce navigateur');
    return null;
  }

  const app = getApps().length > 0
    ? getApps()[0]
    : initializeApp(FIREBASE_CONFIG);

  messagingInstance = getFCM(app);
  return messagingInstance;
}

/**
 * Enregistre le service worker et transmet la config Firebase
 */
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;

  try {
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    // Transmettre la config au service worker
    if (reg.active) {
      reg.active.postMessage({ type: 'FIREBASE_CONFIG', config: FIREBASE_CONFIG });
    }

    return reg;
  } catch (err) {
    console.error('[notifications] Service worker registration failed:', err);
    return null;
  }
}

/**
 * Demande la permission et enregistre le token FCM
 * @returns {string|null} token ou null
 */
export async function requestPermissionAndRegister() {
  const messaging = await getMessaging();
  if (!messaging) return null;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    console.warn('[notifications] Permission refusée');
    return null;
  }

  await registerServiceWorker();

  const { getToken } = await import('firebase/messaging');
  const token = await getToken(messaging, { vapidKey: VAPID_KEY });

  if (token) {
    await sendTokenToBackend(token);
  }

  return token || null;
}

/**
 * Écoute les messages en foreground
 * @param {Function} callback — appelé avec { title, body, data }
 * @returns {Function} unsubscribe
 */
export async function onForegroundMessage(callback) {
  const messaging = await getMessaging();
  if (!messaging) return () => {};

  const { onMessage } = await import('firebase/messaging');
  return onMessage(messaging, (payload) => {
    const { title, body } = payload.notification || {};
    callback({ title, body, data: payload.data || {} });
  });
}

async function sendTokenToBackend(token) {
  try {
    await authFetch(`${API_BASE_URL}/api/notifications/fcm-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
  } catch (err) {
    console.error('[notifications] sendTokenToBackend error:', err.message);
  }
}

export async function revokeToken() {
  try {
    await authFetch(`${API_BASE_URL}/api/notifications/fcm-token`, { method: 'DELETE' });
  } catch (err) {
    console.error('[notifications] revokeToken error:', err.message);
  }
}

export async function getPreferences() {
  const response = await authFetch(`${API_BASE_URL}/api/notifications/preferences`);
  const data = await response.json();
  return data?.preferences || null;
}

export async function updatePreferences(prefs) {
  const response = await authFetch(`${API_BASE_URL}/api/notifications/preferences`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prefs),
  });
  const data = await response.json();
  return data?.preferences || null;
}

export async function getNotifications({ limit = 20, offset = 0, unreadOnly = false } = {}) {
  const params = new URLSearchParams({ limit, offset, ...(unreadOnly && { unread: 'true' }) });
  const response = await authFetch(`${API_BASE_URL}/api/notifications?${params}`);
  const data = await response.json();
  return {
    notifications: data?.notifications || [],
    unreadCount: data?.unreadCount || 0,
  };
}

export async function markAsRead(notificationId) {
  await authFetch(`${API_BASE_URL}/api/notifications/${notificationId}/read`, { method: 'PATCH' });
}

export async function markAllAsRead() {
  await authFetch(`${API_BASE_URL}/api/notifications/read-all`, { method: 'POST' });
}
