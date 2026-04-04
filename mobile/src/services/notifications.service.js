/**
 * Notifications Service — Mobile (Expo)
 * Gestion des permissions, tokens FCM et préférences
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '../config/supabase';
import API_BASE_URL from '../config/api';

// ── Configuration du handler foreground ──────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Demande les permissions et enregistre le token FCM
 * À appeler au démarrage de l'app (après connexion)
 * @returns {string|null} Le token Expo ou null si refusé
 */
export async function registerForPushNotifications() {
  if (!Device.isDevice) {
    console.warn('[notifications] Push notifications nécessitent un appareil physique');
    return null;
  }

  // Vérifier/demander les permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[notifications] Permission refusée par l\'utilisateur');
    return null;
  }

  // Canal Android (obligatoire pour Android 8+)
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Papyri',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#B5651D',
      sound: 'default',
    });
  }

  // Obtenir le token Expo
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
  });
  const token = tokenData.data;

  // Envoyer au backend
  await sendTokenToBackend(token);

  return token;
}

/**
 * Enregistre le token sur le backend (upsert)
 */
async function sendTokenToBackend(token) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    await fetch(`${API_BASE_URL}/api/notifications/fcm-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ token }),
    });
  } catch (err) {
    console.error('[notifications] sendTokenToBackend error:', err.message);
  }
}

/**
 * Révoque le token au moment de la déconnexion
 */
export async function revokePushToken() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    await fetch(`${API_BASE_URL}/api/notifications/fcm-token`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
  } catch (err) {
    console.error('[notifications] revokePushToken error:', err.message);
  }
}

/**
 * Récupère les préférences de notification
 */
export async function getPreferences() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return null;

  const response = await fetch(`${API_BASE_URL}/api/notifications/preferences`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  const data = await response.json();
  return data?.preferences || null;
}

/**
 * Met à jour les préférences
 */
export async function updatePreferences(prefs) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return null;

  const response = await fetch(`${API_BASE_URL}/api/notifications/preferences`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(prefs),
  });
  const data = await response.json();
  return data?.preferences || null;
}

/**
 * Récupère l'historique des notifications in-app
 */
export async function getNotifications({ limit = 20, offset = 0, unreadOnly = false } = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return [];

  const params = new URLSearchParams({ limit, offset, ...(unreadOnly && { unread: 'true' }) });
  const response = await fetch(`${API_BASE_URL}/api/notifications?${params}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  const data = await response.json();
  return {
    notifications: data?.notifications || [],
    unreadCount: data?.unreadCount || 0,
  };
}

/**
 * Marque une notification comme lue
 */
export async function markAsRead(notificationId) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return;

  await fetch(`${API_BASE_URL}/api/notifications/${notificationId}/read`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
}

/**
 * Marque toutes les notifications comme lues
 */
export async function markAllAsRead() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return;

  await fetch(`${API_BASE_URL}/api/notifications/read-all`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
}
