/**
 * Metadata Extractor Service
 * Extracts title, author, duration, cover, etc. from EPUB and audio files.
 */

const JSZip = require('jszip');
const xml2js = require('xml2js');
const mm = require('music-metadata');

// ─── EPUB ─────────────────────────────────────────────────────────────────────

/**
 * Extracts Dublin Core metadata from an EPUB buffer.
 * @param {Buffer} buffer
 * @returns {Promise<EpubMeta>}
 */
async function extractEpubMetadata(buffer) {
  const zip = await JSZip.loadAsync(buffer);

  // 1. Find OPF path via META-INF/container.xml
  let opfPath = null;
  const containerFile = zip.file('META-INF/container.xml');
  if (containerFile) {
    const containerXml = await containerFile.async('text');
    const container = await xml2js.parseStringPromise(containerXml, { explicitArray: true });
    opfPath = container?.container?.rootfiles?.[0]?.rootfile?.[0]?.$?.['full-path'] || null;
  }
  // Fallback: scan for .opf file
  if (!opfPath) {
    const opfFile = Object.keys(zip.files).find(f => f.endsWith('.opf'));
    opfPath = opfFile || null;
  }
  if (!opfPath) return { error: 'OPF manifest not found in EPUB' };

  const opfFile = zip.file(opfPath);
  if (!opfFile) return { error: `OPF file not found at path: ${opfPath}` };

  const opfXml = await opfFile.async('text');
  const opf = await xml2js.parseStringPromise(opfXml, { explicitArray: true });

  const meta = opf?.package?.metadata?.[0] || {};
  const manifest = opf?.package?.manifest?.[0]?.item || [];

  // Helper to read a DC element (handles string or object with _ value)
  const dc = (key) => {
    const val = meta[`dc:${key}`]?.[0];
    if (!val) return null;
    return typeof val === 'object' ? (val._ || null) : val;
  };

  // Extract all authors
  const authors = (meta['dc:creator'] || []).map(c =>
    typeof c === 'object' ? (c._ || '') : c
  ).filter(Boolean);

  // Extract ISBN from dc:identifier
  const identifiers = meta['dc:identifier'] || [];
  let isbn = null;
  for (const id of identifiers) {
    const scheme = (typeof id === 'object' ? id?.$?.scheme : '') || '';
    const val = typeof id === 'object' ? id._ : id;
    if (scheme.toLowerCase().includes('isbn') || (val && /^97[89]/.test(val.replace(/-/g, '')))) {
      isbn = val; break;
    }
  }

  // Extract subjects
  const subjects = (meta['dc:subject'] || []).map(s =>
    typeof s === 'object' ? (s._ || '') : s
  ).filter(Boolean);

  // Raw date → year only
  const rawDate = dc('date');
  const year = rawDate ? rawDate.substring(0, 4) : null;

  // Normalize language code to 2-letter ISO 639-1
  const langMap = {
    'fr': 'fr', 'fra': 'fr', 'fre': 'fr', 'fr-fr': 'fr', 'fr-be': 'fr', 'fr-ca': 'fr', 'fr-ch': 'fr',
    'en': 'en', 'eng': 'en', 'en-us': 'en', 'en-gb': 'en', 'en-au': 'en',
    'es': 'es', 'spa': 'es', 'es-es': 'es', 'es-mx': 'es', 'es-ar': 'es',
    'ar': 'ar', 'ara': 'ar', 'ar-sa': 'ar', 'ar-eg': 'ar',
    'de': 'de', 'deu': 'de', 'ger': 'de',
    'pt': 'pt', 'por': 'pt', 'pt-br': 'pt', 'pt-pt': 'pt',
    'it': 'it', 'ita': 'it',
    'zh': 'zh', 'zho': 'zh', 'chi': 'zh',
  };
  const rawLang = dc('language');
  const normalizedLang = rawLang ? (langMap[rawLang.toLowerCase()] || rawLang.substring(0, 2).toLowerCase()) : null;

  // ── Cover image ─────────────────────────────────────────────
  const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';

  // Try manifest items with cover-image property or id containing "cover"
  const coverItem = manifest.find(item => {
    const props = item?.$?.properties || '';
    const id = (item?.$?.id || '').toLowerCase();
    const mt = item?.$?.['media-type'] || '';
    return props.includes('cover-image') || id === 'cover-image' || id === 'cover' ||
           (id.includes('cover') && mt.startsWith('image/'));
  });

  let coverBuffer = null;
  let coverMime = 'image/jpeg';

  if (coverItem) {
    const href = coverItem?.$?.href || '';
    coverMime = coverItem?.$?.['media-type'] || 'image/jpeg';
    // Try with OPF directory prefix, then root
    const candidates = [opfDir + href, href].filter(Boolean);
    for (const candidate of candidates) {
      const f = zip.file(candidate);
      if (f) { coverBuffer = await f.async('nodebuffer'); break; }
    }
  }

  // Fallback: look for cover in meta tags (OPF2 style)
  if (!coverBuffer) {
    const coverMeta = (meta.meta || []).find(m => m?.$?.name === 'cover');
    const coverId = coverMeta?.$?.content;
    if (coverId) {
      const item = manifest.find(i => i?.$?.id === coverId);
      if (item) {
        const href = item?.$?.href || '';
        coverMime = item?.$?.['media-type'] || 'image/jpeg';
        const candidates = [opfDir + href, href];
        for (const candidate of candidates) {
          const f = zip.file(candidate);
          if (f) { coverBuffer = await f.async('nodebuffer'); break; }
        }
      }
    }
  }

  // Strip HTML tags from description
  const rawDescription = dc('description');
  const description = rawDescription
    ? rawDescription.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || null
    : null;

  return {
    title:       dc('title'),
    author:      authors.join(', ') || null,
    description,
    language:    normalizedLang,
    publisher:   dc('publisher'),
    isbn,
    year,
    subjects,
    contentType: 'ebook',
    coverBuffer,
    coverMime,
  };
}

