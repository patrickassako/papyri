-- Migration 029: Fix reading_history FK constraint
-- Problem: reading_history.user_id references legacy "users" table instead of auth.users
-- The Supabase Auth users don't exist in the legacy "users" table,
-- causing all progress saves to fail with FK violation (23503)
-- Solution: Drop the FK constraint. Data integrity is maintained by:
--   1. Backend verifyJWT middleware (only authenticated users can save)
--   2. Supabase RLS policies (auth.uid() = user_id)
-- Created: 2026-02-16

-- Drop the FK constraint on reading_history.user_id -> users(id)
ALTER TABLE reading_history DROP CONSTRAINT IF EXISTS reading_history_user_id_fkey;

-- Also fix highlights and bookmarks if they have the same issue
ALTER TABLE highlights DROP CONSTRAINT IF EXISTS highlights_user_id_fkey;
ALTER TABLE bookmarks DROP CONSTRAINT IF EXISTS bookmarks_user_id_fkey;
