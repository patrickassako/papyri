const contentsService = require('./contents.service');
const subscriptionsService = require('./subscriptions.service');
const familyProfilesService = require('./family-profiles.service');
const { supabaseAdmin } = require('../config/database');

/**
 * Vérifie si une zone est restreinte pour un contenu donné.
 * @param {string} contentId
 * @param {string|null} zone
 * @returns {Promise<{blocked: boolean, reason?: string}>}
 */
async function checkGeoRestriction(contentId, geo) {
  const { zone, country } = typeof geo === 'string' ? { zone: geo, country: null } : (geo || {});
  if (!zone && !country) return { blocked: false };

  try {
    const { data: config } = await supabaseAdmin
      .from('content_geo_restriction_config')
      .select('mode')
      .eq('content_id', contentId)
      .maybeSingle();

    if (!config) return { blocked: false };

    const { data: zones } = await supabaseAdmin
      .from('content_geo_restrictions')
      .select('zone, reason')
      .eq('content_id', contentId)
      .eq('is_active', true);

    const activeZones = zones || [];
    // Pays spécifique prioritaire sur continent
    const matched = activeZones.find((z) => z.zone === country) || activeZones.find((z) => z.zone === zone);

    if (config.mode === 'blacklist') {
      if (matched) {
        return { blocked: true, reason: matched.reason || 'Ce contenu n\'est pas disponible dans votre région.' };
      }
      return { blocked: false };
    }

    if (config.mode === 'whitelist') {
      if (!matched) {
        return { blocked: true, reason: 'Ce contenu est disponible uniquement dans certaines régions.' };
      }
      return { blocked: false };
    }

    return { blocked: false };
  } catch {
    return { blocked: false };
  }
}

/**
 * @param {object} content
 * @param {boolean} hasActiveSubscription
 * @param {number} [planDiscountPercent] — discount du plan abonnement (fallback si le contenu n'en a pas)
 */
function computePricing(content, hasActiveSubscription, planDiscountPercent = 0) {
  const basePriceCents = Number(content?.price_cents || 0);

  // Priorité : discount propre au contenu → discount du plan → 0
  const contentDiscount = Number(content?.subscription_discount_percent || 0);
  const effectiveDiscount = contentDiscount > 0 ? contentDiscount : Number(planDiscountPercent || 0);
  const discountPercent = hasActiveSubscription ? effectiveDiscount : 0;

  const finalPriceCents = Math.max(0, Math.round(basePriceCents * (100 - discountPercent) / 100));

  return {
    currency: content?.price_currency || 'EUR',
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

async function getSharedSeriesUnlock(userId, content, profileId = null) {
  const seriesId = extractGutenbergSeriesId(content);
  if (!seriesId) return null;

  // Shared access for multipart Gutenberg content:
  // if one part is unlocked, all parts from the same series are readable.
  // Do this in two steps to avoid fragile cross-table OR filters.
  let unlocksQuery = supabaseAdmin
    .from('content_unlocks')
    .select('id, content_id, source, unlocked_at, paid_amount_cents, currency, metadata, profile_id')
    .eq('user_id', userId)
    .order('unlocked_at', { ascending: false })
    .limit(200);

  unlocksQuery = profileId ? unlocksQuery.eq('profile_id', profileId) : unlocksQuery.is('profile_id', null);
  const { data: unlocks, error: unlocksError } = await unlocksQuery;

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

async function resolveContentAccess({ userId, contentId, zone = null, profileId = null }) {
  const content = await contentsService.getContentByIdForUnlock(contentId);
  const familyContext = await familyProfilesService.resolveProfileForUser(userId, profileId);
  const effectiveProfileId = familyContext?.isFamilyContext ? familyContext.profileId : null;

  // Vérification des restrictions géographiques (avant tout le reste)
  const geoCheck = await checkGeoRestriction(contentId, zone);
  if (geoCheck.blocked) {
    const pricing = computePricing(content, false);
    return {
      content,
      unlock: null,
      hasActiveSubscription: false,
      subscription: null,
      memberRole: null,
      access: {
        content_id: content.id,
        access_type: content.access_type || 'subscription',
        is_purchasable: false,
        has_active_subscription: false,
        unlocked: false,
        unlock: null,
        can_read: false,
        pricing,
        denial: {
          code: 'GEO_RESTRICTED',
          message: geoCheck.reason || 'Ce contenu n\'est pas disponible dans votre région.',
        },
      },
    };
  }

  const directUnlock = await contentsService.getUserContentUnlock(userId, contentId, effectiveProfileId);
  const sharedSeriesUnlock = directUnlock ? null : await getSharedSeriesUnlock(userId, content, effectiveProfileId);
  const unlock = directUnlock || sharedSeriesUnlock;
  const membership = await subscriptionsService.getActiveSubscriptionForMember(userId);
  const hasActiveSubscription = Boolean(membership?.subscription);

  // Récupère le discount payant du plan abonnement comme fallback
  const planSnapshot = membership?.subscription?.plan_snapshot || {};
  const planDiscountPercent = Number(
    planSnapshot.discountPercentPaidBooks || planSnapshot.paid_books_discount_percent || 0
  );

  const accessType = content.access_type || 'subscription';
  const pricing = computePricing(content, hasActiveSubscription, planDiscountPercent);
  const isPurchasable = Boolean(content.is_purchasable) || ['paid', 'subscription_or_paid'].includes(accessType);

  const canReadByUnlock = Boolean(unlock);
  // Access requires an explicit unlock (quota consumption). Merely having an active
  // subscription is not enough — the subscriber must go through the unlock flow first.
  const canRead = canReadByUnlock;

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
  checkGeoRestriction,
};
