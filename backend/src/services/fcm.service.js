/**
 * FCM Service — Firebase Cloud Messaging
 * Supporte les tokens natifs FCM (firebase-admin)
 * et les Expo Push Tokens (proxy Expo en dev)
 */

const config = require('../config/env');

let firebaseApp = null;
let firebaseMessaging = null;

/**
 * Initialise Firebase Admin SDK (lazy, une seule fois)
 */
function getFirebaseMessaging() {
  if (firebaseMessaging) return firebaseMessaging;

  const { projectId, privateKey, clientEmail } = config.firebase || {};

  if (!projectId || !privateKey || !clientEmail) {
    console.warn('⚠️  Firebase non configuré (FIREBASE_PROJECT_ID / FIREBASE_PRIVATE_KEY / FIREBASE_CLIENT_EMAIL manquants)');
    return null;
  }

  try {
    const admin = require('firebase-admin');

    if (!firebaseApp) {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          privateKey: privateKey.replace(/\\n/g, '\n'),
          clientEmail,
        }),
      });
      console.log('✅ Firebase Admin SDK initialisé');
    }

    firebaseMessaging = admin.messaging(firebaseApp);
    return firebaseMessaging;
  } catch (err) {
    console.error('❌ Firebase Admin init error:', err.message);
    return null;
  }
}

/**
 * Retourne true si le token est un Expo Push Token
 */
function isExpoToken(token) {
  return token && token.startsWith('ExponentPushToken[');
}

/**
 * Envoie une notification via Expo Push API (dev / Expo Go)
 */
async function sendExpoNotification(token, { title, body, data = {} }) {
  const message = {
    to: token,
    sound: 'default',
    title,
    body,
    data,
    priority: 'high',
  };

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });

  const result = await response.json();

  if (result.data?.status === 'error') {
    throw new Error(`Expo push error: ${result.data.message}`);
  }

  return result;
}

/**
 * Envoie une notification via Firebase Admin SDK (production)
 */
async function sendFcmNotification(token, { title, body, data = {} }) {
  const messaging = getFirebaseMessaging();
  if (!messaging) throw new Error('Firebase non configuré');

  const stringifiedData = {};
  for (const [k, v] of Object.entries(data || {})) {
    stringifiedData[k] = String(v);
  }

  const message = {
    token,
    notification: { title, body },
    data: stringifiedData,
    android: {
      priority: 'high',
      notification: { sound: 'default', channelId: 'default' },
    },
    apns: {
      payload: { aps: { sound: 'default', badge: 1 } },
    },
  };

  return await messaging.send(message);
}

/**
 * Envoie une notification à un token (détecte auto le type)
 * @param {string} token — FCM token ou Expo Push Token
 * @param {{ title: string, body: string, data?: object }} payload
 */
async function sendToToken(token, payload) {
  if (!token) throw new Error('Token FCM manquant');

  if (isExpoToken(token)) {
    return await sendExpoNotification(token, payload);
  }

  return await sendFcmNotification(token, payload);
}

/**
 * Envoie une notification à plusieurs tokens (batch, ignore les erreurs individuelles)
 * @param {string[]} tokens
 * @param {{ title: string, body: string, data?: object }} payload
 * @returns {{ sent: number, failed: number, errors: string[] }}
 */
async function sendToMultipleTokens(tokens, payload) {
  const results = await Promise.allSettled(
    tokens.map((t) => sendToToken(t, payload))
  );

  let sent = 0;
  let failed = 0;
  const errors = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      sent++;
    } else {
      failed++;
      errors.push(result.reason?.message || 'unknown error');
    }
  }

  return { sent, failed, errors };
}

/**
 * Envoie une notification à topic (ex: "all_users")
 * Uniquement Firebase natif.
 */
async function sendToTopic(topic, payload) {
  const messaging = getFirebaseMessaging();
  if (!messaging) throw new Error('Firebase non configuré');

  const { title, body, data = {} } = payload;
  const stringifiedData = {};
  for (const [k, v] of Object.entries(data)) {
    stringifiedData[k] = String(v);
  }

  return await messaging.send({
    topic,
    notification: { title, body },
    data: stringifiedData,
    android: { priority: 'high', notification: { sound: 'default' } },
    apns: { payload: { aps: { sound: 'default' } } },
  });
}

function isConfigured() {
  const { projectId, privateKey, clientEmail } = config.firebase || {};
  return Boolean(projectId && privateKey && clientEmail);
}

module.exports = {
  sendToToken,
  sendToMultipleTokens,
  sendToTopic,
  isConfigured,
  getFirebaseMessaging,
};
