import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Chip,
  LinearProgress,
  Button,
  InputBase,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import DeleteSweepOutlined from '@mui/icons-material/DeleteSweepOutlined';
import SearchIcon from '@mui/icons-material/Search';
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined';
import TextFieldsOutlined from '@mui/icons-material/TextFieldsOutlined';
import HeadphonesOutlined from '@mui/icons-material/HeadphonesOutlined';
import TimelapseOutlined from '@mui/icons-material/TimelapseOutlined';
import PlayArrowOutlined from '@mui/icons-material/PlayArrowOutlined';
import ReplayOutlined from '@mui/icons-material/ReplayOutlined';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import GraphicEqOutlined from '@mui/icons-material/GraphicEqOutlined';
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined';
import EventAvailableOutlined from '@mui/icons-material/EventAvailableOutlined';
import CheckOutlined from '@mui/icons-material/CheckOutlined';
import MenuBookOutlined from '@mui/icons-material/MenuBookOutlined';
import LocalFireDepartmentOutlined from '@mui/icons-material/LocalFireDepartmentOutlined';
import DonutLargeOutlined from '@mui/icons-material/DonutLargeOutlined';
import tokens from '../config/tokens';
import * as authService from '../services/auth.service';
import { authFetch } from '../services/auth.service';
import UserSpaceSidebar from '../components/UserSpaceSidebar';
import MobileBottomNav from '../components/MobileBottomNav';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function normalizeHistoryItem(item) {
  const progress = Number(item?.progress_percent || 0);
  const completed = Boolean(item?.is_completed) || progress >= 100;
  const status = completed ? 'completed' : (progress > 0 ? 'in_progress' : 'paused');

  return {
    ...item,
    progress_percent: progress,
    status,
  };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatTotalTime(seconds) {
  if (!seconds || seconds <= 0) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function timeAgo(dateString) {
  const now = new Date();
  const then = new Date(dateString);
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin}min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Il y a ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return 'Hier';
  if (diffD < 7) return `Il y a ${diffD}j`;
  return `Il y a ${Math.floor(diffD / 7)} sem.`;
}

function groupByTimePeriod(items) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const weekStart = new Date(todayStart.getTime() - 7 * 86400000);

  const groups = {
    "Aujourd'hui": [],
    'Hier': [],
    'La semaine dernière': [],
    'Plus ancien': [],
  };

  items.forEach((item) => {
    const itemDate = new Date(item.last_read_at);
    if (itemDate >= todayStart) {
      groups["Aujourd'hui"].push(item);
    } else if (itemDate >= yesterdayStart) {
      groups['Hier'].push(item);
    } else if (itemDate >= weekStart) {
      groups['La semaine dernière'].push(item);
    } else {
      groups['Plus ancien'].push(item);
    }
  });

  return groups;
}

/* ------------------------------------------------------------------ */
/*  Status helpers                                                     */
/* ------------------------------------------------------------------ */

const statusConfig = {
  in_progress: { label: 'EN COURS', bg: '#FFF3E0', color: '#E65100' },
  paused: { label: 'PAUSE', bg: '#F5F5F5', color: '#616161' },
  completed: { label: 'TERMINÉ', bg: '#E8F5E9', color: tokens.colors.semantic.success },
};

function getStatusChip(status) {
  const cfg = statusConfig[status] || statusConfig.in_progress;
  return cfg;
}

/* ------------------------------------------------------------------ */
/*  Timeline section heading opacity                                   */
/* ------------------------------------------------------------------ */

const sectionOpacity = {
  "Aujourd'hui": 1,
  'Hier': 0.85,
  'La semaine dernière': 0.7,
  'Plus ancien': 0.6,
};

/* ------------------------------------------------------------------ */
/*  HistoryCard                                                        */
/* ------------------------------------------------------------------ */

