import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { contentsService } from '../services/contents.service';
import { readingService } from '../services/reading.service';

const SPEEDS = [0.5, 1, 1.25, 1.5, 2];
const PLAYBACK_RATE_KEY = 'audiobook_playback_rate';

export const AudioContext = createContext(null);

export function AudioProvider({ children }) {
  const navigate = useNavigate();
  const audioRef = useRef(null);
  const initialSeekDoneRef = useRef(false);
  const wasPlayingBeforeOfflineRef = useRef(false);
  const loadedIdRef = useRef(null);

  // Content state
  const [content, setContent] = useState(null);
  const [contentId, setContentId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [canRead, setCanRead] = useState(false);
  const [accessHint, setAccessHint] = useState('');
  const [signedUrl, setSignedUrl] = useState('');
  const [chapters, setChapters] = useState([]);
  const [playlist, setPlaylist] = useState([]);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [playlistError, setPlaylistError] = useState('');
  const [playlistActionLoading, setPlaylistActionLoading] = useState(false);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [volume, setVolumeState] = useState(80);
  const [savedPositionSeconds, setSavedPositionSeconds] = useState(0);
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);

  // Init playback rate from localStorage
  useEffect(() => {
    const saved = Number(window.localStorage.getItem(PLAYBACK_RATE_KEY) || 1);
    setPlaybackRateState(SPEEDS.includes(saved) ? saved : 1);
  }, []);

  // Sync playback rate to audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = playbackRate;
    window.localStorage.setItem(PLAYBACK_RATE_KEY, String(playbackRate));
  }, [playbackRate]);

  // Sync volume to audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = Math.max(0, Math.min(1, volume / 100));
  }, [volume]);

  // Online/offline monitoring + auto-resume
  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      if (wasPlayingBeforeOfflineRef.current && audioRef.current) {
        audioRef.current.play().catch(() => {});
        wasPlayingBeforeOfflineRef.current = false;
      }
    };
    const onOffline = () => {
      setIsOnline(false);
      if (audioRef.current && !audioRef.current.paused) {
        wasPlayingBeforeOfflineRef.current = true;
      }
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
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

  // ---- Load chapter source ----
  const loadChapterSource = useCallback(async (chapterIndex, autoplay = false) => {
    const chapter = chapters[chapterIndex];
    if (!chapter) return;

    setActiveChapterIndex(chapterIndex);
    setCurrentTime(0);
    setProgress(0);
    initialSeekDoneRef.current = true;

    if (!chapter.id) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        if (autoplay) audioRef.current.play().catch(() => {});
      }
      return;
    }

    try {
      const streamData = await readingService.getChapterFileUrl(contentId, chapter.id);
      if (streamData?.url) {
        setSignedUrl(streamData.url);
        if (audioRef.current) {
          audioRef.current.src = streamData.url;
          audioRef.current.currentTime = 0;
          if (autoplay) audioRef.current.play().catch(() => {});
        }
      }
    } catch (err) {
      console.error('Erreur chargement chapitre:', err);
      // On 403, try to re-fetch the URL (signed URL expired)
      if (err?.message?.includes('403')) {
        try {
          const retryData = await readingService.getChapterFileUrl(contentId, chapter.id);
          if (retryData?.url && audioRef.current) {
            setSignedUrl(retryData.url);
            audioRef.current.src = retryData.url;
            audioRef.current.currentTime = 0;
            if (autoplay) audioRef.current.play().catch(() => {});
          }
        } catch (retryErr) {
          console.error('Retry failed:', retryErr);
        }
      }
    }
  }, [chapters, contentId]);

  // ---- Persist progress ----
  const persistProgress = useCallback(async (force = false) => {
    if (!canRead || !audioRef.current || !content?.id) return;
    const audio = audioRef.current;
    const total = Number(audio.duration || duration || content.duration_seconds || 0);
    const positionSeconds = Number(audio.currentTime || currentTime || 0);

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
  }, [canRead, content?.id, currentTime, duration, content?.duration_seconds, chapters, currentChapterIndex]);

  // Auto-save every 30s
  useEffect(() => {
    if (!canRead) return undefined;
    const timer = setInterval(() => {
      if (audioRef.current && !audioRef.current.paused) {
        persistProgress(false);
      }
    }, 30000);
    return () => {
      clearInterval(timer);
      persistProgress(true);
    };
  }, [canRead, persistProgress]);

  // ---- Load content ----
  const loadContent = useCallback(async (id, forceReload = false) => {
    if (loadedIdRef.current === id && !forceReload) return; // Already loaded
    loadedIdRef.current = id;

    setLoading(true);
    setError('');
    setAccessHint('');
    setCanRead(false);
    setProgress(0);
    setCurrentTime(0);
    setSavedPositionSeconds(0);
    setContentId(id);
    initialSeekDoneRef.current = false;

    try {
      const [data, session, chaptersData] = await Promise.all([
        contentsService.getContentById(id),
        readingService.getSession(id),
        readingService.getChapters(id),
      ]);

      setContent(data);
      setSignedUrl(session?.stream?.url || '');
      setDuration(Number(data?.duration_seconds || 0));
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
      loadedIdRef.current = null; // Allow retry on error
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
  }, [loadPlaylist]);

  // Load chapter source when canRead + chapters change
  useEffect(() => {
    if (!canRead || !chapters.length) return;
    loadChapterSource(currentChapterIndex, false);
  }, [canRead, chapters.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Actions ----
  const play = useCallback(() => {
    audioRef.current?.play().catch(() => {});
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, []);

  const seekToPercent = useCallback((value) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const next = Number(value);
    const nextTime = (next / 100) * audio.duration;
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
    setProgress(next);
  }, []);

  const shiftTime = useCallback((deltaSeconds) => {
    const audio = audioRef.current;
    if (!audio) return;
    const total = Number(audio.duration || 0);
    const next = Math.max(0, Math.min(total || Number.MAX_SAFE_INTEGER, Number(audio.currentTime || 0) + deltaSeconds));
    audio.currentTime = next;
    setCurrentTime(next);
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

  const setPlaybackRate = useCallback((rate) => {
    setPlaybackRateState(rate);
  }, []);

  const setVolume = useCallback((vol) => {
    setVolumeState(vol);
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

  // ---- MediaSession API ----
  useEffect(() => {
    if (!('mediaSession' in navigator) || !content) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: content.title || '',
      artist: content.author || '',
      album: 'Papyri',
      artwork: content.cover_url ? [
        { src: content.cover_url, sizes: '512x512', type: 'image/jpeg' },
      ] : [],
    });

    navigator.mediaSession.setActionHandler('play', () => play());
    navigator.mediaSession.setActionHandler('pause', () => pause());
    navigator.mediaSession.setActionHandler('seekbackward', () => shiftTime(-15));
    navigator.mediaSession.setActionHandler('seekforward', () => shiftTime(30));
    navigator.mediaSession.setActionHandler('previoustrack', chapters.length > 1 ? () => goPrevChapter() : null);
    navigator.mediaSession.setActionHandler('nexttrack', chapters.length > 1 ? () => goNextChapter() : null);

    return () => {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('seekbackward', null);
      navigator.mediaSession.setActionHandler('seekforward', null);
      navigator.mediaSession.setActionHandler('previoustrack', null);
      navigator.mediaSession.setActionHandler('nexttrack', null);
    };
  }, [content, chapters.length, play, pause, shiftTime, goPrevChapter, goNextChapter]);

  // Update mediaSession playbackState
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }, [isPlaying]);

  // ---- Audio event handlers ----
  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const d = Number(audio.duration || content?.duration_seconds || 0);
    if (Number.isFinite(d) && d > 0) {
      setDuration(d);
    }
    if (!initialSeekDoneRef.current && savedPositionSeconds > 0 && Number.isFinite(audio.duration) && audio.duration > 0) {
      audio.currentTime = Math.min(savedPositionSeconds, audio.duration - 1);
      setCurrentTime(audio.currentTime);
      setProgress((audio.currentTime / audio.duration) * 100);
      initialSeekDoneRef.current = true;
    }
    audio.playbackRate = playbackRate;
    audio.volume = volume / 100;
  }, [content?.duration_seconds, savedPositionSeconds, playbackRate, volume]);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    setIsBuffering(false);
  }, []);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    setIsBuffering(false);
    persistProgress(true);
  }, [persistProgress]);

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    setCurrentTime(audio.currentTime);
    setProgress(Math.min(100, Math.max(0, (audio.currentTime / audio.duration) * 100)));
  }, []);

  const handleEnded = useCallback(() => {
    persistProgress(true);
    if (currentChapterIndex < chapters.length - 1) {
      loadChapterSource(currentChapterIndex + 1, true);
      return;
    }
    if (nextPlaylistItem?.content_id) {
      navigate(`/listen/${nextPlaylistItem.content_id}`);
    }
  }, [persistProgress, currentChapterIndex, chapters.length, loadChapterSource, nextPlaylistItem, navigate]);

  const handleWaiting = useCallback(() => setIsBuffering(true), []);
  const handlePlaying = useCallback(() => setIsBuffering(false), []);

  // Handle audio errors (403 = signed URL expired)
  const handleError = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !contentId) return;
    const chapter = chapters[currentChapterIndex];
    if (!chapter?.id) return;

    try {
      const streamData = await readingService.getChapterFileUrl(contentId, chapter.id);
      if (streamData?.url) {
        const wasPlaying = isPlaying;
        const pos = audio.currentTime;
        setSignedUrl(streamData.url);
        audio.src = streamData.url;
        audio.currentTime = pos || 0;
        if (wasPlaying) audio.play().catch(() => {});
      }
    } catch (err) {
      console.error('Failed to refresh audio URL:', err);
    }
  }, [contentId, chapters, currentChapterIndex, isPlaying]);

  const dismiss = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    loadedIdRef.current = null;
    setContent(null);
    setContentId(null);
    setSignedUrl('');
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
    setChapters([]);
    setCanRead(false);
  }, []);

  const value = useMemo(() => ({
    // State
    content,
    contentId,
    loading,
    error,
    canRead,
    accessHint,
    signedUrl,
    chapters,
    playlist,
    playlistLoading,
    playlistError,
    playlistActionLoading,
    isPlaying,
    isBuffering,
    isOnline,
    progress,
    duration,
    currentTime,
    playbackRate,
    volume,
    currentChapterIndex,
    currentChapter,
    isInPlaylist,
    playlistIndex,
    nextPlaylistItem,
    // Actions
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
    setVolume,
    loadPlaylist,
    handleAddOrRemovePlaylist,
    movePlaylistItem,
    dismiss,
  }), [
    content, contentId, loading, error, canRead, accessHint, signedUrl,
    chapters, playlist, playlistLoading, playlistError, playlistActionLoading,
    isPlaying, isBuffering, isOnline, progress, duration, currentTime,
    playbackRate, volume, currentChapterIndex, currentChapter,
    isInPlaylist, playlistIndex, nextPlaylistItem,
    loadContent, play, pause, togglePlayPause, seekToPercent, shiftTime,
    goToChapter, goPrevChapter, goNextChapter, setPlaybackRate, setVolume,
    loadPlaylist, handleAddOrRemovePlaylist, movePlaylistItem, dismiss,
  ]);

  return (
    <AudioContext.Provider value={value}>
      {children}
      {/* Global audio element — always present */}
      <audio
        ref={audioRef}
        src={signedUrl || undefined}
        preload="metadata"
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={handlePlay}
        onPause={handlePause}
        onWaiting={handleWaiting}
        onStalled={handleWaiting}
        onPlaying={handlePlaying}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onError={handleError}
        style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
      />
    </AudioContext.Provider>
  );
}
