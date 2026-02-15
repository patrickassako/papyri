/**
 * Script de téléchargement et upload de livres gratuits du domaine public
 * Sources: Project Gutenberg, Internet Archive
 *
 * Usage: node src/scripts/download-and-upload-free-books.js
 */

require('dotenv').config();
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { supabaseAdmin } = require('../config/database');
const config = require('../config/env');

// Configuration R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: config.r2.endpoint,
  credentials: {
    accessKeyId: config.r2.accessKeyId,
    secretAccessKey: config.r2.secretAccessKey,
  },
});

// Catalogue de livres gratuits à télécharger
const FREE_BOOKS = [
  {
    title: "Les Misérables",
    author: "Victor Hugo",
    description: "Chef-d'œuvre de Victor Hugo publié en 1862, qui suit le destin de Jean Valjean, ancien forçat en quête de rédemption dans la France du XIXe siècle.",
    url: "https://www.gutenberg.org/ebooks/17489.epub.noimages",
    category: "romans",
    language: "fr",
    cover_placeholder: "https://www.gutenberg.org/cache/epub/17489/pg17489.cover.medium.jpg"
  },
  {
    title: "Notre-Dame de Paris",
    author: "Victor Hugo",
    description: "Roman historique de Victor Hugo publié en 1831, qui raconte l'histoire de la bohémienne Esmeralda, du sonneur de cloches Quasimodo et de l'archidiacre Frollo.",
    url: "https://www.gutenberg.org/ebooks/2610.epub.noimages",
    category: "romans",
    language: "fr",
    cover_placeholder: "https://www.gutenberg.org/cache/epub/2610/pg2610.cover.medium.jpg"
  },
  {
    title: "Le Comte de Monte-Cristo",
    author: "Alexandre Dumas",
    description: "Roman d'aventures d'Alexandre Dumas publié en 1844, qui raconte la vengeance d'Edmond Dantès après avoir été emprisonné injustement.",
    url: "https://www.gutenberg.org/ebooks/17989.epub.noimages",
    category: "romans",
    language: "fr",
    cover_placeholder: "https://www.gutenberg.org/cache/epub/17989/pg17989.cover.medium.jpg"
  },
  {
    title: "Les Trois Mousquetaires",
    author: "Alexandre Dumas",
    description: "Roman d'Alexandre Dumas publié en 1844, qui suit les aventures de d'Artagnan et ses trois amis mousquetaires au service du roi Louis XIII.",
    url: "https://www.gutenberg.org/ebooks/13951.epub.noimages",
    category: "romans",
    language: "fr",
    cover_placeholder: "https://www.gutenberg.org/cache/epub/13951/pg13951.cover.medium.jpg"
  },
  {
    title: "Germinal",
    author: "Émile Zola",
    description: "Roman d'Émile Zola publié en 1885, qui dépeint la condition des mineurs de charbon du Nord de la France sous le Second Empire.",
    url: "https://www.gutenberg.org/ebooks/5711.epub.noimages",
    category: "romans",
    language: "fr",
    cover_placeholder: "https://www.gutenberg.org/cache/epub/5711/pg5711.cover.medium.jpg"
  }
];

// Créer le dossier de téléchargements
const DOWNLOAD_DIR = path.join(__dirname, '../../downloads');
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

/**
 * Télécharger un fichier depuis une URL
 */
function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    const file = fs.createWriteStream(filepath);

    protocol.get(url, (response) => {
      // Gérer les redirections
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        fs.unlinkSync(filepath);
        return downloadFile(response.headers.location, filepath)
          .then(resolve)
          .catch(reject);
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(filepath);
        return reject(new Error(`HTTP ${response.statusCode}: ${url}`));
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve(filepath);
      });
    }).on('error', (err) => {
      fs.unlinkSync(filepath);
      reject(err);
    });
  });
}

/**
 * Uploader un fichier vers R2
 */
async function uploadToR2(filepath, r2Key, contentType) {
  const fileContent = fs.readFileSync(filepath);
  const fileSize = fs.statSync(filepath).size;

  const command = new PutObjectCommand({
    Bucket: config.r2.bucketContent,
    Key: r2Key,
    Body: fileContent,
    ContentType: contentType,
  });

  await s3Client.send(command);

  return { key: r2Key, size: fileSize };
}

/**
 * Créer l'enregistrement dans Supabase
 */