function HistoryCard({ item, onResume }) {
  const navigate = useNavigate();
  const isAudio = item.content_type === 'audiobook';
  const isCompleted = item.status === 'completed';
  const isPaused = item.status === 'paused';
  const chipCfg = getStatusChip(item.status);

  // Progress bar color
  const progressColor = isCompleted
    ? tokens.colors.semantic.success
    : tokens.colors.primary;

  // Action button
  let actionLabel, ActionIcon, actionBg, actionColor;
  if (isCompleted) {
    actionLabel = 'Relire';
    ActionIcon = ReplayOutlined;
    actionBg = tokens.colors.surfaces.light.variant;
    actionColor = tokens.colors.onBackground.light;
  } else if (isPaused && isAudio) {
    actionLabel = 'Écouter';
    ActionIcon = PlayArrowOutlined;
    actionBg = tokens.colors.surfaces.light.variant;
    actionColor = tokens.colors.onBackground.light;
  } else {
    actionLabel = 'Reprendre';
    ActionIcon = PlayArrowOutlined;
    actionBg = tokens.colors.primary;
    actionColor = '#FFFFFF';
  }

  const handleAction = () => {
    const fmt = String(item.format || '').toLowerCase();
    if (isAudio) {
      navigate(`/listen/${item.content_id}`);
    } else if (fmt === 'pdf') {
      navigate(`/pdf/${item.content_id}`);
    } else {
      navigate(`/read/${item.content_id}`);
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: '16px',
        display: 'flex',
        gap: 2,
        border: `1px solid ${tokens.colors.surfaces.light.variant}`,
        transition: 'box-shadow 0.2s ease, transform 0.15s ease',
        '&:hover': {
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          transform: 'translateY(-1px)',
        },
        '&:hover .history-action-btn': {
          opacity: 1,
        },
        alignItems: 'center',
      }}
    >
      {/* Cover image */}
      <Box
        sx={{
          width: 80,
          height: 112,
          borderRadius: '8px',
          overflow: 'hidden',
          position: 'relative',
          flexShrink: 0,
          bgcolor: tokens.colors.surfaces.light.variant,
          filter: isCompleted ? 'grayscale(40%)' : 'none',
        }}
      >
        {item.cover_url ? (
          <Box
            component="img"
            src={item.cover_url}
            alt={item.title}
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <Box
            sx={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `linear-gradient(135deg, ${tokens.colors.primaryLight}40, ${tokens.colors.surfaces.light.variant})`,
            }}
          >
            {isAudio ? (
              <HeadphonesOutlined sx={{ fontSize: 32, color: tokens.colors.primary, opacity: 0.6 }} />
            ) : (
              <MenuBookOutlined sx={{ fontSize: 32, color: tokens.colors.primary, opacity: 0.6 }} />
            )}
          </Box>
        )}

        {/* Progress bar overlay at bottom of cover */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 6,
            bgcolor: 'rgba(0,0,0,0.15)',
          }}
        >
          <Box
            sx={{
              height: '100%',
              width: `${item.progress_percent}%`,
              bgcolor: progressColor,
              borderRadius: '0 3px 3px 0',
            }}
          />
        </Box>

        {/* Audio badge */}
        {isAudio && (
          <Box
            sx={{
              position: 'absolute',
              top: 4,
              right: 4,
              bgcolor: 'rgba(0,0,0,0.65)',
              borderRadius: '4px',
              px: 0.5,
              py: 0.25,
              display: 'flex',
              alignItems: 'center',
              gap: 0.25,
            }}
          >
            <GraphicEqOutlined sx={{ fontSize: 12, color: '#fff' }} />
            <Typography sx={{ fontSize: '0.6rem', color: '#fff', fontWeight: 600, lineHeight: 1 }}>
              Audio
            </Typography>
          </Box>
        )}

        {/* Completed check badge */}
        {isCompleted && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 10,
              right: 4,
              width: 22,
              height: 22,
              borderRadius: '50%',
              bgcolor: tokens.colors.semantic.success,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckOutlined sx={{ fontSize: 14, color: '#fff' }} />
          </Box>
        )}
      </Box>

      {/* Center content */}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {/* Title + Author */}
        <Box>
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: '0.95rem',
              color: tokens.colors.onBackground.light,
              lineHeight: 1.3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item.title}
          </Typography>
          <Typography
            sx={{
              fontSize: '0.8rem',
              color: '#9c7e49',
              lineHeight: 1.3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item.author}
          </Typography>
        </Box>

        {/* Status chip */}
        <Box>
          <Chip
            label={chipCfg.label}
            size="small"
            sx={{
              height: 22,
              fontSize: '0.65rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              bgcolor: chipCfg.bg,
              color: chipCfg.color,
              border: 'none',
              borderRadius: '6px',
            }}
          />
        </Box>

        {/* Progress bar + percentage */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ flex: 1, height: 6, bgcolor: '#F0EAE0', borderRadius: '3px', overflow: 'hidden' }}>
            <Box
              sx={{
                height: '100%',
                width: `${item.progress_percent}%`,
                bgcolor: progressColor,
                borderRadius: '3px',
                transition: 'width 0.3s ease',
              }}
            />
          </Box>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: tokens.colors.onBackground.light, minWidth: 32 }}>
            {item.progress_percent}%
          </Typography>
        </Box>

        {/* Metadata row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <ScheduleOutlined sx={{ fontSize: 14, color: '#9c7e49' }} />
            <Typography sx={{ fontSize: '0.72rem', color: '#9c7e49' }}>
              {timeAgo(item.last_read_at)}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {isAudio ? (
              <HeadphonesOutlined sx={{ fontSize: 14, color: '#9c7e49' }} />
            ) : (
              <TextFieldsOutlined sx={{ fontSize: 14, color: '#9c7e49' }} />
            )}
            <Typography sx={{ fontSize: '0.72rem', color: '#9c7e49' }}>
              {isAudio ? 'Audiobook' : 'Lecture'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <TimelapseOutlined sx={{ fontSize: 14, color: '#9c7e49' }} />
            <Typography sx={{ fontSize: '0.72rem', color: '#9c7e49' }}>
              {formatTotalTime(item.total_time_seconds)}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Right: Action button */}
      <Box
        className="history-action-btn"
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
          opacity: { xs: 1, md: 0 },
          transition: 'opacity 0.2s ease',
        }}
      >
        <Button
          variant="contained"
          disableElevation
          startIcon={<ActionIcon sx={{ fontSize: 18 }} />}
          onClick={handleAction}
          sx={{
            bgcolor: actionBg,
            color: actionColor,
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.8rem',
            borderRadius: '10px',
            px: 2,
            py: 0.8,
            whiteSpace: 'nowrap',
            '&:hover': {
              bgcolor: actionBg === tokens.colors.primary
                ? tokens.colors.primaryDark
                : tokens.colors.surfaces.light.variant,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            },
          }}
        >
          {actionLabel}
        </Button>
      </Box>
    </Paper>
  );
}

