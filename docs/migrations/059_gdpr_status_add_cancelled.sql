-- Migration 059: Allow 'cancelled' status on gdpr_requests
-- Date: 2026-05-09
-- Description:
--   When a user requests account deletion (RGPD), they should be able to
--   cancel it within the 30-day grace period. The original constraint only
--   allowed pending/processing/completed/rejected — we add 'cancelled'.

ALTER TABLE public.gdpr_requests
  DROP CONSTRAINT IF EXISTS gdpr_requests_status_check;

ALTER TABLE public.gdpr_requests
  ADD CONSTRAINT gdpr_requests_status_check
  CHECK (status IN ('pending', 'processing', 'completed', 'rejected', 'cancelled'));
