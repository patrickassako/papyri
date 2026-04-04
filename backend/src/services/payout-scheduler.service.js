/**
 * Payout Scheduler Service
 * Gestion de la configuration de planification et création automatique des versements
 */

const { supabaseAdmin } = require('../config/database');
const { sendPayoutNotificationEmail } = require('./email.service');

// ── Helpers ────────────────────────────────────────────────────

function buildPayoutReference() {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `VRS-${stamp}-${Math.floor(Math.random() * 9000) + 1000}`;
}

/**
 * Calcule la prochaine date de versement selon la fréquence configurée.
 * @param {string} frequency  'weekly'|'biweekly'|'monthly'|'quarterly'
 * @param {number} dayOfMonth Jour du mois (1-28), utilisé pour monthly/quarterly
 * @param {number} dayOfWeek  Jour de la semaine (0=Dim…6=Sam), utilisé pour weekly/biweekly
 * @param {Date}   from       Date de référence (défaut: maintenant)
 */
function computeNextPayoutDate(frequency, dayOfMonth = 1, dayOfWeek = 1, from = new Date()) {
  const now = new Date(from);
  now.setHours(0, 0, 0, 0);

  if (frequency === 'monthly') {
    let candidate = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);
    if (candidate <= now) {
      candidate = new Date(now.getFullYear(), now.getMonth() + 1, dayOfMonth);
    }
    return candidate;
  }

  if (frequency === 'quarterly') {
    const quarterStarts = [0, 3, 6, 9]; // Jan, Avr, Jul, Oct
    const currentMonth = now.getMonth();
    let nextQMonth = quarterStarts.find(m => m > currentMonth);
    let year = now.getFullYear();
    if (nextQMonth === undefined) { nextQMonth = 0; year++; }
    let candidate = new Date(year, nextQMonth, dayOfMonth);
    if (candidate <= now) {
      const idx = quarterStarts.indexOf(nextQMonth);
      const nextIdx = (idx + 1) % 4;
      if (nextIdx === 0) year++;
      candidate = new Date(year, quarterStarts[nextIdx], dayOfMonth);
    }
    return candidate;
  }

  // weekly / biweekly
  const weeksAhead = frequency === 'biweekly' ? 2 : 1;
  const currentDay = now.getDay();
  let daysUntil = (dayOfWeek - currentDay + 7) % 7;
  if (daysUntil === 0) {
    daysUntil = 7 * weeksAhead;
  } else if (frequency === 'biweekly' && daysUntil < 7) {
    daysUntil += 7;
  }
  const candidate = new Date(now);
  candidate.setDate(now.getDate() + daysUntil);
  return candidate;
}

/**
 * Génère les N prochaines dates de versement pour affichage prévisuel.
 */
function computeUpcomingDates(frequency, dayOfMonth, dayOfWeek, count = 4) {
  const dates = [];
  let from = new Date();
  for (let i = 0; i < count; i++) {
    const next = computeNextPayoutDate(frequency, dayOfMonth, dayOfWeek, from);
    dates.push(next.toISOString().split('T')[0]);
    from = new Date(next);
    from.setDate(from.getDate() + 1); // avancer d'un jour pour la prochaine itération
  }
  return dates;
}

// ── Config ─────────────────────────────────────────────────────

async function getConfig() {
  const { data, error } = await supabaseAdmin
    .from('payout_schedule_config')
    .select('*')
    .order('created_at')
    .limit(1)
    .single();
  if (error) throw new Error('Configuration introuvable. Exécutez la migration 042.');
  return data;
}

