import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  IconButton,
  Slider,
  Typography,
} from '@mui/material';
import { ArrowLeft, ChevronLeft, ChevronRight, Menu, Moon, Sun, Maximize, Minimize, Bookmark, BookmarkCheck, Highlighter, MessageSquare, Trash2, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { readingService } from '../services/reading.service';
import ePub from 'epubjs';
import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const primary = '#3211d4';

const lightTheme = {
  bg: '#faf8f3',
  text: '#433422',
  headerBg: 'rgba(250,248,243,0.95)',
  sidebarBg: '#f6f2e8',
  border: 'rgba(0,0,0,0.08)',
  readerBg: '#fff',
  hoverBg: 'rgba(0,0,0,0.04)',
  subtleText: 'rgba(67,52,34,0.55)',
};

const darkTheme = {
  bg: '#1a1d23',
  text: '#d8dee6',
  headerBg: 'rgba(26,29,35,0.95)',
  sidebarBg: '#21252d',
  border: 'rgba(255,255,255,0.08)',
  readerBg: '#1c2128',
  hoverBg: 'rgba(255,255,255,0.06)',
  subtleText: 'rgba(216,222,230,0.5)',
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
  const epubContainerRef = useRef(null);
  const bookRef = useRef(null);
  const renditionRef = useRef(null);
  const pdfContainerRef = useRef(null);
  const pdfCanvasRef = useRef(null);
  const pdfDocRef = useRef(null);
  const readerRootRef = useRef(null);
  const readerFrameRef = useRef(null);
  const isJumpingRef = useRef(false);
  const selectionContextRef = useRef(null);
  const boundSelectionDocsRef = useRef(new WeakSet());
  const highlightsRef = useRef(highlights);
  highlightsRef.current = highlights;
  const isEpub = content?.format === 'epub';
  const isPdf = content?.format === 'pdf';
  const t = nightMode ? darkTheme : lightTheme;

  const sanitizeHtmlString = (html) => {
    if (typeof html !== 'string') return html;
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
      .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
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
          const fileSizeMB = data?.file_size_bytes
            ? (data.file_size_bytes / (1024 * 1024)).toFixed(1)
            : '?';
          setDownloadStatus(`Téléchargement du fichier (${fileSizeMB} MB)...`);

          binaryBuffer = await readingService.getFileBuffer(id, (percent) => {
            setDownloadProgress(percent);
          });

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
  }, [id]);

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

    if (renditionRef.current) {
      renditionRef.current.destroy();
      renditionRef.current = null;
    }
    if (bookRef.current) {
      bookRef.current.destroy();
      bookRef.current = null;
    }

    let mounted = true;
    const initEpub = async () => {
      try {
        // Skip heavy sanitization for trusted content (Gutenberg, etc.)
        // Keep basic HTML sanitization via hooks below
        if (!mounted) return;

        const book = ePub(fileBuffer);
        const rendition = book.renderTo(epubContainerRef.current, {
          width: '100%',
          height: '100%',
          spread: 'none',
          flow: 'paginated',
          allowScriptedContent: false,
        });

        try {
          book.spine?.hooks?.serialize?.register(function (output) {
            // 'this' = Section instance (epub.js calls hooks with .apply(section))
            // Must modify this.output directly — return value is ignored by epub.js hooks
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
            doc.querySelectorAll('*').forEach((el) => {
              Array.from(el.attributes || []).forEach((attr) => {
                if (attr.name.toLowerCase().startsWith('on')) {
                  el.removeAttribute(attr.name);
                }
              });
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

        bookRef.current = book;
        renditionRef.current = rendition;

        await book.ready;
        try {
          const nav = await book.loaded.navigation;
          setEpubToc(Array.isArray(nav?.toc) ? nav.toc : []);
        } catch (error) {
          console.error('Erreur chargement table des matières EPUB:', error);
          setEpubToc([]);
        }

        try {
          await book.locations.generate(1200);
        } catch (error) {
          console.error('Erreur génération locations EPUB (navigation par %):', error);
        }

        const savedCfi = isLikelyValidCfi(initialLastPosition?.cfi) ? initialLastPosition.cfi : null;
        console.log('[EReader] EPUB restore:', {
          initialLastPosition,
          savedCfi,
          locationsLength: book.locations?.length?.() || 'N/A',
        });
        try {
          if (savedCfi) {
            console.log('[EReader] Displaying saved CFI:', savedCfi.slice(0, 80));
            await rendition.display(savedCfi);
          } else {
            console.log('[EReader] No saved CFI, displaying from beginning');
            await rendition.display();
          }
        } catch (displayErr) {
          console.warn('EPUB: erreur affichage position sauvegardée, reprise au début:', displayErr);
          try {
            await rendition.display();
          } catch (fallbackErr) {
            console.error('EPUB: impossible d\'afficher le contenu:', fallbackErr);
          }
        }

        rendition.on('relocated', (location) => {
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
          setTimeout(() => {
            renderPersistedHighlights();
          }, 30);
        });

        // Listen for text selection to show highlight popup
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
      } catch (error) {
        console.error('Erreur initialisation EPUB:', error);
        if (mounted) {
          setError(`Impossible d'ouvrir ce fichier EPUB. ${error.message || 'Erreur inconnue.'}`);
        }
      }
    };
    initEpub();

    return () => {
      mounted = false;
      if (renditionRef.current) {
        renditionRef.current.destroy();
        renditionRef.current = null;
      }
      if (bookRef.current) {
        bookRef.current.destroy();
        bookRef.current = null;
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
    if (nightMode) {
      r.themes.override('color', '#e7edf2');
      r.themes.override('background', '#1c2128');
    } else {
      r.themes.override('color', '#333');
      r.themes.override('background', '#fff');
    }
  }, [isEpub, nightMode]);

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
    if (!isEpub) return chapters;
    const out = [];
    const walk = (nodes) => {
      if (!Array.isArray(nodes)) return;
      nodes.forEach((n) => {
        if (n?.label) out.push({ id: n.id, label: n.label, href: n.href });
        if (Array.isArray(n?.subitems) && n.subitems.length > 0) walk(n.subitems);
      });
    };
    walk(epubToc);
    return out;
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
    if (isEpub && renditionRef.current) {
      renditionRef.current.prev().catch((error) => {
        console.error('Erreur navigation EPUB précédent:', error);
      });
      return;
    }
    if (isPdf) setCurrentPage((p) => Math.max(1, p - 1));
  };

  const goNext = () => {
    if (isEpub && renditionRef.current) {
      renditionRef.current.next().catch((error) => {
        console.error('Erreur navigation EPUB suivant:', error);
      });
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
        <Button onClick={() => navigate('/catalogue')} variant="outlined">Retour</Button>
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

  return (
    <Box
      ref={readerRootRef}
      sx={{
        height: '100vh',
        bgcolor: t.bg,
        color: t.text,
        display: 'grid',
        gridTemplateRows: '66px 1fr 64px',
        overflow: 'hidden',
        transition: 'background-color 0.3s ease, color 0.3s ease',
      }}
    >
      <Box sx={{ borderBottom: `1px solid ${t.border}`, bgcolor: t.headerBg, backdropFilter: 'blur(8px)', px: { xs: 1.5, md: 2.5 }, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, transition: 'background-color 0.3s ease' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
          <IconButton onClick={() => navigate(`/catalogue/${id}`)} sx={{ color: t.text }}><ArrowLeft size={18} /></IconButton>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.68rem', textTransform: 'uppercase', opacity: 0.65, fontWeight: 700 }}>Papyri</Typography>
            <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: { xs: 150, md: 360 } }}>
              {content.title}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
          <IconButton onClick={() => setNightMode((v) => !v)} title={nightMode ? 'Mode jour' : 'Mode nuit'} sx={{ color: t.text }}>
            {nightMode ? <Sun size={17} /> : <Moon size={17} />}
          </IconButton>
          {isEpub ? (
            <Box sx={{ width: 90, px: 0.8, display: { xs: 'none', md: 'block' } }}>
              <Slider min={80} max={140} step={10} value={fontPercent} onChange={(_, v) => setFontPercent(Number(v))} sx={{ color: primary }} />
            </Box>
          ) : null}
          {isEpub && (
            <IconButton onClick={toggleBookmark} title={currentBookmark ? 'Retirer le marque-page' : 'Ajouter un marque-page'} sx={{ color: currentBookmark ? '#D4A017' : t.text }}>
              {currentBookmark ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
            </IconButton>
          )}
          <IconButton onClick={() => setShowAnnotations((v) => !v)} title="Annotations" sx={{ color: showAnnotations ? primary : t.text }}>
            <Highlighter size={18} />
          </IconButton>
          <IconButton onClick={() => setShowToc((v) => !v)} title="Table des matières" sx={{ color: t.text }}>
            <Menu size={18} />
          </IconButton>
          <IconButton onClick={toggleFullscreen} title="Plein écran" sx={{ color: t.text }}>
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </IconButton>
        </Box>
      </Box>

      <Box sx={{ minHeight: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: `${showToc ? '280px ' : ''}1fr${showAnnotations ? ' 300px' : ''}` } }}>
        {showToc ? (
          <Box sx={{ borderRight: { lg: `1px solid ${t.border}` }, bgcolor: t.sidebarBg, minHeight: 0, display: 'flex', flexDirection: 'column', transition: 'background-color 0.3s ease' }}>
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
                      bgcolor: isActive ? 'rgba(50,17,212,0.08)' : 'transparent',
                      borderLeft: isActive ? `3px solid ${primary}` : '3px solid transparent',
                      transition: 'all 0.15s ease',
                      '&:hover': { bgcolor: isActive ? 'rgba(50,17,212,0.12)' : t.hoverBg },
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

        <Box ref={readerFrameRef} sx={{ minHeight: 0, p: { xs: 1, md: 2 }, position: 'relative' }}>
          <Box sx={{ position: 'absolute', top: { xs: 8, md: 16 }, left: { xs: 8, md: 16 }, right: { xs: 8, md: 16 }, bottom: { xs: 8, md: 16 }, border: `1px solid ${t.border}`, borderRadius: 2, bgcolor: t.readerBg, overflow: 'hidden', transition: 'background-color 0.3s ease' }}>
            {content.format === 'pdf' && fileBuffer ? (
              <Box ref={pdfContainerRef} sx={{ width: '100%', height: '100%', overflow: 'auto', display: 'grid', placeItems: 'start center', py: 2 }}>
                <canvas ref={pdfCanvasRef} style={{ maxWidth: '100%', height: 'auto', boxShadow: '0 4px 18px rgba(0,0,0,0.12)' }} />
              </Box>
            ) : null}

            {content.format === 'epub' && fileBuffer ? (
              <Box ref={epubContainerRef} sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
            ) : null}

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
          <Box sx={{ borderLeft: `1px solid ${t.border}`, bgcolor: t.sidebarBg, minHeight: 0, display: 'flex', flexDirection: 'column', transition: 'background-color 0.3s ease' }}>
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

      <Box sx={{ borderTop: `1px solid ${t.border}`, bgcolor: t.headerBg, backdropFilter: 'blur(8px)', px: { xs: 1, md: 3 }, py: 0.5, transition: 'background-color 0.3s ease' }}>
        <Box sx={{ maxWidth: 980, mx: 'auto' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton onClick={goPrev} title="Précédent" size="small" sx={{ flexShrink: 0, color: t.text }}>
              <ChevronLeft size={20} />
            </IconButton>
            <Slider
              value={sliderValue}
              onChange={handleProgressChange}
              onChangeCommitted={handleProgressCommit}
              sx={{ color: primary, mx: 1 }}
            />
            <IconButton onClick={goNext} title="Suivant" size="small" sx={{ flexShrink: 0, color: t.text }}>
              <ChevronRight size={20} />
            </IconButton>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, mt: -0.5 }}>
            {isEpub && epubPageInfo.total > 0 ? (
              <Typography sx={{ fontSize: '0.72rem', opacity: 0.55 }}>
                Page {epubPageInfo.page} / {epubPageInfo.total}
              </Typography>
            ) : null}
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, opacity: 0.6 }}>
              {content.format === 'pdf'
                ? `Page ${currentPage} / ${totalPages}`
                : `${Math.round(progress)} %`}
            </Typography>
            {isEpub && activeTocIndex >= 0 && tocItems[activeTocIndex] ? (
              <Typography sx={{ fontSize: '0.72rem', opacity: 0.45, maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {tocItems[activeTocIndex].title || tocItems[activeTocIndex].label}
              </Typography>
            ) : null}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
