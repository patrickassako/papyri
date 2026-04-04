/**
 * PdfReaderPage — Lecteur PDF avancé (pdfjs-dist v5)
 * Fonctionnalités : navigation fluide, zoom, recherche, thèmes, mobile
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box, IconButton, Typography, CircularProgress, Alert, Tooltip,
  Slider, TextField, InputAdornment, Drawer, List, ListItemButton,
  ListItemText, Divider, Menu, MenuItem,
} from '@mui/material';
import {
  ArrowLeft, ChevronLeft, ChevronRight, ZoomIn, ZoomOut,
  Moon, Sun, Maximize, Minimize, Menu as MenuIcon,
  Search, X, RotateCw, Download,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import { readingService } from '../services/reading.service';
import { useReadingLock } from '../hooks/useReadingLock';
import { contentsService } from '../services/contents.service';
import papyriMark from '../assets/papyri-mark.png';
import tokens from '../config/tokens';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// ── Thèmes ───────────────────────────────────────────────────────────────────
const THEMES = {
  light: {
    bg: '#f5f4f1',
    headerBg: 'rgba(245,244,241,0.97)',
    text: '#1a1a2e',
    subText: 'rgba(26,26,46,0.5)',
    pageBg: '#ffffff',
    pageShadow: '0 4px 32px rgba(0,0,0,0.12)',
    icon: '#1a1a2e',
    border: 'rgba(0,0,0,0.08)',
    drawerBg: '#ffffff',
    thumbBg: 'rgba(0,0,0,0.06)',
    thumbActive: tokens.colors.primary,
  },
  dark: {
    bg: '#1a1d23',
    headerBg: 'rgba(26,29,35,0.97)',
    text: '#d8dee6',
    subText: 'rgba(216,222,230,0.45)',
    pageBg: '#2a2d35',
    pageShadow: '0 4px 32px rgba(0,0,0,0.5)',
    icon: '#d8dee6',
    border: 'rgba(255,255,255,0.08)',
    drawerBg: '#21252d',
    thumbBg: 'rgba(255,255,255,0.06)',
    thumbActive: tokens.colors.secondary,
  },
  sepia: {
    bg: '#f4efe6',
    headerBg: 'rgba(244,239,230,0.97)',
    text: '#433422',
    subText: 'rgba(67,52,34,0.5)',
    pageBg: '#fdf6e3',
    pageShadow: '0 4px 32px rgba(100,70,30,0.15)',
    icon: '#433422',
    border: 'rgba(67,52,34,0.1)',
    drawerBg: '#fdf6e3',
    thumbBg: 'rgba(67,52,34,0.06)',
    thumbActive: tokens.colors.primary,
  },
};

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3.0;
const ZOOM_STEP = 0.25;

export default function PdfReaderPage() {
  const { id } = useParams();
  const navigate = useNavigate();

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

  const [theme, setTheme] = useState('light');
  const [fullscreen, setFullscreen] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [toc, setToc] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);

  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);
  const pdfDocRef = useRef(null);
  const containerRef = useRef(null);
  const headerTimerRef = useRef(null);
  const lastTouchX = useRef(null);
  const progressSavedRef = useRef(false);

  const T = THEMES[theme];

  useReadingLock(id);

  // ── Chargement contenu ────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        const [data, access] = await Promise.all([
          contentsService.getContentById(id),
          contentsService.checkAccess(id),
        ]);
        if (!active) return;
        setContent(data);
        setCanRead(access?.canRead || access?.has_access || false);

        // Position sauvegardée
        const pos = await readingService.getLastPosition(id).catch(() => null);
        if (pos?.pdf_page) {
          setCurrentPage(Number(pos.pdf_page));
          setPageInput(String(pos.pdf_page));
        }

        if (!access?.canRead && !access?.has_access) {
          setError('Abonnement requis pour accéder à ce contenu.');
        }
      } catch (e) {
        if (active) setError(e.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [id]);

  // ── Chargement PDF ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!canRead || !content?.file_url) return;
    let active = true;

    async function loadPdf() {
      try {
        const res = await fetch(content.file_url, { credentials: 'include' });
        const arrayBuffer = await res.arrayBuffer();
        if (!active) return;

        const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (!active) return;

        pdfDocRef.current = doc;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);

        // TOC
        try {
          const outline = await doc.getOutline();
          if (outline?.length) setToc(outline);
        } catch (_) {}
      } catch (e) {
        if (active) setError('Impossible de charger le fichier PDF.');
      }
    }

    loadPdf();
    return () => { active = false; };
  }, [canRead, content]);

  // ── Rendu page ────────────────────────────────────────────────────────────
  const renderPage = useCallback(async (pageNum) => {
    const doc = pdfDocRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;

    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }

    setRendering(true);
    try {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: zoom, rotation });
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;

      canvas.width = viewport.width * dpr;
      canvas.height = viewport.height * dpr;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      ctx.scale(dpr, dpr);

      const task = page.render({ canvasContext: ctx, viewport });
      renderTaskRef.current = task;
      await task.promise;
      renderTaskRef.current = null;
    } catch (e) {
      if (e?.name !== 'RenderingCancelledException') {
        console.error('Render error:', e);
      }
    } finally {
      setRendering(false);
    }
  }, [zoom, rotation]);

  useEffect(() => {
    if (pdfDoc) renderPage(currentPage);
  }, [pdfDoc, currentPage, zoom, rotation, renderPage]);

  // ── Sauvegarde progression ────────────────────────────────────────────────
  useEffect(() => {
    if (!canRead || !pdfDoc || currentPage <= 0) return;
    const progress = Math.round((currentPage / totalPages) * 100);
    const timer = setTimeout(() => {
      readingService.saveProgress(id, {
        progress,
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
  }

  function handlePageInput(e) {
    setPageInput(e.target.value);
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
  function zoomIn() { setZoom(z => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2))); }
  function zoomOut() { setZoom(z => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2))); }
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
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentPage, totalPages]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Swipe mobile ──────────────────────────────────────────────────────────
  function handleTouchStart(e) {
    lastTouchX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e) {
    if (lastTouchX.current === null) return;
    const diff = lastTouchX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goToPage(currentPage + 1);
      else goToPage(currentPage - 1);
    }
    lastTouchX.current = null;
  }

  // ── Auto-hide header ──────────────────────────────────────────────────────
  function revealHeader() {
    setHeaderVisible(true);
    clearTimeout(headerTimerRef.current);
    headerTimerRef.current = setTimeout(() => setHeaderVisible(false), 3000);
  }

  useEffect(() => {
    return () => clearTimeout(headerTimerRef.current);
  }, []);

  // ── Plein écran ───────────────────────────────────────────────────────────
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
      setFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setFullscreen(false);
    }
  }

  // ── Recherche dans le PDF ─────────────────────────────────────────────────
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
        const excerpt = text.slice(Math.max(0, idx - 40), idx + query.length + 40);
        results.push({ page: i, excerpt });
      }
    }

    setSearchResults(results);
    setSearchLoading(false);
  }

  // ── Téléchargement ────────────────────────────────────────────────────────
  function handleDownload() {
    if (!content?.file_url) return;
    const a = document.createElement('a');
    a.href = content.file_url;
    a.download = `${content.title || 'document'}.pdf`;
    a.click();
  }

  // ── Rotation ─────────────────────────────────────────────────────────────
  function rotate() { setRotation(r => (r + 90) % 360); }

  // ── Thème ─────────────────────────────────────────────────────────────────
  function cycleTheme() {
    setTheme(t => t === 'light' ? 'sepia' : t === 'sepia' ? 'dark' : 'light');
  }

  const themeIcon = theme === 'dark' ? <Sun size={17} /> : theme === 'sepia' ? <Moon size={17} /> : <Moon size={17} />;

  // ── TOC navigate ─────────────────────────────────────────────────────────
  async function handleTocItem(item) {
    if (!pdfDocRef.current || !item.dest) return;
    try {
      const dest = typeof item.dest === 'string'
        ? await pdfDocRef.current.getDestination(item.dest)
        : item.dest;
      if (dest) {
        const ref = await pdfDocRef.current.getPageIndex(dest[0]);
        goToPage(ref + 1);
        setTocOpen(false);
      }
    } catch (_) {}
  }

  const progress = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;

  // ── Loading / Error ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: T.bg }}>
        <CircularProgress sx={{ color: tokens.colors.primary }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: T.bg, p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        <Box component="button" onClick={() => navigate(-1)} sx={{ color: tokens.colors.primary, cursor: 'pointer', background: 'none', border: 'none', fontSize: '0.9rem' }}>
          ← Retour
        </Box>
      </Box>
    );
  }

  return (
    <Box
      ref={containerRef}
      sx={{ minHeight: '100vh', bgcolor: T.bg, display: 'flex', flexDirection: 'column', position: 'relative', userSelect: 'none' }}
      onMouseMove={revealHeader}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <Box
        sx={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
          bgcolor: T.headerBg,
          backdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${T.border}`,
          px: 2, py: 1,
          display: 'flex', alignItems: 'center', gap: 1,
          transition: 'opacity 0.3s, transform 0.3s',
          opacity: headerVisible ? 1 : 0,
          transform: headerVisible ? 'translateY(0)' : 'translateY(-100%)',
        }}
      >
        {/* Retour */}
        <Tooltip title="Retour">
          <IconButton onClick={() => navigate(-1)} size="small" sx={{ color: T.icon }}>
            <ArrowLeft size={18} />
          </IconButton>
        </Tooltip>

        {/* Logo */}
        <Box component="img" src={papyriMark} alt="Papyri" sx={{ width: 28, height: 28, borderRadius: '7px', mx: 0.5 }} />

        {/* Titre */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography noWrap sx={{ fontSize: '0.82rem', fontWeight: 700, color: T.text, lineHeight: 1.2 }}>
            {content?.title}
          </Typography>
          <Typography noWrap sx={{ fontSize: '0.72rem', color: T.subText }}>
            {content?.author}
          </Typography>
        </Box>

        {/* TOC */}
        <Tooltip title="Table des matières">
          <IconButton onClick={() => setTocOpen(true)} size="small" sx={{ color: T.icon }} disabled={toc.length === 0}>
            <MenuIcon size={17} />
          </IconButton>
        </Tooltip>

        {/* Recherche */}
        <Tooltip title="Rechercher">
          <IconButton onClick={() => setSearchOpen(o => !o)} size="small" sx={{ color: searchOpen ? tokens.colors.primary : T.icon }}>
            <Search size={17} />
          </IconButton>
        </Tooltip>

        {/* Rotation */}
        <Tooltip title="Rotation">
          <IconButton onClick={rotate} size="small" sx={{ color: T.icon }}>
            <RotateCw size={17} />
          </IconButton>
        </Tooltip>

        {/* Zoom out */}
        <Tooltip title="Dézoomer (-)">
          <IconButton onClick={zoomOut} size="small" sx={{ color: T.icon }} disabled={zoom <= ZOOM_MIN}>
            <ZoomOut size={17} />
          </IconButton>
        </Tooltip>

        {/* Zoom label */}
        <Typography
          onClick={resetZoom}
          sx={{ fontSize: '0.75rem', fontWeight: 700, color: T.subText, cursor: 'pointer', minWidth: 38, textAlign: 'center', '&:hover': { color: T.text } }}
        >
          {Math.round(zoom * 100)}%
        </Typography>

        {/* Zoom in */}
        <Tooltip title="Zoomer (+)">
          <IconButton onClick={zoomIn} size="small" sx={{ color: T.icon }} disabled={zoom >= ZOOM_MAX}>
            <ZoomIn size={17} />
          </IconButton>
        </Tooltip>

        {/* Thème */}
        <Tooltip title={`Thème : ${theme}`}>
          <IconButton onClick={cycleTheme} size="small" sx={{ color: T.icon }}>
            {themeIcon}
          </IconButton>
        </Tooltip>

        {/* Plein écran */}
        <Tooltip title={fullscreen ? 'Quitter plein écran' : 'Plein écran'}>
          <IconButton onClick={toggleFullscreen} size="small" sx={{ color: T.icon }}>
            {fullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* ── Barre de recherche ──────────────────────────────────────────── */}
      {searchOpen && (
        <Box
          sx={{
            position: 'fixed', top: 56, left: 0, right: 0, zIndex: 99,
            bgcolor: T.headerBg, borderBottom: `1px solid ${T.border}`,
            px: 2, py: 1.5, display: 'flex', gap: 1, alignItems: 'center',
            backdropFilter: 'blur(12px)',
          }}
        >
          <TextField
            size="small"
            placeholder="Rechercher dans le document…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            autoFocus
            fullWidth
            InputProps={{
              startAdornment: <InputAdornment position="start"><Search size={15} /></InputAdornment>,
              endAdornment: searchQuery && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => { setSearchQuery(''); setSearchResults([]); }}>
                    <X size={14} />
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{ bgcolor: T.pageBg, borderRadius: 1, '& .MuiOutlinedInput-root': { fontSize: '0.85rem' } }}
          />
          <Box
            component="button"
            onClick={handleSearch}
            disabled={searchLoading}
            sx={{
              px: 2, py: 0.8, borderRadius: 1, border: 'none', cursor: 'pointer',
              bgcolor: tokens.colors.primary, color: '#fff', fontSize: '0.82rem', fontWeight: 600,
              '&:disabled': { opacity: 0.6 },
            }}
          >
            {searchLoading ? '…' : 'Chercher'}
          </Box>
        </Box>
      )}

      {/* Résultats recherche */}
      {searchOpen && searchResults.length > 0 && (
        <Box
          sx={{
            position: 'fixed', top: searchOpen ? 108 : 56, left: 0, right: 0, zIndex: 98,
            bgcolor: T.drawerBg, borderBottom: `1px solid ${T.border}`,
            maxHeight: 240, overflowY: 'auto',
          }}
        >
          {searchResults.map((r, i) => (
            <Box
              key={i}
              onClick={() => { goToPage(r.page); }}
              sx={{
                px: 2.5, py: 1, cursor: 'pointer', borderBottom: `1px solid ${T.border}`,
                '&:hover': { bgcolor: T.thumbBg },
              }}
            >
              <Typography sx={{ fontSize: '0.75rem', color: tokens.colors.primary, fontWeight: 700 }}>
                Page {r.page}
              </Typography>
              <Typography sx={{ fontSize: '0.78rem', color: T.subText }}>
                …{r.excerpt}…
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* ── Zone de lecture ──────────────────────────────────────────────── */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pt: '64px',
          pb: '72px',
          px: { xs: 0, sm: 2 },
          overflow: 'auto',
          position: 'relative',
        }}
      >
        {/* Flèche gauche */}
        <IconButton
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage <= 1}
          sx={{
            position: 'fixed', left: { xs: 4, sm: 12 }, top: '50%', transform: 'translateY(-50%)',
            zIndex: 10, bgcolor: T.headerBg, border: `1px solid ${T.border}`,
            color: T.icon, '&:hover': { bgcolor: T.thumbBg },
            '&.Mui-disabled': { opacity: 0.2 },
            boxShadow: 2,
          }}
        >
          <ChevronLeft size={22} />
        </IconButton>

        {/* Canvas PDF */}
        <Box
          sx={{
            position: 'relative',
            boxShadow: T.pageShadow,
            borderRadius: 1,
            overflow: 'hidden',
            bgcolor: T.pageBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {rendering && (
            <Box sx={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
              justifyContent: 'center', bgcolor: T.pageBg, zIndex: 5,
            }}>
              <CircularProgress size={32} sx={{ color: tokens.colors.primary }} />
            </Box>
          )}
          <canvas ref={canvasRef} style={{ display: 'block' }} />
        </Box>

        {/* Flèche droite */}
        <IconButton
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage >= totalPages}
          sx={{
            position: 'fixed', right: { xs: 4, sm: 12 }, top: '50%', transform: 'translateY(-50%)',
            zIndex: 10, bgcolor: T.headerBg, border: `1px solid ${T.border}`,
            color: T.icon, '&:hover': { bgcolor: T.thumbBg },
            '&.Mui-disabled': { opacity: 0.2 },
            boxShadow: 2,
          }}
        >
          <ChevronRight size={22} />
        </IconButton>

        {/* Tap zones mobile */}
        <Box
          onClick={() => goToPage(currentPage - 1)}
          sx={{ display: { xs: 'block', sm: 'none' }, position: 'fixed', left: 0, top: '15%', bottom: '15%', width: '20%', zIndex: 5 }}
        />
        <Box
          onClick={() => goToPage(currentPage + 1)}
          sx={{ display: { xs: 'block', sm: 'none' }, position: 'fixed', right: 0, top: '15%', bottom: '15%', width: '20%', zIndex: 5 }}
        />
      </Box>

      {/* ── Barre de navigation bas ───────────────────────────────────────── */}
      <Box
        sx={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
          bgcolor: T.headerBg, backdropFilter: 'blur(12px)',
          borderTop: `1px solid ${T.border}`,
          px: 2, py: 1,
          display: 'flex', alignItems: 'center', gap: 2,
        }}
      >
        {/* Page input */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <TextField
            size="small"
            value={pageInput}
            onChange={handlePageInput}
            onBlur={handlePageInputBlur}
            onKeyDown={handlePageInputKey}
            sx={{
              width: 52,
              '& .MuiOutlinedInput-root': { fontSize: '0.82rem', fontWeight: 700, textAlign: 'center' },
              '& input': { textAlign: 'center', p: '4px 6px' },
            }}
          />
          <Typography sx={{ fontSize: '0.78rem', color: T.subText }}>/ {totalPages}</Typography>
        </Box>

        {/* Slider de progression */}
        <Slider
          value={currentPage}
          min={1}
          max={totalPages || 1}
          onChange={(_, v) => goToPage(v)}
          sx={{
            flex: 1,
            color: tokens.colors.primary,
            '& .MuiSlider-thumb': { width: 14, height: 14 },
            '& .MuiSlider-track': { height: 3 },
            '& .MuiSlider-rail': { height: 3, opacity: 0.2 },
          }}
        />

        {/* Progression % */}
        <Typography sx={{ fontSize: '0.75rem', color: T.subText, minWidth: 34, textAlign: 'right' }}>
          {progress}%
        </Typography>
      </Box>

      {/* ── TOC Drawer ───────────────────────────────────────────────────── */}
      <Drawer
        anchor="left"
        open={tocOpen}
        onClose={() => setTocOpen(false)}
        PaperProps={{ sx: { bgcolor: T.drawerBg, width: 300, pt: 2 } }}
      >
        <Box sx={{ px: 2, pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: T.text }}>
            Table des matières
          </Typography>
          <IconButton size="small" onClick={() => setTocOpen(false)} sx={{ color: T.subText }}>
            <X size={16} />
          </IconButton>
        </Box>
        <Divider sx={{ borderColor: T.border }} />
        <List dense sx={{ overflowY: 'auto' }}>
          {toc.map((item, i) => (
            <ListItemButton key={i} onClick={() => handleTocItem(item)} sx={{ py: 0.75, px: 2 }}>
              <ListItemText
                primary={item.title}
                primaryTypographyProps={{ fontSize: '0.85rem', color: T.text, noWrap: true }}
              />
            </ListItemButton>
          ))}
          {toc.length === 0 && (
            <Typography sx={{ px: 2, py: 2, fontSize: '0.82rem', color: T.subText }}>
              Aucune table des matières disponible.
            </Typography>
          )}
        </List>
      </Drawer>
    </Box>
  );
}
