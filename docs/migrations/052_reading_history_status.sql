-- Migration 052: Add status column to reading_history
-- Date: 2026-04-30
-- Description: Adds explicit status field for reading progress tracking
--   'in_progress' = currently reading
--   'completed'   = finished (progress_percent >= 100)
-- This enables correct stats: livres lus, terminés, temps total

ALTER TABLE public.reading_history
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'in_progress'
  CHECK (status IN ('in_progress', 'completed', 'abandoned'));

-- Backfill from existing is_completed
UPDATE public.reading_history
  SET status = 'completed'
  WHERE is_completed = TRUE AND status IS NULL;

UPDATE public.reading_history
  SET status = 'in_progress'
  WHERE is_completed = FALSE AND status IS NULL;

-- Index for stats queries
CREATE INDEX IF NOT EXISTS idx_reading_history_status
  ON public.reading_history(user_id, status);
