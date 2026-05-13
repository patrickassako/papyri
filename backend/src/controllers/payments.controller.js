/**
 * Payments Controller — In-app Mobile Money charge + status polling.
 *
 * Routes:
 *   GET  /api/payments/mobile-money/options      → catalogue (no auth)
 *   POST /api/payments/mobile-money/charge       → initiate a MM charge
 *   GET  /api/payments/:reference/status         → poll the charge status
 */

const fwMm = require('../services/flutterwave-mobile-money.service');
const flutterwaveService = require('../services/flutterwave.service');
const paymentLocale = require('../services/payment-locale.service');
const subscriptionsService = require('../services/subscriptions.service');
const { supabaseAdmin } = require('../config/database');

// ── GET options ─────────────────────────────────────────────────────────
async function getMobileMoneyOptions(req, res) {
  return res.status(200).json({
    success: true,
    countries: fwMm.COUNTRIES.map(c => ({
      country: c.country,
      label: c.label,
      dialingCode: c.dialingCode,
      currency: c.currency,
      operators: c.operators,
      requiresNetwork: !!c.requiresNetwork,
      directCharge: c.directCharge !== false,
    })),
  });
}

// ── helper: compute the local amount + currency for an intent ───────────
async function resolveIntentAmount({ intent, planId, contentId, targetUsersLimit, userId, country }) {
  // 1. Find the CAD amount for this intent.
  let cadAmount;
  let metadata;
  let subscriptionId = null;
  let planSlug = null;
  let planName = null;

  if (intent === 'subscription') {
    if (!planId) throw new Error('planId requis pour intent=subscription');
    const { data: plan, error } = await supabaseAdmin
      .from('subscription_plans')
      .select('id, slug, display_name, name, base_price_cents')
      .eq('id', planId)
      .single();
    if (error || !plan) throw new Error('Plan introuvable');
    cadAmount = Number(plan.base_price_cents || 0) / 100;
    planSlug = plan.slug;
    planName = plan.display_name || plan.name;
    metadata = { payment_type: 'subscription_initial', plan_code: plan.slug };
  } else if (intent === 'content_unlock') {
    if (!contentId) throw new Error('contentId requis pour intent=content_unlock');
    const { data: content, error } = await supabaseAdmin
      .from('contents')
      .select('id, title, price_cents')
      .eq('id', contentId)
      .single();
    if (error || !content) throw new Error('Contenu introuvable');
    cadAmount = Number(content.price_cents || 0) / 100;
    if (!(cadAmount > 0)) throw new Error('Ce contenu ne peut pas être acheté.');
    metadata = {
      payment_type: 'content_unlock',
      content_id: content.id,
      base_price_cents: content.price_cents,
      final_price_cents: content.price_cents,
    };
  } else if (intent === 'extra_seat') {
    if (!targetUsersLimit) throw new Error('targetUsersLimit requis pour intent=extra_seat');
    // Pull the user's active subscription to compute the extra-seat price.
    const { data: sub } = await supabaseAdmin
      .from('subscriptions')
      .select('id, plan_id, users_limit, subscription_plans!inner(base_price_cents, extra_user_price_cents)')
      .eq('user_id', userId)
      .in('status', ['ACTIVE', 'TRIAL'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sub) throw new Error('Aucun abonnement actif');
    const extraPerSeatCents = Number(sub.subscription_plans?.extra_user_price_cents || 0);
    const seatsToAdd = Math.max(0, Number(targetUsersLimit) - Number(sub.users_limit || 0));
    if (seatsToAdd <= 0) throw new Error('Aucun siège supplémentaire à ajouter');
    cadAmount = (extraPerSeatCents * seatsToAdd) / 100;
    subscriptionId = sub.id;
    metadata = {
      payment_type: 'extra_seat',
      target_users_limit: targetUsersLimit,
      subscription_id: sub.id,
    };
  } else {
    throw new Error(`intent inconnu: ${intent}`);
  }

  // 2. Convert CAD → local currency using the FX table.
  const localized = await paymentLocale.localizePayment({ cadAmount, country });
  if (localized.source !== 'localized') {
    throw new Error(`Pays ${country} non supporté pour Mobile Money via Flutterwave`);
  }

  return {
    cadAmount,
    localAmount: localized.amount,
    currency: localized.currency,
    fxRate: localized.fxRate,
    metadata: { ...metadata, base_cad_amount: cadAmount, fx_rate: localized.fxRate, country },
    subscriptionId,
    planSlug,
    planName,
  };
}

// ── POST charge ─────────────────────────────────────────────────────────
async function chargeMobileMoney(req, res) {
  try {
    const userId = req.user.id;
    const { intent, country, operator, phone, fullname,
      planId, contentId, targetUsersLimit, promoCode } = req.body || {};

    if (!intent) return res.status(400).json({ success: false, error: 'intent requis' });
    if (!country) return res.status(400).json({ success: false, error: 'country requis' });
    if (!phone)   return res.status(400).json({ success: false, error: 'phone requis' });
    if (!fullname) return res.status(400).json({ success: false, error: 'fullname requis' });

    const cfg = fwMm.getCountryConfig(country);
    if (!cfg) return res.status(400).json({ success: false, error: `Pays non supporté: ${country}` });
    if (cfg.requiresNetwork && !operator) {
      return res.status(400).json({ success: false, error: 'Opérateur requis pour ce pays' });
    }

    // Resolve the intent → amount + metadata
    const intentInfo = await resolveIntentAmount({
      intent, planId, contentId, targetUsersLimit, userId, country,
    });

    // Build the tx_ref
    const prefixMap = { subscription: 'SUBMM', content_unlock: 'CNTMM', extra_seat: 'SEATMM' };
    const txRef = `${prefixMap[intent] || 'PAYMM'}-${Date.now()}-${userId.substring(0, 8)}`;

    // For subscription, we create the subscription row (INACTIVE) so we can
    // attach the payment to it and flip it to ACTIVE after success.
    let subscription = null;
    if (intent === 'subscription') {
      try {
        subscription = await subscriptionsService.createSubscription({
          userId,
          planId,
          usersLimit: req.body?.usersLimit || undefined,
          provider: 'flutterwave',
        });
      } catch (e) {
        if (e.message === 'ACTIVE_SUBSCRIPTION_EXISTS') {
          return res.status(409).json({ success: false, error: 'Vous avez déjà un abonnement actif.' });
        }
        throw e;
      }
      // Refresh cadAmount from the canonical subscription.amount (handles family seats).
      intentInfo.cadAmount = Number(subscription.amount);
      const reLocalized = await paymentLocale.localizePayment({ cadAmount: intentInfo.cadAmount, country });
      if (reLocalized.source === 'localized') {
        intentInfo.localAmount = reLocalized.amount;
        intentInfo.currency = reLocalized.currency;
        intentInfo.fxRate = reLocalized.fxRate;
      }
      intentInfo.metadata.subscription_id = subscription.id;
      intentInfo.subscriptionId = subscription.id;
    }

    // Insert payment row (pending). Amount stored in CAD (our base).
    const { data: paymentRow, error: payErr } = await supabaseAdmin
      .from('payments')
      .insert({
        user_id: userId,
        subscription_id: intentInfo.subscriptionId,
        amount: intentInfo.cadAmount,
        currency: 'CAD',
        status: 'pending',
        provider: 'flutterwave',
        provider_payment_id: txRef,
        payment_method: 'mobile_money',
        metadata: { ...intentInfo.metadata, tx_ref: txRef, operator: operator || null },
      })
      .select()
      .single();
    if (payErr) {
      console.error('[mm.charge] payment insert error', payErr);
      return res.status(500).json({ success: false, error: 'Impossible de créer le paiement' });
    }

    // ── Two paths depending on whether Flutterwave exposes Direct Charge ──
    if (cfg.directCharge === false) {
      // Standard hosted checkout (Cameroun). We still want the user to stay
      // in-app so we return a paymentLink the client opens in a WebView.
      let hosted;
      try {
        hosted = await flutterwaveService.initiateCheckout({
          amount: intentInfo.cadAmount, // initiateCheckout localizes from CAD
          currency: 'CAD',
          email: req.user.email,
          name: fullname,
          userId,
          country,
          txPrefix: 'MMHOST',
          redirectPath: '/subscription/callback',
          title: intent === 'content_unlock' ? 'Papyri — Déblocage' : 'Papyri — Abonnement',
          description: intent === 'content_unlock' ? 'Déblocage contenu' : 'Abonnement Papyri',
          meta: { user_id: userId, intent, hosted_in_app: true, ...intentInfo.metadata },
        });
        // Re-key the payment row to the new tx_ref (initiateCheckout generated its own).
        await supabaseAdmin
          .from('payments')
          .update({
            provider_payment_id: hosted.reference,
            metadata: { ...paymentRow.metadata, tx_ref: hosted.reference, hosted: true },
          })
          .eq('id', paymentRow.id);
      } catch (err) {
        await supabaseAdmin
          .from('payments')
          .update({ status: 'failed', failure_reason: err.message })
          .eq('id', paymentRow.id);
        return res.status(400).json({ success: false, error: err.message });
      }
      return res.status(200).json({
        success: true,
        mode: 'hosted',
        reference: hosted.reference,
        paymentLink: hosted.link,
        amount: hosted.amount,
        currency: hosted.currency,
        cadAmount: intentInfo.cadAmount,
      });
    }

    // Direct Charge path
    let charge;
    try {
      charge = await fwMm.initiateCharge({
        country,
        operator,
        phone,
        fullname,
        email: req.user.email,
        amount: intentInfo.localAmount,
        currency: intentInfo.currency,
        txRef,
        meta: { user_id: userId, intent, ...intentInfo.metadata },
      });
    } catch (err) {
      await supabaseAdmin
        .from('payments')
        .update({ status: 'failed', failure_reason: err.message })
        .eq('id', paymentRow.id);
      return res.status(400).json({ success: false, error: err.message });
    }

    return res.status(200).json({
      success: true,
      reference: charge.reference,
      status: charge.status,
      mode: charge.mode,
      redirectUrl: charge.redirectUrl,
      ussdCode: charge.ussdCode,
      instructions: charge.instructions,
      amount: intentInfo.localAmount,
      currency: intentInfo.currency,
      cadAmount: intentInfo.cadAmount,
      fxRate: intentInfo.fxRate,
    });
  } catch (err) {
    console.error('[mm.charge] error', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ── GET status ──────────────────────────────────────────────────────────
async function getPaymentStatus(req, res) {
  try {
    const userId = req.user.id;
    const { reference } = req.params;
    if (!reference) return res.status(400).json({ success: false, error: 'reference requise' });

    // Fetch payment row, ownership check
    const { data: payment, error } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('provider_payment_id', reference)
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !payment) {
      return res.status(404).json({ success: false, error: 'Paiement introuvable' });
    }

    // Short-circuit if already finalised
    if (payment.status === 'succeeded') {
      return res.status(200).json({
        success: true, status: 'success', reference,
        type: payment.metadata?.payment_type || null,
        contentId: payment.metadata?.content_id || null,
      });
    }
    if (payment.status === 'failed') {
      return res.status(200).json({ success: true, status: 'failed', reference, message: payment.failure_reason || null });
    }

    // Poll Flutterwave
    const verification = await fwMm.verifyByReference(reference);

    if (verification.status === 'successful') {
      // Mark payment succeeded
      await subscriptionsService.updatePaymentStatus(payment.id, 'succeeded');

      // Apply business logic depending on intent
      const paymentType = payment.metadata?.payment_type;
      if (paymentType === 'subscription_initial' || paymentType === 'subscription_renewal') {
        if (payment.subscription_id) {
          await subscriptionsService.applySuccessfulSubscriptionPayment(payment.subscription_id);
        }
      } else if (paymentType === 'extra_seat') {
        const targetUsersLimit = Number(payment.metadata?.target_users_limit || 0);
        if (payment.subscription_id && targetUsersLimit > 0) {
          await subscriptionsService.applyExtraSeat(payment.subscription_id, targetUsersLimit);
        }
      } else if (paymentType === 'content_unlock') {
        const contentId = payment.metadata?.content_id;
        const profileId = payment.metadata?.profile_id || null;
        if (contentId) {
          let q = supabaseAdmin.from('content_unlocks').select('id').eq('user_id', userId).eq('content_id', contentId);
          q = profileId ? q.eq('profile_id', profileId) : q.is('profile_id', null);
          const { data: existing } = await q.maybeSingle();
          if (!existing) {
            await supabaseAdmin.from('content_unlocks').insert({
              user_id: userId,
              profile_id: profileId,
              content_id: contentId,
              source: 'paid',
              payment_id: payment.id,
              base_price_cents: Number(payment.metadata?.base_price_cents || 0),
              paid_amount_cents: Number(payment.metadata?.final_price_cents || Math.round(Number(payment.amount || 0) * 100)),
              currency: 'CAD',
              metadata: { provider: 'flutterwave', tx_ref: reference, in_app: true },
            });
          }
        }
      }

      return res.status(200).json({
        success: true,
        status: 'success',
        reference,
        type: paymentType || null,
        contentId: payment.metadata?.content_id || null,
        subscriptionId: payment.subscription_id,
      });
    }

    if (verification.status === 'failed') {
      await subscriptionsService.updatePaymentStatus(payment.id, 'failed', 'Mobile Money charge failed');
      return res.status(200).json({ success: true, status: 'failed', reference });
    }

    // Still pending
    return res.status(200).json({ success: true, status: 'pending', reference });
  } catch (err) {
    console.error('[mm.status] error', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ── POST /api/payments/:reference/cancel ─────────────────────────────────
async function cancelPayment(req, res) {
  try {
    const userId = req.user.id;
    const { reference } = req.params;
    if (!reference) return res.status(400).json({ success: false, error: 'reference requise' });

    const { data: payment, error } = await supabaseAdmin
      .from('payments')
      .select('id, status')
      .eq('provider_payment_id', reference)
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !payment) return res.status(404).json({ success: false, error: 'Paiement introuvable' });

    if (payment.status !== 'pending') {
      // Already finalised — nothing to cancel.
      return res.status(200).json({ success: true, status: payment.status, alreadyFinal: true });
    }

    await supabaseAdmin
      .from('payments')
      .update({ status: 'failed', failure_reason: 'user_cancelled' })
      .eq('id', payment.id)
      .eq('status', 'pending'); // atomic guard against webhook race
    return res.status(200).json({ success: true, status: 'cancelled' });
  } catch (err) {
    console.error('[mm.cancel] error', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  getMobileMoneyOptions,
  chargeMobileMoney,
  getPaymentStatus,
  cancelPayment,
};
