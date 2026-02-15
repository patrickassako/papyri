-- Migration: Create audit_logs table for AdminJS audit trail
-- Epic 10, Story 10.1
-- Date: 2026-02-13

-- ============================================================================
-- AUDIT LOGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action        VARCHAR(100) NOT NULL,
    -- Actions: 'create' | 'update' | 'delete' | 'login' | 'logout' | 'export' | 'custom'
  resource      VARCHAR(100) NOT NULL,
    -- Resources: 'users' | 'profiles' | 'contents' | 'subscriptions' | 'categories' | 'collections' | etc.
  resource_id   UUID,
    -- ID of the affected resource (optional for bulk actions)
  details       JSONB,
    -- Additional context: before/after values, filters, counts, etc.
  ip_address    VARCHAR(45),
    -- IPv4 or IPv6 address
  user_agent    TEXT,
    -- Browser/client user agent
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Index for admin lookup (most common query)
CREATE INDEX idx_audit_admin ON audit_logs(admin_id);

-- Index for chronological queries (descending for recent first)
CREATE INDEX idx_audit_timestamp ON audit_logs(created_at DESC);

-- Index for resource lookup
CREATE INDEX idx_audit_resource ON audit_logs(resource);

-- Composite index for admin + date range queries
CREATE INDEX idx_audit_admin_timestamp ON audit_logs(admin_id, created_at DESC);

-- Index for action type analysis
CREATE INDEX idx_audit_action ON audit_logs(action);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can read audit logs
CREATE POLICY "Admins can view all audit logs"
ON audit_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND (auth.users.raw_user_meta_data->>'role' = 'admin' OR auth.users.email LIKE '%@bibliotheque.app')
  )
);

-- Policy: Service role can insert (backend only)
CREATE POLICY "Service role can insert audit logs"
ON audit_logs
FOR INSERT
TO service_role
WITH CHECK (true);

-- Policy: No one can update or delete audit logs (immutable)
-- No update/delete policies = only service role can do it via supabaseAdmin

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE audit_logs IS 'Audit trail for all admin actions in AdminJS back-office (Epic 10)';
COMMENT ON COLUMN audit_logs.admin_id IS 'ID of the admin user who performed the action';
COMMENT ON COLUMN audit_logs.action IS 'Type of action: create, update, delete, login, logout, export, custom';
COMMENT ON COLUMN audit_logs.resource IS 'Name of the affected resource/table';
COMMENT ON COLUMN audit_logs.resource_id IS 'ID of the specific resource affected (optional for bulk operations)';
COMMENT ON COLUMN audit_logs.details IS 'JSON object with before/after values, filters, or additional context';
COMMENT ON COLUMN audit_logs.ip_address IS 'IP address of the admin user';
COMMENT ON COLUMN audit_logs.user_agent IS 'User agent string of the admin browser';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Test: Insert a sample audit log (will be done by backend service)
-- This is just to verify the schema works
DO $$
DECLARE
  test_admin_id UUID;
BEGIN
  -- Get first admin user (if exists)
  SELECT id INTO test_admin_id FROM auth.users LIMIT 1;

  IF test_admin_id IS NOT NULL THEN
    INSERT INTO audit_logs (admin_id, action, resource, details)
    VALUES (
      test_admin_id,
      'custom',
      'system',
      '{"message": "Audit logs table created successfully", "migration": "020_create_audit_logs.sql"}'::jsonb
    );

    RAISE NOTICE 'Audit logs table created and verified successfully';
  ELSE
    RAISE NOTICE 'Audit logs table created (no test user available for verification)';
  END IF;
END $$;

-- ============================================================================
-- ROLLBACK (Optional - run manually if needed)
-- ============================================================================

-- DROP TABLE IF EXISTS audit_logs CASCADE;
-- DROP POLICY IF EXISTS "Admins can view all audit logs" ON audit_logs;
-- DROP POLICY IF EXISTS "Service role can insert audit logs" ON audit_logs;
