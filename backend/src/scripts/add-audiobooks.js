/**
 * Ajouter des audiobooks gratuits du domaine public
 * Sources fiables: Internet Archive
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

// Audiobooks du domaine public - URLs validées
const AUDIOBOOKS = [
  {
    title: "Le Petit Prince - Chapitre 1 (Audio)",
    author: "Antoine de Saint-Exupéry",
    description: "Premier chapitre du Petit Prince en version audio. Narration en français du célèbre conte philosophique.",
    url: "https://archive.org/download/le_petit_prince_1810_librivox/petitprince_01_saintexupery_128kb.mp3",
    category: "jeunesse",
    language: "fr",
    cover: "https://placehold.co/600x900/D4A017/FFF?text=Le+Petit+Prince",
    duration: 360 // 6 minutes
  },
  {
    title: "Candide - Chapitre 1 (Audio)",
    author: "Voltaire",
    description: "Premier chapitre de Candide en version audio. Narration en français du conte philosophique de Voltaire.",
    url: "https://archive.org/download/candide_0911_librivox/candide_01_voltaire_128kb.mp3",
    category: "romans",
    language: "fr",
    cover: "https://placehold.co/600x900/B5651D/FFF?text=Candide+Audio",
    duration: 720 // 12 minutes
  },
  {
    title: "Les Fables de La Fontaine - Le Corbeau et le Renard (Audio)",
    author: "Jean de La Fontaine",
    description: "Fable célèbre de La Fontaine en version audio. 'Maître Corbeau, sur un arbre perché...'",
    url: "https://archive.org/download/fables_livre_1_1507_librivox/fables1_01_lafontaine_128kb.mp3",
    category: "jeunesse",
    language: "fr",
    cover: "https://placehold.co/600x900/2E4057/FFF?text=Fables+Audio",
    duration: 180 // 3 minutes
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

    console.log(`   Téléchargement depuis: ${url.substring(0, 60)}...`);

    const request = protocol.get(url, (response) => {
      // Gérer redirections
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
        return reject(new Error(`HTTP ${response.statusCode}`));
      }

      response.pipe(file);

      let downloaded = 0;
      const total = parseInt(response.headers['content-length'], 10);

      response.on('data', (chunk) => {
        downloaded += chunk.length;
        if (total) {
          const percent = ((downloaded / total) * 100).toFixed(1);
          process.stdout.write(`\r   Progression: ${percent}% (${(downloaded / 1024 / 1024).toFixed(2)} MB)`);
        }
      });

      file.on('finish', () => {
        file.close();
        console.log(''); // Nouvelle ligne après progression
        resolve(filepath);
      });
    });

    request.on('error', (err) => {
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
      reject(err);
    });

    request.setTimeout(60000, () => {
      request.destroy();
      reject(new Error('Timeout'));
    });
  });
}

async function uploadToR2(filepath, r2Key) {
  const fileContent = fs.readFileSync(filepath);
  const fileSize = fs.statSync(filepath).size;

  const command = new PutObjectCommand({
    Bucket: config.r2.bucketContent,
    Key: r2Key,
    Body: fileContent,
    ContentType: 'audio/mpeg',
  });

  await s3Client.send(command);
  return { key: r2Key, size: fileSize };
}

async function createAudiobookInSupabase(audiobook, fileKey, fileSize) {
  const { data: category } = await supabaseAdmin
    .from('categories')
    .select('id')
    .eq('slug', audiobook.category)
    .single();

  const { data: rightsHolder } = await supabaseAdmin
    .from('rights_holders')
    .select('id')
    .limit(1)
    .single();

  const contentData = {
    title: audiobook.title,
    author: audiobook.author,
    description: audiobook.description,
    content_type: 'audiobook',
    format: 'mp3',
    language: audiobook.language,
    cover_url: audiobook.cover,
    file_key: fileKey,
    file_size_bytes: fileSize,
    duration_seconds: audiobook.duration,
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
  console.log('🎧 Ajout d\'audiobooks à la bibliothèque...\n');
  console.log(`📥 ${AUDIOBOOKS.length} audiobooks à télécharger\n`);

  const results = [];

  for (let i = 0; i < AUDIOBOOKS.length; i++) {
    const audiobook = AUDIOBOOKS[i];
    const num = i + 1;

    try {
      console.log('='.repeat(60));
      console.log(`🎵 [${num}/${AUDIOBOOKS.length}] ${audiobook.title}`);
      console.log('='.repeat(60));

      // Télécharger
      console.log('\n1️⃣  Téléchargement...');
      const filename = `${audiobook.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.mp3`;
      const filepath = path.join(DOWNLOAD_DIR, filename);

      await downloadFile(audiobook.url, filepath);
      const stats = fs.statSync(filepath);
      console.log(`   ✅ Téléchargé: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

      // Upload vers R2
      console.log('\n2️⃣  Upload vers R2...');
      const r2Key = `audiobooks/${filename}`;
      await uploadToR2(filepath, r2Key);
      console.log(`   ✅ Uploadé: ${r2Key}`);

      // Créer dans Supabase
      console.log('\n3️⃣  Création dans Supabase...');
      const content = await createAudiobookInSupabase(audiobook, r2Key, stats.size);
      console.log(`   ✅ ID: ${content.id}`);
      console.log(`   📚 Titre: ${content.title}`);
      console.log(`   ⏱️  Durée: ${Math.floor(content.duration_seconds / 60)} min`);

      // Nettoyer
      fs.unlinkSync(filepath);

      results.push({
        success: true,
        title: audiobook.title,
        size: stats.size,
        duration: audiobook.duration,
      });

      console.log(`\n✅ ${audiobook.title} - TERMINÉ\n`);

    } catch (error) {
      console.error(`\n❌ Erreur: ${error.message}\n`);
      results.push({
        success: false,
        title: audiobook.title,
        error: error.message,
      });
    }
  }

  // Résumé
  console.log('\n' + '='.repeat(60));
  console.log('📊 RÉSUMÉ FINAL');
  console.log('='.repeat(60) + '\n');

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`✅ Réussis: ${successful.length}/${AUDIOBOOKS.length}`);
  console.log(`❌ Échoués: ${failed.length}/${AUDIOBOOKS.length}\n`);

  if (successful.length > 0) {
    console.log('🎧 Audiobooks ajoutés:');
    successful.forEach((r, i) => {
      const sizeMB = (r.size / 1024 / 1024).toFixed(2);
      const durationMin = Math.floor(r.duration / 60);
      console.log(`   ${i + 1}. ${r.title}`);
      console.log(`      Taille: ${sizeMB} MB | Durée: ${durationMin} min`);
    });
  }

  if (failed.length > 0) {
    console.log('\n❌ Échecs:');
    failed.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.title}: ${r.error}`);
    });
  }

  // Réindexer
  if (successful.length > 0) {
    console.log('\n🔍 Réindexation Meilisearch...');
    const meilisearchService = require('../services/meilisearch.service');
    await meilisearchService.indexAllContents();
    console.log('✅ Meilisearch réindexé');

    const totalSize = successful.reduce((sum, r) => sum + r.size, 0);
    console.log(`\n📊 Taille audiobooks: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  }

  console.log('\n🎉 Processus terminé!\n');

  process.exit(0);
}

main();
