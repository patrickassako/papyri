import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Slider,
  TextField,
  Typography,
} from '@mui/material';
import { ArrowLeft, ChevronLeft, ChevronRight, Menu, Moon, Search, Sun, Maximize, Minimize, Bookmark, BookmarkCheck, Highlighter, MessageSquare, Trash2, X, Play, Pause, Square } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { readingService } from '../services/reading.service';
import { useReadingLock } from '../hooks/useReadingLock';
import ePub from 'epubjs';
import tokens from '../config/tokens';
import papyriMark from '../assets/papyri-mark.png';
import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const primary = '#f4a825'; // Amber Papyri — visible sur fond sombre

const lightTheme = {
  frameBg:   '#3e3e3e',               // fond sombre autour de la page (style visionneuse)
  headerBg:  '#2b2b2b',               // barre du haut
  footerBg:  '#2b2b2b',               // barre du bas
  sidebarBg: '#303030',               // panneau latéral
  border:    'rgba(255,255,255,0.09)',
  text:      '#e2e2e2',               // texte chrome (icônes, labels)
  subtleText:'rgba(226,226,226,0.45)',
  hoverBg:   'rgba(255,255,255,0.1)',
  readerBg:  '#ffffff',               // page de lecture — blanche
  pageShadow:'0 8px 48px rgba(0,0,0,0.55)',
  // conservé pour epub body override
  epubPageBg:'#ffffff',
  epubText:  '#2a2a2a',
};

const darkTheme = {
  frameBg:   '#1a1a1a',
  headerBg:  '#111111',
  footerBg:  '#111111',
  sidebarBg: '#1c1c1c',
  border:    'rgba(255,255,255,0.07)',
  text:      '#c8d0d8',
  subtleText:'rgba(200,208,216,0.4)',
  hoverBg:   'rgba(255,255,255,0.07)',
  readerBg:  '#1c2128',               // page de lecture — sombre
  pageShadow:'0 8px 48px rgba(0,0,0,0.75)',
  epubPageBg:'#1c2128',
  epubText:  '#e7edf2',
};

const highlightColors = {
  yellow: { fill: 'rgba(255,235,59,0.4)', label: 'Jaune' },
  green:  { fill: 'rgba(76,175,80,0.4)',  label: 'Vert' },
  blue:   { fill: 'rgba(66,165,245,0.4)', label: 'Bleu' },
  pink:   { fill: 'rgba(236,64,122,0.4)', label: 'Rose' },
};

