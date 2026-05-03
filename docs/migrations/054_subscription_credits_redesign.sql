-- Migration: Refonte abonnements — suppression quotas, ajout crédits
-- Date: 2026-05-03
-- Description:
--   Catalogue premium illimité (plus de quota texte/audio).
--   Crédits remplacent les bonus, avec notion d'accès à vie ou lié à l'abo.
--   Plan famille : 3 profils inclus + 6 CAD/profil suppl. (jusqu'à 10).
--   Devise base CAD (affichage géolocalisé converti côté backend).
--   Annuel = -20% sur 12 × prix mensuel.

-- ============================================================================
-- 1) Nouvelles colonnes sur subscription_plans
-- ============================================================================

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS credits_per_cycle             INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credits_validity_days         INTEGER NOT NULL DEFAULT 365,
  ADD COLUMN IF NOT EXISTS credits_grant_lifetime_access BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS extra_profile_price_cents     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_profiles                  INTEGER;

ALTER TABLE public.subscription_plans
  DROP CONSTRAINT IF EXISTS subscription_plans_credits_per_cycle_check;
ALTER TABLE public.subscription_plans
  ADD CONSTRAINT subscription_plans_credits_per_cycle_check CHECK (credits_per_cycle >= 0);

ALTER TABLE public.subscription_plans
  DROP CONSTRAINT IF EXISTS subscription_plans_credits_validity_days_check;
ALTER TABLE public.subscription_plans
  ADD CONSTRAINT subscription_plans_credits_validity_days_check CHECK (credits_validity_days > 0);

ALTER TABLE public.subscription_plans
  DROP CONSTRAINT IF EXISTS subscription_plans_extra_profile_price_check;
ALTER TABLE public.subscription_plans
  ADD CONSTRAINT subscription_plans_extra_profile_price_check CHECK (extra_profile_price_cents >= 0);

ALTER TABLE public.subscription_plans
  DROP CONSTRAINT IF EXISTS subscription_plans_max_profiles_check;
ALTER TABLE public.subscription_plans
  ADD CONSTRAINT subscription_plans_max_profiles_check
  CHECK (max_profiles IS NULL OR max_profiles >= included_users);

COMMENT ON COLUMN public.subscription_plans.credits_per_cycle IS 'Crédits offerts par cycle, par siège (multiplié par users_limit pour famille).';
COMMENT ON COLUMN public.subscription_plans.credits_grant_lifetime_access IS 'TRUE = unlock via crédit donne accès permanent. FALSE = accès limité à la durée de l''abo.';
COMMENT ON COLUMN public.subscription_plans.extra_profile_price_cents IS 'Coût d''un profil supplémentaire au-delà de included_users.';
COMMENT ON COLUMN public.subscription_plans.max_profiles IS 'Nombre maximum de profils possibles (incluant les supplémentaires payants).';

-- ============================================================================
-- 2) Crédits : ajout flag lifetime
-- ============================================================================

ALTER TABLE public.bonus_credits
  ADD COLUMN IF NOT EXISTS grants_lifetime_access BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.bonus_credits.grants_lifetime_access IS 'Snapshot du flag plan au moment de l''attribution.';

-- ============================================================================
-- 3) content_unlocks : flag accès à vie (default TRUE pour les unlocks existants)
-- ============================================================================

ALTER TABLE public.content_unlocks
  ADD COLUMN IF NOT EXISTS lifetime_access BOOLEAN NOT NULL DEFAULT TRUE;

-- Pour les unlocks existants : tous deviennent lifetime (paid + bonus + admin_grant + quota antérieurs)
-- → Aucun changement de comportement pour les utilisateurs actuels.
UPDATE public.content_unlocks
SET lifetime_access = TRUE
WHERE lifetime_access IS NULL;

COMMENT ON COLUMN public.content_unlocks.lifetime_access IS 'TRUE = accès permanent. FALSE = accès uniquement tant qu''abonnement actif (crédit de plan basique).';

CREATE INDEX IF NOT EXISTS idx_content_unlocks_lifetime ON public.content_unlocks(user_id, content_id, lifetime_access);

