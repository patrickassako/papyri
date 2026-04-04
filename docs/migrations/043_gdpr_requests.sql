-- Migration 043 — RGPD : traçabilité des demandes de suppression / export
-- Date: 2026-03-26

CREATE TABLE IF NOT EXISTS public.gdpr_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Type of request
  request_type    VARCHAR(20) NOT NULL CHECK (request_type IN ('deletion', 'export', 'rectification')),

  -- Status lifecycle: pending → processing → completed | rejected
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),

  -- User-supplied reason / message
  user_message    TEXT,

  -- Admin processing
  processed_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_at    TIMESTAMPTZ,
  admin_notes     TEXT,

  -- Regulatory deadline (RGPD: 30 days)
  deadline_at     TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),

  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for admin list queries
CREATE INDEX IF NOT EXISTS idx_gdpr_requests_status  ON public.gdpr_requests(status);
CREATE INDEX IF NOT EXISTS idx_gdpr_requests_user    ON public.gdpr_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_requests_created ON public.gdpr_requests(created_at DESC);

-- Prevent duplicate pending requests for the same user+type
CREATE UNIQUE INDEX IF NOT EXISTS idx_gdpr_requests_unique_pending
ON public.gdpr_requests(user_id, request_type)
WHERE status IN ('pending', 'processing');

-- RLS
ALTER TABLE public.gdpr_requests ENABLE ROW LEVEL SECURITY;

-- User can read their own requests
CREATE POLICY "gdpr_requests_user_select" ON public.gdpr_requests
  FOR SELECT USING (auth.uid() = user_id);

-- User can insert their own request
CREATE POLICY "gdpr_requests_user_insert" ON public.gdpr_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admin can read and update all requests (service role bypasses RLS)
COMMENT ON TABLE public.gdpr_requests IS 'Demandes RGPD (suppression, export, rectification) — traçabilité conformité';
