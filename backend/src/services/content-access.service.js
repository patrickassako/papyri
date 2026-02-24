const contentsService = require('./contents.service');
const subscriptionsService = require('./subscriptions.service');
const { supabaseAdmin } = require('../config/database');

function computePricing(content, hasActiveSubscription) {
  const basePriceCents = Number(content?.price_cents || 0);
  const discountPercent = hasActiveSubscription ? Number(content?.subscription_discount_percent || 0) : 0;
  const finalPriceCents = Math.max(0, Math.round(basePriceCents * (100 - discountPercent) / 100));

  return {
    currency: content?.price_currency || 'USD',
    base_price_cents: basePriceCents,
    discount_percent: discountPercent,
    final_price_cents: finalPriceCents,
  };
}

function extractGutenbergSeriesId(content) {
  const title = String(content?.title || '');
  const fileKey = String(content?.file_key || '');

  const titleMatch = title.match(/project gutenberg\s*#(\d+)/i);
  if (titleMatch?.[1]) return titleMatch[1];

  const keyMatch = fileKey.match(/gutenberg-(\d+)-/i);
  if (keyMatch?.[1]) return keyMatch[1];

  return null;
}

async function getSharedSeriesUnlock(userId, content) {
  const seriesId = extractGutenbergSeriesId(content);
  if (!seriesId) return null;

  // Shared access for multipart Gutenberg content:
  // if one part is unlocked, all parts from the same series are readable.
  // Do this in two steps to avoid fragile cross-table OR filters.
  const { data: unlocks, error: unlocksError } = await supabaseAdmin
    .from('content_unlocks')
    .select('id, content_id, source, unlocked_at, paid_amount_cents, currency, metadata')
    .eq('user_id', userId)
    .order('unlocked_at', { ascending: false })
    .limit(200);

  if (unlocksError || !Array.isArray(unlocks) || unlocks.length === 0) return null;

  const unlockedContentIds = Array.from(new Set(unlocks.map((u) => u.content_id).filter(Boolean)));
  if (unlockedContentIds.length === 0) return null;

  const { data: unlockedContents, error: contentsError } = await supabaseAdmin
    .from('contents')
    .select('id, title, file_key')
    .in('id', unlockedContentIds);

  if (contentsError || !Array.isArray(unlockedContents) || unlockedContents.length === 0) return null;

  const matchedContentIds = new Set(
    unlockedContents
      .filter((row) => extractGutenbergSeriesId(row) === seriesId)
      .map((row) => row.id)
  );

  if (matchedContentIds.size === 0) return null;

  return unlocks.find((u) => matchedContentIds.has(u.content_id)) || null;
}

async function resolveContentAccess({ userId, contentId }) {
  const content = await contentsService.getContentByIdForUnlock(contentId);
  const directUnlock = await contentsService.getUserContentUnlock(userId, contentId);
  const sharedSeriesUnlock = directUnlock ? null : await getSharedSeriesUnlock(userId, content);
  const unlock = directUnlock || sharedSeriesUnlock;
  const membership = await subscriptionsService.getActiveSubscriptionForMember(userId);
  const hasActiveSubscription = Boolean(membership?.subscription);

  const accessType = content.access_type || 'subscription';
  const pricing = computePricing(content, hasActiveSubscription);
  const isPurchasable = Boolean(content.is_purchasable) || ['paid', 'subscription_or_paid'].includes(accessType);

  const canReadByUnlock = Boolean(unlock);
  // Access now always requires explicit unlock consumption (quota/bonus/paid),
  // even for active subscribers.
  const canReadBySubscription = false;
  const canRead = canReadByUnlock || canReadBySubscription;

  let denialCode = null;
  let denialMessage = null;

  if (!canRead) {
    if (accessType === 'subscription' && !hasActiveSubscription) {
      denialCode = 'NO_ACTIVE_SUBSCRIPTION';
      denialMessage = 'Un abonnement actif est requis pour lire ce contenu.';
    } else if (hasActiveSubscription && ['subscription', 'subscription_or_paid'].includes(accessType)) {
      denialCode = 'SUBSCRIPTION_UNLOCK_REQUIRED';
      denialMessage = 'Débloquez ce contenu pour consommer votre quota ou bonus.';
    } else if (isPurchasable) {
      denialCode = 'CONTENT_LOCKED_PAYMENT_REQUIRED';
      denialMessage = 'Ce contenu est verrouille. Debloquez-le avec paiement.';
    } else {
      denialCode = 'CONTENT_LOCKED';
      denialMessage = 'Ce contenu est verrouille.';
    }
  }

  return {
    content,
    unlock,
    hasActiveSubscription,
    subscription: membership?.subscription || null,
    memberRole: membership?.memberRole || null,
    access: {
      content_id: content.id,
      access_type: accessType,
      is_purchasable: isPurchasable,
      has_active_subscription: hasActiveSubscription,
      unlocked: Boolean(unlock),
      unlock,
      can_read: canRead,
      pricing,
      denial: canRead
        ? null
        : {
            code: denialCode,
            message: denialMessage,
          },
    },
  };
}

module.exports = {
  resolveContentAccess,
  computePricing,
};