-- ============================================================================
-- 4) Désactivation des anciens plans (les abonnements en cours restent)
-- ============================================================================

UPDATE public.subscription_plans
SET is_active = FALSE,
    updated_at = NOW(),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('deprecated_at', NOW())
WHERE slug IN (
  'monthly', 'yearly',
  'personal-slow', 'personal', 'family',
  'personal-slow-annual', 'personal-annual', 'family-annual'
);

-- ============================================================================
-- 5) Insertion des nouveaux plans CAD (3 mensuels + 3 annuels)
-- ============================================================================

-- Solo Mensuel : 9.99 CAD, 1 crédit lié à l'abo
INSERT INTO public.subscription_plans (
  slug, display_name, description, is_active,
  duration_days, base_price_cents, currency,
  included_users, extra_user_price_cents,
  text_quota_per_user, audio_quota_per_user,
  paid_books_discount_percent,
  bonus_trigger, bonus_type, bonus_quantity_per_user, bonus_validity_days,
  credits_per_cycle, credits_validity_days, credits_grant_lifetime_access,
  extra_profile_price_cents, max_profiles,
  metadata
) VALUES (
  'solo-monthly',
  'Solo',
  'Catalogue premium illimité, 1 crédit valable 12 mois (accès tant qu''abonné), 30% de réduction sur les livres payants.',
  TRUE,
  30, 999, 'CAD',
  1, 0,
  0, 0,
  30,
  'none', 'flex', 0, 365,
  1, 365, FALSE,
  0, 1,
  jsonb_build_object('billing_cycle', 'monthly', 'tier', 'solo')
) ON CONFLICT (slug) DO UPDATE SET
  is_active = TRUE,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  base_price_cents = EXCLUDED.base_price_cents,
  currency = EXCLUDED.currency,
  text_quota_per_user = 0,
  audio_quota_per_user = 0,
  paid_books_discount_percent = EXCLUDED.paid_books_discount_percent,
  credits_per_cycle = EXCLUDED.credits_per_cycle,
  credits_validity_days = EXCLUDED.credits_validity_days,
  credits_grant_lifetime_access = EXCLUDED.credits_grant_lifetime_access,
  extra_profile_price_cents = EXCLUDED.extra_profile_price_cents,
  max_profiles = EXCLUDED.max_profiles,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

-- Solo Premium Mensuel : 14.99 CAD, 1 crédit accès à vie
INSERT INTO public.subscription_plans (
  slug, display_name, description, is_active,
  duration_days, base_price_cents, currency,
  included_users, extra_user_price_cents,
  text_quota_per_user, audio_quota_per_user,
  paid_books_discount_percent,
  bonus_trigger, bonus_type, bonus_quantity_per_user, bonus_validity_days,
  credits_per_cycle, credits_validity_days, credits_grant_lifetime_access,
  extra_profile_price_cents, max_profiles,
  metadata
) VALUES (
  'solo-premium-monthly',
  'Solo Premium',
  'Catalogue premium illimité, 1 crédit valable 12 mois avec accès à vie au livre choisi, 30% de réduction sur les livres payants.',
  TRUE,
  30, 1499, 'CAD',
  1, 0,
  0, 0,
  30,
  'none', 'flex', 0, 365,
  1, 365, TRUE,
  0, 1,
  jsonb_build_object('billing_cycle', 'monthly', 'tier', 'solo-premium')
) ON CONFLICT (slug) DO UPDATE SET
  is_active = TRUE,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  base_price_cents = EXCLUDED.base_price_cents,
  currency = EXCLUDED.currency,
  text_quota_per_user = 0,
  audio_quota_per_user = 0,
  paid_books_discount_percent = EXCLUDED.paid_books_discount_percent,
  credits_per_cycle = EXCLUDED.credits_per_cycle,
  credits_validity_days = EXCLUDED.credits_validity_days,
  credits_grant_lifetime_access = EXCLUDED.credits_grant_lifetime_access,
  extra_profile_price_cents = EXCLUDED.extra_profile_price_cents,
  max_profiles = EXCLUDED.max_profiles,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

