require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const config = require('../config/env');
const { supabaseAdmin } = require('../config/database');

const inputFile = process.argv[2];

if (!inputFile || !/^6540-\d{3}\.mp3$/.test(inputFile)) {
  console.error('Usage: node src/scripts/import-gutenberg-6540-part.js 6540-023.mp3');
  process.exit(1);
}

const localPath = path.join('/tmp', inputFile);
const partLabel = inputFile.replace('.mp3', '');
const r2Key = `audiobooks/gutenberg-6540-${partLabel}.mp3`;

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

async function ensureCategory(slug = 'histoire') {
  const { data } = await supabaseAdmin
    .from('categories')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  return data || null;
}

async function ensureRightsHolder() {
  const { data } = await supabaseAdmin
    .from('rights_holders')
    .select('id')
    .limit(1)
    .maybeSingle();
  return data || null;
}

async function main() {
  if (!fs.existsSync(localPath)) {
    throw new Error(`Local file missing: ${localPath}`);
  }

  const { data: existing } = await supabaseAdmin
    .from('contents')
    .select('id')
    .eq('file_key', r2Key)
    .maybeSingle();

  if (existing?.id) {
    console.log(`SKIP already exists: ${existing.id}`);
    return;
  }

  const buffer = fs.readFileSync(localPath);
  const s3 = buildS3Client();
  const rightsHolder = await ensureRightsHolder();
  const category = await ensureCategory('histoire');

  console.log(`Uploading ${inputFile} to R2 (${(buffer.length / 1024 / 1024).toFixed(2)} MB)...`);
  await s3.send(
    new PutObjectCommand({
      Bucket: config.r2.bucketContent,
      Key: r2Key,
      Body: buffer,
      ContentType: 'audio/mpeg',
    })
  );

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('contents')
    .insert({
      title: `The South Pole (Project Gutenberg #6540) - ${partLabel}`,
      author: 'Roald Amundsen',
      description: `Livre audio Project Gutenberg #6540 (${partLabel}). Source: https://www.gutenberg.org/ebooks/6540`,
      content_type: 'audiobook',
      format: 'mp3',
      language: 'en',
      cover_url: 'https://www.gutenberg.org/cache/epub/6540/pg6540.cover.medium.jpg',
      file_key: r2Key,
      file_size_bytes: buffer.length,
      rights_holder_id: rightsHolder?.id || null,
      is_published: true,
      published_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError) throw insertError;

  if (category?.id) {
    await supabaseAdmin.from('content_categories').insert({
      content_id: inserted.id,
      category_id: category.id,
    });
  }

  console.log(`IMPORTED ${inputFile} -> ${inserted.id}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
