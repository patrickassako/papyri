/**
 * Subscription Scheduler
 * Background cron jobs for subscription lifecycle management:
 * - expireSubscriptions: mark expired active subscriptions
 * - cancelExpiredSubscriptions: finalize cancelled-at-period-end subscriptions
 * - sendExpirationReminders: notify users before their subscription expires
 */

const cron = require('node-cron');
const { supabaseAdmin } = require('../config/database');
const config = require('../config/env');
const {
  sendExpirationReminderEmail,
  sendSubscriptionExpiredEmail,
} = require('../services/email.service');

const RENEW_URL = `${config.frontendUrl || 'http://localhost:3000'}/subscription`;

/**
 * Job 1 — Expire subscriptions
 * Active subscriptions past their period end that were NOT scheduled for cancellation
 * → status becomes EXPIRED, user gets "your subscription expired" email
 */
async function expireSubscriptions() {
  const jobName = 'expireSubscriptions';
  console.log(`[scheduler] Running ${jobName}...`);

  try {
    const now = new Date().toISOString();

    const { data: subscriptions, error } = await supabaseAdmin
      .from('subscriptions')
      .select('id, user_id, current_period_end')
      .eq('status', 'ACTIVE')
      .eq('cancel_at_period_end', false)
      .lt('current_period_end', now);

    if (error) {
      console.error(`[scheduler] ${jobName} query error:`, error.message);
      return { processed: 0, errors: 1 };
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`[scheduler] ${jobName}: no subscriptions to expire`);
      return { processed: 0, errors: 0 };
    }

    console.log(`[scheduler] ${jobName}: found ${subscriptions.length} to expire`);

    let processed = 0;
    let errors = 0;

    for (const sub of subscriptions) {
      try {
        // Mark as EXPIRED
        const { error: updateError } = await supabaseAdmin
          .from('subscriptions')
          .update({
            status: 'EXPIRED',
            updated_at: new Date().toISOString(),
          })
          .eq('id', sub.id);

        if (updateError) {
          console.error(`[scheduler] ${jobName}: failed to expire ${sub.id}:`, updateError.message);
          errors++;
          continue;
        }

        // Get user profile for email
        const profile = await getUserProfile(sub.user_id);
        if (profile) {
          await sendSubscriptionExpiredEmail(
            profile.email,
            profile.full_name || profile.email,
            RENEW_URL
          );
        }

        processed++;
      } catch (err) {
        console.error(`[scheduler] ${jobName}: error processing ${sub.id}:`, err.message);
        errors++;
      }
    }

    console.log(`[scheduler] ${jobName} done: ${processed} expired, ${errors} errors`);
    return { processed, errors };
  } catch (err) {
    console.error(`[scheduler] ${jobName} fatal error:`, err.message);
    return { processed: 0, errors: 1 };
  }
}

/**
 * Job 2 — Cancel expired subscriptions
 * Active subscriptions past their period end that WERE scheduled for cancellation
 * → status becomes CANCELLED
 */
async function cancelExpiredSubscriptions() {
  const jobName = 'cancelExpiredSubscriptions';
  console.log(`[scheduler] Running ${jobName}...`);

  try {
    const now = new Date().toISOString();

    const { data: subscriptions, error } = await supabaseAdmin
      .from('subscriptions')
      .select('id, user_id, current_period_end')
      .eq('status', 'ACTIVE')
      .eq('cancel_at_period_end', true)
      .lt('current_period_end', now);

    if (error) {
      console.error(`[scheduler] ${jobName} query error:`, error.message);
      return { processed: 0, errors: 1 };
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`[scheduler] ${jobName}: no subscriptions to cancel`);
      return { processed: 0, errors: 0 };
    }

    console.log(`[scheduler] ${jobName}: found ${subscriptions.length} to cancel`);

    let processed = 0;
    let errors = 0;

    for (const sub of subscriptions) {
      try {
        const { error: updateError } = await supabaseAdmin
          .from('subscriptions')
          .update({
            status: 'CANCELLED',
            updated_at: new Date().toISOString(),
          })
          .eq('id', sub.id);

        if (updateError) {
          console.error(`[scheduler] ${jobName}: failed to cancel ${sub.id}:`, updateError.message);
          errors++;
          continue;
        }

        // Get user profile for email
        const profile = await getUserProfile(sub.user_id);
        if (profile) {
          await sendSubscriptionExpiredEmail(
            profile.email,
            profile.full_name || profile.email,
            RENEW_URL
          );
        }

        processed++;
      } catch (err) {
        console.error(`[scheduler] ${jobName}: error processing ${sub.id}:`, err.message);
        errors++;
      }
    }

    console.log(`[scheduler] ${jobName} done: ${processed} cancelled, ${errors} errors`);
    return { processed, errors };
  } catch (err) {
    console.error(`[scheduler] ${jobName} fatal error:`, err.message);
    return { processed: 0, errors: 1 };
  }
}

