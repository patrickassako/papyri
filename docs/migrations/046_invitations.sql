-- Migration 046: Invitations utilisateurs avec rôle
-- Date: 2026-03-31

CREATE TABLE IF NOT EXISTS invitations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        VARCHAR(255) NOT NULL,
  role         VARCHAR(50)  NOT NULL DEFAULT 'user',
  invited_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  accepted_at  TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invitations_email    ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_accepted ON invitations(accepted_at) WHERE accepted_at IS NULL;

-- Empêche 2 invitations en attente pour le même email
CREATE UNIQUE INDEX IF NOT EXISTS idx_invitations_email_pending
  ON invitations(email)
  WHERE accepted_at IS NULL;

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage invitations"
  ON invitations FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Service role full access invitations"
  ON invitations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- TRIGGER : marquer l'invitation comme acceptée à l'inscription
-- Se déclenche quand handle_new_user() crée le profil
-- ============================================================================
CREATE OR REPLACE FUNCTION mark_invitation_accepted()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE invitations
  SET accepted_at = now()
  WHERE email = NEW.email
    AND accepted_at IS NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_mark_invitation_accepted ON profiles;
CREATE TRIGGER trg_mark_invitation_accepted
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION mark_invitation_accepted();