// ─── Audio ────────────────────────────────────────────────────────────────────

/**
 * Extracts ID3/iTunes metadata from an audio buffer (MP3, M4A, etc.).
 * @param {Buffer} buffer
 * @param {string} mimeType  e.g. 'audio/mpeg', 'audio/mp4'
 * @returns {Promise<AudioMeta>}
 */
async function extractAudioMetadata(buffer, mimeType) {
  const metadata = await mm.parseBuffer(buffer, { mimeType, duration: true });
  const { common, format } = metadata;

  let coverBuffer = null;
  let coverMime = 'image/jpeg';

  if (common.picture && common.picture.length > 0) {
    const pic = common.picture[0];
    coverBuffer = Buffer.from(pic.data);
    coverMime = pic.format || 'image/jpeg';
  }

  const durationSec = format.duration ? Math.round(format.duration) : null;

  return {
    title:       common.title   || null,
    author:      common.artist  || common.albumartist || null,
    description: common.comment?.[0]?.text || null,
    language:    null,
    year:        common.year    ? String(common.year) : null,
    duration:    durationSec,
    bitrate:     format.bitrate ? Math.round(format.bitrate / 1000) : null,
    sampleRate:  format.sampleRate || null,
    contentType: 'audiobook',
    coverBuffer,
    coverMime,
  };
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────

/**
 * Detects file type from mimetype/extension and routes to the right extractor.
 * @param {Buffer} buffer
 * @param {string} originalName
 * @param {string} mimeType
 */
async function extractMetadata(buffer, originalName, mimeType) {
  const ext = originalName.split('.').pop().toLowerCase();

  if (mimeType === 'application/epub+zip' || ext === 'epub') {
    return extractEpubMetadata(buffer);
  }

  const audioMimes = ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/mp3', 'audio/x-mp3'];
  const audioExts  = ['mp3', 'm4a', 'flac', 'ogg', 'aac'];
  if (audioMimes.includes(mimeType) || audioExts.includes(ext)) {
    return extractAudioMetadata(buffer, mimeType);
  }

  return { error: `Format non supporté: ${ext || mimeType}` };
}

module.exports = { extractMetadata, extractEpubMetadata, extractAudioMetadata };
