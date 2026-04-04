-- Migration 035: Fix notification_preferences FK
-- La table notification_preferences référençait l'ancienne table "users" (pré-Supabase Auth).
-- On corrige pour référencer auth.users(id).

ALTER TABLE notification_preferences
  DROP CONSTRAINT IF EXISTS notification_preferences_user_id_fkey;

ALTER TABLE notification_preferences
  ADD CONSTRAINT notification_preferences_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
