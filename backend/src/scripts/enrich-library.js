/**
 * Enrichir la bibliothèque avec plus de contenus gratuits
 * Ebooks + Audiobooks du domaine public
 */

require('dotenv').config();
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { supabaseAdmin } = require('../config/database');
const config = require('../config/env');

const s3Client = new S3Client({
  region: 'auto',
  endpoint: config.r2.endpoint,
  credentials: {
    accessKeyId: config.r2.accessKeyId,
    secretAccessKey: config.r2.secretAccessKey,
  },
});

// Catalogue enrichi avec plus de variété
const NEW_CONTENT = [
  // EBOOKS - Classiques français supplémentaires
  {
    title: "Madame Bovary",
    author: "Gustave Flaubert",
    description: "Roman de Gustave Flaubert publié en 1857, qui raconte l'histoire d'Emma Bovary, une femme mariée insatisfaite qui cherche le bonheur dans des liaisons adultères.",
    url: "https://www.gutenberg.org/ebooks/14155.epub.noimages",
    type: "ebook",
    category: "romans",
    language: "fr",
    cover: "https://www.gutenberg.org/cache/epub/14155/pg14155.cover.medium.jpg"
  },
  {
    title: "Le Père Goriot",
    author: "Honoré de Balzac",
    description: "Roman de Balzac publié en 1835, qui dépeint la société parisienne de la Restauration et raconte l'histoire tragique du père Goriot et de ses filles ingrates.",
    url: "https://www.gutenberg.org/ebooks/1237.epub.noimages",
    type: "ebook",
    category: "romans",
    language: "fr",
    cover: "https://www.gutenberg.org/cache/epub/1237/pg1237.cover.medium.jpg"
  },
  {
    title: "Candide",
    author: "Voltaire",
    description: "Conte philosophique de Voltaire publié en 1759, qui critique l'optimisme philosophique à travers les aventures de Candide et son maître Pangloss.",
    url: "https://www.gutenberg.org/ebooks/19942.epub.noimages",
    type: "ebook",
    category: "romans",
    language: "fr",
    cover: "https://www.gutenberg.org/cache/epub/19942/pg19942.cover.medium.jpg"
  },
  {
    title: "L'Assommoir",
    author: "Émile Zola",
    description: "Roman d'Émile Zola publié en 1877, septième volume des Rougon-Macquart, qui dépeint la déchéance de Gervaise dans les quartiers populaires de Paris.",
    url: "https://www.gutenberg.org/ebooks/8600.epub.noimages",
    type: "ebook",
    category: "romans",
    language: "fr",
    cover: "https://www.gutenberg.org/cache/epub/8600/pg8600.cover.medium.jpg"
  },
  {
    title: "Le Rouge et le Noir",
    author: "Stendhal",
    description: "Roman de Stendhal publié en 1830, qui suit l'ascension et la chute de Julien Sorel, un jeune homme ambitieux dans la France de la Restauration.",
    url: "https://www.gutenberg.org/ebooks/44747.epub.noimages",
    type: "ebook",
    category: "romans",
    language: "fr",
    cover: "https://www.gutenberg.org/cache/epub/44747/pg44747.cover.medium.jpg"
  },

  // AUDIOBOOKS - LibriVox
  {
    title: "Le Petit Prince (Audio)",
    author: "Antoine de Saint-Exupéry",
    description: "Version audio du célèbre conte philosophique d'Antoine de Saint-Exupéry. Un petit prince voyage de planète en planète à la recherche de la sagesse.",
    url: "https://ia801409.us.archive.org/9/items/lepetitprince_1601_librivox/petitprince_01_saintexupery_128kb.mp3",
    type: "audiobook",
    category: "jeunesse",
    language: "fr",
    cover: "https://archive.org/download/lepetitprince_1601_librivox/Le%20Petit%20Prince_1601.jpg",
    duration: 2400 // ~40 minutes
  },
  {
    title: "Fables de La Fontaine (Sélection Audio)",
    author: "Jean de La Fontaine",
    description: "Sélection audio de fables célèbres de La Fontaine, narration en français. Recueil de fables mettant en scène des animaux pour transmettre une morale.",
    url: "https://ia802705.us.archive.org/29/items/fables_fontaine_1109_librivox/fables_01_lafontaine_128kb.mp3",
    type: "audiobook",
    category: "jeunesse",
    language: "fr",
    cover: "https://www.gutenberg.org/cache/epub/17915/pg17915.cover.medium.jpg",
    duration: 1800 // ~30 minutes
  },
  {
    title: "Vingt Mille Lieues sous les Mers (Audio - Extrait)",
    author: "Jules Verne",
    description: "Extrait audio du roman de Jules Verne. Suivez les aventures du Capitaine Nemo à bord du Nautilus dans les profondeurs des océans.",
    url: "https://ia802701.us.archive.org/1/items/20000_lieues_1007_librivox/20000lieues_01_verne_128kb.mp3",
    type: "audiobook",
    category: "romans",
    language: "fr",
    cover: "https://www.gutenberg.org/cache/epub/5097/pg5097.cover.medium.jpg",
    duration: 3600 // ~60 minutes
  }
];

