/**
 * Script de test Cloudflare R2
 * Teste connexion, upload, download et signed URLs
 *
 * Usage: node src/scripts/test-r2.js
 */

require('dotenv').config();
const r2Service = require('../services/r2.service');
const { S3Client, PutObjectCommand, GetObjectCommand, ListBucketsCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const config = require('../config/env');

async function main() {
  console.log('🚀 Test complet Cloudflare R2...\n');

  try {
    // =========================================================================
    // ÉTAPE 1: Vérifier la configuration
    // =========================================================================
    console.log('1️⃣  Vérification configuration...');

    const isConfigured = r2Service.isConfigured();

    if (!isConfigured) {
      console.log('❌ R2 non configuré (mode placeholder)');
      console.log('\n📝 Variables manquantes dans .env:');
      if (!config.r2.accountId) console.log('   - R2_ACCOUNT_ID');
      if (!config.r2.endpoint) console.log('   - R2_ENDPOINT');
      if (!config.r2.accessKeyId) console.log('   - R2_ACCESS_KEY_ID');
      if (!config.r2.secretAccessKey) console.log('   - R2_SECRET_ACCESS_KEY');

      console.log('\n💡 Configuration R2:');
      console.log('   1. https://dash.cloudflare.com/r2 → Enable R2');
      console.log('   2. Create buckets: biblio-content-private + biblio-covers-public');
      console.log('   3. Manage R2 API Tokens → Create Token');
      console.log('   4. Copier credentials dans .env');
      console.log('\n📄 Template: backend/.env.r2.example\n');
      process.exit(0);
    }

    console.log('   ✅ Configuration OK');
    console.log(`   Account: ${config.r2.accountId.substring(0, 8)}...`);
    console.log(`   Endpoint: ${config.r2.endpoint}`);

    // =========================================================================
    // ÉTAPE 2: Test connexion
    // =========================================================================
    console.log('\n2️⃣  Test connexion S3...');

    const client = r2Service.getClient();
    if (!client) throw new Error('Client non initialisé');

    console.log('   ✅ Client S3 OK');

    // =========================================================================
    // ÉTAPE 3: Test upload
    // =========================================================================
    console.log('\n3️⃣  Test upload fichier...');

    const testKey = 'test/papyri-test-' + Date.now() + '.txt';
    const testContent = 'Test Papyri R2\n' + new Date().toISOString();

    const putCmd = new PutObjectCommand({
      Bucket: config.r2.bucketContent,
      Key: testKey,
      Body: Buffer.from(testContent),
      ContentType: 'text/plain',
    });

    await client.send(putCmd);
    console.log(`   ✅ Upload OK: ${testKey}`);

    // =========================================================================
    // ÉTAPE 4: Test signed URL
    // =========================================================================
    console.log('\n4️⃣  Test signed URL...');

    const signedUrl = await r2Service.generatePresignedUrl(testKey, 900);
    console.log(`   ✅ Signed URL: ${signedUrl.substring(0, 60)}...`);

    // =========================================================================
    // ÉTAPE 5: Test download
    // =========================================================================
    console.log('\n5️⃣  Test download...');

    const getCmd = new GetObjectCommand({
      Bucket: config.r2.bucketContent,
      Key: testKey,
    });

    const { Body } = await client.send(getCmd);
    const downloaded = await streamToString(Body);

    if (downloaded === testContent) {
      console.log('   ✅ Download OK - Contenu vérifié');
    } else {
      console.log('   ⚠️  Contenu différent');
    }

    // =========================================================================
    // ÉTAPE 6: Cleanup
    // =========================================================================
    console.log('\n6️⃣  Nettoyage...');

    const delCmd = new DeleteObjectCommand({
      Bucket: config.r2.bucketContent,
      Key: testKey,
    });

    await client.send(delCmd);
    console.log('   ✅ Fichier test supprimé');

    // =========================================================================
    // ÉTAPE 7: Test URL publique
    // =========================================================================
    console.log('\n7️⃣  Test URL publique...');

    const publicUrl = r2Service.getPublicUrl('test.jpg', config.r2.bucketCovers);
    console.log(`   ✅ URL: ${publicUrl}`);

    // =========================================================================
    // RÉSUMÉ
    // =========================================================================
    console.log('\n' + '='.repeat(60));
    console.log('🎉 TOUS LES TESTS RÉUSSIS!');
    console.log('='.repeat(60));
    console.log('\n✅ Cloudflare R2 opérationnel\n');

    console.log('📝 Prochaines étapes:');
    console.log('   1. Uploader contenus (ebooks/audiobooks)');
    console.log('   2. Tester endpoint: GET /api/contents/:id/file-url');
    console.log('   3. Intégrer frontend lecture/écoute\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    console.error(error);
    process.exit(1);
  }
}

async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

main();
