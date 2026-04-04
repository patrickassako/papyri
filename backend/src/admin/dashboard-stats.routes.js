/**
 * Dashboard Stats API for AdminJS
 * Returns aggregated KPIs for the admin dashboard
 */
const express = require('express');
const { Router } = express;
const { supabaseAdmin } = require('../config/database');

const router = Router();

router.get('/dashboard-stats', async (req, res) => {
  try {
    // Run all queries in parallel
    const [
      usersTotal,
      usersActive,
      usersBlocked,
      usersAdmins,
      subsActive,
      subsExpired,
      subsCancelled,
      subsRevenue,
      contentsTotal,
      contentsEbooks,
      contentsAudiobooks,
      contentsPublished,
      contentsNoRH,
      categoriesCount,
      rightsHoldersCount,
      unlocksCount,
      unlocksRevenue,
      readingTotal,
      readingCompleted,
      readingTime,
      recentAudit,
      recentSubs,
      newUsersMonth,
      monthlySignupsRaw,
    ] = await Promise.all([
      // Users
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('is_active', false),
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'admin'),

      // Subscriptions
      supabaseAdmin.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
      supabaseAdmin.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'EXPIRED'),
      supabaseAdmin.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'CANCELLED'),
      supabaseAdmin.from('subscriptions').select('amount, currency').in('status', ['ACTIVE', 'EXPIRED', 'CANCELLED']),

      // Contents
      supabaseAdmin.from('contents').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('contents').select('*', { count: 'exact', head: true }).eq('content_type', 'ebook'),
      supabaseAdmin.from('contents').select('*', { count: 'exact', head: true }).eq('content_type', 'audiobook'),
      supabaseAdmin.from('contents').select('*', { count: 'exact', head: true }).eq('is_published', true),
      supabaseAdmin.from('contents').select('*', { count: 'exact', head: true }).is('rights_holder_id', null),

      // Categories & Rights holders
      supabaseAdmin.from('categories').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('rights_holders').select('*', { count: 'exact', head: true }),

      // Unlocks
      supabaseAdmin.from('content_unlocks').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('content_unlocks').select('paid_amount_cents, currency'),

      // Reading
      supabaseAdmin.from('reading_history').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('reading_history').select('*', { count: 'exact', head: true }).eq('is_completed', true),
      supabaseAdmin.from('reading_history').select('total_time_seconds'),

      // Recent audit
      supabaseAdmin.from('audit_logs').select('action, resource, resource_id, created_at').order('created_at', { ascending: false }).limit(10),

      // Recent subscriptions (5 derniers avec user info)
      supabaseAdmin.from('subscriptions')
        .select('id, user_id, plan_type, amount, currency, status, created_at')
        .order('created_at', { ascending: false })
        .limit(5),

      // New users this month
      supabaseAdmin.from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),

      // Monthly signups (6 derniers mois) — fetched as raw created_at, aggregated in JS
      supabaseAdmin.from('profiles')
        .select('created_at')
        .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1).toISOString())
        .order('created_at', { ascending: true }),
    ]);

    // Calculate total revenue (subscriptions + paid content unlocks)
    let totalRevenueCents = 0;
    let currency = 'XAF';
    // Revenue from subscriptions (amount is already in cents)
    if (subsRevenue.data) {
      subsRevenue.data.forEach(s => {
        totalRevenueCents += (s.amount || 0);
        if (s.currency) currency = s.currency;
      });
    }
    // Revenue from paid content unlocks
    if (unlocksRevenue.data) {
      unlocksRevenue.data.forEach(u => {
        totalRevenueCents += (u.paid_amount_cents || 0);
      });
    }
    const totalRevenue = Math.round(totalRevenueCents / 100);

    // Aggregate monthly signups (6 derniers mois)
    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    const now = new Date();
    const monthlySignupsFinal = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
      let count = 0;
      if (monthlySignupsRaw.data) {
        count = monthlySignupsRaw.data.filter(p => {
          const pd = new Date(p.created_at);
          return `${pd.getFullYear()}-${pd.getMonth()}` === monthKey;
        }).length;
      }
      monthlySignupsFinal.push({ month: monthNames[d.getMonth()], count });
    }

    // Enrich recent subscriptions with user email from profiles
    let recentSubscriptions = [];
    if (recentSubs.data && recentSubs.data.length > 0) {
      const userIds = [...new Set(recentSubs.data.map(s => s.user_id))];
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, email, display_name')
        .in('id', userIds);
      const profileMap = {};
      if (profiles) profiles.forEach(p => { profileMap[p.id] = p; });
      recentSubscriptions = recentSubs.data.map(s => ({
        user_email: profileMap[s.user_id]?.email || '—',
        user_name: profileMap[s.user_id]?.display_name || '—',
        plan_type: s.plan_type,
        amount: s.amount ? Math.round(s.amount / 100) : 0,
        currency: s.currency || 'XAF',
        status: s.status,
        created_at: s.created_at,
      }));
    }

    // Calculate total reading time in hours
    let totalTimeSeconds = 0;
    if (readingTime.data) {
      readingTime.data.forEach(r => { totalTimeSeconds += (r.total_time_seconds || 0); });
    }

    res.json({
      users: {
        total: usersTotal.count || 0,
        active: usersActive.count || 0,
        blocked: usersBlocked.count || 0,
        admins: usersAdmins.count || 0,
      },
      subscriptions: {
        active: subsActive.count || 0,
        expired: subsExpired.count || 0,
        cancelled: subsCancelled.count || 0,
        totalRevenue,
        currency,
      },
      contents: {
        total: contentsTotal.count || 0,
        ebooks: contentsEbooks.count || 0,
        audiobooks: contentsAudiobooks.count || 0,
        published: contentsPublished.count || 0,
        noRightsHolder: contentsNoRH.count || 0,
        categories: categoriesCount.count || 0,
        rightsHolders: rightsHoldersCount.count || 0,
        unlocks: unlocksCount.count || 0,
      },
      reading: {
        total: readingTotal.count || 0,
        completed: readingCompleted.count || 0,
        totalTimeHours: Math.round(totalTimeSeconds / 3600),
      },
      recentAudit: recentAudit.data || [],
      recentSubscriptions,
      monthlySignups: monthlySignupsFinal,
      newUsersThisMonth: newUsersMonth.count || 0,
    });
  } catch (err) {
    console.error('Dashboard stats error:', err.message);
    res.status(500).json({ error: 'Erreur chargement statistiques' });
  }
});

