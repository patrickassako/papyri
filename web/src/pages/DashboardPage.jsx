import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Paper,
  LinearProgress,
  Chip,
  IconButton,
  Skeleton,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import HeadphonesOutlined from '@mui/icons-material/HeadphonesOutlined';
import MenuBookRounded from '@mui/icons-material/MenuBookRounded';
import WorkspacePremiumOutlined from '@mui/icons-material/WorkspacePremiumOutlined';
import MenuBookOutlined from '@mui/icons-material/MenuBookOutlined';
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined';
import LocalFireDepartmentOutlined from '@mui/icons-material/LocalFireDepartmentOutlined';
import TrackChangesOutlined from '@mui/icons-material/TrackChangesOutlined';

import tokens from '../config/tokens';
import * as authService from '../services/auth.service';
import { authFetch } from '../services/auth.service';
import { contentsService } from '../services/contents.service';
import UserSpaceSidebar from '../components/UserSpaceSidebar';
import MobileBottomNav from '../components/MobileBottomNav';
import { useCurrency } from '../hooks/useCurrency';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const emptyStats = {
  books_read: 0,
  hours_listened: 0,
  streak_days: 0,
  monthly_goal_percent: 0,
  total_hours: 0,
  monthly_books_done: 0,
  monthly_books_target: 5,
  weekly_hours_done: 0,
  weekly_hours_target: 7,
};

const safeJson = async (response) => response.json().catch(() => ({}));

function dayKey(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function buildWeekActivity(historyItems) {
  const now = new Date();
  const byDay = new Map();

  historyItems.forEach((item) => {
    const key = dayKey(item.last_read_at);
    if (!key) return;
    const seconds = Number(item.total_time_seconds || 0);
    byDay.set(key, (byDay.get(key) || 0) + seconds);
  });

  const values = [];
  const labels = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    const weekday = d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '');
    labels.push(weekday.charAt(0).toUpperCase());
    values.push(Number(((byDay.get(key) || 0) / 3600).toFixed(1)));
  }

  return { labels, values };
}

function computeStats(historyItems) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);

  const doneContentIds = new Set();
  let audioSeconds = 0;
  let totalSeconds = 0;
  let monthlyDone = 0;
  let weeklyHours = 0;
  const activityDays = new Set();

  historyItems.forEach((item) => {
    const progress = Number(item.progress_percent || 0);
    const isCompleted = Boolean(item.is_completed) || progress >= 100;
    const seconds = Number(item.total_time_seconds || 0);
    const readDate = item.last_read_at ? new Date(item.last_read_at) : null;
    const doneDate = item.completed_at ? new Date(item.completed_at) : readDate;

    if (isCompleted && item.content_id) {
      doneContentIds.add(item.content_id);
    }
    if (item.content_type === 'audiobook') {
      audioSeconds += seconds;
    }
    totalSeconds += seconds;

    if (isCompleted && doneDate && !Number.isNaN(doneDate.getTime()) && doneDate >= monthStart) {
      monthlyDone += 1;
    }
    if (readDate && !Number.isNaN(readDate.getTime()) && readDate >= weekStart) {
      weeklyHours += seconds / 3600;
      activityDays.add(dayKey(readDate));
    }
  });

  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  while (activityDays.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const monthlyTarget = 5;
  const weeklyTarget = 7;

  return {
    books_read: doneContentIds.size,
    hours_listened: Math.round(audioSeconds / 3600),
    streak_days: streak,
    monthly_goal_percent: Math.min(100, Math.round((monthlyDone / monthlyTarget) * 100)),
    total_hours: Math.round(totalSeconds / 3600),
    monthly_books_done: monthlyDone,
    monthly_books_target: monthlyTarget,
    weekly_hours_done: Number(weeklyHours.toFixed(1)),
    weekly_hours_target: weeklyTarget,
  };
}

function scroll(ref, direction) {
  if (!ref.current) return;
  ref.current.scrollBy({ left: direction * 280, behavior: 'smooth' });
}

