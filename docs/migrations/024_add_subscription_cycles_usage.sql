-- Migration Epic 2/3+: Subscription members, billing cycles, and per-cycle usage
-- Date: 2026-02-13
-- Description:
--   1) Add subscription_members for multi-user plans (family)
--   2) Add subscription_cycles for 30-day accounting windows
--   3) Add member_cycle_usage for per-user quotas and usage tracking
--   4) Backfill existing subscriptions safely

-- ============================================================================
-- 1) Members per subscription (owner + invited members)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.subscription_members (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id  UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role             VARCHAR(20) NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'member')),
  status           VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'invited', 'removed')),
  joined_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at       TIMESTAMPTZ,
  metadata         JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT subscription_members_unique_sub_user UNIQUE (subscription_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_subscription_members_subscription ON public.subscription_members(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_members_user ON public.subscription_members(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_members_status ON public.subscription_members(status);

COMMENT ON TABLE public.subscription_members IS 'Users attached to a subscription (owner + family members)';

-- ============================================================================
-- 2) Billing/accounting cycles per subscription
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.subscription_cycles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id   UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  period_start      TIMESTAMPTZ NOT NULL,
  period_end        TIMESTAMPTZ NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'closed', 'cancelled')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT subscription_cycles_unique_period UNIQUE (subscription_id, period_start, period_end),
  CONSTRAINT subscription_cycles_period_valid CHECK (period_end > period_start)
);

CREATE INDEX IF NOT EXISTS idx_subscription_cycles_subscription ON public.subscription_cycles(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_cycles_period ON public.subscription_cycles(subscription_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_subscription_cycles_status ON public.subscription_cycles(status);

COMMENT ON TABLE public.subscription_cycles IS 'Accounting cycles used to reset quotas and track usage';

-- ============================================================================
-- 3) Per-member usage inside a cycle
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.member_cycle_usage (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id             UUID NOT NULL REFERENCES public.subscription_cycles(id) ON DELETE CASCADE,
  subscription_id      UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Snapshot of quotas for this user in this cycle
  text_quota           INTEGER NOT NULL DEFAULT 0 CHECK (text_quota >= 0),
  audio_quota          INTEGER NOT NULL DEFAULT 0 CHECK (audio_quota >= 0),
  bonus_quota          INTEGER NOT NULL DEFAULT 0 CHECK (bonus_quota >= 0),

  -- Consumption counters
  text_unlocked_count  INTEGER NOT NULL DEFAULT 0 CHECK (text_unlocked_count >= 0),
  audio_unlocked_count INTEGER NOT NULL DEFAULT 0 CHECK (audio_unlocked_count >= 0),
  bonus_used_count     INTEGER NOT NULL DEFAULT 0 CHECK (bonus_used_count >= 0),

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT member_cycle_usage_unique_cycle_user UNIQUE (cycle_id, user_id),
  CONSTRAINT member_cycle_usage_consistency CHECK (
    text_unlocked_count <= text_quota + bonus_quota
    AND audio_unlocked_count <= audio_quota + bonus_quota
  )
);

CREATE INDEX IF NOT EXISTS idx_member_cycle_usage_cycle ON public.member_cycle_usage(cycle_id);
CREATE INDEX IF NOT EXISTS idx_member_cycle_usage_subscription ON public.member_cycle_usage(subscription_id);
CREATE INDEX IF NOT EXISTS idx_member_cycle_usage_user ON public.member_cycle_usage(user_id);

COMMENT ON TABLE public.member_cycle_usage IS 'Per-user quota snapshot and usage counters for each billing cycle';

-- ============================================================================
-- 4) updated_at triggers
-- ============================================================================

DROP TRIGGER IF EXISTS update_subscription_members_updated_at ON public.subscription_members;
CREATE TRIGGER update_subscription_members_updated_at
BEFORE UPDATE ON public.subscription_members
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscription_cycles_updated_at ON public.subscription_cycles;
CREATE TRIGGER update_subscription_cycles_updated_at
BEFORE UPDATE ON public.subscription_cycles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_member_cycle_usage_updated_at ON public.member_cycle_usage;
CREATE TRIGGER update_member_cycle_usage_updated_at
BEFORE UPDATE ON public.member_cycle_usage
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 5) RLS
-- ============================================================================

ALTER TABLE public.subscription_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_cycle_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own subscription members" ON public.subscription_members;
CREATE POLICY "Users can view own subscription members"
ON public.subscription_members FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own cycles through subscription" ON public.subscription_cycles;
CREATE POLICY "Users can view own cycles through subscription"
ON public.subscription_cycles FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.subscription_members sm
    WHERE sm.subscription_id = subscription_cycles.subscription_id
      AND sm.user_id = auth.uid()
      AND sm.status = 'active'
  )
);

