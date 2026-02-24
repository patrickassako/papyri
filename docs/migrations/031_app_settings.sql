-- ============================================================================
-- Migration 031 : Table app_settings (paramètres de l'application)
-- Inclut la configuration de personnalisation des factures PDF
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ─── Informations société ─────────────────────────────────────────────────
  company_name        VARCHAR(200)  NOT NULL DEFAULT 'Papyri — Bibliothèque Numérique',
  company_tagline     VARCHAR(300)           DEFAULT 'Votre bibliothèque numérique africaine',
  company_address     VARCHAR(500)           DEFAULT 'Yaoundé, Cameroun',
  company_email       VARCHAR(200)           DEFAULT 'contact@papyri.app',
  company_website     VARCHAR(200)           DEFAULT 'papyri.app',
  company_phone       VARCHAR(50)            DEFAULT '',
  company_vat_id      VARCHAR(100)           DEFAULT '',

  -- ─── Factures PDF ────────────────────────────────────────────────────────
  invoice_prefix       VARCHAR(20)  NOT NULL DEFAULT 'INV',
  invoice_footer_text  TEXT                  DEFAULT 'Cette facture a été générée automatiquement par Papyri. Pour toute question : contact@papyri.app',
  invoice_primary_color VARCHAR(7)  NOT NULL DEFAULT '#B5651D',
  invoice_accent_color  VARCHAR(7)  NOT NULL DEFAULT '#D4A017',
  invoice_logo_url     VARCHAR(500)          DEFAULT '',
  invoice_notes        TEXT                  DEFAULT '',

  -- ─── Méta ─────────────────────────────────────────────────────────────────
  updated_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ligne unique avec UUID fixe (singleton pattern)
INSERT INTO public.app_settings (id)
VALUES ('10000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.update_app_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER trg_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_app_settings_updated_at();

-- Commentaires
COMMENT ON TABLE public.app_settings IS 'Paramètres globaux de l''application — singleton (une seule ligne)';
COMMENT ON COLUMN public.app_settings.invoice_prefix IS 'Préfixe des numéros de facture (ex: INV → INV-20260224-A3F2)';
COMMENT ON COLUMN public.app_settings.invoice_primary_color IS 'Couleur principale des factures en hex (#B5651D)';
COMMENT ON COLUMN public.app_settings.invoice_accent_color IS 'Couleur accent des factures en hex (#D4A017)';
