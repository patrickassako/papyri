import React from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import { Pause, Play, SkipBack, SkipForward, X } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAudioPlayer } from '../hooks/useAudioPlayer';

const primary = '#f29e0d';

// Circular progress ring SVG
function ProgressRing({ progress = 0, size = 40, strokeWidth = 2 }) {
  const radius = (size / 2) - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, progress)) / 100) * circumference;

  return (
    <svg
      width={size}
      height={size}
      style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)', pointerEvents: 'none' }}
      viewBox={`0 0 ${size} ${size}`}
    >
      {/* Background track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth={strokeWidth}
      />
      {/* Progress arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={primary}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{
          transition: 'stroke-dashoffset 0.35s ease',
          filter: `drop-shadow(0 0 2px rgba(242,158,13,0.5))`,
        }}
      />
    </svg>
  );
}

// Tiny equalizer bars
function EqualizerBars({ isPlaying }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '3px',
        height: 24,
        width: 16,
        cursor: 'pointer',
        '&:hover .eq-bar': { bgcolor: `${primary} !important` },
      }}
    >
      <Box
        className="eq-bar"
        sx={{
          width: 4,
          height: isPlaying ? 6 : 4,
          bgcolor: 'rgba(255,255,255,0.8)',
          borderRadius: '9999px',
          transition: 'height 0.3s, background-color 0.2s',
          animation: isPlaying ? 'eq1 0.8s ease-in-out infinite alternate' : 'none',
          '@keyframes eq1': { '0%': { height: 6 }, '100%': { height: 14 } },
        }}
      />
      <Box
        className="eq-bar"
        sx={{
          width: 4,
          height: isPlaying ? 10 : 6,
          bgcolor: 'rgba(255,255,255,0.4)',
          borderRadius: '9999px',
          transition: 'height 0.3s, background-color 0.2s',
          animation: isPlaying ? 'eq2 0.6s ease-in-out infinite alternate' : 'none',
          '@keyframes eq2': { '0%': { height: 10 }, '100%': { height: 20 } },
        }}
      />
      <Box
        className="eq-bar"
        sx={{
          width: 4,
          height: isPlaying ? 4 : 3,
          bgcolor: 'rgba(255,255,255,0.2)',
          borderRadius: '9999px',
          transition: 'height 0.3s, background-color 0.2s',
          animation: isPlaying ? 'eq3 1s ease-in-out infinite alternate' : 'none',
          '@keyframes eq3': { '0%': { height: 4 }, '100%': { height: 10 } },
        }}
      />
    </Box>
  );
}

export default function MiniPlayer() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    content,
    contentId,
    isPlaying,
    progress,
    playbackRate,
    togglePlayPause,
    goPrevChapter,
    goNextChapter,
    setPlaybackRate,
    dismiss,
  } = useAudioPlayer();

  if (!content || !contentId) return null;
  if (location.pathname.startsWith('/listen/')) return null;

  const SPEEDS = [0.5, 1, 1.25, 1.5, 2];
  const cycleSpeed = (e) => {
    e.stopPropagation();
    const idx = SPEEDS.indexOf(playbackRate);
    const next = SPEEDS[(idx + 1) % SPEEDS.length];
    setPlaybackRate(next);
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 32,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1200,
      }}
    >
      {/* Close button — positioned above the pill */}
      <IconButton
        size="small"
        onClick={(e) => { e.stopPropagation(); dismiss(); }}
        sx={{
          position: 'absolute',
          top: -10,
          right: -10,
          width: 22,
          height: 22,
          bgcolor: 'rgba(50,50,50,0.9)',
          border: '1px solid rgba(255,255,255,0.15)',
          color: 'rgba(255,255,255,0.6)',
          zIndex: 1,
          '&:hover': { bgcolor: 'rgba(80,80,80,0.95)', color: '#fff' },
        }}
      >
        <X size={12} />
      </IconButton>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          minWidth: 340,
          px: 1,
          py: 1,
          borderRadius: '9999px',
          backdropFilter: 'blur(20px)',
          bgcolor: 'rgba(30,30,30,0.6)',
          boxShadow: '0 8px 32px 0 rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.1)',
          transition: 'transform 0.3s ease',
          '&:hover': { transform: 'scale(1.02)' },
        }}
      >
        {/* Spinning cover */}
        <Box
          sx={{ position: 'relative', flexShrink: 0, ml: 0.5, cursor: 'pointer' }}
          onClick={() => navigate(`/listen/${contentId}`)}
        >
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              overflow: 'hidden',
              border: '2px solid rgba(255,255,255,0.1)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              animation: isPlaying ? 'spin 15s linear infinite' : 'none',
              '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
            }}
          >
            <Box
              component="img"
              src={content.cover_url || 'https://placehold.co/96x96/222/ddd?text=...'}
              alt={content.title}
              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </Box>
          {/* Active indicator dot */}
          <Box
            sx={{
              position: 'absolute',
              top: -2,
              right: -2,
              width: 12,
              height: 12,
              borderRadius: '50%',
              bgcolor: primary,
              border: '2px solid #121212',
            }}
          />
        </Box>

        {/* Center: controls + title */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {/* Prev */}
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); goPrevChapter(); }}
              sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff' }, p: 0.5 }}
            >
              <SkipBack size={20} />
            </IconButton>

            {/* Play/Pause with progress ring */}
            <Box sx={{ position: 'relative', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ProgressRing progress={progress} size={40} strokeWidth={2} />
              <IconButton
                onClick={(e) => { e.stopPropagation(); togglePlayPause(); }}
                sx={{
                  color: primary,
                  p: 0,
                  '&:hover': { color: '#fff' },
                }}
              >
                {isPlaying ? <Pause size={22} /> : <Play size={22} />}
              </IconButton>
            </Box>

            {/* Next */}
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); goNextChapter(); }}
              sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff' }, p: 0.5 }}
            >
              <SkipForward size={20} />
            </IconButton>
          </Box>

          {/* Title */}
          <Typography
            noWrap
            sx={{
              fontSize: '10px',
              fontWeight: 500,
              color: 'rgba(255,255,255,0.4)',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              mt: 0.25,
              maxWidth: 120,
              textAlign: 'center',
            }}
          >
            {content.title}
          </Typography>
        </Box>

        {/* Right: equalizer + speed */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            pr: 2,
            pl: 1.5,
            borderLeft: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <EqualizerBars isPlaying={isPlaying} />
          <Box
            onClick={cycleSpeed}
            sx={{
              px: 1,
              py: 0.5,
              borderRadius: '6px',
              bgcolor: 'rgba(255,255,255,0.05)',
              cursor: 'pointer',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
              transition: 'background-color 0.2s',
            }}
          >
            <Typography sx={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>
              {playbackRate}x
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
