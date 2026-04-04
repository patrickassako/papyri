import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Audio } from 'expo-av';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { readingService } from '../services/reading.service';
import { getLocalFilePath, isOnline } from '../services/offline.service';
import { apiClient } from '../services/api.client';

const SPEEDS = [0.5, 1, 1.25, 1.5, 2];
const PLAYBACK_RATE_KEY = 'audiobook_playback_rate';

export const AudioContext = createContext(null);

export function AudioProvider({ children }) {
  const soundRef = useRef(null);
  const initialSeekDoneRef = useRef(false);
  const saveTimerRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  // Content state
  const [content, setContent] = useState(null);
  const [contentId, setContentId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [canRead, setCanRead] = useState(false);
  const [accessHint, setAccessHint] = useState('');
  const [chapters, setChapters] = useState([]);
  const [playlist, setPlaylist] = useState([]);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [playlistError, setPlaylistError] = useState('');
  const [playlistActionLoading, setPlaylistActionLoading] = useState(false);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [savedPositionSeconds, setSavedPositionSeconds] = useState(0);
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);

  // Configure audio mode for background playback
  useEffect(() => {
    Audio.setAudioModeAsync({
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
    }).catch(console.error);
  }, []);

  // Load playback rate from storage
  useEffect(() => {
    AsyncStorage.getItem(PLAYBACK_RATE_KEY).then((val) => {
      const saved = Number(val || 1);
      setPlaybackRateState(SPEEDS.includes(saved) ? saved : 1);
    }).catch(() => {});
  }, []);

  const currentChapterIndex = useMemo(() => {
    if (!Array.isArray(chapters) || chapters.length === 0) return 0;
    return Math.max(0, Math.min(activeChapterIndex, chapters.length - 1));
  }, [chapters, activeChapterIndex]);

  const currentChapter = chapters[currentChapterIndex] || null;

  // ---- Playlist ----
  const loadPlaylist = useCallback(async () => {
    setPlaylistLoading(true);
    setPlaylistError('');
    try {
      const playlistData = await readingService.getAudioPlaylist();
      setPlaylist(Array.isArray(playlistData?.items) ? playlistData.items : []);
    } catch (err) {
      setPlaylistError(err?.message || 'Impossible de charger la playlist.');
    } finally {
      setPlaylistLoading(false);
    }
  }, []);

  const playlistIndex = useMemo(
    () => playlist.findIndex((item) => item.content_id === contentId),
    [playlist, contentId]
  );
  const isInPlaylist = playlistIndex >= 0;
  const nextPlaylistItem = playlistIndex >= 0 ? playlist[playlistIndex + 1] : null;

  // ---- Persist progress ----
  const persistProgress = useCallback(async (force = false) => {
    if (!canRead || !content?.id) return;
    const total = duration || content.duration_seconds || 0;
    const positionSeconds = currentTime || 0;

    if (!Number.isFinite(total) || total <= 0) return;
    if (!force && positionSeconds <= 0) return;

    const pct = Math.max(0, Math.min(100, (positionSeconds / total) * 100));

    try {
      await readingService.saveProgress(content.id, {
        progressPercent: pct,
        lastPosition: {
          position_seconds: Math.floor(positionSeconds),
          type: 'audiobook',
          chapter_number: Number(chapters[currentChapterIndex]?.index || currentChapterIndex + 1),
        },
        totalTimeSeconds: Math.floor(positionSeconds),
      });
    } catch (err) {
      console.error('Erreur sauvegarde progression audio:', err);
    }
  }, [canRead, content, currentTime, duration, chapters, currentChapterIndex]);

  // Auto-save every 30s
  useEffect(() => {
    if (!canRead) return;
    saveTimerRef.current = setInterval(() => {
      if (isPlaying) persistProgress(false);
    }, 30000);
    return () => {
      clearInterval(saveTimerRef.current);
      persistProgress(true);
    };
  }, [canRead, isPlaying, persistProgress]);

  // Save on app background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appStateRef.current === 'active' && nextState.match(/inactive|background/)) {
        persistProgress(true);
      }
      appStateRef.current = nextState;
    });
    return () => subscription?.remove();
  }, [persistProgress]);

  // ---- Playback status update ----
  const onPlaybackStatusUpdate = useCallback((status) => {
    if (!status.isLoaded) {
      if (status.error) console.error('Audio error:', status.error);
      return;
    }

    setIsPlaying(status.isPlaying);
    setIsBuffering(status.isBuffering);

    const posMs = status.positionMillis || 0;
    const durMs = status.durationMillis || 0;
    const posSec = posMs / 1000;
    const durSec = durMs / 1000;

    setCurrentTime(posSec);
    if (durSec > 0) {
      setDuration(durSec);
      setProgress(Math.min(100, Math.max(0, (posSec / durSec) * 100)));
    }

    // Handle track ended
    if (status.didJustFinish) {
      persistProgress(true);
      // Auto-advance to next chapter
      if (currentChapterIndex < chapters.length - 1) {
        loadChapterSource(currentChapterIndex + 1, true);
      }
    }
  }, [persistProgress, currentChapterIndex, chapters.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Load chapter source ----
  const loadChapterSource = useCallback(async (chapterIndex, autoplay = false) => {
    const chapter = chapters[chapterIndex];
    if (!chapter) return;

    setActiveChapterIndex(chapterIndex);
    setCurrentTime(0);
    setProgress(0);

    // Unload previous sound
    if (soundRef.current) {
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }

    if (!chapter.id && !contentId) return;

    try {
      // Check for offline local file first (single-file audiobooks)
      let url = await getLocalFilePath(contentId);

      if (!url) {
        const online = await isOnline();
        if (!online) {
          console.warn('Hors-ligne et aucun fichier local disponible.');
          return;
        }
        if (chapter.id) {
          const streamData = await readingService.getChapterFileUrl(contentId, chapter.id);
          url = streamData?.url;
        } else {
          const session = await readingService.getSession(contentId);
          url = session?.stream?.url;
        }
      }

      if (!url) return;

      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        {
          shouldPlay: autoplay,
          rate: playbackRate,
          shouldCorrectPitch: true,
          progressUpdateIntervalMillis: 500,
        },
        onPlaybackStatusUpdate
      );
      soundRef.current = sound;

      // Initial seek for saved position (only on first load, not on chapter navigation)
      if (!initialSeekDoneRef.current && savedPositionSeconds > 0 && !autoplay) {
        await sound.setPositionAsync(savedPositionSeconds * 1000).catch(() => {});
        initialSeekDoneRef.current = true;
      }
    } catch (err) {
      console.error('Erreur chargement chapitre:', err);
    }
  }, [chapters, contentId, playbackRate, onPlaybackStatusUpdate, savedPositionSeconds, activeChapterIndex]);

  // ---- Load content ----
  const loadContent = useCallback(async (id) => {
    if (contentId === id && content) return;

    setLoading(true);
    setError('');
    setAccessHint('');
    setCanRead(false);
    setProgress(0);
    setCurrentTime(0);
    setSavedPositionSeconds(0);
    setContentId(id);
    initialSeekDoneRef.current = false;

    // Unload previous sound
    if (soundRef.current) {
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }

    try {
      const [contentData, session, chaptersData] = await Promise.all([
        // We need a contents service for mobile — use apiClient directly
        (async () => {
          const { data } = await apiClient.get(`/api/contents/${id}`);
          if (!data?.success) throw new Error(data?.message || 'Contenu introuvable');
          return data.data;
        })(),
        readingService.getSession(id),
        readingService.getChapters(id),
      ]);

      setContent(contentData);
      setDuration(Number(contentData?.duration_seconds || 0));
      setProgress(Number(session?.progress?.progress_percent || 0));
      const positionSeconds = Number(session?.progress?.last_position?.position_seconds || 0);
      setSavedPositionSeconds(Number.isFinite(positionSeconds) ? positionSeconds : 0);
      const chapterList = chaptersData?.chapters || [];
      setChapters(chapterList);
      const savedChapterNumber = Number(session?.progress?.last_position?.chapter_number || 1);
      const savedIdx = chapterList.findIndex((ch) => Number(ch?.index || 0) === savedChapterNumber);
      setActiveChapterIndex(savedIdx >= 0 ? savedIdx : 0);
      setCanRead(true);
    } catch (err) {
      console.error(err);
      const msg = err?.message || 'Impossible de charger le player audio.';
      if (msg.includes('Accès refusé') || msg.includes('abonnement') || msg.includes('paiement')) {
        setCanRead(false);
        setAccessHint(msg);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }

    loadPlaylist();
  }, [contentId, content, loadPlaylist]);

  // Load chapter source when ready
  useEffect(() => {
    if (!canRead || !chapters.length) return;
    loadChapterSource(currentChapterIndex, false);
  }, [canRead, chapters.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Actions ----
  const play = useCallback(async () => {
    if (soundRef.current) await soundRef.current.playAsync().catch(() => {});
  }, []);

  const pause = useCallback(async () => {
    if (soundRef.current) await soundRef.current.pauseAsync().catch(() => {});
  }, []);

  const togglePlayPause = useCallback(async () => {
    if (!soundRef.current) return;
    const status = await soundRef.current.getStatusAsync();
    if (status.isLoaded) {
      if (status.isPlaying) {
        await soundRef.current.pauseAsync();
      } else {
        await soundRef.current.playAsync();
      }
    }
  }, []);

  const seekToPercent = useCallback(async (value) => {
    if (!soundRef.current || duration <= 0) return;
    const posMs = (Number(value) / 100) * duration * 1000;
    await soundRef.current.setPositionAsync(Math.max(0, posMs)).catch(() => {});
  }, [duration]);

  const shiftTime = useCallback(async (deltaSeconds) => {
    if (!soundRef.current) return;
    const status = await soundRef.current.getStatusAsync();
    if (!status.isLoaded) return;
    const newPos = Math.max(0, Math.min(status.durationMillis || 0, (status.positionMillis || 0) + deltaSeconds * 1000));
    await soundRef.current.setPositionAsync(newPos).catch(() => {});
  }, []);

  const goToChapter = useCallback((index) => {
    if (!chapters[index]) return;
    loadChapterSource(index, true);
  }, [chapters, loadChapterSource]);

  const goPrevChapter = useCallback(() => {
    goToChapter(Math.max(0, currentChapterIndex - 1));
  }, [goToChapter, currentChapterIndex]);

  const goNextChapter = useCallback(() => {
    goToChapter(Math.min(chapters.length - 1, currentChapterIndex + 1));
  }, [goToChapter, currentChapterIndex, chapters.length]);

  const setPlaybackRate = useCallback(async (rate) => {
    setPlaybackRateState(rate);
    AsyncStorage.setItem(PLAYBACK_RATE_KEY, String(rate)).catch(() => {});
    if (soundRef.current) {
      await soundRef.current.setRateAsync(rate, true).catch(() => {});
    }
  }, []);

  const handleAddOrRemovePlaylist = useCallback(async () => {
    if (!content || playlistActionLoading) return;
    setPlaylistActionLoading(true);
    setPlaylistError('');
    try {
      const result = isInPlaylist
        ? await readingService.removeFromAudioPlaylist(content.id)
        : await readingService.addToAudioPlaylist(content.id);
      setPlaylist(Array.isArray(result?.items) ? result.items : []);
    } catch (err) {
      setPlaylistError(err?.message || 'Action playlist impossible.');
    } finally {
      setPlaylistActionLoading(false);
    }
  }, [content, playlistActionLoading, isInPlaylist]);

  const movePlaylistItem = useCallback(async (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= playlist.length || fromIndex === toIndex) return;
    const cloned = [...playlist];
    const [moved] = cloned.splice(fromIndex, 1);
    cloned.splice(toIndex, 0, moved);
    setPlaylist(cloned);
    try {
      const result = await readingService.reorderAudioPlaylist(cloned.map((item) => item.content_id));
      setPlaylist(Array.isArray(result?.items) ? result.items : []);
    } catch (err) {
      setPlaylistError(err?.message || 'Réordonnancement impossible.');
      loadPlaylist();
    }
  }, [playlist, loadPlaylist]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  const value = useMemo(() => ({
    content,
    contentId,
    loading,
    error,
    canRead,
    accessHint,
    chapters,
    playlist,
    playlistLoading,
    playlistError,
    playlistActionLoading,
    isPlaying,
    isBuffering,
    progress,
    duration,
    currentTime,
    playbackRate,
    currentChapterIndex,
    currentChapter,
    isInPlaylist,
    playlistIndex,
    nextPlaylistItem,
    loadContent,
    play,
    pause,
    togglePlayPause,
    seekToPercent,
    shiftTime,
    goToChapter,
    goPrevChapter,
    goNextChapter,
    setPlaybackRate,
    loadPlaylist,
    handleAddOrRemovePlaylist,
    movePlaylistItem,
  }), [
    content, contentId, loading, error, canRead, accessHint,
    chapters, playlist, playlistLoading, playlistError, playlistActionLoading,
    isPlaying, isBuffering, progress, duration, currentTime,
    playbackRate, currentChapterIndex, currentChapter,
    isInPlaylist, playlistIndex, nextPlaylistItem,
    loadContent, play, pause, togglePlayPause, seekToPercent, shiftTime,
    goToChapter, goPrevChapter, goNextChapter, setPlaybackRate, loadPlaylist,
    handleAddOrRemovePlaylist, movePlaylistItem,
  ]);

  return (
    <AudioContext.Provider value={value}>
      {children}
    </AudioContext.Provider>
  );
}