export default function EReaderPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Exclusive reading lock — one device at a time
  const { lockState, reacquire } = useReadingLock(id);

  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(25);
  const [canRead, setCanRead] = useState(false);
  const [accessHint, setAccessHint] = useState('');
  const [signedUrl, setSignedUrl] = useState('');
  const [fileBuffer, setFileBuffer] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState('');
  const [lastCfi, setLastCfi] = useState('');
  const [epubReady, setEpubReady] = useState(false);
  const [pdfReady, setPdfReady] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [initialLastPosition, setInitialLastPosition] = useState(null);
  const [epubToc, setEpubToc] = useState([]);
  const readingStartRef = useRef(Date.now());
  const cumulativeTimeRef = useRef(0);
  const [fontPercent, setFontPercent] = useState(100);
  const [nightMode, setNightMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showToc, setShowToc] = useState(true);
  const [sliderValue, setSliderValue] = useState(0);
  const [currentHref, setCurrentHref] = useState('');
  const [currentSectionKey, setCurrentSectionKey] = useState('');
  const [epubPageInfo, setEpubPageInfo] = useState({ page: 0, total: 0 });
  const [highlights, setHighlights] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [selectionPopup, setSelectionPopup] = useState(null);
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  // Search
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);
  const [ttsSpeaking, setTtsSpeaking] = useState(false);
  const [ttsPaused, setTtsPaused] = useState(false);
  const [ttsRate, setTtsRate] = useState(1);
  const [ttsVoices, setTtsVoices] = useState([]);
  const [ttsVoiceUri, setTtsVoiceUri] = useState('');
  const [ttsNowText, setTtsNowText] = useState('');
  const [ttsInlineHighlightEnabled, setTtsInlineHighlightEnabled] = useState(true);
  const [mobileChromeVisible, setMobileChromeVisible] = useState(true);
  const ttsUtteranceRef = useRef(null);
  const ttsVoiceRef = useRef(null);
  const ttsPlaybackRef = useRef({ chunks: [], index: 0 });
  const ttsStopRequestedRef = useRef(false);
  const ttsHighlightCursorRef = useRef(0);
  const highlightsRenderRafRef = useRef(0);
  const prefetchSourceHrefRef = useRef('');
  const mobileHideTimerRef = useRef(0);
  const isMobileViewportRef = useRef(false);
  const epubContainerRef = useRef(null);
  const bookRef = useRef(null);
  const renditionRef = useRef(null);
  const pdfContainerRef = useRef(null);
  const pdfCanvasRef = useRef(null);
  const pdfDocRef = useRef(null);
  const readerRootRef = useRef(null);
  const readerFrameRef = useRef(null);
  const epubInitRunRef = useRef(0);
  const isJumpingRef = useRef(false);
  const selectionContextRef = useRef(null);
  const boundSelectionDocsRef = useRef(new WeakSet());
  const highlightsRef = useRef(highlights);
  highlightsRef.current = highlights;
  const isEpub = content?.format === 'epub';
  const isPdf = content?.format === 'pdf';
  const t = nightMode ? darkTheme : lightTheme;
  const ttsStorageKey = `reader:tts:${id}`;

  const extractReadableText = useCallback(() => {
    if (isEpub && renditionRef.current) {
      const contents = renditionRef.current.getContents?.() || [];
      const chunks = [];
      contents.forEach((c) => {
        const doc = c?.document;
        if (!doc?.body) return;
        const cloned = doc.body.cloneNode(true);
        cloned.querySelectorAll('script,style,noscript').forEach((n) => n.remove());
        const text = String(cloned.textContent || '').replace(/\s+/g, ' ').trim();
        if (text) chunks.push(text);
      });
      const merged = chunks.join(' ').replace(/\s+/g, ' ').trim();
      return merged.slice(0, 12000);
    }

    if (isPdf) {
      return '';
    }

    return String(content?.description || '').replace(/\s+/g, ' ').trim().slice(0, 12000);
  }, [content?.description, isEpub, isPdf]);

  const splitTextForTts = useCallback((text) => {
    const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
    if (!cleaned) return [];
    const maxLen = 900;
    const parts = (cleaned.match(/[^.!?;:]+[.!?;:]?|[^.!?;:]+$/g) || [])
      .map((s) => s.trim())
      .filter(Boolean);
    const chunks = [];
    let current = '';
    parts.forEach((part) => {
      if (!current) {
        current = part;
        return;
      }
      if ((current.length + 1 + part.length) <= maxLen) {
        current += ` ${part}`;
      } else {
        chunks.push(current);
        current = part;
      }
    });
    if (current) chunks.push(current);
    return chunks.length ? chunks : [cleaned.slice(0, maxLen)];
  }, []);

  const snippetAroundBoundary = useCallback((text, charIndex = 0) => {
    const source = String(text || '').trim();
    if (!source) return '';
    const i = Math.max(0, Math.min(source.length - 1, Number(charIndex) || 0));
    const leftStart = Math.max(0, i - 60);
    const rightEnd = Math.min(source.length, i + 140);
    return source.slice(leftStart, rightEnd).trim();
  }, []);

  const extractBoundaryPhrase = useCallback((text, charIndex = 0) => {
    const source = String(text || '');
    if (!source.trim()) return '';
    const idx = Math.max(0, Math.min(source.length - 1, Number(charIndex) || 0));
    const isWordChar = (ch) => /[A-Za-zÀ-ÖØ-öø-ÿ0-9'-]/.test(ch);

    let left = idx;
    let right = idx;
    while (left > 0 && isWordChar(source[left - 1])) left -= 1;
    while (right < source.length && isWordChar(source[right])) right += 1;

    // Expand to 2 words before + 2 words after.
    let wordsLeft = 2;
    let wordsRight = 2;
    let start = left;
    let end = right;
    while (start > 0 && wordsLeft > 0) {
      start -= 1;
      while (start > 0 && !isWordChar(source[start])) start -= 1;
      while (start > 0 && isWordChar(source[start - 1])) start -= 1;
      wordsLeft -= 1;
    }
    while (end < source.length && wordsRight > 0) {
      while (end < source.length && !isWordChar(source[end])) end += 1;
      while (end < source.length && isWordChar(source[end])) end += 1;
      wordsRight -= 1;
    }

    return source.slice(start, end).replace(/\s+/g, ' ').trim();
  }, []);

  const clearTtsInlineHighlight = useCallback(() => {
    if (!renditionRef.current) return;
    const contents = renditionRef.current.getContents?.() || [];
    contents.forEach((c) => {
      const doc = c?.document;
      if (!doc) return;
      const nodes = doc.querySelectorAll('mark[data-reader-tts-highlight="1"]');
      nodes.forEach((node) => {
        const parent = node.parentNode;
        if (!parent) return;
        while (node.firstChild) parent.insertBefore(node.firstChild, node);
        parent.removeChild(node);
        parent.normalize?.();
      });
    });
  }, []);

  const applyTtsInlineHighlight = useCallback((word) => {
    if (!ttsInlineHighlightEnabled || !isEpub || !renditionRef.current) return;
    const token = String(word || '').replace(/\s+/g, ' ').trim();
    if (token.length < 2) return;

    const contents = renditionRef.current.getContents?.() || [];
    const maps = [];
    let full = '';
    contents.forEach((c) => {
      const doc = c?.document;
      if (!doc?.body) return;
      const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null);
      let n;
      while ((n = walker.nextNode())) {
        const text = String(n.nodeValue || '');
        if (!text) continue;
        maps.push({ node: n, start: full.length, end: full.length + text.length });
        full += text;
      }
    });
    if (!full || !maps.length) return;

    const fullLower = full.toLocaleLowerCase();
    const tokenLower = token.toLocaleLowerCase();
    const cursor = Math.max(0, Math.min(ttsHighlightCursorRef.current, fullLower.length));
    let idx = fullLower.indexOf(tokenLower, cursor);
    if (idx < 0) idx = fullLower.indexOf(tokenLower);
    if (idx < 0) return;

    const endIdx = idx + tokenLower.length;
    const startEntry = maps.find((m) => idx >= m.start && idx < m.end);
    const endEntry = maps.find((m) => endIdx > m.start && endIdx <= m.end) || startEntry;
    if (!startEntry || !endEntry) return;

    const range = document.createRange();
    try {
      range.setStart(startEntry.node, Math.max(0, idx - startEntry.start));
      range.setEnd(endEntry.node, Math.max(0, endIdx - endEntry.start));
      if (range.collapsed) return;
    } catch (_) {
      return;
    }

    clearTtsInlineHighlight();
    const mark = range.startContainer?.ownerDocument?.createElement('mark');
    if (!mark) return;
    mark.setAttribute('data-reader-tts-highlight', '1');
    mark.style.background = 'rgba(255, 200, 0, 0.35)';
    mark.style.borderRadius = '0.15em';
    mark.style.padding = '0 0.04em';
    mark.style.boxDecorationBreak = 'clone';
    mark.style.webkitBoxDecorationBreak = 'clone';

    try {
      range.surroundContents(mark);
      ttsHighlightCursorRef.current = endIdx;
    } catch (_) {}
  }, [clearTtsInlineHighlight, isEpub, ttsInlineHighlightEnabled]);

  const stopTts = useCallback(() => {
    if (!window.speechSynthesis) return;
    ttsStopRequestedRef.current = true;
    try {
      window.speechSynthesis.cancel();
    } catch (_) {}
    ttsPlaybackRef.current = { chunks: [], index: 0 };
    ttsUtteranceRef.current = null;
    setTtsSpeaking(false);
    setTtsPaused(false);
    setTtsNowText('');
    ttsHighlightCursorRef.current = 0;
    clearTtsInlineHighlight();
  }, [clearTtsInlineHighlight]);

  const startTts = useCallback(() => {
    if (!window.speechSynthesis) {
      setError('Synthèse vocale non prise en charge sur ce navigateur.');
      setTimeout(() => setError(''), 3000);
      return;
    }
    const text = extractReadableText();
    if (!text) {
      setError('Aucun texte lisible trouvé pour la synthèse vocale sur cette vue.');
      setTimeout(() => setError(''), 3000);
      return;
    }

    const chunks = splitTextForTts(text);
    if (!chunks.length) {
      setError('Texte insuffisant pour la synthèse vocale.');
      setTimeout(() => setError(''), 3000);
      return;
    }

    ttsStopRequestedRef.current = false;
    ttsHighlightCursorRef.current = 0;
    ttsPlaybackRef.current = { chunks, index: 0 };
    window.speechSynthesis.cancel();

    const speakChunk = (index) => {
      if (ttsStopRequestedRef.current) return;
      const active = ttsPlaybackRef.current.chunks[index];
      if (!active) {
        setTtsSpeaking(false);
        setTtsPaused(false);
        ttsUtteranceRef.current = null;
        setTtsNowText('');
        return;
      }

      ttsPlaybackRef.current.index = index;
      setTtsNowText(snippetAroundBoundary(active, 0));

      const utterance = new SpeechSynthesisUtterance(active);
      utterance.rate = ttsRate;
      utterance.pitch = 1;
      utterance.volume = 1;
      utterance.lang = 'fr-FR';
      if (ttsVoiceRef.current) {
        utterance.voice = ttsVoiceRef.current;
        utterance.lang = ttsVoiceRef.current.lang || 'fr-FR';
      }

      utterance.onstart = () => {
        setTtsSpeaking(true);
        setTtsPaused(false);
      };
      utterance.onpause = () => setTtsPaused(true);
      utterance.onresume = () => setTtsPaused(false);
      utterance.onboundary = (event) => {
        if (ttsStopRequestedRef.current) return;
        const idx = Math.max(0, Number(event?.charIndex || 0));
        const phrase = extractBoundaryPhrase(active, idx);
        setTtsNowText(snippetAroundBoundary(active, idx));
        if (phrase) applyTtsInlineHighlight(phrase);
      };
      utterance.onend = () => {
        if (ttsStopRequestedRef.current) return;
        const next = index + 1;
        if (next < ttsPlaybackRef.current.chunks.length) {
          speakChunk(next);
        } else {
          setTtsSpeaking(false);
          setTtsPaused(false);
          ttsUtteranceRef.current = null;
          setTtsNowText('');
        }
      };
      utterance.onerror = () => {
        if (ttsStopRequestedRef.current) return;
        const next = index + 1;
        if (next < ttsPlaybackRef.current.chunks.length) {
          speakChunk(next);
        } else {
          setTtsSpeaking(false);
          setTtsPaused(false);
          ttsUtteranceRef.current = null;
          setTtsNowText('');
        }
      };

      ttsUtteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    };

    speakChunk(0);
  }, [applyTtsInlineHighlight, extractBoundaryPhrase, extractReadableText, snippetAroundBoundary, splitTextForTts, ttsRate]);

  const pauseResumeTts = useCallback(() => {
    if (!window.speechSynthesis) return;
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
      setTtsPaused(true);
      return;
    }
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setTtsPaused(false);
      return;
    }
    startTts();
  }, [startTts]);

  const sanitizeHtmlString = (html) => {
    if (typeof html !== 'string') return html;
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/\s(href|src|xlink:href)\s*=\s*(['"])javascript:[^'"]*\2/gi, ' $1="#"');
  };

  const sanitizeEpubBuffer = async (buffer) => {
    if (!buffer) return buffer;
    try {
      const zip = await JSZip.loadAsync(buffer);
      const entries = Object.keys(zip.files);
      const htmlLike = /\.(xhtml|html|htm|svg)$/i;
      await Promise.all(entries.map(async (name) => {
        const entry = zip.files[name];
        if (!entry || entry.dir || !htmlLike.test(name)) return;
        const source = await entry.async('string');
        const clean = sanitizeHtmlString(source);
        if (clean !== source) {
          zip.file(name, clean);
        }
      }));
      const out = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
      return out;
    } catch (error) {
      console.error('Erreur sanitization EPUB:', error);
      return buffer;
    }
  };

  const applyDomHighlight = (range, colorKey, highlightId = null) => {
    if (!range) return;
    const fill = highlightColors[colorKey]?.fill || highlightColors.yellow.fill;
    const mark = range.startContainer?.ownerDocument?.createElement('mark');
    if (!mark) return;
    if (highlightId) {
      mark.setAttribute('data-reader-highlight', String(highlightId));
    }
    mark.setAttribute('data-reader-highlight-node', '1');
    mark.style.background = fill;
    mark.style.padding = '0 0.05em';
    mark.style.borderRadius = '0.15em';
    mark.style.boxDecorationBreak = 'clone';
    mark.style.webkitBoxDecorationBreak = 'clone';
    try {
      range.surroundContents(mark);
    } catch (_) {
      try {
        const fragment = range.extractContents();
        mark.appendChild(fragment);
        range.insertNode(mark);
      } catch (_) {}
    }
  };

  const clearDomHighlights = (doc) => {
    if (!doc) return;
    const nodes = doc.querySelectorAll('mark[data-reader-highlight-node="1"]');
    nodes.forEach((node) => {
      const parent = node.parentNode;
      if (!parent) return;
      while (node.firstChild) {
        parent.insertBefore(node.firstChild, node);
      }
      parent.removeChild(node);
      parent.normalize?.();
    });
  };

  const renderPersistedHighlights = () => {
    if (!isEpub || !renditionRef.current) return;
    const visibleContents = renditionRef.current.getContents?.() || [];
    if (!Array.isArray(visibleContents) || visibleContents.length === 0) return;

    const normalizePath = (value) => String(value || '').split('#')[0].trim();

    const samePath = (a, b) => {
      if (!a || !b) return false;
      return a === b || a.endsWith(`/${b}`) || b.endsWith(`/${a}`);
    };

    // Cross-node text search fallback: concatenates text across nodes to find spans
    const findRangeByTextInDoc = (doc, rawText) => {
      const target = String(rawText || '').replace(/\s+/g, ' ').trim();
      if (!target || target.length < 3) return null;
      const body = doc.body || doc.documentElement;
      if (!body) return null;

      // Collect all text nodes with their positions in a concatenated string
      const walker = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT, null);
      const nodes = [];
      let concat = '';
      let node;
      while ((node = walker.nextNode())) {
        const text = node.nodeValue || '';
        nodes.push({ node, start: concat.length, length: text.length });
        concat += text;
      }

      // Search in the normalized concatenated text
      const normalizedConcat = concat.replace(/\s+/g, ' ');
      const idx = normalizedConcat.indexOf(target);
      if (idx < 0) return null;

      // Map normalized index back to raw index (approximate but close)
      let rawIdx = 0;
      let normIdx = 0;
      while (normIdx < idx && rawIdx < concat.length) {
        if (/\s/.test(concat[rawIdx])) {
          // In normalized: consecutive whitespace collapses to one space
          const normChar = normalizedConcat[normIdx];
          if (normChar === ' ') normIdx++;
          rawIdx++;
          while (rawIdx < concat.length && /\s/.test(concat[rawIdx])) rawIdx++;
        } else {
          rawIdx++;
          normIdx++;
        }
      }
      const rawStart = rawIdx;
      const rawEnd = Math.min(concat.length, rawStart + target.length + (rawStart - idx));

      // Find which text nodes contain the start and end offsets
      let startNode = null;
      let startOffset = 0;
      let endNode = null;
      let endOffset = 0;

      for (const entry of nodes) {
        const entryEnd = entry.start + entry.length;
        if (!startNode && rawStart < entryEnd) {
          startNode = entry.node;
          startOffset = rawStart - entry.start;
        }
        if (rawEnd <= entryEnd) {
          endNode = entry.node;
          endOffset = rawEnd - entry.start;
          break;
        }
      }

      if (!startNode || !endNode) return null;
      try {
        const range = doc.createRange();
        range.setStart(startNode, Math.min(startOffset, startNode.nodeValue.length));
        range.setEnd(endNode, Math.min(endOffset, endNode.nodeValue.length));
        return range;
      } catch (_) {
        return null;
      }
    };

    // Read current highlights from ref to avoid stale closures
    const currentHighlights = highlightsRef.current;

    visibleContents.forEach((contents) => {
      const doc = contents?.document;
      if (!doc) return;
      clearDomHighlights(doc);

      const contentHref = normalizePath(contents?.section?.href);

      currentHighlights.forEach((hl) => {
        if (!hl?.cfi_range && !hl?.text) return;

        // Skip highlights from other chapters
        const hlChapter = normalizePath(hl?.position?.chapter);
        if (hlChapter && contentHref && !samePath(hlChapter, contentHref)) return;

        let range = null;

        // Strategy 1: Use epub.js CFI-to-Range resolution (handles multi-node spans)
        if (hl.cfi_range) {
          try {
            range = contents.range(hl.cfi_range);
          } catch (_) {
            // CFI resolution failed — fall through to text search
          }
        }

        // Strategy 2: Cross-node text search fallback
        if ((!range || range.collapsed) && hl.text) {
          range = findRangeByTextInDoc(doc, hl.text);
        }

        if (range && !range.collapsed) {
          applyDomHighlight(range, hl.color || 'yellow', hl.id);
        }
      });
    });
  };

  const closeSelectionPopup = () => {
    // UI reset only: clearing iframe selections aggressively can break subsequent epub selection events.
    selectionContextRef.current = null;
    setSelectionPopup(null);
    setShowNoteInput(false);
    setNoteInput('');
  };

  const openSelectionPopupFromRange = (contents, range, forcedCfi = null) => {
    if (!contents || !range || range.collapsed) return false;
    const text = String(range.toString() || '').trim();
    if (!text) return false;

    let cfiRange = forcedCfi;
    if (!cfiRange) {
      try {
        cfiRange = contents.cfiFromRange(range);
      } catch (_) {
        cfiRange = null;
      }
    }
    if (!cfiRange) return false;

    const rect = range.getBoundingClientRect();
    if (!rect) return false;

    const hostRect = readerFrameRef.current?.getBoundingClientRect?.() || { left: 0, top: 0 };
    const frameEl = contents?.window?.frameElement;
    const iframeRect = frameEl?.getBoundingClientRect?.() || { left: hostRect.left, top: hostRect.top };
    const x = (iframeRect.left - hostRect.left) + rect.left + (rect.width / 2);
    const y = (iframeRect.top - hostRect.top) + rect.top - 10;
    selectionContextRef.current = {
      cfiRange,
      range: range.cloneRange(),
      selection: contents.window?.getSelection?.(),
    };
    setSelectionPopup({
      cfiRange,
      text,
      x: Math.max(24, x),
      y: Math.max(46, y),
    });
    setShowNoteInput(false);
    setNoteInput('');
    return true;
  };

  const isLikelyValidCfi = (cfi) => {
    const raw = String(cfi || '');
    return raw.startsWith('epubcfi(') && raw.includes('!');
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      setDownloadProgress(0);
      setDownloadStatus('');

      try {
        setDownloadStatus('Récupération de la session...');
        const [session, chaptersData] = await Promise.all([
          readingService.getSession(id),
          readingService.getChapters(id),
        ]);

        const data = session?.content || null;
        if (!data) {
          throw new Error('Impossible de charger les informations du contenu.');
        }

        const needsBinaryFile = ['epub', 'pdf'].includes(String(data?.format || '').toLowerCase());
        let binaryBuffer = null;

        if (needsBinaryFile) {
          const fileSizeBytes = Number(data?.file_size_bytes || 0);
          if (fileSizeBytes > 0) {
            const fileSizeMB = (fileSizeBytes / (1024 * 1024)).toFixed(1);
            setDownloadStatus(`Téléchargement du fichier (${fileSizeMB} MB)...`);
          } else {
            setDownloadStatus('Téléchargement du fichier...');
          }

          const fileCacheKey = `${data?.file_size_bytes || 0}:${data?.updated_at || data?.published_at || ''}`;
          binaryBuffer = await readingService.getFileBuffer(id, (percent) => {
            setDownloadProgress(percent);
          }, session?.stream?.url || null, { cacheKey: fileCacheKey });

          setDownloadStatus('Préparation de la lecture...');
        }

        // Load highlights & bookmarks in parallel (non-blocking)
        const [savedHighlights, savedBookmarks] = await Promise.all([
          readingService.getHighlights(id).catch(() => []),
          readingService.getBookmarks(id).catch(() => []),
        ]);

        console.log('[EReader] Session loaded:', {
          hasProgress: !!session?.progress,
          progressPercent: session?.progress?.progress_percent,
          lastPosition: session?.progress?.last_position,
          hasCfi: !!session?.progress?.last_position?.cfi,
        });

        setContent(data);
        setSignedUrl(session?.stream?.url || '');
        setFileBuffer(binaryBuffer);
        setProgress(Number(session?.progress?.progress_percent || 0));
        setInitialLastPosition(session?.progress?.last_position || null);
        setChapters(chaptersData?.chapters || []);
        setHighlights(savedHighlights);
        setBookmarks(savedBookmarks);
        setCanRead(true);
        setDownloadStatus('');
        setDownloadProgress(0);
      } catch (err) {
        console.error('Erreur chargement lecture:', err);
        const msg = err?.message || 'Impossible de charger la lecture.';
        if (msg.includes('Accès refusé') || msg.includes('abonnement') || msg.includes('paiement')) {
          setCanRead(false);
          setAccessHint(msg);
        } else {
          setError(msg);
        }
        setDownloadStatus('');
        setDownloadProgress(0);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, retryKey]);

  // Track whether EPUB has rendered at least once (relocated event fired)
  const epubInitializedRef = useRef(false);

  // Calculate cumulative reading time in seconds
  const getReadingTimeSeconds = () => {
    const sessionTime = Math.floor((Date.now() - readingStartRef.current) / 1000);
    return cumulativeTimeRef.current + sessionTime;
  };

  // Save progress function — uses refs to avoid stale closures
  const progressRef = useRef(progress);
  const lastCfiRef = useRef(lastCfi);
  const currentHrefRef = useRef(currentHref);
  const currentPageRef = useRef(currentPage);
  const totalPagesRef = useRef(totalPages);
  const contentRef = useRef(content);
  const canReadRef = useRef(canRead);

  // Keep refs in sync
  useEffect(() => { progressRef.current = progress; }, [progress]);
  useEffect(() => { lastCfiRef.current = lastCfi; }, [lastCfi]);
  useEffect(() => { currentHrefRef.current = currentHref; }, [currentHref]);
  useEffect(() => { currentPageRef.current = currentPage; }, [currentPage]);
  useEffect(() => { totalPagesRef.current = totalPages; }, [totalPages]);
  useEffect(() => { contentRef.current = content; }, [content]);
  useEffect(() => { canReadRef.current = canRead; }, [canRead]);

  // Stable save function using refs — avoids stale closures
  const doSaveProgress = useRef(null);
  doSaveProgress.current = (force = false, useBeacon = false) => {
    if (!canReadRef.current || !contentRef.current?.id) {
      console.log('[SaveProgress] skip: canRead=%s, contentId=%s', canReadRef.current, contentRef.current?.id);
      return;
    }

    const fmt = contentRef.current?.format;
    const pct = Number(progressRef.current);
    const cfi = lastCfiRef.current;
    const href = currentHrefRef.current;
    const page = currentPageRef.current;
    const pages = totalPagesRef.current;

    // EPUB guard: don't save until the rendition has initialized (first relocated event)
    if (fmt === 'epub' && !epubInitializedRef.current) {
      console.log('[SaveProgress] skip: epub not initialized yet');
      return;
    }

    // Allow save if we have a valid CFI (even at 0% progress)
    const hasValidCfi = fmt === 'epub' && cfi && cfi.startsWith('epubcfi(');
    if (!force && pct <= 0 && !hasValidCfi) {
      console.log('[SaveProgress] skip: pct=%s, no valid cfi', pct);
      return;
    }

    const lastPosition = {
      percent: pct,
      type: 'ebook',
    };

    if (fmt === 'epub') {
      if (cfi) lastPosition.cfi = cfi;
      if (href) lastPosition.chapter = href;
    }
    if (fmt === 'pdf') {
      lastPosition.pdf_page = page;
      lastPosition.total_pages = pages;
      lastPosition.chapter = `page-${page}`;
    }

    const payload = {
      progressPercent: pct,
      lastPosition,
      totalTimeSeconds: getReadingTimeSeconds(),
    };

    console.log('[SaveProgress] saving:', { id, force, useBeacon, pct, cfi: cfi?.slice(0, 60), fmt });

    // For beforeunload: use fetch with keepalive to survive page close
    if (useBeacon) {
      try {
        const token = localStorage.getItem('access_token');
        if (token) {
          const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3001';
          fetch(`${apiBase}/api/reading/${id}/progress`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              progress_percent: pct,
              last_position: lastPosition,
              total_time_seconds: payload.totalTimeSeconds,
            }),
            keepalive: true,
          }).catch(() => {});
        }
      } catch (_) {}
      return;
    }

    readingService.saveProgress(id, payload).then((result) => {
      console.log('[SaveProgress] OK, result:', result);
    }).catch((err) => {
      console.error('[SaveProgress] ERREUR:', err);
    });
  };

  // Debounced save on progress/position changes (2s debounce)
  // Only triggers after EPUB has initialized (lastCfi becomes non-empty)
  useEffect(() => {
    if (!canRead) return;
    // For EPUB: wait until first relocated event
    if (content?.format === 'epub' && !lastCfi) return;
    // For PDF: wait until page > 0
    if (content?.format === 'pdf' && currentPage <= 0) return;

    const timer = setTimeout(() => doSaveProgress.current?.(false), 2000);
    return () => clearTimeout(timer);
  }, [canRead, content?.format, currentPage, id, lastCfi, progress, totalPages]); // eslint-disable-line react-hooks/exhaustive-deps

  // Periodic save every 30s while reading
  useEffect(() => {
    if (!canRead) return;
    const timer = setInterval(() => doSaveProgress.current?.(false), 30000);
    return () => clearInterval(timer);
  }, [canRead, content?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save on page unload (close tab, navigate away)
  useEffect(() => {
    if (!canRead) return;
    const handleBeforeUnload = () => doSaveProgress.current?.(true, true); // useBeacon=true for page close
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Also save on unmount (navigate to another route via SPA)
      doSaveProgress.current?.(true);
    };
  }, [canRead, content?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore cumulative reading time from session
  useEffect(() => {
    if (initialLastPosition) {
      cumulativeTimeRef.current = Number(initialLastPosition?.total_time_seconds || 0);
    }
    readingStartRef.current = Date.now();
    epubInitializedRef.current = false;
  }, [initialLastPosition]);

  // EPUB dependencies are now loaded via imports, so just mark as ready
  useEffect(() => {
    if (!(canRead && content?.format === 'epub' && fileBuffer)) return;
    setEpubReady(true);
  }, [canRead, content?.format, fileBuffer]);

  useEffect(() => {
    const supported = typeof window !== 'undefined'
      && 'speechSynthesis' in window
      && typeof window.SpeechSynthesisUtterance !== 'undefined';
    setTtsSupported(supported);
    if (!supported) return;

    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices?.() || [];
      const sorted = [...voices].sort((a, b) => {
        const aFr = String(a.lang || '').toLowerCase().startsWith('fr') ? 0 : 1;
        const bFr = String(b.lang || '').toLowerCase().startsWith('fr') ? 0 : 1;
        return aFr - bFr;
      });
      setTtsVoices(sorted);
      setTtsVoiceUri((prev) => {
        const prevExists = sorted.some((v) => v.voiceURI === prev);
        const selected = prevExists ? prev : (sorted[0]?.voiceURI || '');
        ttsVoiceRef.current = sorted.find((v) => v.voiceURI === selected) || null;
        return selected;
      });
    };

    pickVoice();
    window.speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
    return () => {
      window.speechSynthesis.removeEventListener?.('voiceschanged', pickVoice);
    };
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ttsStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const rate = Number(parsed?.rate);
      if (Number.isFinite(rate) && rate >= 0.5 && rate <= 2) {
        setTtsRate(rate);
      }
      if (parsed?.voiceUri) {
        setTtsVoiceUri(String(parsed.voiceUri));
      }
      if (typeof parsed?.inlineHighlight === 'boolean') {
        setTtsInlineHighlightEnabled(parsed.inlineHighlight);
      }
    } catch (_) {}
  }, [ttsStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(ttsStorageKey, JSON.stringify({
        rate: ttsRate,
        voiceUri: ttsVoiceUri || '',
        inlineHighlight: ttsInlineHighlightEnabled,
      }));
    } catch (_) {}
  }, [ttsInlineHighlightEnabled, ttsRate, ttsStorageKey, ttsVoiceUri]);

  useEffect(() => {
    if (!ttsVoices.length) return;
    const voice = ttsVoices.find((v) => v.voiceURI === ttsVoiceUri) || ttsVoices[0];
    ttsVoiceRef.current = voice || null;
  }, [ttsVoiceUri, ttsVoices]);

  useEffect(() => () => {
    stopTts();
  }, [stopTts]);

  const bumpMobileChromeVisibility = useCallback(() => {
    if (!isMobileViewportRef.current) return;
    setMobileChromeVisible(true);
    if (mobileHideTimerRef.current) {
      clearTimeout(mobileHideTimerRef.current);
    }
    mobileHideTimerRef.current = window.setTimeout(() => {
      setMobileChromeVisible(false);
    }, 2600);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia('(max-width: 900px)');
    const apply = () => {
      isMobileViewportRef.current = mq.matches;
      if (!mq.matches) {
        setMobileChromeVisible(true);
        if (mobileHideTimerRef.current) clearTimeout(mobileHideTimerRef.current);
      } else {
        bumpMobileChromeVisibility();
      }
    };
    apply();
    mq.addEventListener?.('change', apply);
    return () => {
      mq.removeEventListener?.('change', apply);
      if (mobileHideTimerRef.current) clearTimeout(mobileHideTimerRef.current);
    };
  }, [bumpMobileChromeVisibility]);

  useEffect(() => {
    if (!ttsInlineHighlightEnabled) {
      clearTtsInlineHighlight();
    }
  }, [clearTtsInlineHighlight, ttsInlineHighlightEnabled]);

  // PDF.js dependencies are now loaded via imports, so just mark as ready
  useEffect(() => {
    if (!(canRead && content?.format === 'pdf' && fileBuffer)) return;
    setPdfReady(true);
  }, [canRead, content?.format, fileBuffer]);

  useEffect(() => {
    if (!(canRead && content?.format === 'pdf' && fileBuffer && pdfReady && pdfjsLib)) return;

    pdfDocRef.current = null;

    const loadingTask = pdfjsLib.getDocument({ data: fileBuffer });
    loadingTask.promise
      .then((pdf) => {
        pdfDocRef.current = pdf;
        const pages = Number(pdf.numPages || 1);
        setTotalPages(pages);
        const restoredPage = Number(initialLastPosition?.pdf_page || 1);
        const safePage = Math.max(1, Math.min(pages, restoredPage));
        setCurrentPage(safePage);
        setProgress(Math.round((safePage / pages) * 100));
      })
      .catch((error) => {
        console.error('Erreur chargement PDF:', error);
        setError(`Impossible d'ouvrir ce fichier PDF. ${error.message || 'Erreur inconnue.'}`);
      });

    return () => {
      if (loadingTask?.destroy) {
        loadingTask.destroy();
      }
      pdfDocRef.current = null;
    };
  }, [canRead, content?.format, fileBuffer, initialLastPosition, pdfReady]);

  useEffect(() => {
    if (!(canRead && content?.format === 'pdf' && pdfDocRef.current && pdfCanvasRef.current)) return;

    const pdf = pdfDocRef.current;
    const pageNumber = Math.max(1, Math.min(totalPages, Number(currentPage || 1)));
    let cancelled = false;

    pdf.getPage(pageNumber)
      .then((page) => {
        if (cancelled) return;
        const containerWidth = Math.max(320, Math.floor(pdfContainerRef.current?.clientWidth || 760));
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = containerWidth / baseViewport.width;
        const viewport = page.getViewport({ scale });
        const canvas = pdfCanvasRef.current;
        const ctx = canvas.getContext('2d');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        return page.render({
          canvasContext: ctx,
          viewport,
        }).promise;
      })
      .catch((error) => {
        console.error('Erreur rendu page PDF:', error);
        if (!cancelled) {
          setError(`Rendu PDF impossible. ${error.message || 'Erreur inconnue.'}`);
        }
      });

    setProgress(Math.round((pageNumber / Math.max(1, totalPages)) * 100));

    return () => {
      cancelled = true;
    };
  }, [canRead, content?.format, currentPage, totalPages]);

  useEffect(() => {
    if (!(canRead && content?.format === 'epub' && fileBuffer && epubReady && epubContainerRef.current && ePub)) {
      return;
    }

    // Dispose previous global instance before creating a new one for this run.
    const previousRendition = renditionRef.current;
    const previousBook = bookRef.current;
    if (previousRendition) {
      try { previousRendition.destroy(); } catch (_) {}
    }
    if (previousBook) {
      try { previousBook.destroy(); } catch (_) {}
    }
    renditionRef.current = null;
    bookRef.current = null;

    let mounted = true;
    let epubObjectUrl = null;
    let ownedBook = null;
    let ownedRendition = null;
    const getBufferSignature = (buffer) => {
      try {
        const bytes = new Uint8Array(buffer).slice(0, 8);
        return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
      } catch {
        return 'unknown';
      }
    };
    const looksLikeZip = (buffer) => {
      try {
        const bytes = new Uint8Array(buffer);
        if (bytes.length < 4) return false;
        return bytes[0] === 0x50 && bytes[1] === 0x4b && (
          (bytes[2] === 0x03 && bytes[3] === 0x04) ||
          (bytes[2] === 0x05 && bytes[3] === 0x06) ||
          (bytes[2] === 0x07 && bytes[3] === 0x08)
        );
      } catch {
        return false;
      }
    };
    const withTimeout = (promise, ms, label) => Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timeout (${ms}ms)`)), ms)),
    ]);

    const initFromSource = async (source, sourceLabel) => {
      const openOpts = source instanceof ArrayBuffer ? { openAs: 'binary' } : {};
      const book = ePub(source, openOpts);

      // Attendre que le livre soit entièrement parsé (spine, packaging, hrefs)
      await withTimeout(book.opened, 20000, 'book.opened');

      // ── Fix epub.js "new Path(undefined)" ─────────────────────────────────
      // Certains EPUB ont des items dans le spine dont l'idref ne correspond
      // à aucune entrée dans le manifest OPF → item.href reste undefined.
      // epub.js v0.3.x ne vérifie pas ça et crashe dans Archive.request.
      //
      // 1) Filtrer les spine items invalides (cause directe)
      // Important: ne pas modifier `spine.items` (OPF source) ni `spine.length`,
      // epub.js s'appuie dessus à plusieurs endroits.
      const rawSpineItems = Array.isArray(book.spine?.spineItems) ? book.spine.spineItems : [];
      if (rawSpineItems.length) {
        const validSpineItems = rawSpineItems.filter((item) => item?.href != null && item.href !== '');
        const removed = rawSpineItems.length - validSpineItems.length;
        if (removed > 0) {
          console.warn(`[EReader] Removed ${removed} spine item(s) with undefined href (malformed EPUB)`);
          book.spine.spineItems = validSpineItems;
          if (book.spine.spineByHref) book.spine.spineByHref = {};
          if (book.spine.spineById) book.spine.spineById = {};
          validSpineItems.forEach((item, idx) => {
            item.index = idx;
            if (book.spine.spineByHref && item.href) {
              book.spine.spineByHref[item.href] = idx;
              try { book.spine.spineByHref[decodeURI(item.href)] = idx; } catch (_) {}
              try { book.spine.spineByHref[encodeURI(item.href)] = idx; } catch (_) {}
            }
            if (book.spine.spineById && item.idref) {
              book.spine.spineById[item.idref] = idx;
            }
          });
        }
      }
      if (book.spine && typeof book.spine.last !== 'function') {
        console.warn('[EReader] spine.last was not a function, restoring fallback method');
        book.spine.last = function last() {
          const items = Array.isArray(this.spineItems) ? this.spineItems : [];
          for (let i = items.length - 1; i >= 0; i -= 1) {
            const section = typeof this.get === 'function' ? this.get(i) : items[i];
            if (section && section.linear !== false && section.linear !== 'no') return section;
          }
          return items[items.length - 1] || null;
        };
      }
      if (book.spine && typeof book.spine.first !== 'function') {
        console.warn('[EReader] spine.first was not a function, restoring fallback method');
        book.spine.first = function first() {
          const items = Array.isArray(this.spineItems) ? this.spineItems : [];
          for (let i = 0; i < items.length; i += 1) {
            const section = typeof this.get === 'function' ? this.get(i) : items[i];
            if (section && section.linear !== false && section.linear !== 'no') return section;
          }
          return items[0] || null;
        };
      }

      // 2) Patcher Archive.request comme filet de sécurité (évite le crash synchrone
      //    si un path null/undefined arrive malgré le filtre ci-dessus)
      if (book.archive) {
        const _origReq = book.archive.request.bind(book.archive);
        book.archive.request = function(path, type) {
          if (path == null || path === '') {
            return Promise.reject(new Error('[epubjs] skipped: undefined path'));
          }
          return _origReq(path, type);
        };
      }
      // ──────────────────────────────────────────────────────────────────────

      const rendition = book.renderTo(epubContainerRef.current, {
        width: '100%',
        height: '100%',
        spread: 'none',
        flow: 'paginated',
        allowScriptedContent: false,
      });

      try {
        book.spine?.hooks?.serialize?.register(function (output) {
          const src = typeof output === 'string' ? output : (typeof this.output === 'string' ? this.output : null);
          if (src) {
            this.output = sanitizeHtmlString(src);
          }
        });
      } catch (error) {
        console.error('Erreur enregistrement hook sanitization EPUB:', error);
      }

      rendition.hooks.content.register((contents) => {
        try {
          if (!contents) return;
          const doc = contents.document;
          if (!doc) return;
          doc.querySelectorAll('script').forEach((node) => node.remove());
          // EPUBs generated by some tools store image URLs in data-* attrs.
          // Fallback them back to src/href to ensure images render.
          doc.querySelectorAll('img').forEach((img) => {
            const src = img.getAttribute('src');
            if (!src) {
              const fallback = img.getAttribute('data-src')
                || img.getAttribute('data-original')
                || img.getAttribute('data-original-src');
              if (fallback) img.setAttribute('src', fallback);
            }
          });
          doc.querySelectorAll('image').forEach((svgImg) => {
            const href = svgImg.getAttribute('href') || svgImg.getAttribute('xlink:href');
            if (!href) {
              const fallback = svgImg.getAttribute('data-href') || svgImg.getAttribute('data-src');
              if (fallback) {
                svgImg.setAttribute('href', fallback);
                svgImg.setAttribute('xlink:href', fallback);
              }
            }
          });

          if (!boundSelectionDocsRef.current.has(doc)) {
            boundSelectionDocsRef.current.add(doc);
            const handleSelectionEnd = () => {
              setTimeout(() => {
                try {
                  const sel = contents.window?.getSelection?.();
                  if (!sel || sel.rangeCount < 1) return;
                  const range = sel.getRangeAt(0);
                  if (!range || range.collapsed) return;
                  openSelectionPopupFromRange(contents, range);
                } catch (_) {}
              }, 0);
            };
            doc.addEventListener('mouseup', handleSelectionEnd);
            doc.addEventListener('touchend', handleSelectionEnd);
          }
        } catch (error) {
          console.error('Erreur sanitization contenu EPUB:', error);
        }
      });

      // Register relocated BEFORE display() — epub.js fires this during display() and we must
      // not miss it. Without this handler in place, epubInitializedRef stays false forever.
      rendition.on('relocated', (location) => {
        if (!mounted) return; // ignore events from a stale (destroyed) rendition in StrictMode
        const cfi = location?.start?.cfi;
        if (!cfi || !book.locations) return;
        // Mark EPUB as initialized — safe to save progress now
        epubInitializedRef.current = true;
        const pct = book.locations.percentageFromCfi(cfi);
        console.log('[EReader] relocated:', { cfi: cfi.slice(0, 60), pct, isFinite: Number.isFinite(pct) });
        if (Number.isFinite(pct)) {
          const next = Math.max(0, Math.min(100, Math.round(pct * 100)));
          setProgress(next);
          if (!isJumpingRef.current) {
            setSliderValue(next);
          }
        }
        setLastCfi(cfi);
        const keyStart = cfi.indexOf('(');
        const keyBang = cfi.indexOf('!');
        if (keyStart >= 0 && keyBang > keyStart + 1) {
          setCurrentSectionKey(cfi.slice(keyStart + 1, keyBang));
        } else {
          setCurrentSectionKey('');
        }
        const href = location?.start?.href;
        if (href) setCurrentHref(href);
        const displayed = location?.start?.displayed;
        if (displayed) {
          setEpubPageInfo({ page: displayed.page || 0, total: displayed.total || 0 });
        }
        if (highlightsRenderRafRef.current) {
          cancelAnimationFrame(highlightsRenderRafRef.current);
        }
        highlightsRenderRafRef.current = requestAnimationFrame(() => {
          renderPersistedHighlights();
        });

        // Prefetch next spine section to reduce page-turn latency.
        try {
          const sourceHref = location?.start?.href;
          if (sourceHref && prefetchSourceHrefRef.current !== sourceHref) {
            prefetchSourceHrefRef.current = sourceHref;
            const currentSection = book.spine?.get?.(sourceHref);
            const nextSection = currentSection?.next?.();
            if (nextSection?.href && typeof nextSection.load === 'function') {
              nextSection
                .load(book.load.bind(book))
                .then(() => {
                  try { nextSection.unload?.(); } catch (_) {}
                })
                .catch(() => {});
            }
          }
        } catch (_) {}
      });

      // Register selected handler BEFORE display() for the same reason.
      rendition.on('selected', (cfiRange, contents) => {
        if (!mounted) return;
        try {
          const selection = contents.window?.getSelection?.();
          let range = null;
          if (selection && selection.rangeCount > 0) {
            range = selection.getRangeAt(0);
          }
          if (range) {
            openSelectionPopupFromRange(contents, range, cfiRange);
          }
        } catch (err) {
          console.warn('Selection popup error:', err);
        }
      });

      const savedCfi = isLikelyValidCfi(initialLastPosition?.cfi) ? initialLastPosition.cfi : null;
      console.log('[EReader] EPUB restore:', {
        source: sourceLabel,
        initialLastPosition,
        savedCfi,
      });

      const firstSpineHref = (book.spine?.spineItems || [])
        .map((item) => item?.href)
        .find((href) => typeof href === 'string' && href.length > 0) || null;

      try {
        if (savedCfi) {
          await withTimeout(rendition.display(savedCfi), 45000, `rendition.display(savedCfi) (${sourceLabel})`);
        } else if (firstSpineHref) {
          await withTimeout(rendition.display(firstSpineHref), 45000, `rendition.display(firstSpineHref) (${sourceLabel})`);
        } else {
          await withTimeout(rendition.display(), 45000, `rendition.display(start) (${sourceLabel})`);
        }
      } catch (displayErr) {
        console.warn('EPUB: erreur affichage position sauvegardée, reprise au début:', displayErr);
        if (firstSpineHref) {
          await withTimeout(rendition.display(firstSpineHref), 45000, `rendition.display(fallback-firstSpineHref) (${sourceLabel})`);
        } else {
          await withTimeout(rendition.display(), 45000, `rendition.display(fallback-start) (${sourceLabel})`);
        }
      }

      // Load metadata/navigation in background; do not block first paint.
      book.ready
        .then(async () => {
          if (!mounted) return;
          try {
            const nav = await book.loaded.navigation;
            const navToc = Array.isArray(nav?.toc) ? nav.toc : [];
            if (navToc.length > 0) {
              if (mounted) setEpubToc(navToc);
            } else {
              const spineFallback = (book.spine?.spineItems || [])
                .filter((s) => typeof s?.href === 'string' && s.href.length > 0)
                .map((s, i) => ({
                  id: s.idref || `sp-${i + 1}`,
                  label: s.href.split('/').pop()?.replace(/\.x?html?$/i, '') || `Chapitre ${i + 1}`,
                  href: s.href,
                }));
              if (mounted) setEpubToc(spineFallback);
            }
          } catch (error) {
            if (mounted) {
              console.error('Erreur chargement table des matières EPUB:', error);
              const spineFallback = (book.spine?.spineItems || [])
                .filter((s) => typeof s?.href === 'string' && s.href.length > 0)
                .map((s, i) => ({
                  id: s.idref || `sp-${i + 1}`,
                  label: s.href.split('/').pop()?.replace(/\.x?html?$/i, '') || `Chapitre ${i + 1}`,
                  href: s.href,
                }));
              setEpubToc(spineFallback);
            }
          }
        })
        .catch((error) => {
          console.error('Erreur book.ready EPUB (background):', error);
        });

      return { book, rendition };
    };

    const initEpub = async () => {
      const runId = ++epubInitRunRef.current;
      try {
        if (!mounted) return;
        setDownloadStatus('Initialisation du lecteur EPUB...');
        const initStart = performance.now();
        console.log('[EReader] EPUB buffer bytes/signature:', {
          byteLength: fileBuffer?.byteLength || 0,
          signature: getBufferSignature(fileBuffer),
          isZip: looksLikeZip(fileBuffer),
        });
        if (!looksLikeZip(fileBuffer)) {
          throw new Error('Le fichier reçu n\'est pas un EPUB valide (signature ZIP absente).');
        }

        // Use only raw ArrayBuffer source (no CORS/network dependency).
        let initialized = null;
        try {
          initialized = await initFromSource(fileBuffer, 'buffer/raw-arraybuffer');
        } catch (initErr) {
          console.warn('EPUB init source failed:', initErr);
        }

        if (!initialized) {
          // Another React strict-mode run may have already initialized the reader.
          if (bookRef.current && renditionRef.current) {
            console.warn('EPUB init failed on this run, but reader already initialized on another run');
            setDownloadStatus('');
            return;
          }
          throw new Error('EPUB non initialisé');
        }

        // Ignore stale init run results (React StrictMode double-effect in dev).
        if (runId !== epubInitRunRef.current) {
          try { initialized.rendition?.destroy?.(); } catch (_) {}
          try { initialized.book?.destroy?.(); } catch (_) {}
          return;
        }

        const { book, rendition } = initialized;
        ownedBook = book;
        ownedRendition = rendition;
        bookRef.current = book;
        renditionRef.current = rendition;
        setDownloadStatus('');
        console.log('[EReader] EPUB init done in ms:', Math.round(performance.now() - initStart));

        // Generate locations in background (can be slow on large EPUB files).
        // Do not block first render.
        book.locations.generate(1200).catch((error) => {
          console.error('Erreur génération locations EPUB (navigation par %):', error);
        });

        // Force a resize after display to ensure epub.js reads correct container dimensions.
        // This fixes cases where renderTo was called before CSS layout was fully computed.
        try {
          const el = epubContainerRef.current;
          if (el && el.clientWidth > 0 && el.clientHeight > 0) {
            rendition.resize(el.clientWidth, el.clientHeight);
          }
        } catch (_) {}

      } catch (error) {
        console.error('Erreur initialisation EPUB:', error);
        if (mounted) {
          if (bookRef.current && renditionRef.current) {
            console.warn('Ignoring EPUB init error because a reader instance is already active');
            setDownloadStatus('');
            return;
          }
          setDownloadStatus('');
          setError(`Impossible d'ouvrir ce fichier EPUB. ${error.message || 'Erreur inconnue.'}`);
        }
      }
    };
    initEpub();

    return () => {
      mounted = false;
      // Destroy only objects created by this effect run.
      if (ownedRendition) {
        try { ownedRendition.destroy(); } catch (_) {}
        if (renditionRef.current === ownedRendition) {
          renditionRef.current = null;
        }
        ownedRendition = null;
      }
      if (ownedBook) {
        try { ownedBook.destroy(); } catch (_) {}
        if (bookRef.current === ownedBook) {
          bookRef.current = null;
        }
        ownedBook = null;
      }
      if (epubObjectUrl) {
        URL.revokeObjectURL(epubObjectUrl);
        epubObjectUrl = null;
      }
      if (highlightsRenderRafRef.current) {
        cancelAnimationFrame(highlightsRenderRafRef.current);
        highlightsRenderRafRef.current = 0;
      }
    };
  }, [canRead, content?.format, epubReady, fileBuffer, initialLastPosition]);

  useEffect(() => {
    if (!isEpub || !renditionRef.current) return;
    renditionRef.current.themes.fontSize(`${fontPercent}%`);
  }, [fontPercent, isEpub]);

  useEffect(() => {
    if (!isEpub || !renditionRef.current) return;
    const r = renditionRef.current;
    const theme = nightMode ? darkTheme : lightTheme;
    r.themes.override('color', theme.epubText);
    r.themes.override('background', theme.epubPageBg);
  }, [isEpub, nightMode]);

  // Quand le sommaire ou les annotations changent, forcer epub.js à recalculer sa largeur
  useEffect(() => {
    if (!isEpub || !renditionRef.current) return;
    const timer = setTimeout(() => {
      try {
        renditionRef.current.resize();
      } catch (_) {}
    }, 80); // laisser le temps à la transition CSS de finir
    return () => clearTimeout(timer);
  }, [isEpub, showToc, showSearch, showAnnotations]);

  useEffect(() => {
    if (!isEpub || !renditionRef.current) return;
    const timer = setTimeout(() => {
      renderPersistedHighlights();
    }, 40);
    return () => clearTimeout(timer);
  }, [isEpub, highlights, currentHref]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    setSliderValue(Number(progress || 0));
  }, [progress]);

  const handleProgressChange = (_, value) => {
    setSliderValue(Number(value));
  };

  const handleProgressCommit = async (_, value) => {
    const next = Number(value);
    if (content?.format === 'epub' && bookRef.current?.locations && renditionRef.current) {
      const percentage = Math.max(0, Math.min(1, next / 100));
      const cfi = bookRef.current.locations.cfiFromPercentage(percentage);
      if (cfi) {
        try {
          isJumpingRef.current = true;
          await renditionRef.current.display(cfi);
          setProgress(next);
        } catch (error) {
          console.error('Erreur navigation EPUB vers position:', error);
        } finally {
          isJumpingRef.current = false;
        }
      }
    }

    if (content?.format === 'pdf' && totalPages > 0) {
      const page = Math.max(1, Math.min(totalPages, Math.round((next / 100) * totalPages)));
      setCurrentPage(page);
    }
  };

  // ---- Highlight handlers ----
  const addHighlight = async (color, note = null) => {
    if (!selectionPopup) return;
    const { cfiRange, text } = selectionPopup;
    try {
      const saved = await readingService.createHighlight(id, {
        text,
        cfi_range: cfiRange,
        position: { start_cfi: cfiRange, chapter: currentHref || '' },
        color,
        note,
      });
      setHighlights((prev) => [...prev, saved]);

      // Avoid epub.js annotation bug: apply visual highlight directly in DOM for current selection.
      const ctx = selectionContextRef.current;
      if (ctx?.range) {
        applyDomHighlight(ctx.range, color);
        try {
          ctx.selection?.removeAllRanges?.();
        } catch (_) {}
      }
    } catch (err) {
      console.error('Erreur création surlignage:', err);
    }
    closeSelectionPopup();
  };

  const removeHighlight = async (highlight) => {
    try {
      await readingService.deleteHighlight(id, highlight.id);
      setHighlights((prev) => prev.filter((h) => h.id !== highlight.id));
    } catch (err) {
      console.error('Erreur suppression surlignage:', err);
    }
  };

  // ---- Bookmark handlers ----
  const currentBookmark = useMemo(() => {
    if (!lastCfi) return null;
    return bookmarks.find((b) => b.position?.cfi === lastCfi);
  }, [bookmarks, lastCfi]);

  const toggleBookmark = async () => {
    if (currentBookmark) {
      try {
        await readingService.deleteBookmark(id, currentBookmark.id);
        setBookmarks((prev) => prev.filter((b) => b.id !== currentBookmark.id));
      } catch (err) {
        console.error('Erreur suppression marque-page:', err);
      }
    } else {
      const label = (activeTocIndex >= 0 && tocItems[activeTocIndex])
        ? (tocItems[activeTocIndex].title || tocItems[activeTocIndex].label)
        : `${Math.round(progress)}%`;
      try {
        const saved = await readingService.createBookmark(id, {
          position: { cfi: lastCfi, percent: progress, chapter_label: label },
          label,
        });
        setBookmarks((prev) => [...prev, saved]);
      } catch (err) {
        console.error('Erreur création marque-page:', err);
      }
    }
  };

  const removeBookmark = async (bookmark) => {
    try {
      await readingService.deleteBookmark(id, bookmark.id);
      setBookmarks((prev) => prev.filter((b) => b.id !== bookmark.id));
    } catch (err) {
      console.error('Erreur suppression marque-page:', err);
    }
  };

  // ---- EPUB text search ----
  const handleSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q || !bookRef.current) return;
    setSearchLoading(true);
    setSearchResults([]);
    try {
      // epub.js spine search — iterate all spine items
      const results = [];
      await Promise.all(
        bookRef.current.spine.spineItems.map(async (item) => {
          try {
            const found = await item.load(bookRef.current.load.bind(bookRef.current))
              .then(() => item.find(q))
              .finally(() => item.unload());
            if (Array.isArray(found)) {
              found.forEach((r) => results.push({ cfi: r.cfi, excerpt: r.excerpt, href: item.href }));
            }
          } catch (_) {}
        })
      );
      setSearchResults(results.slice(0, 50));
    } catch (err) {
      console.error('Erreur recherche EPUB:', err);
    } finally {
      setSearchLoading(false);
    }
  }, [searchQuery]);

  const navigateToCfi = async (cfi) => {
    if (!cfi || !renditionRef.current || !isLikelyValidCfi(cfi)) return;
    try {
      isJumpingRef.current = true;
      await renditionRef.current.display(cfi);
    } catch (err) {
      console.error('Erreur navigation:', err);
    } finally {
      isJumpingRef.current = false;
    }
  };

  const paragraphs = useMemo(() => {
    const description = String(content?.description || '').trim();
    if (!description) {
      return ['Aucun extrait disponible pour ce livre.'];
    }
    return description.split('\n').map((line) => line.trim()).filter(Boolean);
  }, [content]);

  const tocItems = useMemo(() => {
    const chapterFallback = (Array.isArray(chapters) ? chapters : []).map((c, i) => ({
      id: c?.id || c?.chapter_id || `ch-${i + 1}`,
      label: c?.title || c?.name || c?.label || `Chapitre ${i + 1}`,
      href: c?.href || c?.path || c?.url || null,
      index: c?.index || (i + 1),
    }));
    if (!isEpub) return chapterFallback;
    const out = [];
    const walk = (nodes) => {
      if (!Array.isArray(nodes)) return;
      nodes.forEach((n) => {
        if (n?.label) out.push({ id: n.id, label: n.label, href: n.href });
        if (Array.isArray(n?.subitems) && n.subitems.length > 0) walk(n.subitems);
      });
    };
    walk(epubToc);
    return out.length > 0 ? out : chapterFallback;
  }, [chapters, epubToc, isEpub]);

  // Compute the single active TOC index — only ONE item highlighted
  const activeTocIndex = useMemo(() => {
    if (!isEpub || !currentHref || tocItems.length === 0) return -1;
    const currentBase = currentHref.split('#')[0];
    let active = -1;
    for (let i = 0; i < tocItems.length; i++) {
      const itemBase = (tocItems[i].href || '').split('#')[0];
      // Match: exact, or path suffix (handles relative vs absolute paths)
      if (currentBase === itemBase || currentBase.endsWith('/' + itemBase) || itemBase.endsWith('/' + currentBase)) {
        active = i;
      }
    }
    return active;
  }, [isEpub, currentHref, tocItems]);

  const goPrev = () => {
    bumpMobileChromeVisibility();
    if (isEpub) {
      if (!epubInitializedRef.current || !renditionRef.current) return;
      if (ttsSpeaking || ttsPaused) stopTts();
      try {
        renditionRef.current.prev().catch((error) => {
          console.error('Erreur navigation EPUB précédent:', error);
        });
      } catch (error) {
        console.error('Erreur navigation EPUB précédent (sync):', error);
      }
      return;
    }
    if (isPdf) setCurrentPage((p) => Math.max(1, p - 1));
  };

  const goNext = () => {
    bumpMobileChromeVisibility();
    if (isEpub) {
      if (!epubInitializedRef.current || !renditionRef.current) return;
      if (ttsSpeaking || ttsPaused) stopTts();
      try {
        renditionRef.current.next().catch((error) => {
          console.error('Erreur navigation EPUB suivant:', error);
        });
      } catch (error) {
        console.error('Erreur navigation EPUB suivant (sync):', error);
      }
      return;
    }
    if (isPdf) setCurrentPage((p) => Math.min(totalPages, p + 1));
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await readerRootRef.current?.requestFullscreen?.();
      } else {
        await document.exitFullscreen?.();
      }
    } catch (error) {
      console.error('Erreur plein écran:', error);
      setError('Mode plein écran non disponible sur ce navigateur.');
      setTimeout(() => setError(''), 3000);
    }
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: '60vh', display: 'grid', placeItems: 'center', gap: 3 }}>
        <CircularProgress />
        {downloadStatus && (
          <Box sx={{ textAlign: 'center', maxWidth: 400 }}>
            <Typography sx={{ fontSize: '0.9rem', color: '#433422', mb: 1.5 }}>
              {downloadStatus}
            </Typography>
            {downloadProgress > 0 && downloadProgress < 100 && (
              <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ flex: 1, height: 6, bgcolor: '#e8dfd0', borderRadius: 3, overflow: 'hidden' }}>
                  <Box
                    sx={{
                      height: '100%',
                      bgcolor: primary,
                      width: `${downloadProgress}%`,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </Box>
                <Typography sx={{ fontSize: '0.75rem', color: '#867465', minWidth: 45, textAlign: 'right' }}>
                  {downloadProgress}%
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </Box>
    );
  }

  if (!content || error) {
    return (
      <Container sx={{ py: 5 }}>
        <Alert severity="error" sx={{ mb: 2 }}>{error || 'Livre introuvable.'}</Alert>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button onClick={() => { setError(''); setLoading(true); setRetryKey((k) => k + 1); }} variant="contained" sx={{ bgcolor: primary }}>
            Réessayer
          </Button>
          <Button onClick={() => navigate('/catalogue')} variant="outlined">Retour</Button>
        </Box>
      </Container>
    );
  }

  if (!canRead) {
    return (
      <Container sx={{ py: 5 }}>
        <Alert severity="warning" sx={{ mb: 2 }}>
          {accessHint || 'Accès non autorisé pour ce contenu.'}
        </Alert>
        <Button onClick={() => navigate(`/catalogue/${id}`)} variant="outlined">
          Retour au détail
        </Button>
      </Container>
    );
  }

  {/* pas de blocage pour 'displaced' — bannière inline dans le reader */}

  if (lockState === 'device_limit') {
    return (
      <Container sx={{ py: 8, textAlign: 'center' }}>
        <Box sx={{ fontSize: 64, mb: 2 }}>🔒</Box>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>Limite d'appareils atteinte</Typography>
        <Typography sx={{ color: '#9c7e49', mb: 3 }}>
          Votre compte est associé à 3 appareils. Supprimez un appareil depuis votre espace personnel pour continuer.
        </Typography>
        <Button variant="contained" onClick={() => navigate('/devices')} sx={{ mr: 1 }}>Gérer mes appareils</Button>
        <Button variant="outlined" onClick={() => navigate(-1)}>Retour</Button>
      </Container>
    );
  }

  const canNavigateEpub = !isEpub || (Boolean(renditionRef.current) && epubInitializedRef.current);

  return (
    <Box
      ref={readerRootRef}
      onTouchStartCapture={bumpMobileChromeVisibility}
      sx={{
        height: '100vh',
        bgcolor: t.frameBg,
        color: t.text,
        display: 'grid',
        gridTemplateRows: lockState === 'displaced' ? '40px auto 1fr 44px' : 'auto 1fr 44px',
        overflow: 'hidden',
        transition: 'background-color 0.3s ease',
      }}
    >
      {/* Bannière déplacement */}
      {lockState === 'displaced' && (
        <Box sx={{ bgcolor: tokens.colors.accent, display: 'flex', alignItems: 'center', px: 2, gap: 1.5 }}>
          <Typography sx={{ color: '#fff', fontSize: '0.85rem', flex: 1 }}>
            📱 Un autre appareil a repris la lecture.
          </Typography>
          <Button
            size="small"
            variant="contained"
            onClick={reacquire}
            sx={{ bgcolor: tokens.colors.primary, '&:hover': { bgcolor: '#a0571a' }, textTransform: 'none', fontWeight: 700, fontSize: '0.78rem' }}
          >
            Reprendre ici
          </Button>
        </Box>
      )}

      {/* ── Toolbar principale ── */}
      <Box sx={{
        borderBottom: `1px solid ${t.border}`,
        bgcolor: t.headerBg,
        px: { xs: 1, md: 1.5 },
        display: { xs: mobileChromeVisible ? 'flex' : 'none', md: 'flex' },
        flexDirection: 'column',
      }}>
        {/* Ligne 1 : titre + tous les contrôles */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, minHeight: 48, flexWrap: 'nowrap' }}>
          {/* Gauche : retour + logo + titre */}
          <IconButton onClick={() => navigate(-1)} size="small" sx={{ color: t.text, flexShrink: 0 }}><ArrowLeft size={17} /></IconButton>
          <Box component="img" src={papyriMark} alt="Papyri" sx={{ height: 20, width: 20, objectFit: 'contain', borderRadius: '3px', opacity: 0.7, flexShrink: 0 }} />
          <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: { xs: 90, md: 220 }, color: t.text, opacity: 0.8, flexShrink: 1 }}>
            {content.title}
          </Typography>

          {/* Séparateur + info page — centre */}
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, overflow: 'hidden', px: 1 }}>
            {(isEpub && epubPageInfo.total > 0) ? (
              <Typography sx={{ fontSize: '0.72rem', color: t.subtleText, whiteSpace: 'nowrap' }}>
                {epubPageInfo.page} / {epubPageInfo.total}
              </Typography>
            ) : content.format === 'pdf' ? (
              <Typography sx={{ fontSize: '0.72rem', color: t.subtleText, whiteSpace: 'nowrap' }}>
                {currentPage} / {totalPages}
              </Typography>
            ) : (
              <Typography sx={{ fontSize: '0.72rem', color: t.subtleText, whiteSpace: 'nowrap' }}>
                {Math.round(progress)} %
              </Typography>
            )}
            {isEpub && activeTocIndex >= 0 && tocItems[activeTocIndex] && (
              <Typography sx={{ fontSize: '0.7rem', color: t.subtleText, opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: { xs: 80, md: 260 }, display: { xs: 'none', sm: 'block' } }}>
                {tocItems[activeTocIndex].title || tocItems[activeTocIndex].label}
              </Typography>
            )}
            {(ttsSpeaking || ttsPaused) && ttsNowText && (
              <Typography sx={{ fontSize: '0.68rem', color: primary, opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180, display: { xs: 'none', md: 'block' } }}>
                ♪ {ttsNowText}
              </Typography>
            )}
          </Box>

          {/* Droite : tous les contrôles */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.2, flexShrink: 0 }}>
            {/* TTS */}
            {ttsSupported && (
              <>
                <IconButton size="small" onClick={pauseResumeTts} title={ttsSpeaking && !ttsPaused ? 'Pause vocale' : 'Lire à voix haute'} sx={{ color: (ttsSpeaking || ttsPaused) ? primary : t.subtleText }}>
                  {ttsSpeaking && !ttsPaused ? <Pause size={16} /> : <Play size={16} />}
                </IconButton>
                <IconButton size="small" onClick={stopTts} disabled={!ttsSpeaking && !ttsPaused} title="Arrêter la lecture vocale" sx={{ color: t.subtleText }}>
                  <Square size={14} />
                </IconButton>
                {/* Vitesse TTS — compact */}
                <Button size="small" variant="text" onClick={() => {
                  const steps = [0.75, 1, 1.25, 1.5];
                  const idx = steps.findIndex((v) => Math.abs(v - ttsRate) < 0.01);
                  setTtsRate(steps[(idx + 1) % steps.length]);
                }} sx={{ minWidth: 0, px: 0.6, py: 0, color: (ttsSpeaking || ttsPaused) ? primary : t.subtleText, fontSize: '0.68rem', textTransform: 'none', display: { xs: 'none', md: 'flex' } }}>
                  x{ttsRate.toFixed(2).replace(/\.00$/, '')}
                </Button>
                {/* Voix TTS — masquée sur mobile */}
                <TextField select size="small" value={ttsVoiceUri} onChange={(e) => setTtsVoiceUri(e.target.value)}
                  sx={{ display: { xs: 'none', lg: 'flex' }, width: 130, '& .MuiInputBase-input': { py: 0.15, fontSize: '0.65rem', color: t.subtleText }, '& .MuiOutlinedInput-notchedOutline': { borderColor: t.border } }}>
                  {ttsVoices.map((v) => <MenuItem key={v.voiceURI} value={v.voiceURI} sx={{ fontSize: '0.72rem' }}>{v.name}</MenuItem>)}
                </TextField>
              </>
            )}

            {/* Taille police epub */}
            {isEpub && (
              <Box sx={{ width: 72, px: 0.5, display: { xs: 'none', md: 'block' } }}>
                <Slider min={80} max={140} step={10} value={fontPercent} onChange={(_, v) => setFontPercent(Number(v))} sx={{ color: primary, '& .MuiSlider-thumb': { width: 12, height: 12 } }} />
              </Box>
            )}

            {/* Mode jour/nuit */}
            <IconButton size="small" onClick={() => setNightMode((v) => !v)} title={nightMode ? 'Mode jour' : 'Mode nuit'} sx={{ color: t.text }}>
              {nightMode ? <Sun size={16} /> : <Moon size={16} />}
            </IconButton>

            {/* Marque-page */}
            {isEpub && (
              <IconButton size="small" onClick={toggleBookmark} title={currentBookmark ? 'Retirer marque-page' : 'Marque-page'} sx={{ color: currentBookmark ? primary : t.subtleText }}>
                {currentBookmark ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
              </IconButton>
            )}

            {/* Recherche */}
            {isEpub && (
              <IconButton size="small" onClick={() => { setShowSearch((v) => !v); setSearchResults([]); setSearchQuery(''); }} title="Recherche" sx={{ color: showSearch ? primary : t.subtleText }}>
                <Search size={16} />
              </IconButton>
            )}

            {/* Annotations */}
            <IconButton size="small" onClick={() => setShowAnnotations((v) => !v)} title="Annotations" sx={{ color: showAnnotations ? primary : t.subtleText }}>
              <Highlighter size={16} />
            </IconButton>

            {/* Sommaire */}
            <IconButton size="small" onClick={() => setShowToc((v) => !v)} title={showToc ? 'Masquer le sommaire' : 'Sommaire'} sx={{ color: (showToc || showSearch) ? primary : t.text }}>
              <Menu size={16} />
            </IconButton>

            {/* Plein écran */}
            <IconButton size="small" onClick={toggleFullscreen} title="Plein écran" sx={{ color: t.text }}>
              {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
            </IconButton>
          </Box>
        </Box>
      </Box>

      <Box sx={{ minHeight: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: `${(showToc || showSearch) ? '280px ' : ''}1fr${showAnnotations ? ' 300px' : ''}` } }}>
        {showSearch ? (
          <Box sx={{ borderRight: `1px solid ${t.border}`, bgcolor: t.sidebarBg, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ px: 1.5, py: 1.2, borderBottom: `1px solid ${t.border}` }}>
              <TextField
                size="small"
                fullWidth
                placeholder="Rechercher dans le livre…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                autoFocus
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={handleSearch} disabled={searchLoading || !searchQuery.trim()} sx={{ color: t.text }}>
                        {searchLoading ? <CircularProgress size={14} /> : <Search size={14} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                  sx: { fontSize: '0.85rem', bgcolor: t.readerBg, color: t.text, '& fieldset': { borderColor: t.border } },
                }}
              />
              {searchResults.length > 0 && (
                <Typography sx={{ fontSize: '0.7rem', opacity: 0.5, mt: 0.5 }}>{searchResults.length} résultat(s)</Typography>
              )}
            </Box>
            <List dense disablePadding sx={{ overflowY: 'auto', minHeight: 0, flex: 1 }}>
              {searchResults.length === 0 && !searchLoading && searchQuery && (
                <Typography sx={{ p: 2, fontSize: '0.82rem', color: t.subtleText }}>Aucun résultat.</Typography>
              )}
              {searchResults.map((r, idx) => (
                <ListItemButton
                  key={idx}
                  onClick={() => navigateToCfi(r.cfi)}
                  sx={{ borderBottom: `1px solid ${t.border}`, '&:hover': { bgcolor: t.hoverBg } }}
                >
                  <ListItemText
                    primary={
                      <Typography sx={{ fontSize: '0.78rem', color: t.text, lineHeight: 1.4 }}>
                        {(r.excerpt || '').split(new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')).map((part, i) =>
                          part.toLowerCase() === searchQuery.toLowerCase()
                            ? <Box key={i} component="mark" sx={{ bgcolor: 'rgba(212,160,23,0.35)', color: 'inherit', borderRadius: '2px' }}>{part}</Box>
                            : part
                        )}
                      </Typography>
                    }
                    secondary={<Typography sx={{ fontSize: '0.68rem', opacity: 0.45, mt: 0.3 }}>{r.href?.split('/').pop()?.replace(/\.x?html?$/i, '') || ''}</Typography>}
                  />
                </ListItemButton>
              ))}
            </List>
          </Box>
        ) : showToc ? (
          <Box sx={{ borderRight: `1px solid ${t.border}`, bgcolor: t.sidebarBg, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.04em', opacity: 0.7 }}>Sommaire</Typography>
              <Typography sx={{ fontSize: '0.72rem', opacity: 0.5 }}>{tocItems.length} chapitres</Typography>
            </Box>
            <Box sx={{ py: 0.5, px: 0.8, overflowY: 'auto', minHeight: 0 }}>
              {(tocItems.length > 0 ? tocItems : [{ label: 'Introduction' }]).slice(0, 200).map((item, idx) => {
                const isActive = idx === activeTocIndex;
                return (
                  <Box
                    key={item.id || item.href || `chapter-${idx + 1}`}
                    sx={{
                      px: 1.2,
                      py: 0.9,
                      my: 0.2,
                      borderRadius: 1,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      color: isActive ? primary : t.text,
                      bgcolor: isActive ? 'rgba(244,168,37,0.12)' : 'transparent',
                      borderLeft: isActive ? `3px solid ${primary}` : '3px solid transparent',
                      transition: 'all 0.15s ease',
                      '&:hover': { bgcolor: isActive ? 'rgba(244,168,37,0.16)' : t.hoverBg },
                    }}
                    onClick={() => {
                      if (isEpub && renditionRef.current && item.href) {
                        renditionRef.current.display(item.href).catch((error) => {
                          console.error('Erreur navigation chapitre EPUB:', error);
                        });
                      } else if (isPdf) {
                        const page = Number(item.index || idx + 1);
                        setCurrentPage(Math.max(1, Math.min(totalPages, page)));
                      }
                    }}
                  >
                    <Typography sx={{ fontSize: '0.72rem', opacity: 0.4, minWidth: 20, fontWeight: 600 }}>{idx + 1}</Typography>
                    <Typography sx={{ fontSize: '0.84rem', lineHeight: 1.3, fontWeight: isActive ? 700 : 400 }}>{item.title || item.label || `Chapitre ${idx + 1}`}</Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>
        ) : null}

        <Box ref={readerFrameRef} sx={{ minHeight: 0, p: 0, position: 'relative' }}>
          {/* Page flottante — style visionneuse PDF */}
          <Box sx={{ position: 'absolute', top: { xs: 0, md: 20 }, left: { xs: 0, md: 52 }, right: { xs: 0, md: 52 }, bottom: { xs: 0, md: 20 }, borderRadius: { xs: 0, md: '3px' }, bgcolor: t.readerBg, overflow: 'hidden', boxShadow: t.pageShadow, transition: 'background-color 0.3s ease' }}>
            {content.format === 'pdf' && fileBuffer ? (
              <Box ref={pdfContainerRef} sx={{ width: '100%', height: '100%', overflow: 'auto', display: 'grid', placeItems: 'start center', py: 2 }}>
                <canvas ref={pdfCanvasRef} style={{ maxWidth: '100%', height: 'auto', boxShadow: '0 4px 18px rgba(0,0,0,0.12)' }} />
              </Box>
            ) : null}

            {content.format === 'epub' && fileBuffer ? (
              <Box ref={epubContainerRef} sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
            ) : null}

            {/* Mobile tap zones for quick navigation */}
            <Box
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
              sx={{
                display: { xs: 'block', md: 'none' },
                position: 'absolute',
                left: 0,
                top: '18%',
                bottom: '18%',
                width: '20%',
                zIndex: 8,
                cursor: 'pointer',
                bgcolor: 'rgba(0,0,0,0.02)',
                borderRight: '1px solid rgba(255,255,255,0.08)',
                '&::after': {
                  content: '"‹"',
                  position: 'absolute',
                  left: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.28)',
                },
              }}
            />
            <Box
              onClick={(e) => { e.stopPropagation(); goNext(); }}
              sx={{
                display: { xs: 'block', md: 'none' },
                position: 'absolute',
                right: 0,
                top: '18%',
                bottom: '18%',
                width: '20%',
                zIndex: 8,
                cursor: 'pointer',
                bgcolor: 'rgba(0,0,0,0.02)',
                borderLeft: '1px solid rgba(255,255,255,0.08)',
                '&::after': {
                  content: '"›"',
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.28)',
                },
              }}
            />

            {/* Selection popup for highlighting */}
            {selectionPopup && isEpub && (
              <Box
                onClick={(e) => e.stopPropagation()}
                sx={{
                  position: 'absolute',
                  left: selectionPopup.x,
                  top: selectionPopup.y,
                  transform: 'translate(-50%, -100%)',
                  bgcolor: nightMode ? '#2d3139' : '#fff',
                  border: `1px solid ${t.border}`,
                  borderRadius: 2,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
                  px: 1.5,
                  py: 1,
                  zIndex: 100,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.8,
                  minWidth: showNoteInput ? 240 : 'auto',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {Object.entries(highlightColors).map(([key, val]) => (
                    <Box
                      key={key}
                      onClick={() => addHighlight(key)}
                      title={val.label}
                      sx={{
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        bgcolor: val.fill,
                        border: '2px solid',
                        borderColor: key === 'yellow' ? '#e6c200' : key === 'green' ? '#43a047' : key === 'blue' ? '#1e88e5' : '#d81b60',
                        cursor: 'pointer',
                        transition: 'transform 0.1s',
                        '&:hover': { transform: 'scale(1.2)' },
                      }}
                    />
                  ))}
                  <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                  <IconButton size="small" onClick={() => setShowNoteInput((v) => !v)} title="Ajouter une note" sx={{ color: t.text }}>
                    <MessageSquare size={16} />
                  </IconButton>
                  <IconButton size="small" onClick={closeSelectionPopup} title="Fermer" sx={{ color: t.subtleText }}>
                    <X size={14} />
                  </IconButton>
                </Box>
                {showNoteInput && (
                  <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-end' }}>
                    <input
                      type="text"
                      value={noteInput}
                      onChange={(e) => setNoteInput(e.target.value)}
                      placeholder="Ajouter une note..."
                      onKeyDown={(e) => { if (e.key === 'Enter' && noteInput.trim()) addHighlight('yellow', noteInput.trim()); }}
                      style={{
                        flex: 1,
                        border: `1px solid ${t.border}`,
                        borderRadius: 6,
                        padding: '6px 10px',
                        fontSize: '0.82rem',
                        background: nightMode ? '#1a1d23' : '#faf8f3',
                        color: t.text,
                        outline: 'none',
                      }}
                    />
                    <Button
                      size="small"
                      variant="contained"
                      disabled={!noteInput.trim()}
                      onClick={() => addHighlight('yellow', noteInput.trim())}
                      sx={{ minWidth: 'auto', px: 1.5, py: 0.5, fontSize: '0.75rem', bgcolor: primary, textTransform: 'none' }}
                    >
                      OK
                    </Button>
                  </Box>
                )}
              </Box>
            )}

            {!['pdf', 'epub'].includes(content.format) ? (
              <Box sx={{ height: '100%', overflowY: 'auto', p: { xs: 2, md: 5 }, fontFamily: 'Lora, serif', fontSize: { xs: '1.05rem', md: '1.25rem' }, lineHeight: 1.8, color: 'rgba(67,52,34,0.88)', display: 'grid', gap: 3 }}>
                {paragraphs.map((p, idx) => (
                  <Typography key={`${idx}-${p.slice(0, 10)}`} sx={{ font: 'inherit', lineHeight: 'inherit' }}>{p}</Typography>
                ))}
              </Box>
            ) : null}
          </Box>
        </Box>

        {/* Annotations sidebar panel */}
        {showAnnotations && (
          <Box sx={{ borderLeft: `1px solid ${t.border}`, bgcolor: t.sidebarBg, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.04em', opacity: 0.7 }}>Annotations</Typography>
              <IconButton size="small" onClick={() => setShowAnnotations(false)} sx={{ color: t.subtleText }}>
                <X size={16} />
              </IconButton>
            </Box>
            <Box sx={{ overflowY: 'auto', minHeight: 0, flex: 1 }}>
              {/* Bookmarks section */}
              {bookmarks.length > 0 && (
                <Box sx={{ px: 1.5, py: 1 }}>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.5, mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Bookmark size={12} /> Marque-pages ({bookmarks.length})
                  </Typography>
                  {bookmarks.map((bm) => (
                    <Box
                      key={bm.id}
                      sx={{
                        py: 0.8,
                        px: 1,
                        my: 0.3,
                        borderRadius: 1,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        '&:hover': { bgcolor: t.hoverBg },
                      }}
                    >
                      <Box onClick={() => navigateToCfi(bm.position?.cfi)} sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{bm.label || 'Marque-page'}</Typography>
                        <Typography sx={{ fontSize: '0.68rem', opacity: 0.45 }}>
                          {bm.position?.percent != null ? `${Math.round(bm.position.percent)}%` : ''} · {new Date(bm.created_at).toLocaleDateString('fr')}
                        </Typography>
                      </Box>
                      <IconButton size="small" onClick={() => removeBookmark(bm)} sx={{ color: t.subtleText, opacity: 0.6, '&:hover': { opacity: 1, color: '#e53935' } }}>
                        <Trash2 size={14} />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              )}

              {/* Highlights section */}
              {highlights.length > 0 && (
                <Box sx={{ px: 1.5, py: 1 }}>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.5, mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Highlighter size={12} /> Surlignages ({highlights.length})
                  </Typography>
                  {highlights.map((hl) => (
                    <Box
                      key={hl.id}
                      sx={{
                        py: 0.8,
                        px: 1,
                        my: 0.3,
                        borderRadius: 1,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 1,
                        borderLeft: `3px solid ${highlightColors[hl.color || 'yellow']?.fill || highlightColors.yellow.fill}`,
                        '&:hover': { bgcolor: t.hoverBg },
                      }}
                    >
                      <Box onClick={() => navigateToCfi(hl.cfi_range)} sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.8rem', lineHeight: 1.35, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                          "{hl.text}"
                        </Typography>
                        {hl.note && (
                          <Typography sx={{ fontSize: '0.75rem', mt: 0.3, opacity: 0.7, display: 'flex', alignItems: 'center', gap: 0.3 }}>
                            <MessageSquare size={10} /> {hl.note}
                          </Typography>
                        )}
                        <Typography sx={{ fontSize: '0.68rem', opacity: 0.4, mt: 0.3 }}>
                          {highlightColors[hl.color || 'yellow']?.label} · {new Date(hl.created_at).toLocaleDateString('fr')}
                        </Typography>
                      </Box>
                      <IconButton size="small" onClick={() => removeHighlight(hl)} sx={{ color: t.subtleText, opacity: 0.6, flexShrink: 0, '&:hover': { opacity: 1, color: '#e53935' } }}>
                        <Trash2 size={14} />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              )}

              {highlights.length === 0 && bookmarks.length === 0 && (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '0.82rem', opacity: 0.5, mb: 1 }}>Aucune annotation</Typography>
                  <Typography sx={{ fontSize: '0.72rem', opacity: 0.35 }}>
                    Sélectionnez du texte pour surligner ou utilisez le bouton marque-page.
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        )}
      </Box>

      {/* ── Barre de navigation — navigation seule ── */}
      <Box sx={{
        borderTop: `1px solid ${t.border}`,
        bgcolor: t.footerBg,
        px: { xs: 1, md: 3 },
        display: { xs: mobileChromeVisible ? 'flex' : 'none', md: 'flex' },
        alignItems: 'center',
        gap: 1,
        height: 44,
      }}>
        <Button
          onClick={goPrev}
          disabled={!canNavigateEpub}
          startIcon={<ChevronLeft size={14} />}
          size="small"
          sx={{
            flexShrink: 0,
            color: t.text,
            bgcolor: 'rgba(255,255,255,0.07)',
            borderRadius: '6px',
            px: 1.2,
            py: 0.4,
            minWidth: 90,
            fontWeight: 600,
            fontSize: '0.75rem',
            textTransform: 'none',
            border: '1px solid rgba(255,255,255,0.1)',
            '&:hover': { bgcolor: `${primary}28`, borderColor: primary, color: primary },
            '&.Mui-disabled': { opacity: 0.25, color: t.text },
          }}
        >
          Précédent
        </Button>
        <Slider
          value={sliderValue}
          onChange={handleProgressChange}
          onChangeCommitted={handleProgressCommit}
          sx={{
            color: primary,
            mx: 0.5,
            '& .MuiSlider-thumb': { width: 12, height: 12 },
            '& .MuiSlider-rail': { bgcolor: 'rgba(255,255,255,0.12)' },
          }}
        />
        <Button
          onClick={goNext}
          disabled={!canNavigateEpub}
          endIcon={<ChevronRight size={14} />}
          size="small"
          sx={{
            flexShrink: 0,
            color: t.text,
            bgcolor: 'rgba(255,255,255,0.07)',
            borderRadius: '6px',
            px: 1.2,
            py: 0.4,
            minWidth: 90,
            fontWeight: 600,
            fontSize: '0.75rem',
            textTransform: 'none',
            border: '1px solid rgba(255,255,255,0.1)',
            '&:hover': { bgcolor: `${primary}28`, borderColor: primary, color: primary },
            '&.Mui-disabled': { opacity: 0.25, color: t.text },
          }}
        >
          Suivant
        </Button>
      </Box>
    </Box>
  );
}
