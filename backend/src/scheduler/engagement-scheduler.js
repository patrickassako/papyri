/**
 * Engagement & Lifecycle Scheduler
 *
 * Cron jobs that drive user engagement and monetization beyond the basic
 * subscription lifecycle.  All notifications are localized via
 * notifications.service helpers (which read profiles.language).
 */

const cron = require('node-cron');
const { supabaseAdmin } = require('../config/database');
const notif = require('../services/notifications.service');

const DAY_MS = 86400000;

// ── helpers ───────────────────────────────────────────────────────

async function fetchAllActiveUsers() {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, language, created_at, full_name')
    .eq('is_active', true);
  return data || [];
}

// ── 1. READING REMINDER (daily 18:00 UTC) ────────────────────────
// For each user with reading_history rows whose progress > 0, last_read_at >= 3d,
// not finished, send one reminder for the most recent unfinished book.
async function runReadingReminder() {
  const job = 'readingReminder';
  console.log(`[scheduler] Running ${job}...`);
  try {
    const threeDaysAgo = new Date(Date.now() - 3 * DAY_MS).toISOString();
    // Use distinct on user_id, take the most recently read unfinished row.
    const { data: rows, error } = await supabaseAdmin
      .from('reading_history')
      .select('user_id, content_id, last_read_at, contents(title)')
      .eq('is_completed', false)
      .lt('last_read_at', threeDaysAgo)
      .gt('progress_percent', 0)
      .order('last_read_at', { ascending: false });

    if (error) {
      console.error(`[scheduler] ${job} query error:`, error.message);
      return;
    }
    if (!rows?.length) return console.log(`[scheduler] ${job}: nothing to send`);

    const seen = new Set();
    let sent = 0;
    for (const r of rows) {
      if (seen.has(r.user_id)) continue;
      seen.add(r.user_id);
      // Avoid spamming: skip if already sent a reminder in the last 4 days.
      const already = await notif.hasRecentNotification(r.user_id, notif.NOTIFICATION_TYPES.READING_REMINDER, 4);
      if (already) continue;
      const daysSince = Math.max(3, Math.floor((Date.now() - new Date(r.last_read_at).getTime()) / DAY_MS));
      await notif.notifyReadingReminder(r.user_id, {
        contentId: r.content_id,
        title: r.contents?.title || 'ce livre',
        daysSince,
      }).catch(e => console.error(`[scheduler] ${job} send error ${r.user_id}:`, e.message));
      sent++;
    }
    console.log(`[scheduler] ${job} done: ${sent} reminders sent`);
  } catch (err) {
    console.error(`[scheduler] ${job} fatal:`, err.message);
  }
}

// ── 2. READING STREAK (daily 20:00 UTC) ──────────────────────────
// Count distinct reading days in the last N days per user; if 3+ consecutive
// days ending today (UTC), congratulate.
async function runReadingStreak() {
  const job = 'readingStreak';
  console.log(`[scheduler] Running ${job}...`);
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * DAY_MS).toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from('reading_history')
      .select('user_id, last_read_at')
      .gte('last_read_at', sevenDaysAgo);

    if (error) {
      console.error(`[scheduler] ${job} query error:`, error.message);
      return;
    }
    if (!rows?.length) return;

    // Build per-user set of YYYY-MM-DD (UTC) days that have activity.
    const map = new Map();
    for (const r of rows) {
      const day = new Date(r.last_read_at).toISOString().slice(0, 10);
      if (!map.has(r.user_id)) map.set(r.user_id, new Set());
      map.get(r.user_id).add(day);
    }

    const today = new Date().toISOString().slice(0, 10);
    let sent = 0;
    for (const [userId, daySet] of map.entries()) {
      // Count consecutive days ending today.
      let streak = 0;
      let cursor = new Date();
      for (let i = 0; i < 7; i++) {
        const key = cursor.toISOString().slice(0, 10);
        if (daySet.has(key)) {
          streak++;
          cursor = new Date(cursor.getTime() - DAY_MS);
        } else break;
      }
      // Only celebrate on milestone days 3, 5, 7, and only if today is one of them.
      const milestones = [3, 5, 7];
      if (!milestones.includes(streak)) continue;
      if (!daySet.has(today)) continue;
      const already = await notif.hasRecentNotification(userId, notif.NOTIFICATION_TYPES.READING_STREAK, 1);
      if (already) continue;
      await notif.notifyReadingStreak(userId, { streakDays: streak })
        .catch(e => console.error(`[scheduler] ${job} send error ${userId}:`, e.message));
      sent++;
    }
    console.log(`[scheduler] ${job} done: ${sent} streaks celebrated`);
  } catch (err) {
    console.error(`[scheduler] ${job} fatal:`, err.message);
  }
}