-- Famille Mensuel : 13.99 CAD x 3 profils inclus, +6 CAD/profil suppl., max 10, 1 crédit/profil à vie
-- base_price_cents = 1399 (prix par profil de base) — on facture profil-par-profil côté backend si users_limit > 1
-- En pratique : facture = base (incluant 3 profils) + (users_limit - 3) * 600
-- Stockage : base_price_cents = 1399 * 3 = 4197 (3 profils inclus dans le prix de base)
INSERT INTO public.subscription_plans (
  slug, display_name, description, is_active,
  duration_days, base_price_cents, currency,
  included_users, extra_user_price_cents,
  text_quota_per_user, audio_quota_per_user,
  paid_books_discount_percent,
  bonus_trigger, bonus_type, bonus_quantity_per_user, bonus_validity_days,
  credits_per_cycle, credits_validity_days, credits_grant_lifetime_access,
  extra_profile_price_cents, max_profiles,
  metadata
) VALUES (
  'family-monthly',
  'Famille',
  'Catalogue premium illimité pour 3 profils inclus, +6 CAD par profil supplémentaire (jusqu''à 10). 1 crédit par profil valable 12 mois avec accès à vie. 30% de réduction sur les livres payants.',
  TRUE,
  30, 4197, 'CAD',
  3, 600,
  0, 0,
  30,
  'none', 'flex', 0, 365,
  1, 365, TRUE,
  600, 10,
  jsonb_build_object('billing_cycle', 'monthly', 'tier', 'family', 'price_per_profile_cents', 1399)
) ON CONFLICT (slug) DO UPDATE SET
  is_active = TRUE,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  base_price_cents = EXCLUDED.base_price_cents,
  currency = EXCLUDED.currency,
  included_users = EXCLUDED.included_users,
  extra_user_price_cents = EXCLUDED.extra_user_price_cents,
  text_quota_per_user = 0,
  audio_quota_per_user = 0,
  paid_books_discount_percent = EXCLUDED.paid_books_discount_percent,
  credits_per_cycle = EXCLUDED.credits_per_cycle,
  credits_validity_days = EXCLUDED.credits_validity_days,
  credits_grant_lifetime_access = EXCLUDED.credits_grant_lifetime_access,
  extra_profile_price_cents = EXCLUDED.extra_profile_price_cents,
  max_profiles = EXCLUDED.max_profiles,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

-- ============================================================================
-- 6) Plans annuels (-20% sur 12 mois)
--    Solo Annuel : 9.99 × 12 × 0.8 = 95.90 CAD → 9590 cents
--    Solo Premium Annuel : 14.99 × 12 × 0.8 = 143.90 CAD → 14390 cents
--    Famille Annuel : 41.97 × 12 × 0.8 = 402.91 CAD → 40291 cents (extra profil annuel = 6×12×0.8 = 57.60 = 5760)
-- ============================================================================

INSERT INTO public.subscription_plans (
  slug, display_name, description, is_active,
  duration_days, base_price_cents, currency,
  included_users, extra_user_price_cents,
  text_quota_per_user, audio_quota_per_user,
  paid_books_discount_percent,
  bonus_trigger, bonus_type, bonus_quantity_per_user, bonus_validity_days,
  credits_per_cycle, credits_validity_days, credits_grant_lifetime_access,
  extra_profile_price_cents, max_profiles,
  metadata
) VALUES (
  'solo-annual',
  'Solo Annuel',
  'Catalogue premium illimité, 1 crédit/an (accès tant qu''abonné), 30% de réduction. Économisez 20% sur l''année.',
  TRUE,
  365, 9590, 'CAD',
  1, 0,
  0, 0,
  30,
  'none', 'flex', 0, 365,
  1, 365, FALSE,
  0, 1,
  jsonb_build_object('billing_cycle', 'annual', 'tier', 'solo', 'source_monthly_slug', 'solo-monthly', 'annual_discount_percent', 20)
) ON CONFLICT (slug) DO UPDATE SET
  is_active = TRUE, base_price_cents = EXCLUDED.base_price_cents, currency = EXCLUDED.currency,
  text_quota_per_user = 0, audio_quota_per_user = 0,
  credits_per_cycle = 1, credits_grant_lifetime_access = FALSE,
  metadata = EXCLUDED.metadata, updated_at = NOW();

