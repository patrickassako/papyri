import JSZip from 'jszip';

function decodeEntities(input) {
  return String(input || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function stripHtmlToParagraphs(html) {
  const normalized = String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|section|article|h1|h2|h3|h4|h5|h6|li|blockquote|tr)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  const decoded = decodeEntities(normalized)
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return decoded
    .split(/\n{2,}/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter((part) => part.length > 0);
}

function stripTagsToText(input) {
  return decodeEntities(String(input || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function getAttr(tagText, attrName) {
  const quoted = new RegExp(`${attrName}\\s*=\\s*"([^"]*)"`, 'i').exec(tagText);
  if (quoted?.[1] != null) return quoted[1];
  const single = new RegExp(`${attrName}\\s*=\\s*'([^']*)'`, 'i').exec(tagText);
  return single?.[1] || '';
}

function normalizePath(path) {
  const parts = String(path || '').split('/');
  const stack = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      stack.pop();
      continue;
    }
    stack.push(part);
  }
  return stack.join('/');
}

function dirname(path) {
  const normalized = normalizePath(path);
  const idx = normalized.lastIndexOf('/');
  return idx >= 0 ? normalized.slice(0, idx) : '';
}

function resolveRelative(baseDir, relativePath) {
  const rel = String(relativePath || '').trim();
  if (!rel) return '';
  if (/^[a-z]+:\/\//i.test(rel)) return rel;
  if (rel.startsWith('/')) return normalizePath(rel.slice(1));
  return normalizePath(`${baseDir}/${rel}`);
}

function extractTitleFromHtml(html, fallbackTitle) {
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  if (h1?.[1]) {
    const value = decodeEntities(h1[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    if (value) return value;
  }
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (title?.[1]) {
    const value = decodeEntities(title[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    if (value) return value;
  }
  return fallbackTitle;
}

function extractSectionsFromHtml(html, fallbackTitle) {
  const sections = [];
  const headingRegex = /<(h1|h2|h3)[^>]*>([\s\S]*?)<\/\1>/gi;
  const headingMatches = [];

  let headingMatch = headingRegex.exec(html);
  while (headingMatch) {
    headingMatches.push({
      start: headingMatch.index,
      end: headingRegex.lastIndex,
      title: stripTagsToText(headingMatch[2]) || fallbackTitle,
    });
    headingMatch = headingRegex.exec(html);
  }

  if (headingMatches.length >= 2) {
    for (let i = 0; i < headingMatches.length; i += 1) {
      const current = headingMatches[i];
      const next = headingMatches[i + 1];
      const chunk = html.slice(current.end, next ? next.start : html.length);
      const paragraphs = stripHtmlToParagraphs(chunk);
      if (paragraphs.length === 0) continue;
      sections.push({
        title: current.title || `${fallbackTitle} ${i + 1}`,
        paragraphs,
      });
    }
  }

  if (sections.length > 0) return sections;

  const paragraphs = stripHtmlToParagraphs(html);
  if (paragraphs.length === 0) return [];
  return [{ title: fallbackTitle, paragraphs }];
}

function parseManifest(opfText) {
  const manifest = new Map();
  const itemRegex = /<item\b([^>]*?)\/?>/gi;
  let match = itemRegex.exec(opfText);
  while (match) {
    const attrs = match[1] || '';
    const id = getAttr(attrs, 'id');
    const href = getAttr(attrs, 'href');
    const mediaType = getAttr(attrs, 'media-type');
    if (id && href) {
      manifest.set(id, { id, href, mediaType });
    }
    match = itemRegex.exec(opfText);
  }
  return manifest;
}

function parseSpineIds(opfText) {
  const ids = [];
  const itemRefRegex = /<itemref\b([^>]*?)\/?>/gi;
  let match = itemRefRegex.exec(opfText);
  while (match) {
    const attrs = match[1] || '';
    const idRef = getAttr(attrs, 'idref');
    if (idRef) ids.push(idRef);
    match = itemRefRegex.exec(opfText);
  }
  return ids;
}

export async function parseEpubArrayBuffer(arrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const containerFile = zip.file('META-INF/container.xml');
  if (!containerFile) {
    throw new Error("EPUB invalide: META-INF/container.xml introuvable.");
  }

  const containerXml = await containerFile.async('string');
  const opfMatch = /full-path\s*=\s*"([^"]+)"/i.exec(containerXml) || /full-path\s*=\s*'([^']+)'/i.exec(containerXml);
  const opfPath = opfMatch?.[1] ? normalizePath(opfMatch[1]) : '';
  if (!opfPath) {
    throw new Error('EPUB invalide: chemin OPF introuvable.');
  }

  const opfFile = zip.file(opfPath);
  if (!opfFile) {
    throw new Error('EPUB invalide: package OPF introuvable.');
  }

  const opfText = await opfFile.async('string');
  const manifest = parseManifest(opfText);
  const spineIds = parseSpineIds(opfText);
  const opfDir = dirname(opfPath);

  const chapterFiles = spineIds
    .map((id) => manifest.get(id))
    .filter(Boolean)
    .filter((item) => /xhtml|html/i.test(item.mediaType || item.href || ''));

  if (chapterFiles.length === 0) {
    throw new Error('EPUB sans chapitres HTML exploitables.');
  }

  const chapters = [];
  let globalParagraphCount = 0;

  for (let index = 0; index < chapterFiles.length; index += 1) {
    const chapterMeta = chapterFiles[index];
    const chapterPath = resolveRelative(opfDir, chapterMeta.href);
    const chapterFile = zip.file(chapterPath);
    if (!chapterFile) continue;

    const html = await chapterFile.async('string');
    const fallbackTitle = extractTitleFromHtml(html, `Chapitre ${chapters.length + 1}`);
    const sections = extractSectionsFromHtml(html, fallbackTitle);
    for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
      const section = sections[sectionIndex];
      chapters.push({
        id: `${chapterMeta.id || `chapter-${chapters.length + 1}`}-${sectionIndex + 1}`,
        title: section.title || fallbackTitle,
        paragraphs: section.paragraphs,
        startIndex: globalParagraphCount,
      });
      globalParagraphCount += section.paragraphs.length;
    }
  }

  if (chapters.length === 0) {
    throw new Error('EPUB chargé mais aucun texte lisible trouvé.');
  }

  const allParagraphs = chapters.flatMap((chapter) => chapter.paragraphs);
  const total = Math.max(1, allParagraphs.length);
  const chapterAnchors = chapters.map((chapter, idx) => ({
    id: chapter.id || `chapter-${idx + 1}`,
    title: chapter.title || `Chapitre ${idx + 1}`,
    startPercent: Math.max(0, Math.min(100, (chapter.startIndex / total) * 100)),
  }));

  return {
    paragraphs: allParagraphs,
    chapterAnchors,
  };
}
