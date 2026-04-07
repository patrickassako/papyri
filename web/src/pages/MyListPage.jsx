import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  IconButton,
  InputBase,
  Paper,
  LinearProgress,
  Grid,
} from '@mui/material';
import FavoriteOutlined from '@mui/icons-material/FavoriteOutlined';
import PlayCircleOutlineOutlined from '@mui/icons-material/PlayCircleOutlineOutlined';
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import MenuBookOutlined from '@mui/icons-material/MenuBookOutlined';
import GridViewOutlined from '@mui/icons-material/GridViewOutlined';
import ListOutlined from '@mui/icons-material/ViewListOutlined';
import SearchIcon from '@mui/icons-material/Search';
import TuneOutlined from '@mui/icons-material/TuneOutlined';
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined';
import LocalFireDepartmentOutlined from '@mui/icons-material/LocalFireDepartmentOutlined';
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined';

import tokens from '../config/tokens';
import * as authService from '../services/auth.service';
import { authFetch } from '../services/auth.service';
import { subscriptionsService } from '../services/subscriptions.service';
import UserSpaceSidebar from '../components/UserSpaceSidebar';
import MobileBottomNav from '../components/MobileBottomNav';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const primary = tokens.colors.primary;
const secondary = tokens.colors.secondary;
const bgLight = tokens.colors.backgrounds.light;
const surfaceDefault = tokens.colors.surfaces.light.default;
const surfaceVariant = tokens.colors.surfaces.light.variant;
const textMain = tokens.colors.onBackground.light;
const textMuted = '#9c7e49';

const safeJson = async (response) => response.json().catch(() => ({}));

