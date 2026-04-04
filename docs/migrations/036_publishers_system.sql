-- ============================================================
-- Migration 036 — Système Éditeurs (Publishers)
-- Tables: publishers, publisher_books, publisher_revenue, publisher_payouts
-- Modifs: promo_codes (+publisher_id), contents (+publisher_id, +is_published)
-- ============================================================

-- ── 1. Table publishers ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS publishers (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid          REFERENCES auth.users(id) ON DELETE SET NULL UNIQUE,
  company_name        text          NOT NULL,
  contact_name        text          NOT NULL,
  email               text          NOT NULL UNIQUE,
  description         text,
  logo_url            text,
  website             text,
  status              text          NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending','active','paused','banned')),
  revenue_grid        jsonb         NOT NULL DEFAULT '{"threshold_cad":5,"above_threshold_cad":5,"below_threshold_cad":2.5}',
  payout_method       jsonb,        -- {type, iban, swift, bank, country, phone, operator, paypal_email}
  invited_by          uuid          REFERENCES auth.users(id) ON DELETE SET NULL,
  invitation_token    text          UNIQUE,
  invitation_sent_at  timestamptz,
  invitation_expires_at timestamptz,
  activated_at        timestamptz,
  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now()
);

-- ── 2. Table publisher_books ──────────────────────────────────
-- Lien entre publisher et contenu soumis, avec suivi de validation
CREATE TABLE IF NOT EXISTS publisher_books (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id      uuid        NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
  content_id        uuid        NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  validation_status text        NOT NULL DEFAULT 'pending'
                                CHECK (validation_status IN ('pending','approved','rejected','paused')),
  rejection_reason  text,
  submitted_at      timestamptz NOT NULL DEFAULT now(),
  reviewed_at       timestamptz,
  reviewed_by       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (publisher_id, content_id)
);

-- ── 3. Table publisher_payouts ────────────────────────────────
-- Versements aux éditeurs (déclarée avant publisher_revenue pour la FK)
CREATE TABLE IF NOT EXISTS publisher_payouts (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id    uuid          NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
  amount_cad      numeric(10,2) NOT NULL,
  period_start    date          NOT NULL,
  period_end      date          NOT NULL,
  status          text          NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','processing','paid','failed')),
  payout_method   jsonb,        -- snapshot du mode de paiement au moment du versement
  reference       text          UNIQUE, -- ex: VRS-20260301-001
  notes           text,
  processed_at    timestamptz,
  processed_by    uuid          REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now()
);

-- ── 4. Table publisher_revenue ────────────────────────────────
-- Revenu calculé par vente, par livre, par éditeur
CREATE TABLE IF NOT EXISTS publisher_revenue (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id          uuid          NOT NULL REFERENCES publishers(id) ON DELETE CASCADE,
  content_id            uuid          NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  payment_id            uuid          REFERENCES payments(id) ON DELETE SET NULL,
  sale_type             text          NOT NULL DEFAULT 'normal'
                                      CHECK (sale_type IN ('normal','bonus')),
  book_price_cad        numeric(10,2) NOT NULL DEFAULT 0,
  publisher_amount_cad  numeric(10,2) NOT NULL DEFAULT 0,
  period_month          date          NOT NULL, -- premier jour du mois (ex: 2026-03-01)
  payout_id             uuid          REFERENCES publisher_payouts(id) ON DELETE SET NULL,
  created_at            timestamptz   NOT NULL DEFAULT now()
);

-- ── 5. Ajout publisher_id à promo_codes ───────────────────────
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS publisher_id uuid REFERENCES publishers(id) ON DELETE CASCADE;
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS applicable_contents uuid[]; -- NULL = tous les livres de l'éditeur
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS monthly_slot date; -- premier jour du mois de création (pour quota)

-- ── 6. Ajout is_published + publisher_id à contents ──────────
ALTER TABLE contents ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true;
ALTER TABLE contents ADD COLUMN IF NOT EXISTS publisher_id uuid REFERENCES publishers(id) ON DELETE SET NULL;

-- Les contenus existants sont considérés publiés (uploadés par admin)
UPDATE contents SET is_published = true WHERE is_published IS NULL;

-- ── Index ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_publishers_status          ON publishers(status);
CREATE INDEX IF NOT EXISTS idx_publishers_user_id         ON publishers(user_id);
CREATE INDEX IF NOT EXISTS idx_publishers_invitation_token ON publishers(invitation_token);

CREATE INDEX IF NOT EXISTS idx_publisher_books_publisher  ON publisher_books(publisher_id);
CREATE INDEX IF NOT EXISTS idx_publisher_books_content    ON publisher_books(content_id);
CREATE INDEX IF NOT EXISTS idx_publisher_books_status     ON publisher_books(validation_status);

CREATE INDEX IF NOT EXISTS idx_publisher_revenue_publisher ON publisher_revenue(publisher_id);
CREATE INDEX IF NOT EXISTS idx_publisher_revenue_period    ON publisher_revenue(period_month);
CREATE INDEX IF NOT EXISTS idx_publisher_revenue_content   ON publisher_revenue(content_id);

CREATE INDEX IF NOT EXISTS idx_publisher_payouts_publisher ON publisher_payouts(publisher_id);
CREATE INDEX IF NOT EXISTS idx_publisher_payouts_status    ON publisher_payouts(status);

CREATE INDEX IF NOT EXISTS idx_promo_codes_publisher       ON promo_codes(publisher_id);
CREATE INDEX IF NOT EXISTS idx_promo_codes_monthly_slot    ON promo_codes(monthly_slot);

CREATE INDEX IF NOT EXISTS idx_contents_publisher_id       ON contents(publisher_id);
CREATE INDEX IF NOT EXISTS idx_contents_is_published       ON contents(is_published);

-- ── Triggers updated_at ───────────────────────────────────────
CREATE OR REPLACE FUNCTION update_publishers_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_publishers_updated_at ON publishers;
CREATE TRIGGER trg_publishers_updated_at
  BEFORE UPDATE ON publishers
  FOR EACH ROW EXECUTE FUNCTION update_publishers_updated_at();

CREATE OR REPLACE FUNCTION update_publisher_payouts_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_publisher_payouts_updated_at ON publisher_payouts;
CREATE TRIGGER trg_publisher_payouts_updated_at
  BEFORE UPDATE ON publisher_payouts
  FOR EACH ROW EXECUTE FUNCTION update_publisher_payouts_updated_at();

-- ── Fonction : quota codes promo éditeur ─────────────────────
-- Retourne le nb de codes créés par un éditeur pour le mois courant
CREATE OR REPLACE FUNCTION get_publisher_promo_quota(p_publisher_id uuid)
RETURNS integer AS $$
  SELECT COUNT(*)::integer
  FROM promo_codes
  WHERE publisher_id = p_publisher_id
    AND monthly_slot = date_trunc('month', now())::date;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE publishers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE publisher_books     ENABLE ROW LEVEL SECURITY;
ALTER TABLE publisher_revenue   ENABLE ROW LEVEL SECURITY;
ALTER TABLE publisher_payouts   ENABLE ROW LEVEL SECURITY;

-- service_role (backend) a accès total
CREATE POLICY "service_role_publishers"
  ON publishers FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_publisher_books"
  ON publisher_books FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_publisher_revenue"
  ON publisher_revenue FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_publisher_payouts"
  ON publisher_payouts FOR ALL TO service_role USING (true) WITH CHECK (true);
