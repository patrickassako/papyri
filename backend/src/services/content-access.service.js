const contentsService = require('./contents.service');
const subscriptionsService = require('./subscriptions.service');

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

async function resolveContentAccess({ userId, contentId }) {
  const content = await contentsService.getContentByIdForUnlock(contentId);
  const unlock = await contentsService.getUserContentUnlock(userId, contentId);
  const membership = await subscriptionsService.getActiveSubscriptionForMember(userId);
  const hasActiveSubscription = Boolean(membership?.subscription);

  const accessType = content.access_type || 'subscription';
  const pricing = computePricing(content, hasActiveSubscription);
  const isPurchasable = Boolean(content.is_purchasable) || ['paid', 'subscription_or_paid'].includes(accessType);

  const canReadByUnlock = Boolean(unlock);
  const canReadBySubscription = accessType === 'subscription' && hasActiveSubscription;
  const canRead = canReadByUnlock || canReadBySubscription;

  let denialCode = null;
  let denialMessage = null;

  if (!canRead) {
    if (accessType === 'subscription' && !hasActiveSubscription) {
      denialCode = 'NO_ACTIVE_SUBSCRIPTION';
      denialMessage = 'Un abonnement actif est requis pour lire ce contenu.';
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