const DOWNLOAD_DIR = path.join(__dirname, '../../downloads');
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(filepath);

    protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        fs.unlinkSync(filepath);
        return downloadFile(response.headers.location, filepath)
          .then(resolve)
          .catch(reject);
      }

      if (response.statusCode !== 200) {
        file.close();
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
        return reject(new Error(`HTTP ${response.statusCode}: ${url}`));
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(filepath);
      });
    }).on('error', (err) => {
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
      reject(err);
    });
  });
}

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

async function createContentInSupabase(item, fileKey, fileSize) {
  const { data: category } = await supabaseAdmin
    .from('categories')
    .select('id')
    .eq('slug', item.category)
    .single();

  const { data: rightsHolder } = await supabaseAdmin
    .from('rights_holders')
    .select('id')
    .limit(1)
    .single();

  const contentData = {
    title: item.title,
    author: item.author,
    description: item.description,
    content_type: item.type,
    format: item.type === 'ebook' ? 'epub' : 'mp3',
    language: item.language,
    cover_url: item.cover,
    file_key: fileKey,
    file_size_bytes: fileSize,
    duration_seconds: item.duration || null,
    rights_holder_id: rightsHolder?.id || '00000000-0000-0000-0000-000000000001',
    is_published: true,
    published_at: new Date().toISOString(),
  };

  const { data: newContent, error } = await supabaseAdmin
    .from('contents')
    .insert(contentData)
    .select()
    .single();

  if (error) throw error;

  if (category) {
    await supabaseAdmin.from('content_categories').insert({
      content_id: newContent.id,
      category_id: category.id,
    });
  }

  return newContent;
}