// ── Gestion lectures utilisateurs ───────────────────────────────────────────

/** GET /admin/api/users-search?q= — chercher un utilisateur par email/nom */
router.get('/users-search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ users: [] });

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, email, display_name, role, is_active, created_at')
      .or(`email.ilike.%${q}%,display_name.ilike.%${q}%`)
      .order('created_at', { ascending: false })
      .limit(15);

    if (error) throw error;
    res.json({ users: data || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** PATCH /admin/api/user-update/:userId — modifier profil (display_name, role, is_active) */
router.patch('/user-update/:userId', express.json(), async (req, res) => {
  try {
    const { userId } = req.params;
    const { display_name, role, is_active } = req.body;
    const updates = {};
    if (display_name !== undefined) updates.display_name = display_name;
    if (role !== undefined) updates.role = role;
    if (is_active !== undefined) updates.is_active = is_active;
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Aucun champ à modifier.' });

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select('id, email, display_name, role, is_active, created_at')
      .single();
    if (error) throw error;
    res.json({ success: true, profile: data });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

/** POST /admin/api/subscription-extend — prolonger l'abonnement actif d'un utilisateur */
router.post('/subscription-extend', express.json(), async (req, res) => {
  try {
    const { userId, months } = req.body;
    if (!userId || !months) return res.status(400).json({ error: 'userId et months requis.' });

    const { data: sub, error: subErr } = await supabaseAdmin
      .from('subscriptions')
      .select('id, current_period_end, current_period_start')
      .eq('user_id', userId)
      .eq('status', 'ACTIVE')
      .maybeSingle();
    if (subErr) throw subErr;
    if (!sub) return res.status(404).json({ error: 'Aucun abonnement actif pour cet utilisateur.' });

    const newEnd = new Date(sub.current_period_end);
    newEnd.setMonth(newEnd.getMonth() + parseInt(months, 10));

    const { data: updated, error: updErr } = await supabaseAdmin
      .from('subscriptions')
      .update({ current_period_end: newEnd.toISOString() })
      .eq('id', sub.id)
      .select('id, status, plan_type, current_period_start, current_period_end, amount, currency')
      .single();
    if (updErr) throw updErr;
    res.json({ success: true, subscription: updated });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

/** POST /admin/api/subscription-cancel/:userId — annuler l'abonnement actif */
router.post('/subscription-cancel/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { data: sub, error: subErr } = await supabaseAdmin
      .from('subscriptions')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'ACTIVE')
      .maybeSingle();
    if (subErr) throw subErr;
    if (!sub) return res.status(404).json({ error: 'Aucun abonnement actif.' });

    const { error: updErr } = await supabaseAdmin
      .from('subscriptions')
      .update({ status: 'CANCELLED', cancelled_at: new Date().toISOString() })
      .eq('id', sub.id);
    if (updErr) throw updErr;
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

/** GET /admin/api/user-reading/:userId — accès livres + historique d'un utilisateur */
router.get('/user-reading/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const [profileRes, subRes, unlocksRes, historyRes] = await Promise.all([
      supabaseAdmin.from('profiles').select('id, email, display_name, role, is_active, created_at').eq('id', userId).single(),
      supabaseAdmin.from('subscriptions').select('id, status, plan_type, current_period_start, current_period_end, amount, currency, created_at').eq('user_id', userId).eq('status', 'ACTIVE').maybeSingle(),
      supabaseAdmin.from('content_unlocks')
        .select('id, source, unlocked_at, metadata, contents(id, title, author, cover_url, content_type, access_type)')
        .eq('user_id', userId)
        .order('unlocked_at', { ascending: false }),
      supabaseAdmin.from('reading_history')
        .select('id, progress_percent, total_time_seconds, is_completed, last_read_at, completed_at, contents(id, title, author, cover_url, content_type)')
        .eq('user_id', userId)
        .order('last_read_at', { ascending: false }),
    ]);

    if (!profileRes.data) return res.status(404).json({ error: 'Utilisateur introuvable.' });

    res.json({
      profile:      profileRes.data,
      subscription: subRes.data || null,
      unlocks:      unlocksRes.data  || [],
      history:      historyRes.data  || [],
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** GET /admin/api/contents-search?q= — chercher un contenu pour attribution */
router.get('/contents-search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ contents: [] });

    const { data, error } = await supabaseAdmin
      .from('contents')
      .select('id, title, author, cover_url, content_type, access_type')
      .or(`title.ilike.%${q}%,author.ilike.%${q}%`)
      .eq('is_published', true)
      .limit(10);

    if (error) throw error;
    res.json({ contents: data || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** POST /admin/api/user-reading/grant — attribuer l'accès à un livre */
router.post('/user-reading/grant', express.json(), async (req, res) => {
  try {
    const { userId, contentId } = req.body;
    if (!userId || !contentId) return res.status(400).json({ error: 'userId et contentId requis.' });

    const { data, error } = await supabaseAdmin
      .from('content_unlocks')
      .upsert({
        user_id:    userId,
        content_id: contentId,
        source:     'admin_grant',
        unlocked_at: new Date().toISOString(),
        metadata:   { granted_by: 'admin' },
      }, { onConflict: 'user_id,content_id' })
      .select('*, contents(id, title, author, cover_url, content_type, access_type)')
      .single();

    if (error) throw error;
    res.json({ success: true, unlock: data });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

/** DELETE /admin/api/user-reading/revoke/:unlockId — retirer l'accès à un livre */
router.delete('/user-reading/revoke/:unlockId', async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('content_unlocks')
      .delete()
      .eq('id', req.params.unlockId);

    if (error) throw error;
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── Versements éditeurs ─────────────────────────────────────────────────────

const publisherService = require('../services/publisher.service');

/** GET /admin/api/payouts — revenus non versés, groupés par éditeur */
router.get('/payouts', async (req, res) => {
  try {
    const payouts = await publisherService.getPayoutsOverview(req.query);
    res.json({ payouts });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** GET /admin/api/payout-history — historique paginé des versements */
router.get('/payout-history', async (req, res) => {
  try {
    const result = await publisherService.getPayoutsHistory(req.query);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/** POST /admin/api/payouts — créer un versement (à partir des revenus existants) */
router.post('/payouts', express.json(), async (req, res) => {
  try {
    const adminId = req.session?.adminUser?.id;
    const result = await publisherService.createPayout(adminId, req.body);
    res.json({ success: true, payout: result });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

/** POST /admin/api/payouts-manual — créer un versement manuel avec montant libre */
router.post('/payouts-manual', express.json(), async (req, res) => {
  try {
    const adminId = req.session?.adminUser?.id;
    const result = await publisherService.createManualPayout(adminId, req.body);
    res.json({ success: true, payout: result });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

/** POST /admin/api/payouts-bulk — créer versements pour tous les éditeurs */
router.post('/payouts-bulk', express.json(), async (req, res) => {
  try {
    const adminId = req.session?.adminUser?.id;
    const result = await publisherService.createAllPayouts(adminId, req.body);
    res.json({ success: true, ...result });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

/** PUT /admin/api/payouts/:id/status — changer le statut d'un versement */
router.put('/payouts/:id/status', express.json(), async (req, res) => {
  try {
    const adminId = req.session?.adminUser?.id;
    const payout = await publisherService.updatePayoutStatus(req.params.id, req.body.status, adminId);
    res.json({ success: true, payout });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ────────────────────────────────────────────────────────────────────────────

/**
 * POST /admin/api/run-expiry-check
 * Manually trigger the subscription expiry check jobs
 */
router.post('/run-expiry-check', async (req, res) => {
  try {
    const { runExpiryCheck } = require('../scheduler/subscription-scheduler');
    const results = await runExpiryCheck();
    res.json({
      success: true,
      message: 'Expiry check completed',
      results,
    });
  } catch (err) {
    console.error('Manual expiry check error:', err.message);
    res.status(500).json({ error: 'Erreur lors de la verification des expirations' });
  }
});

module.exports = router;