function ContentCard({ book, onClick }) {
  const isAudio = String(book.content_type || '').toLowerCase() === 'audiobook'
    || ['mp3', 'm4a'].includes(String(book.format || '').toLowerCase());
  return (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        flexShrink: 0,
        width: { xs: '100%', sm: 130 },
        borderRadius: '10px',
        overflow: 'hidden',
        border: `1px solid ${tokens.colors.surfaces.light.variant}`,
        bgcolor: '#fff',
        cursor: 'pointer',
        transition: 'transform 0.18s, box-shadow 0.18s',
        '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 6px 20px rgba(0,0,0,0.09)' },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: { xs: 'auto', sm: 174 },
          aspectRatio: { xs: '3 / 4', sm: 'auto' },
          bgcolor: tokens.colors.surfaces.light.variant,
          overflow: 'hidden',
        }}
      >
        <Box
          component="img"
          src={book.cover_url || book.cover_image_url || ''}
          alt={book.title}
          sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={(e) => { e.target.style.display = 'none'; }}
        />
        <Box
          sx={{
            position: 'absolute',
            top: 6,
            right: 6,
            bgcolor: isAudio ? tokens.colors.secondary : tokens.colors.primary,
            borderRadius: '6px',
            p: '2px 5px',
            display: 'flex',
            alignItems: 'center',
            gap: 0.3,
          }}
        >
          {isAudio
            ? <HeadphonesOutlined sx={{ fontSize: 11, color: '#fff' }} />
            : <MenuBookRounded sx={{ fontSize: 11, color: '#fff' }} />}
        </Box>
      </Box>
      <Box sx={{ p: 1 }}>
        <Typography variant="caption" sx={{ fontWeight: 700, color: tokens.colors.onBackground.light, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.3, fontSize: '0.75rem' }}>
          {book.title}
        </Typography>
        <Typography variant="caption" sx={{ color: '#9c7e49', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.68rem', mt: 0.25 }}>
          {book.author_name || book.author || ''}
        </Typography>
      </Box>
    </Paper>
  );
}

function HScrollSection({ title, viewAllPath, items, loading, scrollRef, onNavigate }) {
  const navigate = onNavigate;
  return (
    <Box sx={{ mt: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: tokens.colors.onBackground.light }}>
          {title}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', justifyContent: { xs: 'flex-start', sm: 'flex-end' } }}>
          <IconButton size="small" aria-label="Faire défiler à gauche" onClick={() => scroll(scrollRef, -1)} sx={{ display: { xs: 'none', sm: 'inline-flex' }, color: '#9c7e49', '&:hover': { color: tokens.colors.primary } }}>
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" aria-label="Faire défiler à droite" onClick={() => scroll(scrollRef, 1)} sx={{ display: { xs: 'none', sm: 'inline-flex' }, color: '#9c7e49', '&:hover': { color: tokens.colors.primary } }}>
            <ChevronRightIcon fontSize="small" />
          </IconButton>
          <Button
            onClick={() => navigate(viewAllPath)}
            sx={{ textTransform: 'none', color: tokens.colors.primary, fontWeight: 600, fontSize: '0.8rem', minWidth: 0, ml: { xs: 0, sm: 0.5 }, '&:hover': { bgcolor: `${tokens.colors.primary}0D` } }}
          >
            Voir tout
          </Button>
        </Box>
      </Box>
      <Box
        ref={scrollRef}
        sx={{
          display: { xs: 'grid', sm: 'flex' },
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'none' },
          flexWrap: 'nowrap',
          gap: { xs: 1, sm: 1.5 },
          overflowX: { xs: 'hidden', sm: 'auto' },
          pb: 1,
          minWidth: 0,
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
            <Box key={i} sx={{ flexShrink: 0, width: { xs: '100%', sm: 130 } }}>
              <Skeleton variant="rectangular" width="100%" height={174} sx={{ borderRadius: '10px' }} />
              <Skeleton width="80%" height={14} sx={{ mt: 0.75 }} />
              <Skeleton width="55%" height={12} sx={{ mt: 0.25 }} />
            </Box>
          ))
          : items.map((book) => (
            <ContentCard key={book.id} book={book} onClick={() => navigate(`/catalogue/${book.id}`)} />
          ))}
      </Box>
    </Box>
  );
}

