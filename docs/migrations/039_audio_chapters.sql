-- Migration 039 — Chapitres audio
-- Table pour stocker les chapitres individuels d'un livre audio

CREATE TABLE IF NOT EXISTS audio_chapters (
  id               uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id       uuid        NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  title            text        NOT NULL,
  position         integer     NOT NULL DEFAULT 1,
  file_key         text        NOT NULL,
  duration_seconds integer,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audio_chapters_content_id ON audio_chapters(content_id);
CREATE INDEX IF NOT EXISTS idx_audio_chapters_position   ON audio_chapters(content_id, position);

-- RLS
ALTER TABLE audio_chapters ENABLE ROW LEVEL SECURITY;

-- Lecture publique pour les contenus publiés (via join contents)
CREATE POLICY "audio_chapters_read" ON audio_chapters
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM contents
      WHERE contents.id = audio_chapters.content_id
        AND contents.is_published = true
    )
  );

-- Admin peut tout faire
CREATE POLICY "audio_chapters_admin" ON audio_chapters
  FOR ALL USING (true);
