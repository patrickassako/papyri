-- Migration 002: Reading History Table
-- Description: Table pour stocker l'historique de lecture/ecoute des utilisateurs
-- Dependencies: Requires 'contents' table (Epic 3)
-- Created: 2026-02-07

-- Table reading_history
CREATE TABLE IF NOT EXISTS reading_history (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_id       UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  progress_percent DECIMAL(5,2) DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
    -- Progression de 0.00 a 100.00
  last_position    JSONB,
    -- Ebook: {"chapter": "ch3", "cfi": "/4/2/8"}
    -- Audio: {"position_seconds": 1234}
  total_time_seconds INTEGER DEFAULT 0,
    -- Temps total passe sur le contenu (secondes)
  is_completed     BOOLEAN DEFAULT FALSE,
    -- Marque comme complete quand progress_percent >= 100
  started_at       TIMESTAMPTZ DEFAULT NOW(),
    -- Date de premiere lecture
  last_read_at     TIMESTAMPTZ DEFAULT NOW(),
    -- Date de derniere lecture (MAJ a chaque PUT)
  completed_at     TIMESTAMPTZ,
    -- Date de completion (quand is_completed = TRUE)
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_rh_user_content ON reading_history(user_id, content_id);
  -- Contrainte: un seul historique par user par contenu
CREATE INDEX IF NOT EXISTS idx_rh_user ON reading_history(user_id);
  -- Pour requetes filtrees par user
CREATE INDEX IF NOT EXISTS idx_rh_last_read ON reading_history(last_read_at DESC);
  -- Pour tri chronologique (recent en premier)
CREATE INDEX IF NOT EXISTS idx_rh_is_completed ON reading_history(user_id, is_completed);
  -- Pour section "Reprendre" (is_completed = FALSE)

-- RLS Policies
ALTER TABLE reading_history ENABLE ROW LEVEL SECURITY;

-- Users can only read their own reading history
CREATE POLICY "Users read own reading history" ON reading_history
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own reading history
CREATE POLICY "Users insert own reading history" ON reading_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own reading history
CREATE POLICY "Users update own reading history" ON reading_history
  FOR UPDATE USING (auth.uid() = user_id);

-- Only admins can delete reading history
CREATE POLICY "Admins delete reading history" ON reading_history
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Comments
COMMENT ON TABLE reading_history IS 'Historique de lecture/ecoute des utilisateurs avec progression et position sauvegardee';
COMMENT ON COLUMN reading_history.progress_percent IS 'Progression de 0 a 100%';
COMMENT ON COLUMN reading_history.last_position IS 'Position sauvegardee (CFI pour ebook, seconds pour audio)';
COMMENT ON COLUMN reading_history.is_completed IS 'TRUE quand progress_percent >= 100';
COMMENT ON COLUMN reading_history.last_read_at IS 'Date de derniere consultation (tri chronologique)';
