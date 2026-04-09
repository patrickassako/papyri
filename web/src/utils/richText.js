function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function hasHtmlTags(value) {
  return /<\/?[a-z][\s\S]*>/i.test(String(value || ''));
}

export function stripRichText(value) {
  const raw = String(value || '');
  if (!raw) return '';
  if (typeof window === 'undefined') {
    return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const doc = new DOMParser().parseFromString(raw, 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
}

export function sanitizeRichTextHtml(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  if (typeof window === 'undefined') {
    return raw;
  }

  const allowedTags = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'UL', 'OL', 'LI', 'H2', 'H3', 'BLOCKQUOTE']);
  const doc = new DOMParser().parseFromString(raw, 'text/html');

  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.textContent || '');
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return document.createDocumentFragment();
    }

    const tag = node.tagName.toUpperCase();
    const fragment = document.createDocumentFragment();

    if (!allowedTags.has(tag)) {
      Array.from(node.childNodes).forEach((child) => {
        fragment.appendChild(walk(child));
      });
      return fragment;
    }

    const el = document.createElement(tag.toLowerCase());
    Array.from(node.childNodes).forEach((child) => {
      el.appendChild(walk(child));
    });
    return el;
  }

  const output = document.createElement('div');
  Array.from(doc.body.childNodes).forEach((child) => {
    output.appendChild(walk(child));
  });

  return output.innerHTML
    .replace(/<(b)>/gi, '<strong>')
    .replace(/<\/(b)>/gi, '</strong>')
    .replace(/<(i)>/gi, '<em>')
    .replace(/<\/(i)>/gi, '</em>')
    .replace(/\s*(<br\s*\/?>\s*){3,}/gi, '<br><br>')
    .trim();
}

export function normalizeRichTextHtml(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (hasHtmlTags(raw)) return sanitizeRichTextHtml(raw);

  const paragraphs = raw
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => `<p>${escapeHtml(chunk).replace(/\n/g, '<br>')}</p>`);

  return paragraphs.join('') || `<p>${escapeHtml(raw)}</p>`;
}
