import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Drawer,
  IconButton,
  Slider,
  Stack,
  Typography,
} from '@mui/material';
import {
  ArrowLeft,
  Bookmark,
  ChevronsLeft,
  ChevronsRight,
  Expand,
  Forward,
  ListMusic,
  Pause,
  Play,
  Plus,
  Rewind,
  Share2,
  SkipBack,
  SkipForward,
  Timer,
  Volume2,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { formatDuration, chapterDuration } from '../utils/formatDuration';

const primary = '#f2960d';
const SPEEDS = [0.5, 1, 1.25, 1.5, 2];

export default function AudiobookPlayerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [chaptersOpen, setChaptersOpen] = useState(false);

  const {
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
    isInPlaylist,
    nextPlaylistItem,
    // Actions
    loadContent,
    togglePlayPause,
    seekToPercent,
    shiftTime,
    goToChapter,
    goPrevChapter,
    goNextChapter,
    setPlaybackRate,
    setVolume,
    handleAddOrRemovePlaylist,
    movePlaylistItem,
  } = useAudioPlayer();

  // Always refresh audio session/chapters for the route id
  useEffect(() => {
    if (!id) return;
    loadContent(id, true);
  }, [id, loadContent]);

  const chapterItems = useMemo(() => {
    if (Array.isArray(chapters) && chapters.length > 1) {
      return chapters.map((item, idx) => ({
        key: item.id || `${idx}`,
        index: idx,
        title: item.title || `Chapitre ${idx + 1}`,
        durationLabel: chapterDuration(item),
        active: idx === currentChapterIndex,
        kind: 'chapter',
        contentId: item.content_id || null,
        chapterId: item.id || null,
      }));
    }

    if (Array.isArray(playlist) && playlist.length > 1) {
      return playlist.map((item, idx) => ({
        key: item.id || item.content_id,
        index: idx,
        title: item?.content?.title || `Partie ${idx + 1}`,
        durationLabel: item?.content?.duration_seconds ? formatDuration(item.content.duration_seconds) : '-',
        active: item.content_id === id,
        kind: 'playlist',
        contentId: item.content_id,
        chapterId: null,
      }));
    }

    return [{
      key: 'intro',
      index: 0,
      title: 'Introduction',
      durationLabel: formatDuration(duration || content?.duration_seconds || 0),
      active: true,
      kind: 'chapter',
      chapterId: null,
    }];
  }, [chapters, playlist, currentChapterIndex, id, duration, content?.duration_seconds]);

  const openFullscreen = async () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await containerRef.current.requestFullscreen?.();
  };

  const handleChapterClick = (ch) => {
    if (ch.kind === 'playlist' && ch.contentId && ch.contentId !== id) {
      navigate(`/listen/${ch.contentId}`);
      return;
    }
    goToChapter(ch.index);
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!content || error) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>{error || 'Livre introuvable.'}</Alert>
        <Button onClick={() => navigate('/catalogue')} variant="outlined">Retour</Button>
      </Box>
    );
  }

  if (!canRead) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="warning" sx={{ mb: 2 }}>{accessHint || 'Accès non autorisé.'}</Alert>
        <Button onClick={() => navigate(`/catalogue/${id}`)} variant="outlined">Retour au détail</Button>
      </Box>
    );
  }

  return (
    <Box ref={containerRef} sx={{ minHeight: '100vh', color: '#fff', background: 'linear-gradient(140deg,#111827,#1f2937)' }}>
      <Box sx={{ position: 'sticky', top: 0, zIndex: 20, borderBottom: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(17,24,39,0.85)', backdropFilter: 'blur(10px)', px: { xs: 2, md: 4 }, py: 1.6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Stack direction="row" spacing={2.5} alignItems="center">
          <Button startIcon={<ArrowLeft size={16} />} sx={{ color: '#c7ced8' }} onClick={() => navigate(`/catalogue/${id}`)}>
            Retour bibliothèque
          </Button>
          <Box sx={{ display: { xs: 'none', md: 'block' }, borderLeft: '1px solid rgba(255,255,255,0.1)', pl: 2.5 }}>
            <Typography sx={{ fontSize: '0.68rem', letterSpacing: '0.1em', color: '#9ca3af', textTransform: 'uppercase' }}>Lecture audio</Typography>
            <Typography sx={{ fontSize: '0.9rem', fontWeight: 700 }}>{content.title}</Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            size="small"
            icon={isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
            label={isBuffering ? 'Buffering' : isOnline ? 'En ligne' : 'Hors ligne'}
            sx={{ bgcolor: 'rgba(255,255,255,0.12)', color: '#fff' }}
          />
          <IconButton sx={{ color: '#fff' }} onClick={openFullscreen}><Expand size={17} /></IconButton>
          <IconButton sx={{ color: '#fff' }}><Share2 size={17} /></IconButton>
          <IconButton sx={{ color: '#fff' }}><Bookmark size={17} /></IconButton>
        </Stack>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1.6fr 1fr' }, minHeight: 'calc(100vh - 73px)' }}>
        <Box sx={{ p: { xs: 2.5, md: 5 }, display: 'grid', placeItems: 'center' }}>
          <Box sx={{ width: '100%', maxWidth: 760 }}>
            <Box sx={{ mx: 'auto', width: '100%', maxWidth: 420, aspectRatio: '1/1', borderRadius: 3, overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.55)' }}>
              <Box component="img" src={content.cover_url || 'https://placehold.co/600x600/222/ddd?text=Cover'} alt={content.title} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </Box>

            <Box sx={{ mt: 3.2, textAlign: { xs: 'center', xl: 'left' } }}>
              <Typography sx={{ fontSize: { xs: '1.8rem', md: '2.3rem' }, lineHeight: 1.05, fontWeight: 800, fontFamily: 'Playfair Display, serif' }}>
                {content.title}
              </Typography>
              <Typography sx={{ mt: 1, color: '#c0c8d3' }}>
                by {content.author} {content.narrator ? `· Narré par ${content.narrator}` : ''}
              </Typography>
              <Typography sx={{ mt: 1, color: '#d1d5db', fontSize: '0.9rem' }}>
                {chapterItems.find((c) => c.active)?.title || `Chapitre ${currentChapterIndex + 1}`}
              </Typography>
            </Box>

            <Box sx={{ mt: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.8 }}>
                <Typography sx={{ color: '#d1d5db', fontSize: '0.92rem' }}>
                  {formatDuration(currentTime)} / {formatDuration(duration || content.duration_seconds || 0)}
                </Typography>
                <Typography sx={{ color: primary, fontSize: '0.92rem', fontWeight: 700 }}>{Math.round(progress)}%</Typography>
              </Box>
              <Slider value={progress} onChange={(_, value) => seekToPercent(value)} sx={{ color: primary }} />
            </Box>

            <Stack direction="row" spacing={1.4} justifyContent="center" alignItems="center" sx={{ mt: 2.2, flexWrap: 'wrap' }}>
              <IconButton sx={{ color: '#9ca3af' }} onClick={goPrevChapter}><SkipBack /></IconButton>
              <IconButton sx={{ color: '#9ca3af' }} onClick={() => shiftTime(-15)}><Rewind /></IconButton>
              <IconButton sx={{ bgcolor: primary, color: '#111827', '&:hover': { bgcolor: '#db860b' }, width: 72, height: 72 }} onClick={togglePlayPause}>
                {isPlaying ? <Pause size={30} /> : <Play size={30} />}
              </IconButton>
              <IconButton sx={{ color: '#9ca3af' }} onClick={() => shiftTime(30)}><Forward /></IconButton>
              <IconButton sx={{ color: '#9ca3af' }} onClick={goNextChapter}><SkipForward /></IconButton>
            </Stack>
            <Box sx={{ mt: 1.6, display: 'flex', justifyContent: 'center' }}>
              <Button
                variant="outlined"
                startIcon={<ListMusic size={16} />}
                onClick={() => setChaptersOpen(true)}
                sx={{
                  color: '#fff',
                  borderColor: 'rgba(255,255,255,0.28)',
                  textTransform: 'none',
                  '&:hover': { borderColor: primary, bgcolor: 'rgba(242,150,13,0.08)' },
                }}
              >
                Chapitres
              </Button>
            </Box>

            <Box sx={{ mt: 3, p: 2, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.06)' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Volume2 size={18} color="#9ca3af" />
                  <Slider value={volume} onChange={(_, value) => setVolume(Number(value))} sx={{ color: '#fff', width: 140 }} />
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Timer size={17} color="#9ca3af" />
                  {SPEEDS.map((speed) => (
                    <Chip
                      key={speed}
                      size="small"
                      label={`${speed}x`}
                      onClick={() => setPlaybackRate(speed)}
                      sx={{
                        bgcolor: playbackRate === speed ? primary : 'rgba(255,255,255,0.1)',
                        color: playbackRate === speed ? '#111827' : '#e5e7eb',
                        fontWeight: 700,
                      }}
                    />
                  ))}
                </Stack>
              </Stack>
            </Box>
            {signedUrl ? (
              <Typography sx={{ mt: 1.2, color: '#9ca3af', fontSize: '0.74rem' }}>
                Streaming sécurisé actif.
              </Typography>
            ) : null}
          </Box>
        </Box>

        <Box sx={{ borderLeft: { xl: '1px solid rgba(255,255,255,0.1)' }, bgcolor: 'rgba(255,255,255,0.04)', p: 2.2, display: 'grid', gridTemplateRows: '1fr 1fr', gap: 2, maxHeight: { xl: 'calc(100vh - 73px)' } }}>
          <Box sx={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <Typography sx={{ fontSize: '1.15rem', fontWeight: 800 }}>Chapitres</Typography>
            <Typography sx={{ color: '#9ca3af', fontSize: '0.76rem', mt: 0.4 }}>{chapterItems.length || 1} sections</Typography>
            <Stack spacing={1.1} sx={{ mt: 1.8, overflowY: 'auto', pr: 0.6 }}>
              {chapterItems.map((ch) => (
                <Box
                  key={ch.key}
                  onClick={() => handleChapterClick(ch)}
                  sx={{
                    p: 1.4,
                    borderRadius: 2,
                    border: ch.active ? `1px solid ${primary}` : '1px solid transparent',
                    bgcolor: ch.active ? 'rgba(242,150,13,0.12)' : 'rgba(255,255,255,0.03)',
                    cursor: 'pointer',
                  }}
                >
                  <Typography sx={{ fontSize: '0.88rem', fontWeight: ch.active ? 800 : 600, color: ch.active ? '#fff' : '#d1d5db' }}>
                    {String(ch.index + 1).padStart(2, '0')} · {ch.title}
                  </Typography>
                  <Typography sx={{ mt: 0.4, fontSize: '0.72rem', color: '#9ca3af' }}>{ch.durationLabel}</Typography>
                </Box>
              ))}
            </Stack>
          </Box>

          <Box sx={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Stack direction="row" spacing={1} alignItems="center">
                <ListMusic size={18} />
                <Typography sx={{ fontSize: '1rem', fontWeight: 800 }}>Playlist</Typography>
              </Stack>
              <Button
                size="small"
                onClick={handleAddOrRemovePlaylist}
                disabled={playlistActionLoading}
                startIcon={isInPlaylist ? <X size={14} /> : <Plus size={14} />}
                sx={{ color: '#fff' }}
              >
                {isInPlaylist ? 'Retirer' : 'Ajouter'}
              </Button>
            </Stack>

            {playlistError ? <Alert severity="warning" sx={{ mt: 1 }}>{playlistError}</Alert> : null}
            {playlistLoading ? (
              <Box sx={{ py: 2, display: 'grid', placeItems: 'center' }}><CircularProgress size={20} /></Box>
            ) : (
              <Stack spacing={1} sx={{ mt: 1.2, overflowY: 'auto', pr: 0.6 }}>
                {playlist.length === 0 ? (
                  <Typography sx={{ color: '#9ca3af', fontSize: '0.85rem' }}>Votre playlist est vide.</Typography>
                ) : (
                  playlist.map((item, idx) => {
                    const active = item.content_id === id;
                    return (
                      <Box
                        key={item.id}
                        sx={{
                          p: 1.2,
                          borderRadius: 2,
                          border: active ? `1px solid ${primary}` : '1px solid rgba(255,255,255,0.08)',
                          bgcolor: active ? 'rgba(242,150,13,0.14)' : 'rgba(255,255,255,0.02)',
                        }}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                          <Box sx={{ minWidth: 0, cursor: 'pointer' }} onClick={() => navigate(`/listen/${item.content_id}`)}>
                            <Typography noWrap sx={{ fontSize: '0.86rem', fontWeight: 700 }}>{item?.content?.title || 'Titre audio'}</Typography>
                            <Typography noWrap sx={{ fontSize: '0.72rem', color: '#9ca3af' }}>
                              {item?.content?.author || 'Auteur'}
                              {item?.progress?.progress_percent ? ` · ${Math.round(item.progress.progress_percent)}%` : ''}
                            </Typography>
                          </Box>
                          <Stack direction="row" spacing={0.4}>
                            <IconButton size="small" sx={{ color: '#9ca3af' }} onClick={() => movePlaylistItem(idx, idx - 1)}><ChevronsLeft size={14} /></IconButton>
                            <IconButton size="small" sx={{ color: '#9ca3af' }} onClick={() => movePlaylistItem(idx, idx + 1)}><ChevronsRight size={14} /></IconButton>
                          </Stack>
                        </Stack>
                      </Box>
                    );
                  })
                )}
              </Stack>
            )}
          </Box>
        </Box>
      </Box>
      <Drawer
        anchor="bottom"
        open={chaptersOpen}
        onClose={() => setChaptersOpen(false)}
        PaperProps={{
          sx: {
            bgcolor: '#0f172a',
            color: '#fff',
            borderTopLeftRadius: 14,
            borderTopRightRadius: 14,
            maxHeight: '70vh',
          },
        }}
      >
        <Box sx={{ p: 2.2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.4 }}>
            <Typography sx={{ fontSize: '1.02rem', fontWeight: 800 }}>Chapitres</Typography>
            <IconButton sx={{ color: '#cbd5e1' }} onClick={() => setChaptersOpen(false)}>
              <X size={18} />
            </IconButton>
          </Stack>
          <Stack spacing={1.1} sx={{ overflowY: 'auto', pr: 0.4 }}>
            {chapterItems.map((ch) => (
              <Box
                key={`drawer-${ch.key}`}
                onClick={() => {
                  handleChapterClick(ch);
                  setChaptersOpen(false);
                }}
                sx={{
                  p: 1.2,
                  borderRadius: 2,
                  border: ch.active ? `1px solid ${primary}` : '1px solid rgba(255,255,255,0.1)',
                  bgcolor: ch.active ? 'rgba(242,150,13,0.12)' : 'rgba(255,255,255,0.03)',
                  cursor: 'pointer',
                }}
              >
                <Typography sx={{ fontSize: '0.88rem', fontWeight: ch.active ? 800 : 600, color: ch.active ? '#fff' : '#d1d5db' }}>
                  {String(ch.index + 1).padStart(2, '0')} · {ch.title}
                </Typography>
                <Typography sx={{ mt: 0.35, fontSize: '0.72rem', color: '#94a3b8' }}>{ch.durationLabel}</Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      </Drawer>
    </Box>
  );
}
