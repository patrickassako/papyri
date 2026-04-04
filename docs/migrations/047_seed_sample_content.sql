-- Migration 047: Données de démonstration (contenus + catégories)
-- Date: 2026-03-31
-- À exécuter en développement uniquement pour tester l'interface

-- ============================================================================
-- Catégories
-- ============================================================================
INSERT INTO public.categories (name, slug, description) VALUES
  ('Littérature africaine', 'litterature-africaine', 'Romans, nouvelles et poésie d''auteurs africains'),
  ('Roman', 'roman', 'Fictions romanesques du monde entier'),
  ('Audiobooks', 'audiobooks', 'Livres audio narés par des professionnels'),
  ('Jeunesse', 'jeunesse', 'Livres pour enfants et adolescents'),
  ('Histoire & Société', 'histoire-societe', 'Essais, biographies et ouvrages historiques')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- Éditeur de démonstration
-- ============================================================================
INSERT INTO public.rights_holders (id, name, email, website) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Éditions Papyri Demo', 'demo@papyri.app', 'https://papyri.app')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Contenus de démonstration (ebooks)
-- ============================================================================
INSERT INTO public.contents (
  id, title, author, description, content_type, format, language,
  cover_url, file_key, is_published, published_at
) VALUES
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'L''Enfant noir',
    'Camara Laye',
    'Roman autobiographique de Camara Laye qui retrace son enfance en Guinée et son apprentissage auprès de son père, orfèvre talentueux, et de sa mère, femme de caractère. Un chef-d''œuvre de la littérature africaine francophone.',
    'ebook', 'epub', 'fr',
    'https://covers.openlibrary.org/b/id/8739161-L.jpg',
    'demo/lenfant-noir.epub',
    TRUE, NOW() - INTERVAL '30 days'
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000002',
    'Americanah',
    'Chimamanda Ngozi Adichie',
    'Ifemelu quitte le Nigeria pour les États-Unis où elle poursuit ses études. Partie chercher une vie meilleure, elle y découvre la race, le racisme et l''Amérique. Un roman puissant sur l''identité, l''amour et ce que c''est qu''être noir dans le monde.',
    'ebook', 'epub', 'fr',
    'https://covers.openlibrary.org/b/id/7272759-L.jpg',
    'demo/americanah.epub',
    TRUE, NOW() - INTERVAL '25 days'
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000003',
    'Homegoing',
    'Yaa Gyasi',
    'L''histoire de deux demi-sœurs ghanéennes séparées au XVIIIe siècle et de leurs descendants jusqu''à nos jours. Une saga familiale épique qui traverse 300 ans d''histoire africaine et américaine.',
    'ebook', 'epub', 'fr',
    'https://covers.openlibrary.org/b/id/8739162-L.jpg',
    'demo/homegoing.epub',
    TRUE, NOW() - INTERVAL '20 days'
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000004',
    'Stay with Me',
    'Ayọ̀bámi Adébáyọ̀',
    'Yejide et Akin s''aiment. Mais quand les années passent sans enfant, leur mariage commence à craquer. Un roman bouleversant sur l''amour conjugal, la pression familiale et le désir d''enfant au Nigeria contemporain.',
    'ebook', 'epub', 'fr',
    'https://covers.openlibrary.org/b/id/8739163-L.jpg',
    'demo/stay-with-me.epub',
    TRUE, NOW() - INTERVAL '15 days'
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000005',
    'Transcendance',
    'Alain Mabanckou',
    'Un voyage littéraire entre Paris et Brazzaville, où le narrateur tente de réconcilier deux cultures, deux langues, deux vies. La prose poétique de Mabanckou à son meilleur.',
    'ebook', 'epub', 'fr',
    'https://covers.openlibrary.org/b/id/8739164-L.jpg',
    'demo/transcendance.epub',
    TRUE, NOW() - INTERVAL '10 days'
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000006',
    'Afrikafutur',
    'Collectif',
    'Une anthologie de science-fiction africaine réunissant des auteurs du continent et de la diaspora. Des visions du futur ancrées dans des cultures, des traditions et des défis bien actuels.',
    'ebook', 'epub', 'fr',
    'https://covers.openlibrary.org/b/id/8739165-L.jpg',
    'demo/afrikafutur.epub',
    TRUE, NOW() - INTERVAL '7 days'
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000007',
    'The Fisherman',
    'Chigozie Obioma',
    'Quatre frères grandissent au Nigeria dans les années 1990. Un jour, l''aîné rencontre un homme qui lui prédit qu''il sera tué par un poisson. Une histoire de prophétie, de fraternité et de tragédie.',
    'ebook', 'epub', 'fr',
    'https://covers.openlibrary.org/b/id/8739166-L.jpg',
    'demo/the-fisherman.epub',
    TRUE, NOW() - INTERVAL '5 days'
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000008',
    'Purple Hibiscus',
    'Chimamanda Ngozi Adichie',
    'Kambili, 15 ans, vit sous la domination écrasante de son père, homme riche, respecté et catholique fervent, mais violent à la maison. Un premier roman magnifique sur la liberté et le silence.',
    'ebook', 'epub', 'fr',
    'https://covers.openlibrary.org/b/id/8739167-L.jpg',
    'demo/purple-hibiscus.epub',
    TRUE, NOW() - INTERVAL '3 days'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Audiobooks de démonstration
-- ============================================================================
INSERT INTO public.contents (
  id, title, author, description, content_type, format, language,
  cover_url, file_key, duration_seconds, is_published, published_at
) VALUES
  (
    'bbbbbbbb-0000-0000-0000-000000000001',
    'Feat Pays',
    'Soro Diallo',
    'Un road trip sonore à travers l''Afrique de l''Ouest, narré par des voix venues du Sénégal, de Côte d''Ivoire et du Mali. Une immersion totale dans les cultures, les musiques et les histoires du Sahel.',
    'audiobook', 'mp3', 'fr',
    'https://covers.openlibrary.org/b/id/8739168-L.jpg',
    'demo/feat-pays.mp3',
    14400,
    TRUE, NOW() - INTERVAL '14 days'
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000002',
    'Les Soleils des indépendances',
    'Ahmadou Kourouma',
    'Fama, prince déchu d''une lignée royale, erre entre la tradition et la modernité dans une Afrique post-coloniale. Lu par un comédien ivoirien, ce chef-d''œuvre prend une dimension nouvelle à l''oral.',
    'audiobook', 'mp3', 'fr',
    'https://covers.openlibrary.org/b/id/8739169-L.jpg',
    'demo/soleils-independances.mp3',
    21600,
    TRUE, NOW() - INTERVAL '8 days'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Associer les contenus aux catégories
-- ============================================================================
INSERT INTO public.content_categories (content_id, category_id)
SELECT c.id, cat.id
FROM (VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'litterature-africaine'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'roman'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'litterature-africaine'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'roman'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'litterature-africaine'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'roman'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'litterature-africaine'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'roman'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'litterature-africaine'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'roman'),
  ('aaaaaaaa-0000-0000-0000-000000000006', 'litterature-africaine'),
  ('aaaaaaaa-0000-0000-0000-000000000007', 'roman'),
  ('aaaaaaaa-0000-0000-0000-000000000008', 'roman'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'audiobooks'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'audiobooks'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'litterature-africaine')
) AS v(content_id, category_slug)
JOIN public.contents c ON c.id::text = v.content_id
JOIN public.categories cat ON cat.slug = v.category_slug
ON CONFLICT DO NOTHING;
