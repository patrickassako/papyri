import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  Platform,
  Switch,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, ActivityIndicator } from 'react-native-paper';
import Slider from '@react-native-community/slider';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { readingService } from '../services/reading.service';
import { parseEpubArrayBuffer } from '../services/epub.service';
import { useReadingLock } from '../hooks/useReadingLock';

const FONT_OPTIONS = [
  {
    key: 'merriweather',
    label: 'Merriweather',
    family: Platform.select({ ios: 'Times New Roman', android: 'serif', default: 'serif' }),
  },
  {
    key: 'inter',
    label: 'Inter',
    family: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }),
  },
  {
    key: 'dyslexic',
    label: 'Dyslexic',
    family: Platform.select({ ios: 'Arial', android: 'sans-serif-medium', default: 'System' }),
  },
];

const THEMES = {
  paper: {
    background: '#F7F4EF',
    surface: '#ECE7DF',
    text: '#2E2A26',
    subtleText: '#6A625A',
  },
  cream: {
    background: '#EFE3CB',
    surface: '#E7D8BA',
    text: '#2F291F',
    subtleText: '#6C5F4D',
  },
  dark: {
    background: '#181411',
    surface: '#201A16',
    text: '#ECE7E0',
    subtleText: '#A89D91',
  },
};

const THEME_SWATCHES = [
  { key: 'paper', color: '#F7F4EF' },
  { key: 'cream', color: '#E8DCC5' },
  { key: 'dark', color: '#1C1714' },
];

