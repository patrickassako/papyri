/**
 * Promo Code Service
 * Validation, calcul de remise et enregistrement d'utilisation
 */

const { supabaseAdmin } = require('../config/database');

/**
 * Calcule la remise en centimes.
 * @param {number} originalCents - Montant original en centimes
 * @param {'percent'|'fixed'} discountType
 * @param {number} discountValue - % ou montant en EUR
 * @returns {{ discountCents: number, finalAmountCents: number }}
 */
function computeDiscount(originalCents, discountType, discountValue) {
  let discountCents;
  if (discountType === 'percent') {
    discountCents = Math.floor(originalCents * Number(discountValue) / 100);
  } else {
    // fixed: discountValue est en unités majeures (EUR), on convertit en centimes
    discountCents = Math.round(Number(discountValue) * 100);
  }
  // La remise ne peut pas dépasser le prix original
  discountCents = Math.min(discountCents, originalCents);
  const finalAmountCents = Math.max(0, originalCents - discountCents);
  return { discountCents, finalAmountCents };
}

/**
 * Valide un code promo et retourne les informations de remise.
 * Lève une erreur codée si invalide.
 *
 * @param {string} code - Le code saisi par l'utilisateur
 * @param {string} planSlug - Le slug du plan sélectionné
 * @param {string} userId - L'UUID de l'utilisateur
 * @param {number} originalAmountCents - Montant original en centimes
 * @returns {Promise<{
 *   promoId: string,
 *   code: string,
 *   discountType: string,
 *   discountValue: number,
 *   discountCents: number,
 *   finalAmountCents: number,
 *   originalAmountCents: number,
 * }>}
 */
async function validatePromoCode(code, planSlug, userId, originalAmountCents) {
  if (!code || typeof code !== 'string') throw new Error('CODE_REQUIRED');

  const normalizedCode = code.trim().toUpperCase();

  // 1. Récupérer le code (case-insensitive)
  const { data: promo, error } = await supabaseAdmin
    .from('promo_codes')
    .select('*')
    .ilike('code', normalizedCode)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  if (!promo) throw new Error('INVALID_CODE');

  // 2. Vérifier les dates
  const now = new Date();
  if (promo.valid_from && new Date(promo.valid_from) > now) {
    throw new Error('CODE_NOT_YET_VALID');
  }
  if (promo.valid_until && new Date(promo.valid_until) < now) {
    throw new Error('CODE_EXPIRED');
  }

  // 3. Vérifier le nombre max d'utilisations
  if (promo.max_uses !== null && promo.used_count >= promo.max_uses) {
    throw new Error('CODE_MAX_USES_REACHED');
  }

  // 4. Vérifier les plans applicables
  if (promo.applicable_plans && promo.applicable_plans.length > 0) {
    if (!promo.applicable_plans.includes(planSlug)) {
      throw new Error('CODE_NOT_APPLICABLE');
    }
  }

  // 5. Vérifier que l'utilisateur n'a pas déjà utilisé ce code
  const { data: existingUsage } = await supabaseAdmin
    .from('promo_code_usages')
    .select('id')
    .eq('promo_code_id', promo.id)
    .eq('user_id', userId)
    .maybeSingle();

  if (existingUsage) throw new Error('CODE_ALREADY_USED');

  // 6. Calculer la remise
  const { discountCents, finalAmountCents } = computeDiscount(
    originalAmountCents,
    promo.discount_type,
    promo.discount_value
  );

  return {
    promoId: promo.id,
    code: promo.code,
    discountType: promo.discount_type,
    discountValue: Number(promo.discount_value),
    discountCents,
    finalAmountCents,
    originalAmountCents,
  };
}

/**
 * Enregistre l'utilisation d'un code promo et incrémente used_count.
 * Non bloquant (ne lève pas en cas d'erreur de contrainte unique).
 *
 * @param {string} promoCodeId
 * @param {string} userId
 * @param {string|null} subscriptionId
 * @param {number} discountCents - Remise appliquée en centimes
 */
async function recordUsage(promoCodeId, userId, subscriptionId, discountCents) {
  const discountApplied = Number((discountCents / 100).toFixed(2));

  const { error: insertError } = await supabaseAdmin
    .from('promo_code_usages')
    .insert({
      promo_code_id: promoCodeId,
      user_id: userId,
      subscription_id: subscriptionId || null,
      discount_applied: discountApplied,
    });

  if (insertError && insertError.code !== '23505') {
    // 23505 = unique_violation (usage déjà enregistré = idempotent)
    console.error('❌ promo recordUsage insert error:', insertError.message);
    throw insertError;
  }

  // Incrémenter used_count de façon atomique
  const { error: rpcError } = await supabaseAdmin.rpc('increment_promo_used_count', {
    code_id: promoCodeId,
  });

  if (rpcError) {
    console.error('❌ promo increment_used_count error:', rpcError.message);
    // Non bloquant : l'usage est enregistré, le compteur sera corrigé
  }
}

/**
 * Traduit un code d'erreur technique en message lisible.
 */
function getPromoErrorMessage(errorCode) {
  const messages = {
    INVALID_CODE: 'Code promo invalide ou inactif.',
    CODE_NOT_YET_VALID: 'Ce code n\'est pas encore valable.',
    CODE_EXPIRED: 'Ce code promo a expiré.',
    CODE_MAX_USES_REACHED: 'Ce code promo n\'est plus disponible (quota atteint).',
    CODE_NOT_APPLICABLE: 'Ce code promo ne s\'applique pas à ce plan.',
    CODE_ALREADY_USED: 'Vous avez déjà utilisé ce code promo.',
    CODE_REQUIRED: 'Veuillez saisir un code promo.',
  };
  return messages[errorCode] || 'Code promo invalide.';
}

module.exports = {
  validatePromoCode,
  recordUsage,
  computeDiscount,
  getPromoErrorMessage,
};
