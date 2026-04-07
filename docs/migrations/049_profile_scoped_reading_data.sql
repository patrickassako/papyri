-- Migration 049: Profile-scoped reading data
-- Date: 2026-04-07
-- Description:
--   1) Add optional profile_id on reading/favorites annotations tables
--   2) Allow one reading state per profile instead of one per user only
--   3) Backfill existing family owner data to the main owner profile

-- ============================================================================
-- 1) Add profile_id columns
-- ============================================================================

ALTER TABLE public.reading_history
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.family_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.bookmarks
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.family_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.highlights
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.family_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.ebook_reading_list
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.family_profiles(id) ON DELETE CASCADE;

-- ============================================================================
-- 2) Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_reading_history_profile
  ON public.reading_history(profile_id, user_id, last_read_at DESC);

CREATE INDEX IF NOT EXISTS idx_bookmarks_profile_content
  ON public.bookmarks(profile_id, content_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_highlights_profile_content
  ON public.highlights(profile_id, content_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ebook_reading_list_profile
  ON public.ebook_reading_list(profile_id, added_at DESC);

-- ============================================================================
-- 3) Replace unique constraints to support multiple profiles per user
-- ============================================================================

DROP INDEX IF EXISTS idx_rh_user_content;

CREATE UNIQUE INDEX IF NOT EXISTS idx_rh_user_content_legacy
  ON public.reading_history(user_id, content_id)
  WHERE profile_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_rh_user_profile_content
  ON public.reading_history(user_id, profile_id, content_id)
  WHERE profile_id IS NOT NULL;

ALTER TABLE public.ebook_reading_list
  DROP CONSTRAINT IF EXISTS ebook_reading_list_user_id_content_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ebook_reading_list_user_content_legacy
  ON public.ebook_reading_list(user_id, content_id)
  WHERE profile_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ebook_reading_list_user_profile_content
  ON public.ebook_reading_list(user_id, profile_id, content_id)
  WHERE profile_id IS NOT NULL;

-- ============================================================================
-- 4) Backfill existing owner-family data to owner profile
-- ============================================================================

WITH owner_profiles AS (
  SELECT DISTINCT ON (fp.owner_user_id)
    fp.owner_user_id,
    fp.id AS profile_id
  FROM public.family_profiles fp
  JOIN public.subscriptions s ON s.id = fp.subscription_id
  WHERE fp.is_owner_profile = TRUE
    AND fp.deleted_at IS NULL
    AND s.status = 'ACTIVE'
    AND (
      COALESCE(s.plan_snapshot ->> 'slug', s.plan_type, '') = 'family'
    )
  ORDER BY fp.owner_user_id, fp.created_at DESC
)
UPDATE public.reading_history rh
SET profile_id = op.profile_id
FROM owner_profiles op
WHERE rh.profile_id IS NULL
  AND rh.user_id = op.owner_user_id;

WITH owner_profiles AS (
  SELECT DISTINCT ON (fp.owner_user_id)
    fp.owner_user_id,
    fp.id AS profile_id
  FROM public.family_profiles fp
  JOIN public.subscriptions s ON s.id = fp.subscription_id
  WHERE fp.is_owner_profile = TRUE
    AND fp.deleted_at IS NULL
    AND s.status = 'ACTIVE'
    AND (
      COALESCE(s.plan_snapshot ->> 'slug', s.plan_type, '') = 'family'
    )
  ORDER BY fp.owner_user_id, fp.created_at DESC
)
UPDATE public.bookmarks b
SET profile_id = op.profile_id
FROM owner_profiles op
WHERE b.profile_id IS NULL
  AND b.user_id = op.owner_user_id;

WITH owner_profiles AS (
  SELECT DISTINCT ON (fp.owner_user_id)
    fp.owner_user_id,
    fp.id AS profile_id
  FROM public.family_profiles fp
  JOIN public.subscriptions s ON s.id = fp.subscription_id
  WHERE fp.is_owner_profile = TRUE
    AND fp.deleted_at IS NULL
    AND s.status = 'ACTIVE'
    AND (
      COALESCE(s.plan_snapshot ->> 'slug', s.plan_type, '') = 'family'
    )
  ORDER BY fp.owner_user_id, fp.created_at DESC
)
UPDATE public.highlights h
SET profile_id = op.profile_id
FROM owner_profiles op
WHERE h.profile_id IS NULL
  AND h.user_id = op.owner_user_id;

WITH owner_profiles AS (
  SELECT DISTINCT ON (fp.owner_user_id)
    fp.owner_user_id,
    fp.id AS profile_id
  FROM public.family_profiles fp
  JOIN public.subscriptions s ON s.id = fp.subscription_id
  WHERE fp.is_owner_profile = TRUE
    AND fp.deleted_at IS NULL
    AND s.status = 'ACTIVE'
    AND (
      COALESCE(s.plan_snapshot ->> 'slug', s.plan_type, '') = 'family'
    )
  ORDER BY fp.owner_user_id, fp.created_at DESC
)
UPDATE public.ebook_reading_list erl
SET profile_id = op.profile_id
FROM owner_profiles op
WHERE erl.profile_id IS NULL
  AND erl.user_id = op.owner_user_id;

-- ============================================================================
-- 5) Notes
-- ============================================================================

-- profile_id remains nullable during transition:
-- - NULL = legacy single-profile user data
-- - NOT NULL = family profile scoped data

