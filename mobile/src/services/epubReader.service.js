/**
 * Lightweight EPUB reader service using JSZip in the RN JS thread.
 * Extracts one chapter at a time — WebView never sees the full EPUB.
 */
import * as FileSystem from 'expo-file-system';
import JSZip from 'jszip';

function getAttr(tag, attr) {
  const re = new RegExp(attr + '=["\']([^"\']+)["\']', 'i');
  const m = tag.match(re);
  return m ? m[1] : null;
}

function getRootfilePath(containerXml) {
  const m = containerXml.match(/full-path=["\']([^"\']+)["\']/i);
  return m ? m[1] : null;
}

function parseOpf(opfXml, opfPath) {
  const basePath = opfPath.includes('/')
    ? opfPath.substring(0, opfPath.lastIndexOf('/'))
    : '';

  // manifest: id → href
  const manifest = {};
  const itemRe = /<item\s[^>]*>/gi;
  let m;
  while ((m = itemRe.exec(opfXml)) !== null) {
    const id = getAttr(m[0], 'id');
    const href = getAttr(m[0], 'href');
    if (id && href) manifest[id] = href;
  }

  // spine: ordered hrefs
  const spine = [];
  const itemrefRe = /<itemref\s[^>]*>/gi;
  while ((m = itemrefRe.exec(opfXml)) !== null) {
    const idref = getAttr(m[0], 'idref');
    if (idref && manifest[idref]) spine.push(manifest[idref]);
  }

  // ncx toc file (epub2)
  const spineTag = opfXml.match(/<spine[^>]*>/i)?.[0] || '';
  const ncxId = getAttr(spineTag, 'toc');
  const ncxHref = ncxId && manifest[ncxId] ? manifest[ncxId] : null;

  // nav document (epub3)
  let navHref = null;
  const navItemRe = /<item\s[^>]*properties=["\'][^"\']*nav[^"\']*["\'][^>]*>/i;
  const navItem = opfXml.match(navItemRe)?.[0];
  if (navItem) navHref = getAttr(navItem, 'href');

  return { basePath, spine, manifest, ncxHref, navHref };
}

function parseTocNcx(ncxXml) {
  const toc = [];
  const re = /<navPoint[\s\S]*?<text>([\s\S]*?)<\/text>[\s\S]*?<content[^>]+src=["\']([^"\'#]+)/gi;
  let m;
  while ((m = re.exec(ncxXml)) !== null) {
    const label = m[1].replace(/<[^>]+>/g, '').trim();
    const href = m[2];
    if (label && href) toc.push({ label, href });
  }
  return toc;
}

function resolveHref(basePath, href) {
  if (!href) return '';
  if (href.startsWith('/')) return href.slice(1);
  if (!basePath) return href;
  return `${basePath}/${href}`;
}

// Injected by BookReaderScreen via postMessage({ type:'setTheme', dark: bool })
// Default: light (matches web reader light mode)
const READER_STYLES = `
  :root {
    --bg: #ffffff;
    --text: #2a2a2a;
    --heading: #1a1a1a;
    --link: #f4a825;
    --pad: 24px 20px 80px;
  }
  html, body { margin: 0; padding: 0; background: var(--bg); }
  body { font-family: Lora, Georgia, 'Times New Roman', serif;
         font-size: 17px; line-height: 1.8;
         padding: var(--pad); color: var(--text);
         max-width: 100%; word-wrap: break-word; }
  h1,h2,h3,h4,h5,h6 { font-family: Lora, Georgia, serif; color: var(--heading);
                       margin: 1.3em 0 0.5em; line-height: 1.3; }
  p { margin: 0 0 1.1em; }
  img { max-width: 100%; height: auto; display: block; margin: 1em auto; }
  a { color: var(--link); text-decoration: none; }
  blockquote { border-left: 3px solid var(--link); margin: 1em 0 1em 0;
               padding-left: 16px; color: rgba(42,42,42,0.7); font-style: italic; }
`;

const SELECTION_SCRIPT = `
<script>
(function() {
  var timer = null;
  function notifySelection() {
    var sel = window.getSelection ? window.getSelection() : null;
    var text = sel ? sel.toString().trim() : '';
    if (text && text.length > 1 && window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'textSelected', payload: { text: text, cfiRange: '' } }));
    }
  }
  document.addEventListener('mouseup', function() { clearTimeout(timer); timer = setTimeout(notifySelection, 200); });
  document.addEventListener('touchend', function(e) { clearTimeout(timer); timer = setTimeout(notifySelection, 400); });

  // Swipe left/right → change chapter
  var _sx = 0, _sy = 0, _sTime = 0;
  document.addEventListener('touchstart', function(e) {
    _sx = e.touches[0].clientX;
    _sy = e.touches[0].clientY;
    _sTime = Date.now();
  }, { passive: true });
  document.addEventListener('touchend', function(e) {
    var dx = e.changedTouches[0].clientX - _sx;
    var dy = e.changedTouches[0].clientY - _sy;
    var dt = Date.now() - _sTime;
    // horizontal swipe: fast (<500ms), wide (>60px), more horizontal than vertical
    if (dt < 500 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      var type = dx < 0 ? 'swipeNext' : 'swipePrev';
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({ type: type }));
    }
  }, { passive: true });
  function applyTheme(bg, textColor) {
    var root = document.documentElement;
    var resolvedBg = bg || '#ffffff';
    var resolvedText = textColor || '#2a2a2a';
    root.style.setProperty('--bg', resolvedBg);
    root.style.setProperty('--text', resolvedText);
    root.style.setProperty('--heading', resolvedText);
    document.body.style.background = resolvedBg;
    document.body.style.color = resolvedText;
  }
  function handleMsg(e) {
    try {
      var d = JSON.parse(e.data);
      if (!d) return;
      if (d.type === 'clearSelection') { if (window.getSelection) window.getSelection().removeAllRanges(); }
      if (d.type === 'setTheme') { applyTheme(d.bg, d.textColor); }
      if (d.type === 'setFontSize') { document.body.style.fontSize = d.size + 'px'; }
    } catch(_) {}
  }
  window.addEventListener('message', handleMsg);
  document.addEventListener('message', handleMsg);
})();
</script>`;

function wrapChapterHtml(rawHtml) {
  // Remove scripts
  let html = rawHtml.replace(/<script[\s\S]*?<\/script>/gi, '');
  // Strip existing style/link to avoid font-size conflicts
  html = html.replace(/<link[^>]+stylesheet[^>]*>/gi, '');

  // Extract body content if full HTML doc
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const bodyContent = bodyMatch ? bodyMatch[1] : html;

  return `<!doctype html><html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=3"/>
<style>${READER_STYLES}</style>
</head>
<body>${bodyContent}${SELECTION_SCRIPT}</body>
</html>`;
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Load an EPUB from a local file URI and parse its structure.
 * Returns { zip, spine, basePath, toc }
 */
export async function loadEpub(fileUri) {
  const b64 = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const zip = await JSZip.loadAsync(b64, { base64: true });

  const containerFile = zip.file('META-INF/container.xml');
  if (!containerFile) throw new Error('EPUB invalide: META-INF/container.xml manquant');
  const containerXml = await containerFile.async('string');

  const opfPath = getRootfilePath(containerXml);
  if (!opfPath) throw new Error('EPUB invalide: chemin OPF introuvable');

  const opfFile = zip.file(opfPath);
  if (!opfFile) throw new Error(`EPUB invalide: OPF introuvable à ${opfPath}`);
  const opfXml = await opfFile.async('string');

  const { basePath, spine, ncxHref, navHref } = parseOpf(opfXml, opfPath);

  if (spine.length === 0) throw new Error('EPUB invalide: spine vide');

  // Parse TOC
  let toc = [];
  const tocFile = ncxHref
    ? zip.file(resolveHref(basePath, ncxHref))
    : navHref
      ? zip.file(resolveHref(basePath, navHref))
      : null;
  if (tocFile) {
    try {
      const tocXml = await tocFile.async('string');
      toc = parseTocNcx(tocXml);
    } catch (_) {}
  }
  if (toc.length === 0) {
    toc = spine.map((href, i) => ({ label: `Chapitre ${i + 1}`, href }));
  }

  return { zip, spine, basePath, toc };
}

function getMimeType(href) {
  const ext = href.split('.').pop().toLowerCase().split('?')[0];
  const map = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp', bmp: 'image/bmp' };
  return map[ext] || 'image/jpeg';
}

/**
 * Resolve a path relative to the chapter file's own directory inside the zip.
 * e.g. chapterPath = "OEBPS/Text/ch01.xhtml", imgSrc = "../Images/fig1.png"
 *   → "OEBPS/Images/fig1.png"
 */
function resolveRelativePath(chapterPath, src) {
  if (!src || src.startsWith('data:') || src.startsWith('http')) return null;
  // chapter's directory
  const chapterDir = chapterPath.includes('/') ? chapterPath.substring(0, chapterPath.lastIndexOf('/')) : '';
  // Combine and normalise
  const combined = chapterDir ? `${chapterDir}/${src}` : src;
  // Resolve .. segments
  const parts = combined.split('/');
  const resolved = [];
  for (const p of parts) {
    if (p === '..') { resolved.pop(); }
    else if (p !== '.') { resolved.push(p); }
  }
  return resolved.join('/');
}

/** Lookup zip file with case-insensitive fallback. */
function zipFile(zip, path) {
  const direct = zip.file(path);
  if (direct) return direct;
  // fallback: scan all files for case-insensitive match
  const lower = path.toLowerCase();
  let found = null;
  zip.forEach((relativePath, file) => {
    if (!found && relativePath.toLowerCase() === lower) found = file;
  });
  return found;
}

/**
 * Collect all image references in an HTML/XHTML chapter and return
 * an array of { original, attrName, src, absPath, file } objects.
 * Handles: <img src>, <image xlink:href>, <image href> (SVG cover pages).
 */
function collectImageRefs(html, zip, chapterPath) {
  const refs = [];

  // Pattern 1 — <img src="...">
  const imgRe = /<img\b[^>]*\/?>/gi;
  const srcRe = /\bsrc=(["'])([^"']+)\1/i;
  let m;
  while ((m = imgRe.exec(html)) !== null) {
    const tag = m[0];
    const srcMatch = srcRe.exec(tag);
    if (!srcMatch) continue;
    const src = srcMatch[2];
    if (src.startsWith('data:')) continue;
    const absPath = resolveRelativePath(chapterPath, src);
    if (!absPath) continue;
    const file = zipFile(zip, absPath);
    if (!file) continue;
    refs.push({ original: tag, attrName: 'src', src, absPath, file });
  }

  // Pattern 2 — SVG <image xlink:href="..."> and <image href="...">
  const svgImgRe = /<image\b[^>]*\/?>/gi;
  const xlinkRe = /xlink:href=(["'])([^"']+)\1/i;
  const hrefRe  = /\bhref=(["'])([^"']+)\1/i;
  while ((m = svgImgRe.exec(html)) !== null) {
    const tag = m[0];
    const xlinkMatch = xlinkRe.exec(tag);
    const hrefMatch  = !xlinkMatch && hrefRe.exec(tag);
    const match = xlinkMatch || hrefMatch;
    if (!match) continue;
    const src = match[2];
    if (src.startsWith('data:')) continue;
    const absPath = resolveRelativePath(chapterPath, src);
    if (!absPath) continue;
    const file = zipFile(zip, absPath);
    if (!file) continue;
    refs.push({
      original: tag,
      attrName: xlinkMatch ? 'xlink:href' : 'href',
      src,
      absPath,
      file,
    });
  }

  return refs;
}

/**
 * Replace all image references with inline base64 data URIs.
 * Covers <img src>, <image xlink:href>, <image href>.
 */
async function inlineImages(html, zip, chapterPath) {
  const refs = collectImageRefs(html, zip, chapterPath);
  if (refs.length === 0) return html;

  const replacements = await Promise.all(
    refs.map(async ({ original, attrName, src, absPath, file }) => {
      try {
        const b64 = await file.async('base64');
        const dataUri = `data:${getMimeType(absPath)};base64,${b64}`;
        // Replace the specific attribute value in the tag
        const attrRe = new RegExp(
          attrName.replace(':', '\\:') + '=(["\']).+?\\1',
          'i'
        );
        const newTag = original.replace(attrRe, `${attrName}="${dataUri}"`);
        return { original, newTag };
      } catch {
        return null;
      }
    })
  );

  let out = html;
  for (const r of replacements) {
    if (r && r.original !== r.newTag) {
      out = out.split(r.original).join(r.newTag);
    }
  }
  return out;
}

const SCROLL_TRACK_SCRIPT = `
<script>
(function() {
  var _ticking = false;
  function reportScroll() {
    var el = document.documentElement;
    var scrollable = el.scrollHeight - el.clientHeight;
    if (scrollable <= 0) return;
    var pct = Math.round((el.scrollTop / scrollable) * 100);
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'scrollProgress', percent: pct }));
    }
    _ticking = false;
  }
  document.addEventListener('scroll', function() {
    if (!_ticking) { _ticking = true; requestAnimationFrame(reportScroll); }
  }, { passive: true });
})();
</script>`;

/**
 * Concatenate all spine chapters into one scrollable HTML document.
 * Uses a thin separator between chapters.
 */
export async function getAllChaptersHtml(zip, basePath, spine, onProgress) {
  const parts = [];
  for (let i = 0; i < spine.length; i++) {
    const spineHref = spine[i];
    const filePath = resolveHref(basePath, spineHref);
    let file = zip.file(filePath) || zip.file(spineHref);
    if (!file) { parts.push('<p style="color:red">Chapitre introuvable.</p>'); continue; }
    let raw = await file.async('string');
    raw = await inlineImages(raw, zip, filePath);
    // Extract body content only
    const bodyMatch = raw.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    parts.push(bodyMatch ? bodyMatch[1] : raw.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<link[^>]+stylesheet[^>]*>/gi, ''));
    if (onProgress) onProgress(Math.round(((i + 1) / spine.length) * 100));
  }
  const body = parts.join(`<hr style="border:none;border-top:1px solid rgba(0,0,0,0.08);margin:32px 0;"/>`);
  return `<!doctype html><html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=3"/>
<style>${READER_STYLES}</style>
</head>
<body>${body}${SELECTION_SCRIPT}${SCROLL_TRACK_SCRIPT}</body>
</html>`;
}

/**
 * Get the HTML content of a specific spine chapter (0-indexed).
 * Images are inlined as base64 data URIs so they render without a base URL.
 */
export async function getChapterHtml(zip, basePath, spineHref) {
  const filePath = resolveHref(basePath, spineHref);
  let file = zip.file(filePath);
  let resolvedPath = filePath;

  if (!file) {
    file = zip.file(spineHref);
    resolvedPath = spineHref;
    if (!file) return wrapChapterHtml('<p style="color:red">Chapitre introuvable.</p>');
  }

  let raw = await file.async('string');
  // Debug: log image tags found
  const imgMatches = raw.match(/<img\b[^>]*>/gi) || [];
  if (imgMatches.length > 0) {
    console.log('[epubReader] imgs in chapter:', imgMatches.slice(0,3));
    console.log('[epubReader] chapterPath:', resolvedPath);
  }
  // Inline images before wrapping so paths are resolved relative to chapter location
  raw = await inlineImages(raw, zip, resolvedPath);
  return wrapChapterHtml(raw);
}