/* ------------------------------------------------------------------ */
/*  HistoryPage                                                        */
/* ------------------------------------------------------------------ */

export default function HistoryPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all' | 'books' | 'audio'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'in_progress' | 'completed'
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  // Load user
  useEffect(() => {
    authService.getUser().then((u) => {
      setUser(u);
      if (!u) navigate('/login');
    });
  }, [navigate]);

  // Load history + stats in parallel
  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      setStatsLoading(true);
      setError(null);
      const [historyRes, statsRes] = await Promise.allSettled([
        authFetch(`${API_URL}/reading-history?page=1&limit=20`),
        authFetch(`${API_URL}/reading-history/stats`),
      ]);

      // History
      try {
        if (historyRes.status === 'fulfilled' && historyRes.value.ok) {
          const data = await historyRes.value.json();
          const items = Array.isArray(data?.data) ? data.data : [];
          setHistory(items.map(normalizeHistoryItem));
          setPage(1);
          setHasMore((data?.pagination?.total_pages || 1) > 1);
        } else {
          setHistory([]);
          setError("Impossible de charger l'historique.");
        }
      } catch (err) {
        console.warn('Failed to load history:', err.message);
        setHistory([]);
        setError("Impossible de charger l'historique.");
      } finally {
        setLoading(false);
      }

      // Stats
      try {
        if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
          const sd = await statsRes.value.json();
          setStats(sd?.data || null);
        }
      } catch (e) { console.error('loadStats:', e); }
      finally {
        setStatsLoading(false);
      }
    }
    loadAll();
  }, []);

  // Load more
  const handleLoadMore = async () => {
    if (!hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const response = await authFetch(`${API_URL}/reading-history?page=${nextPage}&limit=20`);
      if (response.ok) {
        const data = await response.json();
        const items = Array.isArray(data?.data) ? data.data : [];
        if (Array.isArray(items) && items.length > 0) {
          setHistory((prev) => [...prev, ...items.map(normalizeHistoryItem)]);
          setPage(nextPage);
        }
        setHasMore(nextPage < Number(data?.pagination?.total_pages || nextPage));
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.warn('Failed to load more history:', err.message);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  };

  // Clear all history
  const handleClearAll = async () => {
    setClearDialogOpen(false);
    setClearing(true);
    try {
      const res = await authFetch(`${API_URL}/reading-history`, { method: 'DELETE' });
      if (res.ok) {
        setHistory([]);
        setStats(null);
        setHasMore(false);
      } else {
        setError("Impossible d'effacer l'historique. Réessayez.");
      }
    } catch (err) {
      console.warn('Clear history error:', err.message);
      setError("Impossible d'effacer l'historique. Réessayez.");
    } finally {
      setClearing(false);
    }
  };

  // Filtered + searched items
  const filteredHistory = useMemo(() => {
    let items = history;

    // Type filter
    if (filter === 'books') {
      items = items.filter((i) => i.content_type === 'ebook');
    } else if (filter === 'audio') {
      items = items.filter((i) => i.content_type === 'audiobook');
    }

    // Status filter
    if (statusFilter === 'in_progress') {
      items = items.filter((i) => i.status === 'in_progress' || i.status === 'paused');
    } else if (statusFilter === 'completed') {
      items = items.filter((i) => i.status === 'completed');
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter(
        (i) =>
          i.title?.toLowerCase().includes(q) ||
          i.author?.toLowerCase().includes(q)
      );
    }

    return items;
  }, [history, filter, statusFilter, searchQuery]);

  // Group by time period
  const groupedHistory = useMemo(() => groupByTimePeriod(filteredHistory), [filteredHistory]);

  // Filter tabs config
  const typeFilters = [
    { key: 'all', label: 'Tout' },
    { key: 'books', label: 'Livres' },
    { key: 'audio', label: 'Audio' },
  ];

  const statusFilters = [
    { key: 'in_progress', label: 'En cours' },
    { key: 'completed', label: 'Terminé' },
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: tokens.colors.backgrounds.light, display: 'flex' }}>
      <UserSpaceSidebar user={user} activeKey="stats" />

      <Box sx={{ flex: 1 }}>
      {/* Main content */}
      <Box sx={{ maxWidth: 960, mx: 'auto', px: { xs: 2, md: 4 }, py: 4 }}>
        {/* Page heading area */}
        <Box
          sx={{
            display: 'flex',
            alignItems: { xs: 'flex-start', sm: 'center' },
            justifyContent: 'space-between',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 2,
            pb: 3,
            borderBottom: `1px solid ${tokens.colors.surfaces.light.variant}`,
            mb: 3,
          }}
        >
          <Box>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                fontFamily: '"Newsreader", Georgia, serif',
                fontSize: { xs: '2rem', md: '2.8rem' },
                color: tokens.colors.onBackground.light,
                letterSpacing: '-0.033em',
                lineHeight: 1.2,
              }}
            >
              Historique de Lecture
            </Typography>
            <Typography
              sx={{
                fontSize: '0.95rem',
                color: '#9c7e49',
                mt: 0.5,
              }}
            >
              Reprenez l&agrave; o&ugrave; vous vous &ecirc;tes arr&ecirc;t&eacute;.
            </Typography>
          </Box>

          <Button
            variant="text"
            startIcon={clearing ? <CircularProgress size={16} sx={{ color: tokens.colors.semantic.error }} /> : <DeleteSweepOutlined />}
            onClick={() => setClearDialogOpen(true)}
            disabled={clearing}
            sx={{
              color: '#9c7e49',
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.85rem',
              borderRadius: '10px',
              px: 2,
              '&:hover': {
                bgcolor: `${tokens.colors.semantic.error}10`,
                color: tokens.colors.semantic.error,
              },
            }}
          >
            {clearing ? 'Suppression...' : 'Tout effacer'}
          </Button>
        </Box>

        {/* Stats banner */}
        {(stats || statsLoading) && (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 4 }}>
            {[
              {
                icon: <MenuBookOutlined sx={{ fontSize: 22, color: tokens.colors.primary }} />,
                label: 'Livres lus',
                value: statsLoading ? '—' : (stats?.total_books ?? 0),
                sub: statsLoading ? '' : `${stats?.completed ?? 0} terminés`,
              },
              {
                icon: <TimelapseOutlined sx={{ fontSize: 22, color: '#5E8A6E' }} />,
                label: 'Temps total',
                value: statsLoading ? '—' : formatTotalTime(stats?.total_time_seconds),
                sub: statsLoading ? '' : `dont ${formatTotalTime(stats?.audio_time_seconds)} audio`,
              },
              {
                icon: <LocalFireDepartmentOutlined sx={{ fontSize: 22, color: '#E65100' }} />,
                label: 'Série actuelle',
                value: statsLoading ? '—' : `${stats?.streak_days ?? 0}j`,
                sub: 'jours consécutifs',
              },
              {
                icon: <DonutLargeOutlined sx={{ fontSize: 22, color: tokens.colors.secondary }} />,
                label: 'Taux de complétion',
                value: statsLoading ? '—' : `${stats?.completion_rate ?? 0}%`,
                sub: statsLoading ? '' : `${stats?.in_progress ?? 0} en cours`,
              },
            ].map((card) => (
              <Paper
                key={card.label}
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: '16px',
                  border: `1px solid ${tokens.colors.surfaces.light.variant}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.5,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  {card.icon}
                  <Typography sx={{ fontSize: '0.75rem', color: '#9c7e49', fontWeight: 600 }}>
                    {card.label}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: '1.6rem', fontWeight: 800, color: tokens.colors.onBackground.light, lineHeight: 1 }}>
                  {card.value}
                </Typography>
                <Typography sx={{ fontSize: '0.72rem', color: '#9c7e49' }}>
                  {card.sub}
                </Typography>
              </Paper>
            ))}
          </Box>
        )}

        {/* Activity chart — 30-day bar chart */}
        {stats?.daily_activity?.length > 0 && (
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              mb: 4,
              borderRadius: '16px',
              border: `1px solid ${tokens.colors.surfaces.light.variant}`,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <CalendarMonthOutlined sx={{ fontSize: 18, color: tokens.colors.primary }} />
              <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: tokens.colors.onBackground.light }}>
                Activité — 30 derniers jours
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: 56 }}>
              {(() => {
                const maxCount = Math.max(...stats.daily_activity.map((d) => d.count), 1);
                return stats.daily_activity.map((day) => {
                const heightPct = day.count > 0 ? Math.max(10, (day.count / maxCount) * 100) : 3;
                const isToday = day.date === new Date().toISOString().slice(0, 10);
                return (
                  <Box
                    key={day.date}
                    title={`${day.date}: ${day.count} lecture(s)`}
                    sx={{
                      flex: 1,
                      height: `${heightPct}%`,
                      bgcolor: day.count > 0 ? tokens.colors.primary : tokens.colors.surfaces.light.variant,
                      borderRadius: '3px 3px 0 0',
                      opacity: isToday ? 1 : day.count > 0 ? 0.75 : 0.4,
                      cursor: 'default',
                      transition: 'opacity 0.15s',
                      '&:hover': { opacity: 1 },
                      outline: isToday ? `2px solid ${tokens.colors.primary}` : 'none',
                    }}
                  />
                );
              });
              })()}
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
              <Typography sx={{ fontSize: '0.65rem', color: '#9c7e49' }}>
                {stats.daily_activity[0]?.date}
              </Typography>
              <Typography sx={{ fontSize: '0.65rem', color: '#9c7e49' }}>
                Aujourd'hui
              </Typography>
            </Box>
          </Paper>
        )}

        {/* Filters row */}
        <Box
          sx={{
            display: 'flex',
            alignItems: { xs: 'stretch', md: 'center' },
            flexDirection: { xs: 'column', md: 'row' },
            gap: 2,
            mb: 4,
          }}
        >
          {/* Type filter toggle group */}
          <Box
            sx={{
              display: 'flex',
              bgcolor: tokens.colors.surfaces.light.variant,
              borderRadius: '12px',
              p: 0.5,
              gap: 0.5,
            }}
          >
            {typeFilters.map((tf) => (
              <Button
                key={tf.key}
                onClick={() => setFilter(tf.key)}
                disableElevation
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  borderRadius: '8px',
                  px: 2,
                  py: 0.75,
                  minWidth: 'auto',
                  bgcolor: filter === tf.key ? '#FFFFFF' : 'transparent',
                  color: filter === tf.key ? tokens.colors.primary : '#9c7e49',
                  boxShadow: filter === tf.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  '&:hover': {
                    bgcolor: filter === tf.key ? '#FFFFFF' : 'rgba(255,255,255,0.5)',
                  },
                }}
              >
                {tf.label}
              </Button>
            ))}
          </Box>

          {/* Separator */}
          <Box
            sx={{
              display: { xs: 'none', md: 'block' },
              width: 1,
              height: 24,
              bgcolor: tokens.colors.surfaces.light.variant,
            }}
          />

          {/* Status chips */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            {statusFilters.map((sf) => (
              <Button
                key={sf.key}
                variant="outlined"
                onClick={() =>
                  setStatusFilter(statusFilter === sf.key ? 'all' : sf.key)
                }
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  borderRadius: '20px',
                  px: 2,
                  py: 0.5,
                  borderColor:
                    statusFilter === sf.key
                      ? tokens.colors.primary
                      : tokens.colors.surfaces.light.variant,
                  color:
                    statusFilter === sf.key
                      ? tokens.colors.primary
                      : '#9c7e49',
                  bgcolor:
                    statusFilter === sf.key
                      ? `${tokens.colors.primary}10`
                      : 'transparent',
                  '&:hover': {
                    borderColor: tokens.colors.primary,
                    bgcolor: `${tokens.colors.primary}08`,
                  },
                }}
              >
                {sf.label}
              </Button>
            ))}
          </Box>

          {/* Search input */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              bgcolor: tokens.colors.surfaces.light.variant,
              borderRadius: '12px',
              px: 2,
              height: 40,
              ml: { md: 'auto' },
              minWidth: { xs: '100%', md: 220 },
              maxWidth: { md: 280 },
            }}
          >
            <SearchIcon sx={{ color: '#9c7e49', fontSize: 20, mr: 1 }} />
            <InputBase
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{
                fontSize: '0.85rem',
                color: tokens.colors.onBackground.light,
                flex: 1,
              }}
            />
          </Box>
        </Box>

        {/* Loading state */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress sx={{ color: tokens.colors.primary }} />
          </Box>
        )}

        {/* Error state */}
        {error && !loading && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography sx={{ color: tokens.colors.semantic.error, mb: 2 }}>
              {error}
            </Typography>
            <Button
              variant="outlined"
              onClick={() => window.location.reload()}
              sx={{
                borderColor: tokens.colors.primary,
                color: tokens.colors.primary,
                textTransform: 'none',
              }}
            >
              Réessayer
            </Button>
          </Box>
        )}

        {/* Empty state */}
        {!loading && !error && filteredHistory.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <MenuBookOutlined
              sx={{ fontSize: 64, color: tokens.colors.surfaces.light.variant, mb: 2 }}
            />
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: '1.1rem',
                color: tokens.colors.onBackground.light,
                mb: 1,
              }}
            >
              {searchQuery || filter !== 'all' || statusFilter !== 'all'
                ? 'Aucun résultat trouvé'
                : 'Votre historique est vide'}
            </Typography>
            <Typography sx={{ fontSize: '0.9rem', color: '#9c7e49' }}>
              {searchQuery || filter !== 'all' || statusFilter !== 'all'
                ? 'Essayez de modifier vos filtres.'
                : 'Commencez à lire pour voir votre historique ici.'}
            </Typography>
          </Box>
        )}

        {/* Timeline sections */}
        {!loading &&
          !error &&
          filteredHistory.length > 0 &&
          Object.entries(groupedHistory).map(
            ([period, items]) =>
              items.length > 0 && (
                <Box key={period} sx={{ mb: 4 }}>
                  {/* Section heading */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      mb: 2,
                      opacity: sectionOpacity[period] || 0.6,
                    }}
                  >
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: tokens.colors.primary,
                        flexShrink: 0,
                      }}
                    />
                    <Typography
                      sx={{
                        fontWeight: 700,
                        fontSize: '1rem',
                        color: tokens.colors.onBackground.light,
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {period}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: '0.78rem',
                        color: '#9c7e49',
                        ml: 0.5,
                      }}
                    >
                      ({items.length})
                    </Typography>
                  </Box>

                  {/* History cards */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pl: { xs: 0, md: 2.5 } }}>
                    {items.map((item) => (
                      <HistoryCard key={item.id} item={item} />
                    ))}
                  </Box>
                </Box>
              )
          )}

        {/* Load more button */}
        {!loading && filteredHistory.length > 0 && hasMore && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, mb: 6 }}>
            <Button
              variant="outlined"
              startIcon={
                loadingMore ? (
                  <CircularProgress size={16} sx={{ color: tokens.colors.primary }} />
                ) : (
                  <RefreshOutlined />
                )
              }
              onClick={handleLoadMore}
              disabled={loadingMore}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.85rem',
                borderRadius: '12px',
                px: 3,
                py: 1,
                borderColor: tokens.colors.surfaces.light.variant,
                color: tokens.colors.onBackground.light,
                '&:hover': {
                  borderColor: tokens.colors.primary,
                  bgcolor: `${tokens.colors.primary}08`,
                },
              }}
            >
              {loadingMore ? 'Chargement...' : "Charger plus d'historique"}
            </Button>
          </Box>
        )}
      </Box>
      </Box>

      {/* Clear all confirmation dialog */}
      <Dialog
        open={clearDialogOpen}
        onClose={() => setClearDialogOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: '16px',
            p: 1,
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: tokens.colors.onBackground.light }}>
          Effacer l&apos;historique ?
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: '#9c7e49' }}>
            Cette action supprimera tout votre historique de lecture. Cette action est irr&eacute;versible.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setClearDialogOpen(false)}
            sx={{
              textTransform: 'none',
              color: '#9c7e49',
              fontWeight: 600,
            }}
          >
            Annuler
          </Button>
          <Button
            onClick={handleClearAll}
            variant="contained"
            disableElevation
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              bgcolor: tokens.colors.semantic.error,
              borderRadius: '10px',
              '&:hover': {
                bgcolor: '#A03E3B',
              },
            }}
          >
            Effacer tout
          </Button>
        </DialogActions>
      </Dialog>
      <MobileBottomNav />
    </Box>
  );
}
