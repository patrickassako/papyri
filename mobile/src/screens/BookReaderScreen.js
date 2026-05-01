import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, FlatList, ScrollView, StatusBar, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Speech from 'expo-speech';
import { readingService } from '../services/reading.service';
import { useReadingLock } from '../hooks/useReadingLock';
import { getLocalFilePath, getOfflineEntry } from '../services/offline.service';
import { getAccessToken } from '../services/auth.service';
import API_BASE_URL from '../config/api';
import { loadEpub, getChapterHtml, getAllChaptersHtml } from '../services/epubReader.service';
import { useAudioPlayer } from '../hooks/useAudioPlayer';

let WebViewComponent = null;
try {
  WebViewComponent = require('react-native-webview').WebView;
} catch (error) {
  WebViewComponent = null;
}

let PdfComponent = null;
try {
  PdfComponent = require('react-native-pdf').default;
} catch (error) {
  PdfComponent = null;
}

// ── Thèmes du lecteur : 0=clair 1=sépia 2=nuit ───────────────────────────
const THEMES = [
  {
    key: 'light',
    frame:   '#3e3e3e',
    header:  '#2b2b2b',
    footer:  '#2b2b2b',
    sidebar: '#303030',
    page:    '#ffffff',
    text:    '#e2e2e2',
    subtle:  'rgba(226,226,226,0.5)',
    accent:  '#f4a825',
    border:  'rgba(255,255,255,0.09)',
    icon:    '#e2e2e2',
    pageBg:  '#ffffff',
    pageText:'#2a2a2a',
  },
  {
    key: 'sepia',
    frame:   '#4a3d2e',
    header:  '#3a2e20',
    footer:  '#3a2e20',
    sidebar: '#3f3126',
    page:    '#f4ecd8',
    text:    '#d6c4a0',
    subtle:  'rgba(180,160,120,0.5)',
    accent:  '#c8860a',
    border:  'rgba(255,255,255,0.08)',
    icon:    '#d6c4a0',
    pageBg:  '#f4ecd8',
    pageText:'#3b2e1e',
  },
  {
    key: 'dark',
    frame:   '#111111',
    header:  '#0d0d0d',
    footer:  '#0d0d0d',
    sidebar: '#161616',
    page:    '#1c2128',
    text:    '#c8d0d8',
    subtle:  'rgba(200,208,216,0.4)',
    accent:  '#f4a825',
    border:  'rgba(255,255,255,0.07)',
    icon:    '#c8d0d8',
    pageBg:  '#1c2128',
    pageText:'#e7edf2',
  },
];

const THEME_ICONS = ['white-balance-sunny', 'coffee', 'moon-waning-crescent'];

const HIGHLIGHT_COLORS = {
  yellow: 'rgba(255,235,59,0.45)',
  green:  'rgba(76,175,80,0.45)',
  blue:   'rgba(66,165,245,0.45)',
  pink:   'rgba(236,64,122,0.45)',
};