async function main() {
  console.log('🎨 Enrichissement de la bibliothèque...\n');
  console.log(`📥 ${NEW_CONTENT.length} nouveaux contenus à ajouter`);
  console.log(`   📚 ${NEW_CONTENT.filter(c => c.type === 'ebook').length} ebooks`);
  console.log(`   🎧 ${NEW_CONTENT.filter(c => c.type === 'audiobook').length} audiobooks\n`);

  const results = [];
  const ebooks = NEW_CONTENT.filter(c => c.type === 'ebook');
  const audiobooks = NEW_CONTENT.filter(c => c.type === 'audiobook');

  // Traiter les ebooks
  console.log('📚 PHASE 1: EBOOKS\n' + '='.repeat(60) + '\n');

  for (let i = 0; i < ebooks.length; i++) {
    const item = ebooks[i];
    try {
      console.log(`📖 [${i + 1}/${ebooks.length}] ${item.title}`);
      console.log('   Téléchargement...');

      const filename = `${item.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.epub`;
      const filepath = path.join(DOWNLOAD_DIR, filename);

      await downloadFile(item.url, filepath);
      const stats = fs.statSync(filepath);
      console.log(`   ✅ Téléchargé: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

      const r2Key = `ebooks/${filename}`;
      await uploadToR2(filepath, r2Key, 'application/epub+zip');
      console.log(`   ✅ Uploadé vers R2`);

      const content = await createContentInSupabase(item, r2Key, stats.size);
      console.log(`   ✅ Créé en DB: ${content.id}\n`);

      fs.unlinkSync(filepath);

      results.push({ success: true, title: item.title, type: 'ebook', size: stats.size });
    } catch (error) {
      console.error(`   ❌ Erreur: ${error.message}\n`);
      results.push({ success: false, title: item.title, type: 'ebook', error: error.message });
    }
  }

  // Traiter les audiobooks
  console.log('\n🎧 PHASE 2: AUDIOBOOKS\n' + '='.repeat(60) + '\n');

  for (let i = 0; i < audiobooks.length; i++) {
    const item = audiobooks[i];
    try {
      console.log(`🎵 [${i + 1}/${audiobooks.length}] ${item.title}`);
      console.log('   Téléchargement...');

      const filename = `${item.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.mp3`;
      const filepath = path.join(DOWNLOAD_DIR, filename);

      await downloadFile(item.url, filepath);
      const stats = fs.statSync(filepath);
      console.log(`   ✅ Téléchargé: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

      const r2Key = `audiobooks/${filename}`;
      await uploadToR2(filepath, r2Key, 'audio/mpeg');
      console.log(`   ✅ Uploadé vers R2`);

      const content = await createContentInSupabase(item, r2Key, stats.size);
      console.log(`   ✅ Créé en DB: ${content.id}\n`);

      fs.unlinkSync(filepath);

      results.push({ success: true, title: item.title, type: 'audiobook', size: stats.size });
    } catch (error) {
      console.error(`   ❌ Erreur: ${error.message}\n`);
      results.push({ success: false, title: item.title, type: 'audiobook', error: error.message });
    }
  }

  // Résumé
  console.log('\n' + '='.repeat(60));
  console.log('📊 RÉSUMÉ FINAL');
  console.log('='.repeat(60) + '\n');

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const successfulEbooks = successful.filter(r => r.type === 'ebook');
  const successfulAudiobooks = successful.filter(r => r.type === 'audiobook');

  console.log(`✅ Total réussis: ${successful.length}/${NEW_CONTENT.length}`);
  console.log(`   📚 Ebooks: ${successfulEbooks.length}/${ebooks.length}`);
  console.log(`   🎧 Audiobooks: ${successfulAudiobooks.length}/${audiobooks.length}`);
  console.log(`❌ Total échoués: ${failed.length}/${NEW_CONTENT.length}\n`);

  if (successfulEbooks.length > 0) {
    console.log('📚 Ebooks ajoutés:');
    successfulEbooks.forEach((r, i) => {
      const sizeMB = (r.size / 1024 / 1024).toFixed(2);
      console.log(`   ${i + 1}. ${r.title} (${sizeMB} MB)`);
    });
  }

  if (successfulAudiobooks.length > 0) {
    console.log('\n🎧 Audiobooks ajoutés:');
    successfulAudiobooks.forEach((r, i) => {
      const sizeMB = (r.size / 1024 / 1024).toFixed(2);
      console.log(`   ${i + 1}. ${r.title} (${sizeMB} MB)`);
    });
  }

  if (failed.length > 0) {
    console.log('\n❌ Échecs:');
    failed.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.title} (${r.type}): ${r.error}`);
    });
  }

  // Réindexer
  console.log('\n🔍 Réindexation Meilisearch...');
  const meilisearchService = require('../services/meilisearch.service');
  await meilisearchService.indexAllContents();
  console.log('✅ Meilisearch réindexé\n');

  const totalSize = successful.reduce((sum, r) => sum + r.size, 0);
  console.log(`📊 Taille totale ajoutée: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`📦 Utilisation R2: ~${((totalSize + 2000000) / 1024 / 1024).toFixed(2)} MB / 10 GB\n`);

  console.log('🎉 Enrichissement terminé!\n');

  process.exit(0);
}

main();
