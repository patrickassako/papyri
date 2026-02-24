-- Migration 028: Structured audiobook chapters
-- Date: 2026-02-16
-- Purpose:
--   - Store real audiobook chapter structure in DB
--   - Allow one parent audiobook with multiple chapter entries
--   - Optional link to chapter-specific content rows

CREATE TABLE IF NOT EXISTS public.audiobook_chapters (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_content_id  UUID NOT NULL REFERENCES public.contents(id) ON DELETE CASCADE,
  chapter_number     INTEGER NOT NULL CHECK (chapter_number > 0),
  title              VARCHAR(500) NOT NULL,
  start_seconds      INTEGER DEFAULT 0 CHECK (start_seconds >= 0),
  end_seconds        INTEGER CHECK (end_seconds IS NULL OR end_seconds >= 0),
  duration_seconds   INTEGER CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  chapter_content_id UUID REFERENCES public.contents(id) ON DELETE SET NULL,
  chapter_file_key   VARCHAR(500),
  chapter_format     VARCHAR(10) CHECK (chapter_format IN ('mp3', 'm4a')),
  metadata           JSONB NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT audiobook_chapters_unique_parent_number UNIQUE (parent_content_id, chapter_number)
);

CREATE INDEX IF NOT EXISTS idx_audiobook_chapters_parent
  ON public.audiobook_chapters(parent_content_id, chapter_number);

CREATE INDEX IF NOT EXISTS idx_audiobook_chapters_content
  ON public.audiobook_chapters(chapter_content_id);

CREATE INDEX IF NOT EXISTS idx_audiobook_chapters_title
  ON public.audiobook_chapters(title);

DROP TRIGGER IF EXISTS update_audiobook_chapters_updated_at ON public.audiobook_chapters;
CREATE TRIGGER update_audiobook_chapters_updated_at
BEFORE UPDATE ON public.audiobook_chapters
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.audiobook_chapters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view audiobook chapters for published parent" ON public.audiobook_chapters;
CREATE POLICY "Public can view audiobook chapters for published parent"
ON public.audiobook_chapters FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.contents c
    WHERE c.id = audiobook_chapters.parent_content_id
      AND c.is_published = true
      AND c.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS "Admins can manage audiobook chapters" ON public.audiobook_chapters;
CREATE POLICY "Admins can manage audiobook chapters"
ON public.audiobook_chapters FOR ALL
USING (auth.jwt() ->> 'role' = 'admin');

DROP POLICY IF EXISTS "Service role can manage audiobook chapters" ON public.audiobook_chapters;
CREATE POLICY "Service role can manage audiobook chapters"
ON public.audiobook_chapters FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