/**
 * Job 3 — Send expiration reminders
 * Active subscriptions expiring within 3 days (not scheduled for cancel)
 * → reminder email at 3 days and 1 day
 */
async function sendExpirationReminders() {
  const jobName = 'sendExpirationReminders';
  console.log(`[scheduler] Running ${jobName}...`);

  try {
    const now = new Date();
    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    // Get subscriptions expiring within 3 days
    const { data: subscriptions, error } = await supabaseAdmin
      .from('subscriptions')
      .select('id, user_id, current_period_end')
      .eq('status', 'ACTIVE')
      .eq('cancel_at_period_end', false)
      .gte('current_period_end', now.toISOString())
      .lte('current_period_end', threeDaysFromNow.toISOString());

    if (error) {
      console.error(`[scheduler] ${jobName} query error:`, error.message);
      return { processed: 0, errors: 1 };
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`[scheduler] ${jobName}: no reminders to send`);
      return { processed: 0, errors: 0 };
    }

    console.log(`[scheduler] ${jobName}: found ${subscriptions.length} expiring soon`);

    let processed = 0;
    let errors = 0;

    for (const sub of subscriptions) {
      try {
        const periodEnd = new Date(sub.current_period_end);
        const daysLeft = Math.ceil((periodEnd - now) / (1000 * 60 * 60 * 24));

        // Only send at exactly 3 days or 1 day
        if (daysLeft !== 3 && daysLeft !== 1) continue;

        const profile = await getUserProfile(sub.user_id);
        if (profile) {
          await sendExpirationReminderEmail(
            profile.email,
            profile.full_name || profile.email,
            daysLeft,
            RENEW_URL
          );
        }

        processed++;
      } catch (err) {
        console.error(`[scheduler] ${jobName}: error processing ${sub.id}:`, err.message);
        errors++;
      }
    }

    console.log(`[scheduler] ${jobName} done: ${processed} reminders sent, ${errors} errors`);
    return { processed, errors };
  } catch (err) {
    console.error(`[scheduler] ${jobName} fatal error:`, err.message);
    return { processed: 0, errors: 1 };
  }
}

/**
 * Helper — get user profile (email + full_name) from profiles table
 */
async function getUserProfile(userId) {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Run all expiry jobs (used by manual admin trigger)
 */
async function runExpiryCheck() {
  const results = {};
  results.expire = await expireSubscriptions();
  results.cancel = await cancelExpiredSubscriptions();
  return results;
}

/**
 * Start the scheduler — call once at server boot
 */
function startScheduler() {
  // Every hour at minute 0: expire + cancel
  cron.schedule('0 * * * *', async () => {
    await expireSubscriptions();
    await cancelExpiredSubscriptions();
  });

  // Daily at 9:00 UTC: send reminders
  cron.schedule('0 9 * * *', async () => {
    await sendExpirationReminders();
  });

  console.log('✅ Subscription scheduler started (3 jobs)');
}

module.exports = {
  startScheduler,
  expireSubscriptions,
  cancelExpiredSubscriptions,
  sendExpirationReminders,
  runExpiryCheck,
};