INSERT INTO public.subscription_plans (
  slug, display_name, description, is_active,
  duration_days, base_price_cents, currency,
  included_users, extra_user_price_cents,
  text_quota_per_user, audio_quota_per_user,
  paid_books_discount_percent,
  bonus_trigger, bonus_type, bonus_quantity_per_user, bonus_validity_days,
  credits_per_cycle, credits_validity_days, credits_grant_lifetime_access,
  extra_profile_price_cents, max_profiles,
  metadata
) VALUES (
  'solo-premium-annual',
  'Solo Premium Annuel',
  'Catalogue premium illimité, 1 crédit/an avec accès à vie au livre choisi, 30% de réduction. Économisez 20% sur l''année.',
  TRUE,
  365, 14390, 'CAD',
  1, 0,
  0, 0,
  30,
  'none', 'flex', 0, 365,
  1, 365, TRUE,
  0, 1,
  jsonb_build_object('billing_cycle', 'annual', 'tier', 'solo-premium', 'source_monthly_slug', 'solo-premium-monthly', 'annual_discount_percent', 20)
) ON CONFLICT (slug) DO UPDATE SET
  is_active = TRUE, base_price_cents = EXCLUDED.base_price_cents, currency = EXCLUDED.currency,
  text_quota_per_user = 0, audio_quota_per_user = 0,
  credits_per_cycle = 1, credits_grant_lifetime_access = TRUE,
  metadata = EXCLUDED.metadata, updated_at = NOW();

INSERT INTO public.subscription_plans (
  slug, display_name, description, is_active,
  duration_days, base_price_cents, currency,
  included_users, extra_user_price_cents,
  text_quota_per_user, audio_quota_per_user,
  paid_books_discount_percent,
  bonus_trigger, bonus_type, bonus_quantity_per_user, bonus_validity_days,
  credits_per_cycle, credits_validity_days, credits_grant_lifetime_access,
  extra_profile_price_cents, max_profiles,
  metadata
) VALUES (
  'family-annual',
  'Famille Annuel',
  '3 profils inclus + extension jusqu''à 10. 1 crédit par profil/an avec accès à vie. 30% de réduction. Économisez 20% sur l''année.',
  TRUE,
  365, 40291, 'CAD',
  3, 5760,
  0, 0,
  30,
  'none', 'flex', 0, 365,
  1, 365, TRUE,
  5760, 10,
  jsonb_build_object('billing_cycle', 'annual', 'tier', 'family', 'source_monthly_slug', 'family-monthly', 'annual_discount_percent', 20, 'price_per_profile_cents', 13430)
) ON CONFLICT (slug) DO UPDATE SET
  is_active = TRUE, base_price_cents = EXCLUDED.base_price_cents, currency = EXCLUDED.currency,
  included_users = EXCLUDED.included_users, extra_user_price_cents = EXCLUDED.extra_user_price_cents,
  text_quota_per_user = 0, audio_quota_per_user = 0,
  credits_per_cycle = 1, credits_grant_lifetime_access = TRUE,
  extra_profile_price_cents = EXCLUDED.extra_profile_price_cents, max_profiles = EXCLUDED.max_profiles,
  metadata = EXCLUDED.metadata, updated_at = NOW();

-- ============================================================================
-- 7) Désactivation immédiate des quotas pour les abonnements en cours
--    On met à jour les snapshots pour neutraliser les quotas (illimité de fait).
-- ============================================================================

UPDATE public.subscriptions
SET plan_snapshot = COALESCE(plan_snapshot, '{}'::jsonb) || jsonb_build_object(
  'textQuotaPerUser', NULL,
  'audioQuotaPerUser', NULL,
  'unlimitedCatalog', TRUE
)
WHERE status = 'ACTIVE';

-- ============================================================================
-- 8) Tests
-- ============================================================================

SELECT slug, display_name, is_active, base_price_cents, currency, included_users,
       extra_profile_price_cents, max_profiles, credits_per_cycle, credits_grant_lifetime_access,
       duration_days
FROM public.subscription_plans
WHERE is_active = TRUE
ORDER BY duration_days, base_price_cents;
