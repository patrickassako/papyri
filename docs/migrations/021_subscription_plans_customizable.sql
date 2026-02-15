-- Migration Epic 2+: Plans d'abonnement personnalisables
-- Date: 2026-02-13
-- Description: Rend les plans configurables (nom, prix, quotas, bonus, users_limit)

-- ============================================================================
-- 1) Table des plans configurables
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                         VARCHAR(100) UNIQUE NOT NULL,
  display_name                 VARCHAR(255) NOT NULL,
  description                  TEXT,
  is_active                    BOOLEAN NOT NULL DEFAULT TRUE,

  duration_days                INTEGER NOT NULL DEFAULT 30 CHECK (duration_days > 0),
  base_price_cents             INTEGER NOT NULL CHECK (base_price_cents >= 0),
  currency                     VARCHAR(3) NOT NULL DEFAULT 'USD',

  included_users               INTEGER NOT NULL DEFAULT 1 CHECK (included_users > 0),
  extra_user_price_cents       INTEGER NOT NULL DEFAULT 0 CHECK (extra_user_price_cents >= 0),

  text_quota_per_user          INTEGER NOT NULL DEFAULT 0 CHECK (text_quota_per_user >= 0),
  audio_quota_per_user         INTEGER NOT NULL DEFAULT 0 CHECK (audio_quota_per_user >= 0),
  paid_books_discount_percent  INTEGER NOT NULL DEFAULT 0 CHECK (paid_books_discount_percent BETWEEN 0 AND 100),

  bonus_trigger                VARCHAR(30) NOT NULL DEFAULT 'none'
    CHECK (bonus_trigger IN ('none', 'immediate', 'quota_reached')),
  bonus_type                   VARCHAR(20) NOT NULL DEFAULT 'flex'
    CHECK (bonus_type IN ('text', 'audio', 'flex')),
  bonus_quantity_per_user      INTEGER NOT NULL DEFAULT 0 CHECK (bonus_quantity_per_user >= 0),
  bonus_validity_days          INTEGER NOT NULL DEFAULT 365 CHECK (bonus_validity_days > 0),

  metadata                     JSONB NOT NULL DEFAULT '{}',
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON public.subscription_plans(is_active);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_slug ON public.subscription_plans(slug);

-- ============================================================================
-- 2) Extension de subscriptions pour plan dynamique
-- ============================================================================

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.subscription_plans(id),
  ADD COLUMN IF NOT EXISTS users_limit INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS plan_snapshot JSONB NOT NULL DEFAULT '{}';

ALTER TABLE public.subscriptions
  ALTER COLUMN users_limit SET DEFAULT 1;

-- Legacy: retire la contrainte stricte monthly/yearly
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_plan_type_check;

ALTER TABLE public.subscriptions
  ALTER COLUMN plan_type DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON public.subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_users_limit ON public.subscriptions(users_limit);

-- ============================================================================
-- 3) Seeds de plans
-- ============================================================================

-- Plans legacy (inactifs) pour mapping historique éventuel
INSERT INTO public.subscription_plans (
  slug,
  display_name,
  description,
  is_active,
  duration_days,
  base_price_cents,
  currency,
  included_users,
  extra_user_price_cents,
  text_quota_per_user,
  audio_quota_per_user,
  paid_books_discount_percent,
  bonus_trigger,
  bonus_type,
  bonus_quantity_per_user,
  bonus_validity_days,
  metadata
) VALUES
(
  'monthly',
  'Monthly (Legacy)',
  'Plan historique migré',
  FALSE,
  30,
  500,
  'EUR',
  1,
  0,
  0,
  0,
  0,
  'none',
  'flex',
  0,
  365,
  '{"legacy": true}'::jsonb
),
(
  'yearly',
  'Yearly (Legacy)',
  'Plan historique migré',
  FALSE,
  365,
  5000,
  'EUR',
  1,
  0,
  0,
  0,
  0,
  'none',
  'flex',
  0,
  365,
  '{"legacy": true}'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

-- Plans produits actifs (demandés)
INSERT INTO public.subscription_plans (
  slug,
  display_name,
  description,
  is_active,
  duration_days,
  base_price_cents,
  currency,
  included_users,
  extra_user_price_cents,
  text_quota_per_user,
  audio_quota_per_user,
  paid_books_discount_percent,
  bonus_trigger,
  bonus_type,
  bonus_quantity_per_user,
  bonus_validity_days,
  metadata
) VALUES
(
  'personal-slow',
  'Personnel Slow',
  '400 livres texte, bonus audio immediat, reduction 30%',
  TRUE,
  30,
  450,
  'USD',
  1,
  0,
  400,
  1,
  30,
  'immediate',
  'audio',
  1,
  365,
  '{}'::jsonb
),
(
  'personal',
  'Personnel',
  '500 texte, 300 audio, bonus si quota atteint, reduction 30%',
  TRUE,
  30,
  990,
  'USD',
  1,
  0,
  500,
  300,
  30,
  'quota_reached',
  'flex',
  1,
  365,
  '{}'::jsonb
),
(
  'family',
  'Famille',
  '3 utilisateurs inclus, +6$ par utilisateur supplementaire, bonus par utilisateur, reduction 30%',
  TRUE,
  30,
  1999,
  'USD',
  3,
  600,
  500,
  300,
  30,
  'quota_reached',
  'flex',
  1,
  365,
  '{"bonus_for_each_user": true}'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

-- Backfill plan_id pour abonnements historiques
UPDATE public.subscriptions s
SET plan_id = p.id
FROM public.subscription_plans p
WHERE s.plan_id IS NULL
  AND s.plan_type IS NOT NULL
  AND p.slug = s.plan_type;

-- Snapshot minimal si vide
UPDATE public.subscriptions
SET plan_snapshot = jsonb_build_object(
  'slug', plan_type,
  'name', COALESCE(plan_type, 'legacy'),
  'durationDays', 30
)
WHERE (plan_snapshot IS NULL OR plan_snapshot = '{}'::jsonb);

-- ============================================================================
-- 4) Trigger updated_at pour subscription_plans
-- ============================================================================

DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON public.subscription_plans;
CREATE TRIGGER update_subscription_plans_updated_at
BEFORE UPDATE ON public.subscription_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- TEST
-- ============================================================================

SELECT slug, display_name, is_active, base_price_cents, included_users, extra_user_price_cents
FROM public.subscription_plans
ORDER BY created_at;