function sanitizeHtmlText(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const noScript = raw
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const withoutTags = noScript.replace(/<\/?[^>]+(>|$)/g, ' ');
  const decoded = withoutTags
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
  return decoded.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function splitParagraphs(text) {
  if (!text) return [];
  const paragraphs = text
    .split(/\n{2,}/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter((part) => part.length > 0);
  if (paragraphs.length > 0) return paragraphs;
  return text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function buildFallbackParagraphs() {
  return [];
}

export default function ReaderScreen({ route, navigation }) {
  const { contentId } = route.params || {};
  const { lockState, reacquire } = useReadingLock(contentId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [session, setSession] = useState(null);
  const [paragraphs, setParagraphs] = useState([]);
  const [contentUnavailableReason, setContentUnavailableReason] = useState('');
  const [chapters, setChapters] = useState([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  // Bookmarks — persisted in DB
  const [bookmarks, setBookmarks] = useState([]); // [{id, position, label, created_at}]
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  const [showChapters, setShowChapters] = useState(false);
  const [progress, setProgress] = useState(0);
  const [binaryFormatLabel, setBinaryFormatLabel] = useState('');
  const [highlightMode, setHighlightMode] = useState(false);
  // highlights — {[cfiRange]: {id?, paragraphIndex, color, textPreview}} — synced with DB
  const [highlights, setHighlights] = useState({});

  const [fontSize, setFontSize] = useState(22);
  const [fontKey, setFontKey] = useState('merriweather');
  const [themeKey, setThemeKey] = useState('paper');
  const [brightness, setBrightness] = useState(1);
  const [nightMode, setNightMode] = useState(false);

  const listRef = useRef(null);
  const contentHeightRef = useRef(1);
  const viewportHeightRef = useRef(1);
  const saveTimerRef = useRef(null);
  const canAutoSaveRef = useRef(false);
  const progressRef = useRef(0);
  const hasAppliedInitialScrollRef = useRef(false);

  const activeTheme = useMemo(() => {
    if (nightMode) return THEMES.dark;
    return THEMES[themeKey] || THEMES.paper;
  }, [themeKey, nightMode]);

  const currentFontFamily = useMemo(
    () => FONT_OPTIONS.find((opt) => opt.key === fontKey)?.family || FONT_OPTIONS[0].family,
    [fontKey]
  );

  const chapterTitle = useMemo(() => {
    if (chapters[currentChapterIndex]?.title) return chapters[currentChapterIndex].title;
    return session?.progress?.last_position?.chapter_title || 'Chapitre en cours';
  }, [chapters, currentChapterIndex, session?.progress?.last_position?.chapter_title]);

  const chapterAnchors = useMemo(() => {
    if (!Array.isArray(chapters) || chapters.length === 0) {
      return [{ index: 0, startPercent: 0, title: chapterTitle }];
    }
    if (chapters.some((ch) => Number.isFinite(Number(ch?.startPercent)))) {
      return chapters.map((chapter, index) => ({
        index,
        title: chapter.title || `Chapitre ${index + 1}`,
        startPercent: Math.max(0, Math.min(100, Number(chapter.startPercent || 0))),
      }));
    }
    const count = chapters.length;
    return chapters.map((chapter, index) => ({
      index,
      title: chapter.title || `Chapitre ${index + 1}`,
      startPercent: count <= 1 ? 0 : (index / count) * 100,
    }));
  }, [chapters, chapterTitle]);

  const persistProgress = useCallback(
    async (nextProgress) => {
      if (!contentId || !canAutoSaveRef.current) return;
      try {
        await readingService.saveProgress(contentId, {
          progressPercent: Number(nextProgress.toFixed(2)),
          lastPosition: {
            progress: Number(nextProgress.toFixed(2)),
            chapter_title: chapterTitle,
            settings: {
              font_size: fontSize,
              font_key: fontKey,
              theme_key: themeKey,
              night_mode: nightMode,
              brightness,
            },
          },
          totalTimeSeconds: 0,
        });
      } catch (saveError) {
        console.warn('Reader progress save failed:', saveError?.message || saveError);
      }
    },
    [brightness, chapterTitle, contentId, fontKey, fontSize, nightMode, themeKey]
  );

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  const loadReadableContent = useCallback(async (sessionData) => {
    const fallbackParagraphs = buildFallbackParagraphs();
    const format = String(sessionData?.content?.format || '').toLowerCase();

    try {
      if (format === 'epub') {
        const { buffer } = await readingService.getContentFileArrayBuffer(sessionData?.content?.id || contentId);
        const parsed = await parseEpubArrayBuffer(buffer);
        setBinaryFormatLabel('');
        return {
          paragraphs: parsed.paragraphs || [],
          reason: '',
          chapterAnchors: parsed.chapterAnchors || [],
        };
      }

      const { contentType, text: rawText } = await readingService.getContentFile(sessionData?.content?.id || contentId);
      const normalizedType = String(contentType || '').toLowerCase();
      const isBinaryFormat = normalizedType.includes('application/pdf')
        || normalizedType.includes('application/epub+zip')
        || ['epub', 'pdf'].includes(format);

      if (isBinaryFormat) {
        const label = normalizedType.includes('pdf') || format === 'pdf' ? 'PDF' : 'EPUB';
        setBinaryFormatLabel(label);
        return {
          paragraphs: fallbackParagraphs,
          reason: `Le fichier réel est en ${label}. Le rendu natif ${label} mobile n'est pas encore activé.`,
        };
      }

      const normalized = sanitizeHtmlText(rawText);
      const parsed = splitParagraphs(normalized);
      if (parsed.join(' ').length < 300) {
        return {
          paragraphs: fallbackParagraphs,
          reason: 'Le fichier réel est chargé, mais son texte ne peut pas être segmenté proprement.',
        };
      }

      setBinaryFormatLabel('');
      return {
        paragraphs: parsed,
        reason: '',
        chapterAnchors: null,
      };
    } catch (fileError) {
      console.warn('Reader file fetch failed:', fileError?.message || fileError);
      setBinaryFormatLabel('');
      return {
        paragraphs: fallbackParagraphs,
        reason: 'Impossible de récupérer le fichier réel du livre.',
        chapterAnchors: null,
      };
    }
  }, [contentId]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!contentId) {
        setError('Contenu introuvable.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const sessionData = await readingService.getSession(contentId);
        if (!mounted) return;

        setSession(sessionData);

        const savedProgress = Number(route?.params?.position?.progress || sessionData?.progress?.progress_percent || 0);
        setProgress(Math.max(0, Math.min(100, savedProgress)));

        const savedSettings = sessionData?.progress?.last_position?.settings || {};
        if (Number.isFinite(Number(savedSettings.font_size))) {
          setFontSize(Number(savedSettings.font_size));
        }
        if (savedSettings.font_key) {
          setFontKey(savedSettings.font_key);
        }
        if (savedSettings.theme_key) {
          setThemeKey(savedSettings.theme_key);
        }
        if (typeof savedSettings.night_mode === 'boolean') {
          setNightMode(savedSettings.night_mode);
        }
        if (Number.isFinite(Number(savedSettings.brightness))) {
          setBrightness(Number(savedSettings.brightness));
        }

        const [contentPayload, chaptersResult, bookmarksResult, highlightsResult] = await Promise.all([
          loadReadableContent(sessionData),
          readingService.getChapters(contentId).catch(() => null),
          readingService.getBookmarks(contentId).catch(() => []),
          readingService.getHighlights(contentId).catch(() => []),
        ]);
        if (!mounted) return;
        setParagraphs(contentPayload?.paragraphs || []);
        setContentUnavailableReason(contentPayload?.reason || '');
        if (Array.isArray(contentPayload?.chapterAnchors) && contentPayload.chapterAnchors.length > 0) {
          setChapters(contentPayload.chapterAnchors);
        } else if (Array.isArray(chaptersResult?.chapters) && chaptersResult.chapters.length > 0) {
          setChapters(chaptersResult.chapters);
        } else {
          setChapters([{ id: 'chapter-1', title: 'Chapitre 1' }]);
        }

        // Load bookmarks from API
        setBookmarks(Array.isArray(bookmarksResult) ? bookmarksResult : []);

        // Load highlights from API — keyed by cfi_range (paragraph-N)
        const nextHighlights = {};
        if (Array.isArray(highlightsResult)) {
          highlightsResult.forEach((h) => {
            const idx = h?.position?.paragraphIndex;
            if (Number.isFinite(idx)) {
              nextHighlights[idx] = {
                id: h.id,
                paragraphIndex: idx,
                color: h.color === 'yellow' ? '#F9E27D' : h.color,
                textPreview: h.text || '',
              };
            }
          });
        }
        setHighlights(nextHighlights);

        hasAppliedInitialScrollRef.current = false;
        canAutoSaveRef.current = true;
      } catch (loadError) {
        console.error('Reader load error:', loadError);
        if (!mounted) return;
        setError(loadError?.message || 'Impossible de charger la lecture.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [contentId, loadReadableContent, route?.params?.position?.progress]);

  useEffect(() => {
    if (!canAutoSaveRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      persistProgress(progress);
    }, 2000);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [persistProgress, progress]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      persistProgress(progressRef.current);
    };
  }, [persistProgress]);

  const scrollToProgress = useCallback((nextProgress) => {
    const contentHeight = contentHeightRef.current;
    const viewportHeight = viewportHeightRef.current;
    const maxOffset = Math.max(0, contentHeight - viewportHeight);
    const targetY = (Math.max(0, Math.min(100, nextProgress)) / 100) * maxOffset;
    if (listRef.current && Number.isFinite(targetY)) {
      listRef.current.scrollToOffset({ offset: targetY, animated: true });
    }
  }, []);

  const getNearestChapterIndex = useCallback(
    (nextProgress) => {
      if (!chapterAnchors.length) return 0;
      let idx = 0;
      for (let i = 0; i < chapterAnchors.length; i += 1) {
        if (nextProgress >= chapterAnchors[i].startPercent) idx = i;
      }
      return idx;
    },
    [chapterAnchors]
  );

  const handleScroll = useCallback((event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const contentHeight = event.nativeEvent.contentSize.height;
    const viewportHeight = event.nativeEvent.layoutMeasurement.height;
    contentHeightRef.current = contentHeight;
    viewportHeightRef.current = viewportHeight;
    const maxOffset = Math.max(1, contentHeight - viewportHeight);
    const nextProgress = Math.max(0, Math.min(100, (offsetY / maxOffset) * 100));
    if (Math.abs(nextProgress - progressRef.current) >= 0.5) {
      setProgress(nextProgress);
      setCurrentChapterIndex(getNearestChapterIndex(nextProgress));
    }
  }, [getNearestChapterIndex]);

  const handlePrev = useCallback(() => {
    if (chapterAnchors.length > 1) {
      const target = Math.max(0, currentChapterIndex - 1);
      const targetProgress = chapterAnchors[target]?.startPercent ?? 0;
      setCurrentChapterIndex(target);
      setProgress(targetProgress);
      scrollToProgress(targetProgress);
      persistProgress(targetProgress);
      return;
    }
    const targetProgress = Math.max(0, progress - 5);
    setProgress(targetProgress);
    scrollToProgress(targetProgress);
    persistProgress(targetProgress);
  }, [chapterAnchors, currentChapterIndex, persistProgress, progress, scrollToProgress]);

  const handleNext = useCallback(() => {
    if (chapterAnchors.length > 1) {
      const target = Math.min(chapterAnchors.length - 1, currentChapterIndex + 1);
      const targetProgress = chapterAnchors[target]?.startPercent ?? progress;
      setCurrentChapterIndex(target);
      setProgress(targetProgress);
      scrollToProgress(targetProgress);
      persistProgress(targetProgress);
      return;
    }
    const targetProgress = Math.min(100, progress + 5);
    setProgress(targetProgress);
    scrollToProgress(targetProgress);
    persistProgress(targetProgress);
  }, [chapterAnchors, currentChapterIndex, persistProgress, progress, scrollToProgress]);

  useEffect(() => {
    setCurrentChapterIndex(getNearestChapterIndex(progress));
  }, [getNearestChapterIndex, progress]);

  const backgroundOverlayOpacity = useMemo(() => {
    if (brightness >= 1) return 0;
    return Math.min(0.35, 1 - brightness);
  }, [brightness]);

  const toggleParagraphHighlight = useCallback(async (paragraphIndex) => {
    const existing = highlights[paragraphIndex];
    if (existing) {
      // Remove optimistically then confirm via API
      setHighlights((prev) => {
        const next = { ...prev };
        delete next[paragraphIndex];
        return next;
      });
      if (existing.id && contentId) {
        readingService.deleteHighlight(contentId, existing.id).catch((err) => {
          console.warn('deleteHighlight failed:', err?.message);
          // Restore on failure
          setHighlights((prev) => ({ ...prev, [paragraphIndex]: existing }));
        });
      }
      return;
    }

    // Add optimistically
    const paragraphText = String(paragraphs[paragraphIndex] || '');
    const optimistic = { paragraphIndex, color: '#F9E27D', textPreview: paragraphText.slice(0, 120) };
    setHighlights((prev) => ({ ...prev, [paragraphIndex]: optimistic }));

    if (!contentId) return;
    try {
      const created = await readingService.addHighlight(contentId, {
        text: paragraphText.slice(0, 500) || `Paragraphe ${paragraphIndex + 1}`,
        cfiRange: `paragraph-${paragraphIndex}`,
        position: { paragraphIndex, chapter_label: chapterTitle },
        color: 'yellow',
      });
      // Store the DB id so we can delete later
      setHighlights((prev) => ({
        ...prev,
        [paragraphIndex]: { ...optimistic, id: created?.id },
      }));
    } catch (err) {
      console.warn('addHighlight failed:', err?.message);
      // Rollback
      setHighlights((prev) => {
        const next = { ...prev };
        delete next[paragraphIndex];
        return next;
      });
    }
  }, [highlights, paragraphs, contentId, chapterTitle]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingWrap} edges={['top', 'bottom']}>
        <ActivityIndicator size="large" color="#B5651D" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.loadingWrap, { backgroundColor: '#F7F4EF' }]} edges={['top', 'bottom']}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.errorBackBtn}>
          <Text style={styles.errorBackText}>Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (lockState === 'displaced') {
    return (
      <SafeAreaView style={[styles.loadingWrap, { backgroundColor: '#F7F4EF' }]} edges={['top', 'bottom']}>
        <MaterialCommunityIcons name="cellphone-arrow-down" size={48} color="#2E4057" />
        <Text style={[styles.errorText, { textAlign: 'center', marginTop: 12 }]}>
          Un autre appareil a repris la lecture.
        </Text>
        <TouchableOpacity
          onPress={reacquire}
          style={[styles.errorBackBtn, { backgroundColor: '#B5651D', marginBottom: 10 }]}
        >
          <Text style={styles.errorBackText}>Reprendre ici</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.errorBackBtn}>
          <Text style={styles.errorBackText}>Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (lockState === 'device_limit') {
    return (
      <SafeAreaView style={[styles.loadingWrap, { backgroundColor: '#F7F4EF' }]} edges={['top', 'bottom']}>
        <MaterialCommunityIcons name="lock-outline" size={48} color="#B5651D" />
        <Text style={[styles.errorText, { textAlign: 'center', marginTop: 12 }]}>
          Limite de 3 appareils atteinte.{'\n'}Supprimez un appareil depuis votre profil.
        </Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.errorBackBtn}>
          <Text style={styles.errorBackText}>Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: activeTheme.background }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={activeTheme.text} />
        </TouchableOpacity>
        {!!session?.content?.cover_url && (
          <Image source={{ uri: session.content.cover_url }} style={styles.headerCover} resizeMode="cover" />
        )}
        <Text numberOfLines={1} style={[styles.headerTitle, { color: activeTheme.text }]}>
          {session?.content?.title || 'Lecture'}
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.headerBtn, highlightMode ? styles.headerBtnActive : null]}
            onPress={() => setHighlightMode((v) => !v)}
          >
            <MaterialCommunityIcons name="marker" size={22} color={activeTheme.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerBtn}
            disabled={bookmarkLoading}
            onPress={async () => {
              if (!contentId) return;
              // If there's already a bookmark near current position, show list; else add one
              if (bookmarks.length > 0) {
                setShowBookmarks(true);
                return;
              }
              setBookmarkLoading(true);
              try {
                const created = await readingService.addBookmark(
                  contentId,
                  { percent: Math.round(progress), chapter_label: chapterTitle },
                  `Page ${Math.round(progress)}%`
                );
                setBookmarks((prev) => [created, ...prev]);
              } catch (err) {
                console.warn('addBookmark failed:', err?.message);
              } finally {
                setBookmarkLoading(false);
              }
            }}
          >
            <MaterialCommunityIcons
              name={bookmarks.length > 0 ? 'bookmark' : 'bookmark-outline'}
              size={22}
              color={activeTheme.text}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setShowSettings(true)}>
            <MaterialCommunityIcons name="format-text" size={22} color={activeTheme.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setShowChapters(true)}>
            <MaterialCommunityIcons name="format-list-bulleted" size={22} color={activeTheme.text} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        ref={listRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        data={paragraphs}
        keyExtractor={(_, index) => String(index)}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            activeOpacity={1}
            onLongPress={() => toggleParagraphHighlight(index)}
            onPress={() => {
              if (highlightMode) toggleParagraphHighlight(index);
            }}
          >
            <Text
              style={[
                styles.paragraph,
                highlights[index]
                  ? { backgroundColor: highlights[index].color, borderRadius: 4, overflow: 'hidden' }
                  : null,
                {
                  color: activeTheme.text,
                  fontSize,
                  lineHeight: Math.round(fontSize * 1.55),
                  fontFamily: currentFontFamily,
                },
              ]}
            >
              {item}
            </Text>
          </TouchableOpacity>
        )}
        onScroll={handleScroll}
        scrollEventThrottle={250}
        initialNumToRender={18}
        maxToRenderPerBatch={12}
        updateCellsBatchingPeriod={50}
        windowSize={7}
        removeClippedSubviews
        ListHeaderComponent={
          highlightMode ? (
            <View style={styles.highlightHint}>
              <Text style={styles.highlightHintText}>
                Mode surlignage actif: touche ou appui long sur un paragraphe pour ajouter/retirer un highlight.
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyReaderState}>
            <Text style={[styles.emptyReaderTitle, { color: activeTheme.text }]}>
              Texte non disponible
            </Text>
            <Text style={[styles.emptyReaderText, { color: activeTheme.subtleText }]}>
              {contentUnavailableReason || 'Le texte intégral de ce livre ne peut pas être affiché dans ce lecteur.'}
            </Text>
            {!!binaryFormatLabel && (
              <TouchableOpacity
                style={styles.openBinaryButton}
                onPress={() => navigation.replace('BookReader', { contentId })}
              >
                <MaterialCommunityIcons name="book-open-variant" size={18} color="#FFFFFF" />
                <Text style={styles.openBinaryButtonText}>Ouvrir dans le lecteur {binaryFormatLabel}</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        onContentSizeChange={(_, h) => {
          contentHeightRef.current = h;
          if (!hasAppliedInitialScrollRef.current) {
            scrollToProgress(progress);
            hasAppliedInitialScrollRef.current = true;
          }
        }}
        onLayout={(event) => {
          viewportHeightRef.current = event.nativeEvent.layout.height;
          if (!hasAppliedInitialScrollRef.current) {
            scrollToProgress(progress);
            hasAppliedInitialScrollRef.current = true;
          }
        }}
      />

      {backgroundOverlayOpacity > 0 && (
        <View
          pointerEvents="none"
          style={[styles.brightnessOverlay, { opacity: backgroundOverlayOpacity }]}
        />
      )}

      <View style={[styles.bottomPanel, { backgroundColor: activeTheme.surface }]}>
        <View style={styles.chapterTopRow}>
          <Text style={[styles.chapterLabel, { color: activeTheme.subtleText }]}>PROGRESSION LIVRE</Text>
          <Text style={[styles.chapterPercent, { color: activeTheme.text }]}>{progress.toFixed(1)}%</Text>
        </View>
        <Text numberOfLines={1} style={[styles.chapterTitle, { color: activeTheme.text }]}>
          {chapterTitle}
        </Text>
        <Slider
          minimumValue={0}
          maximumValue={100}
          value={progress}
          onValueChange={(value) => {
            setProgress(value);
            setCurrentChapterIndex(getNearestChapterIndex(value));
          }}
          onSlidingComplete={(value) => {
            setProgress(value);
            setCurrentChapterIndex(getNearestChapterIndex(value));
            scrollToProgress(value);
            persistProgress(value);
          }}
          minimumTrackTintColor="#C9741A"
          maximumTrackTintColor={nightMode ? '#4D433A' : '#CFC8BF'}
          thumbTintColor="#F1F1F1"
          style={styles.progressSlider}
        />
        <View style={styles.chapterBottomRow}>
          <TouchableOpacity
            style={styles.smallControl}
            disabled={progress <= 0}
            onPress={handlePrev}
          >
            <MaterialCommunityIcons name="skip-previous" size={18} color={activeTheme.subtleText} />
          </TouchableOpacity>
          <View style={[styles.centerGrip, { backgroundColor: nightMode ? '#3C342D' : '#D6CEC3' }]} />
          <TouchableOpacity
            style={styles.smallControl}
            disabled={progress >= 100}
            onPress={handleNext}
          >
            <MaterialCommunityIcons name="skip-next" size={18} color={activeTheme.subtleText} />
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={showChapters}
        transparent
        animationType="slide"
        onRequestClose={() => setShowChapters(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowChapters(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chapitres</Text>
              <TouchableOpacity onPress={() => setShowChapters(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#6E6860" />
              </TouchableOpacity>
            </View>

            {chapterAnchors.length === 0 && (
              <Text style={styles.emptyReaderText}>Aucun chapitre structuré disponible.</Text>
            )}

            {chapterAnchors.map((chapter) => {
              const active = chapter.index === currentChapterIndex;
              return (
                <TouchableOpacity
                  key={`${chapter.index}-${chapter.title}`}
                  style={[styles.chapterItem, active ? styles.chapterItemActive : null]}
                  onPress={() => {
                    setShowChapters(false);
                    setCurrentChapterIndex(chapter.index);
                    setProgress(chapter.startPercent);
                    scrollToProgress(chapter.startPercent);
                    persistProgress(chapter.startPercent);
                  }}
                >
                  <Text style={[styles.chapterItemTitle, active ? styles.chapterItemTitleActive : null]}>
                    {chapter.title}
                  </Text>
                  <Text style={styles.chapterItemPercent}>{chapter.startPercent.toFixed(1)}%</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showSettings}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSettings(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowSettings(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Réglages d&apos;affichage</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#6E6860" />
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionLabel}>LUMINOSITÉ</Text>
            <View style={styles.controlRow}>
              <MaterialCommunityIcons name="weather-sunny" size={18} color="#7F7971" />
              <Slider
                style={styles.controlSlider}
                minimumValue={0.6}
                maximumValue={1}
                step={0.05}
                value={brightness}
                onValueChange={setBrightness}
                minimumTrackTintColor="#C9741A"
                maximumTrackTintColor="#D8D3CC"
                thumbTintColor="#C9741A"
              />
              <MaterialCommunityIcons name="weather-night" size={18} color="#202020" />
            </View>

            <Text style={styles.sectionLabel}>TAILLE</Text>
            <View style={styles.controlRow}>
              <Text style={styles.sizeMarker}>A</Text>
              <Slider
                style={styles.controlSlider}
                minimumValue={16}
                maximumValue={30}
                step={1}
                value={fontSize}
                onValueChange={setFontSize}
                minimumTrackTintColor="#C9741A"
                maximumTrackTintColor="#D8D3CC"
                thumbTintColor="#FFFFFF"
              />
              <Text style={[styles.sizeMarker, styles.sizeMarkerLarge]}>A</Text>
            </View>

            <Text style={styles.sectionLabel}>POLICE</Text>
            <View style={styles.fontOptionsRow}>
              {FONT_OPTIONS.map((font) => {
                const selected = font.key === fontKey;
                return (
                  <TouchableOpacity
                    key={font.key}
                    style={[styles.fontChip, selected ? styles.fontChipSelected : null]}
                    onPress={() => setFontKey(font.key)}
                  >
                    <Text style={[styles.fontChipText, selected ? styles.fontChipTextSelected : null]}>
                      {font.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.themeRow}>
              {THEME_SWATCHES.map((swatch) => {
                const selected = (!nightMode && swatch.key === themeKey) || (nightMode && swatch.key === 'dark');
                return (
                  <TouchableOpacity
                    key={swatch.key}
                    style={[
                      styles.themeCircle,
                      { backgroundColor: swatch.color },
                      selected ? styles.themeCircleSelected : null,
                    ]}
                    onPress={() => {
                      setNightMode(swatch.key === 'dark');
                      setThemeKey(swatch.key);
                    }}
                  >
                    {selected && <MaterialCommunityIcons name="check" size={16} color="#C9741A" />}
                  </TouchableOpacity>
                );
              })}

              <View style={styles.nightModeWrap}>
                <Text style={styles.nightModeText}>Mode Nuit</Text>
                <Switch
                  value={nightMode}
                  onValueChange={(value) => {
                    setNightMode(value);
                    if (value) setThemeKey('dark');
                  }}
                  trackColor={{ false: '#D8D3CC', true: '#C9741A88' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Bookmarks modal ─────────────────── */}
      <Modal
        visible={showBookmarks}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBookmarks(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowBookmarks(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Marque-pages</Text>
              <TouchableOpacity onPress={() => setShowBookmarks(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#6E6860" />
              </TouchableOpacity>
            </View>

            {/* Add bookmark at current position */}
            <TouchableOpacity
              style={[styles.chapterItem, { marginBottom: 12, backgroundColor: '#FFF5EA', borderColor: '#C9741A', borderWidth: 1 }]}
              disabled={bookmarkLoading}
              onPress={async () => {
                if (!contentId) return;
                setBookmarkLoading(true);
                try {
                  const created = await readingService.addBookmark(
                    contentId,
                    { percent: Math.round(progress), chapter_label: chapterTitle },
                    `${chapterTitle} — ${Math.round(progress)}%`
                  );
                  setBookmarks((prev) => [created, ...prev]);
                } catch (err) {
                  console.warn('addBookmark failed:', err?.message);
                } finally {
                  setBookmarkLoading(false);
                }
              }}
            >
              <MaterialCommunityIcons name="bookmark-plus-outline" size={18} color="#C9741A" />
              <Text style={[styles.chapterItemTitle, { color: '#C9741A', marginLeft: 8 }]}>
                Marquer ici ({Math.round(progress)}%)
              </Text>
            </TouchableOpacity>

            {bookmarks.length === 0 ? (
              <Text style={[styles.emptyReaderText, { color: '#9A8F86', textAlign: 'center', paddingVertical: 16 }]}>
                Aucun marque-page pour ce livre.
              </Text>
            ) : (
              bookmarks.map((bm) => (
                <View key={bm.id} style={[styles.chapterItem, { flexDirection: 'row', alignItems: 'center' }]}>
                  <TouchableOpacity
                    style={{ flex: 1 }}
                    onPress={() => {
                      const targetPercent = Number(bm.position?.percent || 0);
                      setProgress(targetPercent);
                      scrollToProgress(targetPercent);
                      setShowBookmarks(false);
                    }}
                  >
                    <Text style={styles.chapterItemTitle}>
                      {bm.label || `${bm.position?.chapter_label || 'Position'} — ${bm.position?.percent || 0}%`}
                    </Text>
                    <Text style={styles.chapterItemPercent}>{bm.position?.chapter_label || ''}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ padding: 8 }}
                    onPress={async () => {
                      const prev = bookmarks;
                      setBookmarks((b) => b.filter((x) => x.id !== bm.id));
                      try {
                        await readingService.deleteBookmark(contentId, bm.id);
                      } catch (err) {
                        console.warn('deleteBookmark failed:', err?.message);
                        setBookmarks(prev);
                      }
                    }}
                  >
                    <MaterialCommunityIcons name="trash-can-outline" size={18} color="#B07050" />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7F4EF',
  },
  errorText: {
    color: '#3D3530',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 14,
    paddingHorizontal: 28,
  },
  errorBackBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#C9741A',
  },
  errorBackText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 19,
    fontWeight: '700',
    marginHorizontal: 6,
  },
  headerCover: {
    width: 26,
    height: 38,
    borderRadius: 5,
    backgroundColor: '#ddd2c7',
    marginLeft: 2,
    marginRight: 6,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBtnActive: {
    backgroundColor: 'rgba(201,116,26,0.22)',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 210,
  },
  paragraph: {
    marginBottom: 22,
    letterSpacing: 0.2,
  },
  highlightHint: {
    marginBottom: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(201,116,26,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  highlightHintText: {
    fontSize: 12,
    color: '#6E5A46',
    fontWeight: '600',
  },
  emptyReaderState: {
    marginTop: 20,
    marginBottom: 18,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D9D0C4',
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  emptyReaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyReaderText: {
    fontSize: 14,
    lineHeight: 20,
  },
  openBinaryButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#C9741A',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  openBinaryButtonText: {
    marginLeft: 8,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  brightnessOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  bottomPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
    paddingHorizontal: 18,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: '#D9D0C4',
  },
  chapterTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chapterLabel: {
    fontSize: 12,
    letterSpacing: 1.1,
    fontWeight: '700',
  },
  chapterPercent: {
    fontSize: 22,
    fontWeight: '700',
  },
  chapterTitle: {
    marginTop: 2,
    marginBottom: 10,
    fontSize: 27,
    lineHeight: 32,
    fontWeight: '700',
  },
  progressSlider: {
    width: '100%',
    height: 26,
  },
  chapterBottomRow: {
    marginTop: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  smallControl: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerGrip: {
    width: 72,
    height: 4,
    borderRadius: 999,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 34,
    lineHeight: 38,
    color: '#1F1A16',
    fontWeight: '700',
  },
  sectionLabel: {
    marginTop: 8,
    marginBottom: 8,
    fontSize: 20,
    letterSpacing: 0.8,
    color: '#817A72',
    fontWeight: '700',
  },
  controlRow: {
    minHeight: 58,
    borderRadius: 14,
    backgroundColor: '#F3F1EE',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  controlSlider: {
    flex: 1,
    marginHorizontal: 8,
  },
  sizeMarker: {
    color: '#2F2A26',
    fontSize: 24,
    fontWeight: '700',
  },
  sizeMarkerLarge: {
    fontSize: 34,
  },
  fontOptionsRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  fontChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F3F1EE',
    marginRight: 8,
  },
  fontChipSelected: {
    backgroundColor: '#C9741A',
  },
  fontChipText: {
    color: '#37312C',
    fontWeight: '600',
    fontSize: 15,
  },
  fontChipTextSelected: {
    color: '#FFFFFF',
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  themeCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E3D8C8',
  },
  themeCircleSelected: {
    borderWidth: 2,
    borderColor: '#C9741A',
  },
  nightModeWrap: {
    marginLeft: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
    backgroundColor: '#F3F1EE',
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  nightModeText: {
    color: '#37312C',
    fontWeight: '700',
    fontSize: 15,
  },
  chapterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F7F4EF',
    marginBottom: 8,
  },
  chapterItemActive: {
    borderWidth: 1,
    borderColor: '#C9741A',
    backgroundColor: '#FFF5EA',
  },
  chapterItemTitle: {
    flex: 1,
    marginRight: 10,
    fontSize: 15,
    fontWeight: '600',
    color: '#2F2A26',
  },
  chapterItemTitleActive: {
    color: '#C9741A',
  },
  chapterItemPercent: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7B746C',
  },
});
