-- Migration 038 : Restrictions géographiques de contenu
-- Permet de bloquer ou de limiter l'accès à un contenu par zone/continent

-- Configuration du mode de restriction par contenu
CREATE TABLE IF NOT EXISTS public.content_geo_restriction_config (
  content_id  UUID PRIMARY KEY REFERENCES public.contents(id) ON DELETE CASCADE,
  mode        VARCHAR(20) NOT NULL DEFAULT 'blacklist'
              CHECK (mode IN ('blacklist', 'whitelist')),
  -- blacklist : le contenu est disponible partout SAUF les zones listées
  -- whitelist : le contenu est disponible UNIQUEMENT dans les zones listées
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Zones concernées par la restriction
CREATE TABLE IF NOT EXISTS public.content_geo_restrictions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id  UUID NOT NULL REFERENCES public.contents(id) ON DELETE CASCADE,
  zone        VARCHAR(50)  NOT NULL,
  zone_label  VARCHAR(100) NOT NULL,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  reason      TEXT,                  -- ex: "Droits non acquis pour cette région"
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (content_id, zone)
);

CREATE INDEX IF NOT EXISTS idx_geo_restrictions_content_id
  ON public.content_geo_restrictions (content_id);

-- RLS : admins seulement
ALTER TABLE public.content_geo_restriction_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_geo_restrictions        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_geo_config_all" ON public.content_geo_restriction_config
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "admin_geo_restrictions_all" ON public.content_geo_restrictions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
