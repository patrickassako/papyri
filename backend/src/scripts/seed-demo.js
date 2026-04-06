/**
 * seed-demo.js — Données fictives pour présentation Papyri
 *
 * Crée :
 *   - 5 abonnés + 3 comptes éditeurs dans Supabase Auth
 *   - 3 maisons d'édition avec catalogue (13 titres)
 *   - Abonnements actifs + historique paiements (3 mois)
 *   - Historique de lecture, signets, surlignages
 *   - Revenus éditeurs + versements (2 payés, 1 en attente)
 *   - Réclamation ouverte + codes promo actifs
 *   - Avis lecteurs
 *
 * Usage :
 *   cd backend && node src/scripts/seed-demo.js
 *   node src/scripts/seed-demo.js --clean   → supprime tout avant d'insérer
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const CLEAN = process.argv.includes('--clean');
const DEMO_PASSWORD = 'DemoPapyri2026';

// ─────────────────────────────────────────────
// UUIDs fixes (pour reproducibilité)
// ─────────────────────────────────────────────

// Plans (récupérés dynamiquement)
let PLAN_PERSONAL_ID, PLAN_FAMILY_ID, PLAN_PERSONAL_SLOW_ID, PLAN_ANNUAL_ID;

// Users auth (remplis après création)
const U = {
  awa:     null,  // abonnée Personnel
  franck:  null,  // abonné Famille
  mariame: null,  // abonnée Personnel
  kofi:    null,  // abonné Personnel Slow
  djibril: null,  // abonné Annuel
  sophie:  null,  // éditrice Lumière d'Afrique
  omar:    null,  // éditeur Sahel
  chloe:   null,  // éditrice Arc-en-Ciel
};

// Publishers
const PUB = {
  lumiere:   'bb000001-demo-0000-0000-000000000001',
  sahel:     'bb000001-demo-0000-0000-000000000002',
  arcenciel: 'bb000001-demo-0000-0000-000000000003',
};

// Contents — Lumière d'Afrique
const C = {
  etoiles:    'cc000001-demo-0000-0000-000000000001', // ebook
  chroniques: 'cc000001-demo-0000-0000-000000000002', // ebook
  voie_griot: 'cc000001-demo-0000-0000-000000000003', // ebook
  aube:       'cc000001-demo-0000-0000-000000000004', // audiobook
  sagesses:   'cc000001-demo-0000-0000-000000000005', // audiobook
  // Sahel
  desert:     'cc000001-demo-0000-0000-000000000006', // ebook
  marabout:   'cc000001-demo-0000-0000-000000000007', // ebook
  nuits_dakar:'cc000001-demo-0000-0000-000000000008', // audiobook
  contes:     'cc000001-demo-0000-0000-000000000009', // audiobook
  // Arc-en-Ciel
  abidjan:    'cc000001-demo-0000-0000-000000000010', // ebook
  danseuse:   'cc000001-demo-0000-0000-000000000011', // ebook
  rythmes:    'cc000001-demo-0000-0000-000000000012', // audiobook
  baobab:     'cc000001-demo-0000-0000-000000000013', // audiobook
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

async function db(table, data) {
  const { error } = await supabase.from(table).upsert(data, { onConflict: 'id' });
  if (error) console.error(`  ⚠️  ${table}:`, error.message);
}

async function dbInsert(table, data) {
  const { error } = await supabase.from(table).insert(data);
  if (error && !error.message.includes('duplicate') && !error.message.includes('unique'))
    console.error(`  ⚠️  ${table}:`, error.message);
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function monthStart(monthsAgo = 0) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - monthsAgo);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

// ─────────────────────────────────────────────
// NETTOYAGE (optionnel --clean)
// ─────────────────────────────────────────────

async function clean() {
  console.log('🧹 Nettoyage des données de démo...');

  const demoPubIds = Object.values(PUB);
  const demoContentIds = Object.values(C);

  await supabase.from('publisher_claims').delete().in('publisher_id', demoPubIds);
  await supabase.from('publisher_revenue').delete().in('publisher_id', demoPubIds);
  await supabase.from('publisher_payouts').delete().in('publisher_id', demoPubIds);
  await supabase.from('publisher_books').delete().in('content_id', demoContentIds);
  await supabase.from('content_reviews').delete().in('content_id', demoContentIds);
  await supabase.from('bookmarks').delete().in('content_id', demoContentIds);
  await supabase.from('highlights').delete().in('content_id', demoContentIds);
  await supabase.from('reading_history').delete().in('content_id', demoContentIds);
  await supabase.from('content_categories').delete().in('content_id', demoContentIds);
  await supabase.from('contents').delete().in('id', demoContentIds);
  await supabase.from('publishers').delete().in('id', demoPubIds);
  await supabase.from('promo_codes').delete().like('code', 'DEMO%');

  // Supprimer les users demo de Supabase Auth
  const emails = [
    'awa.diallo@demo.papyri.app', 'franck.mbeki@demo.papyri.app',
    'mariame.kone@demo.papyri.app', 'kofi.asante@demo.papyri.app',
    'djibril.ndiaye@demo.papyri.app', 'sophie.edinga@demo.papyri.app',
    'omar.benmoussa@demo.papyri.app', 'chloe.mensah@demo.papyri.app',
  ];
  const { data: users } = await supabase.auth.admin.listUsers();
  for (const user of (users?.users || [])) {
    if (emails.includes(user.email)) {
      await supabase.auth.admin.deleteUser(user.id);
      console.log(`  ✓ Supprimé: ${user.email}`);
    }
  }

  console.log('✅ Nettoyage terminé\n');
}

// ─────────────────────────────────────────────
// ÉTAPE 1 — Créer les utilisateurs Auth
// ─────────────────────────────────────────────

async function createUsers() {
  console.log('👤 Création des utilisateurs...');

  const users = [
    { key: 'awa',     email: 'awa.diallo@demo.papyri.app',      name: 'Awa Diallo',          role: 'user' },
    { key: 'franck',  email: 'franck.mbeki@demo.papyri.app',    name: 'Franck Mbeki',         role: 'user' },
    { key: 'mariame', email: 'mariame.kone@demo.papyri.app',    name: 'Mariame Koné',         role: 'user' },
    { key: 'kofi',    email: 'kofi.asante@demo.papyri.app',     name: 'Kofi Asante',          role: 'user' },
    { key: 'djibril', email: 'djibril.ndiaye@demo.papyri.app',  name: 'Djibril Ndiaye',       role: 'user' },
    { key: 'sophie',  email: 'sophie.edinga@demo.papyri.app',   name: 'Sophie Edinga',        role: 'publisher' },
    { key: 'omar',    email: 'omar.benmoussa@demo.papyri.app',  name: 'Omar Ben Moussa',      role: 'publisher' },
    { key: 'chloe',   email: 'chloe.mensah@demo.papyri.app',    name: 'Chloé Adjoa Mensah',   role: 'publisher' },
  ];

  for (const u of users) {
    // Chercher si existe déjà
    const { data: existing } = await supabase.auth.admin.listUsers();
    const found = existing?.users?.find(usr => usr.email === u.email);

    if (found) {
      U[u.key] = found.id;
      console.log(`  ↩  Existant: ${u.email}`);
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: u.email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: u.name, role: u.role },
      });
      if (error) { console.error(`  ❌ ${u.email}:`, error.message); continue; }
      U[u.key] = data.user.id;
      console.log(`  ✓ Créé: ${u.email} (${data.user.id.slice(0, 8)}...)`);
    }

    // Mettre à jour le profil
    await supabase.from('profiles').upsert({
      id: U[u.key],
      full_name: u.name,
      email: u.email,
      role: u.role,
      language: 'fr',
      is_active: true,
      onboarding_completed: true,
    }, { onConflict: 'id' });
  }

  console.log(`  → ${Object.values(U).filter(Boolean).length}/8 utilisateurs prêts\n`);
}

// ─────────────────────────────────────────────
// ÉTAPE 2 — Récupérer les plans existants
// ─────────────────────────────────────────────

async function loadPlans() {
  console.log('📋 Chargement des plans...');
  const { data: plans } = await supabase.from('subscription_plans').select('id, slug').eq('is_active', true);

  for (const p of (plans || [])) {
    if (p.slug === 'personal') PLAN_PERSONAL_ID = p.id;
    else if (p.slug === 'family') PLAN_FAMILY_ID = p.id;
    else if (p.slug === 'personal-slow') PLAN_PERSONAL_SLOW_ID = p.id;
    else if (p.slug && p.slug.includes('annual')) PLAN_ANNUAL_ID = p.id;
  }

  // Fallback : utiliser le premier plan dispo si certains manquent
  if (!PLAN_ANNUAL_ID && plans?.length) PLAN_ANNUAL_ID = PLAN_PERSONAL_ID || plans[0].id;

  console.log(`  Plans: personal=${!!PLAN_PERSONAL_ID} family=${!!PLAN_FAMILY_ID} slow=${!!PLAN_PERSONAL_SLOW_ID} annual=${!!PLAN_ANNUAL_ID}\n`);
}

// ─────────────────────────────────────────────
// ÉTAPE 3 — Catégories
// ─────────────────────────────────────────────

async function createCategories() {
  console.log('🗂️  Catégories...');
  const cats = [
    { id: 'cat00001-demo-0000-0000-000000000001', name: 'Littérature africaine', slug: 'litterature-africaine', description: 'Romans, nouvelles et poésie d\'auteurs africains' },
    { id: 'cat00001-demo-0000-0000-000000000002', name: 'Roman', slug: 'roman', description: 'Fictions romanesques' },
    { id: 'cat00001-demo-0000-0000-000000000003', name: 'Essai', slug: 'essai', description: 'Essais littéraires et philosophiques' },
    { id: 'cat00001-demo-0000-0000-000000000004', name: 'Histoire & Société', slug: 'histoire-societe', description: 'Ouvrages historiques et sociaux' },
    { id: 'cat00001-demo-0000-0000-000000000005', name: 'Audiobooks', slug: 'audiobooks', description: 'Livres audio narrés par des professionnels' },
    { id: 'cat00001-demo-0000-0000-000000000006', name: 'Contes & Traditions', slug: 'contes-traditions', description: 'Patrimoine oral africain' },
    { id: 'cat00001-demo-0000-0000-000000000007', name: 'Développement personnel', slug: 'dev-perso', description: 'Croissance personnelle et bien-être' },
  ];
  await supabase.from('categories').upsert(cats, { onConflict: 'id' });
  console.log(`  ✓ ${cats.length} catégories\n`);
  return cats;
}

// ─────────────────────────────────────────────
// ÉTAPE 4 — Éditeurs (publishers)
// ─────────────────────────────────────────────

async function createPublishers() {
  console.log('🏢 Maisons d\'édition...');

  const publishers = [
    {
      id: PUB.lumiere,
      user_id: U.sophie,
      company_name: 'Éditions Lumière d\'Afrique',
      contact_name: 'Sophie Edinga',
      email: 'contact@lumiere-afrique.cm',
      description: 'Maison d\'édition camerounaise spécialisée dans la littérature africaine contemporaine. Fondée en 2018 à Douala, elle accompagne des voix émergentes du continent.',
      logo_url: 'https://placehold.co/200x200/B5651D/white?text=LA',
      website: 'https://lumiere-afrique.cm',
      status: 'active',
      revenue_grid: { threshold_cad: 5, above_threshold_cad: 5, below_threshold_cad: 2.5 },
      payout_method: { type: 'bank_transfer', bank: 'Afriland First Bank', iban: 'CM21 10005 00003 01234567890 27', swift: 'CCEICMCX', country: 'CM' },
      promo_monthly_limit: 50,
      activated_at: daysAgo(90),
    },
    {
      id: PUB.sahel,
      user_id: U.omar,
      company_name: 'Éditions du Sahel',
      contact_name: 'Omar Ben Moussa',
      email: 'editions@sahel-livres.sn',
      description: 'Premier catalogue numérique de littérature sahélienne. Basée à Dakar, nos éditions mettent en lumière les auteurs du Sénégal, Mali, Burkina Faso et Niger.',
      logo_url: 'https://placehold.co/200x200/D4A017/white?text=ES',
      website: 'https://sahel-livres.sn',
      status: 'active',
      revenue_grid: { threshold_cad: 5, above_threshold_cad: 5, below_threshold_cad: 2.5 },
      payout_method: { type: 'mobile_money', operator: 'Orange Money', phone: '+221 77 456 78 90', country: 'SN' },
      promo_monthly_limit: 30,
      activated_at: daysAgo(75),
    },
    {
      id: PUB.arcenciel,
      user_id: U.chloe,
      company_name: 'Éditions Arc-en-Ciel',
      contact_name: 'Chloé Adjoa Mensah',
      email: 'info@arcenciel-editions.ci',
      description: 'Maison d\'édition ivoirienne tournée vers l\'Afrique de l\'Ouest et la diaspora. Spécialisée dans les romans contemporains et les livres audio de qualité.',
      logo_url: 'https://placehold.co/200x200/2E4057/white?text=AEC',
      website: 'https://arcenciel-editions.ci',
      status: 'active',
      revenue_grid: { threshold_cad: 5, above_threshold_cad: 5, below_threshold_cad: 2.5 },
      payout_method: { type: 'bank_transfer', bank: 'Ecobank Côte d\'Ivoire', iban: 'CI93 CI00 9001 2345 6789 0100', swift: 'ECOBCIAB', country: 'CI' },
      promo_monthly_limit: 40,
      activated_at: daysAgo(60),
    },
  ];

  await db('publishers', publishers);
  console.log(`  ✓ ${publishers.length} éditeurs\n`);
}

// ─────────────────────────────────────────────
// ÉTAPE 5 — Contenus (13 titres)
// ─────────────────────────────────────────────

async function createContents() {
  console.log('📚 Catalogue de contenus...');

  const now = new Date().toISOString();

  const contents = [
    // ─── Lumière d'Afrique ───
    {
      id: C.etoiles, title: 'Les Étoiles de Bamako', author: 'Aminata Kouyaté',
      description: 'Seydou quitte son village du Mali pour Bamako avec un rêve : devenir musicien. Roman d\'apprentissage lumineux sur la jeunesse africaine entre tradition et modernité. Prix Littérature Africaine 2025.',
      content_type: 'ebook', format: 'epub', language: 'fr',
      cover_url: 'https://placehold.co/300x450/B5651D/white?text=Etoiles',
      file_key: 'demo/ebooks/etoiles-bamako.epub', file_size_bytes: 1842000,
      publisher_id: PUB.lumiere, is_published: true, published_at: daysAgo(60),
    },
    {
      id: C.chroniques, title: 'Chroniques du Fleuve Congo', author: 'Emmanuel Ngoma',
      description: 'Vingt nouvelles qui traversent cent ans d\'histoire congolaise à travers les yeux d\'habitants ordinaires du bord du fleuve. Une fresque humaine intime et puissante.',
      content_type: 'ebook', format: 'epub', language: 'fr',
      cover_url: 'https://placehold.co/300x450/2E4057/white?text=Fleuve',
      file_key: 'demo/ebooks/chroniques-congo.epub', file_size_bytes: 2130000,
      publisher_id: PUB.lumiere, is_published: true, published_at: daysAgo(50),
    },
    {
      id: C.voie_griot, title: 'La Voie du Griot', author: 'Ibrahima Sow',
      description: 'Essai anthropologique sur le rôle des griots dans les sociétés mandingues contemporaines. Comment la tradition orale survit et se réinvente à l\'ère numérique.',
      content_type: 'ebook', format: 'epub', language: 'fr',
      cover_url: 'https://placehold.co/300x450/D4A017/white?text=Griot',
      file_key: 'demo/ebooks/voie-griot.epub', file_size_bytes: 1560000,
      publisher_id: PUB.lumiere, is_published: true, published_at: daysAgo(45),
    },
    {
      id: C.aube, title: 'L\'Aube des Savanes', author: 'Aminata Kouyaté',
      description: 'Version audio du roman primé d\'Aminata Kouyaté, narré par la comédienne Aïsha Dramé. Une odyssée à travers les savanes du Sahel racontée avec une voix envoûtante.',
      content_type: 'audiobook', format: 'mp3', language: 'fr',
      cover_url: 'https://placehold.co/300x450/8B4513/white?text=Aube',
      file_key: 'demo/audio/aube-savanes.mp3', file_size_bytes: 312400000,
      duration_seconds: 19800, // 5h30
      publisher_id: PUB.lumiere, is_published: true, published_at: daysAgo(40),
    },
    {
      id: C.sagesses, title: 'Sagesses d\'Afrique — Coffret', author: 'Emmanuel Ngoma',
      description: 'Collection de proverbes et récits philosophiques d\'Afrique subsaharienne, narrés par l\'auteur lui-même. Disponible en 3 volumes réunis dans ce coffret audio exclusif.',
      content_type: 'audiobook', format: 'mp3', language: 'fr',
      cover_url: 'https://placehold.co/300x450/556B2F/white?text=Sagesses',
      file_key: 'demo/audio/sagesses-afrique.mp3', file_size_bytes: 198000000,
      duration_seconds: 13200, // 3h40
      publisher_id: PUB.lumiere, is_published: true, published_at: daysAgo(35),
    },

    // ─── Éditions du Sahel ───
    {
      id: C.desert, title: 'Désert de Sel et d\'Étoiles', author: 'Fatima Ag Albochar',
      description: 'Née dans un campement touareg au nord du Mali, Amina part à pied rejoindre sa sœur à Gao. Un roman de survie et de sororité au cœur du désert. Finaliste du Grand Prix de Littérature 2025.',
      content_type: 'ebook', format: 'epub', language: 'fr',
      cover_url: 'https://placehold.co/300x450/C19A6B/white?text=Desert',
      file_key: 'demo/ebooks/desert-sel-etoiles.epub', file_size_bytes: 1740000,
      publisher_id: PUB.sahel, is_published: true, published_at: daysAgo(55),
    },
    {
      id: C.marabout, title: 'Le Marabout de Ouagadougou', author: 'Souleymane Ouédraogo',
      description: 'Comédie sociale piquante sur un marabout numérique qui consulte ses clients via WhatsApp. Satire tendre et mordante de la modernisation des croyances en Afrique de l\'Ouest.',
      content_type: 'ebook', format: 'epub', language: 'fr',
      cover_url: 'https://placehold.co/300x450/D4A017/white?text=Marabout',
      file_key: 'demo/ebooks/marabout-ouaga.epub', file_size_bytes: 1380000,
      publisher_id: PUB.sahel, is_published: true, published_at: daysAgo(48),
    },
    {
      id: C.nuits_dakar, title: 'Les Nuits de Dakar', author: 'Cheikh Pathé Diallo',
      description: 'Thriller nocturne dans le Dakar contemporain. Un journaliste enquête sur les disparitions d\'enfants des Parcelles Assainies. Narration tendue, ambiances urbaines saisissantes.',
      content_type: 'audiobook', format: 'mp3', language: 'fr',
      cover_url: 'https://placehold.co/300x450/1C2951/white?text=Nuits',
      file_key: 'demo/audio/nuits-dakar.mp3', file_size_bytes: 287000000,
      duration_seconds: 18000, // 5h
      publisher_id: PUB.sahel, is_published: true, published_at: daysAgo(42),
    },
    {
      id: C.contes, title: 'Contes du Sahel', author: 'Mariam Touré',
      description: 'Vingt contes traditionnels du Sahel — Niger, Mali, Sénégal — recueillis sur le terrain et adaptés pour la narration audio. Une passerelle entre patrimoine oral et ère numérique.',
      content_type: 'audiobook', format: 'mp3', language: 'fr',
      cover_url: 'https://placehold.co/300x450/A0522D/white?text=Contes',
      file_key: 'demo/audio/contes-sahel.mp3', file_size_bytes: 156000000,
      duration_seconds: 9600, // 2h40
      publisher_id: PUB.sahel, is_published: true, published_at: daysAgo(38),
    },

    // ─── Arc-en-Ciel ───
    {
      id: C.abidjan, title: 'Abidjan, Mon Amour', author: 'Adaeze Okonkwo',
      description: 'Portrait romanesque d\'Abidjan à travers quatre décennies — des années faste du "Miracle ivoirien" aux crises et à la renaissance. Quatre femmes, quatre générations, une ville.',
      content_type: 'ebook', format: 'epub', language: 'fr',
      cover_url: 'https://placehold.co/300x450/FF6B35/white?text=Abidjan',
      file_key: 'demo/ebooks/abidjan-mon-amour.epub', file_size_bytes: 2250000,
      publisher_id: PUB.arcenciel, is_published: true, published_at: daysAgo(52),
    },
    {
      id: C.danseuse, title: 'La Danseuse de Lagos', author: 'Ngozi Chukwu',
      description: 'Kemi, danseuse classique formée à Paris, rentre à Lagos pour s\'occuper de sa mère malade. Entre deux mondes, elle doit choisir entre son art et ses racines. Roman bouleversant.',
      content_type: 'ebook', format: 'epub', language: 'fr',
      cover_url: 'https://placehold.co/300x450/9B59B6/white?text=Danseuse',
      file_key: 'demo/ebooks/danseuse-lagos.epub', file_size_bytes: 1920000,
      publisher_id: PUB.arcenciel, is_published: true, published_at: daysAgo(44),
    },
    {
      id: C.rythmes, title: 'Rythmes d\'Afrique', author: 'Kofi Boateng',
      description: 'Voyage sonore et littéraire à travers les musiques du continent : Afrobeats, Mbalax, Coupé-Décalé, Gnawa... L\'auteur et musicien raconte l\'histoire et la philosophie de chaque rythme.',
      content_type: 'audiobook', format: 'mp3', language: 'fr',
      cover_url: 'https://placehold.co/300x450/E74C3C/white?text=Rythmes',
      file_key: 'demo/audio/rythmes-afrique.mp3', file_size_bytes: 234000000,
      duration_seconds: 14400, // 4h
      publisher_id: PUB.arcenciel, is_published: true, published_at: daysAgo(36),
    },
    {
      id: C.baobab, title: 'Baobab Blues', author: 'Amara Konaté',
      description: 'Roman d\'amour et de jazz dans le Bamako des années 1970. Récit nostalgique de l\'époque où les musiciens maliens inventaient un son nouveau au carrefour de l\'Afrique et de l\'Amérique.',
      content_type: 'audiobook', format: 'mp3', language: 'fr',
      cover_url: 'https://placehold.co/300x450/2C3E50/white?text=Baobab',
      file_key: 'demo/audio/baobab-blues.mp3', file_size_bytes: 268000000,
      duration_seconds: 16200, // 4h30
      publisher_id: PUB.arcenciel, is_published: true, published_at: daysAgo(28),
    },
  ];

  await db('contents', contents);
  console.log(`  ✓ ${contents.length} contenus\n`);
  return contents;
}

// ─────────────────────────────────────────────
// ÉTAPE 6 — Liaisons contenu ↔ catégories
// ─────────────────────────────────────────────

async function linkContentCategories() {
  console.log('🔗 Liaisons contenus ↔ catégories...');

  const LIT = 'cat00001-demo-0000-0000-000000000001';
  const ROM = 'cat00001-demo-0000-0000-000000000002';
  const ESS = 'cat00001-demo-0000-0000-000000000003';
  const AUD = 'cat00001-demo-0000-0000-000000000005';
  const CON = 'cat00001-demo-0000-0000-000000000006';

  const links = [
    { content_id: C.etoiles,    category_id: LIT }, { content_id: C.etoiles,    category_id: ROM },
    { content_id: C.chroniques, category_id: LIT },
    { content_id: C.voie_griot, category_id: ESS }, { content_id: C.voie_griot, category_id: CON },
    { content_id: C.aube,       category_id: LIT }, { content_id: C.aube,       category_id: AUD },
    { content_id: C.sagesses,   category_id: CON }, { content_id: C.sagesses,   category_id: AUD },
    { content_id: C.desert,     category_id: LIT }, { content_id: C.desert,     category_id: ROM },
    { content_id: C.marabout,   category_id: LIT }, { content_id: C.marabout,   category_id: ROM },
    { content_id: C.nuits_dakar,category_id: LIT }, { content_id: C.nuits_dakar,category_id: AUD },
    { content_id: C.contes,     category_id: CON }, { content_id: C.contes,     category_id: AUD },
    { content_id: C.abidjan,    category_id: LIT }, { content_id: C.abidjan,    category_id: ROM },
    { content_id: C.danseuse,   category_id: LIT }, { content_id: C.danseuse,   category_id: ROM },
    { content_id: C.rythmes,    category_id: AUD },
    { content_id: C.baobab,     category_id: LIT }, { content_id: C.baobab,     category_id: AUD },
  ];

  await supabase.from('content_categories').upsert(links, { onConflict: 'content_id,category_id', ignoreDuplicates: true });
  console.log(`  ✓ ${links.length} liaisons\n`);
}

// ─────────────────────────────────────────────
// ÉTAPE 7 — Publisher books (livres validés)
// ─────────────────────────────────────────────

async function createPublisherBooks() {
  console.log('📖 Validation des livres éditeurs...');

  const adminId = U.sophie; // placeholder — on utilise le premier user dispo
  const approved = [daysAgo(58), daysAgo(48), daysAgo(43), daysAgo(38), daysAgo(33)];
  const lumiereContents = [C.etoiles, C.chroniques, C.voie_griot, C.aube, C.sagesses];
  const sahelContents   = [C.desert, C.marabout, C.nuits_dakar, C.contes];
  const arcContents     = [C.abidjan, C.danseuse, C.rythmes, C.baobab];

  const books = [
    ...lumiereContents.map((cid, i) => ({
      id: `pb00001-demo-0000-000${i + 1}-${PUB.lumiere.slice(-12)}`,
      publisher_id: PUB.lumiere, content_id: cid,
      validation_status: 'approved', submitted_at: daysAgo(60 - i * 5),
      reviewed_at: approved[i] || daysAgo(30), reviewed_by: adminId,
    })),
    ...sahelContents.map((cid, i) => ({
      id: `pb00002-demo-0000-000${i + 1}-${PUB.sahel.slice(-12)}`,
      publisher_id: PUB.sahel, content_id: cid,
      validation_status: 'approved', submitted_at: daysAgo(57 - i * 5),
      reviewed_at: daysAgo(55 - i * 5), reviewed_by: adminId,
    })),
    ...arcContents.map((cid, i) => ({
      id: `pb00003-demo-0000-000${i + 1}-${PUB.arcenciel.slice(-12)}`,
      publisher_id: PUB.arcenciel, content_id: cid,
      validation_status: i === 3 ? 'pending' : 'approved',
      submitted_at: daysAgo(54 - i * 5),
      reviewed_at: i < 3 ? daysAgo(52 - i * 5) : null, reviewed_by: i < 3 ? adminId : null,
    })),
  ];

  // UUIDs doivent être valides
  const validBooks = books.map((b, i) => ({
    ...b,
    id: `bb0000${i + 1}0-demo-0000-0000-000000000001`.slice(0, 36).padEnd(36, '0'),
  }));

  await db('publisher_books', validBooks);
  console.log(`  ✓ ${validBooks.length} livres (${validBooks.filter(b => b.validation_status === 'approved').length} approuvés, ${validBooks.filter(b => b.validation_status === 'pending').length} en attente)\n`);
}

// ─────────────────────────────────────────────
// ÉTAPE 8 — Abonnements actifs + paiements
// ─────────────────────────────────────────────

async function createSubscriptions() {
  console.log('💳 Abonnements & paiements...');

  if (!PLAN_PERSONAL_ID) {
    console.log('  ⚠️  Plans non trouvés, skip abonnements\n');
    return;
  }

  const subs = [
    {
      id: 'sub00001-demo-0000-0000-000000000001',
      user_id: U.awa, plan_id: PLAN_PERSONAL_ID, plan_type: 'monthly',
      amount: 9.90, currency: 'USD', status: 'ACTIVE', users_limit: 1,
      current_period_start: daysAgo(25), current_period_end: new Date(Date.now() + 5 * 86400000).toISOString(),
      provider: 'flutterwave',
      plan_snapshot: { name: 'Personnel', slug: 'personal' },
    },
    {
      id: 'sub00001-demo-0000-0000-000000000002',
      user_id: U.franck, plan_id: PLAN_FAMILY_ID || PLAN_PERSONAL_ID, plan_type: 'monthly',
      amount: 19.99, currency: 'USD', status: 'ACTIVE', users_limit: 3,
      current_period_start: daysAgo(18), current_period_end: new Date(Date.now() + 12 * 86400000).toISOString(),
      provider: 'stripe',
      plan_snapshot: { name: 'Famille', slug: 'family' },
    },
    {
      id: 'sub00001-demo-0000-0000-000000000003',
      user_id: U.mariame, plan_id: PLAN_PERSONAL_ID, plan_type: 'monthly',
      amount: 9.90, currency: 'USD', status: 'ACTIVE', users_limit: 1,
      current_period_start: daysAgo(10), current_period_end: new Date(Date.now() + 20 * 86400000).toISOString(),
      provider: 'flutterwave',
      plan_snapshot: { name: 'Personnel', slug: 'personal' },
    },
    {
      id: 'sub00001-demo-0000-0000-000000000004',
      user_id: U.kofi, plan_id: PLAN_PERSONAL_SLOW_ID || PLAN_PERSONAL_ID, plan_type: 'monthly',
      amount: 4.50, currency: 'USD', status: 'ACTIVE', users_limit: 1,
      current_period_start: daysAgo(8), current_period_end: new Date(Date.now() + 22 * 86400000).toISOString(),
      provider: 'flutterwave',
      plan_snapshot: { name: 'Personnel Slow', slug: 'personal-slow' },
    },
    {
      id: 'sub00001-demo-0000-0000-000000000005',
      user_id: U.djibril, plan_id: PLAN_ANNUAL_ID || PLAN_PERSONAL_ID, plan_type: 'yearly',
      amount: 99.00, currency: 'USD', status: 'ACTIVE', users_limit: 1,
      current_period_start: daysAgo(45), current_period_end: new Date(Date.now() + 320 * 86400000).toISOString(),
      provider: 'stripe',
      plan_snapshot: { name: 'Annuel', slug: 'annual' },
    },
  ];

  await db('subscriptions', subs);

  // Paiements (3 mois d'historique pour Awa, 2 pour les autres)
  const payments = [];
  const addPayment = (id, userId, subId, amount, provider, daysAgoN, method) => {
    payments.push({
      id, user_id: userId, subscription_id: subId,
      amount, currency: 'USD', status: 'succeeded',
      provider, payment_method: method,
      provider_payment_id: `demo_${id.slice(-8)}`,
      paid_at: daysAgo(daysAgoN),
      metadata: { demo: true },
    });
  };

  addPayment('pay00001-demo-0000-0000-000000000001', U.awa,     subs[0].id, 9.90,  'flutterwave', 85,  'mobile_money');
  addPayment('pay00001-demo-0000-0000-000000000002', U.awa,     subs[0].id, 9.90,  'flutterwave', 55,  'mobile_money');
  addPayment('pay00001-demo-0000-0000-000000000003', U.awa,     subs[0].id, 9.90,  'flutterwave', 25,  'mobile_money');
  addPayment('pay00001-demo-0000-0000-000000000004', U.franck,  subs[1].id, 19.99, 'stripe',      78,  'card');
  addPayment('pay00001-demo-0000-0000-000000000005', U.franck,  subs[1].id, 19.99, 'stripe',      48,  'card');
  addPayment('pay00001-demo-0000-0000-000000000006', U.franck,  subs[1].id, 19.99, 'stripe',      18,  'card');
  addPayment('pay00001-demo-0000-0000-000000000007', U.mariame, subs[2].id, 9.90,  'flutterwave', 70,  'mobile_money');
  addPayment('pay00001-demo-0000-0000-000000000008', U.mariame, subs[2].id, 9.90,  'flutterwave', 40,  'mobile_money');
  addPayment('pay00001-demo-0000-0000-000000000009', U.mariame, subs[2].id, 9.90,  'flutterwave', 10,  'mobile_money');
  addPayment('pay00001-demo-0000-0000-000000000010', U.kofi,    subs[3].id, 4.50,  'flutterwave', 68,  'mobile_money');
  addPayment('pay00001-demo-0000-0000-000000000011', U.kofi,    subs[3].id, 4.50,  'flutterwave', 38,  'mobile_money');
  addPayment('pay00001-demo-0000-0000-000000000012', U.kofi,    subs[3].id, 4.50,  'flutterwave', 8,   'mobile_money');
  addPayment('pay00001-demo-0000-0000-000000000013', U.djibril, subs[4].id, 99.00, 'stripe',      45,  'card');

  await db('payments', payments);
  console.log(`  ✓ ${subs.length} abonnements actifs + ${payments.length} paiements\n`);
}

// ─────────────────────────────────────────────
// ÉTAPE 9 — Historique de lecture
// ─────────────────────────────────────────────

async function createReadingHistory() {
  console.log('📖 Historique de lecture...');

  const history = [
    // Awa — grande lectrice
    { id: 'rh000001-demo-0000-0000-000000000001', user_id: U.awa, content_id: C.etoiles,    progress_percent: 100, is_completed: true,  total_time_seconds: 18000, last_read_at: daysAgo(2),  last_position: { chapter: 'epilogue', cfi: '/4/2/300' } },
    { id: 'rh000001-demo-0000-0000-000000000002', user_id: U.awa, content_id: C.aube,       progress_percent: 67,  is_completed: false, total_time_seconds: 13260, last_read_at: daysAgo(1),  last_position: { position_seconds: 13260 } },
    { id: 'rh000001-demo-0000-0000-000000000003', user_id: U.awa, content_id: C.desert,     progress_percent: 34,  is_completed: false, total_time_seconds: 6200,  last_read_at: daysAgo(4),  last_position: { chapter: 'ch5', cfi: '/4/2/120' } },
    { id: 'rh000001-demo-0000-0000-000000000004', user_id: U.awa, content_id: C.nuits_dakar,progress_percent: 100, is_completed: true,  total_time_seconds: 18000, last_read_at: daysAgo(7),  last_position: { position_seconds: 18000 } },
    { id: 'rh000001-demo-0000-0000-000000000005', user_id: U.awa, content_id: C.abidjan,    progress_percent: 15,  is_completed: false, total_time_seconds: 2400,  last_read_at: daysAgo(9),  last_position: { chapter: 'ch2', cfi: '/4/2/40' } },

    // Franck — amateur d'audio
    { id: 'rh000001-demo-0000-0000-000000000006', user_id: U.franck, content_id: C.sagesses,   progress_percent: 100, is_completed: true,  total_time_seconds: 13200, last_read_at: daysAgo(3),  last_position: { position_seconds: 13200 } },
    { id: 'rh000001-demo-0000-0000-000000000007', user_id: U.franck, content_id: C.rythmes,    progress_percent: 82,  is_completed: false, total_time_seconds: 11800, last_read_at: daysAgo(1),  last_position: { position_seconds: 11800 } },
    { id: 'rh000001-demo-0000-0000-000000000008', user_id: U.franck, content_id: C.baobab,     progress_percent: 100, is_completed: true,  total_time_seconds: 16200, last_read_at: daysAgo(5),  last_position: { position_seconds: 16200 } },
    { id: 'rh000001-demo-0000-0000-000000000009', user_id: U.franck, content_id: C.chroniques, progress_percent: 58,  is_completed: false, total_time_seconds: 7200,  last_read_at: daysAgo(6),  last_position: { chapter: 'ch8', cfi: '/4/2/180' } },

    // Mariame — lectrice régulière
    { id: 'rh000001-demo-0000-0000-000000000010', user_id: U.mariame, content_id: C.marabout,   progress_percent: 100, is_completed: true,  total_time_seconds: 10800, last_read_at: daysAgo(2),  last_position: { chapter: 'fin', cfi: '/4/2/250' } },
    { id: 'rh000001-demo-0000-0000-000000000011', user_id: U.mariame, content_id: C.voie_griot, progress_percent: 45,  is_completed: false, total_time_seconds: 4500,  last_read_at: daysAgo(3),  last_position: { chapter: 'ch4', cfi: '/4/2/90' } },
    { id: 'rh000001-demo-0000-0000-000000000012', user_id: U.mariame, content_id: C.contes,     progress_percent: 100, is_completed: true,  total_time_seconds: 9600,  last_read_at: daysAgo(8),  last_position: { position_seconds: 9600 } },
    { id: 'rh000001-demo-0000-0000-000000000013', user_id: U.mariame, content_id: C.danseuse,   progress_percent: 23,  is_completed: false, total_time_seconds: 3200,  last_read_at: daysAgo(1),  last_position: { chapter: 'ch3', cfi: '/4/2/60' } },

    // Kofi
    { id: 'rh000001-demo-0000-0000-000000000014', user_id: U.kofi, content_id: C.etoiles,    progress_percent: 78,  is_completed: false, total_time_seconds: 14000, last_read_at: daysAgo(2),  last_position: { chapter: 'ch12', cfi: '/4/2/220' } },
    { id: 'rh000001-demo-0000-0000-000000000015', user_id: U.kofi, content_id: C.aube,       progress_percent: 100, is_completed: true,  total_time_seconds: 19800, last_read_at: daysAgo(10), last_position: { position_seconds: 19800 } },

    // Djibril — abonné annuel, gros lecteur
    { id: 'rh000001-demo-0000-0000-000000000016', user_id: U.djibril, content_id: C.chroniques, progress_percent: 100, is_completed: true,  total_time_seconds: 21600, last_read_at: daysAgo(3),  last_position: { chapter: 'epilogue', cfi: '/4/2/400' } },
    { id: 'rh000001-demo-0000-0000-000000000017', user_id: U.djibril, content_id: C.desert,     progress_percent: 100, is_completed: true,  total_time_seconds: 16200, last_read_at: daysAgo(6),  last_position: { chapter: 'fin', cfi: '/4/2/310' } },
    { id: 'rh000001-demo-0000-0000-000000000018', user_id: U.djibril, content_id: C.nuits_dakar,progress_percent: 55,  is_completed: false, total_time_seconds: 9900,  last_read_at: daysAgo(1),  last_position: { position_seconds: 9900 } },
    { id: 'rh000001-demo-0000-0000-000000000019', user_id: U.djibril, content_id: C.baobab,     progress_percent: 91,  is_completed: false, total_time_seconds: 14760, last_read_at: daysAgo(2),  last_position: { position_seconds: 14760 } },
    { id: 'rh000001-demo-0000-0000-000000000020', user_id: U.djibril, content_id: C.abidjan,    progress_percent: 100, is_completed: true,  total_time_seconds: 22000, last_read_at: daysAgo(12), last_position: { chapter: 'fin', cfi: '/4/2/420' } },
  ];

  await supabase.from('reading_history').upsert(history, { onConflict: 'id' });
  console.log(`  ✓ ${history.length} entrées d'historique\n`);
}

// ─────────────────────────────────────────────
// ÉTAPE 10 — Signets & surlignages
// ─────────────────────────────────────────────

async function createBookmarksAndHighlights() {
  console.log('🔖 Signets & surlignages...');

  const bookmarks = [
    { id: 'bk000001-demo-0000-0000-000000000001', user_id: U.awa,     content_id: C.aube,    position: { cfi: '/4/2/80',  percent: 40, chapter_label: 'Chapitre 6' },  label: 'Passage clé — le départ de Seydou' },
    { id: 'bk000001-demo-0000-0000-000000000002', user_id: U.awa,     content_id: C.desert,  position: { cfi: '/4/2/45',  percent: 22, chapter_label: 'Chapitre 3' },  label: 'La rencontre avec la caravane' },
    { id: 'bk000001-demo-0000-0000-000000000003', user_id: U.mariame, content_id: C.danseuse, position: { cfi: '/4/2/30', percent: 14, chapter_label: 'Chapitre 2' },  label: 'La lettre de sa mère' },
    { id: 'bk000001-demo-0000-0000-000000000004', user_id: U.djibril, content_id: C.baobab,  position: { cfi: '/4/2/190', percent: 88, chapter_label: 'Chapitre 14' }, label: 'Le solo de trompette' },
    { id: 'bk000001-demo-0000-0000-000000000005', user_id: U.kofi,    content_id: C.etoiles, position: { cfi: '/4/2/160', percent: 72, chapter_label: 'Chapitre 10' }, label: 'Révélation sur le père' },
  ];

  const highlights = [
    {
      id: 'hl000001-demo-0000-0000-000000000001', user_id: U.awa, content_id: C.etoiles,
      text: 'L\'Afrique n\'a pas besoin qu\'on lui apprenne à rêver. Elle a seulement besoin qu\'on la laisse choisir ses propres rêves.',
      cfi_range: '/4/2/50,/4/2/52', position: { start_cfi: '/4/2/50', end_cfi: '/4/2/52', chapter: 'ch7' },
      color: 'yellow', note: 'Citation à retenir pour la présentation.',
    },
    {
      id: 'hl000001-demo-0000-0000-000000000002', user_id: U.djibril, content_id: C.chroniques,
      text: 'Le fleuve Congo n\'a pas de rive gauche ou droite. Il a deux histoires qui coulent dans le même sens sans jamais se toucher.',
      cfi_range: '/4/2/20,/4/2/22', position: { start_cfi: '/4/2/20', end_cfi: '/4/2/22', chapter: 'ch2' },
      color: 'blue', note: null,
    },
    {
      id: 'hl000001-demo-0000-0000-000000000003', user_id: U.mariame, content_id: C.marabout,
      text: 'Même les djinns ont un profil WhatsApp maintenant. Le monde a changé, mais les hommes cherchent toujours les mêmes réponses.',
      cfi_range: '/4/2/70,/4/2/72', position: { start_cfi: '/4/2/70', end_cfi: '/4/2/72', chapter: 'ch9' },
      color: 'orange', note: 'Trop drôle !',
    },
    {
      id: 'hl000001-demo-0000-0000-000000000004', user_id: U.franck, content_id: C.chroniques,
      text: 'Écrire sur l\'Afrique sans y vivre, c\'est peindre la mer sans jamais avoir senti le sel sur sa peau.',
      cfi_range: '/4/2/35,/4/2/37', position: { start_cfi: '/4/2/35', end_cfi: '/4/2/37', chapter: 'ch4' },
      color: 'green', note: null,
    },
  ];

  await supabase.from('bookmarks').upsert(bookmarks, { onConflict: 'id' });
  await supabase.from('highlights').upsert(highlights, { onConflict: 'id' });
  console.log(`  ✓ ${bookmarks.length} signets + ${highlights.length} surlignages\n`);
}

// ─────────────────────────────────────────────
// ÉTAPE 11 — Avis lecteurs
// ─────────────────────────────────────────────

async function createReviews() {
  console.log('⭐ Avis lecteurs...');

  const reviews = [
    { id: 'rv000001-demo-0000-0000-000000000001', content_id: C.etoiles,    user_id: U.awa,     rating: 5, body: 'Un roman magnifique qui m\'a tenue en haleine du début à la fin. Aminata Kouyaté a un talent rare pour capturer l\'âme de Bamako. À lire absolument !' },
    { id: 'rv000001-demo-0000-0000-000000000002', content_id: C.etoiles,    user_id: U.djibril,  rating: 4, body: 'Très beau roman, quelques longueurs dans la deuxième partie mais l\'écriture est superbe. Le personnage de Seydou est attachant.' },
    { id: 'rv000001-demo-0000-0000-000000000003', content_id: C.chroniques, user_id: U.franck,   rating: 5, body: 'Emmanuel Ngoma est un conteur hors pair. Ces nouvelles m\'ont appris plus sur le Congo que dix années de documentaires.' },
    { id: 'rv000001-demo-0000-0000-000000000004', content_id: C.chroniques, user_id: U.djibril,  rating: 5, body: 'Extraordinaire. La diversité des voix, des époques, des registres — tout est maîtrisé. Un chef-d\'œuvre du court récit.' },
    { id: 'rv000001-demo-0000-0000-000000000005', content_id: C.marabout,   user_id: U.mariame,  rating: 5, body: 'Hilarant et émouvant à la fois ! Ouédraogo réussit à se moquer avec tendresse des croyances tout en les respectant. Bravo !' },
    { id: 'rv000001-demo-0000-0000-000000000006', content_id: C.desert,     user_id: U.awa,      rating: 4, body: 'Fatima Ag Albochar décrit le désert avec une précision sensorielle troublante. Certaines scènes sont d\'une beauté à couper le souffle.' },
    { id: 'rv000001-demo-0000-0000-000000000007', content_id: C.desert,     user_id: U.djibril,  rating: 5, body: 'Le meilleur roman sur le Sahel que j\'ai lu depuis des années. La fin m\'a bouleversé. Finaliste du Grand Prix pour une raison !' },
    { id: 'rv000001-demo-0000-0000-000000000008', content_id: C.aube,       user_id: U.kofi,     rating: 5, body: 'La voix d\'Aïsha Dramé est envoûtante. J\'ai écouté ce livre en deux jours pendant mes trajets. Impossible de m\'arrêter.' },
    { id: 'rv000001-demo-0000-0000-000000000009', content_id: C.nuits_dakar,user_id: U.awa,      rating: 4, body: 'Thriller haletant ! L\'atmosphère nocturne de Dakar est parfaitement rendue. Le twist final est vraiment surprenant.' },
    { id: 'rv000001-demo-0000-0000-000000000010', content_id: C.baobab,     user_id: U.franck,   rating: 5, body: 'Ce livre m\'a appris à aimer le jazz africain. La narration audio est impeccable — on entend presque la musique entre les mots.' },
    { id: 'rv000001-demo-0000-0000-000000000011', content_id: C.abidjan,    user_id: U.djibril,  rating: 5, body: 'Abidjan comme je la connais et comme je ne la connais pas. Quatre vies, quatre époques, un seul amour pour cette ville folle.' },
    { id: 'rv000001-demo-0000-0000-000000000012', content_id: C.sagesses,   user_id: U.franck,   rating: 4, body: 'Beau coffret, la voix de l\'auteur ajoute une dimension unique. Certains proverbes sont d\'une profondeur étonnante.' },
  ];

  await supabase.from('content_reviews').upsert(reviews, { onConflict: 'id' });
  console.log(`  ✓ ${reviews.length} avis (moy. ${(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)}/5)\n`);
}

// ─────────────────────────────────────────────
// ÉTAPE 12 — Revenus éditeurs (3 mois)
// ─────────────────────────────────────────────

async function createPublisherRevenue() {
  console.log('💰 Revenus éditeurs...');

  const revenues = [];
  let idx = 1;

  const addRevenue = (pubId, contentId, paymentId, bookPrice, pubAmount, monthsAgo) => {
    revenues.push({
      id: `re0000${String(idx).padStart(2, '0')}-demo-0000-0000-000000000001`.slice(0, 36),
      publisher_id: pubId, content_id: contentId,
      payment_id: paymentId, sale_type: 'normal',
      book_price_cad: bookPrice, publisher_amount_cad: pubAmount,
      period_month: monthStart(monthsAgo),
    });
    idx++;
  };

  // Mois -3 (il y a 3 mois)
  addRevenue(PUB.lumiere,   C.etoiles,    'pay00001-demo-0000-0000-000000000001', 12.99, 5.00, 3);
  addRevenue(PUB.lumiere,   C.aube,       'pay00001-demo-0000-0000-000000000004', 14.99, 5.00, 3);
  addRevenue(PUB.lumiere,   C.chroniques, 'pay00001-demo-0000-0000-000000000007', 11.99, 5.00, 3);
  addRevenue(PUB.sahel,     C.desert,     'pay00001-demo-0000-0000-000000000010', 13.99, 5.00, 3);
  addRevenue(PUB.sahel,     C.nuits_dakar,'pay00001-demo-0000-0000-000000000001', 12.49, 5.00, 3);
  addRevenue(PUB.arcenciel, C.abidjan,    'pay00001-demo-0000-0000-000000000004', 13.49, 5.00, 3);
  addRevenue(PUB.arcenciel, C.baobab,     'pay00001-demo-0000-0000-000000000007', 12.99, 5.00, 3);

  // Mois -2 (il y a 2 mois)
  addRevenue(PUB.lumiere,   C.etoiles,    'pay00001-demo-0000-0000-000000000002', 12.99, 5.00, 2);
  addRevenue(PUB.lumiere,   C.sagesses,   'pay00001-demo-0000-0000-000000000005', 11.99, 5.00, 2);
  addRevenue(PUB.lumiere,   C.aube,       'pay00001-demo-0000-0000-000000000005', 14.99, 5.00, 2);
  addRevenue(PUB.lumiere,   C.voie_griot, 'pay00001-demo-0000-0000-000000000008', 10.99, 5.00, 2);
  addRevenue(PUB.sahel,     C.desert,     'pay00001-demo-0000-0000-000000000002', 13.99, 5.00, 2);
  addRevenue(PUB.sahel,     C.marabout,   'pay00001-demo-0000-0000-000000000008', 11.49, 5.00, 2);
  addRevenue(PUB.sahel,     C.contes,     'pay00001-demo-0000-0000-000000000011', 9.99,  2.50, 2);
  addRevenue(PUB.arcenciel, C.abidjan,    'pay00001-demo-0000-0000-000000000002', 13.49, 5.00, 2);
  addRevenue(PUB.arcenciel, C.danseuse,   'pay00001-demo-0000-0000-000000000005', 12.99, 5.00, 2);
  addRevenue(PUB.arcenciel, C.rythmes,    'pay00001-demo-0000-0000-000000000011', 13.99, 5.00, 2);

  // Mois -1 (mois dernier)
  addRevenue(PUB.lumiere,   C.etoiles,    'pay00001-demo-0000-0000-000000000003', 12.99, 5.00, 1);
  addRevenue(PUB.lumiere,   C.aube,       'pay00001-demo-0000-0000-000000000006', 14.99, 5.00, 1);
  addRevenue(PUB.lumiere,   C.sagesses,   'pay00001-demo-0000-0000-000000000006', 11.99, 5.00, 1);
  addRevenue(PUB.lumiere,   C.chroniques, 'pay00001-demo-0000-0000-000000000009', 11.99, 5.00, 1);
  addRevenue(PUB.lumiere,   C.voie_griot, 'pay00001-demo-0000-0000-000000000009', 10.99, 5.00, 1);
  addRevenue(PUB.sahel,     C.desert,     'pay00001-demo-0000-0000-000000000003', 13.99, 5.00, 1);
  addRevenue(PUB.sahel,     C.nuits_dakar,'pay00001-demo-0000-0000-000000000003', 12.49, 5.00, 1);
  addRevenue(PUB.sahel,     C.marabout,   'pay00001-demo-0000-0000-000000000006', 11.49, 5.00, 1);
  addRevenue(PUB.sahel,     C.contes,     'pay00001-demo-0000-0000-000000000012', 9.99,  2.50, 1);
  addRevenue(PUB.arcenciel, C.abidjan,    'pay00001-demo-0000-0000-000000000003', 13.49, 5.00, 1);
  addRevenue(PUB.arcenciel, C.baobab,     'pay00001-demo-0000-0000-000000000006', 12.99, 5.00, 1);
  addRevenue(PUB.arcenciel, C.danseuse,   'pay00001-demo-0000-0000-000000000009', 12.99, 5.00, 1);
  addRevenue(PUB.arcenciel, C.rythmes,    'pay00001-demo-0000-0000-000000000012', 13.99, 5.00, 1);

  await db('publisher_revenue', revenues);
  const totalLumiere   = revenues.filter(r => r.publisher_id === PUB.lumiere).reduce((s, r) => s + r.publisher_amount_cad, 0);
  const totalSahel     = revenues.filter(r => r.publisher_id === PUB.sahel).reduce((s, r) => s + r.publisher_amount_cad, 0);
  const totalArcenciel = revenues.filter(r => r.publisher_id === PUB.arcenciel).reduce((s, r) => s + r.publisher_amount_cad, 0);

  console.log(`  ✓ ${revenues.length} lignes de revenus`);
  console.log(`     Lumière: ${totalLumiere.toFixed(2)} CAD | Sahel: ${totalSahel.toFixed(2)} CAD | Arc-en-Ciel: ${totalArcenciel.toFixed(2)} CAD\n`);
}

// ─────────────────────────────────────────────
// ÉTAPE 13 — Versements éditeurs
// ─────────────────────────────────────────────

async function createPayouts() {
  console.log('🏦 Versements éditeurs...');

  const payouts = [
    // Lumière d'Afrique — 2 versements payés + 1 à venir
    {
      id: 'po000001-demo-0000-0000-000000000001',
      publisher_id: PUB.lumiere, amount_cad: 45.00,
      period_start: monthStart(3), period_end: monthStart(2),
      status: 'paid', reference: 'VRS-20260201-LUM-001',
      payout_method: { type: 'bank_transfer', bank: 'Afriland First Bank' },
      processed_at: daysAgo(60), notes: 'Versement mensuel février 2026',
    },
    {
      id: 'po000001-demo-0000-0000-000000000002',
      publisher_id: PUB.lumiere, amount_cad: 60.00,
      period_start: monthStart(2), period_end: monthStart(1),
      status: 'paid', reference: 'VRS-20260301-LUM-001',
      payout_method: { type: 'bank_transfer', bank: 'Afriland First Bank' },
      processed_at: daysAgo(30), notes: 'Versement mensuel mars 2026',
    },
    {
      id: 'po000001-demo-0000-0000-000000000003',
      publisher_id: PUB.lumiere, amount_cad: 75.00,
      period_start: monthStart(1), period_end: monthStart(0),
      status: 'scheduled', reference: 'VRS-20260401-LUM-001',
      scheduled_for: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 5).toISOString().split('T')[0],
      notes: 'Versement mensuel avril 2026 (planifié)',
    },

    // Éditions du Sahel — 1 payé + 1 planifié
    {
      id: 'po000001-demo-0000-0000-000000000004',
      publisher_id: PUB.sahel, amount_cad: 37.50,
      period_start: monthStart(2), period_end: monthStart(1),
      status: 'paid', reference: 'VRS-20260301-SAH-001',
      payout_method: { type: 'mobile_money', operator: 'Orange Money' },
      processed_at: daysAgo(30), notes: 'Versement mars 2026 via Orange Money',
    },
    {
      id: 'po000001-demo-0000-0000-000000000005',
      publisher_id: PUB.sahel, amount_cad: 47.50,
      period_start: monthStart(1), period_end: monthStart(0),
      status: 'scheduled', reference: 'VRS-20260401-SAH-001',
      scheduled_for: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 5).toISOString().split('T')[0],
      notes: 'Versement avril 2026 (planifié)',
    },

    // Arc-en-Ciel — 1 payé + 1 planifié
    {
      id: 'po000001-demo-0000-0000-000000000006',
      publisher_id: PUB.arcenciel, amount_cad: 50.00,
      period_start: monthStart(2), period_end: monthStart(1),
      status: 'paid', reference: 'VRS-20260301-ARC-001',
      payout_method: { type: 'bank_transfer', bank: 'Ecobank CI' },
      processed_at: daysAgo(30), notes: 'Versement mars 2026',
    },
    {
      id: 'po000001-demo-0000-0000-000000000007',
      publisher_id: PUB.arcenciel, amount_cad: 65.00,
      period_start: monthStart(1), period_end: monthStart(0),
      status: 'scheduled', reference: 'VRS-20260401-ARC-001',
      scheduled_for: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 5).toISOString().split('T')[0],
      notes: 'Versement avril 2026 (planifié)',
    },
  ];

  await db('publisher_payouts', payouts);
  const paid = payouts.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount_cad, 0);
  const scheduled = payouts.filter(p => p.status === 'scheduled').reduce((s, p) => s + p.amount_cad, 0);
  console.log(`  ✓ ${payouts.length} versements | Payés: ${paid.toFixed(2)} CAD | Planifiés: ${scheduled.toFixed(2)} CAD\n`);
}

// ─────────────────────────────────────────────
// ÉTAPE 14 — Réclamations éditeurs
// ─────────────────────────────────────────────

async function createClaims() {
  console.log('📬 Réclamations...');

  const claims = [
    {
      id: 'cl000001-demo-0000-0000-000000000001',
      publisher_id: PUB.sahel, category: 'payout',
      subject: 'Versement de janvier non reçu',
      message: 'Bonjour, je n\'ai pas reçu le versement de janvier 2026 référencé VRS-20260101-SAH-001. Mon compte Orange Money a bien été vérifié. Merci de vérifier la transaction.',
      status: 'resolved',
      admin_reply: 'Bonjour Omar, nous avons vérifié la transaction. Le versement a été émis le 5 janvier mais retourné par l\'opérateur (numéro de compte expiré). Nous allons relancer le virement aujourd\'hui. Merci de confirmer votre nouveau numéro.',
      replied_at: daysAgo(50),
    },
    {
      id: 'cl000001-demo-0000-0000-000000000002',
      publisher_id: PUB.arcenciel, category: 'content',
      subject: 'Couverture de "Baobab Blues" à mettre à jour',
      message: 'Bonjour, nous avons fait refaire la couverture de "Baobab Blues" par un illustrateur. Pouvez-vous me donner la procédure pour mettre à jour la couverture dans le catalogue ?',
      status: 'in_progress',
      admin_reply: 'Bonjour Chloé, vous pouvez uploader directement la nouvelle couverture depuis votre espace éditeur > Mes livres > Modifier. Si le problème persiste, renvoyez le fichier ici.',
      replied_at: daysAgo(5),
    },
    {
      id: 'cl000001-demo-0000-0000-000000000003',
      publisher_id: PUB.lumiere, category: 'technical',
      subject: 'Erreur lors de l\'upload de "La Voie du Griot" version audio',
      message: 'Lors de l\'upload du fichier MP3 de la version audio de La Voie du Griot, j\'obtiens une erreur 413. Le fichier fait 285 Mo, est-ce trop grand ?',
      status: 'resolved',
      admin_reply: 'Bonjour Sophie, la limite est de 500 Mo. L\'erreur 413 était due à un timeout côté réseau. Nous avons augmenté le timeout. Vous pouvez réessayer, ça devrait fonctionner maintenant.',
      replied_at: daysAgo(20),
    },
  ];

  await db('publisher_claims', claims);
  console.log(`  ✓ ${claims.length} réclamations\n`);
}

// ─────────────────────────────────────────────
// ÉTAPE 15 — Codes promo
// ─────────────────────────────────────────────

async function createPromoCodes() {
  console.log('🎟️  Codes promo...');

  const promos = [
    {
      id: 'promo001-demo-0000-0000-000000000001',
      code: 'DEMO-LUMIERE15', description: 'Promotion 15% — Éditions Lumière d\'Afrique',
      discount_type: 'percent', discount_value: 15, max_uses: 100, used_count: 23,
      valid_from: daysAgo(30), valid_until: new Date(Date.now() + 30 * 86400000).toISOString(),
      publisher_id: PUB.lumiere, monthly_slot: monthStart(0), is_active: true,
    },
    {
      id: 'promo001-demo-0000-0000-000000000002',
      code: 'DEMO-SAHEL-DECOUVERTE', description: 'Mois découverte Sahel — 1 mois offert',
      discount_type: 'percent', discount_value: 100, max_uses: 50, used_count: 12,
      valid_from: daysAgo(15), valid_until: new Date(Date.now() + 15 * 86400000).toISOString(),
      publisher_id: PUB.sahel, monthly_slot: monthStart(0), is_active: true,
    },
    {
      id: 'promo001-demo-0000-0000-000000000003',
      code: 'DEMO-ARC10', description: 'Remise 10% Arc-en-Ciel',
      discount_type: 'percent', discount_value: 10, max_uses: 200, used_count: 47,
      valid_from: daysAgo(45), valid_until: new Date(Date.now() + 45 * 86400000).toISOString(),
      publisher_id: PUB.arcenciel, monthly_slot: monthStart(1), is_active: true,
    },
    {
      id: 'promo001-demo-0000-0000-000000000004',
      code: 'DEMO-LAUNCH2026', description: 'Code lancement Papyri — 20% sur tout',
      discount_type: 'percent', discount_value: 20, max_uses: 500, used_count: 178,
      valid_from: daysAgo(90), valid_until: daysAgo(1),
      publisher_id: null, is_active: false,
    },
  ];

  await db('promo_codes', promos);
  console.log(`  ✓ ${promos.length} codes promo (${promos.filter(p => p.is_active).length} actifs)\n`);
}

// ─────────────────────────────────────────────
// ÉTAPE 16 — Listes de lecture
// ─────────────────────────────────────────────

async function createReadingLists() {
  console.log('📌 Listes de lecture...');

  const lists = [
    { id: 'rl000001-demo-0000-0000-000000000001', user_id: U.awa,     content_id: C.voie_griot, added_at: daysAgo(12) },
    { id: 'rl000001-demo-0000-0000-000000000002', user_id: U.awa,     content_id: C.danseuse,   added_at: daysAgo(8)  },
    { id: 'rl000001-demo-0000-0000-000000000003', user_id: U.awa,     content_id: C.baobab,     added_at: daysAgo(3)  },
    { id: 'rl000001-demo-0000-0000-000000000004', user_id: U.franck,  content_id: C.etoiles,    added_at: daysAgo(15) },
    { id: 'rl000001-demo-0000-0000-000000000005', user_id: U.franck,  content_id: C.desert,     added_at: daysAgo(10) },
    { id: 'rl000001-demo-0000-0000-000000000006', user_id: U.mariame, content_id: C.contes,     added_at: daysAgo(7)  },
    { id: 'rl000001-demo-0000-0000-000000000007', user_id: U.mariame, content_id: C.rythmes,    added_at: daysAgo(4)  },
    { id: 'rl000001-demo-0000-0000-000000000008', user_id: U.djibril, content_id: C.marabout,   added_at: daysAgo(6)  },
    { id: 'rl000001-demo-0000-0000-000000000009', user_id: U.djibril, content_id: C.voie_griot, added_at: daysAgo(2)  },
  ];

  await supabase.from('ebook_reading_list').upsert(lists, { onConflict: 'id' });
  console.log(`  ✓ ${lists.length} entrées de listes\n`);
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║   PAPYRI — Seed données de présentation   ║');
  console.log('╚═══════════════════════════════════════════╝');
  console.log('');

  if (CLEAN) await clean();

  await createUsers();
  await loadPlans();
  await createCategories();
  await createPublishers();
  await createContents();
  await linkContentCategories();
  await createPublisherBooks();
  await createSubscriptions();
  await createReadingHistory();
  await createBookmarksAndHighlights();
  await createReviews();
  await createPublisherRevenue();
  await createPayouts();
  await createClaims();
  await createPromoCodes();
  await createReadingLists();

  console.log('╔═══════════════════════════════════════════╗');
  console.log('║              ✅ SEED TERMINÉ              ║');
  console.log('╚═══════════════════════════════════════════╝');
  console.log('');
  console.log('Comptes de démonstration (mot de passe: DemoPapyri2026)');
  console.log('─────────────────────────────────────────────────────────');
  console.log('Abonnés:');
  console.log('  awa.diallo@demo.papyri.app     → Personnel  (Douala)');
  console.log('  franck.mbeki@demo.papyri.app   → Famille    (Paris)');
  console.log('  mariame.kone@demo.papyri.app   → Personnel  (Abidjan)');
  console.log('  kofi.asante@demo.papyri.app    → Slow       (Accra)');
  console.log('  djibril.ndiaye@demo.papyri.app → Annuel     (Dakar)');
  console.log('');
  console.log('Éditeurs:');
  console.log('  sophie.edinga@demo.papyri.app  → Lumière d\'Afrique (5 titres)');
  console.log('  omar.benmoussa@demo.papyri.app → Éditions du Sahel (4 titres)');
  console.log('  chloe.mensah@demo.papyri.app   → Arc-en-Ciel (4 titres)');
  console.log('');
}

main().catch(err => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});
