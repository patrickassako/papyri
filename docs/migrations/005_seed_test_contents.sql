-- Seed Script: Contenus de test pour Epic 3
-- Date: 2026-02-09
-- Description: Données de test pour développement et démo

-- ============================================================================
-- ÉTAPE 1 : Créer un rights holder de test
-- ============================================================================

INSERT INTO public.rights_holders (id, name, email, website) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Éditions Afrique', 'contact@editions-afrique.com', 'https://editions-afrique.com')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- ÉTAPE 2 : Créer des contenus de test (ebooks)
-- ============================================================================

INSERT INTO public.contents (
  id,
  title,
  author,
  description,
  content_type,
  format,
  language,
  cover_url,
  file_key,
  file_size_bytes,
  rights_holder_id,
  is_published,
  published_at
) VALUES
  (
    '10000000-0000-0000-0000-000000000001',
    'L''Enfant Noir',
    'Camara Laye',
    'Un récit autobiographique qui retrace l''enfance de l''auteur en Guinée, explorant les traditions et la culture mandingue.',
    'ebook',
    'epub',
    'fr',
    'https://placehold.co/600x900/B5651D/FFF?text=L%27Enfant+Noir',
    'test/ebooks/enfant-noir.epub',
    1024000,
    '00000000-0000-0000-0000-000000000001',
    true,
    NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'Une si longue lettre',
    'Mariama Bâ',
    'Roman épistolaire sénégalais qui aborde les thèmes du mariage, de la polygamie et de l''émancipation féminine.',
    'ebook',
    'epub',
    'fr',
    'https://placehold.co/600x900/D4A017/FFF?text=Une+si+longue+lettre',
    'test/ebooks/si-longue-lettre.epub',
    890000,
    '00000000-0000-0000-0000-000000000001',
    true,
    NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    'Le Vieux Nègre et la Médaille',
    'Ferdinand Oyono',
    'Satire coloniale camerounaise qui raconte l''histoire d''un vieil homme dévoué à l''administration française.',
    'ebook',
    'epub',
    'fr',
    'https://placehold.co/600x900/2E4057/FFF?text=Le+Vieux+Negre',
    'test/ebooks/vieux-negre-medaille.epub',
    650000,
    '00000000-0000-0000-0000-000000000001',
    true,
    NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    'Discourse on Colonialism',
    'Aimé Césaire',
    'A powerful indictment of European colonial brutality and hypocrisy, written by the Martinican poet and politician.',
    'ebook',
    'pdf',
    'en',
    'https://placehold.co/600x900/B5651D/FFF?text=Discourse+on+Colonialism',
    'test/ebooks/discourse-colonialism.pdf',
    2100000,
    '00000000-0000-0000-0000-000000000001',
    true,
    NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000005',
    'Things Fall Apart',
    'Chinua Achebe',
    'Classic novel about the impact of British colonialism on traditional Igbo society in Nigeria.',
    'ebook',
    'epub',
    'en',
    'https://placehold.co/600x900/D4A017/FFF?text=Things+Fall+Apart',
    'test/ebooks/things-fall-apart.epub',
    1450000,
    '00000000-0000-0000-0000-000000000001',
    true,
    NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000006',
    'La Philosophie Africaine',
    'Paulin Hountondji',
    'Essai philosophique majeur qui interroge l''existence et la nature d''une philosophie africaine authentique.',
    'ebook',
    'pdf',
    'fr',
    'https://placehold.co/600x900/2E4057/FFF?text=Philosophie+Africaine',
    'test/ebooks/philosophie-africaine.pdf',
    3200000,
    '00000000-0000-0000-0000-000000000001',
    true,
    NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000007',
    'Histoire Générale de l''Afrique',
    'UNESCO',
    'Collection monumentale en 8 volumes retraçant l''histoire du continent africain de la préhistoire à nos jours.',
    'ebook',
    'pdf',
    'fr',
    'https://placehold.co/600x900/B5651D/FFF?text=Histoire+Afrique',
    'test/ebooks/histoire-afrique-vol1.pdf',
    15000000,
    '00000000-0000-0000-0000-000000000001',
    true,
    NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000008',
    'Petit Bodiel',
    'Amadou Hampâté Bâ',
    'Conte initiatique peul qui transmet les valeurs et la sagesse traditionnelle d''Afrique de l''Ouest.',
    'ebook',
    'epub',
    'fr',
    'https://placehold.co/600x900/D4A017/FFF?text=Petit+Bodiel',
    'test/ebooks/petit-bodiel.epub',
    450000,
    '00000000-0000-0000-0000-000000000001',
    true,
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- ÉTAPE 3 : Créer des contenus de test (audiobooks)
-- ============================================================================

INSERT INTO public.contents (
  id,
  title,
  author,
  description,
  content_type,
  format,
  language,
  cover_url,
  file_key,
  file_size_bytes,
  duration_seconds,
  rights_holder_id,
  is_published,
  published_at
) VALUES
  (
    '20000000-0000-0000-0000-000000000001',
    'Soundjata ou l''épopée mandingue',
    'Djibril Tamsir Niane',
    'Récit épique de la fondation de l''empire du Mali au XIIIe siècle, narré à partir de la tradition orale.',
    'audiobook',
    'mp3',
    'fr',
    'https://placehold.co/600x900/2E4057/FFF?text=Soundjata',
    'test/audio/soundjata.mp3',
    45000000,
    7200,
    '00000000-0000-0000-0000-000000000001',
    true,
    NOW()
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    'Contes et Légendes d''Afrique',
    'Bernard Dadié',
    'Recueil de contes traditionnels ivoiriens racontant l''histoire des animaux et des hommes.',
    'audiobook',
    'mp3',
    'fr',
    'https://placehold.co/600x900/B5651D/FFF?text=Contes+Afrique',
    'test/audio/contes-afrique.mp3',
    32000000,
    5400,
    '00000000-0000-0000-0000-000000000001',
    true,
    NOW()
  ),
  (
    '20000000-0000-0000-0000-000000000003',
    'The African Origin of Civilization',
    'Cheikh Anta Diop',
    'Groundbreaking work arguing for the African origins of ancient Egyptian civilization.',
    'audiobook',
    'mp3',
    'en',
    'https://placehold.co/600x900/D4A017/FFF?text=African+Origin',
    'test/audio/african-origin.mp3',
    52000000,
    8640,
    '00000000-0000-0000-0000-000000000001',
    true,
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- ÉTAPE 4 : Associer les contenus aux catégories
-- ============================================================================

-- L'Enfant Noir → Romans
INSERT INTO public.content_categories (content_id, category_id)
SELECT '10000000-0000-0000-0000-000000000001', id FROM public.categories WHERE slug = 'romans'
ON CONFLICT DO NOTHING;

-- Une si longue lettre → Romans
INSERT INTO public.content_categories (content_id, category_id)
SELECT '10000000-0000-0000-0000-000000000002', id FROM public.categories WHERE slug = 'romans'
ON CONFLICT DO NOTHING;

-- Le Vieux Nègre → Romans
INSERT INTO public.content_categories (content_id, category_id)
SELECT '10000000-0000-0000-0000-000000000003', id FROM public.categories WHERE slug = 'romans'
ON CONFLICT DO NOTHING;

-- Discourse on Colonialism → Essais + Politique
INSERT INTO public.content_categories (content_id, category_id)
SELECT '10000000-0000-0000-0000-000000000004', id FROM public.categories WHERE slug = 'essais'
ON CONFLICT DO NOTHING;
INSERT INTO public.content_categories (content_id, category_id)
SELECT '10000000-0000-0000-0000-000000000004', id FROM public.categories WHERE slug = 'politique'
ON CONFLICT DO NOTHING;

-- Things Fall Apart → Romans + Histoire
INSERT INTO public.content_categories (content_id, category_id)
SELECT '10000000-0000-0000-0000-000000000005', id FROM public.categories WHERE slug = 'romans'
ON CONFLICT DO NOTHING;
INSERT INTO public.content_categories (content_id, category_id)
SELECT '10000000-0000-0000-0000-000000000005', id FROM public.categories WHERE slug = 'histoire'
ON CONFLICT DO NOTHING;

-- La Philosophie Africaine → Essais
INSERT INTO public.content_categories (content_id, category_id)
SELECT '10000000-0000-0000-0000-000000000006', id FROM public.categories WHERE slug = 'essais'
ON CONFLICT DO NOTHING;

-- Histoire Générale de l'Afrique → Histoire
INSERT INTO public.content_categories (content_id, category_id)
SELECT '10000000-0000-0000-0000-000000000007', id FROM public.categories WHERE slug = 'histoire'
ON CONFLICT DO NOTHING;

-- Petit Bodiel → Jeunesse
INSERT INTO public.content_categories (content_id, category_id)
SELECT '10000000-0000-0000-0000-000000000008', id FROM public.categories WHERE slug = 'jeunesse'
ON CONFLICT DO NOTHING;

-- Soundjata → Histoire + Jeunesse
INSERT INTO public.content_categories (content_id, category_id)
SELECT '20000000-0000-0000-0000-000000000001', id FROM public.categories WHERE slug = 'histoire'
ON CONFLICT DO NOTHING;
INSERT INTO public.content_categories (content_id, category_id)
SELECT '20000000-0000-0000-0000-000000000001', id FROM public.categories WHERE slug = 'jeunesse'
ON CONFLICT DO NOTHING;

-- Contes et Légendes → Jeunesse
INSERT INTO public.content_categories (content_id, category_id)
SELECT '20000000-0000-0000-0000-000000000002', id FROM public.categories WHERE slug = 'jeunesse'
ON CONFLICT DO NOTHING;

-- African Origin → Histoire + Essais
INSERT INTO public.content_categories (content_id, category_id)
SELECT '20000000-0000-0000-0000-000000000003', id FROM public.categories WHERE slug = 'histoire'
ON CONFLICT DO NOTHING;
INSERT INTO public.content_categories (content_id, category_id)
SELECT '20000000-0000-0000-0000-000000000003', id FROM public.categories WHERE slug = 'essais'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Vérifier les contenus créés
SELECT
  c.title,
  c.author,
  c.content_type,
  c.format,
  c.language,
  array_agg(cat.name) as categories
FROM public.contents c
LEFT JOIN public.content_categories cc ON c.id = cc.content_id
LEFT JOIN public.categories cat ON cc.category_id = cat.id
WHERE c.is_published = true
GROUP BY c.id, c.title, c.author, c.content_type, c.format, c.language
ORDER BY c.created_at DESC;
