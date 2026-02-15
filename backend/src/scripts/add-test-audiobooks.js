require('dotenv').config();
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

const AUDIOBOOKS = [
  {
    title: "Conte Africain - Test Audio",
    author: "Narrateur Test",
    description: "Audiobook de test pour démonstration du système de streaming audio. Simule un conte africain traditionnel.",
    file: "test-uploads/audiobooks/test-audio-1.txt",
    category: "jeunesse",
    duration: 600
  },
  {
    title: "Histoire d'Afrique - Test Audio",
    author: "Narrateur Test",
    description: "Deuxième audiobook de test. Simule une histoire éducative sur l'Afrique et ses traditions.",
    file: "test-uploads/audiobooks/test-audio-1.txt",
    category: "histoire",
    duration: 720
  }
];

async function main() {
  console.log('🎧 Ajout audiobooks de test...\n');

  for (let i = 0; i < AUDIOBOOKS.length; i++) {
    const audiobook = AUDIOBOOKS[i];
    try {
      console.log(`📝 [${i + 1}/${AUDIOBOOKS.length}] ${audiobook.title}`);

      const filepath = path.join(__dirname, '../../', audiobook.file);
      const fileContent = fs.readFileSync(filepath);
      const fileSize = fs.statSync(filepath).size;

      const filename = audiobook.title.toLowerCase().replace(/[^a-z0-9]/g, '-') + '.mp3';
      const r2Key = `audiobooks/${filename}`;

      // Upload
      await s3Client.send(new PutObjectCommand({
        Bucket: config.r2.bucketContent,
        Key: r2Key,
        Body: fileContent,
        ContentType: 'audio/mpeg',
      }));

      console.log('   ✅ Uploadé vers R2');

      // Supabase
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

      const { data: content } = await supabaseAdmin
        .from('contents')
        .insert({
          title: audiobook.title,
          author: audiobook.author,
          description: audiobook.description,
          content_type: 'audiobook',
          format: 'mp3',
          language: 'fr',
          cover_url: 'https://placehold.co/600x900/D4A017/FFF?text=Audio+Test',
          file_key: r2Key,
          file_size_bytes: fileSize,
          duration_seconds: audiobook.duration,
          rights_holder_id: rightsHolder?.id,
          is_published: true,
          published_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (category) {
        await supabaseAdmin.from('content_categories').insert({
          content_id: content.id,
          category_id: category.id,
        });
      }

      console.log(`   ✅ Créé: ${content.id}\n`);

    } catch (error) {
      console.error(`   ❌ Erreur: ${error.message}\n`);
    }
  }

  // Réindexer
  const meilisearchService = require('../services/meilisearch.service');
  await meilisearchService.indexAllContents();
  console.log('✅ Meilisearch réindexé\n');

  console.log('🎉 Audiobooks de test ajoutés!\n');
  console.log('💡 Note: Ce sont des fichiers texte pour test.');
  console.log('   Pour production, remplacez par de vrais MP3.\n');

  process.exit(0);
}

main();
