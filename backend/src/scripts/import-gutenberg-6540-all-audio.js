require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const config = require('../config/env');
const { supabaseAdmin } = require('../config/database');

const BASE_URL = 'https://www.gutenberg.org/files/6540/mp3';
const COVER_URL = 'https://www.gutenberg.org/cache/epub/6540/pg6540.cover.medium.jpg';
const TMP_DIR = '/tmp';

const FILES = [
  '6540-013.mp3',
  '6540-023.mp3',
  '6540-033.mp3',
  '6540-043.mp3',
  '6540-053.mp3',
  '6540-063.mp3',
  '6540-073.mp3',
  '6540-083.mp3',
  '6540-093.mp3',
  '6540-103.mp3',
  '6540-113.mp3',
  '6540-123.mp3',
  '6540-133.mp3',
  '6540-143.mp3',
  '6540-153.mp3',
  '6540-163.mp3',
  '6540-173.mp3',
  '6540-183.mp3',
  '6540-193.mp3',
  '6540-203.mp3',
  '6540-213.mp3',
];

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

async function getRemoteSize(url) {
  const response = await fetch(url, {
    method: 'HEAD',
    headers: {
      'User-Agent': 'BibliothequeNum/1.0',
    },
  });
  if (!response.ok) {
    throw new Error(`HEAD failed (${response.status}) for ${url}`);
  }
  const len = Number(response.headers.get('content-length') || 0);
  if (!Number.isFinite(len) || len <= 0) {
    throw new Error(`Invalid content-length for ${url}`);
  }
  return len;
}

function fileSize(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch (_) {
    return 0;
  }
}

function resumeDownload(url, outputPath, targetSize) {
  const maxAttempts = 20;
  for (let i = 1; i <= maxAttempts; i += 1) {
    const current = fileSize(outputPath);
    if (current >= targetSize) return true;

    console.log(`   Download attempt ${i} (${current}/${targetSize} bytes)`);
    const result = spawnSync(
      'curl',
      [
        '--http1.1',
        '-L',
        '--fail',
        '-C',
        '-',
        '--max-time',
        '180',
        url,
        '-o',
        outputPath,
      ],
      { stdio: 'inherit' }
    );

    if (result.status === 0 && fileSize(outputPath) >= targetSize) {
      return true;
    }
  }
  return fileSize(outputPath) >= targetSize;
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

async function contentExistsByFileKey(fileKey) {
  const { data } = await supabaseAdmin
    .from('contents')
    .select('id')
    .eq('file_key', fileKey)
    .maybeSingle();
  return data?.id || null;
}

async function insertContent(payload, categoryId) {
  const { data, error } = await supabaseAdmin
    .from('contents')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;

  if (categoryId) {
    await supabaseAdmin
      .from('content_categories')
      .insert({
        content_id: data.id,
        category_id: categoryId,
      });
  }

  return data;
}

async function main() {
  const s3 = buildS3Client();
  const rightsHolder = await ensureRightsHolder();
  const category = await ensureCategory('histoire');
  const failures = [];
  const imported = [];
  const skipped = [];

  for (let i = 0; i < FILES.length; i += 1) {
    const filename = FILES[i];
    const index = String(i + 1).padStart(2, '0');
    const url = `${BASE_URL}/${filename}`;
    const partLabel = filename.replace('.mp3', '');
    const r2Key = `audiobooks/gutenberg-6540-${partLabel}.mp3`;
    const localPath = path.join(TMP_DIR, filename);

    console.log(`\n[${index}/${FILES.length}] ${filename}`);

    try {
      const existingId = await contentExistsByFileKey(r2Key);
      if (existingId) {
        console.log(`   Skip (already in DB): ${existingId}`);
        skipped.push({ filename, reason: 'already_exists', id: existingId });
        continue;
      }

      const targetSize = await getRemoteSize(url);
      const ok = resumeDownload(url, localPath, targetSize);

      if (!ok) {
        throw new Error(`Download incomplete (${fileSize(localPath)}/${targetSize})`);
      }

      const buffer = fs.readFileSync(localPath);
      console.log(`   Upload R2 (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
      await s3.send(
        new PutObjectCommand({
          Bucket: config.r2.bucketContent,
          Key: r2Key,
          Body: buffer,
          ContentType: 'audio/mpeg',
        })
      );

      const content = await insertContent(
        {
          title: `The South Pole (Project Gutenberg #6540) - ${partLabel}`,
          author: 'Roald Amundsen',
          description: `Livre audio Project Gutenberg #6540 (${partLabel}). Source: https://www.gutenberg.org/ebooks/6540`,
          content_type: 'audiobook',
          format: 'mp3',
          language: 'en',
          cover_url: COVER_URL,
          file_key: r2Key,
          file_size_bytes: buffer.length,
          rights_holder_id: rightsHolder?.id || null,
          is_published: true,
          published_at: new Date().toISOString(),
        },
        category?.id || null
      );

      imported.push({ filename, id: content.id });
      console.log(`   OK -> content_id=${content.id}`);
    } catch (error) {
      console.error(`   FAILED: ${error.message}`);
      failures.push({ filename, error: error.message });
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Imported: ${imported.length}`);
  console.log(`Skipped: ${skipped.length}`);
  console.log(`Failed: ${failures.length}`);

  if (imported.length > 0) {
    console.log('Imported IDs:');
    imported.forEach((item) => console.log(` - ${item.filename} -> ${item.id}`));
  }

  if (failures.length > 0) {
    console.log('Failures:');
    failures.forEach((item) => console.log(` - ${item.filename}: ${item.error}`));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
