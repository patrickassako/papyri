-- Migration 040 : Archivage des contenus
-- À exécuter dans Supabase SQL Editor

ALTER TABLE public.contents
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS archived_at  TIMESTAMPTZ;

-- Index pour filtrer rapidement les contenus non archivés
CREATE INDEX IF NOT EXISTS idx_contents_is_archived ON public.contents (is_archived);

-- Quand un contenu est archivé, le dépublier automatiquement
CREATE OR REPLACE FUNCTION public.handle_content_archive()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_archived = TRUE AND OLD.is_archived = FALSE THEN
    NEW.is_published  := FALSE;
    NEW.archived_at   := NOW();
  END IF;
  IF NEW.is_archived = FALSE AND OLD.is_archived = TRUE THEN
    NEW.archived_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_content_archive ON public.contents;
CREATE TRIGGER on_content_archive
  BEFORE UPDATE ON public.contents
  FOR EACH ROW EXECUTE FUNCTION public.handle_content_archive();
