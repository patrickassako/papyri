/**
 * Notifications Service
 * Gestion des tokens FCM, préférences, et envoi de notifications
 */

const { supabaseAdmin } = require('../config/database');
const fcmService = require('./fcm.service');

// ── Types de notifications ────────────────────────────────────
const NOTIFICATION_TYPES = {
  NEW_CONTENT:           'new_content',
  EXPIRATION_REMINDER:   'expiration_reminder',
  SUBSCRIPTION_EXPIRED:  'subscription_expired',
  PAYMENT_FAILED:        'payment_failed',
  SUBSCRIPTION_UPDATE:   'subscription_update',
  SYSTEM:                'system',
  PROMO:                 'promo',
};

// ── Token FCM ─────────────────────────────────────────────────

/**
 * Enregistre ou met à jour le token FCM d'un utilisateur
 */
async function registerFcmToken(userId, token) {
  const { error } = await supabaseAdmin
    .from('notification_preferences')
    .upsert(
      {
        user_id: userId,
        fcm_token: token,
        fcm_token_updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

  if (error) throw error;
}

/**
 * Supprime le token FCM d'un utilisateur (déconnexion)
 */
async function revokeFcmToken(userId) {
  const { error } = await supabaseAdmin
    .from('notification_preferences')
    .update({ fcm_token: null, fcm_token_updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  if (error) throw error;
}

/**
 * Récupère les préférences de notification d'un utilisateur
 * Crée la ligne si elle n'existe pas encore
 */
async function getPreferences(userId) {
  const { data, error } = await supabaseAdmin
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const defaults = {
      user_id: userId,
      push_enabled: true,
      email_enabled: true,
      new_content: true,
      reading_reminders: true,
      subscription_updates: true,
    };
    const { data: created, error: createError } = await supabaseAdmin
      .from('notification_preferences')
      .insert(defaults)
      .select()
      .single();
    if (createError) throw createError;
    return created;
  }

  return data;
}

/**
 * Met à jour les préférences de notification
 */
async function updatePreferences(userId, updates) {
  const allowed = ['push_enabled', 'email_enabled', 'new_content', 'reading_reminders', 'subscription_updates'];
  const filtered = {};
  for (const key of allowed) {
    if (key in updates) filtered[key] = updates[key];
  }

  const { data, error } = await supabaseAdmin
    .from('notification_preferences')
    .upsert({ user_id: userId, ...filtered }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ── Envoi ─────────────────────────────────────────────────────

/**
 * Envoie une notification push à un utilisateur + sauvegarde en base
 */
async function sendToUser(userId, { type, title, body, data = {}, saveToDb = true }) {
  const prefs = await getPreferences(userId);

  // Vérifier les préférences
  if (!prefs.push_enabled) return { skipped: true, reason: 'push_disabled' };
  if (type === NOTIFICATION_TYPES.NEW_CONTENT && !prefs.new_content) {
    return { skipped: true, reason: 'new_content_disabled' };
  }
  if (type === NOTIFICATION_TYPES.EXPIRATION_REMINDER && !prefs.subscription_updates) {
    return { skipped: true, reason: 'subscription_updates_disabled' };
  }

  const results = { db: null, push: null };

  // Sauvegarder en base (historique in-app)
  if (saveToDb) {
    const { data: notif, error } = await supabaseAdmin
      .from('notifications')
      .insert({ user_id: userId, type, title, body, data })
      .select()
      .single();
    if (!error) results.db = notif;
  }

  // Envoyer la notification push si token disponible
  if (prefs.fcm_token) {
    try {
      results.push = await fcmService.sendToToken(prefs.fcm_token, { title, body, data });
    } catch (pushErr) {
      console.error(`[notifications] Push failed for user ${userId}:`, pushErr.message);
      results.pushError = pushErr.message;
    }
  }

  return results;
}

/**
 * Envoie une notification à plusieurs utilisateurs
 */
async function sendToUsers(userIds, payload) {
  const results = await Promise.allSettled(
    userIds.map((id) => sendToUser(id, payload))
  );
  return results;
}

/**
 * Envoie une notification à tous les utilisateurs actifs
 * saveToDb=true → insère dans notifications pour chaque user (historique in-app)
 */
async function sendToAll({ type, title, body, data = {}, saveToDb = true }) {
  // Récupérer tous les utilisateurs avec push_enabled (token ou pas)
  const { data: prefs } = await supabaseAdmin
    .from('notification_preferences')
    .select('user_id, fcm_token, push_enabled')
    .eq('push_enabled', true);

  if (!prefs || prefs.length === 0) {
    // Fallback : récupérer tous les profils
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('is_active', true);

    if (!profiles || profiles.length === 0) return { sent: 0, saved: 0 };

    if (saveToDb) {
      const rows = profiles.map((p) => ({ user_id: p.id, type, title, body, data }));
      await supabaseAdmin.from('notifications').insert(rows);
    }
    return { sent: 0, saved: saveToDb ? profiles.length : 0, pushSent: 0 };
  }

  // Sauvegarder en DB pour tous les users
  if (saveToDb) {
    const rows = prefs.map((p) => ({ user_id: p.user_id, type, title, body, data }));
    const { error } = await supabaseAdmin.from('notifications').insert(rows);
    if (error) console.error('[notifications] sendToAll DB insert error:', error.message);
  }

  // Envoyer push uniquement aux users avec token
  const tokens = prefs.map((p) => p.fcm_token).filter(Boolean);
  let pushResult = { sent: 0, failed: 0 };
  if (tokens.length > 0) {
    pushResult = await fcmService.sendToMultipleTokens(tokens, { title, body, data });
  }

  return { saved: saveToDb ? prefs.length : 0, pushSent: pushResult.sent || 0, pushFailed: pushResult.failed || 0 };
}

// ── Historique ────────────────────────────────────────────────

/**
 * Récupère les notifications in-app d'un utilisateur
 */
async function getUserNotifications(userId, { limit = 20, offset = 0, unreadOnly = false } = {}) {
  let query = supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('sent_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (unreadOnly) query = query.eq('is_read', false);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Marque une notification comme lue
 */
async function markAsRead(notificationId, userId) {
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Marque toutes les notifications d'un utilisateur comme lues
 */
async function markAllAsRead(userId) {
  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) throw error;
}

/**
 * Compte les notifications non lues d'un utilisateur
 */
async function getUnreadCount(userId) {
  const { count, error } = await supabaseAdmin
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) throw error;
  return count || 0;
}

// ── Notifications prédéfinies ─────────────────────────────────

async function notifyExpirationReminder(userId, daysLeft, renewUrl) {
  return sendToUser(userId, {
    type: NOTIFICATION_TYPES.EXPIRATION_REMINDER,
    title: `Votre abonnement expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`,
    body: daysLeft === 1
      ? 'Dernier jour ! Renouvelez maintenant pour continuer à lire.'
      : `Renouvelez votre abonnement Papyri pour ne pas interrompre votre lecture.`,
    data: { screen: 'Subscription', url: renewUrl, days_left: String(daysLeft) },
  });
}

async function notifySubscriptionExpired(userId) {
  return sendToUser(userId, {
    type: NOTIFICATION_TYPES.SUBSCRIPTION_EXPIRED,
    title: 'Abonnement expiré',
    body: 'Votre abonnement Papyri a expiré. Réabonnez-vous pour continuer à lire.',
    data: { screen: 'Subscription' },
  });
}

async function notifyPaymentFailed(userId, planName) {
  return sendToUser(userId, {
    type: NOTIFICATION_TYPES.PAYMENT_FAILED,
    title: 'Paiement échoué',
    body: `Le paiement pour votre abonnement "${planName}" a échoué. Vérifiez votre moyen de paiement.`,
    data: { screen: 'Subscription' },
  });
}

async function notifyNewContent(userIds, content) {
  return sendToUsers(userIds, {
    type: NOTIFICATION_TYPES.NEW_CONTENT,
    title: '📚 Nouveau contenu disponible !',
    body: `"${content.title}" par ${content.author} vient d'être ajouté.`,
    data: {
      screen: 'ContentDetail',
      content_id: String(content.id),
      content_type: String(content.content_type || ''),
    },
  });
}

async function notifyPromo(userIds, { title, body, promoCode }) {
  return sendToUsers(userIds, {
    type: NOTIFICATION_TYPES.PROMO,
    title,
    body,
    data: { screen: 'Pricing', promo_code: String(promoCode || '') },
  });
}

module.exports = {
  NOTIFICATION_TYPES,
  registerFcmToken,
  revokeFcmToken,
  getPreferences,
  updatePreferences,
  sendToUser,
  sendToUsers,
  sendToAll,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  notifyExpirationReminder,
  notifySubscriptionExpired,
  notifyPaymentFailed,
  notifyNewContent,
  notifyPromo,
};
