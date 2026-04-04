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
  sendRenewalReminderEmail,
  sendPaymentFailedEmail,
} = require('../services/email.service');
const {
  notifyExpirationReminder,
  notifySubscriptionExpired,
} = require('../services/notifications.service');

const RENEW_URL = `${config.frontendUrl || 'http://localhost:3000'}/subscription`;

// Grace period in days before expiring a subscription with a failed payment
const GRACE_PERIOD_DAYS = 7;
// Minimum interval between failure reminder emails (in hours)
const REMINDER_INTERVAL_HOURS = 48;

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

    // Only expire if past current_period_end + GRACE_PERIOD_DAYS
    const graceCutoff = new Date(now);
    graceCutoff.setDate(graceCutoff.getDate() - GRACE_PERIOD_DAYS);

    const { data: subscriptions, error } = await supabaseAdmin
      .from('subscriptions')
      .select('id, user_id, current_period_end, metadata')
      .eq('status', 'ACTIVE')
      .eq('cancel_at_period_end', false)
      .lt('current_period_end', graceCutoff.toISOString());

    if (error) {
      console.error(`[scheduler] ${jobName} query error:`, error.message);
      return { processed: 0, errors: 1 };
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`[scheduler] ${jobName}: no subscriptions to expire`);
      return { processed: 0, errors: 0 };
    }

    console.log(`[scheduler] ${jobName}: found ${subscriptions.length} to expire (past grace period)`);

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

        // Get user profile for email + push
        const profile = await getUserProfile(sub.user_id);
        if (profile) {
          await sendSubscriptionExpiredEmail(
            profile.email,
            profile.full_name || profile.email,
            RENEW_URL
          );
          // Notification push (non bloquant)
          notifySubscriptionExpired(sub.user_id)
            .catch((e) => console.error(`[scheduler] push expired error ${sub.id}:`, e.message));
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
          // Notification push (non bloquant)
          notifyExpirationReminder(sub.user_id, daysLeft, RENEW_URL)
            .catch((e) => console.error(`[scheduler] push reminder error ${sub.id}:`, e.message));
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
 * Job 4 — Flutterwave renewal reminders (J-7)
 * Active Flutterwave subscriptions expiring within 7 days, not scheduled for cancellation
 * → reminder email with renewal CTA (Stripe handles its own renewals automatically)
 */
async function sendFlutterwaveRenewalReminders() {
  const jobName = 'sendFlutterwaveRenewalReminders';
  console.log(`[scheduler] Running ${jobName}...`);

  try {
    const now = new Date();
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const sixDaysFromNow = new Date(now);
    sixDaysFromNow.setDate(sixDaysFromNow.getDate() + 6);

    // Flutterwave subscriptions expiring in ~7 days (between 6 and 7 days from now)
    const { data: subscriptions, error } = await supabaseAdmin
      .from('subscriptions')
      .select('id, user_id, current_period_end, plan_snapshot')
      .eq('status', 'ACTIVE')
      .eq('provider', 'flutterwave')
      .eq('cancel_at_period_end', false)
      .gte('current_period_end', sixDaysFromNow.toISOString())
      .lte('current_period_end', sevenDaysFromNow.toISOString());

    if (error) {
      console.error(`[scheduler] ${jobName} query error:`, error.message);
      return { processed: 0, errors: 1 };
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`[scheduler] ${jobName}: no reminders to send`);
      return { processed: 0, errors: 0 };
    }

    console.log(`[scheduler] ${jobName}: found ${subscriptions.length} subscriptions expiring in ~7 days`);

    let processed = 0;
    let errors = 0;

    for (const sub of subscriptions) {
      try {
        const profile = await getUserProfile(sub.user_id);
        if (profile) {
          const planName = sub.plan_snapshot?.name || 'Abonnement';
          const expiryDate = new Date(sub.current_period_end).toLocaleDateString('fr-FR', {
            day: '2-digit', month: 'long', year: 'numeric',
          });
          await sendRenewalReminderEmail(
            profile.email,
            profile.full_name || profile.email,
            { planName, renewUrl: RENEW_URL, expiryDate }
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
 * Job 6 — Handle payment failures during grace period
 * Runs daily. Finds ACTIVE subscriptions that are:
 *   - past current_period_end (payment failed / not renewed)
 *   - still within the GRACE_PERIOD_DAYS window
 * For each:
 *   - Sends a retry reminder email every REMINDER_INTERVAL_HOURS hours
 *   - Updates metadata.last_failure_reminder_at to avoid spam
 */
async function handlePaymentFailures() {
  const jobName = 'handlePaymentFailures';
  console.log(`[scheduler] Running ${jobName}...`);

  try {
    const now = new Date();

    // Grace cutoff: current_period_end must be between (now - GRACE_PERIOD_DAYS) and now
    const graceCutoff = new Date(now);
    graceCutoff.setDate(graceCutoff.getDate() - GRACE_PERIOD_DAYS);

    const { data: subscriptions, error } = await supabaseAdmin
      .from('subscriptions')
      .select('id, user_id, current_period_end, plan_snapshot, plan_type, metadata')
      .eq('status', 'ACTIVE')
      .eq('cancel_at_period_end', false)
      .lt('current_period_end', now.toISOString())      // overdue
      .gte('current_period_end', graceCutoff.toISOString()); // still in grace period

    if (error) {
      console.error(`[scheduler] ${jobName} query error:`, error.message);
      return { processed: 0, errors: 1 };
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`[scheduler] ${jobName}: no overdue subscriptions in grace period`);
      return { processed: 0, errors: 0 };
    }

    console.log(`[scheduler] ${jobName}: ${subscriptions.length} subscriptions overdue in grace period`);

    let reminded = 0;
    let skipped = 0;
    let errors = 0;

    for (const sub of subscriptions) {
      try {
        const meta = sub.metadata || {};

        // Check if we already sent a reminder recently
        if (meta.last_failure_reminder_at) {
          const lastReminder = new Date(meta.last_failure_reminder_at);
          const hoursSinceLast = (now - lastReminder) / (1000 * 60 * 60);
          if (hoursSinceLast < REMINDER_INTERVAL_HOURS) {
            skipped++;
            continue;
          }
        }

        const profile = await getUserProfile(sub.user_id);
        if (!profile?.email) {
          skipped++;
          continue;
        }

        const planName = sub.plan_snapshot?.name || (sub.plan_type === 'yearly' ? 'Annuel' : 'Mensuel');
        const daysOverdue = Math.ceil((now - new Date(sub.current_period_end)) / (1000 * 60 * 60 * 24));
        const daysLeft = GRACE_PERIOD_DAYS - daysOverdue;

        // Send retry reminder
        await sendPaymentFailedEmail(
          profile.email,
          profile.full_name || profile.email,
          {
            planName,
            retryUrl: RENEW_URL,
            // Pass extra context via planName field for scheduler-triggered reminders
            planNameSuffix: daysLeft > 0 ? ` (accès suspendu dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''})` : '',
          }
        );

        // Update metadata to track reminder
        await supabaseAdmin
          .from('subscriptions')
          .update({
            metadata: {
              ...meta,
              payment_failed_at: meta.payment_failed_at || sub.current_period_end,
              last_failure_reminder_at: now.toISOString(),
              failure_reminders_sent: (meta.failure_reminders_sent || 0) + 1,
            },
            updated_at: now.toISOString(),
          })
          .eq('id', sub.id);

        reminded++;
      } catch (err) {
        console.error(`[scheduler] ${jobName}: error on sub ${sub.id}:`, err.message);
        errors++;
      }
    }

    console.log(`[scheduler] ${jobName} done: ${reminded} reminded, ${skipped} skipped, ${errors} errors`);
    return { reminded, skipped, errors };
  } catch (err) {
    console.error(`[scheduler] ${jobName} fatal error:`, err.message);
    return { reminded: 0, skipped: 0, errors: 1 };
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
 * Job 5 — Payout scheduling (daily at 06:00 UTC)
 * 1. Passes scheduled payouts that are due today to "pending"
 * 2. Creates scheduled payouts for the next cycle (if payout day = today)
 */
async function runPayoutScheduler() {
  const jobName = 'payoutScheduler';
  console.log(`[scheduler] Running ${jobName}...`);
  try {
    const payoutScheduler = require('../services/payout-scheduler.service');

    // Step 1: Move due scheduled payouts to pending
    const processed = await payoutScheduler.processScheduledPayouts();
    console.log(`[scheduler] ${jobName}: ${processed.processed} versements passés à "pending"`);

    // Step 2: Check if today is a scheduled payout day → create new scheduled payouts
    const config = await payoutScheduler.getConfig();
    if (config.is_active) {
      const today = new Date();
      const nextDate = payoutScheduler.computeNextPayoutDate(
        config.frequency, config.day_of_month, config.day_of_week
      );
      // If next payout date is within the next 24h, schedule now
      const diff = nextDate.getTime() - today.getTime();
      if (diff >= 0 && diff < 24 * 60 * 60 * 1000) {
        const result = await payoutScheduler.createScheduledPayouts(null);
        console.log(`[scheduler] ${jobName}: ${result.created?.length || 0} versements planifiés`);
      }
    }
  } catch (err) {
    console.error(`[scheduler] ${jobName} error:`, err.message);
  }
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

  // Daily at 9:00 UTC: send expiration reminders (all providers)
  cron.schedule('0 9 * * *', async () => {
    await sendExpirationReminders();
  });

  // Daily at 10:00 UTC: send Flutterwave renewal reminders J-7
  cron.schedule('0 10 * * *', async () => {
    await sendFlutterwaveRenewalReminders();
  });

  // Daily at 11:00 UTC: payment failure reminders (grace period)
  cron.schedule('0 11 * * *', async () => {
    await handlePaymentFailures();
  });

  // Daily at 06:00 UTC: payout scheduling
  cron.schedule('0 6 * * *', async () => {
    await runPayoutScheduler();
  });

  console.log('✅ Subscription scheduler started (6 jobs)');
}

module.exports = {
  startScheduler,
  expireSubscriptions,
  cancelExpiredSubscriptions,
  sendExpirationReminders,
  sendFlutterwaveRenewalReminders,
  handlePaymentFailures,
  runExpiryCheck,
};
