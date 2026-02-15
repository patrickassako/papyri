import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Slider,
  Stack,
  Typography,
} from '@mui/material';
import { ArrowLeft, Bookmark, Forward, Pause, Play, Rewind, Share2, SkipBack, SkipForward, Timer, Volume2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { contentsService } from '../services/contents.service';
import { readingService } from '../services/reading.service';

const primary = '#f2960d';

function formatDuration(seconds) {
  if (!seconds || Number.isNaN(Number(seconds))) return '0:00';
  const total = Number(seconds);
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

export default function AudiobookPlayerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(45);
  const [canRead, setCanRead] = useState(false);
  const [accessHint, setAccessHint] = useState('');
  const [signedUrl, setSignedUrl] = useState('');
  const [chapters, setChapters] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [data, session, chaptersData] = await Promise.all([
          contentsService.getContentById(id),
          readingService.getSession(id),
          readingService.getChapters(id),
        ]);

        setContent(data);
        setSignedUrl(session?.stream?.url || '');
        setProgress(Number(session?.progress?.progress_percent || 0));
        setChapters(chaptersData?.chapters || []);
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
    };
    load();
  }, [id]);

  useEffect(() => {
    if (!canRead) return;
    const duration = Number(content?.duration_seconds || audioRef.current?.duration || 0);
    const currentSeconds = Math.floor((Number(progress) / 100) * duration);
    const timer = setTimeout(() => {
      readingService.saveProgress(id, {
        progressPercent: Number(progress),
        lastPosition: {
          position_seconds: currentSeconds,
          type: 'audiobook',
        },
        totalTimeSeconds: currentSeconds,
      }).catch(() => {});
    }, 700);

    return () => clearTimeout(timer);
  }, [canRead, content?.duration_seconds, id, progress]);

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

  const handleSeek = (_, value) => {
    const next = Number(value);
    setProgress(next);
    if (audioRef.current && Number.isFinite(audioRef.current.duration) && audioRef.current.duration > 0) {
      audioRef.current.currentTime = (next / 100) * audioRef.current.duration;
    }
  };

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', color: '#fff', background: 'linear-gradient(140deg,#111827,#1f2937)' }}>
      <Box sx={{ position: 'sticky', top: 0, zIndex: 20, borderBottom: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(17,24,39,0.8)', backdropFilter: 'blur(10px)', px: { xs: 2, md: 4 }, py: 1.6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Stack direction="row" spacing={2.5} alignItems="center">
          <Button startIcon={<ArrowLeft size={16} />} sx={{ color: '#c7ced8' }} onClick={() => navigate(`/catalogue/${id}`)}>
            Back to Library
          </Button>
          <Box sx={{ display: { xs: 'none', md: 'block' }, borderLeft: '1px solid rgba(255,255,255,0.1)', pl: 2.5 }}>
            <Typography sx={{ fontSize: '0.68rem', letterSpacing: '0.1em', color: '#9ca3af', textTransform: 'uppercase' }}>Now Playing</Typography>
            <Typography sx={{ fontSize: '0.9rem', fontWeight: 700 }}>{content.title}</Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1}>
          <IconButton sx={{ color: '#fff' }}><Share2 size={17} /></IconButton>
          <IconButton sx={{ color: '#fff' }}><Bookmark size={17} /></IconButton>
        </Stack>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.6fr 1fr' }, minHeight: 'calc(100vh - 73px)' }}>
        <Box sx={{ p: { xs: 3, md: 6 }, display: 'grid', placeItems: 'center' }}>
          <Box sx={{ width: '100%', maxWidth: 500 }}>
            <Box sx={{ mx: 'auto', width: '100%', maxWidth: 380, aspectRatio: '1/1', borderRadius: 3, overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.55)' }}>
              <Box component="img" src={content.cover_url || 'https://placehold.co/600x600/222/ddd?text=Cover'} alt={content.title} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </Box>

            <Box sx={{ mt: 4, textAlign: { xs: 'center', lg: 'left' } }}>
              <Typography sx={{ fontSize: { xs: '2rem', md: '2.7rem' }, lineHeight: 1.05, fontWeight: 800, fontFamily: 'Playfair Display, serif' }}>
                {content.title}
              </Typography>
              <Typography sx={{ mt: 1, color: '#c0c8d3' }}>
                by {content.author} {content.narrator ? `· Narrated by ${content.narrator}` : ''}
              </Typography>
            </Box>

            <Box sx={{ mt: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.8 }}>
                <Typography sx={{ color: '#d1d5db', fontSize: '0.92rem' }}>
                  Chapter 4: {formatDuration(Math.round((progress / 100) * Number(content.duration_seconds || 1710)))} / {formatDuration(content.duration_seconds || 1710)}
                </Typography>
                <Typography sx={{ color: primary, fontSize: '0.92rem', fontWeight: 700 }}>{progress}%</Typography>
              </Box>
              <Slider value={progress} onChange={handleSeek} sx={{ color: primary }} />
            </Box>

            <Box
              component="audio"
              ref={audioRef}
              src={signedUrl}
              preload="metadata"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onTimeUpdate={() => {
                if (!audioRef.current || !audioRef.current.duration) return;
                const pct = Math.min(100, Math.max(0, (audioRef.current.currentTime / audioRef.current.duration) * 100));
                setProgress(pct);
              }}
              sx={{ width: '100%', mt: 1.2 }}
              controls
            />

            <Stack direction="row" spacing={2.6} justifyContent="center" alignItems="center" sx={{ mt: 2.5 }}>
              <IconButton sx={{ color: '#9ca3af' }}><SkipBack /></IconButton>
              <IconButton sx={{ color: '#9ca3af' }}><Rewind /></IconButton>
              <IconButton sx={{ bgcolor: primary, color: '#111827', '&:hover': { bgcolor: '#db860b' }, width: 72, height: 72 }} onClick={handlePlayPause}>
                {isPlaying ? <Pause size={30} /> : <Play size={30} />}
              </IconButton>
              <IconButton sx={{ color: '#9ca3af' }}><Forward /></IconButton>
              <IconButton sx={{ color: '#9ca3af' }}><SkipForward /></IconButton>
            </Stack>

            <Box sx={{ mt: 3.2, p: 2, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.05)' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Volume2 size={18} color="#9ca3af" />
                  <Slider defaultValue={70} sx={{ color: '#fff', width: 110 }} />
                </Stack>
                <Stack direction="row" spacing={2}>
                  <Typography sx={{ color: '#9ca3af', fontSize: '0.82rem', fontWeight: 700 }}>1.25x</Typography>
                  <Timer size={18} color="#9ca3af" />
                </Stack>
              </Stack>
            </Box>
            {signedUrl ? (
              <Typography sx={{ mt: 1.2, color: '#9ca3af', fontSize: '0.74rem' }}>
                Stream sécurisé actif.
              </Typography>
            ) : null}
          </Box>
        </Box>

        <Box sx={{ borderLeft: { lg: '1px solid rgba(255,255,255,0.1)' }, bgcolor: 'rgba(255,255,255,0.04)', p: 3 }}>
          <Typography sx={{ fontSize: '1.25rem', fontWeight: 800 }}>Chapters</Typography>
          <Typography sx={{ color: '#9ca3af', fontSize: '0.76rem', mt: 0.4 }}>12 Sections</Typography>
          <Stack spacing={1.2} sx={{ mt: 2.5 }}>
            {(chapters.length > 0
              ? chapters.slice(0, 10).map((item, idx) => ({
                  n: String(idx + 1).padStart(2, '0'),
                  t: item.title || `Chapitre ${idx + 1}`,
                  d: item.end_seconds ? formatDuration(Math.max(0, Number(item.end_seconds) - Number(item.start_seconds || 0))) : '-',
                  active: idx === 0,
                }))
              : [{ n: '01', t: 'Introduction', d: formatDuration(content.duration_seconds || 1710), active: true }]
            ).map((ch) => (
              <Box key={ch.n} sx={{ p: 1.8, borderRadius: 2, border: ch.active ? `1px solid ${primary}` : '1px solid transparent', bgcolor: ch.active ? 'rgba(242,150,13,0.12)' : 'rgba(255,255,255,0.03)' }}>
                <Typography sx={{ fontSize: '0.92rem', fontWeight: ch.active ? 800 : 600, color: ch.active ? '#fff' : '#d1d5db' }}>
                  {ch.n} · {ch.t}
                </Typography>
                <Typography sx={{ mt: 0.4, fontSize: '0.72rem', color: '#9ca3af' }}>{ch.d}</Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}
