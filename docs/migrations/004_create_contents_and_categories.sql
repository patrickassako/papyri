-- Migration Epic 3: Catalogue & Recherche
-- Date: 2026-02-09
-- Description: Tables pour le catalogue de contenus et catégories

-- ============================================================================
-- ÉTAPE 1 : Table rights_holders (Éditeurs / Ayants droit)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rights_holders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  email       VARCHAR(255),
  website     VARCHAR(500),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_rights_holders_name ON public.rights_holders(name);

-- ============================================================================
-- ÉTAPE 2 : Table contents (Catalogue ebooks + audiobooks)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.contents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             VARCHAR(500) NOT NULL,
  author            VARCHAR(255) NOT NULL,
  description       TEXT,
  content_type      VARCHAR(20) NOT NULL CHECK (content_type IN ('ebook', 'audiobook')),
  format            VARCHAR(10) NOT NULL CHECK (format IN ('epub', 'pdf', 'mp3', 'm4a')),
  language          VARCHAR(10) NOT NULL DEFAULT 'fr',
  cover_url         TEXT,
  file_key          VARCHAR(500) NOT NULL,  -- Clé R2/S3 du fichier chiffré
  file_size_bytes   BIGINT,
  duration_seconds  INTEGER,                 -- Pour audiobooks uniquement
  rights_holder_id  UUID REFERENCES public.rights_holders(id),
  is_published      BOOLEAN DEFAULT FALSE,
  published_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ              -- Soft delete
);

-- Index
CREATE INDEX IF NOT EXISTS idx_contents_type ON public.contents(content_type);
CREATE INDEX IF NOT EXISTS idx_contents_language ON public.contents(language);
CREATE INDEX IF NOT EXISTS idx_contents_published ON public.contents(is_published);
CREATE INDEX IF NOT EXISTS idx_contents_author ON public.contents(author);
CREATE INDEX IF NOT EXISTS idx_contents_title ON public.contents(title);
CREATE INDEX IF NOT EXISTS idx_contents_deleted ON public.contents(deleted_at) WHERE deleted_at IS NULL;

-- ============================================================================
-- ÉTAPE 3 : Table categories
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  slug        VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  parent_id   UUID REFERENCES public.categories(id),  -- Pour sous-catégories
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_categories_slug ON public.categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON public.categories(parent_id);

-- ============================================================================
-- ÉTAPE 4 : Table content_categories (N:N)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.content_categories (
  content_id  UUID NOT NULL REFERENCES public.contents(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  PRIMARY KEY (content_id, category_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_cc_content ON public.content_categories(content_id);
CREATE INDEX IF NOT EXISTS idx_cc_category ON public.content_categories(category_id);

-- ============================================================================
-- ÉTAPE 5 : RLS Policies
-- ============================================================================

-- Contents: Lecture publique si publié, écriture admin uniquement
ALTER TABLE public.contents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view published contents" ON public.contents;
CREATE POLICY "Public can view published contents"
ON public.contents FOR SELECT
USING (is_published = true AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Admins can manage contents" ON public.contents;
CREATE POLICY "Admins can manage contents"
ON public.contents FOR ALL
USING (auth.jwt() ->> 'role' = 'admin');

-- Categories: Lecture publique, écriture admin
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view categories" ON public.categories;
CREATE POLICY "Public can view categories"
ON public.categories FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
CREATE POLICY "Admins can manage categories"
ON public.categories FOR ALL
USING (auth.jwt() ->> 'role' = 'admin');

-- Content_categories: Lecture publique, écriture admin
ALTER TABLE public.content_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view content categories" ON public.content_categories;
CREATE POLICY "Public can view content categories"
ON public.content_categories FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admins can manage content categories" ON public.content_categories;
CREATE POLICY "Admins can manage content categories"
ON public.content_categories FOR ALL
USING (auth.jwt() ->> 'role' = 'admin');

-- Rights_holders: Lecture publique, écriture admin
ALTER TABLE public.rights_holders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view rights holders" ON public.rights_holders;
CREATE POLICY "Public can view rights holders"
ON public.rights_holders FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admins can manage rights holders" ON public.rights_holders;
CREATE POLICY "Admins can manage rights holders"
ON public.rights_holders FOR ALL
USING (auth.jwt() ->> 'role' = 'admin');

-- ============================================================================
-- ÉTAPE 6 : Fonctions helper
-- ============================================================================

-- Fonction pour obtenir les catégories d'un contenu
CREATE OR REPLACE FUNCTION public.get_content_categories(content_uuid UUID)
RETURNS TABLE (
  id UUID,
  name VARCHAR(255),
  slug VARCHAR(255)
) AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.name, c.slug
  FROM public.categories c
  INNER JOIN public.content_categories cc ON c.id = cc.category_id
  WHERE cc.content_id = content_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ÉTAPE 7 : Données de test (catégories initiales)
-- ============================================================================

INSERT INTO public.categories (name, slug, description, sort_order) VALUES
  ('Romans', 'romans', 'Romans et littérature narrative', 1),
  ('Essais', 'essais', 'Essais et non-fiction', 2),
  ('Histoire', 'histoire', 'Livres d''histoire', 3),
  ('Sciences', 'sciences', 'Sciences et découvertes', 4),
  ('Jeunesse', 'jeunesse', 'Littérature jeunesse', 5),
  ('Développement Personnel', 'dev-personnel', 'Développement personnel et bien-être', 6),
  ('Politique', 'politique', 'Politique et société', 7),
  ('Arts', 'arts', 'Arts et culture', 8)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- TEST
-- ============================================================================

-- Pour tester :
-- 1. Exécuter cette migration
-- 2. Vérifier les tables :
SELECT * FROM public.contents LIMIT 5;
SELECT * FROM public.categories;
SELECT * FROM public.rights_holders LIMIT 5;
