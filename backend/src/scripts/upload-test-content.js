/**
 * Script d'upload de contenu test vers Cloudflare R2
 * Upload un fichier ebook + cover et crée l'enregistrement dans Supabase
 *
 * Usage: node src/scripts/upload-test-content.js
 */

require('dotenv').config();
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

async function uploadFile(filePath, r2Key, bucket, contentType) {
  const fileContent = fs.readFileSync(filePath);
  const fileSize = fs.statSync(filePath).size;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: r2Key,
    Body: fileContent,
    ContentType: contentType,
  });

  await s3Client.send(command);

  return { key: r2Key, size: fileSize };
}

async function main() {
  console.log('🚀 Upload de contenu test vers R2...\n');

  try {
    // =========================================================================
    // ÉTAPE 1: Upload du fichier ebook
    // =========================================================================
    console.log('1️⃣  Upload ebook test...');

    const ebookPath = path.join(__dirname, '../../test-uploads/ebooks/test-ebook.txt');

    if (!fs.existsSync(ebookPath)) {
      throw new Error('Fichier test-ebook.txt non trouvé. Créez-le d\'abord.');
    }

    const ebookKey = 'test/ebooks/uploaded-test-' + Date.now() + '.txt';
    const ebook = await uploadFile(
      ebookPath,
      ebookKey,
      config.r2.bucketContent,
      'text/plain'
    );

    console.log(`   ✅ Ebook uploadé: ${ebookKey}`);
    console.log(`   📦 Taille: ${(ebook.size / 1024).toFixed(2)} KB`);

    // =========================================================================
    // ÉTAPE 2: Upload de la couverture
    // =========================================================================
    console.log('\n2️⃣  Upload cover test...');

    const coverPath = path.join(__dirname, '../../test-uploads/covers/test-cover.svg');

    if (!fs.existsSync(coverPath)) {
      console.log('   ⚠️  Pas de cover trouvée, utilisation placeholder');
    }

    const coverKey = 'covers/uploaded-test-' + Date.now() + '.svg';
    let coverUrl;

    if (fs.existsSync(coverPath)) {
      await uploadFile(
        coverPath,
        coverKey,
        config.r2.bucketCovers,
        'image/svg+xml'
      );

      // Générer URL publique
      if (config.r2.cdnDomain) {
        coverUrl = `${config.r2.cdnDomain}/${coverKey}`;
      } else {
        coverUrl = `https://pub-xxxxx.r2.dev/${coverKey}`;
      }

      console.log(`   ✅ Cover uploadée: ${coverKey}`);
      console.log(`   🖼️  URL: ${coverUrl}`);
    } else {
      coverUrl = 'https://placehold.co/600x900/B5651D/FFF?text=Test+Upload';
      console.log(`   ℹ️  Utilisation placeholder`);
    }

    // =========================================================================
    // ÉTAPE 3: Créer l'enregistrement dans Supabase
    // =========================================================================
    console.log('\n3️⃣  Création enregistrement Supabase...');

    // Trouver la catégorie "Romans"
    const { data: category } = await supabaseAdmin
      .from('categories')
      .select('id')
      .eq('slug', 'romans')
      .single();

    // Trouver un rights_holder
    const { data: rightsHolder } = await supabaseAdmin
      .from('rights_holders')
      .select('id')
      .limit(1)
      .single();

    // Créer le contenu
    const contentData = {
      title: 'Contenu Test Uploadé',
      author: 'Test Author',
      description: 'Ceci est un contenu de test uploadé via script. Il permet de tester le flow complet: upload R2 + création DB + génération signed URL.',
      content_type: 'ebook',
      format: 'epub',
      language: 'fr',
      cover_url: coverUrl,
      file_key: ebookKey,
      file_size_bytes: ebook.size,
      rights_holder_id: rightsHolder?.id || '00000000-0000-0000-0000-000000000001',
      is_published: true,
      published_at: new Date().toISOString(),
    };

    const { data: newContent, error: contentError } = await supabaseAdmin
      .from('contents')
      .insert(contentData)
      .select()
      .single();

    if (contentError) {
      throw contentError;
    }

    console.log(`   ✅ Contenu créé: ${newContent.id}`);
    console.log(`   📚 Titre: ${newContent.title}`);

    // Associer à la catégorie
    if (category) {
      await supabaseAdmin
        .from('content_categories')
        .insert({
          content_id: newContent.id,
          category_id: category.id,
        });

      console.log(`   ✅ Catégorie associée: Romans`);
    }

    // =========================================================================
    // ÉTAPE 4: Tester la génération de signed URL
    // =========================================================================
    console.log('\n4️⃣  Test génération signed URL...');

    const r2Service = require('../services/r2.service');
    const signedUrl = await r2Service.generatePresignedUrl(ebookKey, 900);

    console.log(`   ✅ Signed URL générée`);
    console.log(`   🔗 URL: ${signedUrl.substring(0, 80)}...`);
    console.log(`   ⏱️  Expire dans: 15 minutes`);

    // =========================================================================
    // RÉSUMÉ
    // =========================================================================
    console.log('\n' + '='.repeat(60));
    console.log('🎉 UPLOAD RÉUSSI!');
    console.log('='.repeat(60));

    console.log('\n📊 Résumé:');
    console.log(`   Content ID: ${newContent.id}`);
    console.log(`   File Key: ${ebookKey}`);
    console.log(`   Cover URL: ${coverUrl}`);
    console.log(`   File Size: ${(ebook.size / 1024).toFixed(2)} KB`);

    console.log('\n🧪 Pour tester via API:');
    console.log(`   GET  http://localhost:3001/api/contents/${newContent.id}`);
    console.log(`   GET  http://localhost:3001/api/contents/${newContent.id}/file-url`);
    console.log(`        (nécessite JWT + Subscription active)`);

    console.log('\n💡 Pour uploader vos propres fichiers:');
    console.log('   1. Placez vos ebooks dans: backend/test-uploads/ebooks/');
    console.log('   2. Placez vos covers dans: backend/test-uploads/covers/');
    console.log('   3. Modifiez ce script pour pointer vers vos fichiers');
    console.log('   4. Relancez: node src/scripts/upload-test-content.js\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
