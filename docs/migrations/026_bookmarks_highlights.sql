-- Migration 026: Bookmarks & Highlights tables
-- Outils de lecture Niveau 1: surlignages, notes, marque-pages

-- Table bookmarks
CREATE TABLE IF NOT EXISTS bookmarks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id  UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  position    JSONB NOT NULL,  -- {cfi, percent, chapter_label}
  label       VARCHAR(255),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_content ON bookmarks(user_id, content_id);

-- Table highlights
CREATE TABLE IF NOT EXISTS highlights (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id  UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  cfi_range   TEXT NOT NULL,
  position    JSONB NOT NULL,  -- {start_cfi, end_cfi, chapter}
  color       VARCHAR(20) DEFAULT 'yellow',
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_highlights_user_content ON highlights(user_id, content_id);

-- RLS
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE highlights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bookmarks_select" ON bookmarks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "bookmarks_insert" ON bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bookmarks_update" ON bookmarks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "bookmarks_delete" ON bookmarks FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "highlights_select" ON highlights FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "highlights_insert" ON highlights FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "highlights_update" ON highlights FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "highlights_delete" ON highlights FOR DELETE USING (auth.uid() = user_id);