function dayKey(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function buildReadingStats(history) {
  const now = new Date();
  const todayKey = dayKey(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const activeDays = new Set();
  let todaySeconds = 0;
  let monthlyCompleted = 0;

  history.forEach((item) => {
    const k = dayKey(item.last_read_at);
    if (k) activeDays.add(k);
    if (k && k === todayKey) {
      todaySeconds += Number(item.total_time_seconds || 0);
    }
    const progress = Number(item.progress_percent || 0);
    const completed = Boolean(item.is_completed) || progress >= 100;
    const completedAt = item.completed_at ? new Date(item.completed_at) : (item.last_read_at ? new Date(item.last_read_at) : null);
    if (completed && completedAt && !Number.isNaN(completedAt.getTime()) && completedAt >= monthStart) {
      monthlyCompleted += 1;
    }
  });

  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  while (activeDays.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return {
    todayMinutes: Math.round(todaySeconds / 60),
    streakDays: streak,
    monthlyGoalPercent: Math.min(100, Math.round((monthlyCompleted / 5) * 100)),
  };
}

function getReadRoute(item) {
  const id = item.content_id || item.id;
  const fmt = String(item.format || '').toLowerCase();
  const isAudio = String(item.content_type || '').toLowerCase() === 'audiobook'
    || ['mp3', 'm4a'].includes(fmt);
  if (isAudio) return `/listen/${id}`;
  if (fmt === 'pdf') return `/pdf/${id}`;
  return `/read/${id}`;
}

function getItemRoute(item) {
  const progress = Number(item.progress_percent || 0);
  if (progress > 0) return getReadRoute(item);
  const id = item.content_id || item.id;
  return `/catalogue/${id}`;
}

export default function MyListPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [subscriptionLabel, setSubscriptionLabel] = useState('Chargement de l abonnement...');
  const [history, setHistory] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [viewMode, setViewMode] = useState('grid');
  const [activeFilter, setActiveFilter] = useState('favoris');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let alive = true;
    const loadData = async () => {
      try {
        const u = await authService.getUser();
        if (alive) setUser(u);

        try {
          const sub = await subscriptionsService.getMySubscription();
          if (!alive) return;
          const subscription = sub?.subscription || null;
          const isActive = sub?.isActive === true;
          const cancelAtPeriodEnd = Boolean(subscription?.cancel_at_period_end);
          const endDate = subscription?.current_period_end
            ? new Date(subscription.current_period_end).toLocaleDateString('fr-FR')
            : '';

          if (isActive && cancelAtPeriodEnd && endDate) {
            setSubscriptionLabel(`Resilie, acces jusqu au ${endDate}`);
          } else if (isActive && endDate) {
            setSubscriptionLabel(`Actif jusqu au ${endDate}`);
          } else if (isActive) {
            setSubscriptionLabel('Abonnement actif');
          } else {
            setSubscriptionLabel('Aucun abonnement actif');
          }
        } catch (_) {
          if (alive) setSubscriptionLabel('Aucun abonnement actif');
        }

        const [historyRes, playlistRes, ebookListRes] = await Promise.allSettled([
          authFetch(`${API_URL}/reading-history?page=1&limit=100`),
          authFetch(`${API_URL}/api/reading/audio/playlist`),
          authFetch(`${API_URL}/api/reading/ebook/list`),
        ]);

        let historyItems = [];
        if (historyRes.status === 'fulfilled' && historyRes.value.ok) {
          const payload = await safeJson(historyRes.value);
          historyItems = Array.isArray(payload?.data) ? payload.data : [];
          if (alive) setHistory(historyItems);
        }

        const combinedFavorites = [];
        const seenIds = new Set();

        // Audio playlist
        if (playlistRes.status === 'fulfilled' && playlistRes.value.ok) {
          const payload = await safeJson(playlistRes.value);
          const items = Array.isArray(payload?.data?.items) ? payload.data.items : [];
          items
            .map((row) => ({
              id: row?.content?.id || row?.content_id,
              content_id: row?.content_id || row?.content?.id,
              title: row?.content?.title || 'Titre inconnu',
              author: row?.content?.author || 'Auteur inconnu',
              cover_url: row?.content?.cover_url || null,
              content_type: row?.content?.content_type || null,
              format: row?.content?.format || null,
              progress_percent: Number(row?.progress?.progress_percent || 0),
            }))
            .filter((item) => item.id)
            .forEach((item) => {
              if (!seenIds.has(item.id)) {
                seenIds.add(item.id);
                combinedFavorites.push(item);
              }
            });
        }

        // Ebook reading list
        if (ebookListRes.status === 'fulfilled' && ebookListRes.value.ok) {
          const payload = await safeJson(ebookListRes.value);
          const items = Array.isArray(payload?.data?.items) ? payload.data.items : [];
          items
            .map((item) => ({
              id: item.id,
              content_id: item.id,
              title: item.title || 'Titre inconnu',
              author: item.author || 'Auteur inconnu',
              cover_url: item.cover_url || null,
              content_type: item.content_type || null,
              format: null,
              progress_percent: 0,
            }))
            .filter((item) => item.id)
            .forEach((item) => {
              if (!seenIds.has(item.id)) {
                seenIds.add(item.id);
                combinedFavorites.push(item);
              }
            });
        }

        if (alive) {
          if (combinedFavorites.length > 0) {
            setFavorites(combinedFavorites);
          } else {
            // Fallback: use recent reading items
            setFavorites(historyItems.slice(0, 12));
          }
        }

        const catalogRes = await authFetch(`${API_URL}/api/contents?page=1&limit=12&sort=newest`);
        if (catalogRes.ok) {
          const payload = await safeJson(catalogRes);
          const rawItems = payload?.data?.contents || payload?.data || [];
          if (alive && Array.isArray(rawItems)) {
            const mappedCatalog = rawItems.map((item) => ({
              id: item.id,
              content_id: item.id,
              title: item.title || 'Titre inconnu',
              author: item.author || 'Auteur inconnu',
              cover_url: item.cover_url || null,
              content_type: item.content_type || null,
              format: item.format || null,
            }));
            setCatalogItems(mappedCatalog);
          }
        }
      } catch (err) {
        console.error('Failed to load My List data:', err);
      }
    };

    loadData();
    return () => { alive = false; };
  }, []);

  const inProgress = useMemo(
    () => history.filter((item) => {
      const p = Number(item.progress_percent || 0);
      return p > 0 && p < 100;
    }),
    [history]
  );

  const completed = useMemo(
    () => history.filter((item) => Boolean(item.is_completed) || Number(item.progress_percent || 0) >= 100),
    [history]
  );

  const stats = useMemo(() => buildReadingStats(history), [history]);

  const smartFilters = [
    { key: 'favoris', label: 'Favoris', icon: <FavoriteOutlined fontSize="small" /> },
    { key: 'en_cours', label: 'En cours', icon: <PlayCircleOutlineOutlined fontSize="small" /> },
    { key: 'termines', label: 'Terminés', icon: <CheckCircleOutlined fontSize="small" /> },
  ];

  const allItems = useMemo(() => {
    if (activeFilter === 'en_cours') return inProgress;
    if (activeFilter === 'termines') return completed;
    return favorites;
  }, [activeFilter, favorites, inProgress, completed]);

  const visibleItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter((item) => {
      const title = String(item.title || '').toLowerCase();
      const author = String(item.author || '').toLowerCase();
      return title.includes(q) || author.includes(q);
    });
  }, [allItems, searchQuery]);

  const continueItems = useMemo(() => {
    const byRecent = (a, b) => new Date(b.last_read_at || 0).getTime() - new Date(a.last_read_at || 0).getTime();
    const keyOf = (item) => String(item.content_id || item.id);
    const isAudio = (item) => String(item.content_type || '').toLowerCase() === 'audiobook'
      || ['mp3', 'm4a'].includes(String(item.format || '').toLowerCase());

    const inProgressSorted = [...inProgress].sort(byRecent);
    const audioItems = inProgressSorted.filter(isAudio);
    const textItems = inProgressSorted.filter((item) => !isAudio(item));

    const picked = [];
    const pickedKeys = new Set();
    const pushUnique = (item) => {
      const k = keyOf(item);
      if (!pickedKeys.has(k)) {
        picked.push(item);
        pickedKeys.add(k);
      }
    };

    if (audioItems[0]) pushUnique(audioItems[0]);
    if (textItems[0]) pushUnique(textItems[0]);
    inProgressSorted.forEach((item) => {
      if (picked.length < 3) pushUnique(item);
    });

    // Fallback 1: compléter avec favoris/playlist (souvent audio)
    if (picked.length < 3) {
      favorites
        .slice()
        .sort(byRecent)
        .forEach((item) => {
          if (picked.length < 3) pushUnique(item);
        });
    }

    // Fallback 2: compléter avec historique global récent
    if (picked.length < 3) {
      history
        .slice()
        .sort(byRecent)
        .forEach((item) => {
          if (picked.length < 3) pushUnique(item);
        });
    }

    return picked.slice(0, 3);
  }, [inProgress, favorites, history]);

  const BookCover = ({ coverUrl, width = 80, height = 112 }) => (
    coverUrl ? (
      <Box component="img" src={coverUrl} alt="Couverture" sx={{ width, height, borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
    ) : (
      <Box sx={{ width, height, borderRadius: '8px', bgcolor: surfaceVariant, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <MenuBookOutlined sx={{ fontSize: 32, color: textMuted }} />
      </Box>
    )
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: bgLight, display: 'flex' }}>
      <UserSpaceSidebar user={user} activeKey="library" subscriptionLabel={subscriptionLabel} />

      <Box sx={{ flex: 1 }}>
        <Box sx={{ display: 'flex', maxWidth: 1440, mx: 'auto', px: { xs: 1.25, sm: 2, md: 3 }, py: { xs: 1.5, md: 3 }, gap: 3 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, gap: 1 }}>
              <Typography
                variant="h1"
                sx={{
                  fontFamily: '"Newsreader", Georgia, serif',
                  fontSize: { xs: '1.9rem', sm: '2.2rem', md: '3.1rem' },
                  fontWeight: 800,
                  color: textMain,
                  lineHeight: 1.2,
                  letterSpacing: '-0.033em',
                }}
              >
                Ma Liste
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <IconButton onClick={() => setViewMode('grid')} sx={{ color: viewMode === 'grid' ? primary : textMuted, bgcolor: viewMode === 'grid' ? `${primary}1A` : 'transparent', borderRadius: '10px' }}>
                  <GridViewOutlined />
                </IconButton>
                <IconButton onClick={() => setViewMode('list')} sx={{ color: viewMode === 'list' ? primary : textMuted, bgcolor: viewMode === 'list' ? `${primary}1A` : 'transparent', borderRadius: '10px' }}>
                  <ListOutlined />
                </IconButton>
              </Box>
            </Box>
            <Typography sx={{ fontSize: '1rem', color: textMuted }}>Gérez votre bibliothèque numérique personnelle</Typography>
          </Box>

          <Box sx={{ display: { xs: 'grid', lg: 'none' }, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1.2, mb: 2.5 }}>
            <Paper elevation={0} sx={{ p: 1.3, borderRadius: '12px', border: `1px solid ${surfaceVariant}` }}>
              <Typography sx={{ fontSize: '0.66rem', color: textMuted, textTransform: 'uppercase', letterSpacing: 0.45, fontWeight: 700 }}>
                Aujourd hui
              </Typography>
              <Typography sx={{ mt: 0.35, fontWeight: 800, fontSize: '1rem', color: textMain }}>
                {stats.todayMinutes} min
              </Typography>
            </Paper>
            <Paper elevation={0} sx={{ p: 1.3, borderRadius: '12px', border: `1px solid ${surfaceVariant}` }}>
              <Typography sx={{ fontSize: '0.66rem', color: textMuted, textTransform: 'uppercase', letterSpacing: 0.45, fontWeight: 700 }}>
                Serie
              </Typography>
              <Typography sx={{ mt: 0.35, fontWeight: 800, fontSize: '1rem', color: secondary }}>
                {stats.streakDays} j
              </Typography>
            </Paper>
            <Paper elevation={0} sx={{ p: 1.3, borderRadius: '12px', border: `1px solid ${surfaceVariant}` }}>
              <Typography sx={{ fontSize: '0.66rem', color: textMuted, textTransform: 'uppercase', letterSpacing: 0.45, fontWeight: 700 }}>
                Statut
              </Typography>
              <Typography sx={{ mt: 0.35, fontWeight: 800, fontSize: '0.86rem', color: primary, lineHeight: 1.2 }}>
                {subscriptionLabel}
              </Typography>
            </Paper>
          </Box>

          <Box sx={{ display: 'flex', gap: 1.5, mb: 3, alignItems: 'stretch' }}>
            <Box sx={{ flex: 1, bgcolor: surfaceVariant, borderRadius: '12px', height: 48, display: 'flex', alignItems: 'center', px: 2 }}>
              <SearchIcon sx={{ color: textMuted, mr: 1.5 }} />
              <InputBase
                placeholder="Rechercher dans ma liste..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={{ flex: 1, fontSize: '0.95rem', color: textMain, '& input::placeholder': { color: textMuted, opacity: 1 } }}
              />
            </Box>
            <IconButton sx={{ bgcolor: surfaceVariant, borderRadius: '12px', width: 48, height: 48, color: textMain, flexShrink: 0, '&:hover': { bgcolor: `${primary}22` } }}>
              <TuneOutlined />
            </IconButton>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
            {smartFilters.map((filter) => {
              const isActive = activeFilter === filter.key;
              return (
                <Box
                  key={filter.key}
                  onClick={() => setActiveFilter(filter.key)}
                  sx={{
                    px: 1.5,
                    py: 1,
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    cursor: 'pointer',
                    bgcolor: isActive ? `${primary}1A` : surfaceVariant,
                    color: isActive ? primary : textMain,
                    '&:hover': { bgcolor: isActive ? `${primary}1A` : `${primary}12` },
                  }}
                >
                  {filter.icon}
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: isActive ? 700 : 500 }}>
                    {filter.label}
                  </Typography>
                </Box>
              );
            })}
          </Box>

          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, gap: 1 }}>
              <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: textMain }}>Reprendre la lecture</Typography>
              <Box onClick={() => navigate('/history')} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', color: primary, '&:hover': { textDecoration: 'underline' } }}>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>Tout voir</Typography>
                <ArrowForwardOutlined sx={{ fontSize: 16 }} />
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
              {continueItems.length > 0 ? continueItems.map((book) => (
                <Paper
                  key={book.id}
                  elevation={0}
                  onClick={() => navigate(getReadRoute(book))}
                  sx={{
                    p: 2,
                    borderRadius: '16px',
                    flex: 1,
                    display: 'flex',
                    gap: 2,
                    border: `1px solid ${surfaceVariant}`,
                    cursor: 'pointer',
                    '&:hover': { borderColor: primary, boxShadow: `0 4px 16px ${primary}15` },
                  }}
                >
                  <BookCover coverUrl={book.cover_url} width={80} height={112} />
                  <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: textMain, mb: 0.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {book.title}
                    </Typography>
                    <Typography sx={{ fontSize: '0.8rem', color: textMuted, mb: 1.5 }}>{book.author}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <LinearProgress
                        variant="determinate"
                        value={Number(book.progress_percent || 0)}
                        sx={{
                          flex: 1,
                          height: 6,
                          borderRadius: 3,
                          bgcolor: surfaceVariant,
                          '& .MuiLinearProgress-bar': { borderRadius: 3, bgcolor: primary },
                        }}
                      />
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: primary, flexShrink: 0 }}>
                        {Math.round(Number(book.progress_percent || 0))}%
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              )) : (
                <Paper elevation={0} sx={{ p: 2, borderRadius: '16px', border: `1px solid ${surfaceVariant}`, width: '100%' }}>
                  <Typography sx={{ color: textMuted, fontSize: '0.9rem' }}>Aucune lecture en cours.</Typography>
                </Paper>
              )}
            </Box>
          </Box>

          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: textMain }}>
                {activeFilter === 'termines' ? 'Terminés' : activeFilter === 'en_cours' ? 'En cours' : 'Mes Favoris'}
              </Typography>
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: primary }}>
                {visibleItems.length} titre{visibleItems.length > 1 ? 's' : ''}
              </Typography>
            </Box>

            <Grid container spacing={{ xs: 1.5, md: 2 }}>
              {visibleItems.map((book) => (
                <Grid size={{ xs: 6, sm: 4, md: 3 }} key={book.id}>
                  <Box
                    sx={{
                      cursor: 'pointer',
                      transition: 'all 0.25s ease',
                      '&:hover': { transform: 'translateY(-4px)' },
                    }}
                    onClick={() => navigate(getItemRoute(book))}
                  >
                    <Box sx={{ position: 'relative', aspectRatio: '2/3', borderRadius: '12px', overflow: 'hidden', mb: 1 }}>
                      {book.cover_url ? (
                        <Box component="img" src={book.cover_url} alt={book.title} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <Box sx={{ width: '100%', height: '100%', bgcolor: surfaceVariant, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <MenuBookOutlined sx={{ fontSize: 48, color: textMuted }} />
                        </Box>
                      )}
                    </Box>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', color: textMain, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {book.title}
                    </Typography>
                    <Typography sx={{ fontSize: '0.8rem', color: textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {book.author}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Box>

          <Box sx={{ mt: 5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: textMain }}>
                Catalogue complet
              </Typography>
              <Box
                onClick={() => navigate('/catalogue')}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  cursor: 'pointer',
                  color: primary,
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>Voir tout</Typography>
                <ArrowForwardOutlined sx={{ fontSize: 16 }} />
              </Box>
            </Box>

            <Grid container spacing={{ xs: 1.5, md: 2 }}>
              {catalogItems.map((book) => (
                <Grid size={{ xs: 6, sm: 4, md: 3 }} key={`catalog-${book.id}`}>
                  <Box
                    sx={{
                      cursor: 'pointer',
                      transition: 'all 0.25s ease',
                      '&:hover': { transform: 'translateY(-4px)' },
                    }}
                    onClick={() => navigate(`/catalogue/${book.content_id || book.id}`)}
                  >
                    <Box sx={{ position: 'relative', aspectRatio: '2/3', borderRadius: '12px', overflow: 'hidden', mb: 1 }}>
                      {book.cover_url ? (
                        <Box component="img" src={book.cover_url} alt={book.title} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <Box sx={{ width: '100%', height: '100%', bgcolor: surfaceVariant, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <MenuBookOutlined sx={{ fontSize: 48, color: textMuted }} />
                        </Box>
                      )}
                    </Box>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', color: textMain, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {book.title}
                    </Typography>
                    <Typography sx={{ fontSize: '0.8rem', color: textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {book.author}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Box>
        </Box>

        <Box sx={{ width: 280, flexShrink: 0, display: { xs: 'none', lg: 'block' } }}>
          <Box sx={{ position: 'sticky', top: 80, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: '16px', border: `1px solid ${surfaceVariant}` }}>
              <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: textMain, mb: 2 }}>Activité de lecture</Typography>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Box sx={{ width: 40, height: 40, borderRadius: '10px', bgcolor: `${primary}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ScheduleOutlined sx={{ color: primary, fontSize: 20 }} />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '0.75rem', color: textMuted }}>Temps aujourd&apos;hui</Typography>
                  <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: textMain }}>{stats.todayMinutes} min</Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Box sx={{ width: 40, height: 40, borderRadius: '10px', bgcolor: `${secondary}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <LocalFireDepartmentOutlined sx={{ color: secondary, fontSize: 20 }} />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '0.75rem', color: textMuted }}>Série actuelle</Typography>
                  <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: textMain }}>{stats.streakDays} jours</Typography>
                </Box>
              </Box>

              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                  <Typography sx={{ fontSize: '0.8rem', color: textMuted }}>Objectif du mois</Typography>
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: primary }}>{stats.monthlyGoalPercent}%</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={stats.monthlyGoalPercent}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    bgcolor: surfaceVariant,
                    '& .MuiLinearProgress-bar': { borderRadius: 4, bgcolor: primary },
                  }}
                />
              </Box>
            </Paper>
          </Box>
        </Box>
        </Box>
      </Box>
      <MobileBottomNav />
    </Box>
  );
}
