/**
 * PdfReaderPage — Lecteur PDF avancé (pdfjs-dist v5)
 * Design aligné avec EReaderPage : chrome sombre Papyri, grid layout, primary amber.
 * Fonctionnalités : surlignage texte, marque-pages, annotations, zoom, rotation, recherche.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box, Button, CircularProgress, Alert, IconButton, Typography,
  Slider, TextField, InputAdornment, Drawer, List, ListItemButton,
  ListItemText,
} from '@mui/material';
import {
  ArrowLeft, ChevronLeft, ChevronRight, ZoomIn, ZoomOut,
  Moon, Sun, Maximize, Minimize, Menu, Search, X, RotateCw,
  Bookmark, BookmarkCheck, Highlighter, Trash2,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { readingService } from '../services/reading.service';
import { useReadingLock } from '../hooks/useReadingLock';
import { contentsService } from '../services/contents.service';
import papyriMark from '../assets/papyri-logo-gold.png';
import tokens from '../config/tokens';
import { useTranslation } from 'react-i18next';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const primary = '#f4a825';

const lightTheme = {
  frameBg:    '#3e3e3e',
  headerBg:   '#2b2b2b',
  footerBg:   '#2b2b2b',
  sidebarBg:  '#303030',
  border:     'rgba(255,255,255,0.09)',
  text:       '#e2e2e2',
  subtleText: 'rgba(226,226,226,0.45)',
  hoverBg:    'rgba(255,255,255,0.1)',
  pageBg:     '#ffffff',
  pageShadow: '0 8px 48px rgba(0,0,0,0.55)',
};

const darkTheme = {
  frameBg:    '#1a1a1a',
  headerBg:   '#111111',
  footerBg:   '#111111',
  sidebarBg:  '#1c1c1c',
  border:     'rgba(255,255,255,0.07)',
  text:       '#c8d0d8',
  subtleText: 'rgba(200,208,216,0.4)',
  hoverBg:    'rgba(255,255,255,0.07)',
  pageBg:     '#1c2128',
  pageShadow: '0 8px 48px rgba(0,0,0,0.75)',
};

const HIGHLIGHT_COLORS = {
  yellow: { fill: 'rgba(255,235,59,0.45)', label: 'Jaune',  hex: '#ffeb3b' },
  green:  { fill: 'rgba(76,175,80,0.45)',  label: 'Vert',   hex: '#4caf50' },
  blue:   { fill: 'rgba(66,165,245,0.45)', label: 'Bleu',   hex: '#42a5f5' },
  pink:   { fill: 'rgba(236,64,122,0.45)', label: 'Rose',   hex: '#ec407a' },
};

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3.0;
const ZOOM_STEP = 0.25;

function buildFallbackToc(numPages) {
  return Array.from({ length: numPages }, (_, i) => ({ page: i + 1, title: `Page ${i + 1}` }));
}

function getDisplayToc(toc, totalPages) {
  return Array.isArray(toc) && toc.length ? toc : buildFallbackToc(totalPages || 0);
}

// Inject minimal CSS for pdfjs TextLayer spans (once, globally)
function injectTextLayerStyles() {
  if (document.getElementById('papyri-pdf-text-layer-css')) return;
  const style = document.createElement('style');
  style.id = 'papyri-pdf-text-layer-css';
  style.textContent = `
    .papyri-pdf-textlayer { position:absolute; top:0; left:0; overflow:hidden; line-height:1; text-size-adjust:none; user-select:text; cursor:text; z-index:2; }
    .papyri-pdf-textlayer span { color:transparent; position:absolute; white-space:pre; cursor:text; transform-origin:0% 0%; }
    .papyri-pdf-textlayer span::selection { background-color:rgba(100,150,255,0.3); }
    .papyri-pdf-textlayer .markedContent { display:contents; }
  `;
  document.head.appendChild(style);
}

export default function PdfReaderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { lockState, reacquire } = useReadingLock(id);
  const { t: tl } = useTranslation();

  // ── State ─────────────────────────────────────────────────────────────────
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [canRead, setCanRead] = useState(false);

  const [pdfDoc, setPdfDoc] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [zoom, setZoom] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [rendering, setRendering] = useState(false);

  const [nightMode, setNightMode] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [toc, setToc] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [mobileChromeVisible, setMobileChromeVisible] = useState(true);

  // Annotations
  const [highlights, setHighlights] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [selectionPopover, setSelectionPopover] = useState(null); // { x, y, text, rangeRects }
  const [savingAnnotation, setSavingAnnotation] = useState(false);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const textLayerRef = useRef(null);
  const renderTaskRef = useRef(null);
  const textLayerTaskRef = useRef(null);
  const pdfDocRef = useRef(null);
  const viewportRef = useRef(null); // current rendered viewport
  const containerRef = useRef(null);
  const lastTouchX = useRef(null);
  const highlightsRef = useRef(highlights);
  highlightsRef.current = highlights;
  // Generation counter — prevents concurrent canvas renders (React StrictMode safe)
  const renderGenRef = useRef(0);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const t = nightMode ? darkTheme : lightTheme;

  // ── Inject text layer CSS ─────────────────────────────────────────────────
  useEffect(() => { injectTextLayerStyles(); }, []);

  // ── Chargement contenu + annotations ─────────────────────────────────────
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        const [data, access] = await Promise.all([
          contentsService.getContentById(id),
          contentsService.getContentAccess(id),
        ]);
        if (!active) return;
        setContent(data);
        setCanRead(Boolean(access?.can_read || access?.has_access || access?.canRead));

        const pos = await readingService.getLastPosition(id).catch(() => null);
        if (pos?.pdf_page) {
          setCurrentPage(Number(pos.pdf_page));
          setPageInput(String(pos.pdf_page));
        }

        if (!access?.can_read && !access?.has_access && !access?.canRead) {
          setError(tl('reader_ui.subscriptionRequired'));
        }
      } catch (e) {
        if (active) setError(e.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Chargement annotations (non-bloquant) ────────────────────────────────
  useEffect(() => {
    if (!canRead) return;
    Promise.all([
      readingService.getHighlights(id).catch(() => []),
      readingService.getBookmarks(id).catch(() => []),
    ]).then(([hl, bm]) => {
      setHighlights(hl || []);
      setBookmarks(bm || []);
    });
  }, [canRead, id]);

  // ── Chargement PDF ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!canRead) return;
    let active = true;

    async function loadPdf() {
      try {
        const file = await contentsService.getContentFileUrl(id);
        if (!active) return;
        const arrayBuffer = await readingService.getFileBuffer(id, null, file?.url, { cacheKey: 'pdf-reader' });
        if (!active) return;
        const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (!active) return;
        pdfDocRef.current = doc;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        try {
          const outline = await doc.getOutline();
          setToc(outline?.length ? outline : buildFallbackToc(doc.numPages));
        } catch (_) {
          setToc(buildFallbackToc(doc.numPages));
        }
      } catch (_) {
        if (active) setError(tl('reader_ui.pdfLoadError'));
      }
    }
    loadPdf();
    return () => { active = false; };
  }, [canRead, id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Rendu highlights sur overlay canvas ──────────────────────────────────
  const drawHighlightsForPage = useCallback((pageNum, viewport) => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    const dpr = window.devicePixelRatio || 1;
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    const pageHighlights = highlightsRef.current.filter(
      h => h.position?.page === pageNum && Array.isArray(h.position?.rects)
    );
    if (!pageHighlights.length) return;

    pageHighlights.forEach(hl => {
      const fillColor = HIGHLIGHT_COLORS[hl.color || 'yellow']?.fill || HIGHLIGHT_COLORS.yellow.fill;
      ctx.fillStyle = fillColor;
      hl.position.rects.forEach(({ x, y, w, h: rh }) => {
        // stored as fractions 0-1 of viewport CSS dimensions
        ctx.fillRect(
          x * viewport.width * dpr,
          y * viewport.height * dpr,
          w * viewport.width * dpr,
          rh * viewport.height * dpr,
        );
      });
    });
  }, []);

  // ── Rendu page ────────────────────────────────────────────────────────────
  const renderPage = useCallback(async (pageNum) => {
    const doc = pdfDocRef.current;
    const canvas = canvasRef.current;
    const overlay = overlayCanvasRef.current;
    const textLayerDiv = textLayerRef.current;
    if (!doc || !canvas) return;

    // Increment generation — any previously running renderPage with a different gen will bail out
    const gen = ++renderGenRef.current;

    // Cancel previous tasks
    if (renderTaskRef.current) { renderTaskRef.current.cancel(); renderTaskRef.current = null; }
    if (textLayerTaskRef.current) { textLayerTaskRef.current.cancel(); textLayerTaskRef.current = null; }

    // Reset canvas dimensions to force pdfjs to release its internal canvas lock
    // before starting a new render (fixes "Cannot use the same canvas" error in StrictMode)
    canvas.width = 1;
    canvas.height = 1;

    // Yield to the event loop so pdfjs can fully process the cancellation
    await new Promise(r => setTimeout(r, 0));
    if (gen !== renderGenRef.current || !mountedRef.current) return;

    setRendering(true);
    try {
      const page = await doc.getPage(pageNum);
      if (gen !== renderGenRef.current || !mountedRef.current) return;
      const viewport = page.getViewport({ scale: zoom, rotation });
      viewportRef.current = viewport;
      const dpr = window.devicePixelRatio || 1;

      // Main canvas
      canvas.width = viewport.width * dpr;
      canvas.height = viewport.height * dpr;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);

      // Overlay canvas (highlight layer)
      if (overlay) {
        overlay.width = viewport.width * dpr;
        overlay.height = viewport.height * dpr;
        overlay.style.width = `${viewport.width}px`;
        overlay.style.height = `${viewport.height}px`;
      }

      // Text layer div
      if (textLayerDiv) {
        textLayerDiv.innerHTML = '';
        textLayerDiv.style.width = `${viewport.width}px`;
        textLayerDiv.style.height = `${viewport.height}px`;
        // Set CSS custom properties required by pdfjs TextLayer v5
        textLayerDiv.style.setProperty('--total-scale-factor', String(zoom * dpr));
      }

      const task = page.render({ canvasContext: ctx, viewport });
      renderTaskRef.current = task;
      await task.promise;
      renderTaskRef.current = null;
      if (gen !== renderGenRef.current || !mountedRef.current) return;

      // Draw highlights
      drawHighlightsForPage(pageNum, viewport);

      // Text layer (non-blocking — errors are silently swallowed)
      if (textLayerDiv) {
        try {
          const textLayer = new pdfjsLib.TextLayer({
            textContentSource: page.streamTextContent(),
            container: textLayerDiv,
            viewport,
          });
          textLayerTaskRef.current = textLayer;
          await textLayer.render();
          textLayerTaskRef.current = null;
        } catch (_) {}
      }
    } catch (e) {
      if (e?.name !== 'RenderingCancelledException' && e?.name !== 'AbortException') {
        console.error('Render error:', e);
      }
    } finally {
      if (gen === renderGenRef.current && mountedRef.current) setRendering(false);
    }
  }, [zoom, rotation, drawHighlightsForPage]);

  useEffect(() => {
    if (pdfDoc) renderPage(currentPage);
  }, [pdfDoc, currentPage, zoom, rotation, renderPage]);

  // Re-draw highlights when highlights array changes (after save/delete)
  useEffect(() => {
    if (viewportRef.current) drawHighlightsForPage(currentPage, viewportRef.current);
  }, [highlights, currentPage, drawHighlightsForPage]);

  // ── Sauvegarde progression ────────────────────────────────────────────────
  useEffect(() => {
    if (!canRead || !pdfDoc || currentPage <= 0) return;
    const pct = Math.round((currentPage / totalPages) * 100);
    const timer = setTimeout(() => {
      readingService.saveProgress(id, {
        progress: pct,
        last_position: { pdf_page: currentPage },
        total_pages: totalPages,
      }).catch(() => {});
    }, 1500);
    return () => clearTimeout(timer);
  }, [canRead, pdfDoc, currentPage, totalPages, id]);

  // ── Navigation ────────────────────────────────────────────────────────────
  function goToPage(p) {
    const page = Math.max(1, Math.min(totalPages, p));
    setCurrentPage(page);
    setPageInput(String(page));
    setSelectionPopover(null);
  }

  function handlePageInputBlur() {
    const p = parseInt(pageInput, 10);
    if (!isNaN(p)) goToPage(p);
    else setPageInput(String(currentPage));
  }

  function handlePageInputKey(e) {
    if (e.key === 'Enter') handlePageInputBlur();
    if (e.key === 'Escape') setPageInput(String(currentPage));
  }

  // ── Zoom ──────────────────────────────────────────────────────────────────
  function zoomIn() { setSelectionPopover(null); setZoom(z => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2))); }
  function zoomOut() { setSelectionPopover(null); setZoom(z => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2))); }
  function resetZoom() { setZoom(1.0); }

  // ── Clavier ───────────────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goToPage(currentPage + 1);
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goToPage(currentPage - 1);
      if (e.key === '+' || e.key === '=') zoomIn();
      if (e.key === '-') zoomOut();
      if (e.key === 'f' || e.key === 'F') toggleFullscreen();
      if (e.key === 'Escape') setSelectionPopover(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentPage, totalPages]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Swipe + tap mobile ────────────────────────────────────────────────────
  function handleTouchStart(e) { lastTouchX.current = e.touches[0].clientX; }
  function handleTouchEnd(e) {
    if (lastTouchX.current === null) return;
    const diff = lastTouchX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goToPage(currentPage + 1);
      else goToPage(currentPage - 1);
    } else {
      setMobileChromeVisible(v => !v);
    }
    lastTouchX.current = null;
  }

  // ── Plein écran ───────────────────────────────────────────────────────────
  function toggleFullscreen() {
    if (!document.fullscreenElement) { containerRef.current?.requestFullscreen?.(); setFullscreen(true); }
    else { document.exitFullscreen?.(); setFullscreen(false); }
  }

  // ── Rotation ─────────────────────────────────────────────────────────────
  function rotate() { setRotation(r => (r + 90) % 360); }

  // ── Recherche ─────────────────────────────────────────────────────────────
  async function handleSearch() {
    if (!searchQuery.trim() || !pdfDocRef.current) return;
    setSearchLoading(true);
    setSearchResults([]);
    const results = [];
    const query = searchQuery.toLowerCase();
    for (let i = 1; i <= pdfDocRef.current.numPages; i++) {
      const page = await pdfDocRef.current.getPage(i);
      const textContent = await page.getTextContent();
      const text = textContent.items.map(item => item.str).join(' ');
      if (text.toLowerCase().includes(query)) {
        const idx = text.toLowerCase().indexOf(query);
        results.push({ page: i, excerpt: text.slice(Math.max(0, idx - 40), idx + query.length + 40) });
      }
    }
    setSearchResults(results);
    setSearchLoading(false);
  }

  // ── TOC navigate ─────────────────────────────────────────────────────────
  async function handleTocItem(item) {
    if (item?.page) { goToPage(item.page); setShowToc(false); return; }
    if (!pdfDocRef.current || !item.dest) return;
    try {
      const dest = typeof item.dest === 'string' ? await pdfDocRef.current.getDestination(item.dest) : item.dest;
      if (dest) { const ref = await pdfDocRef.current.getPageIndex(dest[0]); goToPage(ref + 1); setShowToc(false); }
    } catch (_) {}
  }

  // ── Sélection de texte → popover couleur ─────────────────────────────────
  function handleMouseUp(e) {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) {
      setSelectionPopover(null);
      return;
    }
    const text = selection.toString().trim();
    if (!text) { setSelectionPopover(null); return; }

    const viewport = viewportRef.current;
    const textLayerDiv = textLayerRef.current;
    if (!viewport || !textLayerDiv) return;

    // Get container offset
    const containerRect = textLayerDiv.getBoundingClientRect();

    // Get all client rects of the selection
    const range = selection.getRangeAt(0);
    const clientRects = Array.from(range.getClientRects());

    // Normalize rects to 0-1 fractions of viewport CSS dimensions
    const rects = clientRects.map(r => ({
      x: (r.left - containerRect.left) / viewport.width,
      y: (r.top - containerRect.top) / viewport.height,
      w: r.width / viewport.width,
      h: r.height / viewport.height,
    })).filter(r => r.w > 0 && r.h > 0);

    if (!rects.length) return;

    // Position popover near selection
    const lastRect = clientRects[clientRects.length - 1];
    setSelectionPopover({
      x: Math.min(lastRect.right, window.innerWidth - 220),
      y: lastRect.bottom + 8,
      text,
      rects,
    });
  }

  function dismissPopover() {
    setSelectionPopover(null);
    window.getSelection()?.removeAllRanges();
  }

  async function saveHighlight(color) {
    if (!selectionPopover || savingAnnotation) return;
    setSavingAnnotation(true);
    const { text, rects } = selectionPopover;
    dismissPopover();
    try {
      const saved = await readingService.createHighlight(id, {
        text,
        cfi_range: null,
        position: { page: currentPage, rects },
        color,
        note: null,
      });
      setHighlights(prev => [saved, ...prev]);
    } catch (_) {}
    finally { setSavingAnnotation(false); }
  }

  async function deleteHighlight(hl) {
    try {
      await readingService.deleteHighlight(id, hl.id);
      setHighlights(prev => prev.filter(h => h.id !== hl.id));
    } catch (_) {}
  }

  // ── Marque-pages ─────────────────────────────────────────────────────────
  const currentBookmark = bookmarks.find(b => b.position?.page === currentPage);

  async function toggleBookmark() {
    if (currentBookmark) {
      try {
        await readingService.deleteBookmark(id, currentBookmark.id);
        setBookmarks(prev => prev.filter(b => b.id !== currentBookmark.id));
      } catch (_) {}
    } else {
      try {
        const saved = await readingService.createBookmark(id, {
          position: { page: currentPage },
          label: `Page ${currentPage}`,
        });
        setBookmarks(prev => [saved, ...prev]);
      } catch (_) {}
    }
  }

  async function deleteBookmark(bm) {
    try {
      await readingService.deleteBookmark(id, bm.id);
      setBookmarks(prev => prev.filter(b => b.id !== bm.id));
    } catch (_) {}
  }

  // ── Computed ──────────────────────────────────────────────────────────────
  const progress = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;
  const displayToc = getDisplayToc(toc, totalPages);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: lightTheme.frameBg }}>
        <CircularProgress sx={{ color: primary }} />
      </Box>
    );
  }

  // ── Device limit ──────────────────────────────────────────────────────────
  if (lockState === 'device_limit') {
    return (
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: lightTheme.frameBg, p: 4 }}>
        <Box sx={{ textAlign: 'center' }}>
          <Box sx={{ fontSize: 64, mb: 2 }}>🔒</Box>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, color: '#e2e2e2' }}>{tl('reader_ui.deviceLimit')}</Typography>
          <Typography sx={{ color: 'rgba(226,226,226,0.6)', mb: 3 }}>{tl('reader_ui.deviceLimitDesc')}</Typography>
          <Button variant="contained" onClick={() => navigate('/devices')} sx={{ mr: 1, bgcolor: primary, '&:hover': { bgcolor: '#c88a1a' } }}>{tl('reader_ui.manageDevices')}</Button>
          <Button variant="outlined" onClick={() => navigate(-1)} sx={{ color: '#e2e2e2', borderColor: 'rgba(255,255,255,0.3)' }}>{tl('reader_ui.back')}</Button>
        </Box>
      </Box>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: lightTheme.frameBg, p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        <Box component="button" onClick={() => navigate(-1)} sx={{ color: primary, cursor: 'pointer', background: 'none', border: 'none', fontSize: '0.9rem' }}>
          ← {tl('reader_ui.back')}
        </Box>
      </Box>
    );
  }

  // ── Layout principal ──────────────────────────────────────────────────────
  return (
    <Box
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
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
      {/* ── Bannière déplacement ─────────────────────────────────────────── */}
      {lockState === 'displaced' && (
        <Box sx={{ bgcolor: tokens.colors.accent, display: 'flex', alignItems: 'center', px: 2, gap: 1.5 }}>
          <Typography sx={{ color: '#fff', fontSize: '0.85rem', flex: 1 }}>
            📱 {tl('reader_ui.displacedBanner')}
          </Typography>
          <Button size="small" variant="contained" onClick={reacquire}
            sx={{ bgcolor: primary, '&:hover': { bgcolor: '#c88a1a' }, textTransform: 'none', fontWeight: 700, fontSize: '0.78rem' }}>
            {tl('reader_ui.reacquire')}
          </Button>
        </Box>
      )}

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <Box sx={{
        borderBottom: `1px solid ${t.border}`,
        bgcolor: t.headerBg,
        px: { xs: 1, md: 1.5 },
        display: 'flex', alignItems: 'center', gap: 0.4,
        minHeight: 48, flexWrap: 'nowrap',
        visibility: { xs: mobileChromeVisible ? 'visible' : 'hidden', md: 'visible' },
        opacity: { xs: mobileChromeVisible ? 1 : 0, md: 1 },
        transition: 'opacity 0.18s ease, visibility 0.18s ease',
      }}>
        {/* Retour + logo + titre */}
        <IconButton onClick={() => navigate(-1)} size="small" sx={{ color: t.text, flexShrink: 0 }}>
          <ArrowLeft size={17} />
        </IconButton>
        <Box component="img" src={papyriMark} alt="Papyri"
          sx={{ height: 20, width: 20, objectFit: 'contain', borderRadius: '3px', opacity: 0.7, flexShrink: 0 }} />
        <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: { xs: 90, md: 220 }, color: t.text, opacity: 0.8, flexShrink: 1 }}>
          {content?.title}
        </Typography>

        {/* Centre : page info */}
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 1 }}>
          <Typography sx={{ fontSize: '0.72rem', color: t.subtleText, whiteSpace: 'nowrap' }}>
            {currentPage} / {totalPages}
          </Typography>
        </Box>

        {/* Droite : contrôles */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.2, flexShrink: 0 }}>
          {/* Zoom */}
          <IconButton size="small" onClick={zoomOut} disabled={zoom <= ZOOM_MIN} sx={{ color: t.subtleText }}><ZoomOut size={16} /></IconButton>
          <Typography onClick={resetZoom} sx={{ fontSize: '0.72rem', fontWeight: 700, color: t.subtleText, cursor: 'pointer', minWidth: 36, textAlign: 'center', '&:hover': { color: t.text } }}>
            {Math.round(zoom * 100)}%
          </Typography>
          <IconButton size="small" onClick={zoomIn} disabled={zoom >= ZOOM_MAX} sx={{ color: t.subtleText }}><ZoomIn size={16} /></IconButton>

          {/* Rotation */}
          <IconButton size="small" onClick={rotate} sx={{ color: t.subtleText, display: { xs: 'none', sm: 'inline-flex' } }}>
            <RotateCw size={16} />
          </IconButton>

          {/* Recherche */}
          <IconButton size="small" onClick={() => { setShowSearch(v => !v); setSearchResults([]); setSearchQuery(''); }} sx={{ color: showSearch ? primary : t.subtleText }}>
            <Search size={16} />
          </IconButton>

          {/* Sommaire */}
          <IconButton size="small" onClick={() => setShowToc(v => !v)} sx={{ color: showToc ? primary : t.text }}>
            <Menu size={16} />
          </IconButton>

          {/* Marque-page */}
          <IconButton size="small" onClick={toggleBookmark} title={currentBookmark ? tl('reader_ui.removeBookmark') : tl('reader_ui.addBookmark')} sx={{ color: currentBookmark ? primary : t.subtleText }}>
            {currentBookmark ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
          </IconButton>

          {/* Annotations */}
          <IconButton size="small" onClick={() => setShowAnnotations(v => !v)} title={tl('reader_ui.annotations')} sx={{ color: showAnnotations ? primary : t.subtleText }}>
            <Highlighter size={16} />
          </IconButton>

          {/* Jour / Nuit */}
          <IconButton size="small" onClick={() => setNightMode(v => !v)} sx={{ color: t.text }}>
            {nightMode ? <Sun size={16} /> : <Moon size={16} />}
          </IconButton>

          {/* Plein écran */}
          <IconButton size="small" onClick={toggleFullscreen} sx={{ color: t.text }}>
            {fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </IconButton>
        </Box>
      </Box>

      {/* ── Contenu : sidebars + canvas ──────────────────────────────────── */}
      <Box sx={{ minHeight: 0, display: 'flex', overflow: 'hidden' }}>

        {/* Sidebar TOC (desktop) */}
        {showToc && (
          <Box sx={{ width: 280, flexShrink: 0, borderRight: `1px solid ${t.border}`, bgcolor: t.sidebarBg, display: { xs: 'none', lg: 'flex' }, flexDirection: 'column', overflow: 'hidden' }}>
            <Box sx={{ px: 1.5, py: 1.2, borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', color: t.text }}>{tl('reader_ui.toc')}</Typography>
              <IconButton size="small" onClick={() => setShowToc(false)} sx={{ color: t.subtleText }}><X size={14} /></IconButton>
            </Box>
            <List dense sx={{ overflowY: 'auto', flex: 1 }}>
              {displayToc.map((item, i) => (
                <ListItemButton key={i} onClick={() => handleTocItem(item)} sx={{ py: 0.6, px: 1.5, '&:hover': { bgcolor: t.hoverBg } }}>
                  <ListItemText primary={item.title} primaryTypographyProps={{ fontSize: '0.82rem', color: t.text, noWrap: true }} />
                </ListItemButton>
              ))}
              {displayToc.length === 0 && <Typography sx={{ px: 2, py: 2, fontSize: '0.78rem', color: t.subtleText }}>{tl('reader_ui.noToc')}</Typography>}
            </List>
          </Box>
        )}

        {/* Sidebar Recherche (desktop) */}
        {showSearch && (
          <Box sx={{ width: 280, flexShrink: 0, borderRight: `1px solid ${t.border}`, bgcolor: t.sidebarBg, display: { xs: 'none', lg: 'flex' }, flexDirection: 'column', overflow: 'hidden' }}>
            <Box sx={{ px: 1.5, py: 1.2, borderBottom: `1px solid ${t.border}` }}>
              <TextField size="small" fullWidth autoFocus
                placeholder={tl('reader_ui.searchInDocument')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search size={14} /></InputAdornment> }}
                sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.82rem', color: t.text, '& fieldset': { borderColor: t.border } } }}
              />
              <Box component="button" onClick={handleSearch} disabled={searchLoading}
                sx={{ mt: 1, width: '100%', py: 0.8, borderRadius: 1, border: 'none', cursor: 'pointer', bgcolor: primary, color: '#fff', fontSize: '0.82rem', fontWeight: 600, '&:disabled': { opacity: 0.6 } }}>
                {searchLoading ? '…' : tl('reader_ui.search')}
              </Box>
            </Box>
            <List dense sx={{ overflowY: 'auto', flex: 1 }}>
              {searchResults.map((r, i) => (
                <ListItemButton key={i} onClick={() => goToPage(r.page)} sx={{ py: 0.75, px: 1.5, '&:hover': { bgcolor: t.hoverBg } }}>
                  <Box>
                    <Typography sx={{ fontSize: '0.72rem', color: primary, fontWeight: 700 }}>{tl('reader_ui.pageN', { n: r.page })}</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: t.subtleText }}>…{r.excerpt}…</Typography>
                  </Box>
                </ListItemButton>
              ))}
              {searchResults.length === 0 && !searchLoading && searchQuery && (
                <Typography sx={{ px: 2, py: 2, fontSize: '0.78rem', color: t.subtleText }}>{tl('reader_ui.noResults')}</Typography>
              )}
            </List>
          </Box>
        )}

        {/* Zone lecture */}
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', position: 'relative', px: { xs: 0, sm: 2 } }}
          onClick={e => { if (!e.target.closest('canvas') && !e.target.closest('.papyri-pdf-textlayer')) setSelectionPopover(null); }}
        >
          {/* Flèche gauche */}
          <IconButton onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}
            sx={{ position: 'absolute', left: { xs: 4, sm: 12 }, top: '50%', transform: 'translateY(-50%)', zIndex: 10, bgcolor: t.headerBg, border: `1px solid ${t.border}`, color: t.text, '&:hover': { bgcolor: t.hoverBg }, '&.Mui-disabled': { opacity: 0.2 }, boxShadow: 2 }}>
            <ChevronLeft size={22} />
          </IconButton>

          {/* Canvas + text layer + overlay */}
          <Box sx={{ position: 'relative', boxShadow: t.pageShadow, borderRadius: 1, overflow: 'hidden', bgcolor: t.pageBg, display: 'inline-flex' }}>
            {rendering && (
              <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: t.pageBg, zIndex: 10 }}>
                <CircularProgress size={32} sx={{ color: primary }} />
              </Box>
            )}
            {/* Main canvas */}
            <canvas ref={canvasRef} style={{ display: 'block', position: 'relative', zIndex: 1 }} />
            {/* Highlight overlay (above canvas, below text layer) */}
            <canvas ref={overlayCanvasRef} style={{ position: 'absolute', top: 0, left: 0, zIndex: 2, pointerEvents: 'none' }} />
            {/* Text layer for selection */}
            <div
              ref={textLayerRef}
              className="papyri-pdf-textlayer"
              onMouseUp={handleMouseUp}
              style={{ zIndex: 3 }}
            />
          </Box>

          {/* Flèche droite */}
          <IconButton onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages}
            sx={{ position: 'absolute', right: { xs: 4, sm: 12 }, top: '50%', transform: 'translateY(-50%)', zIndex: 10, bgcolor: t.headerBg, border: `1px solid ${t.border}`, color: t.text, '&:hover': { bgcolor: t.hoverBg }, '&.Mui-disabled': { opacity: 0.2 }, boxShadow: 2 }}>
            <ChevronRight size={22} />
          </IconButton>

          {/* Tap zones mobile */}
          <Box onClick={() => goToPage(currentPage - 1)} sx={{ display: { xs: 'block', sm: 'none' }, position: 'absolute', left: 0, top: '15%', bottom: '15%', width: '20%', zIndex: 5 }} />
          <Box onClick={() => goToPage(currentPage + 1)} sx={{ display: { xs: 'block', sm: 'none' }, position: 'absolute', right: 0, top: '15%', bottom: '15%', width: '20%', zIndex: 5 }} />

          {/* ── Popover couleur de surlignage ─────────────────────────────── */}
          {selectionPopover && (
            <Box sx={{
              position: 'fixed',
              left: selectionPopover.x,
              top: selectionPopover.y,
              zIndex: 200,
              bgcolor: t.headerBg,
              border: `1px solid ${t.border}`,
              borderRadius: 2,
              boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
              px: 1.5, py: 1,
              display: 'flex', alignItems: 'center', gap: 1,
            }}>
              <Typography sx={{ fontSize: '0.72rem', color: t.subtleText, mr: 0.5 }}>
                <Highlighter size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                {tl('reader_ui.highlight')}
              </Typography>
              {Object.entries(HIGHLIGHT_COLORS).map(([key, { hex }]) => (
                <Box
                  key={key}
                  onClick={() => saveHighlight(key)}
                  sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: hex, cursor: 'pointer', border: '2px solid rgba(255,255,255,0.2)', '&:hover': { transform: 'scale(1.2)', borderColor: '#fff' }, transition: 'transform 0.15s' }}
                />
              ))}
              <IconButton size="small" onClick={dismissPopover} sx={{ color: t.subtleText, ml: 0.5 }}>
                <X size={13} />
              </IconButton>
            </Box>
          )}
        </Box>

        {/* Annotations sidebar (desktop) */}
        {showAnnotations && (
          <Box sx={{ width: 300, flexShrink: 0, borderLeft: `1px solid ${t.border}`, bgcolor: t.sidebarBg, display: { xs: 'none', lg: 'flex' }, flexDirection: 'column', overflow: 'hidden' }}>
            <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.04em', opacity: 0.7 }}>
                {tl('reader_ui.annotations')}
              </Typography>
              <IconButton size="small" onClick={() => setShowAnnotations(false)} sx={{ color: t.subtleText }}><X size={16} /></IconButton>
            </Box>
            <Box sx={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
              {/* Marque-pages */}
              {bookmarks.length > 0 && (
                <Box sx={{ px: 1.5, py: 1 }}>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.5, mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Bookmark size={12} /> {tl('reader_ui.bookmarksCount', { n: bookmarks.length })}
                  </Typography>
                  {bookmarks.map(bm => (
                    <Box key={bm.id} sx={{ py: 0.8, px: 1, my: 0.3, borderRadius: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', '&:hover': { bgcolor: t.hoverBg } }}>
                      <Box onClick={() => goToPage(bm.position?.page)} sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: t.text }}>{bm.label || `Page ${bm.position?.page}`}</Typography>
                        <Typography sx={{ fontSize: '0.68rem', color: t.subtleText }}>
                          {new Date(bm.created_at).toLocaleDateString()}
                        </Typography>
                      </Box>
                      <IconButton size="small" onClick={() => deleteBookmark(bm)} sx={{ color: t.subtleText, opacity: 0.6, '&:hover': { opacity: 1, color: '#e53935' } }}>
                        <Trash2 size={14} />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              )}

              {/* Surlignages */}
              {highlights.length > 0 && (
                <Box sx={{ px: 1.5, py: 1 }}>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.5, mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Highlighter size={12} /> {tl('reader_ui.highlightsCount', { n: highlights.length })}
                  </Typography>
                  {highlights.map(hl => (
                    <Box key={hl.id} sx={{ py: 0.8, px: 1, my: 0.3, borderRadius: 1, cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 1, borderLeft: `3px solid ${HIGHLIGHT_COLORS[hl.color || 'yellow']?.hex || HIGHLIGHT_COLORS.yellow.hex}`, '&:hover': { bgcolor: t.hoverBg } }}>
                      <Box onClick={() => goToPage(hl.position?.page)} sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.8rem', lineHeight: 1.35, fontStyle: 'italic', color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                          "{hl.text}"
                        </Typography>
                        <Typography sx={{ fontSize: '0.68rem', color: t.subtleText, mt: 0.3 }}>
                          {tl('reader_ui.pageN', { n: hl.position?.page })} · {new Date(hl.created_at).toLocaleDateString()}
                        </Typography>
                      </Box>
                      <IconButton size="small" onClick={() => deleteHighlight(hl)} sx={{ color: t.subtleText, opacity: 0.6, flexShrink: 0, '&:hover': { opacity: 1, color: '#e53935' } }}>
                        <Trash2 size={14} />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              )}

              {highlights.length === 0 && bookmarks.length === 0 && (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '0.82rem', color: t.subtleText, mb: 1 }}>{tl('reader_ui.noAnnotations')}</Typography>
                  <Typography sx={{ fontSize: '0.72rem', color: t.subtleText, opacity: 0.6 }}>{tl('reader_ui.noAnnotationsHint')}</Typography>
                </Box>
              )}
            </Box>
          </Box>
        )}
      </Box>

      {/* ── Barre navigation bas ──────────────────────────────────────────── */}
      <Box sx={{
        borderTop: `1px solid ${t.border}`,
        bgcolor: t.footerBg,
        px: 2, display: 'flex', alignItems: 'center', gap: 2, height: 44,
        visibility: { xs: mobileChromeVisible ? 'visible' : 'hidden', md: 'visible' },
        opacity: { xs: mobileChromeVisible ? 1 : 0, md: 1 },
        transition: 'opacity 0.18s ease',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <TextField size="small" value={pageInput}
            onChange={e => setPageInput(e.target.value)}
            onBlur={handlePageInputBlur}
            onKeyDown={handlePageInputKey}
            sx={{ width: 48, '& .MuiOutlinedInput-root': { fontSize: '0.78rem', fontWeight: 700, color: t.text, '& fieldset': { borderColor: t.border } }, '& input': { textAlign: 'center', p: '3px 4px' } }}
          />
          <Typography sx={{ fontSize: '0.75rem', color: t.subtleText }}>/ {totalPages}</Typography>
        </Box>
        <Slider value={currentPage} min={1} max={totalPages || 1} onChange={(_, v) => goToPage(v)}
          sx={{ flex: 1, color: primary, '& .MuiSlider-thumb': { width: 13, height: 13 }, '& .MuiSlider-track': { height: 3 }, '& .MuiSlider-rail': { height: 3, opacity: 0.25 } }}
        />
        <Typography sx={{ fontSize: '0.72rem', color: t.subtleText, minWidth: 32, textAlign: 'right' }}>{progress}%</Typography>
      </Box>

      {/* ── TOC Drawer mobile ─────────────────────────────────────────────── */}
      <Drawer anchor="left" open={showToc} onClose={() => setShowToc(false)}
        PaperProps={{ sx: { bgcolor: t.sidebarBg, width: 280, pt: 1, display: { lg: 'none' } } }}>
        <Box sx={{ px: 1.5, py: 1, borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: t.text }}>{tl('reader_ui.toc')}</Typography>
          <IconButton size="small" onClick={() => setShowToc(false)} sx={{ color: t.subtleText }}><X size={14} /></IconButton>
        </Box>
        <List dense sx={{ overflowY: 'auto' }}>
          {displayToc.map((item, i) => (
            <ListItemButton key={i} onClick={() => handleTocItem(item)} sx={{ py: 0.75, px: 2, '&:hover': { bgcolor: t.hoverBg } }}>
              <ListItemText primary={item.title} primaryTypographyProps={{ fontSize: '0.85rem', color: t.text, noWrap: true }} />
            </ListItemButton>
          ))}
          {displayToc.length === 0 && (
            <Typography sx={{ px: 2, py: 2, fontSize: '0.78rem', color: t.subtleText }}>{tl('reader_ui.noToc')}</Typography>
          )}
        </List>
      </Drawer>

      {/* ── Recherche Drawer mobile ───────────────────────────────────────── */}
      <Drawer anchor="left" open={showSearch} onClose={() => setShowSearch(false)}
        PaperProps={{ sx: { bgcolor: t.sidebarBg, width: 300, pt: 1, display: { lg: 'none' } } }}>
        <Box sx={{ px: 1.5, py: 1, borderBottom: `1px solid ${t.border}` }}>
          <TextField size="small" fullWidth autoFocus
            placeholder={tl('reader_ui.searchInDocument')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.82rem', color: t.text, '& fieldset': { borderColor: t.border } } }}
          />
          <Box component="button" onClick={handleSearch} disabled={searchLoading}
            sx={{ mt: 1, width: '100%', py: 0.8, borderRadius: 1, border: 'none', cursor: 'pointer', bgcolor: primary, color: '#fff', fontSize: '0.82rem', fontWeight: 600, '&:disabled': { opacity: 0.6 } }}>
            {searchLoading ? '…' : tl('reader_ui.search')}
          </Box>
        </Box>
        <List dense sx={{ overflowY: 'auto' }}>
          {searchResults.map((r, i) => (
            <ListItemButton key={i} onClick={() => { goToPage(r.page); setShowSearch(false); }} sx={{ py: 0.75, px: 2, '&:hover': { bgcolor: t.hoverBg } }}>
              <Box>
                <Typography sx={{ fontSize: '0.72rem', color: primary, fontWeight: 700 }}>{tl('reader_ui.pageN', { n: r.page })}</Typography>
                <Typography sx={{ fontSize: '0.75rem', color: t.subtleText }}>…{r.excerpt}…</Typography>
              </Box>
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      {/* ── Annotations Drawer mobile ─────────────────────────────────────── */}
      <Drawer anchor="right" open={showAnnotations} onClose={() => setShowAnnotations(false)}
        PaperProps={{ sx: { bgcolor: t.sidebarBg, width: 300, display: { lg: 'none' } } }}>
        <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.04em', opacity: 0.7 }}>{tl('reader_ui.annotations')}</Typography>
          <IconButton size="small" onClick={() => setShowAnnotations(false)} sx={{ color: t.subtleText }}><X size={16} /></IconButton>
        </Box>
        <Box sx={{ overflowY: 'auto', flex: 1 }}>
          {bookmarks.map(bm => (
            <Box key={bm.id} sx={{ py: 0.8, px: 2, my: 0.3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box onClick={() => { goToPage(bm.position?.page); setShowAnnotations(false); }} sx={{ flex: 1, cursor: 'pointer' }}>
                <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: t.text }}>{bm.label || `Page ${bm.position?.page}`}</Typography>
              </Box>
              <IconButton size="small" onClick={() => deleteBookmark(bm)} sx={{ color: t.subtleText }}><Trash2 size={14} /></IconButton>
            </Box>
          ))}
          {highlights.map(hl => (
            <Box key={hl.id} sx={{ py: 0.8, px: 2, my: 0.3, display: 'flex', alignItems: 'flex-start', gap: 1, borderLeft: `3px solid ${HIGHLIGHT_COLORS[hl.color || 'yellow']?.hex}` }}>
              <Box onClick={() => { goToPage(hl.position?.page); setShowAnnotations(false); }} sx={{ flex: 1, cursor: 'pointer' }}>
                <Typography sx={{ fontSize: '0.8rem', fontStyle: 'italic', color: t.text }}>"{hl.text}"</Typography>
                <Typography sx={{ fontSize: '0.68rem', color: t.subtleText }}>{tl('reader_ui.pageN', { n: hl.position?.page })}</Typography>
              </Box>
              <IconButton size="small" onClick={() => deleteHighlight(hl)} sx={{ color: t.subtleText }}><Trash2 size={14} /></IconButton>
            </Box>
          ))}
          {highlights.length === 0 && bookmarks.length === 0 && (
            <Typography sx={{ p: 3, fontSize: '0.82rem', color: t.subtleText, textAlign: 'center' }}>{tl('reader_ui.noAnnotations')}</Typography>
          )}
        </Box>
      </Drawer>
    </Box>
  );
}
