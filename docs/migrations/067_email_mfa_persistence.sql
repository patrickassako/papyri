-- Migration 067: persist email MFA challenges in the database
--
-- The auth service stored MFA challenges + verified action tokens in an
-- in-memory Map. That breaks across server restarts (Render redeploys) and
-- across multiple instances (a challenge created on instance A is invisible
-- on instance B). Both are now persisted in Postgres.
--
-- These tables are only ever accessed by the backend with the service-role
-- key, so RLS is enabled with no public policy (deny-all to anon/auth).

BEGIN;

-- ── Email MFA challenges ────────────────────────────────────────
-- Covers two cases:
--   purpose IS NULL  → login MFA (the Supabase session is parked in
--                      `session` until the code is verified)
--   purpose = '...'  → sensitive-action challenge (e.g. profile PIN reset)
CREATE TABLE IF NOT EXISTS public.email_mfa_challenges (
  id          uuid        PRIMARY KEY,
  user_id     uuid        NOT NULL,
  purpose     text,
  email       text        NOT NULL,
  full_name   text,
  code_hash   text        NOT NULL,
  attempts    integer     NOT NULL DEFAULT 0,
  session     jsonb,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_mfa_challenges_user
  ON public.email_mfa_challenges (user_id);
CREATE INDEX IF NOT EXISTS idx_email_mfa_challenges_expires
  ON public.email_mfa_challenges (expires_at);

-- ── Verified action tokens ──────────────────────────────────────
-- Short-lived proof that a sensitive-action MFA challenge was passed.
CREATE TABLE IF NOT EXISTS public.email_action_tokens (
  token       uuid        PRIMARY KEY,
  user_id     uuid        NOT NULL,
  purpose     text        NOT NULL,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_action_tokens_expires
  ON public.email_action_tokens (expires_at);

-- Deny-all RLS: only the service-role key (used by the backend) bypasses it.
ALTER TABLE public.email_mfa_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_action_tokens  ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.email_mfa_challenges IS
  'Pending email MFA codes (login + sensitive actions). Backend-only access.';
COMMENT ON TABLE public.email_action_tokens IS
  'Short-lived tokens proving a sensitive-action MFA challenge was passed.';

COMMIT;
