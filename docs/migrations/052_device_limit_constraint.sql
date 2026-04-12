-- Migration 052: Enforce 3-device limit at database level
-- Prevents race conditions where two devices register simultaneously
-- and both bypass the application-layer count check.

-- Trigger function: called BEFORE INSERT on user_devices
CREATE OR REPLACE FUNCTION enforce_device_limit()
RETURNS TRIGGER AS $$
DECLARE
  device_count INTEGER;
  max_devices  INTEGER := 3;
BEGIN
  SELECT COUNT(*)
    INTO device_count
    FROM user_devices
   WHERE user_id = NEW.user_id;

  IF device_count >= max_devices THEN
    RAISE EXCEPTION 'DEVICE_LIMIT_REACHED'
      USING DETAIL = 'Maximum ' || max_devices || ' devices allowed per user.',
            ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop if exists to allow re-running safely
DROP TRIGGER IF EXISTS trg_enforce_device_limit ON user_devices;

CREATE TRIGGER trg_enforce_device_limit
  BEFORE INSERT ON user_devices
  FOR EACH ROW
  EXECUTE FUNCTION enforce_device_limit();