async function createContentInSupabase(book, fileKey, fileSize) {
  // Trouver la catégorie
  const { data: category } = await supabaseAdmin
    .from('categories')
    .select('id')
    .eq('slug', book.category)
    .single();

  // Trouver un rights_holder (domaine public)
  const { data: rightsHolder } = await supabaseAdmin
    .from('rights_holders')
    .select('id')
    .limit(1)
    .single();

  // Créer le contenu
  const contentData = {
    title: book.title,
    author: book.author,
    description: book.description,
    content_type: 'ebook',
    format: 'epub',
    language: book.language,
    cover_url: book.cover_placeholder,
    file_key: fileKey,
    file_size_bytes: fileSize,
    rights_holder_id: rightsHolder?.id || '00000000-0000-0000-0000-000000000001',
    is_published: true,
    published_at: new Date().toISOString(),
  };

  const { data: newContent, error } = await supabaseAdmin
    .from('contents')
    .insert(contentData)
    .select()
    .single();

  if (error) {
    throw error;
  }

  // Associer à la catégorie
  if (category) {
    await supabaseAdmin
      .from('content_categories')
      .insert({
        content_id: newContent.id,
        category_id: category.id,
      });
  }

  return newContent;
}

/**
 * Fonction principale
 */
async function main() {
  console.log('📚 Téléchargement et upload de livres gratuits...\n');
  console.log(`📥 ${FREE_BOOKS.length} livres à télécharger\n`);

  const results = [];

  for (let i = 0; i < FREE_BOOKS.length; i++) {
    const book = FREE_BOOKS[i];
    const bookNum = i + 1;

    try {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📖 Livre ${bookNum}/${FREE_BOOKS.length}: ${book.title}`);
      console.log(`${'='.repeat(60)}`);

      // Étape 1: Télécharger
      console.log(`\n1️⃣  Téléchargement depuis Project Gutenberg...`);
      const filename = `${book.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.epub`;
      const filepath = path.join(DOWNLOAD_DIR, filename);

      await downloadFile(book.url, filepath);
      const stats = fs.statSync(filepath);
      console.log(`   ✅ Téléchargé: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

      // Étape 2: Upload vers R2
      console.log(`\n2️⃣  Upload vers Cloudflare R2...`);
      const r2Key = `ebooks/${filename}`;
      const upload = await uploadToR2(filepath, r2Key, 'application/epub+zip');
      console.log(`   ✅ Uploadé: ${r2Key}`);

      // Étape 3: Créer dans Supabase
      console.log(`\n3️⃣  Création enregistrement Supabase...`);
      const content = await createContentInSupabase(book, r2Key, upload.size);
      console.log(`   ✅ Contenu créé: ${content.id}`);
      console.log(`   📚 Titre: ${content.title}`);
      console.log(`   👤 Auteur: ${content.author}`);

      // Nettoyer le fichier local
      fs.unlinkSync(filepath);

      results.push({
        success: true,
        book: book.title,
        contentId: content.id,
        size: stats.size,
      });

      console.log(`\n✅ ${book.title} - TERMINÉ`);

    } catch (error) {
      console.error(`\n❌ Erreur pour ${book.title}:`, error.message);
      results.push({
        success: false,
        book: book.title,
        error: error.message,
      });
    }
  }

  // Résumé final
  console.log(`\n\n${'='.repeat(60)}`);
  console.log('📊 RÉSUMÉ FINAL');
  console.log(`${'='.repeat(60)}\n`);

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`✅ Réussis: ${successful.length}/${FREE_BOOKS.length}`);
  console.log(`❌ Échoués: ${failed.length}/${FREE_BOOKS.length}\n`);

  if (successful.length > 0) {
    console.log('✅ Livres uploadés avec succès:');
    successful.forEach((r, i) => {
      const sizeMB = (r.size / 1024 / 1024).toFixed(2);
      console.log(`   ${i + 1}. ${r.book} (${sizeMB} MB) - ID: ${r.contentId}`);
    });
  }

  if (failed.length > 0) {
    console.log('\n❌ Livres échoués:');
    failed.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.book}: ${r.error}`);
    });
  }

  // Réindexer Meilisearch
  console.log('\n🔍 Réindexation Meilisearch...');
  const meilisearchService = require('../services/meilisearch.service');
  try {
    await meilisearchService.indexAllContents();
    console.log('   ✅ Meilisearch réindexé');
  } catch (error) {
    console.log('   ⚠️  Erreur Meilisearch:', error.message);
  }

  console.log('\n🎉 Processus terminé!\n');

  console.log('📝 Prochaines étapes:');
  console.log('   1. Tester via API: GET http://localhost:3001/api/contents');
  console.log('   2. Rechercher: GET http://localhost:3001/api/search?q=hugo');
  console.log('   3. Accéder aux fichiers (avec JWT + subscription)');
  console.log('   4. Intégrer le frontend pour lecture\n');

  process.exit(0);
}

main();
