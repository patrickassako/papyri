-- 051_profile_scoped_content_unlocks.sql
-- Scope les debloquages de contenus par profil famille.

ALTER TABLE public.content_unlocks
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.family_profiles(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_content_unlocks_profile_id
  ON public.content_unlocks(profile_id);

ALTER TABLE public.content_unlocks
  DROP CONSTRAINT IF EXISTS content_unlocks_unique_user_content;

CREATE UNIQUE INDEX IF NOT EXISTS idx_content_unlocks_unique_user_content_legacy
  ON public.content_unlocks(user_id, content_id)
  WHERE profile_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_content_unlocks_unique_user_profile_content
  ON public.content_unlocks(user_id, profile_id, content_id)
  WHERE profile_id IS NOT NULL;

WITH owner_profiles AS (
  SELECT fp.id AS profile_id, fp.owner_user_id
  FROM public.family_profiles fp
  JOIN public.subscriptions s ON s.id = fp.subscription_id
  WHERE fp.is_owner_profile = true
    AND fp.deleted_at IS NULL
    AND COALESCE(s.plan_snapshot ->> 'slug', s.plan_type, '') = 'family'
)
UPDATE public.content_unlocks cu
SET profile_id = op.profile_id
FROM owner_profiles op
WHERE cu.user_id = op.owner_user_id
  AND cu.profile_id IS NULL;
