-- ============================================================
-- Migration 032 — Codes promo
-- Tables: promo_codes, promo_code_usages
-- ============================================================

-- ── Table principale ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS promo_codes (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text        NOT NULL UNIQUE,
  description     text,
  discount_type   text        NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value  numeric(10,2) NOT NULL CHECK (discount_value > 0),
  max_uses        integer,      -- NULL = illimité
  used_count      integer     NOT NULL DEFAULT 0,
  valid_from      timestamptz,  -- NULL = pas de date de début
  valid_until     timestamptz,  -- NULL = pas d'expiration
  applicable_plans text[],      -- NULL = tous les plans
  is_active       boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ── Table d'utilisation ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS promo_code_usages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id   uuid        NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subscription_id uuid        REFERENCES subscriptions(id) ON DELETE SET NULL,
  discount_applied numeric(10,2) NOT NULL DEFAULT 0,
  used_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (promo_code_id, user_id)  -- un seul usage par utilisateur par code
);

-- ── Index ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_promo_codes_code     ON promo_codes(lower(code));
CREATE INDEX IF NOT EXISTS idx_promo_codes_active   ON promo_codes(is_active);
CREATE INDEX IF NOT EXISTS idx_promo_usages_user    ON promo_code_usages(user_id);
CREATE INDEX IF NOT EXISTS idx_promo_usages_code    ON promo_code_usages(promo_code_id);

-- ── Trigger updated_at ────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_promo_codes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_promo_codes_updated_at ON promo_codes;
CREATE TRIGGER trg_promo_codes_updated_at
  BEFORE UPDATE ON promo_codes
  FOR EACH ROW EXECUTE FUNCTION update_promo_codes_updated_at();

-- ── Fonction d'incrément atomique ─────────────────────────────
CREATE OR REPLACE FUNCTION increment_promo_used_count(code_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE promo_codes SET used_count = used_count + 1 WHERE id = code_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE promo_codes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_code_usages ENABLE ROW LEVEL SECURITY;

-- Seul le service_role (backend) peut accéder
CREATE POLICY "service_role_promo_codes"
  ON promo_codes FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "service_role_promo_usages"
  ON promo_code_usages FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ── Données de test ───────────────────────────────────────────
-- Code BIENVENUE : -20% sur tous les plans, 50 utilisations max, valable jusqu'à fin 2026
INSERT INTO promo_codes (code, description, discount_type, discount_value, max_uses, valid_until, is_active)
VALUES (
  'BIENVENUE',
  '20% de réduction pour les nouveaux abonnés',
  'percent',
  20,
  50,
  '2026-12-31 23:59:59+00',
  true
) ON CONFLICT (code) DO NOTHING;

-- Code PAPYRI1EUR : -1 EUR fixe, illimité
INSERT INTO promo_codes (code, description, discount_type, discount_value, max_uses, is_active)
VALUES (
  'PAPYRI1EUR',
  '1 EUR de réduction sur votre premier abonnement',
  'fixed',
  1.00,
  NULL,
  true
) ON CONFLICT (code) DO NOTHING;
