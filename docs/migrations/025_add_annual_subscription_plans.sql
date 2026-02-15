-- Migration Epic Pricing: Add annual subscription plans
-- Date: 2026-02-13
-- Description:
--   1) Tag existing 30-day active plans as monthly in metadata
--   2) Create annual variants for active monthly plans
--   3) Keep migration idempotent (safe to run multiple times)

-- ============================================================================
-- 1) Ensure monthly metadata on existing active 30-day plans
-- ============================================================================

UPDATE public.subscription_plans
SET
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'billing_cycle', 'monthly',
    'billing_period_days', duration_days
  ),
  updated_at = NOW()
WHERE is_active = TRUE
  AND duration_days = 30
  AND COALESCE(metadata ->> 'legacy', 'false') <> 'true'
  AND COALESCE(metadata ->> 'billing_cycle', '') = '';

-- ============================================================================
-- 2) Create annual variants from monthly plans
--   - slug: "<monthly-slug>-annual"
--   - display_name: "<display_name> Annuel"
--   - duration_days: 365
--   - base_price_cents: 12 months with default 20% annual discount
-- ============================================================================

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
)
SELECT
  CONCAT(p.slug, '-annual') AS slug,
  CONCAT(p.display_name, ' Annuel') AS display_name,
  CONCAT(COALESCE(p.description, p.display_name), ' (facturation annuelle)') AS description,
  p.is_active,
  365 AS duration_days,
  ROUND(p.base_price_cents * 12 * 0.8)::INTEGER AS base_price_cents,
  p.currency,
  p.included_users,
  p.extra_user_price_cents,
  p.text_quota_per_user,
  p.audio_quota_per_user,
  p.paid_books_discount_percent,
  p.bonus_trigger,
  p.bonus_type,
  p.bonus_quantity_per_user,
  p.bonus_validity_days,
  COALESCE(p.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'billing_cycle', 'annual',
      'billing_period_days', 365,
      'annual_discount_percent', 20,
      'source_monthly_slug', p.slug
    ) AS metadata
FROM public.subscription_plans p
WHERE p.is_active = TRUE
  AND p.duration_days = 30
  AND COALESCE(p.metadata ->> 'legacy', 'false') <> 'true'
  AND NOT EXISTS (
    SELECT 1
    FROM public.subscription_plans existing
    WHERE existing.slug = CONCAT(p.slug, '-annual')
  );

-- ============================================================================
-- 3) Visibility check
-- ============================================================================

SELECT
  slug,
  display_name,
  duration_days,
  base_price_cents,
  metadata ->> 'billing_cycle' AS billing_cycle,
  metadata ->> 'source_monthly_slug' AS source_monthly_slug
FROM public.subscription_plans
WHERE is_active = TRUE
ORDER BY slug;
