/**
 * Notifications Service
 * Gestion des tokens FCM, préférences, et envoi de notifications
 */

const { supabaseAdmin } = require('../config/database');
const fcmService = require('./fcm.service');
const { buildNotification } = require('./notifications.i18n');

async function getUserLang(userId) {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('language')
    .eq('id', userId)
    .maybeSingle();
  return data?.language || 'fr';
}

// ── Types de notifications ────────────────────────────────────
const NOTIFICATION_TYPES = {
  NEW_CONTENT:           'new_content',
  EXPIRATION_REMINDER:   'expiration_reminder',
  SUBSCRIPTION_EXPIRED:  'subscription_expired',
  PAYMENT_FAILED:        'payment_failed',
  SUBSCRIPTION_UPDATE:   'subscription_update',
  SYSTEM:                'system',
  PROMO:                 'promo',
  // Engagement
  READING_REMINDER:      'reading_reminder',
  READING_STREAK:        'reading_streak',
  WEEKLY_RECAP:          'weekly_recap',
  INACTIVITY_NUDGE:      'inactivity_nudge',
  // Lifecycle
  WELCOME:               'welcome',
  WELCOME_DAY1:          'welcome_day1',
  FIRST_READ_DONE:       'first_read_done',
  FIRST_PURCHASE:        'first_purchase',
  SIGNUP_ANNIVERSARY:    'signup_anniversary',
  // Discovery
  CATEGORY_NEW_BOOK:     'category_new_book',
  WEEKLY_TOP:            'weekly_top',
  AUDIOBOOK_PICK:        'audiobook_pick',
  // Monetization
  POST_EXPIRY_PROMO:     'post_expiry_promo',
  CREDIT_GRANTED:        'credit_granted',
  CREDIT_EXPIRING:       'credit_expiring',
  PURCHASE_CONFIRMED:    'purchase_confirmed',
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

/**
 * Smart targeted broadcast on new content:
 *  - If the new content has categories AND there are users who read those
 *    categories in the last 60 days, push only to them with a category-aware
 *    message (notifyCategoryNewBook).
 *  - Also pushes an audiobook-specific message to users who already listened
 *    to at least one audiobook in the past 60 days, if the new content is audio.
 *  - Anyone not matched falls back to the generic notifyNewContent broadcast
 *    so that small/empty catalogs still warn users.
 */
async function notifyNewContentSmart(content) {
  try {
    const contentId = content?.id;
    const contentTitle = content?.title || '';
    const isAudio = String(content?.content_type || '').toLowerCase() === 'audiobook';

    // Categories: try direct join (content_categories) then fallback to content.categories array (legacy).
    let categoryIds = [];
    let categoryName = null;
    try {
      const { data: cats } = await supabaseAdmin
        .from('content_categories')
        .select('category_id, categories(id, name)')
        .eq('content_id', contentId);
      categoryIds = (cats || []).map(c => c.category_id).filter(Boolean);
      categoryName = cats?.[0]?.categories?.name || null;
    } catch (_) { /* table absent or empty: ignore */ }

    const targeted = new Set();

    // Users with reading_history on this category in the last 60 days.
    if (categoryIds.length > 0) {
      const since = new Date(Date.now() - 60 * 86400000).toISOString();
      const { data: hist } = await supabaseAdmin
        .from('reading_history')
        .select('user_id, contents!inner(id, content_categories!inner(category_id))')
        .gte('last_read_at', since)
        .in('contents.content_categories.category_id', categoryIds);
      for (const row of (hist || [])) {
        if (row.user_id) targeted.add(row.user_id);
      }
    }

    // Send category-aware push to each targeted user.
    for (const userId of targeted) {
      await notifyCategoryNewBook(userId, {
        contentId,
        contentTitle,
        categoryName: categoryName || 'tes lectures',
      }).catch(() => {});
    }

    // Audiobook lovers: separate push when the new content is an audiobook.
    if (isAudio) {
      const since = new Date(Date.now() - 60 * 86400000).toISOString();
      const { data: audioHist } = await supabaseAdmin
        .from('reading_history')
        .select('user_id, contents!inner(content_type)')
        .gte('last_read_at', since)
        .eq('contents.content_type', 'audiobook');
      const audioListeners = new Set((audioHist || []).map(r => r.user_id).filter(Boolean));
      for (const userId of audioListeners) {
        if (targeted.has(userId)) continue; // already received the category push
        await notifyAudiobookPick(userId, { contentId, contentTitle }).catch(() => {});
        targeted.add(userId);
      }
    }

    // Fallback: keep the generic broadcast for anyone we haven't targeted yet
    // (covers brand-new users with no reading history).
    const { data: prefs } = await supabaseAdmin
      .from('notification_preferences')
      .select('user_id')
      .eq('push_enabled', true)
      .not('fcm_token', 'is', null);
    const fallback = (prefs || [])
      .map(p => p.user_id)
      .filter(uid => !targeted.has(uid));
    if (fallback.length > 0) {
      await notifyNewContent(fallback, content).catch(() => {});
    }
  } catch (err) {
    console.error('[notifyNewContentSmart] error:', err.message);
    // Last-resort fallback: generic broadcast to everyone.
    try {
      const { data: profiles } = await supabaseAdmin.from('profiles').select('id').eq('is_active', true);
      const ids = (profiles || []).map(p => p.id);
      if (ids.length) await notifyNewContent(ids, content);
    } catch (_) { /* swallow */ }
  }
}

async function notifyPromo(userIds, { title, body, promoCode }) {
  return sendToUsers(userIds, {
    type: NOTIFICATION_TYPES.PROMO,
    title,
    body,
    data: { screen: 'Pricing', promo_code: String(promoCode || '') },
  });
}

// ── Engagement helpers ──────────────────────────────────────────

async function sendLocalized(userId, key, params, type, data) {
  const lang = await getUserLang(userId);
  const { title, body } = buildNotification(key, params, lang);
  return sendToUser(userId, { type, title, body, data });
}

async function notifyReadingReminder(userId, { contentId, title, daysSince }) {
  return sendLocalized(
    userId, 'reading_reminder', { title, daysSince },
    NOTIFICATION_TYPES.READING_REMINDER,
    { screen: 'ContentDetail', content_id: String(contentId) }
  );
}

async function notifyReadingStreak(userId, { streakDays }) {
  return sendLocalized(
    userId, 'reading_streak', { streakDays },
    NOTIFICATION_TYPES.READING_STREAK,
    { screen: 'Home' }
  );
}

async function notifyWeeklyRecap(userId, { booksFinished, minutesRead }) {
  const hours = Math.floor(minutesRead / 60);
  const mins  = minutesRead % 60;
  const timeStr = hours > 0 ? `${hours}h${mins.toString().padStart(2, '0')}` : `${mins} min`;
  return sendLocalized(
    userId, 'weekly_recap', { timeStr, booksFinished },
    NOTIFICATION_TYPES.WEEKLY_RECAP,
    { screen: 'History' }
  );
}

async function notifyInactivity(userId) {
  return sendLocalized(
    userId, 'inactivity_nudge', {},
    NOTIFICATION_TYPES.INACTIVITY_NUDGE,
    { screen: 'Catalog' }
  );
}

// ── Lifecycle helpers ──────────────────────────────────────────

async function notifyWelcome(userId) {
  return sendLocalized(userId, 'welcome', {}, NOTIFICATION_TYPES.WELCOME, { screen: 'Home' });
}

async function notifyWelcomeDay1NoSub(userId) {
  return sendLocalized(userId, 'welcome_day1', {}, NOTIFICATION_TYPES.WELCOME_DAY1, { screen: 'Pricing' });
}

async function notifyFirstReadDone(userId, { suggestionContentId, suggestionTitle }) {
  return sendLocalized(
    userId, 'first_read_done', { suggestionTitle },
    NOTIFICATION_TYPES.FIRST_READ_DONE,
    suggestionContentId
      ? { screen: 'ContentDetail', content_id: String(suggestionContentId) }
      : { screen: 'Catalog' }
  );
}

async function notifyFirstPurchase(userId, { contentId, contentTitle }) {
  return sendLocalized(
    userId, 'first_purchase', { contentTitle },
    NOTIFICATION_TYPES.FIRST_PURCHASE,
    contentId ? { screen: 'ContentDetail', content_id: String(contentId) } : { screen: 'Home' }
  );
}

async function notifySignupAnniversary(userId, { years }) {
  return sendLocalized(
    userId, 'signup_anniversary', { years },
    NOTIFICATION_TYPES.SIGNUP_ANNIVERSARY,
    { screen: 'Profile' }
  );
}

// ── Discovery helpers ──────────────────────────────────────────

async function notifyCategoryNewBook(userId, { contentId, contentTitle, categoryName }) {
  return sendLocalized(
    userId, 'category_new_book', { categoryName, contentTitle },
    NOTIFICATION_TYPES.CATEGORY_NEW_BOOK,
    { screen: 'ContentDetail', content_id: String(contentId) }
  );
}

async function notifyWeeklyTop(userIds, { topTitles }) {
  // Send per user (so language can vary). topTitles: array of 3 strings.
  const list = topTitles.slice(0, 3).map(t => `• ${t}`).join('\n');
  const results = [];
  for (const userId of userIds) {
    results.push(await sendLocalized(
      userId, 'weekly_top', { list },
      NOTIFICATION_TYPES.WEEKLY_TOP,
      { screen: 'Catalog', sort: 'popular' }
    ));
  }
  return results;
}

async function notifyAudiobookPick(userId, { contentId, contentTitle }) {
  return sendLocalized(
    userId, 'audiobook_pick', { contentTitle },
    NOTIFICATION_TYPES.AUDIOBOOK_PICK,
    { screen: 'ContentDetail', content_id: String(contentId) }
  );
}

// ── Monetization helpers ──────────────────────────────────────

async function notifyPostExpiryPromo(userId, { promoCode, discountPercent }) {
  return sendLocalized(
    userId, 'post_expiry_promo', { promoCode, discountPercent },
    NOTIFICATION_TYPES.POST_EXPIRY_PROMO,
    { screen: 'Pricing', promo_code: String(promoCode || '') }
  );
}

async function notifyCreditGranted(userId, { creditCount }) {
  return sendLocalized(
    userId, 'credit_granted', { creditCount },
    NOTIFICATION_TYPES.CREDIT_GRANTED,
    { screen: 'Catalog' }
  );
}

async function notifyCreditExpiring(userId, { expiresOn }) {
  return sendLocalized(
    userId, 'credit_expiring', { expiresOn },
    NOTIFICATION_TYPES.CREDIT_EXPIRING,
    { screen: 'Catalog' }
  );
}

async function notifyPurchaseConfirmed(userId, { contentId, contentTitle }) {
  return sendLocalized(
    userId, 'purchase_confirmed', { contentTitle },
    NOTIFICATION_TYPES.PURCHASE_CONFIRMED,
    contentId ? { screen: 'ContentDetail', content_id: String(contentId) } : { screen: 'Home' }
  );
}

// Helper: check si une notif d'un certain type a déjà été envoyée à un user
// dans les N derniers jours (pour éviter les doublons).
async function hasRecentNotification(userId, type, daysWindow = 7) {
  const since = new Date(Date.now() - daysWindow * 86400000).toISOString();
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .select('id')
    .eq('user_id', userId)
    .eq('type', type)
    .gte('created_at', since)
    .limit(1);
  if (error) return false;
  return Array.isArray(data) && data.length > 0;
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
  hasRecentNotification,
  notifyExpirationReminder,
  notifySubscriptionExpired,
  notifyPaymentFailed,
  notifyNewContent,
  notifyNewContentSmart,
  notifyPromo,
  // Engagement
  notifyReadingReminder,
  notifyReadingStreak,
  notifyWeeklyRecap,
  notifyInactivity,
  // Lifecycle
  notifyWelcome,
  notifyWelcomeDay1NoSub,
  notifyFirstReadDone,
  notifyFirstPurchase,
  notifySignupAnniversary,
  // Discovery
  notifyCategoryNewBook,
  notifyWeeklyTop,
  notifyAudiobookPick,
  // Monetization
  notifyPostExpiryPromo,
  notifyCreditGranted,
  notifyCreditExpiring,
  notifyPurchaseConfirmed,
};
