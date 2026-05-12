-- Migration 065: scheduled_notifications + analytics columns
--
-- Adds:
--   1. scheduled_notifications table for future-dated admin broadcasts.
--   2. clicked_at column on notifications (mobile pings when user taps the push).
--   3. delivery_status column on notifications (sent | delivered | failed | skipped).

BEGIN;

-- ── 1. scheduled_notifications ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.scheduled_notifications (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by      uuid          NOT NULL,   -- admin user_id who scheduled
  scheduled_for   timestamptz   NOT NULL,
  status          text          NOT NULL DEFAULT 'pending',
  -- pending | sent | failed | cancelled

  -- Targeting
  target          text          NOT NULL,
  -- all | user | active_subscribers | expired_subscribers | cancelled_subscribers |
  -- read_category | bought_paid | kid_profiles | adult_profiles
  target_criteria jsonb         NOT NULL DEFAULT '{}'::jsonb,
  -- examples: { userEmail: 'x@y.com' }, { categoryId: 'uuid' }

  -- Content (multilingue)
  title_fr        text          NOT NULL,
  body_fr         text          NOT NULL,
  title_en        text,
  body_en         text,
  type            text          NOT NULL DEFAULT 'system',
  data            jsonb         NOT NULL DEFAULT '{}'::jsonb,

  -- Bookkeeping
  send_email      boolean       NOT NULL DEFAULT false,
  sent_at         timestamptz,
  sent_count      integer       NOT NULL DEFAULT 0,
  error_message   text,
  created_at      timestamptz   NOT NULL DEFAULT NOW(),
  updated_at      timestamptz   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_notif_status_time
  ON public.scheduled_notifications (status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_notif_created_by
  ON public.scheduled_notifications (created_by);

COMMENT ON TABLE public.scheduled_notifications IS
  'Future-dated or immediate admin push broadcasts. Consumed by engagement-scheduler.';

-- ── 2. notifications analytics columns ──────────────────────────
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS clicked_at      timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT 'sent';
-- delivery_status values: sent | delivered | failed | skipped

-- 3. scheduled_notification_id back-reference (so we can compute open/click rate per broadcast)
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS scheduled_notification_id uuid REFERENCES public.scheduled_notifications(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_id
  ON public.notifications (scheduled_notification_id);
CREATE INDEX IF NOT EXISTS idx_notifications_clicked_at
  ON public.notifications (clicked_at) WHERE clicked_at IS NOT NULL;

COMMIT;