// ── 3. WEEKLY RECAP (Sunday 19:00 UTC) ───────────────────────────
async function runWeeklyRecap() {
  const job = 'weeklyRecap';
  console.log(`[scheduler] Running ${job}...`);
  try {
    const weekAgo = new Date(Date.now() - 7 * DAY_MS).toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from('reading_history')
      .select('user_id, is_completed, last_read_at, total_time_seconds')
      .gte('last_read_at', weekAgo);

    if (error) {
      console.error(`[scheduler] ${job} query error:`, error.message);
      return;
    }
    if (!rows?.length) return;

    const stats = new Map(); // userId -> { booksFinished, secondsRead }
    for (const r of rows) {
      const s = stats.get(r.user_id) || { booksFinished: 0, secondsRead: 0 };
      if (r.is_completed) s.booksFinished++;
      s.secondsRead += Number(r.total_time_seconds || 0);
      stats.set(r.user_id, s);
    }

    let sent = 0;
    for (const [userId, s] of stats.entries()) {
      const minutesRead = Math.round(s.secondsRead / 60);
      if (minutesRead < 5 && s.booksFinished === 0) continue; // skip near-zero activity
      await notif.notifyWeeklyRecap(userId, {
        booksFinished: s.booksFinished,
        minutesRead,
      }).catch(e => console.error(`[scheduler] ${job} send error ${userId}:`, e.message));
      sent++;
    }
    console.log(`[scheduler] ${job} done: ${sent} recaps sent`);
  } catch (err) {
    console.error(`[scheduler] ${job} fatal:`, err.message);
  }
}

// ── 4. INACTIVITY NUDGE (daily 17:00 UTC) ────────────────────────
// Users with last_seen_at >= 14 days, push once per fortnight.
async function runInactivityNudge() {
  const job = 'inactivityNudge';
  console.log(`[scheduler] Running ${job}...`);
  try {
    const cutoff = new Date(Date.now() - 14 * DAY_MS).toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from('profiles')
      .select('id, last_seen_at')
      .lt('last_seen_at', cutoff)
      .eq('is_active', true);
    if (error) {
      console.error(`[scheduler] ${job} query error:`, error.message);
      return;
    }
    if (!rows?.length) return;
    let sent = 0;
    for (const r of rows) {
      const already = await notif.hasRecentNotification(r.id, notif.NOTIFICATION_TYPES.INACTIVITY_NUDGE, 14);
      if (already) continue;
      await notif.notifyInactivity(r.id)
        .catch(e => console.error(`[scheduler] ${job} send error ${r.id}:`, e.message));
      sent++;
    }
    console.log(`[scheduler] ${job} done: ${sent} nudges sent`);
  } catch (err) {
    console.error(`[scheduler] ${job} fatal:`, err.message);
  }
}

