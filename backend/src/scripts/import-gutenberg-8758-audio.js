require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const config = require('../config/env');
const { supabaseAdmin } = require('../config/database');

const BOOK_ID = '8758';
const BOOK_URL = 'https://www.gutenberg.org/ebooks/8758';
const INDEX_URL = 'https://www.gutenberg.org/files/8758/8758-index.htm';
const AUDIO_BASE_URL = 'https://www.gutenberg.org/files/8758/mp3';
const COVER_URL = 'https://www.gutenberg.org/cache/epub/8758/pg8758.cover.medium.jpg';
const TMP_DIR = '/tmp/gutenberg-8758-audio';

const TITLE = 'Jungle Tales of Tarzan (Project Gutenberg #8758)';
const AUTHOR = 'Edgar Rice Burroughs';
const DESCRIPTION = 'Livre audio Project Gutenberg #8758. Source: https://www.gutenberg.org/ebooks/8758';
const MAX_CHAPTERS = Number(process.env.GUTENBERG_8758_MAX_CHAPTERS || 0);

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

async function fetchIndexHtml() {
  const response = await fetch(INDEX_URL, {
    headers: { 'User-Agent': 'BibliothequeNum/1.0 (+https://www.gutenberg.org/ebooks/8758)' },
  });
  if (!response.ok) throw new Error(`Impossible de charger l'index Gutenberg (${response.status})`);
  return response.text();
}

function extractMp3List(indexHtml) {
  const matches = [...indexHtml.matchAll(/mp3\/(8758-\d{3}\.mp3)/g)].map((m) => m[1]);
  const unique = Array.from(new Set(matches));
  unique.sort();
  return unique;
}

function fileSize(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch (_) {
    return 0;
  }
}

async function getRemoteSize(url) {
  const response = await fetch(url, {
    method: 'HEAD',
    headers: { 'User-Agent': 'BibliothequeNum/1.0 (+https://www.gutenberg.org/ebooks/8758)' },
  });
  if (!response.ok) throw new Error(`HEAD failed (${response.status}) for ${url}`);
  const len = Number(response.headers.get('content-length') || 0);
  if (!Number.isFinite(len) || len <= 0) throw new Error(`content-length invalide pour ${url}`);
  return len;
}

