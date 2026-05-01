import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TrackPlayer, {
  Event,
  State,
  Capability,
  useProgress,
  usePlaybackState,
  useTrackPlayerEvents,
} from 'react-native-track-player';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { readingService } from '../services/reading.service';
import {
  getLocalFilePath,
  getLocalChapterPath,
  getOfflineEntry,
  isOnline,
} from '../services/offline.service';
import { apiClient } from '../services/api.client';
import { useProfile } from './ProfileContext';

const SPEEDS = [0.5, 1, 1.25, 1.5, 2];
const PLAYBACK_RATE_KEY = 'audiobook_playback_rate';

export const AudioContext = createContext(null);

let playerReady = false;

async function ensurePlayerSetup() {
  if (playerReady) return;
  try {
    await TrackPlayer.setupPlayer({ autoHandleInterruptions: true });
    await TrackPlayer.updateOptions({
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
        Capability.SeekTo,
      ],
      compactCapabilities: [Capability.Play, Capability.Pause, Capability.SkipToNext],
      progressUpdateEventInterval: 1,
    });
    playerReady = true;
  } catch {
    playerReady = true;
  }
}

export function AudioProvider({ children }) {
  const { activeProfile } = useProfile();
  const prevProfileIdRef = useRef(undefined);
  const appStateRef = useRef(AppState.currentState);
  const saveTimerRef = useRef(null);
  const initialSeekDoneRef = useRef(false);

  // Refs for event handlers (avoid stale closures)
  const canReadRef = useRef(false);
  const contentRef = useRef(null);
  const chaptersRef = useRef([]);
  const activeChapterIndexRef = useRef(0);
  const loadChapterSourceRef = useRef(null);

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

  const [playbackRate, setPlaybackRateState] = useState(1);
  const [savedPositionSeconds, setSavedPositionSeconds] = useState(0);
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);

  // RNTP hooks — position/duration in seconds
  const { position, duration } = useProgress(500);
  const { state: playerState } = usePlaybackState();

  const isPlaying = playerState === State.Playing;
  const isBuffering = playerState === State.Buffering || playerState === State.Loading;
  const currentTime = position;
  const progress = duration > 0 ? Math.min(100, Math.max(0, (position / duration) * 100)) : 0;

  // Keep refs in sync with latest state
  useEffect(() => { canReadRef.current = canRead; }, [canRead]);
  useEffect(() => { contentRef.current = content; }, [content]);
  useEffect(() => { chaptersRef.current = chapters; }, [chapters]);
  useEffect(() => { activeChapterIndexRef.current = activeChapterIndex; }, [activeChapterIndex]);

  // Initialize RNTP player once
  useEffect(() => {
    ensurePlayerSetup();
  }, []);

  // Restore saved playback rate
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
    if (!canReadRef.current || !contentRef.current?.id) return;
    const total = duration || contentRef.current?.duration_seconds || 0;
    const positionSec = position || 0;
    if (!Number.isFinite(total) || total <= 0) return;
    if (!force && positionSec <= 0) return;
    const pct = Math.max(0, Math.min(100, (positionSec / total) * 100));
    try {
      const online = await isOnline().catch(() => true);
      if (!online) return;
      const chIdx = activeChapterIndexRef.current;
      await readingService.saveProgress(contentRef.current.id, {
        progressPercent: pct,
        lastPosition: {
          position_seconds: Math.floor(positionSec),
          type: 'audiobook',
          chapter_number: Number(chaptersRef.current[chIdx]?.index || chIdx + 1),
        },
        totalTimeSeconds: Math.floor(positionSec),
      });
    } catch (err) {
      console.error('Erreur sauvegarde progression audio:', err);
    }
  }, [position, duration]);

  // ---- Load chapter source ----
  const loadChapterSource = useCallback(async (chapterIndex, autoplay = false) => {
    const chapter = chapters[chapterIndex];
    if (!chapter) return;

    setActiveChapterIndex(chapterIndex);

    let url = null;
    if (chapter.id) {
      url = await getLocalChapterPath(contentId, chapter.id).catch(() => null);
    }
    if (!url) url = await getLocalFilePath(contentId).catch(() => null);

    if (!url) {
      try {
        if (chapter.id) {
          const streamData = await readingService.getChapterFileUrl(contentId, chapter.id);
          url = streamData?.url;
        } else {
          const session = await readingService.getSession(contentId);
          url = session?.stream?.url;
        }
      } catch {
        console.warn('Hors-ligne et aucun fichier local disponible pour ce chapitre.');
        return;
      }
    }
    if (!url) return;

    const track = {
      id: chapter.id || `chapter-${chapterIndex}`,
      url,
      title: chapter.title || `Chapitre ${chapterIndex + 1}`,
      artist: content?.author || '',
      album: content?.title || '',
      artwork: content?.cover_url || content?.thumbnail || undefined,
    };

    await TrackPlayer.reset().catch(() => {});
    await TrackPlayer.add(track).catch(() => {});
    await TrackPlayer.setRate(playbackRate).catch(() => {});

    if (!initialSeekDoneRef.current && savedPositionSeconds > 0 && !autoplay) {
      await TrackPlayer.seekTo(savedPositionSeconds).catch(() => {});
      initialSeekDoneRef.current = true;
    }

    if (autoplay) {
      await TrackPlayer.play().catch(() => {});
    }
  }, [chapters, contentId, content, playbackRate, savedPositionSeconds]);

  // Keep ref to latest version for event handlers
  useEffect(() => {
    loadChapterSourceRef.current = loadChapterSource;
  }, [loadChapterSource]);

  // Load initial chapter when content becomes ready
  useEffect(() => {
    if (!canRead || !chapters.length) return;
    loadChapterSource(currentChapterIndex, false);
  }, [canRead, chapters.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-advance to next chapter when current track ends
  useTrackPlayerEvents([Event.PlaybackQueueEnded], async () => {
    await persistProgress(true);
    const currentIdx = activeChapterIndexRef.current;
    const chaps = chaptersRef.current;
    if (currentIdx < chaps.length - 1) {
      await loadChapterSourceRef.current?.(currentIdx + 1, true);
    }
  });

  // Auto-save every 30s while playing
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

  // Save progress when app goes to background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appStateRef.current === 'active' && nextState.match(/inactive|background/)) {
        persistProgress(true);
      }
      appStateRef.current = nextState;
    });
    return () => subscription?.remove();
  }, [persistProgress]);

  // ---- Load content ----
  const loadContent = useCallback(async (id) => {
    if (contentId === id && content) return;

    setLoading(true);
    setError('');
    setAccessHint('');
    setCanRead(false);
    setSavedPositionSeconds(0);
    setContentId(id);
    setChapters([]);
    setActiveChapterIndex(0);
    initialSeekDoneRef.current = false;

    await TrackPlayer.reset().catch(() => {});

    const loadFromOfflineEntry = async () => {
      const offlineEntry = await getOfflineEntry(id);
      if (offlineEntry) {
        const offlineContent = {
          id,
          title: offlineEntry.title || 'Audiobook',
          author: offlineEntry.author || '',
          cover_url: offlineEntry.cover_url || null,
          content_type: 'audiobook',
          duration_seconds: offlineEntry.duration_seconds || 0,
        };
        setContent(offlineContent);
        setSavedPositionSeconds(0);

        if (Array.isArray(offlineEntry.chapters) && offlineEntry.chapters.length > 0) {
          setChapters(offlineEntry.chapters.map((ch) => ({
            id: ch.chapterId,
            index: ch.index,
            title: ch.title || `Chapitre ${ch.index}`,
          })));
        } else {
          setChapters([{ id: null, index: 1, title: offlineContent.title }]);
        }

        setActiveChapterIndex(0);
        setCanRead(true);
        return true;
      }
      return false;
    };

    const isNetworkError = (err) => {
      const msg = err?.message || '';
      return msg.includes('Network request failed')
        || msg.includes('network')
        || msg.includes('ENOTFOUND')
        || msg.includes('ECONNREFUSED')
        || msg.includes('fetch');
    };

    try {
      const [contentData, session, chaptersData] = await Promise.all([
        (async () => {
          const { data } = await apiClient.get(`/api/contents/${id}`);
          if (!data?.success) throw new Error(data?.message || 'Contenu introuvable');
          return data.data;
        })(),
        readingService.getSession(id),
        readingService.getChapters(id),
      ]);

      setContent(contentData);
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
      if (isNetworkError(err)) {
        const loaded = await loadFromOfflineEntry();
        if (loaded) return;
        setError('Pas de connexion internet et ce contenu n\'est pas disponible hors-ligne.');
      } else {
        const msg = err?.message || 'Impossible de charger le player audio.';
        if (msg.includes('Accès refusé') || msg.includes('abonnement') || msg.includes('paiement')) {
          setCanRead(false);
          setAccessHint(msg);
        } else {
          setError(msg);
        }
      }
    } finally {
      setLoading(false);
    }

    isOnline().then((online) => { if (online) loadPlaylist(); }).catch(() => {});
  }, [contentId, content, loadPlaylist]);

  // ---- Playback actions ----
  const play = useCallback(async () => {
    await TrackPlayer.play().catch(() => {});
  }, []);

  const pause = useCallback(async () => {
    await TrackPlayer.pause().catch(() => {});
  }, []);

  const togglePlayPause = useCallback(async () => {
    if (isPlaying) {
      await TrackPlayer.pause().catch(() => {});
    } else {
      await TrackPlayer.play().catch(() => {});
    }
  }, [isPlaying]);

  const seekToPercent = useCallback(async (value) => {
    if (duration <= 0) return;
    const posSec = (Number(value) / 100) * duration;
    await TrackPlayer.seekTo(Math.max(0, posSec)).catch(() => {});
  }, [duration]);

  const shiftTime = useCallback(async (deltaSeconds) => {
    const newPos = Math.max(0, Math.min(duration, position + deltaSeconds));
    await TrackPlayer.seekTo(newPos).catch(() => {});
  }, [position, duration]);

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
    await TrackPlayer.setRate(rate).catch(() => {});
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

  const dismiss = useCallback(async () => {
    await TrackPlayer.reset().catch(() => {});
    setContent(null);
    setContentId(null);
    setChapters([]);
    setActiveChapterIndex(0);
    setCanRead(false);
    setSavedPositionSeconds(0);
    initialSeekDoneRef.current = false;
  }, []);

  // Fermer le lecteur automatiquement quand le profil actif change
  useEffect(() => {
    const currentId = activeProfile?.id ?? null;
    if (prevProfileIdRef.current === undefined) {
      prevProfileIdRef.current = currentId;
      return;
    }
    if (prevProfileIdRef.current !== currentId) {
      prevProfileIdRef.current = currentId;
      dismiss();
    }
  }, [activeProfile?.id, dismiss]);

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
    dismiss,
  }), [
    content, contentId, loading, error, canRead, accessHint,
    chapters, playlist, playlistLoading, playlistError, playlistActionLoading,
    isPlaying, isBuffering, progress, duration, currentTime,
    playbackRate, currentChapterIndex, currentChapter,
    isInPlaylist, playlistIndex, nextPlaylistItem,
    loadContent, play, pause, togglePlayPause, seekToPercent, shiftTime,
    goToChapter, goPrevChapter, goNextChapter, setPlaybackRate, loadPlaylist,
    handleAddOrRemovePlaylist, movePlaylistItem, dismiss,
  ]);

  return (
    <AudioContext.Provider value={value}>
      {children}
    </AudioContext.Provider>
  );
}
