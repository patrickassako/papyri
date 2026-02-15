/**
 * Vérifier la synchronisation entre Supabase et R2
 */
require('dotenv').config();
const { S3Client, ListObjectsV2Command, HeadObjectCommand } = require('@aws-sdk/client-s3');
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

async function main() {
  console.log('🔍 Vérification synchronisation Supabase ↔ R2...\n');

  // Récupérer tous les contenus de Supabase
  const { data: contents, error } = await supabaseAdmin
    .from('contents')
    .select('id, title, file_key, file_size_bytes')
    .order('created_at', { ascending: false });

  if (error) throw error;

  console.log(`📊 Supabase: ${contents.length} contenus\n`);

  // Vérifier chaque fichier dans R2
  const results = [];
  
  for (const content of contents) {
    try {
      const command = new HeadObjectCommand({
        Bucket: config.r2.bucketContent,
        Key: content.file_key,
      });
      
      const response = await s3Client.send(command);
      
      results.push({
        title: content.title,
        fileKey: content.file_key,
        existsInR2: true,
        sizeInR2: response.ContentLength,
        sizeInDB: content.file_size_bytes,
        match: response.ContentLength === content.file_size_bytes,
      });
    } catch (error) {
      if (error.name === 'NotFound') {
        results.push({
          title: content.title,
          fileKey: content.file_key,
          existsInR2: false,
          sizeInR2: 0,
          sizeInDB: content.file_size_bytes,
          match: false,
        });
      }
    }
  }

  // Résultats
  const existsInR2 = results.filter(r => r.existsInR2);
  const missingInR2 = results.filter(r => !r.existsInR2);

  console.log(`✅ Fichiers présents dans R2: ${existsInR2.length}/${contents.length}`);
  console.log(`❌ Fichiers manquants dans R2: ${missingInR2.length}/${contents.length}\n`);

  if (existsInR2.length > 0) {
    console.log('✅ Fichiers synchronisés:');
    existsInR2.forEach((r, i) => {
      const sizeMB = (r.sizeInR2 / 1024 / 1024).toFixed(2);
      console.log(`   ${i + 1}. ${r.title} (${sizeMB} MB)`);
    });
  }

  if (missingInR2.length > 0) {
    console.log('\n❌ Fichiers manquants dans R2:');
    missingInR2.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.title}`);
      console.log(`      File Key: ${r.fileKey}`);
    });
  }

  console.log('\n📝 Recommandations:');
  if (missingInR2.length > 0) {
    console.log('   • Supprimer les enregistrements Supabase sans fichiers R2, OU');
    console.log('   • Uploader les fichiers manquants vers R2');
  } else {
    console.log('   ✅ Tous les fichiers sont synchronisés!');
  }

  process.exit(0);
}

main();