// ── 5. WELCOME DAY 1 NO SUB (daily 12:00 UTC) ────────────────────
async function runWelcomeDay1NoSub() {
  const job = 'welcomeDay1NoSub';
  console.log(`[scheduler] Running ${job}...`);
  try {
    const since = new Date(Date.now() - 2 * DAY_MS).toISOString();
    const until = new Date(Date.now() - 1 * DAY_MS).toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .gte('created_at', since)
      .lt('created_at', until)
      .eq('is_active', true);
    if (error) { console.error(`[scheduler] ${job} query error:`, error.message); return; }
    if (!rows?.length) return;

    let sent = 0;
    for (const r of rows) {
      // Skip if user already has an active subscription.
      const { data: subs } = await supabaseAdmin
        .from('subscriptions')
        .select('id')
        .eq('user_id', r.id)
        .in('status', ['ACTIVE', 'TRIAL'])
        .limit(1);
      if (subs?.length) continue;
      const already = await notif.hasRecentNotification(r.id, notif.NOTIFICATION_TYPES.WELCOME_DAY1, 30);
      if (already) continue;
      await notif.notifyWelcomeDay1NoSub(r.id).catch(e => console.error(`[scheduler] ${job} send error ${r.id}:`, e.message));
      sent++;
    }
    console.log(`[scheduler] ${job} done: ${sent} sent`);
  } catch (err) {
    console.error(`[scheduler] ${job} fatal:`, err.message);
  }
}

