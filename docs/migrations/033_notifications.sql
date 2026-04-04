-- ============================================================
-- Migration 033 — Notifications push
-- Ajoute fcm_token à notification_preferences
-- Crée la table notifications (historique in-app)
-- ============================================================

-- ── Ajout colonne fcm_token ───────────────────────────────────
ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS fcm_token         text,
  ADD COLUMN IF NOT EXISTS fcm_token_updated_at timestamptz;

-- ── Table notifications (historique in-app) ───────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        text        NOT NULL,       -- new_content | expiration_reminder | payment_failed | subscription_update | system
  title       text        NOT NULL,
  body        text        NOT NULL,
  data        jsonb       DEFAULT '{}'::jsonb,
  is_read     boolean     NOT NULL DEFAULT false,
  sent_at     timestamptz NOT NULL DEFAULT now(),
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user     ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread   ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_type     ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_at  ON notifications(sent_at DESC);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_notifications"
  ON notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "service_role_notifications"
  ON notifications FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- RLS sur notification_preferences (si pas déjà présente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notification_preferences'
    AND policyname = 'service_role_notification_prefs'
  ) THEN
    CREATE POLICY "service_role_notification_prefs"
      ON notification_preferences FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notification_preferences'
    AND policyname = 'users_manage_own_notification_prefs'
  ) THEN
    CREATE POLICY "users_manage_own_notification_prefs"
      ON notification_preferences FOR ALL TO authenticated
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