function resumeDownload(url, outputPath, targetSize) {
  const maxAttempts = 12;
  for (let i = 1; i <= maxAttempts; i += 1) {
    const current = fileSize(outputPath);
    if (current >= targetSize) return true;

    console.log(`   Download attempt ${i} (${current}/${targetSize})`);
    const result = spawnSync(
      'curl',
      [
        '--http1.1',
        '-L',
        '--fail',
        '-C',
        '-',
        '--max-time',
        '240',
        url,
        '-o',
        outputPath,
      ],
      { stdio: 'inherit' }
    );

    if (result.status === 0 && fileSize(outputPath) >= targetSize) return true;
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

async function findExistingContent() {
  const { data, error } = await supabaseAdmin
    .from('contents')
    .select('id,title')
    .eq('content_type', 'audiobook')
    .ilike('title', '%Project Gutenberg #8758%')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function upsertMainContent({ fileKey, fileSizeBytes, rightsHolderId }) {
  const existing = await findExistingContent();
  const payload = {
    title: TITLE,
    author: AUTHOR,
    description: DESCRIPTION,
    content_type: 'audiobook',
    format: 'mp3',
    language: 'en',
    cover_url: COVER_URL,
    file_key: fileKey,
    file_size_bytes: fileSizeBytes,
    rights_holder_id: rightsHolderId || null,
    is_published: true,
    published_at: new Date().toISOString(),
    metadata: {
      source: BOOK_URL,
      gutenberg_id: BOOK_ID,
    },
  };

  if (existing?.id) {
    const { data, error } = await supabaseAdmin
      .from('contents')
      .update(payload)
      .eq('id', existing.id)
      .select('id,title')
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabaseAdmin
    .from('contents')
    .insert(payload)
    .select('id,title')
    .single();
  if (error) throw error;
  return data;
}

async function upsertCategoryLink(contentId, categoryId) {
  if (!categoryId) return;
  const { data: existing } = await supabaseAdmin
    .from('content_categories')
    .select('id')
    .eq('content_id', contentId)
    .eq('category_id', categoryId)
    .maybeSingle();

  if (!existing) {
    await supabaseAdmin.from('content_categories').insert({
      content_id: contentId,
      category_id: categoryId,
    });
  }
}

async function replaceChapters(parentContentId, chapters) {
  const { error: deleteError } = await supabaseAdmin
    .from('audiobook_chapters')
    .delete()
    .eq('parent_content_id', parentContentId);
  if (deleteError) throw deleteError;

  const rows = chapters.map((chapter, idx) => ({
    parent_content_id: parentContentId,
    chapter_number: idx + 1,
    title: chapter.title,
    start_seconds: 0,
    end_seconds: null,
    duration_seconds: null,
    chapter_content_id: parentContentId,
    chapter_file_key: chapter.fileKey,
    chapter_format: 'mp3',
    metadata: {
      source_file: chapter.filename,
      source_url: chapter.url,
    },
  }));

  const { error: insertError } = await supabaseAdmin
    .from('audiobook_chapters')
    .insert(rows);
  if (insertError) throw insertError;
}

function prettyChapterTitle(filename, idx) {
  return `Jungle Tales of Tarzan - Chapter ${String(idx + 1).padStart(2, '0')}`;
}

async function main() {
  if (!config.r2.endpoint || !config.r2.accessKeyId || !config.r2.secretAccessKey) {
    throw new Error('R2 non configuré: endpoint/access keys manquants.');
  }

  fs.mkdirSync(TMP_DIR, { recursive: true });
  const s3 = buildS3Client();
  const rightsHolder = await ensureRightsHolder();
  const category = await ensureCategory('histoire');

  console.log('Chargement index Gutenberg...');
  const indexHtml = await fetchIndexHtml();
  const files = extractMp3List(indexHtml);
  if (!files.length) throw new Error('Aucun MP3 détecté dans l’index Gutenberg 8758.');
  const selectedFiles =
    Number.isFinite(MAX_CHAPTERS) && MAX_CHAPTERS > 0
      ? files.slice(0, MAX_CHAPTERS)
      : files;
  console.log(`MP3 détectés: ${files.length} | Importés: ${selectedFiles.length}`);

  const importedChapters = [];

  for (let i = 0; i < selectedFiles.length; i += 1) {
    const filename = selectedFiles[i];
    const url = `${AUDIO_BASE_URL}/${filename}`;
    const localPath = path.join(TMP_DIR, filename);
    const r2Key = `audiobooks/gutenberg-8758/${filename}`;

    console.log(`\n[${i + 1}/${selectedFiles.length}] ${filename}`);
    const targetSize = await getRemoteSize(url);
    const ok = resumeDownload(url, localPath, targetSize);
    if (!ok) throw new Error(`Téléchargement incomplet pour ${filename}`);

    const body = fs.readFileSync(localPath);
    await s3.send(
      new PutObjectCommand({
        Bucket: config.r2.bucketContent,
        Key: r2Key,
        Body: body,
        ContentType: 'audio/mpeg',
      })
    );

    importedChapters.push({
      filename,
      url,
      fileKey: r2Key,
      fileSize: body.length,
      title: prettyChapterTitle(filename, i),
    });
    console.log(`   Upload OK (${(body.length / 1024 / 1024).toFixed(2)} MB)`);
  }

  const mainFile = importedChapters[0];
  const content = await upsertMainContent({
    fileKey: mainFile.fileKey,
    fileSizeBytes: mainFile.fileSize,
    rightsHolderId: rightsHolder?.id || null,
  });
  await upsertCategoryLink(content.id, category?.id || null);
  await replaceChapters(content.id, importedChapters);

  console.log('\n=== IMPORT TERMINÉ ===');
  console.log(`Content ID: ${content.id}`);
  console.log(`Titre: ${TITLE}`);
  console.log(`Chapitres: ${importedChapters.length}`);
}

main().catch((error) => {
  console.error('\nErreur import Gutenberg 8758 audio:');
  console.error(error);
  process.exit(1);
});
