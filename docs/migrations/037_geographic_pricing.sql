-- Migration 037 : Prix géographiques par contenu
-- Permet à l'admin de définir des prix différents par zone/continent

CREATE TABLE IF NOT EXISTS public.content_geographic_pricing (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id   UUID NOT NULL REFERENCES public.contents(id) ON DELETE CASCADE,
  zone         VARCHAR(50)  NOT NULL,   -- identifiant machine : 'africa', 'europe', etc.
  zone_label   VARCHAR(100) NOT NULL,   -- libellé affiché : 'Afrique', 'Europe', etc.
  price_cents  INTEGER      NOT NULL CHECK (price_cents >= 0),
  currency     VARCHAR(3)   NOT NULL DEFAULT 'EUR',
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  notes        TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (content_id, zone)
);

-- Index pour accès rapide par contenu
CREATE INDEX IF NOT EXISTS idx_geo_pricing_content_id
  ON public.content_geographic_pricing (content_id);

-- RLS : admins seulement
ALTER TABLE public.content_geographic_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_geo_pricing_all" ON public.content_geographic_pricing
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.update_geo_pricing_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_geo_pricing_updated_at
  BEFORE UPDATE ON public.content_geographic_pricing
  FOR EACH ROW EXECUTE FUNCTION public.update_geo_pricing_updated_at();
