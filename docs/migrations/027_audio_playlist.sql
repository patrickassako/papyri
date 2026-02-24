-- Migration 027: Playlist audio personnelle (Epic 5)
-- Date: 2026-02-16
-- Description:
--   - Crée une playlist audio persistée par utilisateur
--   - Stocke l'ordre des contenus
--   - Empêche l'ajout de contenus non audio

CREATE TABLE IF NOT EXISTS public.audio_playlist_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id     UUID NOT NULL REFERENCES public.contents(id) ON DELETE CASCADE,
  position_index INTEGER NOT NULL DEFAULT 0 CHECK (position_index >= 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT audio_playlist_items_unique_user_content UNIQUE (user_id, content_id),
  CONSTRAINT audio_playlist_items_unique_user_position UNIQUE (user_id, position_index)
);

CREATE INDEX IF NOT EXISTS idx_audio_playlist_user_position
  ON public.audio_playlist_items(user_id, position_index);

CREATE INDEX IF NOT EXISTS idx_audio_playlist_content
  ON public.audio_playlist_items(content_id);

COMMENT ON TABLE public.audio_playlist_items IS 'Playlist audio ordonnee par utilisateur';

-- Validation: seuls les contenus audiobook sont autorisés
CREATE OR REPLACE FUNCTION public.validate_audio_playlist_item()
RETURNS TRIGGER AS $$
DECLARE
  v_content_type VARCHAR(20);
BEGIN
  SELECT c.content_type
  INTO v_content_type
  FROM public.contents c
  WHERE c.id = NEW.content_id
  LIMIT 1;

  IF v_content_type IS NULL THEN
    RAISE EXCEPTION 'CONTENT_NOT_FOUND';
  END IF;

  IF v_content_type <> 'audiobook' THEN
    RAISE EXCEPTION 'ONLY_AUDIOBOOK_ALLOWED';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_audio_playlist_item ON public.audio_playlist_items;
CREATE TRIGGER trg_validate_audio_playlist_item
BEFORE INSERT OR UPDATE OF content_id
ON public.audio_playlist_items
FOR EACH ROW
EXECUTE FUNCTION public.validate_audio_playlist_item();

DROP TRIGGER IF EXISTS update_audio_playlist_items_updated_at ON public.audio_playlist_items;
CREATE TRIGGER update_audio_playlist_items_updated_at
BEFORE UPDATE ON public.audio_playlist_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.audio_playlist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audio_playlist_select_own" ON public.audio_playlist_items;
CREATE POLICY "audio_playlist_select_own"
ON public.audio_playlist_items FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "audio_playlist_insert_own" ON public.audio_playlist_items;
CREATE POLICY "audio_playlist_insert_own"
ON public.audio_playlist_items FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "audio_playlist_update_own" ON public.audio_playlist_items;
CREATE POLICY "audio_playlist_update_own"
ON public.audio_playlist_items FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "audio_playlist_delete_own" ON public.audio_playlist_items;
CREATE POLICY "audio_playlist_delete_own"
ON public.audio_playlist_items FOR DELETE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "audio_playlist_service_role_all" ON public.audio_playlist_items;
CREATE POLICY "audio_playlist_service_role_all"
ON public.audio_playlist_items FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

