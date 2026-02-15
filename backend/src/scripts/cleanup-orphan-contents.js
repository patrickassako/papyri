/**
 * Nettoyer les contenus orphelins (sans fichiers R2)
 * Supprime les enregistrements Supabase dont les fichiers n'existent pas dans R2
 */
require('dotenv').config();
const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');
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
  console.log('🧹 Nettoyage des contenus orphelins...\n');

  // Récupérer tous les contenus
  const { data: contents } = await supabaseAdmin
    .from('contents')
    .select('id, title, file_key')
    .order('created_at', { ascending: false });

  console.log(`📊 Total contenus: ${contents.length}\n`);

  const toDelete = [];

  // Vérifier chaque fichier
  for (const content of contents) {
    try {
      await s3Client.send(new HeadObjectCommand({
        Bucket: config.r2.bucketContent,
        Key: content.file_key,
      }));
      console.log(`✅ ${content.title} - Fichier existe`);
    } catch (error) {
      if (error.name === 'NotFound') {
        console.log(`❌ ${content.title} - FICHIER MANQUANT`);
        toDelete.push(content);
      }
    }
  }

  console.log(`\n📋 Résumé:`);
  console.log(`   Contenus à conserver: ${contents.length - toDelete.length}`);
  console.log(`   Contenus à supprimer: ${toDelete.length}\n`);

  if (toDelete.length === 0) {
    console.log('✅ Aucun contenu orphelin trouvé!\n');
    process.exit(0);
  }

  console.log('🗑️  Contenus qui seront supprimés:');
  toDelete.forEach((c, i) => {
    console.log(`   ${i + 1}. ${c.title}`);
  });

  console.log('\n⚠️  Cette action va:');
  console.log('   1. Supprimer les enregistrements de la table contents');
  console.log('   2. Supprimer les associations content_categories');
  console.log('   3. Mettre à jour l\'index Meilisearch\n');

  // Supprimer (cascade delete gérera content_categories)
  const idsToDelete = toDelete.map(c => c.id);

  const { error } = await supabaseAdmin
    .from('contents')
    .delete()
    .in('id', idsToDelete);

  if (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }

  console.log(`✅ ${toDelete.length} contenus supprimés de Supabase\n`);

  // Réindexer Meilisearch
  console.log('🔍 Réindexation Meilisearch...');
  const meilisearchService = require('../services/meilisearch.service');
  await meilisearchService.indexAllContents();
  console.log('✅ Meilisearch réindexé\n');

  console.log('🎉 Nettoyage terminé!');
  console.log(`📊 Contenus restants: ${contents.length - toDelete.length}\n`);

  process.exit(0);
}

main();
