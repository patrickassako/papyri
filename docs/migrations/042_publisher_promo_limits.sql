-- ============================================================
-- Migration 042 — Limites codes promo par éditeur
-- Ajoute promo_monthly_limit sur la table publishers
-- ============================================================

ALTER TABLE publishers
  ADD COLUMN IF NOT EXISTS promo_monthly_limit integer NOT NULL DEFAULT 50;

COMMENT ON COLUMN publishers.promo_monthly_limit IS
  'Nombre maximum de codes promo que l''éditeur peut créer par mois (défaut 50)';
