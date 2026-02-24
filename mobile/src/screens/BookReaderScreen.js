import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { readingService } from '../services/reading.service';

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

function buildEpubHtml({ bookUrl, title }) {
  const safeUrl = escapeForHtml(bookUrl);
  const safeTitle = escapeForHtml(title || 'Lecture EPUB');

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
        var toc = [];

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

        function startReader() {
          if (typeof window.ePub !== 'function') {
            showError('Moteur EPUB indisponible.');
            return;
          }

          book = ePub("${safeUrl}");
          rendition = book.renderTo("viewer", {
            width: "100%",
            height: "100%",
            spread: "none"
          });

          rendition.display().then(function() {
            post('ready', {});
          }).catch(function(err) {
            showError('Impossible d\\'afficher cet EPUB.');
          });

          book.loaded.navigation.then(function(nav) {
            toc = (nav && nav.toc ? nav.toc : []).map(function(item, index) {
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

          book.ready.then(function() {
            return book.locations.generate(1200);
          }).catch(function() {});

          window.__reader = {
            next: function() { if (rendition) rendition.next(); },
            prev: function() { if (rendition) rendition.prev(); },
            goToHref: function(href) { if (rendition && href) rendition.display(href); },
            goToCfi: function(cfi) { if (rendition && cfi) rendition.display(cfi); }
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
            second.src = 'https://unpkg.com/epubjs/dist/epub.min.js';
            second.onload = done;
            second.onerror = function() { showError('Impossible de charger le moteur EPUB.'); };
            document.head.appendChild(second);
          }

          var first = document.createElement('script');
          first.src = 'https://cdn.jsdelivr.net/npm/epubjs/dist/epub.min.js';
          first.onload = done;
          first.onerror = fail;
          document.head.appendChild(first);

          setTimeout(function() {
            if (!loaded && (!window.ePub || typeof window.ePub !== 'function')) {
              showError('Timeout de chargement EPUB.');
            }
          }, 10000);
        }

        document.addEventListener('message', function(event) {
          try {
            var data = JSON.parse(event.data || '{}');
            if (!window.__reader) return;
            if (data.type === 'next') window.__reader.next();
            if (data.type === 'prev') window.__reader.prev();
            if (data.type === 'goToHref') window.__reader.goToHref(data.href);
            if (data.type === 'goToCfi') window.__reader.goToCfi(data.cfi);
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
  const webRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [session, setSession] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [progress, setProgress] = useState(0);
  const [showChapters, setShowChapters] = useState(false);
  const [viewerReady, setViewerReady] = useState(false);

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

        const [sessionData, chaptersData] = await Promise.all([
          readingService.getSession(contentId),
          readingService.getChapters(contentId).catch(() => null),
        ]);

        if (!active) return;
        setSession(sessionData);
        setProgress(Number(sessionData?.progress?.progress_percent || 0));

        const mapped = Array.isArray(chaptersData?.chapters)
          ? chaptersData.chapters.map((ch, idx) => ({
              id: ch.id || String(idx),
              title: ch.title || ch.label || `Chapitre ${idx + 1}`,
              href: ch.href || '',
            }))
          : [];
        setChapters(mapped);
      } catch (loadError) {
        if (!active) return;
        setError(loadError?.message || 'Impossible de charger la lecture.');
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [contentId]);

  useEffect(() => {
    return () => {
      if (!contentId) return;
      readingService.saveProgress(contentId, {
        progressPercent: Number(progress.toFixed(2)),
        lastPosition: { progress: Number(progress.toFixed(2)) },
        totalTimeSeconds: 0,
      }).catch(() => {});
    };
  }, [contentId, progress]);

  const onWebMessage = (event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data || '{}');
      if (message.type === 'relocated') {
        const next = Number(message?.payload?.progress || 0);
        setProgress(Number.isFinite(next) ? next : 0);
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
      if (message.type === 'error') {
        setError(message?.payload?.message || "Erreur de rendu EPUB.");
      }
    } catch {}
  };

  const sendToWeb = (payload) => {
    if (!webRef.current) return;
    webRef.current.postMessage(JSON.stringify(payload));
  };

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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#1F1A16" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{session?.content?.title || 'Lecture'}</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setShowChapters(true)}>
          <MaterialCommunityIcons name="format-list-bulleted" size={22} color="#1F1A16" />
        </TouchableOpacity>
      </View>

      {isPdf && !!WebViewComponent && (
        <WebViewComponent
          source={{ uri: session.stream.url }}
          style={styles.webview}
          onError={() => setError('Erreur de chargement PDF.')}
          onHttpError={() => setError('Erreur HTTP sur le PDF.')}
        />
      )}

      {isEpub && !!WebViewComponent && (
        <WebViewComponent
          ref={webRef}
          originWhitelist={['*']}
          source={{ html: buildEpubHtml({ bookUrl: session.stream.url, title: session?.content?.title }) }}
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

      <Modal
        visible={showChapters}
        transparent
        animationType="slide"
        onRequestClose={() => setShowChapters(false)}
      >
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
