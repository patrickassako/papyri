-- Migration 034: Device management + reading lock
-- Each user can register up to 3 devices.
-- Only one device can hold the reading lock at a time (exclusive session).

-- 1. Registered devices per user (max 3)
CREATE TABLE IF NOT EXISTS user_devices (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id    TEXT        NOT NULL,  -- client-generated UUID stored in localStorage/AsyncStorage
  device_name  TEXT        NOT NULL DEFAULT 'Appareil inconnu',
  device_type  TEXT        NOT NULL DEFAULT 'desktop' CHECK (device_type IN ('desktop', 'mobile', 'tablet')),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_devices_unique UNIQUE (user_id, device_id)
);

-- 2. Exclusive reading lock per user (one row per user max)
-- heartbeat_at must be refreshed every ~30s; lock is considered stale after 2 minutes
CREATE TABLE IF NOT EXISTS reading_locks (
  user_id      UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id    TEXT        NOT NULL,
  content_id   UUID        REFERENCES contents(id) ON DELETE SET NULL,
  locked_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE user_devices  ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_locks ENABLE ROW LEVEL SECURITY;

-- Users can manage their own devices
DROP POLICY IF EXISTS "user_devices_own" ON user_devices;
CREATE POLICY "user_devices_own" ON user_devices
  FOR ALL USING (auth.uid() = user_id);

-- Users can manage their own reading lock
DROP POLICY IF EXISTS "reading_locks_own" ON reading_locks;
CREATE POLICY "reading_locks_own" ON reading_locks
  FOR ALL USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_reading_locks_user_id ON reading_locks(user_id);
