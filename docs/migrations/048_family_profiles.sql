-- Migration 048: Family profiles
-- Date: 2026-04-01
-- Description:
--   1) Introduce Netflix-style family profiles
--   2) Keep the existing subscription/payment model
--   3) Preserve business rules: 3 included profiles, up to 10 max
--   4) Backfill a main profile for existing family subscriptions

-- ============================================================================
-- 1) Extend subscriptions with profile-oriented limits
-- ============================================================================

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS included_profiles INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS profiles_limit INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS max_profiles INTEGER NOT NULL DEFAULT 10;

ALTER TABLE public.subscriptions
  ALTER COLUMN included_profiles SET DEFAULT 3,
  ALTER COLUMN profiles_limit SET DEFAULT 3,
  ALTER COLUMN max_profiles SET DEFAULT 10;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'subscriptions_profiles_limit_check'
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_profiles_limit_check
      CHECK (
        included_profiles >= 1
        AND profiles_limit >= 1
        AND max_profiles >= included_profiles
        AND profiles_limit <= max_profiles
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_subscriptions_profiles_limit
  ON public.subscriptions(profiles_limit);

-- ============================================================================
-- 2) Family profiles table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.family_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  avatar_key VARCHAR(50),
  is_owner_profile BOOLEAN NOT NULL DEFAULT FALSE,
  is_kid BOOLEAN NOT NULL DEFAULT FALSE,
  pin_hash TEXT,
  pin_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  position INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT family_profiles_position_check CHECK (position >= 0),
  CONSTRAINT family_profiles_pin_consistency_check CHECK (
    (pin_enabled = FALSE AND pin_hash IS NULL)
    OR (pin_enabled = TRUE AND pin_hash IS NOT NULL)
  )
);

COMMENT ON TABLE public.family_profiles IS 'Profiles attached to a family subscription';
COMMENT ON COLUMN public.family_profiles.owner_user_id IS 'Primary account owner who manages billing and profiles';
COMMENT ON COLUMN public.family_profiles.is_owner_profile IS 'Main profile created for the family account owner';

CREATE INDEX IF NOT EXISTS idx_family_profiles_subscription
  ON public.family_profiles(subscription_id, is_active);

CREATE INDEX IF NOT EXISTS idx_family_profiles_owner
  ON public.family_profiles(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_family_profiles_position
  ON public.family_profiles(subscription_id, position);

CREATE UNIQUE INDEX IF NOT EXISTS idx_family_profiles_owner_profile
  ON public.family_profiles(subscription_id)
  WHERE is_owner_profile = TRUE AND deleted_at IS NULL;

-- ============================================================================
-- 3) updated_at trigger
-- ============================================================================

DROP TRIGGER IF EXISTS update_family_profiles_updated_at ON public.family_profiles;
CREATE TRIGGER update_family_profiles_updated_at
BEFORE UPDATE ON public.family_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 4) RLS
-- ============================================================================

ALTER TABLE public.family_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view own family profiles" ON public.family_profiles;
CREATE POLICY "Owners can view own family profiles"
ON public.family_profiles FOR SELECT
USING (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "Service role can manage family profiles" ON public.family_profiles;
CREATE POLICY "Service role can manage family profiles"
ON public.family_profiles FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- 5) Backfill subscriptions profile limits for family plans
-- ============================================================================

UPDATE public.subscriptions s
SET
  included_profiles = 3,
  max_profiles = 10,
  profiles_limit = LEAST(10, GREATEST(3, COALESCE(s.users_limit, 3)))
FROM public.subscription_plans sp
WHERE s.plan_id = sp.id
  AND sp.slug = 'family';

UPDATE public.subscriptions s
SET
  included_profiles = 3,
  max_profiles = 10,
  profiles_limit = LEAST(10, GREATEST(3, COALESCE(s.users_limit, 3)))
WHERE COALESCE(s.plan_snapshot ->> 'slug', s.plan_type, '') = 'family';

-- ============================================================================
-- 6) Backfill one main profile for each family subscription
-- ============================================================================

INSERT INTO public.family_profiles (
  subscription_id,
  owner_user_id,
  name,
  is_owner_profile,
  is_kid,
  pin_hash,
  pin_enabled,
  is_active,
  position,
  created_at,
  updated_at
)
SELECT
  s.id,
  s.user_id,
  'Profil principal',
  TRUE,
  FALSE,
  NULL,
  FALSE,
  TRUE,
  0,
  NOW(),
  NOW()
FROM public.subscriptions s
LEFT JOIN public.subscription_plans sp
  ON sp.id = s.plan_id
WHERE (
    sp.slug = 'family'
    OR COALESCE(s.plan_snapshot ->> 'slug', s.plan_type, '') = 'family'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.family_profiles fp
    WHERE fp.subscription_id = s.id
      AND fp.is_owner_profile = TRUE
      AND fp.deleted_at IS NULL
  );

-- ============================================================================
-- 7) Verification queries
-- ============================================================================

-- SELECT id, user_id, included_profiles, profiles_limit, max_profiles
-- FROM public.subscriptions
-- WHERE COALESCE(plan_snapshot ->> 'slug', plan_type, '') = 'family'
-- LIMIT 20;

-- SELECT * FROM public.family_profiles LIMIT 20;