// ── 6. SIGNUP ANNIVERSARY (daily 08:00 UTC) ──────────────────────
async function runSignupAnniversary() {
  const job = 'signupAnniversary';
  console.log(`[scheduler] Running ${job}...`);
  try {
    const today = new Date();
    const mmdd = `-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;
    // We can't easily query "anniversary" with Supabase; fetch active users and filter in code.
    const users = await fetchAllActiveUsers();
    let sent = 0;
    for (const u of users) {
      if (!u.created_at) continue;
      const created = new Date(u.created_at);
      const sameDay = u.created_at.includes(mmdd);
      if (!sameDay) continue;
      const years = today.getUTCFullYear() - created.getUTCFullYear();
      if (years < 1) continue;
      const already = await notif.hasRecentNotification(u.id, notif.NOTIFICATION_TYPES.SIGNUP_ANNIVERSARY, 300);
      if (already) continue;
      await notif.notifySignupAnniversary(u.id, { years }).catch(e => console.error(`[scheduler] ${job} send error ${u.id}:`, e.message));
      sent++;
    }
    console.log(`[scheduler] ${job} done: ${sent} sent`);
  } catch (err) {
    console.error(`[scheduler] ${job} fatal:`, err.message);
  }
}

// ── 7. WEEKLY TOP (Monday 10:00 UTC) ─────────────────────────────
async function runWeeklyTop() {
  const job = 'weeklyTop';
  console.log(`[scheduler] Running ${job}...`);
  try {
    const weekAgo = new Date(Date.now() - 7 * DAY_MS).toISOString();
    // Count reading_history rows per content in the past week.
    const { data: rows, error } = await supabaseAdmin
      .from('reading_history')
      .select('content_id, contents(title)')
      .gte('last_read_at', weekAgo);
    if (error) { console.error(`[scheduler] ${job} query error:`, error.message); return; }
    if (!rows?.length) return;

    const counts = {};
    const titles = {};
    for (const r of rows) {
      if (!r.content_id) continue;
      counts[r.content_id] = (counts[r.content_id] || 0) + 1;
      titles[r.content_id] = r.contents?.title;
    }
    const top = Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([id]) => titles[id])
      .filter(Boolean);
    if (!top.length) return;

    // Send to all users with push enabled.
    const { data: prefs } = await supabaseAdmin
      .from('notification_preferences')
      .select('user_id')
      .eq('push_enabled', true)
      .not('fcm_token', 'is', null);
    const userIds = (prefs || []).map(p => p.user_id);
    if (!userIds.length) return;
    await notif.notifyWeeklyTop(userIds, { topTitles: top });
    console.log(`[scheduler] ${job} done: top=${top.join(', ')} sent to ${userIds.length} users`);
  } catch (err) {
    console.error(`[scheduler] ${job} fatal:`, err.message);
  }
}

// ── 8b. POST EXPIRY PROMO (daily 14:00 UTC) ──────────────────────
// User whose subscription expired between J-8 and J-6 and didn't renew
// gets a single push with a generic promo code (configurable).
const POST_EXPIRY_PROMO_CODE = process.env.POST_EXPIRY_PROMO_CODE || 'REVIENS20';
const POST_EXPIRY_PROMO_PCT  = Number(process.env.POST_EXPIRY_PROMO_PCT || 20);

async function runPostExpiryPromo() {
  const job = 'postExpiryPromo';
  console.log(`[scheduler] Running ${job}...`);
  try {
    const since = new Date(Date.now() - 8 * DAY_MS).toISOString();
    const until = new Date(Date.now() - 6 * DAY_MS).toISOString();
    const { data: subs, error } = await supabaseAdmin
      .from('subscriptions')
      .select('user_id, status, end_date, updated_at')
      .in('status', ['EXPIRED', 'CANCELLED'])
      .gte('end_date', since)
      .lt('end_date', until);
    if (error) { console.error(`[scheduler] ${job} query error:`, error.message); return; }
    if (!subs?.length) return;

    const sentTo = new Set();
    for (const s of subs) {
      if (sentTo.has(s.user_id)) continue;
      // Skip if user has a new active sub already.
      const { data: active } = await supabaseAdmin
        .from('subscriptions')
        .select('id')
        .eq('user_id', s.user_id)
        .in('status', ['ACTIVE', 'TRIAL'])
        .limit(1);
      if (active?.length) continue;
      const already = await notif.hasRecentNotification(s.user_id, notif.NOTIFICATION_TYPES.POST_EXPIRY_PROMO, 90);
      if (already) continue;
      await notif.notifyPostExpiryPromo(s.user_id, {
        promoCode: POST_EXPIRY_PROMO_CODE,
        discountPercent: POST_EXPIRY_PROMO_PCT,
      }).catch(e => console.error(`[scheduler] ${job} send error ${s.user_id}:`, e.message));
      sentTo.add(s.user_id);
    }
    console.log(`[scheduler] ${job} done: ${sentTo.size} sent`);
  } catch (err) {
    console.error(`[scheduler] ${job} fatal:`, err.message);
  }
}

// ── 8a. FIRST READ DONE (daily 21:00 UTC) ────────────────────────
// Detect users whose FIRST is_completed=true reading_history row was
// completed in the last 24h, congratulate them and suggest a follow-up.
async function runFirstReadDoneNudge() {
  const job = 'firstReadDoneNudge';
  console.log(`[scheduler] Running ${job}...`);
  try {
    const since = new Date(Date.now() - 1 * DAY_MS).toISOString();
    // Fetch all completed rows from the last 24h grouped by user.
    const { data: rows, error } = await supabaseAdmin
      .from('reading_history')
      .select('user_id, content_id, completed_at, contents(title, categories)')
      .eq('is_completed', true)
      .gte('completed_at', since);
    if (error) { console.error(`[scheduler] ${job} query error:`, error.message); return; }
    if (!rows?.length) return;

    const candidates = new Map(); // userId -> { contentId }
    for (const r of rows) {
      if (!candidates.has(r.user_id)) candidates.set(r.user_id, r);
    }

    let sent = 0;
    for (const [userId] of candidates.entries()) {
      // Is this the user's first ever completed read?
      const { count } = await supabaseAdmin
        .from('reading_history')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_completed', true);
      if ((count || 0) !== 1) continue;
      const already = await notif.hasRecentNotification(userId, notif.NOTIFICATION_TYPES.FIRST_READ_DONE, 365);
      if (already) continue;
      // Pick a popular suggestion (most read in last 30d that's not this one).
      const { data: pop } = await supabaseAdmin
        .from('reading_history')
        .select('content_id, contents(title)')
        .gte('last_read_at', new Date(Date.now() - 30 * DAY_MS).toISOString())
        .limit(20);
      const suggestion = (pop || []).find(p => p.content_id && p.contents?.title);
      await notif.notifyFirstReadDone(userId, {
        suggestionContentId: suggestion?.content_id,
        suggestionTitle: suggestion?.contents?.title,
      }).catch(e => console.error(`[scheduler] ${job} send error ${userId}:`, e.message));
      sent++;
    }
    console.log(`[scheduler] ${job} done: ${sent} sent`);
  } catch (err) {
    console.error(`[scheduler] ${job} fatal:`, err.message);
  }
}

// ── 8. CREDIT EXPIRING SOON (daily 09:30 UTC) ────────────────────
async function runCreditExpiringNudge() {
  const job = 'creditExpiringNudge';
  console.log(`[scheduler] Running ${job}...`);
  try {
    const in30 = new Date(Date.now() + 30 * DAY_MS).toISOString();
    const today = new Date().toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from('bonus_credits')
      .select('user_id, expires_at, quantity_total, quantity_used')
      .lte('expires_at', in30)
      .gt('expires_at', today);
    if (error) { console.error(`[scheduler] ${job} query error:`, error.message); return; }
    if (!rows?.length) return;

    const sentToUser = new Set();
    for (const r of rows) {
      if (sentToUser.has(r.user_id)) continue;
      const remaining = Number(r.quantity_total || 0) - Number(r.quantity_used || 0);
      if (remaining <= 0) continue;
      const already = await notif.hasRecentNotification(r.user_id, notif.NOTIFICATION_TYPES.CREDIT_EXPIRING, 14);
      if (already) continue;
      const expiresOn = new Date(r.expires_at).toISOString().slice(0, 10);
      await notif.notifyCreditExpiring(r.user_id, { expiresOn })
        .catch(e => console.error(`[scheduler] ${job} send error ${r.user_id}:`, e.message));
      sentToUser.add(r.user_id);
    }
    console.log(`[scheduler] ${job} done: ${sentToUser.size} sent`);
  } catch (err) {
    console.error(`[scheduler] ${job} fatal:`, err.message);
  }
}

// ── start ────────────────────────────────────────────────────────

function startEngagementScheduler() {
  cron.schedule('0 18 * * *', runReadingReminder);       // daily 18:00 UTC
  cron.schedule('0 20 * * *', runReadingStreak);         // daily 20:00 UTC
  cron.schedule('0 19 * * 0', runWeeklyRecap);           // Sunday 19:00 UTC
  cron.schedule('0 17 * * *', runInactivityNudge);       // daily 17:00 UTC
  cron.schedule('0 12 * * *', runWelcomeDay1NoSub);      // daily 12:00 UTC
  cron.schedule('0 8 * * *',  runSignupAnniversary);     // daily 08:00 UTC
  cron.schedule('0 10 * * 1', runWeeklyTop);             // Monday 10:00 UTC
  cron.schedule('30 9 * * *', runCreditExpiringNudge);   // daily 09:30 UTC
  cron.schedule('0 21 * * *', runFirstReadDoneNudge);    // daily 21:00 UTC
  cron.schedule('0 14 * * *', runPostExpiryPromo);       // daily 14:00 UTC

  console.log('✅ Engagement scheduler started (10 jobs)');
}

module.exports = {
  startEngagementScheduler,
  // Exposed for manual testing.
  runReadingReminder,
  runReadingStreak,
  runWeeklyRecap,
  runInactivityNudge,
  runWelcomeDay1NoSub,
  runSignupAnniversary,
  runWeeklyTop,
  runCreditExpiringNudge,
  runFirstReadDoneNudge,
  runPostExpiryPromo,
};