export default function DashboardPage() {
  const { formatPrice } = useCurrency();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(emptyStats);
  const [continueReading, setContinueReading] = useState([]);
  const [nouveautes, setNouveautes] = useState([]);
  const [populaires, setPopulaires] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [sectionsLoading, setSectionsLoading] = useState(true);
  const [activity, setActivity] = useState({ labels: ['L', 'M', 'M', 'J', 'V', 'S', 'D'], values: [0, 0, 0, 0, 0, 0, 0] });
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [subscriptionLabel, setSubscriptionLabel] = useState('Aucun abonnement actif');
  const [usage, setUsage] = useState(null);
  const nouveautesRef = useRef(null);
  const populairesRef = useRef(null);
  const recommendationsRef = useRef(null);

  useEffect(() => {
    let alive = true;

    const loadDashboardData = async () => {
      try {
        const userData = await authService.getUser();
        if (alive && userData) setUser(userData);

        const [historyRes, continueRes, subscriptionRes, nouveautesRes, populairesRes, recoRes, usageRes] = await Promise.allSettled([
          authFetch(`${API_URL}/reading-history?page=1&limit=100`),
          authFetch(`${API_URL}/reading-history/continue?limit=3`),
          authFetch(`${API_URL}/api/subscriptions/me`),
          contentsService.getContents({ sort: 'newest', limit: 12 }),
          contentsService.getContents({ sort: 'popular', limit: 12 }),
          contentsService.getRecommendations(12),
          authFetch(`${API_URL}/api/subscriptions/usage/me`),
        ]);

        let historyItems = [];
        if (historyRes.status === 'fulfilled' && historyRes.value.ok) {
          const payload = await safeJson(historyRes.value);
          historyItems = Array.isArray(payload?.data) ? payload.data : [];
        }

        if (alive) {
          setStats(computeStats(historyItems));
          setActivity(buildWeekActivity(historyItems));
        }

        if (continueRes.status === 'fulfilled' && continueRes.value.ok) {
          const payload = await safeJson(continueRes.value);
          const items = Array.isArray(payload?.data) ? payload.data : [];
          if (alive) setContinueReading(items);
        } else if (alive) {
          const fallback = historyItems
            .filter((item) => Number(item.progress_percent || 0) > 0 && Number(item.progress_percent || 0) < 100)
            .slice(0, 3);
          setContinueReading(fallback);
        }

        if (subscriptionRes.status === 'fulfilled' && subscriptionRes.value.ok) {
          const payload = await safeJson(subscriptionRes.value);
          if (alive) {
            const isActive = Boolean(payload?.isActive);
            const subscription = payload?.subscription || null;
            setHasActiveSubscription(isActive);
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
            } else if (payload?.hasSubscription) {
              setSubscriptionLabel('Abonnement inactif');
            } else {
              setSubscriptionLabel('Aucun abonnement actif');
            }
          }
        } else if (alive) {
          setHasActiveSubscription(false);
          setSubscriptionLabel('Aucun abonnement actif');
        }

        if (usageRes.status === 'fulfilled' && usageRes.value.ok) {
          const payload = await safeJson(usageRes.value);
          if (alive && payload?.data?.usage) {
            setUsage(payload.data.usage);
          }
        }

        if (alive) {
          if (nouveautesRes.status === 'fulfilled') {
            setNouveautes(Array.isArray(nouveautesRes.value?.data) ? nouveautesRes.value.data : []);
          }
          if (populairesRes.status === 'fulfilled') {
            setPopulaires(Array.isArray(populairesRes.value?.data) ? populairesRes.value.data : []);
          }
          if (recoRes.status === 'fulfilled') {
            setRecommendations(Array.isArray(recoRes.value) ? recoRes.value : []);
          }
          setSectionsLoading(false);
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
        setSectionsLoading(false);
      }
    };

    loadDashboardData();
    return () => { alive = false; };
  }, []);

  const userName = user?.full_name || 'Utilisateur';

  const statCards = useMemo(() => ([
    { label: 'Livres lus', value: stats.books_read, icon: MenuBookOutlined, color: tokens.colors.primary },
    { label: 'Heures écoutées', value: `${stats.hours_listened}h`, icon: ScheduleOutlined, color: tokens.colors.secondary },
    { label: 'Série', value: `${stats.streak_days}j`, icon: LocalFireDepartmentOutlined, color: tokens.colors.semantic.error },
    { label: 'Objectif mensuel', value: `${stats.monthly_goal_percent}%`, icon: TrackChangesOutlined, color: tokens.colors.semantic.success },
  ]), [stats]);

  const maxActivity = Math.max(...activity.values, 1);
  const monthlyProgress = Math.min(100, Math.round((stats.monthly_books_done / Math.max(stats.monthly_books_target, 1)) * 100));
  const weeklyProgress = Math.min(100, Math.round((stats.weekly_hours_done / Math.max(stats.weekly_hours_target, 1)) * 100));

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: tokens.colors.backgrounds.light, overflowX: 'hidden' }}>
      <UserSpaceSidebar user={user} activeKey="overview" subscriptionLabel={subscriptionLabel} />

      <Box sx={{ flex: 1, p: { xs: 1.5, sm: 2, md: 4 }, overflowY: 'auto', overflowX: 'hidden', minWidth: 0 }}>
        <Box sx={{ background: `linear-gradient(135deg, ${tokens.colors.primary} 0%, ${tokens.colors.primaryDark} 100%)`, borderRadius: '16px', p: { xs: 2.2, md: 4 }, mb: 3, position: 'relative', overflow: 'hidden' }}>
          <Box sx={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.08)' }} />
          <Box sx={{ position: 'absolute', bottom: -20, right: 80, width: 80, height: 80, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.05)' }} />
          <Typography variant="h4" sx={{ color: '#fff', fontWeight: 700, mb: 0.5, position: 'relative', zIndex: 1, fontSize: { xs: '1.7rem', md: '2.125rem' }, lineHeight: 1.05 }}>
            Bon retour, {userName.split(' ')[0]} !
          </Typography>
          <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.85)', mb: 2, position: 'relative', zIndex: 1, fontSize: { xs: '0.92rem', md: '1rem' }, maxWidth: { md: 460 } }}>
            Prêt à explorer de nouveaux horizons aujourd&apos;hui ?
          </Typography>
          <Chip
            label={`Temps total: ${stats.total_hours} heures`}
            sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 600, fontSize: '0.85rem', height: 32, position: 'relative', zIndex: 1, maxWidth: '100%' }}
          />
        </Box>

        {/* Bannière abonnement — visible uniquement sans abonnement actif */}
        {!hasActiveSubscription && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              bgcolor: '#FFF8F0',
              border: `1px solid ${tokens.colors.primary}40`,
              borderRadius: '12px',
              px: { xs: 1.6, md: 3 },
              py: { xs: 1.5, md: 2 },
              mb: 3,
              flexWrap: 'wrap',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <WorkspacePremiumOutlined sx={{ color: tokens.colors.primary, fontSize: 28 }} />
              <Box>
                <Typography variant="body1" sx={{ fontWeight: 700, color: tokens.colors.accent, lineHeight: 1.2 }}>
                  Passez à l'abonnement pour accéder à tout le catalogue
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.35, overflowWrap: 'anywhere' }}>
                  Ebooks + Audio · {formatPrice(500)}/mois ou {formatPrice(5000)}/an · Annulez à tout moment
                </Typography>
              </Box>
            </Box>
            <Button
              variant="contained"
              size="small"
              onClick={() => navigate('/pricing')}
              sx={{
                bgcolor: tokens.colors.primary,
                color: '#fff',
                borderRadius: '20px',
                px: 2.5,
                py: 0.8,
                textTransform: 'none',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                '&:hover': { bgcolor: tokens.colors.primaryDark },
              }}
            >
              Voir les offres
            </Button>
          </Box>
        )}

        <Box sx={{ display: { xs: 'grid', lg: 'none' }, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1.2, mb: 2.5 }}>
          {[
            { label: 'Aujourd hui', value: `${Math.max(0, Math.round((stats.weekly_hours_done || 0) * 60))} min`, color: tokens.colors.primary },
            { label: 'Serie', value: `${stats.streak_days} j`, color: tokens.colors.secondary },
            { label: 'Mois', value: `${stats.monthly_goal_percent}%`, color: tokens.colors.semantic.success },
          ].map((item) => (
            <Paper key={item.label} elevation={0} sx={{ p: 1.3, borderRadius: '12px', border: `1px solid ${tokens.colors.surfaces.light.variant}`, bgcolor: '#fff' }}>
              <Typography sx={{ fontSize: '0.66rem', color: '#9c7e49', textTransform: 'uppercase', letterSpacing: 0.45, fontWeight: 700 }}>
                {item.label}
              </Typography>
              <Typography sx={{ mt: 0.4, fontSize: '1.05rem', color: item.color, fontWeight: 800, lineHeight: 1.1 }}>
                {item.value}
              </Typography>
            </Paper>
          ))}
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: { xs: 1.5, md: 2.5 }, mb: usage ? 2 : 3 }}>
          {statCards.map((stat) => {
            const StatIcon = stat.icon;
            return (
              <Paper key={stat.label} elevation={0} sx={{ p: 2.5, borderRadius: '12px', border: `1px solid ${tokens.colors.surfaces.light.variant}`, bgcolor: '#fff', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box sx={{ width: 44, height: 44, borderRadius: '10px', bgcolor: `${stat.color}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <StatIcon sx={{ color: stat.color, fontSize: 24 }} />
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: '#9c7e49', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {stat.label}
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: tokens.colors.onBackground.light, lineHeight: 1.1 }}>
                    {stat.value}
                  </Typography>
                </Box>
              </Paper>
            );
          })}
        </Box>

        {usage && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: { xs: 1.5, md: 2.5 }, mb: 3 }}>
            {[
              {
                label: 'Crédits livres texte',
                icon: MenuBookOutlined,
                color: tokens.colors.primary,
                used: Number(usage.text_unlocked_count || 0),
                quota: Number(usage.text_quota || 0),
              },
              {
                label: 'Crédits livres audio',
                icon: HeadphonesOutlined,
                color: tokens.colors.secondary,
                used: Number(usage.audio_unlocked_count || 0),
                quota: Number(usage.audio_quota || 0),
              },
            ].map((credit) => {
              const CreditIcon = credit.icon;
              const remaining = Math.max(0, credit.quota - credit.used);
              const pct = credit.quota > 0 ? Math.min(100, Math.round((credit.used / credit.quota) * 100)) : 0;
              return (
                <Paper key={credit.label} elevation={0} sx={{ p: 2.5, borderRadius: '12px', border: `1px solid ${tokens.colors.surfaces.light.variant}`, bgcolor: '#fff' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                    <Box sx={{ width: 36, height: 36, borderRadius: '8px', bgcolor: `${credit.color}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CreditIcon sx={{ color: credit.color, fontSize: 20 }} />
                    </Box>
                    <Typography variant="caption" sx={{ color: '#9c7e49', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {credit.label}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, mb: 1 }}>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: tokens.colors.onBackground.light, lineHeight: 1 }}>
                      {remaining}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#9c7e49' }}>/ {credit.quota} restants</Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={pct}
                    sx={{
                      height: 6,
                      borderRadius: 3,
                      bgcolor: `${credit.color}1A`,
                      '& .MuiLinearProgress-bar': { borderRadius: 3, bgcolor: credit.color },
                    }}
                  />
                </Paper>
              );
            })}
          </Box>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, gap: { xs: 2, md: 2.5 } }}>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: tokens.colors.onBackground.light }}>
                Continuer la lecture
              </Typography>
              <Button
                onClick={() => navigate('/my-list')}
                sx={{ textTransform: 'none', color: tokens.colors.primary, fontWeight: 600, fontSize: '0.85rem', '&:hover': { bgcolor: `${tokens.colors.primary}0D` } }}
              >
                Voir tout
              </Button>
            </Box>
            {continueReading.length > 0 ? (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: { xs: 1.5, md: 2 } }}>
                {continueReading.map((book) => {
                  const contentId = book.content_id || book.id;
                  const fmt = String(book.format || '').toLowerCase();
                  const isAudio = String(book.content_type || '').toLowerCase() === 'audiobook'
                    || ['mp3', 'm4a'].includes(fmt);
                  const targetRoute = isAudio ? `/listen/${contentId}` : fmt === 'pdf' ? `/pdf/${contentId}` : `/read/${contentId}`;
                  return (
                  <Paper
                    key={book.id}
                    elevation={0}
                    sx={{
                      borderRadius: '12px',
                      overflow: 'hidden',
                      border: `1px solid ${tokens.colors.surfaces.light.variant}`,
                      bgcolor: '#fff',
                      cursor: 'pointer',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' },
                    }}
                    onClick={() => navigate(targetRoute)}
                  >
                    <Box sx={{ position: 'relative', aspectRatio: '3/4', bgcolor: tokens.colors.surfaces.light.variant, overflow: 'hidden' }}>
                      <Box
                        component="img"
                        src={book.cover_url || book.cover_image_url || '/api/placeholder/200/280'}
                        alt={book.title}
                        sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                      <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.75))', p: 1.5, pt: 3 }}>
                        <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600, fontSize: '0.75rem' }}>
                          {Math.round(Number(book.progress || book.progress_percent || 0))}%
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={Number(book.progress || book.progress_percent || 0)}
                          sx={{
                            mt: 0.5,
                            height: 4,
                            borderRadius: 2,
                            bgcolor: 'rgba(255,255,255,0.3)',
                            '& .MuiLinearProgress-bar': { borderRadius: 2, bgcolor: tokens.colors.primary },
                          }}
                        />
                      </Box>
                    </Box>
                    <Box sx={{ p: 1.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: tokens.colors.onBackground.light, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {book.title}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#9c7e49', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                        {book.author || book.author_name || ''}
                      </Typography>
                    </Box>
                  </Paper>
                  );
                })}
              </Box>
            ) : (
              <Paper elevation={0} sx={{ p: 3, borderRadius: '12px', border: `1px solid ${tokens.colors.surfaces.light.variant}`, bgcolor: '#fff' }}>
                <Typography sx={{ color: '#9c7e49', fontSize: '0.9rem' }}>
                  Aucune lecture en cours pour le moment.
                </Typography>
              </Paper>
            )}

            <HScrollSection
              title="Nouveautés"
              viewAllPath="/catalogue?sort=newest"
              items={nouveautes}
              loading={sectionsLoading}
              scrollRef={nouveautesRef}
              onNavigate={navigate}
            />

            <HScrollSection
              title="Populaires"
              viewAllPath="/catalogue?sort=popular"
              items={populaires}
              loading={sectionsLoading}
              scrollRef={populairesRef}
              onNavigate={navigate}
            />

            {(sectionsLoading || recommendations.length > 0) && (
              <HScrollSection
                title="Ça peut vous intéresser"
                viewAllPath="/catalogue"
                items={recommendations}
                loading={sectionsLoading}
                scrollRef={recommendationsRef}
                onNavigate={navigate}
              />
            )}
          </Box>

          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: tokens.colors.onBackground.light, mb: 2 }}>
              Objectifs de lecture
            </Typography>
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: '12px', border: `1px solid ${tokens.colors.surfaces.light.variant}`, bgcolor: '#fff' }}>
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: tokens.colors.onBackground.light }}>
                    Livres mensuels
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#9c7e49', fontWeight: 600 }}>
                    {stats.monthly_books_done}/{stats.monthly_books_target}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={monthlyProgress}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    bgcolor: `${tokens.colors.semantic.success}1A`,
                    '& .MuiLinearProgress-bar': { borderRadius: 4, bgcolor: tokens.colors.semantic.success },
                  }}
                />
              </Box>

              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: tokens.colors.onBackground.light }}>
                    Heures hebdomadaires
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#9c7e49', fontWeight: 600 }}>
                    {stats.weekly_hours_done}h/{stats.weekly_hours_target}h
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={weeklyProgress}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    bgcolor: `${tokens.colors.primary}1A`,
                    '& .MuiLinearProgress-bar': { borderRadius: 4, bgcolor: tokens.colors.primary },
                  }}
                />
              </Box>

              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, color: tokens.colors.onBackground.light, mb: 1.5 }}>
                  Activité cette semaine
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.75, justifyContent: 'space-between' }}>
                  {activity.labels.map((day, i) => {
                    const intensity = activity.values[i] / maxActivity;
                    return (
                      <Box key={`${day}-${i}`} sx={{ textAlign: 'center', flex: 1 }}>
                        <Box
                          sx={{
                            width: '100%',
                            aspectRatio: '1/1',
                            borderRadius: '6px',
                            bgcolor: intensity > 0 ? `rgba(181, 101, 29, ${0.15 + intensity * 0.7})` : tokens.colors.surfaces.light.variant,
                            mb: 0.5,
                          }}
                        />
                        <Typography variant="caption" sx={{ color: '#9c7e49', fontSize: '0.65rem', fontWeight: 500 }}>
                          {day}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            </Paper>
          </Box>
        </Box>

      </Box>

      <MobileBottomNav />
    </Box>
  );
}
