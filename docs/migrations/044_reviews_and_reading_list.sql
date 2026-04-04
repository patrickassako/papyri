-- ============================================================
-- Migration 044 — Avis lecteurs + Liste de lecture ebooks
-- ============================================================

-- ── 1. Table content_reviews (avis/notes lecteurs) ───────────
CREATE TABLE IF NOT EXISTS content_reviews (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id  uuid        NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating      smallint    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body        text,
  is_visible  boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (content_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_content_reviews_content ON content_reviews(content_id);
CREATE INDEX IF NOT EXISTS idx_content_reviews_user    ON content_reviews(user_id);

ALTER TABLE content_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews_select"  ON content_reviews FOR SELECT USING (is_visible = true OR auth.uid() = user_id);
CREATE POLICY "reviews_insert"  ON content_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reviews_update"  ON content_reviews FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "reviews_delete"  ON content_reviews FOR DELETE USING (auth.uid() = user_id);

-- Vue résumé des notes par contenu
CREATE OR REPLACE VIEW content_review_stats AS
SELECT
  content_id,
  COUNT(*)                                         AS review_count,
  ROUND(AVG(rating), 1)                            AS average_rating,
  COUNT(*) FILTER (WHERE rating = 5)               AS count_5,
  COUNT(*) FILTER (WHERE rating = 4)               AS count_4,
  COUNT(*) FILTER (WHERE rating = 3)               AS count_3,
  COUNT(*) FILTER (WHERE rating = 2)               AS count_2,
  COUNT(*) FILTER (WHERE rating = 1)               AS count_1
FROM content_reviews
WHERE is_visible = true
GROUP BY content_id;

-- ── 2. Table ebook_reading_list ───────────────────────────────
CREATE TABLE IF NOT EXISTS ebook_reading_list (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id   uuid        NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  added_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, content_id)
);

CREATE INDEX IF NOT EXISTS idx_ebook_reading_list_user ON ebook_reading_list(user_id);

ALTER TABLE ebook_reading_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ebook_list_select" ON ebook_reading_list FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ebook_list_insert" ON ebook_reading_list FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ebook_list_delete" ON ebook_reading_list FOR DELETE USING (auth.uid() = user_id);
