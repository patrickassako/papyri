-- Migration Epic 3/2+: Paid content & unlock tracking
-- Date: 2026-02-13
-- Description:
--   1) Extend contents table to support paid/hybrid access
--   2) Create content_unlocks table to track unlocked contents per user

-- ============================================================================
-- 1) Extend contents table for monetization rules
-- ============================================================================

ALTER TABLE public.contents
  ADD COLUMN IF NOT EXISTS access_type VARCHAR(30) NOT NULL DEFAULT 'subscription',
  ADD COLUMN IF NOT EXISTS is_purchasable BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS price_cents INTEGER,
  ADD COLUMN IF NOT EXISTS price_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS subscription_discount_percent INTEGER NOT NULL DEFAULT 30;

ALTER TABLE public.contents
  DROP CONSTRAINT IF EXISTS contents_access_type_check;

ALTER TABLE public.contents
  ADD CONSTRAINT contents_access_type_check
  CHECK (access_type IN ('subscription', 'paid', 'subscription_or_paid'));

ALTER TABLE public.contents
  DROP CONSTRAINT IF EXISTS contents_price_cents_non_negative;

ALTER TABLE public.contents
  ADD CONSTRAINT contents_price_cents_non_negative
  CHECK (price_cents IS NULL OR price_cents >= 0);

ALTER TABLE public.contents
  DROP CONSTRAINT IF EXISTS contents_price_currency_len_check;

ALTER TABLE public.contents
  ADD CONSTRAINT contents_price_currency_len_check
  CHECK (char_length(price_currency) = 3);

ALTER TABLE public.contents
  DROP CONSTRAINT IF EXISTS contents_subscription_discount_percent_check;

ALTER TABLE public.contents
  ADD CONSTRAINT contents_subscription_discount_percent_check
  CHECK (subscription_discount_percent BETWEEN 0 AND 100);

-- Ensure paid/hybrid content has purchase configuration
ALTER TABLE public.contents
  DROP CONSTRAINT IF EXISTS contents_paid_requires_price_check;

ALTER TABLE public.contents
  ADD CONSTRAINT contents_paid_requires_price_check
  CHECK (
    access_type = 'subscription'
    OR (
      is_purchasable = TRUE
      AND price_cents IS NOT NULL
      AND price_cents > 0
    )
  );

CREATE INDEX IF NOT EXISTS idx_contents_access_type ON public.contents(access_type);
CREATE INDEX IF NOT EXISTS idx_contents_is_purchasable ON public.contents(is_purchasable);
CREATE INDEX IF NOT EXISTS idx_contents_price_cents ON public.contents(price_cents);

COMMENT ON COLUMN public.contents.access_type IS 'subscription | paid | subscription_or_paid';
COMMENT ON COLUMN public.contents.is_purchasable IS 'true if users can unlock via one-time payment';
COMMENT ON COLUMN public.contents.price_cents IS 'Base one-time price in cents before discount';
COMMENT ON COLUMN public.contents.subscription_discount_percent IS 'Discount applied for users with active subscription';

-- Backfill safety for existing catalogue
UPDATE public.contents
SET access_type = 'subscription',
    is_purchasable = FALSE,
    price_cents = NULL
WHERE access_type IS NULL
   OR access_type NOT IN ('subscription', 'paid', 'subscription_or_paid');

-- ============================================================================
-- 2) Content unlock history
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.content_unlocks (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id                UUID NOT NULL REFERENCES public.contents(id) ON DELETE CASCADE,

  -- Unlock source
  source                    VARCHAR(20) NOT NULL
    CHECK (source IN ('quota', 'bonus', 'paid', 'admin_grant')),

  -- Payment details (when source = paid)
  base_price_cents          INTEGER,
  paid_amount_cents         INTEGER,
  currency                  VARCHAR(3) DEFAULT 'USD',
  discount_applied_percent  INTEGER DEFAULT 0,
  payment_id                UUID REFERENCES public.payments(id) ON DELETE SET NULL,

  -- Traceability
  unlocked_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata                  JSONB NOT NULL DEFAULT '{}',

  -- Constraints
  CONSTRAINT content_unlocks_unique_user_content UNIQUE (user_id, content_id),
  CONSTRAINT content_unlocks_base_price_non_negative CHECK (base_price_cents IS NULL OR base_price_cents >= 0),
  CONSTRAINT content_unlocks_paid_amount_non_negative CHECK (paid_amount_cents IS NULL OR paid_amount_cents >= 0),
  CONSTRAINT content_unlocks_currency_len CHECK (currency IS NULL OR char_length(currency) = 3),
  CONSTRAINT content_unlocks_discount_percent_check CHECK (discount_applied_percent BETWEEN 0 AND 100),
  CONSTRAINT content_unlocks_paid_source_has_amount CHECK (
    source <> 'paid' OR (paid_amount_cents IS NOT NULL AND paid_amount_cents >= 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_content_unlocks_user ON public.content_unlocks(user_id);
CREATE INDEX IF NOT EXISTS idx_content_unlocks_content ON public.content_unlocks(content_id);
CREATE INDEX IF NOT EXISTS idx_content_unlocks_source ON public.content_unlocks(source);
CREATE INDEX IF NOT EXISTS idx_content_unlocks_unlocked_at ON public.content_unlocks(unlocked_at DESC);

COMMENT ON TABLE public.content_unlocks IS 'Tracks how and when a user unlocked a content';
COMMENT ON COLUMN public.content_unlocks.source IS 'quota | bonus | paid | admin_grant';

-- ============================================================================
-- 3) RLS policies
-- ============================================================================

ALTER TABLE public.content_unlocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own content unlocks" ON public.content_unlocks;
CREATE POLICY "Users can view own content unlocks"
ON public.content_unlocks FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage content unlocks" ON public.content_unlocks;
CREATE POLICY "Service role can manage content unlocks"
ON public.content_unlocks FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- 4) Helper function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.user_has_unlocked_content(p_user_id UUID, p_content_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.content_unlocks cu
    WHERE cu.user_id = p_user_id
      AND cu.content_id = p_content_id
  );
$$;

-- ============================================================================
-- TEST
-- ============================================================================

-- SELECT id, title, access_type, is_purchasable, price_cents FROM public.contents LIMIT 20;
-- SELECT * FROM public.content_unlocks LIMIT 20;
