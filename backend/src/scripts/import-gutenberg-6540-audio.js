require('dotenv').config();
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const config = require('../config/env');
const { supabaseAdmin } = require('../config/database');

const SOURCE_URL = 'https://www.gutenberg.org/files/6540/mp3/6540-013.mp3';
const LOCAL_SOURCE_FILE = process.env.GUTENBERG_LOCAL_FILE || '/tmp/gutenberg-6540-013.mp3';
const R2_KEY = 'audiobooks/gutenberg-6540-south-pole-part-01.mp3';

const CONTENT_PAYLOAD = {
  title: 'The South Pole (Project Gutenberg #6540) - Part 1',
  author: 'Roald Amundsen',
  description:
    'Version audio provenant de Project Gutenberg (fichier 6540-013.mp3). ' +
    'Source: https://www.gutenberg.org/ebooks/6540',
  content_type: 'audiobook',
  format: 'mp3',
  language: 'en',
  cover_url: 'https://www.gutenberg.org/cache/epub/6540/pg6540.cover.medium.jpg',
  file_key: R2_KEY,
  is_published: true,
  published_at: new Date().toISOString(),
};

function buildS3Client() {
  return new S3Client({
    region: 'auto',
    endpoint: config.r2.endpoint,
    credentials: {
      accessKeyId: config.r2.accessKeyId,
      secretAccessKey: config.r2.secretAccessKey,
    },
  });
}

async function fetchBinary(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'BibliothequeNum/1.0 (+https://www.gutenberg.org/ebooks/6540)',
    },
  });

  if (!response.ok) {
    throw new Error(`Téléchargement Gutenberg échoué: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    buffer,
    contentType: response.headers.get('content-type') || 'audio/mpeg',
  };
}

function readLocalBinary(filePath) {
  const buffer = fs.readFileSync(filePath);
  return {
    buffer,
    contentType: 'audio/mpeg',
  };
}

async function ensureCategory(slug = 'histoire') {
  const { data: category } = await supabaseAdmin
    .from('categories')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  return category || null;
}

async function ensureRightsHolder() {
  const { data: rightsHolder } = await supabaseAdmin
    .from('rights_holders')
    .select('id')
    .limit(1)
    .maybeSingle();
  return rightsHolder || null;
}

async function main() {
  try {
    let buffer;
    let contentType;
    if (fs.existsSync(LOCAL_SOURCE_FILE)) {
      console.log(`1) Lecture fichier local: ${LOCAL_SOURCE_FILE}`);
      const local = readLocalBinary(LOCAL_SOURCE_FILE);
      buffer = local.buffer;
      contentType = local.contentType;
      console.log(`   OK (${(buffer.length / (1024 * 1024)).toFixed(2)} MB)`);
    } else {
      console.log('1) Téléchargement MP3 depuis Gutenberg...');
      const remote = await fetchBinary(SOURCE_URL);
      buffer = remote.buffer;
      contentType = remote.contentType;
      console.log(`   OK (${(buffer.length / (1024 * 1024)).toFixed(2)} MB)`);
    }

    console.log('2) Upload vers R2...');
    const s3 = buildS3Client();
    await s3.send(
      new PutObjectCommand({
        Bucket: config.r2.bucketContent,
        Key: R2_KEY,
        Body: buffer,
        ContentType: contentType,
      })
    );
    console.log(`   OK (${R2_KEY})`);

    console.log('3) Vérification doublon en base...');
    const { data: existing } = await supabaseAdmin
      .from('contents')
      .select('id')
      .eq('file_key', R2_KEY)
      .maybeSingle();

    if (existing?.id) {
      console.log(`   Déjà présent: ${existing.id}`);
      process.exit(0);
    }

    const rightsHolder = await ensureRightsHolder();
    const category = await ensureCategory('histoire');

    console.log('4) Insertion content...');
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('contents')
      .insert({
        ...CONTENT_PAYLOAD,
        file_size_bytes: buffer.length,
        rights_holder_id: rightsHolder?.id || null,
      })
      .select()
      .single();

    if (insertError) throw insertError;
    console.log(`   OK content_id=${inserted.id}`);

    if (category?.id) {
      const { error: linkError } = await supabaseAdmin
        .from('content_categories')
        .insert({
          content_id: inserted.id,
          category_id: category.id,
        });

      if (linkError) {
        console.warn(`   Warning category link: ${linkError.message}`);
      } else {
        console.log('5) Catégorie liée (histoire).');
      }
    }

    console.log('\nImport terminé.');
    console.log(`Content ID: ${inserted.id}`);
    process.exit(0);
  } catch (error) {
    console.error('\nErreur import Gutenberg 6540 audio:');
    console.error(error);
    process.exit(1);
  }
}

main();
