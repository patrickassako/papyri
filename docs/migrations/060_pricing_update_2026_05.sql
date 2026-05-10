-- Migration 060: Pricing update (client request 2026-05)
-- Changes:
--   - family-monthly: extra_profile_price_cents 600 -> 1399 (+13.99 CAD/profile)
--   - family-monthly: extra_user_price_cents 600 -> 1399
--   - family-monthly metadata.price_per_profile_cents stays 1399 (unchanged)
--   - Annual plans: discount 20% -> 8%
--     * solo-annual:        9.99 * 12 * 0.92 = 110.29 CAD -> 11029
--     * solo-premium-annual: 14.99 * 12 * 0.92 = 165.49 CAD -> 16549
--     * family-annual:      41.97 * 12 * 0.92 = 463.31 CAD -> 46331
--     * family-annual extra (per profile/year): 13.99 * 12 * 0.92 = 154.45 -> 15445
-- All amounts in CAD cents.

BEGIN;

-- ============================================================================
-- Family monthly: bump extra profile price 6 CAD -> 13.99 CAD
-- ============================================================================
UPDATE public.subscription_plans
SET
  extra_profile_price_cents = 1399,
  extra_user_price_cents    = 1399,
  description               = 'Catalogue premium illimité pour 3 profils inclus, +13,99 CAD par profil supplémentaire (jusqu''à 10). 1 crédit par profil valable 12 mois avec accès à vie. 30% de réduction sur les livres payants.',
  updated_at                = NOW()
WHERE slug = 'family-monthly';

-- ============================================================================
-- Annual plans: 20% -> 8% discount
-- ============================================================================
UPDATE public.subscription_plans
SET
  base_price_cents = 11029,
  description      = 'Catalogue premium illimité, 1 crédit/an (accès tant qu''abonné), 30% de réduction. Économisez 8% sur l''année.',
  metadata         = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{annual_discount_percent}', '8'::jsonb, true),
  updated_at       = NOW()
WHERE slug = 'solo-annual';

UPDATE public.subscription_plans
SET
  base_price_cents = 16549,
  description      = 'Catalogue premium illimité, 1 crédit/an avec accès à vie au livre choisi, 30% de réduction. Économisez 8% sur l''année.',
  metadata         = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{annual_discount_percent}', '8'::jsonb, true),
  updated_at       = NOW()
WHERE slug = 'solo-premium-annual';

UPDATE public.subscription_plans
SET
  base_price_cents          = 46331,
  extra_profile_price_cents = 15445,
  extra_user_price_cents    = 15445,
  description               = '3 profils inclus + extension jusqu''à 10. 1 crédit par profil/an avec accès à vie. 30% de réduction. Économisez 8% sur l''année.',
  metadata                  = jsonb_set(
    jsonb_set(COALESCE(metadata, '{}'::jsonb), '{annual_discount_percent}', '8'::jsonb, true),
    '{price_per_profile_cents}', '15444'::jsonb, true
  ),
  updated_at                = NOW()
WHERE slug = 'family-annual';

COMMIT;
