-- Migration 041 : Réclamations éditeurs
-- À exécuter dans Supabase SQL Editor

CREATE TABLE IF NOT EXISTS publisher_claims (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id  uuid        NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
  category      text        NOT NULL DEFAULT 'other'
                            CHECK (category IN ('payout','content','technical','account','other')),
  subject       text        NOT NULL,
  message       text        NOT NULL,
  status        text        NOT NULL DEFAULT 'open'
                            CHECK (status IN ('open','in_progress','resolved','closed')),
  admin_reply   text,
  replied_by    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  replied_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_publisher_claims_publisher ON publisher_claims(publisher_id);
CREATE INDEX IF NOT EXISTS idx_publisher_claims_status    ON publisher_claims(status);
CREATE INDEX IF NOT EXISTS idx_publisher_claims_created   ON publisher_claims(created_at DESC);

ALTER TABLE publisher_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_publisher_claims"
  ON publisher_claims FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_publisher_claims_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_publisher_claims_updated_at ON publisher_claims;
CREATE TRIGGER trg_publisher_claims_updated_at
  BEFORE UPDATE ON publisher_claims
  FOR EACH ROW EXECUTE FUNCTION update_publisher_claims_updated_at();
