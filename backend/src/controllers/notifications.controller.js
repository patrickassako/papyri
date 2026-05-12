/**
 * Notifications Controller
 * Endpoints pour tokens FCM, préférences et historique
 */

const notificationsService = require('../services/notifications.service');
const audienceService = require('../services/audience.service');
const fcmService = require('../services/fcm.service');
const { supabaseAdmin } = require('../config/database');
const { sendAdminBroadcastEmail } = require('../services/email.service');

/**
 * POST /api/notifications/fcm-token
 * Enregistre ou met à jour le token FCM de l'utilisateur connecté
 */
async function registerToken(req, res) {
  try {
    const userId = req.user.id;
    const { token } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, error: 'Token FCM requis.' });
    }

    // Detect "first time we ever see this user's token" → trigger welcome push.
    const { data: existing } = await supabaseAdmin
      .from('notification_preferences')
      .select('fcm_token')
      .eq('user_id', userId)
      .maybeSingle();
    const isFirstRegistration = !existing?.fcm_token;

    await notificationsService.registerFcmToken(userId, token);

    if (isFirstRegistration) {
      // Avoid double-welcome if user reinstalls the app weeks later.
      const already = await notificationsService.hasRecentNotification(
        userId,
        notificationsService.NOTIFICATION_TYPES.WELCOME,
        365,
      );
      if (!already) {
        notificationsService.notifyWelcome(userId).catch((e) =>
          console.error('[welcome] send error:', e.message),
        );
      }
    }

    return res.status(200).json({ success: true, message: 'Token FCM enregistré.' });
  } catch (error) {
    console.error('❌ registerToken error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * DELETE /api/notifications/fcm-token
 * Révoque le token FCM (déconnexion)
 */
async function revokeToken(req, res) {
  try {
    const userId = req.user.id;
    await notificationsService.revokeFcmToken(userId);
    return res.status(200).json({ success: true, message: 'Token révoqué.' });
  } catch (error) {
    console.error('❌ revokeToken error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * GET /api/notifications/preferences
 * Récupère les préférences de notification
 */
async function getPreferences(req, res) {
  try {
    const userId = req.user.id;
    const prefs = await notificationsService.getPreferences(userId);
    return res.status(200).json({ success: true, preferences: prefs });
  } catch (error) {
    console.error('❌ getPreferences error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * PUT /api/notifications/preferences
 * Met à jour les préférences de notification
 */
async function updatePreferences(req, res) {
  try {
    const userId = req.user.id;
    const { push_enabled, email_enabled, new_content, reading_reminders, subscription_updates } = req.body;

    const updated = await notificationsService.updatePreferences(userId, {
      push_enabled,
      email_enabled,
      new_content,
      reading_reminders,
      subscription_updates,
    });

    return res.status(200).json({ success: true, preferences: updated });
  } catch (error) {
    console.error('❌ updatePreferences error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * GET /api/notifications
 * Historique des notifications in-app
 * Query: ?limit=20&offset=0&unread=true
 */
async function getNotifications(req, res) {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = parseInt(req.query.offset) || 0;
    const unreadOnly = req.query.unread === 'true';

    const [notifications, unreadCount] = await Promise.all([
      notificationsService.getUserNotifications(userId, { limit, offset, unreadOnly }),
      notificationsService.getUnreadCount(userId),
    ]);

    return res.status(200).json({
      success: true,
      notifications,
      unreadCount,
      count: notifications.length,
    });
  } catch (error) {
    console.error('❌ getNotifications error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * PATCH /api/notifications/:id/clicked
 * Logged when the user taps the push (mobile opens the deep link).
 */
async function markClicked(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .update({ clicked_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .maybeSingle();
    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.status(200).json({ success: true, notification: data });
  } catch (error) {
    console.error('❌ markClicked error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * PATCH /api/notifications/:id/read
 * Marque une notification comme lue
 */
async function markRead(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const notification = await notificationsService.markAsRead(id, userId);
    return res.status(200).json({ success: true, notification });
  } catch (error) {
    console.error('❌ markRead error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/notifications/read-all
 * Marque toutes les notifications comme lues
 */
async function markAllRead(req, res) {
  try {
    const userId = req.user.id;
    await notificationsService.markAllAsRead(userId);
    return res.status(200).json({ success: true, message: 'Toutes les notifications marquées comme lues.' });
  } catch (error) {
    console.error('❌ markAllRead error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/admin/notifications/send
 * Envoi manuel d'une notification (admin uniquement)
 * Body: { target: 'all' | 'user', userId?, userEmail?, title, body, data?, type?, saveToDb? }
 */
async function adminSendNotification(req, res) {
  try {
    const {
      target,
      userId,
      userEmail,
      // Backward-compat single-language fields
      title, body,
      // Multilingual fields (preferred)
      title_fr, body_fr, title_en, body_en,
      // Targeting criteria (categoryId, daysWindow, etc.)
      target_criteria,
      categoryId, daysWindow,
      // Common
      data,
      type = 'system',
      saveToDb = true,
      sendEmail = false,
      ctaLabel, ctaUrl,
      // Scheduling
      scheduledFor, // ISO datetime string. If provided, store in scheduled_notifications.
    } = req.body;

    // Resolve title/body for both languages (fall back to single-lang fields).
    const fr_title = title_fr || title;
    const fr_body  = body_fr  || body;
    const en_title = title_en || null;
    const en_body  = body_en  || null;

    if (!fr_title || !fr_body) {
      return res.status(400).json({ success: false, error: 'title_fr/body_fr (ou title/body) requis.' });
    }

    // Build target criteria (merge legacy fields).
    const criteria = { ...(target_criteria || {}) };
    if (userId) criteria.userId = userId;
    if (userEmail) criteria.userEmail = userEmail;
    if (categoryId) criteria.categoryId = categoryId;
    if (daysWindow) criteria.daysWindow = Number(daysWindow);

    // ── Scheduled? store in DB, scheduler will pick it up ───────
    if (scheduledFor) {
      const when = new Date(scheduledFor);
      if (Number.isNaN(when.getTime())) {
        return res.status(400).json({ success: false, error: 'scheduledFor invalide (ISO datetime).' });
      }
      if (when.getTime() < Date.now() - 60000) {
        return res.status(400).json({ success: false, error: 'scheduledFor doit être dans le futur.' });
      }
      const { data: row, error: insertErr } = await supabaseAdmin
        .from('scheduled_notifications')
        .insert({
          created_by: req.user?.id || null,
          scheduled_for: when.toISOString(),
          status: 'pending',
          target,
          target_criteria: criteria,
          title_fr: fr_title,
          body_fr: fr_body,
          title_en: en_title,
          body_en: en_body,
          type,
          data: data || {},
          send_email: !!sendEmail,
        })
        .select()
        .single();
      if (insertErr) {
        return res.status(500).json({ success: false, error: insertErr.message });
      }
      return res.status(200).json({
        success: true,
        scheduled: true,
        message: `Notification programmée pour ${when.toISOString()}.`,
        id: row.id,
      });
    }

    // ── Immediate send ──────────────────────────────────────────
    // 1. Resolve audience via the new helper.
    let userIds;
    try {
      userIds = await audienceService.resolveAudience(target, criteria);
    } catch (e) {
      return res.status(400).json({ success: false, error: e.message });
    }
    if (!userIds.length) {
      return res.status(200).json({ success: true, message: 'Audience vide, rien envoyé.', result: { sent: 0 } });
    }

    // 2. Multilingual broadcast.
    const stats = await notificationsService.sendMultilingualBroadcast(userIds, {
      titleFr: fr_title, bodyFr: fr_body,
      titleEn: en_title, bodyEn: en_body,
      type,
      data: data || {},
    });

    // 3. Optional email broadcast.
    if (sendEmail) {
      let emailsSent = 0;
      for (const uid of userIds) {
        const { data: prof } = await supabaseAdmin
          .from('profiles')
          .select('email, full_name, language')
          .eq('id', uid)
          .maybeSingle();
        if (!prof?.email) continue;
        const lang = (prof.language || 'fr').toLowerCase().startsWith('en') ? 'en' : 'fr';
        const emailTitle = lang === 'en' && en_title ? en_title : fr_title;
        const emailBody  = lang === 'en' && en_body  ? en_body  : fr_body;
        sendAdminBroadcastEmail(prof.email, prof.full_name || prof.email, { title: emailTitle, body: emailBody, ctaLabel, ctaUrl })
          .catch(() => {});
        emailsSent++;
      }
      stats.emailsSent = emailsSent;
    }

    return res.status(200).json({
      success: true,
      message: `Notification envoyée : ${stats.sent} reçu(s) (FR ${stats.perLang.fr} / EN ${stats.perLang.en})${sendEmail ? `, ${stats.emailsSent || 0} email(s)` : ''}.`,
      result: stats,
    });
  } catch (error) {
    console.error('❌ adminSendNotification error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * GET /api/admin/notifications/stats
 * Stats globales + notifications récentes pour la page de test admin
 */
async function adminGetStats(req, res) {
  try {
    const [totalRes, unreadRes, clickedRes, pushEnabledRes, recentRes] = await Promise.all([
      supabaseAdmin.from('notifications').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('notifications').select('id', { count: 'exact', head: true }).eq('is_read', false),
      supabaseAdmin.from('notifications').select('id', { count: 'exact', head: true }).not('clicked_at', 'is', null),
      supabaseAdmin.from('notification_preferences').select('id', { count: 'exact', head: true })
        .eq('push_enabled', true).not('fcm_token', 'is', null),
      supabaseAdmin.from('notifications')
        .select('id, type, title, body, is_read, sent_at, clicked_at')
        .order('sent_at', { ascending: false })
        .limit(15),
    ]);

    const total = totalRes.count || 0;
    const read = total - (unreadRes.count || 0);
    const clicked = clickedRes.count || 0;

    return res.status(200).json({
      success: true,
      stats: {
        total,
        unread: unreadRes.count || 0,
        read,
        clicked,
        readRate:    total > 0 ? Math.round((read / total) * 100) : 0,
        clickedRate: total > 0 ? Math.round((clicked / total) * 100) : 0,
        pushEnabled: pushEnabledRes.count || 0,
      },
      recent: recentRes.data || [],
    });
  } catch (error) {
    console.error('❌ adminGetStats error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * GET /api/admin/notifications/scheduled
 * Liste des notifications programmées (pending, sent, failed, cancelled).
 */
async function adminListScheduled(req, res) {
  try {
    const status = req.query.status || null;
    let q = supabaseAdmin
      .from('scheduled_notifications')
      .select('*')
      .order('scheduled_for', { ascending: false })
      .limit(100);
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) return res.status(500).json({ success: false, error: error.message });
    return res.status(200).json({ success: true, scheduled: data || [] });
  } catch (error) {
    console.error('❌ adminListScheduled error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * DELETE /api/admin/notifications/scheduled/:id
 * Annule une notification programmée non encore envoyée.
 */
async function adminCancelScheduled(req, res) {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('scheduled_notifications')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'pending')
      .select()
      .maybeSingle();
    if (error) return res.status(500).json({ success: false, error: error.message });
    if (!data) return res.status(404).json({ success: false, error: 'Aucune notif pending avec cet id.' });
    return res.status(200).json({ success: true, scheduled: data });
  } catch (error) {
    console.error('❌ adminCancelScheduled error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * GET /api/admin/notifications/audience-preview?target=...&criteria_json=...
 * Counts how many users would receive the broadcast for the given target.
 */
async function adminAudiencePreview(req, res) {
  try {
    const target = req.query.target;
    let criteria = {};
    try {
      criteria = req.query.criteria_json ? JSON.parse(req.query.criteria_json) : {};
    } catch (_) {
      return res.status(400).json({ success: false, error: 'criteria_json invalide.' });
    }
    const userIds = await audienceService.resolveAudience(target, criteria);
    return res.status(200).json({ success: true, count: userIds.length });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/admin/notifications/send-promo
 * Envoie un code promo par notification à tous les users actifs
 */
async function adminSendPromo(req, res) {
  try {
    const { title, body, promoCode, userIds } = req.body;

    if (!title || !body) {
      return res.status(400).json({ success: false, error: 'title et body requis.' });
    }

    let targetUserIds = userIds;

    if (!targetUserIds || targetUserIds.length === 0) {
      // Tous les users avec push activé
      const { data: prefs } = await supabaseAdmin
        .from('notification_preferences')
        .select('user_id')
        .eq('push_enabled', true)
        .not('fcm_token', 'is', null);
      targetUserIds = (prefs || []).map((p) => p.user_id);
    }

    const result = await notificationsService.notifyPromo(targetUserIds, { title, body, promoCode });
    return res.status(200).json({ success: true, sent: targetUserIds.length, result });
  } catch (error) {
    console.error('❌ adminSendPromo error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  registerToken,
  revokeToken,
  getPreferences,
  updatePreferences,
  getNotifications,
  markRead,
  markClicked,
  markAllRead,
  adminSendNotification,
  adminSendPromo,
  adminGetStats,
  adminListScheduled,
  adminCancelScheduled,
  adminAudiencePreview,
};
