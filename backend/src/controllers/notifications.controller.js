/**
 * Notifications Controller
 * Endpoints pour tokens FCM, préférences et historique
 */

const notificationsService = require('../services/notifications.service');
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

    await notificationsService.registerFcmToken(userId, token);

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
    const { target, userId, userEmail, title, body, data, type = 'system', saveToDb = true, sendEmail = false, ctaLabel, ctaUrl } = req.body;

    if (!title || !body) {
      return res.status(400).json({ success: false, error: 'title et body requis.' });
    }

    const payload = { type, title, body, data: data || {}, saveToDb };
    let result;

    if (target === 'all') {
      result = await notificationsService.sendToAll({ ...payload, saveToDb });

      // Envoi email optionnel à tous les utilisateurs
      if (sendEmail) {
        const { data: profiles } = await supabaseAdmin
          .from('notification_preferences')
          .select('user_id, profiles(email, full_name)')
          .eq('email_enabled', true);
        let emailsSent = 0;
        for (const pref of profiles || []) {
          const profile = pref.profiles;
          if (profile?.email) {
            sendAdminBroadcastEmail(profile.email, profile.full_name || profile.email, { title, body, ctaLabel, ctaUrl })
              .catch(() => {});
            emailsSent++;
          }
        }
        result.emailsSent = emailsSent;
      }

      return res.status(200).json({
        success: true,
        message: `Notification sauvegardée pour ${result.saved || 0} utilisateur(s), push envoyé à ${result.pushSent || 0}${sendEmail ? `, email à ${result.emailsSent || 0}` : ''}.`,
        result,
      });
    }

    if (target === 'active_subscribers' || target === 'expired_subscribers' || target === 'cancelled_subscribers') {
      const statusMap = {
        active_subscribers:    'ACTIVE',
        expired_subscribers:   'EXPIRED',
        cancelled_subscribers: 'CANCELLED',
      };
      const { data: subsData } = await supabaseAdmin
        .from('subscriptions')
        .select('user_id')
        .eq('status', statusMap[target]);
      const userIds = [...new Set((subsData || []).map(s => s.user_id))];
      result = await notificationsService.sendToUsers(userIds, { ...payload, saveToDb });
      return res.status(200).json({
        success: true,
        message: `Notification envoyée à ${userIds.length} utilisateur(s) (${target}).`,
        result,
      });
    }

    if (target === 'user') {
      let resolvedUserId = userId;

      // Résoudre userId depuis email si fourni
      if (!resolvedUserId && userEmail) {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('email', userEmail.trim().toLowerCase())
          .single();

        if (!profile) {
          return res.status(404).json({ success: false, error: `Aucun utilisateur trouvé avec l'email : ${userEmail}` });
        }
        resolvedUserId = profile.id;
      }

      if (!resolvedUserId) {
        return res.status(400).json({ success: false, error: 'userId ou userEmail requis pour target=user.' });
      }

      result = await notificationsService.sendToUser(resolvedUserId, payload);

      // Email individuel optionnel
      if (sendEmail) {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('email, full_name')
          .eq('id', resolvedUserId)
          .maybeSingle();
        if (profile?.email) {
          sendAdminBroadcastEmail(profile.email, profile.full_name || profile.email, { title, body, ctaLabel, ctaUrl })
            .catch(() => {});
        }
      }

      return res.status(200).json({
        success: true,
        message: `Notification envoyée à l'utilisateur.`,
        result,
      });
    }

    return res.status(400).json({ success: false, error: 'target doit être "all" ou "user".' });
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
    const [totalRes, unreadRes, pushEnabledRes, recentRes] = await Promise.all([
      supabaseAdmin.from('notifications').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('notifications').select('id', { count: 'exact', head: true }).eq('is_read', false),
      supabaseAdmin.from('notification_preferences').select('id', { count: 'exact', head: true })
        .eq('push_enabled', true).not('fcm_token', 'is', null),
      supabaseAdmin.from('notifications')
        .select('id, type, title, body, is_read, sent_at')
        .order('sent_at', { ascending: false })
        .limit(15),
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        total: totalRes.count || 0,
        unread: unreadRes.count || 0,
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
  markAllRead,
  adminSendNotification,
  adminSendPromo,
  adminGetStats,
};
