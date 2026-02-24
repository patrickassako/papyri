-- Migration: Epic 10 Admin Setup
-- Adds role, is_active, email to profiles
-- Creates audit_logs table
-- Date: 2026-02-17

-- ============================================================================
-- 1. ADD ADMIN COLUMNS TO PROFILES
-- ============================================================================

-- Add role column (default: user)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';

-- Add is_active column (default: true)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Add email column (synced from auth.users for admin convenience)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Add analytics_consent column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS analytics_consent BOOLEAN DEFAULT false;

-- Sync existing emails from auth.users
UPDATE profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
AND p.email IS NULL;

-- Update trigger to sync email on new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, language, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Utilisateur'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'language', 'fr'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Index for role queries
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON profiles(is_active);

-- ============================================================================
-- 2. CREATE AUDIT_LOGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action        VARCHAR(100) NOT NULL,
  resource      VARCHAR(100) NOT NULL,
  resource_id   UUID,
  details       JSONB,
  ip_address    VARCHAR(45),
  user_agent    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_admin ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource);
CREATE INDEX IF NOT EXISTS idx_audit_admin_timestamp ON audit_logs(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins can read audit logs
CREATE POLICY "Admins can view audit logs"
ON audit_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Service role can insert (backend)
CREATE POLICY "Service role inserts audit logs"
ON audit_logs
FOR INSERT
TO service_role
WITH CHECK (true);

COMMENT ON TABLE audit_logs IS 'Audit trail for admin actions (Epic 10)';

-- ============================================================================
-- 3. VERIFICATION
-- ============================================================================

DO $$
BEGIN
  -- Verify columns exist
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'role') THEN
    RAISE NOTICE 'profiles.role column: OK';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_active') THEN
    RAISE NOTICE 'profiles.is_active column: OK';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'email') THEN
    RAISE NOTICE 'profiles.email column: OK';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
    RAISE NOTICE 'audit_logs table: OK';
  END IF;
  RAISE NOTICE 'Epic 10 migration complete';
END $$;