export default function BookReaderScreen({ route, navigation }) {
  const { contentId } = route.params || {};
  const { lockState, reacquire } = useReadingLock(contentId);
  const { dismiss: dismissAudio, contentId: audioContentId } = useAudioPlayer();
  const webRef = useRef(null);
  const progressRef = useRef(0);
  const readingStartRef = useRef(null);
  const cumulativeTimeRef = useRef(0);   // temps cumulé des sessions précédentes (secondes)
  const pdfPageRef = useRef(0);
  const pdfTotalPagesRef = useRef(0);
  const currentChapterIdxRef = useRef(0);
  const doSaveProgress = useRef(null);   // ref stable — évite stale closures

  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState('Chargement…');
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [session, setSession] = useState(null);

  // EPUB state (JSZip-based, one chapter at a time)
  const [epubData, setEpubData] = useState(null); // { zip, spine, basePath, toc }
  const [currentChapterIdx, setCurrentChapterIdx] = useState(0);
  const [chapterHtml, setChapterHtml] = useState('');
  const [chapterLoading, setChapterLoading] = useState(false);

  // PDF state
  const [localFileUrl, setLocalFileUrl] = useState(null);

  const [chapters, setChapters] = useState([]);
  const [progress, setProgress] = useState(0);
  const [viewerReady, setViewerReady] = useState(false);

  // Bookmarks
  const [bookmarks, setBookmarks] = useState([]);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);

  // Highlights
  const [highlights, setHighlights] = useState([]);
  const [pendingSelection, setPendingSelection] = useState(null);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);

  // Panels
  const [showChapters, setShowChapters] = useState(false);
  const [themeIdx, setThemeIdx] = useState(0); // 0=clair 1=sépia 2=nuit
  const [fontSize, setFontSize] = useState(17);
  // Mode lecture : 'chapter' (défaut) | 'scroll' (document entier)
  const [readMode, setReadMode] = useState('chapter');
  const [scrollFileUri, setScrollFileUri] = useState(null);
  const [scrollLoading, setScrollLoading] = useState(false);

  // TTS
  const [ttsSpeaking, setTtsSpeaking] = useState(false);
  const [ttsPaused, setTtsPaused] = useState(false);
  const [ttsRate, setTtsRate] = useState(1.0);
  const [showTtsPanel, setShowTtsPanel] = useState(false);
  const ttsStopRef = useRef(false);
  const ttsChunksRef = useRef([]);
  const ttsIndexRef = useRef(0);

  const isPdf = useMemo(
    () => String(session?.content?.format || '').toLowerCase() === 'pdf',
    [session?.content?.format]
  );

  const isEpub = useMemo(
    () => String(session?.content?.format || '').toLowerCase() === 'epub',
    [session?.content?.format]
  );

  const isHtmlFormat = useMemo(() => {
    const f = String(session?.content?.format || '').toLowerCase();
    return f === 'html' || f === 'htm' || f === 'text' || f === 'txt';
  }, [session?.content?.format]);

  const t = THEMES[themeIdx] || THEMES[0];
  const nightMode = themeIdx === 2; // gardé pour compatibilité WebView message

  // ── Main load effect ─────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    const load = async () => {
      let slowTimer = null;
      try {
        setLoading(true);
        setError(null);
        setEpubData(null);
        setChapterHtml('');
        setCurrentChapterIdx(0);
        setViewerReady(false);
        setLoadingMsg('Connexion au serveur…');
        console.log('[BookReader] START load contentId:', contentId);

        slowTimer = setTimeout(() => setLoadingMsg('Démarrage du serveur, patientez…'), 8000);

        let sessionData, chaptersData = null, bookmarksData = [], highlightsData = [];
        let offlineMode = false;

        try {
          [sessionData, chaptersData, bookmarksData, highlightsData] = await Promise.all([
            readingService.getSession(contentId),
            readingService.getChapters(contentId).catch(() => null),
            readingService.getBookmarks(contentId).catch(() => []),
            readingService.getHighlights(contentId).catch(() => []),
          ]);

          // Detect placeholder URL → use proxy instead
          const streamUrl = sessionData?.stream?.url || '';
          const isPlaceholder = streamUrl.includes('cdn.papyri.com') || streamUrl.includes('placeholder=true');
          if (isPlaceholder && sessionData?.stream) {
            const proxyPath = sessionData.stream.proxy_url || `/api/reading/${contentId}/file`;
            sessionData.stream.url = `${API_BASE_URL}${proxyPath}`;
          }
        } catch (netErr) {
          // Réseau indisponible — essayer le mode hors ligne
          const entry = await getOfflineEntry(contentId);
          if (!entry) throw new Error('Pas de connexion et ce contenu n\'est pas disponible hors ligne.');
          offlineMode = true;
          setLoadingMsg('Mode hors ligne…');
          sessionData = {
            content: { format: entry.format, title: entry.title },
            stream: null,
            progress: null,
          };
        }

        clearTimeout(slowTimer);
        if (!active) return;

        setSession(sessionData);

        const format = String(sessionData?.content?.format || '').toLowerCase();

        if (format === 'epub') {
          // Get EPUB file (prefer offline cache, otherwise download with JWT)
          let epubFileUri = await getLocalFilePath(contentId);
          if (!epubFileUri) {
            setLoadingMsg('Téléchargement du livre…');
            const jwt = await getAccessToken();
            const proxyPath = sessionData?.stream?.proxy_url || `/api/reading/${contentId}/file`;
            const downloadUrl = `${API_BASE_URL}${proxyPath}`;
            const cacheUri = `${FileSystem.cacheDirectory}epub_${contentId}.epub`;
            console.log('[BookReader] Downloading EPUB from', downloadUrl);
            const dlResult = await FileSystem.downloadAsync(downloadUrl, cacheUri, {
              headers: { Authorization: `Bearer ${jwt}` },
            });
            console.log('[BookReader] Download status:', dlResult.status);
            if (dlResult.status !== 200) throw new Error(`Téléchargement échoué (HTTP ${dlResult.status})`);
            epubFileUri = dlResult.uri;
          }
          console.log('[BookReader] EPUB file:', epubFileUri);

          // Parse EPUB in RN JS thread (no WebView involved) using JSZip
          setLoadingMsg('Analyse du livre…');
          const parsed = await loadEpub(epubFileUri);
          console.log('[BookReader] EPUB parsed, spine chapters:', parsed.spine.length);
          if (!active) return;

          // Restore saved chapter — prefer chapter_idx from last_position, fallback to % estimate
          const savedLastPos = sessionData?.progress?.last_position;
          const savedPercent = Number(sessionData?.progress?.progress_percent || 0);
          const savedChapterIdx = savedLastPos?.chapter_idx != null
            ? Number(savedLastPos.chapter_idx)
            : Math.round((savedPercent / 100) * Math.max(1, parsed.spine.length - 1));
          const startIdx = Math.max(0, Math.min(savedChapterIdx, parsed.spine.length - 1));
          // Initialize cumulative reading time from saved session
          cumulativeTimeRef.current = Number(sessionData?.progress?.total_time_seconds || 0);
          readingStartRef.current = Date.now();

          setEpubData(parsed);
          setCurrentChapterIdx(startIdx);

          // TOC from parsed epub (override backend chapters)
          const tocChapters = parsed.toc.map((item, idx) => ({
            id: String(idx),
            title: item.label || `Chapitre ${idx + 1}`,
            href: item.href || '',
          }));
          setChapters(tocChapters);

          const pct = parsed.spine.length > 1
            ? (startIdx / (parsed.spine.length - 1)) * 100
            : 0;
          setProgress(pct);
          progressRef.current = pct;

        } else {
          // PDF or other: use stream URL
          const localPath = await getLocalFilePath(contentId);
          setLocalFileUrl(localPath || sessionData?.stream?.url || null);

          const savedProgress = Number(sessionData?.progress?.progress_percent || 0);
          setProgress(savedProgress);
          progressRef.current = savedProgress;
          cumulativeTimeRef.current = Number(sessionData?.progress?.total_time_seconds || 0);
          readingStartRef.current = Date.now();

          const mapped = Array.isArray(chaptersData?.chapters)
            ? chaptersData.chapters.map((ch, idx) => ({
                id: ch.id || String(idx),
                title: ch.title || ch.label || `Chapitre ${idx + 1}`,
                href: ch.href || '',
              }))
            : [];
          setChapters(mapped);
        }

        setBookmarks(Array.isArray(bookmarksData) ? bookmarksData : []);

        const mappedHighlights = (Array.isArray(highlightsData) ? highlightsData : []).map((h) => ({
          id: h.id,
          cfiRange: h.cfi_range || '',
          color: HIGHLIGHT_COLORS[h.color] || HIGHLIGHT_COLORS.yellow,
          colorKey: h.color || 'yellow',
          text: h.text || '',
        }));
        setHighlights(mappedHighlights);

      } catch (loadError) {
        clearTimeout(slowTimer);
        if (!active) return;
        const msg = loadError?.message === 'REQUEST_TIMEOUT'
          ? 'Le serveur met trop de temps à répondre. Réessayez dans quelques secondes.'
          : loadError?.message || 'Impossible de charger la lecture.';
        setError(msg);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => { active = false; };
  }, [contentId, retryCount]);

  // ── Scroll mode: écrire tout le livre dans un fichier temp puis charger via URI ─
  useEffect(() => {
    if (!epubData || readMode !== 'scroll') return;
    let active = true;
    const load = async () => {
      setScrollLoading(true);
      setScrollFileUri(null);
      try {
        const html = await getAllChaptersHtml(epubData.zip, epubData.basePath, epubData.spine);
        if (!active) return;
        const uri = `${FileSystem.cacheDirectory}scroll_${contentId}.html`;
        await FileSystem.writeAsStringAsync(uri, html, { encoding: FileSystem.EncodingType.UTF8 });
        if (active) setScrollFileUri(uri);
      } catch (e) {
        console.warn('[ScrollMode] error:', e?.message);
      } finally {
        if (active) setScrollLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [epubData, readMode, contentId]);

  // ── Chapter render effect ─────────────────────────────────────────────────
  // Runs whenever epubData or currentChapterIdx changes.
  // Extracts one chapter HTML from the zip (in the RN JS thread).
  useEffect(() => {
    if (!epubData || epubData.spine.length === 0) return;
    let active = true;
    const renderChapter = async () => {
      setChapterLoading(true);
      setViewerReady(false);
      try {
        const spineHref = epubData.spine[currentChapterIdx];
        const html = await getChapterHtml(epubData.zip, epubData.basePath, spineHref);
        if (!active) return;
        setChapterHtml(html);
        setViewerReady(true);

        const pct = epubData.spine.length > 1
          ? (currentChapterIdx / (epubData.spine.length - 1)) * 100
          : 100;
        setProgress(pct);
        progressRef.current = pct;
      } catch (e) {
        if (active) setError('Erreur lecture chapitre: ' + (e?.message || ''));
      } finally {
        if (active) setChapterLoading(false);
      }
    };
    renderChapter();
    return () => { active = false; };
  }, [epubData, currentChapterIdx]);

  // Keep chapter idx ref in sync
  useEffect(() => { currentChapterIdxRef.current = currentChapterIdx; }, [currentChapterIdx]);

  // ── Stable save function (ref pattern — no stale closures) ────────────────
  const getReadingTimeSeconds = useCallback(() => {
    const sessionSec = readingStartRef.current
      ? Math.floor((Date.now() - readingStartRef.current) / 1000)
      : 0;
    return cumulativeTimeRef.current + sessionSec;
  }, []);

  doSaveProgress.current = (force = false) => {
    const pct = progressRef.current;
    if (!force && pct <= 0 && !contentId) return;
    const lastPosition = { progress: Number(pct.toFixed(2)), type: 'ebook' };
    if (currentChapterIdxRef.current > 0 || pct > 0) {
      lastPosition.chapter_idx = currentChapterIdxRef.current;
    }
    if (pdfPageRef.current > 0) {
      lastPosition.pdf_page = pdfPageRef.current;
      lastPosition.total_pages = pdfTotalPagesRef.current;
    }
    readingService.saveProgress(contentId, {
      progressPercent: Number(pct.toFixed(2)),
      lastPosition,
      totalTimeSeconds: getReadingTimeSeconds(),
    }).catch(() => {});
  };

  // Periodic save every 30s
  useEffect(() => {
    if (!contentId) return;
    const timer = setInterval(() => doSaveProgress.current?.(false), 30000);
    return () => {
      clearInterval(timer);
      doSaveProgress.current?.(true);
    };
  }, [contentId]);

  // Debounced save 2s after progress or chapter changes
  useEffect(() => {
    if (!contentId || !session) return;
    const timer = setTimeout(() => doSaveProgress.current?.(false), 2000);
    return () => clearTimeout(timer);
  }, [contentId, session, progress, currentChapterIdx]);

  // Save when app goes to background (fermeture, appel entrant, etc.)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        doSaveProgress.current?.(true);
      }
    });
    return () => sub.remove();
  }, []);

  // ── Sync theme + font to WebView when they change ────────────────────────
  useEffect(() => {
    if (!viewerReady) return;
    sendToWeb({ type: 'setTheme', dark: nightMode, bg: t.pageBg, textColor: t.pageText });
  }, [themeIdx, viewerReady, sendToWeb]);

  useEffect(() => {
    if (!viewerReady) return;
    sendToWeb({ type: 'setFontSize', size: fontSize });
  }, [fontSize, viewerReady, sendToWeb]);

  // ── WebView message handler ───────────────────────────────────────────────
  const onWebMessage = useCallback((event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data || '{}');

      if (message.type === 'textSelected') {
        const { text } = message?.payload || {};
        if (text && text.trim().length > 1) {
          setPendingSelection({ text: text.trim(), cfiRange: '' });
          setShowHighlightPicker(true);
        }
      }

      if (message.type === 'swipeNext') {
        setCurrentChapterIdx((i) => epubData ? Math.min(epubData.spine.length - 1, i + 1) : i);
      }

      if (message.type === 'swipePrev') {
        setCurrentChapterIdx((i) => Math.max(0, i - 1));
      }

      if (message.type === 'error') {
        setError(message?.payload?.message || 'Erreur de rendu.');
      }
    } catch {}
  }, [epubData]);

  const sendToWeb = useCallback((payload) => {
    if (!webRef.current) return;
    webRef.current.postMessage(JSON.stringify(payload));
  }, []);

  // ── Chapter navigation ────────────────────────────────────────────────────
  const goPrevChapter = useCallback(() => {
    setCurrentChapterIdx((i) => Math.max(0, i - 1));
  }, []);

  const goNextChapter = useCallback(() => {
    if (!epubData) return;
    setCurrentChapterIdx((i) => Math.min(epubData.spine.length - 1, i + 1));
  }, [epubData]);

  const goToChapterByHref = useCallback((href) => {
    if (!epubData || !href) return;
    // Find spine index matching this href
    const idx = epubData.spine.findIndex((s) => s === href || s.endsWith('/' + href) || href.endsWith('/' + s));
    if (idx >= 0) {
      setCurrentChapterIdx(idx);
    } else {
      // Fallback: try matching by toc entry index
      const tocIdx = epubData.toc.findIndex((t) => t.href === href || t.href.startsWith(href) || href.startsWith(t.href));
      if (tocIdx >= 0 && tocIdx < epubData.spine.length) setCurrentChapterIdx(tocIdx);
    }
  }, [epubData]);

  // ── TTS ───────────────────────────────────────────────────────────────────
  // Extract plain text from the current chapter HTML
  const extractChapterText = useCallback(() => {
    if (!chapterHtml) return '';
    // Strip all HTML tags, decode common entities
    return chapterHtml
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }, [chapterHtml]);

  // Split text into chunks ≤ 900 chars at sentence boundaries (same logic as web)
  const splitTextForTts = (text) => {
    const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
    if (!cleaned) return [];
    const maxLen = 900;
    const parts = (cleaned.match(/[^.!?;:]+[.!?;:]?|[^.!?;:]+$/g) || [])
      .map((s) => s.trim())
      .filter(Boolean);
    const chunks = [];
    let current = '';
    parts.forEach((part) => {
      if (!current) { current = part; return; }
      if (current.length + 1 + part.length <= maxLen) {
        current += ` ${part}`;
      } else {
        chunks.push(current);
        current = part;
      }
    });
    if (current) chunks.push(current);
    return chunks;
  };

  const stopTts = useCallback(async () => {
    ttsStopRef.current = true;
    await Speech.stop();
    ttsChunksRef.current = [];
    ttsIndexRef.current = 0;
    setTtsSpeaking(false);
    setTtsPaused(false);
  }, []);

  const speakChunk = useCallback((index, chunks, rate) => {
    if (ttsStopRef.current) return;
    const text = chunks[index];
    if (!text) {
      setTtsSpeaking(false);
      setTtsPaused(false);
      return;
    }
    ttsIndexRef.current = index;
    Speech.speak(text, {
      language: 'fr-FR',
      rate: rate,
      pitch: 1.0,
      onDone: () => {
        if (ttsStopRef.current) return;
        const next = index + 1;
        if (next < chunks.length) {
          speakChunk(next, chunks, rate);
        } else {
          setTtsSpeaking(false);
          setTtsPaused(false);
        }
      },
      onError: () => {
        if (ttsStopRef.current) return;
        const next = index + 1;
        if (next < chunks.length) speakChunk(next, chunks, rate);
        else { setTtsSpeaking(false); setTtsPaused(false); }
      },
      onStopped: () => {
        if (!ttsStopRef.current) { setTtsPaused(true); setTtsSpeaking(false); }
      },
    });
  }, []);

  const startTts = useCallback(async () => {
    ttsStopRef.current = false;
    await Speech.stop();
    const text = extractChapterText();
    if (!text) return;
    const chunks = splitTextForTts(text);
    ttsChunksRef.current = chunks;
    ttsIndexRef.current = 0;
    setTtsSpeaking(true);
    setTtsPaused(false);
    speakChunk(0, chunks, ttsRate);
  }, [extractChapterText, speakChunk, ttsRate]);

  const pauseResumeTts = useCallback(async () => {
    if (!ttsSpeaking && !ttsPaused) {
      await startTts();
      return;
    }
    if (ttsPaused) {
      // expo-speech has no native resume — restart from current chunk
      ttsStopRef.current = false;
      const chunks = ttsChunksRef.current;
      const idx = ttsIndexRef.current;
      setTtsSpeaking(true);
      setTtsPaused(false);
      speakChunk(idx, chunks, ttsRate);
    } else {
      // Pause = stop + remember position
      await Speech.stop();
      setTtsPaused(true);
      setTtsSpeaking(false);
    }
  }, [ttsSpeaking, ttsPaused, startTts, speakChunk, ttsRate]);

  // Stop TTS when chapter changes
  useEffect(() => {
    stopTts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChapterIdx]);

  // Stop TTS on unmount
  useEffect(() => () => { Speech.stop().catch(() => {}); }, []);

  // Fermer le mini player audio quand on ouvre un livre texte
  useEffect(() => {
    if (audioContentId) {
      dismissAudio();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Highlights ────────────────────────────────────────────────────────────
  const handleAddHighlight = useCallback(async (colorKey) => {
    if (!pendingSelection || !contentId) return;
    setShowHighlightPicker(false);
    sendToWeb({ type: 'clearSelection' });
    const { text, cfiRange } = pendingSelection;
    setPendingSelection(null);

    const colorFill = HIGHLIGHT_COLORS[colorKey] || HIGHLIGHT_COLORS.yellow;

    try {
      const created = await readingService.addHighlight(contentId, {
        text: text.slice(0, 500),
        cfiRange: cfiRange || '',
        position: { chapterIdx: currentChapterIdx },
        color: colorKey,
      });
      setHighlights((prev) => [...prev, { id: created.id, cfiRange: cfiRange || '', color: colorFill, colorKey, text }]);
    } catch (err) {
      console.warn('addHighlight failed:', err?.message);
    }
  }, [pendingSelection, contentId, currentChapterIdx, sendToWeb]);

  const handleDeleteHighlight = useCallback(async (hl) => {
    const prev = highlights;
    setHighlights((h) => h.filter((x) => x.id !== hl.id));
    try {
      await readingService.deleteHighlight(contentId, hl.id);
    } catch (err) {
      console.warn('deleteHighlight failed:', err?.message);
      setHighlights(prev);
    }
  }, [highlights, contentId]);

  // ── Bookmarks ─────────────────────────────────────────────────────────────
  const handleAddBookmark = useCallback(async () => {
    if (!contentId || bookmarkLoading) return;
    setBookmarkLoading(true);
    try {
      const created = await readingService.addBookmark(
        contentId,
        { chapterIdx: currentChapterIdx, percent: Math.round(progress) },
        `${Math.round(progress)}%`
      );
      setBookmarks((prev) => [created, ...prev]);
    } catch (err) {
      console.warn('addBookmark failed:', err?.message);
    } finally {
      setBookmarkLoading(false);
    }
  }, [contentId, bookmarkLoading, currentChapterIdx, progress]);

  const handleDeleteBookmark = useCallback(async (bm) => {
    const prev = bookmarks;
    setBookmarks((b) => b.filter((x) => x.id !== bm.id));
    try {
      await readingService.deleteBookmark(contentId, bm.id);
    } catch (err) {
      console.warn('deleteBookmark failed:', err?.message);
      setBookmarks(prev);
    }
  }, [bookmarks, contentId]);

  // ── Render guards ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.loadingWrap} edges={['top', 'bottom']}>
        <ActivityIndicator size="large" color="#f4a825" />
        <Text style={[styles.errorText, { marginTop: 16, fontSize: 13 }]}>{loadingMsg}</Text>
      </SafeAreaView>
    );
  }

  const hasPdfSource = isPdf && !!(localFileUrl || session?.stream?.url);
  if (error || (!epubData && !localFileUrl && !hasPdfSource && !isHtmlFormat)) {
    return (
      <SafeAreaView style={styles.loadingWrap} edges={['top', 'bottom']}>
        <MaterialCommunityIcons name="book-alert-outline" size={48} color="#f4a825" />
        <Text style={[styles.errorText, { marginTop: 12 }]}>{error || 'Fichier indisponible.'}</Text>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: '#B5651D', marginBottom: 10 }]}
          onPress={() => {
            setError(null);
            setSession(null);
            setEpubData(null);
            setChapterHtml('');
            setLocalFileUrl(null);
            setViewerReady(false);
            setLoadingMsg('Connexion au serveur…');
            setRetryCount((c) => c + 1);
          }}
        >
          <Text style={styles.backBtnText}>Réessayer</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (lockState === 'displaced') {
    return (
      <SafeAreaView style={styles.loadingWrap} edges={['top', 'bottom']}>
        <MaterialCommunityIcons name="cellphone-arrow-down" size={48} color="#f4a825" />
        <Text style={[styles.errorText, { marginTop: 12, textAlign: 'center' }]}>
          Un autre appareil a repris la lecture.
        </Text>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: '#B5651D', marginBottom: 10 }]}
          onPress={reacquire}
        >
          <Text style={styles.backBtnText}>Reprendre ici</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (lockState === 'device_limit') {
    return (
      <SafeAreaView style={styles.loadingWrap} edges={['top', 'bottom']}>
        <MaterialCommunityIcons name="lock-outline" size={48} color="#f4a825" />
        <Text style={[styles.errorText, { marginTop: 12, textAlign: 'center' }]}>
          Limite de 3 appareils atteinte.{'\n'}Supprimez un appareil depuis votre profil.
        </Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.frame }]} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={t.header} />
      <View style={[styles.header, { backgroundColor: t.header, borderBottomColor: t.border }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={t.icon} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: t.text }]} numberOfLines={1}>
          {session?.content?.title || 'Lecture'}
        </Text>
        <View style={styles.headerActions}>
          {isEpub && (
            <>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setThemeIdx(i => (i + 1) % 3)}>
                <MaterialCommunityIcons
                  name={THEME_ICONS[themeIdx]}
                  size={20}
                  color={t.icon}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={ttsSpeaking || ttsPaused ? pauseResumeTts : () => setShowTtsPanel(true)}
              >
                <MaterialCommunityIcons
                  name={ttsSpeaking ? 'pause-circle' : ttsPaused ? 'play-circle' : 'text-to-speech'}
                  size={22}
                  color={ttsSpeaking || ttsPaused ? t.accent : t.icon}
                />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setShowBookmarks(true)}>
                <MaterialCommunityIcons
                  name={bookmarks.length > 0 ? 'bookmark' : 'bookmark-outline'}
                  size={20}
                  color={t.icon}
                />
              </TouchableOpacity>
            </>
          )}
          {isEpub && (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => setReadMode(m => m === 'chapter' ? 'scroll' : 'chapter')}
            >
              <MaterialCommunityIcons
                name={readMode === 'scroll' ? 'book-open-page-variant' : 'view-sequential'}
                size={20}
                color={readMode === 'scroll' ? t.accent : t.icon}
              />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowChapters(true)}>
            <MaterialCommunityIcons name="format-list-bulleted" size={22} color={t.icon} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Page de lecture */}
      <View style={[styles.pageWrapper, { backgroundColor: t.frame }]}>
        <View style={[styles.pageCard, { backgroundColor: t.pageBg }]}>
          {isPdf && !!PdfComponent && !!(localFileUrl || session?.stream?.url) && (
            <PdfComponent
              source={{ uri: localFileUrl || session?.stream?.url }}
              style={[styles.pdf, { backgroundColor: t.pageBg }]}
              trustAllCerts={false}
              enablePaging={false}
              horizontal={false}
              fitPolicy={0}
              onError={(err) => setError('Erreur de chargement PDF : ' + (err?.message || String(err)))}
              onLoadProgress={(percent) => {
                if (progressRef.current === 0) {
                  setProgress(percent * 100);
                  progressRef.current = percent * 100;
                }
              }}
              onPageChanged={(page, total) => {
                const pct = total > 1 ? ((page - 1) / (total - 1)) * 100 : 100;
                setProgress(pct);
                progressRef.current = pct;
                pdfPageRef.current = page;
                pdfTotalPagesRef.current = total;
              }}
            />
          )}

          {isPdf && !PdfComponent && (
            <View style={styles.unsupportedWrap}>
              <MaterialCommunityIcons name="file-pdf-box" size={40} color={t.subtle} />
              <Text style={[styles.unsupportedText, { color: t.subtle, marginTop: 12 }]}>
                Lecteur PDF non disponible dans ce build.
              </Text>
            </View>
          )}

          {isHtmlFormat && !!WebViewComponent && !!(localFileUrl || session?.stream?.url) && (
            <WebViewComponent
              source={{ uri: localFileUrl || session?.stream?.url }}
              style={[styles.webview, { backgroundColor: t.pageBg }]}
              javaScriptEnabled={true}
              onError={() => setError('Erreur de chargement du contenu.')}
            />
          )}

          {isEpub && !!WebViewComponent && readMode === 'chapter' && (
            <WebViewComponent
              ref={webRef}
              originWhitelist={['*']}
              source={{ html: chapterHtml }}
              style={styles.webview}
              onMessage={onWebMessage}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              onError={(e) => setError('Erreur WebView: ' + (e?.nativeEvent?.description || 'inconnue'))}
              onLoadEnd={() => {
                sendToWeb({ type: 'setTheme', dark: nightMode, bg: t.pageBg, textColor: t.pageText });
                if (fontSize !== 17) sendToWeb({ type: 'setFontSize', size: fontSize });
              }}
            />
          )}

          {isEpub && readMode === 'scroll' && (
            scrollLoading || !scrollFileUri ? (
              <View style={styles.viewerOverlay}>
                <ActivityIndicator size="large" color="#f4a825" />
                <Text style={[styles.viewerOverlayText, { color: t.subtle }]}>Préparation du document…</Text>
              </View>
            ) : !!WebViewComponent && (
              <WebViewComponent
                ref={webRef}
                originWhitelist={['*', 'file://*']}
                source={{ uri: scrollFileUri }}
                style={styles.webview}
                onMessage={onWebMessage}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                scrollEnabled={true}
                allowFileAccess={true}
                allowUniversalAccessFromFileURLs={true}
                allowFileAccessFromFileURLs={true}
                mixedContentMode="always"
                onScroll={(e) => {
                  const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
                  const scrollable = contentSize.height - layoutMeasurement.height;
                  if (scrollable <= 0) return;
                  const pct = Math.min(100, Math.round((contentOffset.y / scrollable) * 100));
                  setProgress(pct);
                  progressRef.current = pct;
                }}
                scrollEventThrottle={200}
                onError={(e) => setError('Erreur WebView: ' + (e?.nativeEvent?.description || 'inconnue'))}
                onLoadEnd={() => {
                  sendToWeb({ type: 'setTheme', dark: nightMode, bg: t.pageBg, textColor: t.pageText });
                  if (fontSize !== 17) sendToWeb({ type: 'setFontSize', size: fontSize });
                }}
              />
            )
          )}

          {isEpub && readMode === 'chapter' && (!viewerReady || chapterLoading) && !error && (
            <View style={styles.viewerOverlay}>
              <ActivityIndicator size="small" color="#f4a825" />
              <Text style={[styles.viewerOverlayText, { color: t.subtle }]}>
                {chapterLoading ? 'Chapitre en cours…' : 'Chargement…'}
              </Text>
            </View>
          )}

          {!WebViewComponent && (
            <View style={styles.unsupportedWrap}>
              <Text style={[styles.unsupportedText, { color: t.subtle }]}>
                Le module WebView n&apos;est pas présent dans ce build.
              </Text>
            </View>
          )}

          {!!WebViewComponent && !isPdf && !isEpub && !isHtmlFormat && (
            <View style={styles.unsupportedWrap}>
              <MaterialCommunityIcons name="file-alert-outline" size={40} color={t.subtle} />
              <Text style={[styles.unsupportedText, { color: t.subtle, marginTop: 12 }]}>
                Format non pris en charge : {session?.content?.format || 'inconnu'}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={[styles.footer, { backgroundColor: t.footer, borderTopColor: t.border }]}>
        {/* Font size controls */}
        {isEpub && (
          <TouchableOpacity
            style={styles.footerBtn}
            onPress={() => setFontSize(s => Math.max(13, s - 1))}
          >
            <Text style={[styles.fontSizeBtn, { color: t.text }]}>A-</Text>
          </TouchableOpacity>
        )}
        {readMode === 'chapter' && (
          <TouchableOpacity
            style={[styles.footerBtn, currentChapterIdx === 0 && styles.footerBtnDisabled]}
            onPress={goPrevChapter}
            disabled={currentChapterIdx === 0}
          >
            <MaterialCommunityIcons name="chevron-left" size={26} color={currentChapterIdx === 0 ? t.subtle : t.accent} />
          </TouchableOpacity>
        )}
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={[styles.progressText, { color: t.accent }]}>{progress.toFixed(0)}%</Text>
          {isEpub && epubData && readMode === 'chapter' && (
            <Text style={[styles.chapterCounter, { color: t.subtle }]}>
              Ch. {currentChapterIdx + 1} / {epubData.spine.length}
            </Text>
          )}
          {isEpub && epubData && readMode === 'scroll' && (
            <Text style={[styles.chapterCounter, { color: t.subtle }]}>
              p. ~{Math.round((progress / 100) * epubData.spine.length * 8)} / ~{epubData.spine.length * 8}
            </Text>
          )}
        </View>
        {readMode === 'chapter' && (
          <TouchableOpacity
            style={[styles.footerBtn, epubData && currentChapterIdx === epubData.spine.length - 1 && styles.footerBtnDisabled]}
            onPress={goNextChapter}
            disabled={epubData && currentChapterIdx === epubData.spine.length - 1}
          >
            <MaterialCommunityIcons
              name="chevron-right"
              size={26}
              color={epubData && currentChapterIdx === epubData.spine.length - 1 ? t.subtle : t.accent}
            />
          </TouchableOpacity>
        )}
        {isEpub && (
          <TouchableOpacity
            style={styles.footerBtn}
            onPress={() => setFontSize(s => Math.min(26, s + 1))}
          >
            <Text style={[styles.fontSizeBtn, { color: t.text, fontSize: 17 }]}>A+</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Chapters modal */}
      <Modal visible={showChapters} transparent animationType="slide" onRequestClose={() => setShowChapters(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowChapters(false)} />
          <View style={[styles.modalSheet, { backgroundColor: t.sidebar }]}>
            <View style={[styles.modalHeader, { borderBottomColor: t.border }]}>
              <Text style={[styles.modalTitle, { color: t.text }]}>Chapitres</Text>
              <TouchableOpacity onPress={() => setShowChapters(false)}>
                <MaterialCommunityIcons name="close" size={22} color={t.subtle} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={chapters}
              keyExtractor={(item, index) => item.id || String(index)}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  style={[styles.chapterItem, { backgroundColor: 'transparent' },
                    index === currentChapterIdx && { backgroundColor: 'rgba(244,168,37,0.15)', borderLeftWidth: 3, borderLeftColor: t.accent }
                  ]}
                  onPress={() => {
                    setShowChapters(false);
                    if (isEpub && item.href) goToChapterByHref(item.href);
                  }}
                >
                  <Text style={[styles.chapterTitle, { color: t.text },
                    index === currentChapterIdx && { color: t.accent }
                  ]}>
                    {item.title}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={[styles.emptyText, { color: t.subtle }]}>Aucun chapitre disponible.</Text>}
            />
          </View>
        </View>
      </Modal>

      {/* Bookmarks modal */}
      <Modal visible={showBookmarks} transparent animationType="slide" onRequestClose={() => setShowBookmarks(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowBookmarks(false)} />
          <View style={[styles.modalSheet, { backgroundColor: t.sidebar }]}>
            <View style={[styles.modalHeader, { borderBottomColor: t.border }]}>
              <Text style={[styles.modalTitle, { color: t.text }]}>Marque-pages</Text>
              <TouchableOpacity onPress={() => setShowBookmarks(false)}>
                <MaterialCommunityIcons name="close" size={22} color={t.subtle} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.addBookmarkBtn, { borderColor: t.accent, backgroundColor: 'rgba(244,168,37,0.1)' }]}
              disabled={bookmarkLoading}
              onPress={handleAddBookmark}
            >
              <MaterialCommunityIcons name="bookmark-plus-outline" size={18} color={t.accent} />
              <Text style={[styles.addBookmarkText, { color: t.accent }]}>
                {bookmarkLoading ? 'Ajout...' : `Marquer ici (${Math.round(progress)}%)`}
              </Text>
            </TouchableOpacity>

            <ScrollView showsVerticalScrollIndicator={false}>
              {bookmarks.length === 0 ? (
                <Text style={[styles.emptyText, { color: t.subtle }]}>Aucun marque-page pour ce livre.</Text>
              ) : (
                bookmarks.map((bm) => (
                  <View key={bm.id} style={[styles.bookmarkRow, { borderBottomColor: t.border }]}>
                    <TouchableOpacity
                      style={{ flex: 1 }}
                      onPress={() => {
                        setShowBookmarks(false);
                        const chIdx = bm.position?.chapterIdx;
                        if (typeof chIdx === 'number') setCurrentChapterIdx(chIdx);
                      }}
                    >
                      <Text style={[styles.chapterTitle, { color: t.text }]} numberOfLines={1}>
                        {bm.label || `Position ${bm.position?.percent || 0}%`}
                      </Text>
                      <Text style={[styles.emptyText, { color: t.subtle }]}>{bm.position?.percent || 0}%</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => handleDeleteBookmark(bm)}>
                      <MaterialCommunityIcons name="trash-can-outline" size={18} color={t.subtle} />
                    </TouchableOpacity>
                  </View>
                ))
              )}
              {highlights.length > 0 && (
                <>
                  <Text style={[styles.modalTitle, { fontSize: 16, marginTop: 16, marginBottom: 8, color: t.text }]}>
                    Surlignages ({highlights.length})
                  </Text>
                  {highlights.map((hl) => (
                    <View key={hl.id} style={[styles.bookmarkRow, { borderLeftWidth: 3, borderLeftColor: hl.color, paddingLeft: 10, borderBottomColor: t.border }]}>
                      <Text style={[styles.chapterTitle, { flex: 1, fontSize: 13, color: t.text }]} numberOfLines={2}>
                        {hl.text}
                      </Text>
                      <TouchableOpacity style={styles.iconBtn} onPress={() => handleDeleteHighlight(hl)}>
                        <MaterialCommunityIcons name="trash-can-outline" size={16} color={t.subtle} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* TTS active bar — visible quand lecture en cours */}
      {isEpub && (ttsSpeaking || ttsPaused) && (
        <View style={[styles.ttsBar, { backgroundColor: t.header, borderTopColor: t.border }]}>
          <MaterialCommunityIcons name="text-to-speech" size={16} color={t.accent} style={{ marginRight: 6 }} />
          <Text style={[styles.ttsBarText, { color: t.accent }]} numberOfLines={1}>
            {ttsPaused ? 'Lecture en pause' : 'Lecture vocale en cours…'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <TouchableOpacity style={styles.iconBtn} onPress={pauseResumeTts}>
              <MaterialCommunityIcons name={ttsSpeaking ? 'pause' : 'play'} size={20} color={t.accent} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={stopTts}>
              <MaterialCommunityIcons name="stop" size={20} color={t.subtle} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* TTS panel */}
      <Modal visible={showTtsPanel} transparent animationType="slide" onRequestClose={() => setShowTtsPanel(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowTtsPanel(false)} />
          <View style={[styles.modalSheet, { backgroundColor: t.sidebar }]}>
            <View style={[styles.modalHeader, { borderBottomColor: t.border }]}>
              <Text style={[styles.modalTitle, { color: t.text }]}>Lecture vocale</Text>
              <TouchableOpacity onPress={() => setShowTtsPanel(false)}>
                <MaterialCommunityIcons name="close" size={22} color={t.subtle} />
              </TouchableOpacity>
            </View>

            {/* Vitesse */}
            <Text style={[styles.ttsLabel, { color: t.subtle }]}>
              Vitesse : x{ttsRate.toFixed(1)}
            </Text>
            <View style={styles.ttsRateRow}>
              {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.ttsRateBtn, { borderColor: t.border },
                    Math.abs(ttsRate - r) < 0.01 && { backgroundColor: t.accent, borderColor: t.accent }
                  ]}
                  onPress={() => setTtsRate(r)}
                >
                  <Text style={[styles.ttsRateBtnText, { color: t.text },
                    Math.abs(ttsRate - r) < 0.01 && { color: '#111' }
                  ]}>
                    x{r % 1 === 0 ? r.toFixed(0) : r}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Boutons play/stop */}
            <View style={styles.ttsControls}>
              <TouchableOpacity
                style={[styles.ttsPlayBtn, { backgroundColor: t.accent }]}
                onPress={() => { setShowTtsPanel(false); startTts(); }}
              >
                <MaterialCommunityIcons name="play" size={22} color="#111" />
                <Text style={styles.ttsPlayBtnText}>Lire ce chapitre</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Highlight color picker */}
      <Modal
        visible={showHighlightPicker}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowHighlightPicker(false); setPendingSelection(null); }}
      >
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>Surligner en</Text>
            <View style={styles.colorRow}>
              {Object.entries(HIGHLIGHT_COLORS).map(([key, fill]) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.colorCircle, { backgroundColor: fill }]}
                  onPress={() => handleAddHighlight(key)}
                />
              ))}
            </View>
            <TouchableOpacity
              onPress={() => { setShowHighlightPicker(false); setPendingSelection(null); }}
              style={styles.pickerCancel}
            >
              <Text style={styles.pickerCancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#2b2b2b' },
  errorText: { color: '#e2e2e2', marginBottom: 12, paddingHorizontal: 18, textAlign: 'center' },
  backBtn: { backgroundColor: '#f4a825', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 8 },
  backBtnText: { color: '#111', fontWeight: '700' },
  header: {
    height: 52,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', marginHorizontal: 8 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },

  // Page wrapper: frame sombre + carte blanche centrée (comme le web)
  pageWrapper: { flex: 1, paddingHorizontal: 4, paddingVertical: 4 },
  pageCard: {
    flex: 1,
    borderRadius: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 12,
  },
  webview: { flex: 1 },
  pdf: { flex: 1, width: '100%' },
  viewerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(30,30,30,0.7)',
  },
  viewerOverlayText: { marginTop: 8, fontWeight: '600', fontSize: 13 },
  unsupportedWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  unsupportedText: { textAlign: 'center' },

  footer: {
    height: 52,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  footerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  footerBtnDisabled: { opacity: 0.3 },
  progressText: { fontWeight: '700', fontSize: 14 },
  chapterCounter: { fontSize: 11, marginTop: 1 },
  fontSizeBtn: { fontWeight: '700', fontSize: 14 },

  bookmarkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  addBookmarkBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 12 },
  addBookmarkText: { fontWeight: '700', marginLeft: 8, fontSize: 14 },

  pickerOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
  pickerSheet: { backgroundColor: '#2b2b2b', borderRadius: 18, padding: 24, alignItems: 'center', width: 260 },
  pickerTitle: { fontSize: 16, fontWeight: '700', color: '#e2e2e2', marginBottom: 16 },
  colorRow: { flexDirection: 'row', gap: 14, marginBottom: 20 },
  colorCircle: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  pickerCancel: { paddingVertical: 8, paddingHorizontal: 20 },
  pickerCancelText: { color: '#aaa', fontWeight: '600', fontSize: 14 },

  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: {
    maxHeight: '65%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  chapterItem: { paddingVertical: 12, paddingHorizontal: 10, borderRadius: 8, marginBottom: 4 },
  chapterTitle: { fontSize: 14, fontWeight: '600' },
  emptyText: { paddingVertical: 12, textAlign: 'center', fontSize: 13 },

  // TTS
  ttsBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6,
    borderTopWidth: 1,
  },
  ttsBarText: { flex: 1, fontSize: 12, fontWeight: '600' },
  ttsLabel: { fontSize: 13, marginTop: 12, marginBottom: 8 },
  ttsRateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  ttsRateBtn: {
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
  },
  ttsRateBtnText: { fontSize: 13, fontWeight: '600' },
  ttsControls: { gap: 10 },
  ttsPlayBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 12, paddingVertical: 14, gap: 8,
  },
  ttsPlayBtnText: { color: '#111', fontWeight: '700', fontSize: 15 },
});
