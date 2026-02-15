-- Migration Epic 2/3+: Bonus credits system
-- Date: 2026-02-13
-- Description:
--   1) Create bonus_credits table (per user, with expiration)
--   2) Link content_unlocks to bonus credits when unlock source = bonus
--   3) Backfill immediate bonus for active subscriptions whose plan trigger is immediate

-- ============================================================================
-- 1) Bonus credits table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bonus_credits (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id      UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,

  bonus_type           VARCHAR(20) NOT NULL
    CHECK (bonus_type IN ('text', 'audio', 'flex')),

  quantity_total       INTEGER NOT NULL CHECK (quantity_total > 0),
  quantity_used        INTEGER NOT NULL DEFAULT 0 CHECK (quantity_used >= 0),

  -- Why the credit exists
  source               VARCHAR(40) NOT NULL
    CHECK (source IN (
      'plan_immediate',
      'quota_reached',
      'family_quota_reached',
      'admin_grant',
      'manual_adjustment'
    )),

  granted_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at           TIMESTAMPTZ NOT NULL,
  consumed_at          TIMESTAMPTZ,

  metadata             JSONB NOT NULL DEFAULT '{}',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT bonus_credits_used_lte_total CHECK (quantity_used <= quantity_total),
  CONSTRAINT bonus_credits_expiry_after_grant CHECK (expires_at > granted_at)
);

CREATE INDEX IF NOT EXISTS idx_bonus_credits_user ON public.bonus_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_bonus_credits_subscription ON public.bonus_credits(subscription_id);
CREATE INDEX IF NOT EXISTS idx_bonus_credits_user_expiry ON public.bonus_credits(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_bonus_credits_source ON public.bonus_credits(source);

COMMENT ON TABLE public.bonus_credits IS 'User bonus credits with expiration (12-month lifecycle by default)';
COMMENT ON COLUMN public.bonus_credits.quantity_total IS 'Total credits granted in this bucket';
COMMENT ON COLUMN public.bonus_credits.quantity_used IS 'Credits consumed from this bucket';
COMMENT ON COLUMN public.bonus_credits.source IS 'Origin of the bonus grant';

-- ============================================================================
-- 2) Link unlocks to bonus credits (if migration 022 exists)
-- ============================================================================

ALTER TABLE public.content_unlocks
  ADD COLUMN IF NOT EXISTS bonus_credit_id UUID REFERENCES public.bonus_credits(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_content_unlocks_bonus_credit_id ON public.content_unlocks(bonus_credit_id);

-- If unlock source is bonus, enforce link presence
ALTER TABLE public.content_unlocks
  DROP CONSTRAINT IF EXISTS content_unlocks_bonus_source_requires_credit;

ALTER TABLE public.content_unlocks
  ADD CONSTRAINT content_unlocks_bonus_source_requires_credit
  CHECK (source <> 'bonus' OR bonus_credit_id IS NOT NULL);

-- ============================================================================
-- 3) Updated_at trigger
-- ============================================================================

DROP TRIGGER IF EXISTS update_bonus_credits_updated_at ON public.bonus_credits;
CREATE TRIGGER update_bonus_credits_updated_at
BEFORE UPDATE ON public.bonus_credits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 4) RLS policies
-- ============================================================================

ALTER TABLE public.bonus_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own bonus credits" ON public.bonus_credits;
CREATE POLICY "Users can view own bonus credits"
ON public.bonus_credits FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage bonus credits" ON public.bonus_credits;
CREATE POLICY "Service role can manage bonus credits"
ON public.bonus_credits FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- 5) Helper function: available bonus balance
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_available_bonus_credits(p_user_id UUID)
RETURNS TABLE (
  bonus_type VARCHAR(20),
  available_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    bc.bonus_type,
    SUM((bc.quantity_total - bc.quantity_used))::BIGINT AS available_count
  FROM public.bonus_credits bc
  WHERE bc.user_id = p_user_id
    AND bc.expires_at > NOW()
    AND bc.quantity_used < bc.quantity_total
  GROUP BY bc.bonus_type;
$$;

-- ============================================================================
-- 6) Backfill: immediate bonuses for currently active subscriptions
--    Rule: grant only when plan bonus_trigger is immediate
--    Safe/idempotent via metadata marker
-- ============================================================================

INSERT INTO public.bonus_credits (
  user_id,
  subscription_id,
  bonus_type,
  quantity_total,
  quantity_used,
  source,
  granted_at,
  expires_at,
  metadata
)
SELECT
  s.user_id,
  s.id AS subscription_id,
  COALESCE(sp.bonus_type, 'flex') AS bonus_type,
  GREATEST(COALESCE(sp.bonus_quantity_per_user, 0), 1) AS quantity_total,
  0 AS quantity_used,
  'plan_immediate' AS source,
  NOW() AS granted_at,
  NOW() + MAKE_INTERVAL(days => COALESCE(sp.bonus_validity_days, 365)) AS expires_at,
  jsonb_build_object(
    'backfill', true,
    'migration', '023_add_bonus_credits',
    'plan_id', sp.id,
    'plan_slug', sp.slug
  ) AS metadata
FROM public.subscriptions s
JOIN public.subscription_plans sp ON sp.id = s.plan_id
WHERE s.status = 'ACTIVE'
  AND sp.bonus_trigger = 'immediate'
  AND COALESCE(sp.bonus_quantity_per_user, 0) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.bonus_credits bc
    WHERE bc.subscription_id = s.id
      AND bc.source = 'plan_immediate'
      AND (bc.metadata ->> 'migration') = '023_add_bonus_credits'
  );

-- ============================================================================
-- TEST
-- ============================================================================

-- SELECT * FROM public.bonus_credits LIMIT 20;
-- SELECT * FROM public.get_user_available_bonus_credits('<user-uuid>');
