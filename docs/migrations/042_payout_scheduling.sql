-- Migration 042 : Système de planification automatique des versements
-- À exécuter dans Supabase SQL Editor

-- ── 1. Table de configuration de la planification ──────────────
CREATE TABLE IF NOT EXISTS payout_schedule_config (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  frequency       text        NOT NULL DEFAULT 'monthly'
                              CHECK (frequency IN ('weekly','biweekly','monthly','quarterly')),
  day_of_month    int         NOT NULL DEFAULT 1 CHECK (day_of_month BETWEEN 1 AND 28),
  day_of_week     int         NOT NULL DEFAULT 1 CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Dimanche
  is_active       boolean     NOT NULL DEFAULT true,
  min_amount_cad  numeric(10,2) NOT NULL DEFAULT 5.00,
  notes           text,
  updated_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Ligne singleton (une seule config globale)
INSERT INTO payout_schedule_config (frequency, day_of_month, day_of_week, is_active, min_amount_cad)
VALUES ('monthly', 1, 1, true, 5.00)
ON CONFLICT DO NOTHING;

-- RLS : service_role uniquement
ALTER TABLE payout_schedule_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_payout_config"
  ON payout_schedule_config FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── 2. Ajout de la colonne scheduled_for sur publisher_payouts ──
ALTER TABLE publisher_payouts ADD COLUMN IF NOT EXISTS scheduled_for date;

-- ── 3. Mise à jour de la contrainte status pour ajouter 'scheduled' ──
ALTER TABLE publisher_payouts DROP CONSTRAINT IF EXISTS publisher_payouts_status_check;
ALTER TABLE publisher_payouts ADD CONSTRAINT publisher_payouts_status_check
  CHECK (status IN ('scheduled', 'pending', 'processing', 'paid', 'failed'));

-- Index pour les requêtes sur les versements planifiés
CREATE INDEX IF NOT EXISTS idx_publisher_payouts_scheduled
  ON publisher_payouts(status, scheduled_for)
  WHERE status = 'scheduled';
