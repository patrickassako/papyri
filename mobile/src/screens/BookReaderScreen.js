import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, FlatList, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { readingService } from '../services/reading.service';
import { useReadingLock } from '../hooks/useReadingLock';
import { getLocalFilePath } from '../services/offline.service';

let WebViewComponent = null;
try {
  // Optional at runtime: avoids hard crash if native module isn't in current binary.
  WebViewComponent = require('react-native-webview').WebView;
} catch (error) {
  WebViewComponent = null;
}

function escapeForHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const EPUBJS_CDN_PRIMARY = 'https://cdn.jsdelivr.net/npm/epubjs/dist/epub.min.js';
const EPUBJS_CDN_FALLBACK = 'https://unpkg.com/epubjs/dist/epub.min.js';
const EPUB_LOAD_TIMEOUT_MS = 10000;

const HIGHLIGHT_COLORS = {
  yellow: 'rgba(255,235,59,0.45)',
  green:  'rgba(76,175,80,0.45)',
  blue:   'rgba(66,165,245,0.45)',
  pink:   'rgba(236,64,122,0.45)',
};

function buildEpubHtml({ bookUrl, title }) {
  const safeUrl = escapeForHtml(bookUrl);
  const safeTitle = escapeForHtml(title || 'Lecture EPUB');
  const cdnPrimary = EPUBJS_CDN_PRIMARY;
  const cdnFallback = EPUBJS_CDN_FALLBACK;
  const epubTimeout = EPUB_LOAD_TIMEOUT_MS;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <title>${safeTitle}</title>
    <style>
      html, body { margin: 0; padding: 0; background: #f6f2ea; width: 100%; height: 100%; overflow: hidden; }
      #viewer { width: 100%; height: 100%; }
      #error { display:none; padding:20px; color:#7a1f1f; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
    </style>
  </head>
  <body>
    <div id="viewer"></div>
    <div id="error"></div>
    <script>
      (function() {
        var rn = window.ReactNativeWebView;
        var viewer = document.getElementById('viewer');
        var errorNode = document.getElementById('error');
        var book = null;
        var rendition = null;
        var annotations = {}; // cfiRange -> annotation obj

        function post(type, payload) {
          if (!rn) return;
          rn.postMessage(JSON.stringify({ type: type, payload: payload || {} }));
        }

        function showError(message) {
          viewer.style.display = 'none';
          errorNode.style.display = 'block';
          errorNode.textContent = message;
          post('error', { message: message });
        }

        function applyHighlight(id, cfiRange, color) {
          if (!rendition || !cfiRange) return;
          var fill = color || 'rgba(255,235,59,0.45)';
          try {
            rendition.annotations.highlight(cfiRange, {}, function() {}, 'hl-' + id, { fill: fill, 'fill-opacity': '1' });
            annotations[cfiRange] = { id: id, cfiRange: cfiRange, color: fill };
          } catch(e) {}
        }

        function removeHighlight(cfiRange) {
          if (!rendition || !cfiRange) return;
          try {
            rendition.annotations.remove(cfiRange, 'highlight');
            delete annotations[cfiRange];
          } catch(e) {}
        }

        function startReader() {
          if (typeof window.ePub !== 'function') {
            showError('Moteur EPUB indisponible.');
            return;
          }

          book = ePub("${safeUrl}");
          rendition = book.renderTo("viewer", { width: "100%", height: "100%", spread: "none" });

          rendition.display().then(function() {
            post('ready', {});
          }).catch(function() {
            showError("Impossible d'afficher cet EPUB.");
          });

          book.loaded.navigation.then(function(nav) {
            var toc = (nav && nav.toc ? nav.toc : []).map(function(item, index) {
              return { id: String(index), label: item.label || ('Chapitre ' + (index + 1)), href: item.href || '' };
            });
            post('toc', { items: toc });
          });

          rendition.on('relocated', function(location) {
            var percentage = 0;
            try {
              if (location && location.start && location.start.cfi && book.locations) {
                percentage = book.locations.percentageFromCfi(location.start.cfi) || 0;
              }
            } catch (e) {}
            post('relocated', {
              progress: Math.max(0, Math.min(100, percentage * 100)),
              cfi: location && location.start ? (location.start.cfi || '') : '',
              href: location && location.start ? (location.start.href || '') : ''
            });
          });

          // Text selection → notify RN
          rendition.on('selected', function(cfiRange, contents) {
            try {
              var selection = contents.window.getSelection();
              var text = selection ? selection.toString().trim() : '';
              if (text.length > 0) {
                post('textSelected', { cfiRange: cfiRange, text: text });
              }
            } catch(e) {}
          });

          book.ready.then(function() {
            return book.locations.generate(1200);
          }).catch(function() {});

          window.__reader = {
            next: function() { if (rendition) rendition.next(); },
            prev: function() { if (rendition) rendition.prev(); },
            goToHref: function(href) { if (rendition && href) rendition.display(href); },
            goToCfi: function(cfi) { if (rendition && cfi) rendition.display(cfi); },
            applyHighlight: applyHighlight,
            removeHighlight: removeHighlight,
            applyAllHighlights: function(list) {
              if (!Array.isArray(list)) return;
              list.forEach(function(h) { applyHighlight(h.id, h.cfiRange, h.color); });
            },
          };
        }

        function loadEpubJs() {
          var loaded = false;
          function done() {
            if (loaded) return;
            loaded = true;
            try { startReader(); } catch (e) { showError('Le rendu EPUB a échoué.'); }
          }
          function fail() {
            if (loaded) return;
            var second = document.createElement('script');
            second.src = '${cdnFallback}';
            second.onload = done;
            second.onerror = function() { showError('Impossible de charger le moteur EPUB.'); };
            document.head.appendChild(second);
          }
          var first = document.createElement('script');
          first.src = '${cdnPrimary}';
          first.onload = done;
          first.onerror = fail;
          document.head.appendChild(first);
          setTimeout(function() {
            if (!loaded) showError('Timeout de chargement EPUB.');
          }, ${epubTimeout});
        }

        // Messages from RN → WebView
        document.addEventListener('message', function(event) {
          try {
            var data = JSON.parse(event.data || '{}');
            var r = window.__reader;
            if (!r) return;
            if (data.type === 'next') r.next();
            if (data.type === 'prev') r.prev();
            if (data.type === 'goToHref') r.goToHref(data.href);
            if (data.type === 'goToCfi') r.goToCfi(data.cfi);
            if (data.type === 'applyHighlight') r.applyHighlight(data.id, data.cfiRange, data.color);
            if (data.type === 'removeHighlight') r.removeHighlight(data.cfiRange);
            if (data.type === 'applyAllHighlights') r.applyAllHighlights(data.highlights);
          } catch (e) {}
        });
        // iOS uses window.addEventListener for WKWebView
        window.addEventListener('message', function(event) {
          try {
            var data = JSON.parse(event.data || '{}');
            var r = window.__reader;
            if (!r) return;
            if (data.type === 'next') r.next();
            if (data.type === 'prev') r.prev();
            if (data.type === 'goToHref') r.goToHref(data.href);
            if (data.type === 'goToCfi') r.goToCfi(data.cfi);
            if (data.type === 'applyHighlight') r.applyHighlight(data.id, data.cfiRange, data.color);
            if (data.type === 'removeHighlight') r.removeHighlight(data.cfiRange);
            if (data.type === 'applyAllHighlights') r.applyAllHighlights(data.highlights);
          } catch (e) {}
        });

        try { loadEpubJs(); } catch (e) { showError('Le rendu EPUB a échoué.'); }
      })();
    </script>
  </body>
</html>`;
}

export default function BookReaderScreen({ route, navigation }) {
  const { contentId } = route.params || {};
  const { lockState, reacquire } = useReadingLock(contentId);
  const webRef = useRef(null);
  const progressRef = useRef(0);
  const currentCfiRef = useRef('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [session, setSession] = useState(null);
  const [localFileUrl, setLocalFileUrl] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [progress, setProgress] = useState(0);
  const [viewerReady, setViewerReady] = useState(false);

  // Bookmarks
  const [bookmarks, setBookmarks] = useState([]);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);

  // Highlights
  const [highlights, setHighlights] = useState([]); // [{id, cfiRange, color, text}]
  const [pendingSelection, setPendingSelection] = useState(null); // {cfiRange, text}
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);

  // Panels
  const [showChapters, setShowChapters] = useState(false);

  const isPdf = useMemo(
    () => String(session?.content?.format || '').toLowerCase() === 'pdf',
    [session?.content?.format]
  );

  const isEpub = useMemo(
    () => String(session?.content?.format || '').toLowerCase() === 'epub',
    [session?.content?.format]
  );

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const [sessionData, chaptersData, bookmarksData, highlightsData] = await Promise.all([
          readingService.getSession(contentId),
          readingService.getChapters(contentId).catch(() => null),
          readingService.getBookmarks(contentId).catch(() => []),
          readingService.getHighlights(contentId).catch(() => []),
        ]);

        if (!active) return;
        setSession(sessionData);

        // Prefer local file if downloaded
        const localPath = await getLocalFilePath(contentId);
        if (localPath) setLocalFileUrl(localPath);

        const savedProgress = Number(sessionData?.progress?.progress_percent || 0);
        setProgress(savedProgress);
        progressRef.current = savedProgress;

        const savedCfi = sessionData?.progress?.last_position?.cfi || '';
        currentCfiRef.current = savedCfi;

        const mapped = Array.isArray(chaptersData?.chapters)
          ? chaptersData.chapters.map((ch, idx) => ({
              id: ch.id || String(idx),
              title: ch.title || ch.label || `Chapitre ${idx + 1}`,
              href: ch.href || '',
            }))
          : [];
        setChapters(mapped);
        setBookmarks(Array.isArray(bookmarksData) ? bookmarksData : []);

        // Map highlights to {id, cfiRange, color, text}
        const mappedHighlights = (Array.isArray(highlightsData) ? highlightsData : []).map((h) => ({
          id: h.id,
          cfiRange: h.cfi_range,
          color: HIGHLIGHT_COLORS[h.color] || HIGHLIGHT_COLORS.yellow,
          colorKey: h.color || 'yellow',
          text: h.text || '',
        }));
        setHighlights(mappedHighlights);
      } catch (loadError) {
        if (!active) return;
        setError(loadError?.message || 'Impossible de charger la lecture.');
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => { active = false; };
  }, [contentId]);

  // Auto-save every 30s + save on unmount
  useEffect(() => {
    if (!contentId) return;
    const doSave = () => {
      if (progressRef.current <= 0) return;
      readingService.saveProgress(contentId, {
        progressPercent: Number(progressRef.current.toFixed(2)),
        lastPosition: { progress: Number(progressRef.current.toFixed(2)), cfi: currentCfiRef.current },
        totalTimeSeconds: 0,
      }).catch(() => {});
    };
    const timer = setInterval(doSave, 30000);
    return () => {
      clearInterval(timer);
      doSave(); // save on unmount
    };
  }, [contentId]);

  const sendToWeb = useCallback((payload) => {
    if (!webRef.current) return;
    webRef.current.postMessage(JSON.stringify(payload));
  }, []);

  // After viewer is ready, restore position + apply all highlights
  useEffect(() => {
    if (!viewerReady) return;
    if (currentCfiRef.current) {
      sendToWeb({ type: 'goToCfi', cfi: currentCfiRef.current });
    }
    if (highlights.length > 0) {
      sendToWeb({
        type: 'applyAllHighlights',
        highlights: highlights.map((h) => ({ id: h.id, cfiRange: h.cfiRange, color: h.color })),
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerReady]);

  const onWebMessage = useCallback((event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data || '{}');

      if (message.type === 'relocated') {
        const next = Number(message?.payload?.progress || 0);
        const cfi = message?.payload?.cfi || '';
        const nextProgress = Number.isFinite(next) ? next : 0;
        setProgress(nextProgress);
        progressRef.current = nextProgress;
        if (cfi) currentCfiRef.current = cfi;
      }

      if (message.type === 'ready') {
        setViewerReady(true);
      }

      if (message.type === 'toc') {
        const items = Array.isArray(message?.payload?.items) ? message.payload.items : [];
        if (items.length > 0) {
          setChapters(items.map((item, idx) => ({
            id: item.id || String(idx),
            title: item.label || `Chapitre ${idx + 1}`,
            href: item.href || '',
          })));
        }
      }

      if (message.type === 'textSelected') {
        const { cfiRange, text } = message?.payload || {};
        if (cfiRange && text) {
          setPendingSelection({ cfiRange, text });
          setShowHighlightPicker(true);
        }
      }

      if (message.type === 'error') {
        setError(message?.payload?.message || 'Erreur de rendu EPUB.');
      }
    } catch {}
  }, []);

  const handleAddHighlight = useCallback(async (colorKey) => {
    if (!pendingSelection || !contentId) return;
    setShowHighlightPicker(false);
    const { cfiRange, text } = pendingSelection;
    setPendingSelection(null);

    const colorFill = HIGHLIGHT_COLORS[colorKey] || HIGHLIGHT_COLORS.yellow;

    try {
      const created = await readingService.addHighlight(contentId, {
        text: text.slice(0, 500),
        cfiRange,
        position: { cfi: cfiRange },
        color: colorKey,
      });
      const newHL = { id: created.id, cfiRange, color: colorFill, colorKey, text };
      setHighlights((prev) => [...prev, newHL]);
      sendToWeb({ type: 'applyHighlight', id: created.id, cfiRange, color: colorFill });
    } catch (err) {
      console.warn('addHighlight failed:', err?.message);
    }
  }, [pendingSelection, contentId, sendToWeb]);

  const handleDeleteHighlight = useCallback(async (hl) => {
    const prev = highlights;
    setHighlights((h) => h.filter((x) => x.id !== hl.id));
    sendToWeb({ type: 'removeHighlight', cfiRange: hl.cfiRange });
    try {
      await readingService.deleteHighlight(contentId, hl.id);
    } catch (err) {
      console.warn('deleteHighlight failed:', err?.message);
      setHighlights(prev);
    }
  }, [highlights, contentId, sendToWeb]);

  const handleAddBookmark = useCallback(async () => {
    if (!contentId || bookmarkLoading) return;
    setBookmarkLoading(true);
    try {
      const cfi = currentCfiRef.current;
      const created = await readingService.addBookmark(
        contentId,
        { cfi, percent: Math.round(progressRef.current) },
        `${Math.round(progressRef.current)}%`
      );
      setBookmarks((prev) => [created, ...prev]);
    } catch (err) {
      console.warn('addBookmark failed:', err?.message);
    } finally {
      setBookmarkLoading(false);
    }
  }, [contentId, bookmarkLoading]);

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

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingWrap} edges={['top', 'bottom']}>
        <ActivityIndicator size="large" color="#B5651D" />
      </SafeAreaView>
    );
  }

  if (error || !session?.stream?.url) {
    return (
      <SafeAreaView style={styles.loadingWrap} edges={['top', 'bottom']}>
        <Text style={styles.errorText}>{error || 'Fichier indisponible.'}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (lockState === 'displaced') {
    return (
      <SafeAreaView style={styles.loadingWrap} edges={['top', 'bottom']}>
        <MaterialCommunityIcons name="cellphone-arrow-down" size={48} color="#2E4057" />
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
        <MaterialCommunityIcons name="lock-outline" size={48} color="#B5651D" />
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
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#1F1A16" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{session?.content?.title || 'Lecture'}</Text>
        <View style={styles.headerActions}>
          {isEpub && (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => setShowBookmarks(true)}
            >
              <MaterialCommunityIcons
                name={bookmarks.length > 0 ? 'bookmark' : 'bookmark-outline'}
                size={20}
                color="#1F1A16"
              />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowChapters(true)}>
            <MaterialCommunityIcons name="format-list-bulleted" size={22} color="#1F1A16" />
          </TouchableOpacity>
        </View>
      </View>

      {isPdf && !!WebViewComponent && (
        <WebViewComponent
          source={{ uri: localFileUrl || session.stream.url }}
          style={styles.webview}
          onError={() => setError('Erreur de chargement PDF.')}
          onHttpError={() => setError('Erreur HTTP sur le PDF.')}
        />
      )}

      {isEpub && !!WebViewComponent && (
        <WebViewComponent
          ref={webRef}
          originWhitelist={['*']}
          source={{ html: buildEpubHtml({ bookUrl: localFileUrl || session.stream.url, title: session?.content?.title }) }}
          style={styles.webview}
          onMessage={onWebMessage}
          onError={() => setError('Erreur de chargement WebView EPUB.')}
          onHttpError={() => setError('Erreur HTTP du lecteur EPUB.')}
        />
      )}

      {isEpub && !viewerReady && !error && (
        <View style={styles.viewerOverlay}>
          <ActivityIndicator size="small" color="#B5651D" />
          <Text style={styles.viewerOverlayText}>Chargement EPUB…</Text>
        </View>
      )}

      {!WebViewComponent && (
        <View style={styles.unsupportedWrap}>
          <Text style={styles.unsupportedText}>
            Le module WebView n&apos;est pas présent dans ce build iOS.
          </Text>
          <Text style={styles.unsupportedSubtext}>
            Rebuild requis après installation native.
          </Text>
        </View>
      )}

      {!!WebViewComponent && !isPdf && !isEpub && (
        <View style={styles.unsupportedWrap}>
          <Text style={styles.unsupportedText}>
            Format non pris en charge dans le lecteur embarqué.
          </Text>
        </View>
      )}

      <View style={styles.footer}>
        <TouchableOpacity style={styles.footerBtn} onPress={() => sendToWeb({ type: 'prev' })}>
          <MaterialCommunityIcons name="chevron-left" size={24} color="#7D746A" />
        </TouchableOpacity>
        <Text style={styles.progressText}>{progress.toFixed(1)}%</Text>
        <TouchableOpacity style={styles.footerBtn} onPress={() => sendToWeb({ type: 'next' })}>
          <MaterialCommunityIcons name="chevron-right" size={24} color="#7D746A" />
        </TouchableOpacity>
      </View>

      {/* Chapters modal */}
      <Modal visible={showChapters} transparent animationType="slide" onRequestClose={() => setShowChapters(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowChapters(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chapitres</Text>
              <TouchableOpacity onPress={() => setShowChapters(false)}>
                <MaterialCommunityIcons name="close" size={22} color="#6E6860" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={chapters}
              keyExtractor={(item, index) => item.id || String(index)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.chapterItem}
                  onPress={() => {
                    setShowChapters(false);
                    if (isEpub && item.href) sendToWeb({ type: 'goToHref', href: item.href });
                  }}
                >
                  <Text style={styles.chapterTitle}>{item.title}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>Aucun chapitre disponible.</Text>}
            />
          </View>
        </View>
      </Modal>

      {/* Bookmarks modal */}
      <Modal visible={showBookmarks} transparent animationType="slide" onRequestClose={() => setShowBookmarks(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowBookmarks(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Marque-pages</Text>
              <TouchableOpacity onPress={() => setShowBookmarks(false)}>
                <MaterialCommunityIcons name="close" size={22} color="#6E6860" />
              </TouchableOpacity>
            </View>

            {/* Add bookmark at current position */}
            <TouchableOpacity
              style={[styles.chapterItem, styles.addBookmarkBtn]}
              disabled={bookmarkLoading}
              onPress={async () => {
                await handleAddBookmark();
              }}
            >
              <MaterialCommunityIcons name="bookmark-plus-outline" size={18} color="#C9741A" />
              <Text style={styles.addBookmarkText}>
                {bookmarkLoading ? 'Ajout...' : `Marquer ici (${Math.round(progress)}%)`}
              </Text>
            </TouchableOpacity>

            <ScrollView showsVerticalScrollIndicator={false}>
              {bookmarks.length === 0 ? (
                <Text style={styles.emptyText}>Aucun marque-page pour ce livre.</Text>
              ) : (
                bookmarks.map((bm) => (
                  <View key={bm.id} style={styles.bookmarkRow}>
                    <TouchableOpacity
                      style={{ flex: 1 }}
                      onPress={() => {
                        setShowBookmarks(false);
                        const cfi = bm.position?.cfi;
                        if (cfi) sendToWeb({ type: 'goToCfi', cfi });
                      }}
                    >
                      <Text style={styles.chapterTitle} numberOfLines={1}>
                        {bm.label || `Position ${bm.position?.percent || 0}%`}
                      </Text>
                      <Text style={styles.emptyText}>{bm.position?.percent || 0}%</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => handleDeleteBookmark(bm)}>
                      <MaterialCommunityIcons name="trash-can-outline" size={18} color="#B07050" />
                    </TouchableOpacity>
                  </View>
                ))
              )}
              {highlights.length > 0 && (
                <>
                  <Text style={[styles.modalTitle, { fontSize: 16, marginTop: 16, marginBottom: 8 }]}>
                    Surlignages ({highlights.length})
                  </Text>
                  {highlights.map((hl) => (
                    <View key={hl.id} style={[styles.bookmarkRow, { borderLeftWidth: 3, borderLeftColor: hl.color, paddingLeft: 10 }]}>
                      <Text style={[styles.chapterTitle, { flex: 1, fontSize: 13 }]} numberOfLines={2}>
                        {hl.text}
                      </Text>
                      <TouchableOpacity style={styles.iconBtn} onPress={() => handleDeleteHighlight(hl)}>
                        <MaterialCommunityIcons name="trash-can-outline" size={16} color="#B07050" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Highlight color picker */}
      <Modal visible={showHighlightPicker} transparent animationType="fade" onRequestClose={() => { setShowHighlightPicker(false); setPendingSelection(null); }}>
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
  container: { flex: 1, backgroundColor: '#F7F4EF' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F7F4EF' },
  errorText: { color: '#3D3530', marginBottom: 12, paddingHorizontal: 18, textAlign: 'center' },
  backBtn: { backgroundColor: '#C9741A', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  backBtnText: { color: '#fff', fontWeight: '700' },
  header: {
    height: 52,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2D8CB',
    backgroundColor: '#F7F4EF',
  },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#1F1A16', marginHorizontal: 8 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  bookmarkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0EAE0' },
  addBookmarkBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF5EA', borderWidth: 1, borderColor: '#C9741A', marginBottom: 12 },
  addBookmarkText: { color: '#C9741A', fontWeight: '700', marginLeft: 8, fontSize: 14 },
  pickerOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  pickerSheet: { backgroundColor: '#fff', borderRadius: 18, padding: 24, alignItems: 'center', width: 260 },
  pickerTitle: { fontSize: 16, fontWeight: '700', color: '#1F1A16', marginBottom: 16 },
  colorRow: { flexDirection: 'row', gap: 14, marginBottom: 20 },
  colorCircle: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' },
  pickerCancel: { paddingVertical: 8, paddingHorizontal: 20 },
  pickerCancelText: { color: '#7D746A', fontWeight: '600', fontSize: 14 },
  webview: { flex: 1, backgroundColor: '#F7F4EF' },
  viewerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(247,244,239,0.88)',
  },
  viewerOverlayText: {
    marginTop: 8,
    color: '#6E6860',
    fontWeight: '600',
  },
  unsupportedWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  unsupportedText: { color: '#6E6860', textAlign: 'center' },
  unsupportedSubtext: { color: '#8A8177', textAlign: 'center', marginTop: 6, fontSize: 13 },
  footer: {
    height: 52,
    borderTopWidth: 1,
    borderTopColor: '#E2D8CB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    backgroundColor: '#F0EBE4',
  },
  footerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  progressText: { color: '#4B433B', fontWeight: '700', fontSize: 14 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  modalSheet: {
    maxHeight: '60%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1F1A16' },
  chapterItem: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#F6F2EA',
    marginBottom: 8,
  },
  chapterTitle: { fontSize: 15, fontWeight: '600', color: '#2F2A26' },
  emptyText: { color: '#7D746A', paddingVertical: 12, textAlign: 'center' },
});