DROP POLICY IF EXISTS "Users can view own member cycle usage" ON public.member_cycle_usage;
CREATE POLICY "Users can view own member cycle usage"
ON public.member_cycle_usage FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage subscription members" ON public.subscription_members;
CREATE POLICY "Service role can manage subscription members"
ON public.subscription_members FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Service role can manage subscription cycles" ON public.subscription_cycles;
CREATE POLICY "Service role can manage subscription cycles"
ON public.subscription_cycles FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Service role can manage member cycle usage" ON public.member_cycle_usage;
CREATE POLICY "Service role can manage member_cycle_usage"
ON public.member_cycle_usage FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- 6) Helper functions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_current_subscription_cycle(p_subscription_id UUID)
RETURNS TABLE (
  id UUID,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  status VARCHAR(20)
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT sc.id, sc.period_start, sc.period_end, sc.status
  FROM public.subscription_cycles sc
  WHERE sc.subscription_id = p_subscription_id
    AND NOW() >= sc.period_start
    AND NOW() < sc.period_end
  ORDER BY sc.period_start DESC
  LIMIT 1;
$$;

-- ============================================================================
-- 7) Backfill existing data (idempotent)
-- ============================================================================

-- 7.1 Add owner as subscription member for all subscriptions
INSERT INTO public.subscription_members (
  subscription_id,
  user_id,
  role,
  status,
  joined_at,
  metadata
)
SELECT
  s.id,
  s.user_id,
  'owner',
  CASE WHEN s.status IN ('ACTIVE', 'INACTIVE', 'CANCELLED', 'EXPIRED') THEN 'active' ELSE 'invited' END,
  COALESCE(s.current_period_start, s.created_at, NOW()),
  jsonb_build_object('backfill', true, 'migration', '024_add_subscription_cycles_usage')
FROM public.subscriptions s
WHERE NOT EXISTS (
  SELECT 1
  FROM public.subscription_members sm
  WHERE sm.subscription_id = s.id
    AND sm.user_id = s.user_id
);

-- 7.2 Create a cycle for subscriptions that already have a known period
INSERT INTO public.subscription_cycles (
  subscription_id,
  period_start,
  period_end,
  status
)
SELECT
  s.id,
  s.current_period_start,
  s.current_period_end,
  CASE
    WHEN s.status = 'CANCELLED' THEN 'cancelled'
    WHEN s.current_period_end < NOW() THEN 'closed'
    ELSE 'active'
  END AS status
FROM public.subscriptions s
WHERE s.current_period_start IS NOT NULL
  AND s.current_period_end IS NOT NULL
  AND s.current_period_end > s.current_period_start
  AND NOT EXISTS (
    SELECT 1
    FROM public.subscription_cycles sc
    WHERE sc.subscription_id = s.id
      AND sc.period_start = s.current_period_start
      AND sc.period_end = s.current_period_end
  );

-- 7.3 Initialize member usage rows from active members + plan snapshot quotas
INSERT INTO public.member_cycle_usage (
  cycle_id,
  subscription_id,
  user_id,
  text_quota,
  audio_quota,
  bonus_quota,
  text_unlocked_count,
  audio_unlocked_count,
  bonus_used_count
)
SELECT
  sc.id AS cycle_id,
  s.id AS subscription_id,
  sm.user_id,
  COALESCE((s.plan_snapshot ->> 'textQuotaPerUser')::INTEGER, 0) AS text_quota,
  COALESCE((s.plan_snapshot ->> 'audioQuotaPerUser')::INTEGER, 0) AS audio_quota,
  COALESCE((s.plan_snapshot ->> 'bonusQuantityPerUser')::INTEGER, 0) AS bonus_quota,
  0,
  0,
  0
FROM public.subscription_cycles sc
JOIN public.subscriptions s ON s.id = sc.subscription_id
JOIN public.subscription_members sm ON sm.subscription_id = s.id AND sm.status = 'active'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.member_cycle_usage mcu
  WHERE mcu.cycle_id = sc.id
    AND mcu.user_id = sm.user_id
);

-- ============================================================================
-- TEST
-- ============================================================================

-- SELECT * FROM public.subscription_members LIMIT 20;
-- SELECT * FROM public.subscription_cycles LIMIT 20;
-- SELECT * FROM public.member_cycle_usage LIMIT 20;
