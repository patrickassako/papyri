/**
 * Script d'indexation Meilisearch
 * Indexe tous les contenus dans Meilisearch
 *
 * Usage: node src/scripts/index-contents.js
 */

require('dotenv').config();
const meilisearchService = require('../services/meilisearch.service');

async function main() {
  console.log('🚀 Démarrage de l\'indexation Meilisearch...\n');

  try {
    // Check Meilisearch health
    console.log('1️⃣  Vérification de Meilisearch...');
    const isHealthy = await meilisearchService.healthCheck();

    if (!isHealthy) {
      console.error('❌ Meilisearch n\'est pas disponible.');
      console.error('💡 Assurez-vous que Meilisearch est démarré:');
      console.error('   docker start meilisearch');
      console.error('   ou voir docs/MEILISEARCH-SETUP.md');
      process.exit(1);
    }
    console.log('✅ Meilisearch disponible\n');

    // Initialize index
    console.log('2️⃣  Initialisation de l\'index...');
    await meilisearchService.initializeIndex();
    console.log('✅ Index initialisé\n');

    // Index all contents
    console.log('3️⃣  Indexation des contenus...');
    const task = await meilisearchService.indexAllContents();
    console.log(`✅ Indexation lancée (Task ID: ${task.taskUid})\n`);

    // Get stats
    console.log('4️⃣  Statistiques de l\'index:');
    const stats = await meilisearchService.getStats();
    console.log(`   📊 Nombre de documents: ${stats.numberOfDocuments}`);
    console.log(`   🔍 En indexation: ${stats.isIndexing}\n`);

    console.log('🎉 Indexation terminée avec succès!\n');
    console.log('💡 Pour tester la recherche:');
    console.log('   GET http://localhost:3001/api/search?q=afrique');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erreur lors de l\'indexation:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
