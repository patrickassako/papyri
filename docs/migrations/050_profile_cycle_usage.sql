-- 050_profile_cycle_usage.sql
-- Quotas et bonus par profil famille, par cycle de facturation.

CREATE TABLE IF NOT EXISTS public.profile_cycle_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES public.subscription_cycles(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.family_profiles(id) ON DELETE CASCADE,
  text_quota INTEGER NOT NULL DEFAULT 0 CHECK (text_quota >= 0),
  audio_quota INTEGER NOT NULL DEFAULT 0 CHECK (audio_quota >= 0),
  bonus_quota INTEGER NOT NULL DEFAULT 0 CHECK (bonus_quota >= 0),
  text_unlocked_count INTEGER NOT NULL DEFAULT 0 CHECK (text_unlocked_count >= 0),
  audio_unlocked_count INTEGER NOT NULL DEFAULT 0 CHECK (audio_unlocked_count >= 0),
  bonus_used_count INTEGER NOT NULL DEFAULT 0 CHECK (bonus_used_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT profile_cycle_usage_unique_cycle_profile UNIQUE (cycle_id, profile_id),
  CONSTRAINT profile_cycle_usage_consistency CHECK (
    text_unlocked_count <= text_quota + bonus_quota
    AND audio_unlocked_count <= audio_quota + bonus_quota
    AND bonus_used_count <= bonus_quota
  )
);

CREATE INDEX IF NOT EXISTS idx_profile_cycle_usage_cycle
  ON public.profile_cycle_usage(cycle_id);

CREATE INDEX IF NOT EXISTS idx_profile_cycle_usage_subscription
  ON public.profile_cycle_usage(subscription_id);

CREATE INDEX IF NOT EXISTS idx_profile_cycle_usage_profile
  ON public.profile_cycle_usage(profile_id);

COMMENT ON TABLE public.profile_cycle_usage IS 'Per-profile quota snapshot and usage counters for each billing cycle';

DROP TRIGGER IF EXISTS update_profile_cycle_usage_updated_at ON public.profile_cycle_usage;
CREATE TRIGGER update_profile_cycle_usage_updated_at
BEFORE UPDATE ON public.profile_cycle_usage
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.profile_cycle_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile cycle usage" ON public.profile_cycle_usage;
CREATE POLICY "Users can view own profile cycle usage"
ON public.profile_cycle_usage FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.family_profiles fp
    JOIN public.subscriptions s ON s.id = fp.subscription_id
    WHERE fp.id = profile_cycle_usage.profile_id
      AND s.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Service role can manage profile_cycle_usage" ON public.profile_cycle_usage;
CREATE POLICY "Service role can manage profile_cycle_usage"
ON public.profile_cycle_usage FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Backfill: creer une ligne d'usage par profil existant sur le cycle courant de son abonnement famille.
INSERT INTO public.profile_cycle_usage (
  cycle_id,
  subscription_id,
  profile_id,
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
  fp.id AS profile_id,
  GREATEST(
    COALESCE((s.plan_snapshot->>'textQuotaPerUser')::INTEGER, 0),
    COALESCE((s.plan_snapshot->>'text_quota_per_user')::INTEGER, 0)
  ) AS text_quota,
  GREATEST(
    COALESCE((s.plan_snapshot->>'audioQuotaPerUser')::INTEGER, 0),
    COALESCE((s.plan_snapshot->>'audio_quota_per_user')::INTEGER, 0)
  ) AS audio_quota,
  GREATEST(
    COALESCE((s.plan_snapshot->>'bonusQuantityPerUser')::INTEGER, 0),
    COALESCE((s.plan_snapshot->>'bonus_quantity_per_user')::INTEGER, 0)
  ) AS bonus_quota,
  0,
  0,
  0
FROM public.family_profiles fp
JOIN public.subscriptions s
  ON s.id = fp.subscription_id
JOIN public.subscription_cycles sc
  ON sc.subscription_id = s.id
  AND sc.status = 'active'
  AND NOW() >= sc.period_start
  AND NOW() < sc.period_end
WHERE fp.is_active = true
  AND fp.deleted_at IS NULL
  AND COALESCE(s.plan_type, '') = 'family'
ON CONFLICT (cycle_id, profile_id) DO NOTHING;
