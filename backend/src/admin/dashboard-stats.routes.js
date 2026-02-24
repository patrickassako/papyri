/**
 * Dashboard Stats API for AdminJS
 * Returns aggregated KPIs for the admin dashboard
 */
const { Router } = require('express');
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