async function updateConfig(adminUserId, fields) {
  const allowed = ['frequency', 'day_of_month', 'day_of_week', 'is_active', 'min_amount_cad', 'notes'];
  const update  = {};
  for (const k of allowed) if (fields[k] !== undefined) update[k] = fields[k];
  update.updated_by = adminUserId;
  update.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('payout_schedule_config')
    .update(update)
    .neq('id', '00000000-0000-0000-0000-000000000000')
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Versements planifiés ───────────────────────────────────────

async function getScheduledPayouts({ page = 1, limit = 50 } = {}) {
  const from_ = (page - 1) * limit;
  const to_   = page * limit - 1;
  const { data, error, count } = await supabaseAdmin
    .from('publisher_payouts')
    .select('*, publishers(id, company_name, payout_method)', { count: 'exact' })
    .eq('status', 'scheduled')
    .order('scheduled_for', { ascending: true })
    .range(from_, to_);
  if (error) throw error;
  return { payouts: data || [], total: count || 0 };
}

/**
 * Aperçu des montants en attente pour informer l'admin AVANT de planifier.
 */
async function getSchedulingPreview() {
  const config = await getConfig();
  const nextDate = computeNextPayoutDate(config.frequency, config.day_of_month, config.day_of_week);
  const upcomingDates = computeUpcomingDates(config.frequency, config.day_of_month, config.day_of_week);

  // Revenus non versés
  const { data: revenues } = await supabaseAdmin
    .from('publisher_revenue')
    .select('publisher_id, publisher_amount_cad, publishers(company_name)')
    .is('payout_id', null);

  const byPublisher = {};
  for (const r of revenues || []) {
    const pid = r.publisher_id;
    if (!byPublisher[pid]) byPublisher[pid] = { name: r.publishers?.company_name, amount: 0 };
    byPublisher[pid].amount += Number(r.publisher_amount_cad);
  }

  const eligible = [];
  const belowMin  = [];
  for (const [pid, info] of Object.entries(byPublisher)) {
    const rounded = +info.amount.toFixed(2);
    if (rounded >= config.min_amount_cad) {
      eligible.push({ publisherId: pid, name: info.name, amount: rounded });
    } else {
      belowMin.push({ publisherId: pid, name: info.name, amount: rounded });
    }
  }

  const totalAmount = eligible.reduce((s, e) => s + e.amount, 0);

  return {
    config,
    nextDate: nextDate.toISOString().split('T')[0],
    upcomingDates,
    eligible,
    belowMin,
    totalAmount: +totalAmount.toFixed(2),
  };
}

/**
 * Crée les versements planifiés pour tous les éditeurs éligibles.
 * Appelé par l'admin manuellement ou automatiquement par le cron.
 * @param {string|null} adminUserId
 */
async function createScheduledPayouts(adminUserId = null) {
  const config = await getConfig();
  if (!config.is_active) return { skipped: true, reason: 'Planification désactivée' };

  const nextDate    = computeNextPayoutDate(config.frequency, config.day_of_month, config.day_of_week);
  const scheduledFor = nextDate.toISOString().split('T')[0];

  // Revenus non versés groupés par éditeur
  const { data: revenues } = await supabaseAdmin
    .from('publisher_revenue')
    .select('publisher_id, publisher_amount_cad')
    .is('payout_id', null);

  const byPublisher = {};
  for (const r of revenues || []) {
    byPublisher[r.publisher_id] = (byPublisher[r.publisher_id] || 0) + Number(r.publisher_amount_cad);
  }

  const created    = [];
  const skippedLow = [];
  const errors     = [];

  for (const [publisherId, amount] of Object.entries(byPublisher)) {
    const rounded = +amount.toFixed(2);

    if (rounded < config.min_amount_cad) {
      skippedLow.push({ publisherId, amount: rounded });
      continue;
    }

    // Ne pas créer de doublon pour la même date
    const { data: existing } = await supabaseAdmin
      .from('publisher_payouts')
      .select('id')
      .eq('publisher_id', publisherId)
      .eq('status', 'scheduled')
      .eq('scheduled_for', scheduledFor)
      .maybeSingle();

    if (existing) continue;

    const { data: pub } = await supabaseAdmin
      .from('publishers')
      .select('payout_method, company_name')
      .eq('id', publisherId)
      .single();

    const { data: payout, error } = await supabaseAdmin
      .from('publisher_payouts')
      .insert({
        publisher_id:  publisherId,
        amount_cad:    rounded,
        status:        'scheduled',
        scheduled_for: scheduledFor,
        payout_method: pub?.payout_method || null,
        reference:     buildPayoutReference(),
        notes:         `Versement automatique — ${config.frequency} du ${scheduledFor}`,
        processed_by:  adminUserId,
      })
      .select()
      .single();

    if (error) {
      errors.push({ publisherId, error: error.message });
    } else {
      created.push({ publisher: pub?.company_name, amount: rounded, scheduledFor, id: payout.id });
    }
  }

  console.log(`[payout-scheduler] Planification: ${created.length} créés, ${skippedLow.length} sous le seuil, ${errors.length} erreurs`);
  return { created, skippedLow, errors, scheduledFor, totalAmount: created.reduce((s, p) => s + p.amount, 0) };
}

/**
 * Passe les versements planifiés dont la date est arrivée à l'état "pending".
 * Appelé quotidiennement par le cron.
 */
async function processScheduledPayouts() {
  const today = new Date().toISOString().split('T')[0];

  const { data: due, error } = await supabaseAdmin
    .from('publisher_payouts')
    .select('id, publisher_id, amount_cad, publishers(user_id, company_name)')
    .eq('status', 'scheduled')
    .lte('scheduled_for', today);

  if (error) throw error;
  if (!due?.length) return { processed: 0 };

  const ids = due.map(d => d.id);
  await supabaseAdmin
    .from('publisher_payouts')
    .update({ status: 'pending', updated_at: new Date().toISOString() })
    .in('id', ids);

  // Notifier les éditeurs (push + email)
  try {
    const notificationsService = require('./notifications.service');
    for (const payout of due) {
      const userId = payout.publishers?.user_id;
      if (!userId) continue;

      // Push notification
      notificationsService.sendToUsers([userId], {
        title: '💰 Versement en cours de traitement',
        body:  `Votre versement de ${Number(payout.amount_cad).toFixed(2)} CAD est maintenant en cours de traitement.`,
        data:  { type: 'payout', payoutId: payout.id, status: 'pending' },
        saveToDb: true,
      }).catch(() => {});

      // Email de confirmation versement
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('email, full_name')
        .eq('id', userId)
        .maybeSingle();
      if (profile?.email) {
        sendPayoutNotificationEmail(profile.email, profile.full_name || profile.email, {
          amountCad: payout.amount_cad,
          scheduledFor: payout.scheduled_for || new Date().toISOString(),
          payoutMethod: payout.payout_method,
        }).catch(() => {});
      }
    }
  } catch (_) {}

  console.log(`[payout-scheduler] ${ids.length} versements passés à "pending"`);
  return { processed: ids.length };
}

/**
 * Retourne le prochain versement planifié pour un éditeur donné.
 */
async function getPublisherNextScheduledPayout(publisherId) {
  const { data } = await supabaseAdmin
    .from('publisher_payouts')
    .select('id, amount_cad, scheduled_for, status')
    .eq('publisher_id', publisherId)
    .eq('status', 'scheduled')
    .order('scheduled_for', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data || null;
}

module.exports = {
  computeNextPayoutDate,
  computeUpcomingDates,
  getConfig,
  updateConfig,
  getScheduledPayouts,
  getSchedulingPreview,
  createScheduledPayouts,
  processScheduledPayouts,
  getPublisherNextScheduledPayout,
};
