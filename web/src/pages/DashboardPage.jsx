import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Avatar,
  Button,
  Paper,
  LinearProgress,
  Chip,
  IconButton,
} from '@mui/material';
import DashboardOutlined from '@mui/icons-material/DashboardOutlined';
import AutoStoriesOutlined from '@mui/icons-material/AutoStoriesOutlined';
import AnalyticsOutlined from '@mui/icons-material/AnalyticsOutlined';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import PaymentOutlined from '@mui/icons-material/PaymentOutlined';
import DevicesOutlined from '@mui/icons-material/DevicesOutlined';
import SecurityOutlined from '@mui/icons-material/SecurityOutlined';
import WorkspacePremiumOutlined from '@mui/icons-material/WorkspacePremiumOutlined';
import LogoutOutlined from '@mui/icons-material/LogoutOutlined';
import MenuBookOutlined from '@mui/icons-material/MenuBookOutlined';
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined';
import LocalFireDepartmentOutlined from '@mui/icons-material/LocalFireDepartmentOutlined';
import TrackChangesOutlined from '@mui/icons-material/TrackChangesOutlined';
import PhotoCameraOutlined from '@mui/icons-material/PhotoCameraOutlined';

import tokens from '../config/tokens';
import * as authService from '../services/auth.service';
import { authFetch } from '../services/auth.service';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const sidebarNavItems = [
  { label: 'Vue d\'ensemble', icon: DashboardOutlined, key: 'overview', route: '/dashboard' },
  { label: 'Ma bibliothèque', icon: AutoStoriesOutlined, key: 'library', route: '/my-list' },
  { label: 'Statistiques', icon: AnalyticsOutlined, key: 'stats', route: '/history' },
  { label: 'Préférences', icon: SettingsOutlined, key: 'preferences', route: '/profile' },
  { label: 'Abonnement', icon: PaymentOutlined, key: 'subscription', route: '/subscription' },
  { label: 'Appareils', icon: DevicesOutlined, key: 'devices' },
  { label: 'Sécurité', icon: SecurityOutlined, key: 'security' },
];

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

export default function DashboardPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(emptyStats);
  const [continueReading, setContinueReading] = useState([]);
  const [activity, setActivity] = useState({ labels: ['L', 'M', 'M', 'J', 'V', 'S', 'D'], values: [0, 0, 0, 0, 0, 0, 0] });
  const [activeNav, setActiveNav] = useState('overview');
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [subscriptionLabel, setSubscriptionLabel] = useState('Aucun abonnement actif');

  useEffect(() => {
    let alive = true;

    const loadDashboardData = async () => {
      try {
        const userData = await authService.getUser();
        if (alive && userData) setUser(userData);

        const [historyRes, continueRes, subscriptionRes] = await Promise.allSettled([
          authFetch(`${API_URL}/reading-history?page=1&limit=100`),
          authFetch(`${API_URL}/reading-history/continue?limit=3`),
          authFetch(`${API_URL}/api/subscriptions/me`),
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
            const planName = subscription?.plan_snapshot?.name || subscription?.plan_type || null;
            setHasActiveSubscription(isActive);
            if (isActive) {
              setSubscriptionLabel(planName ? `${planName} actif` : 'Abonnement actif');
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
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      }
    };

    loadDashboardData();
    return () => { alive = false; };
  }, []);

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleNavClick = (item) => {
    setActiveNav(item.key);
    if (item.route) navigate(item.route);
  };

  const userName = user?.full_name || 'Utilisateur';
  const userEmail = user?.email || '';
  const userAvatar = user?.avatar_url || '';

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
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: tokens.colors.backgrounds.light }}>
      <Box
        sx={{
          width: '25%',
          maxWidth: 320,
          minWidth: 260,
          position: 'sticky',
          top: 0,
          height: '100vh',
          bgcolor: '#fff',
          borderRight: `1px solid ${tokens.colors.surfaces.light.variant}`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'auto',
        }}
      >
        <Box sx={{ p: 3, textAlign: 'center', borderBottom: `1px solid ${tokens.colors.surfaces.light.variant}` }}>
          <Box sx={{ position: 'relative', display: 'inline-block', mb: 1.5 }}>
            <Avatar
              src={userAvatar}
              alt={userName}
              sx={{ width: 80, height: 80, bgcolor: tokens.colors.primaryLight, fontSize: '2rem', color: '#fff', fontWeight: 600 }}
            >
              {userName.charAt(0).toUpperCase()}
            </Avatar>
            <IconButton
              size="small"
              sx={{
                position: 'absolute',
                bottom: 0,
                right: -4,
                bgcolor: tokens.colors.primary,
                color: '#fff',
                width: 28,
                height: 28,
                '&:hover': { bgcolor: tokens.colors.primaryDark },
              }}
            >
              <PhotoCameraOutlined sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: tokens.colors.onBackground.light, lineHeight: 1.3 }}>
            {userName}
          </Typography>
          <Typography variant="body2" sx={{ color: '#9c7e49', mt: 0.25 }}>
            {userEmail}
          </Typography>
        </Box>

        <Box sx={{ flex: 1, p: 2, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {sidebarNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.key;
            return (
              <Button
                key={item.key}
                onClick={() => handleNavClick(item)}
                disabled={!item.route}
                startIcon={<Icon />}
                fullWidth
                sx={{
                  justifyContent: 'flex-start',
                  borderRadius: '12px',
                  px: 2,
                  py: 1.25,
                  textTransform: 'none',
                  fontSize: '0.9rem',
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? tokens.colors.primary : tokens.colors.onBackground.light,
                  bgcolor: isActive ? `${tokens.colors.primary}1A` : 'transparent',
                  '&:hover': { bgcolor: isActive ? `${tokens.colors.primary}1A` : tokens.colors.surfaces.light.variant },
                  '&.Mui-disabled': {
                    color: '#b5b0a7',
                    bgcolor: 'transparent',
                    cursor: 'not-allowed',
                  },
                  gap: 1,
                }}
              >
                {item.label}
              </Button>
            );
          })}
        </Box>

        <Box sx={{ p: 2, borderTop: `1px solid ${tokens.colors.surfaces.light.variant}` }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: `${tokens.colors.secondary}1A`, borderRadius: '12px', px: 2, py: 1.25, mb: 1.5 }}>
            <WorkspacePremiumOutlined sx={{ color: tokens.colors.secondary, fontSize: 22 }} />
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700, color: tokens.colors.onBackground.light, lineHeight: 1.2 }}>
                Membre Premium
              </Typography>
              <Typography variant="caption" sx={{ color: '#9c7e49' }}>
                {subscriptionLabel}
              </Typography>
            </Box>
          </Box>

          <Button
            onClick={handleLogout}
            startIcon={<LogoutOutlined />}
            fullWidth
            sx={{
              justifyContent: 'flex-start',
              borderRadius: '12px',
              px: 2,
              py: 1.25,
              textTransform: 'none',
              fontSize: '0.9rem',
              fontWeight: 500,
              color: tokens.colors.semantic.error,
              '&:hover': { bgcolor: `${tokens.colors.semantic.error}0D` },
              gap: 1,
            }}
          >
            Déconnexion
          </Button>
        </Box>
      </Box>

      <Box sx={{ flex: 1, p: 4, overflow: 'auto' }}>
        <Box sx={{ background: `linear-gradient(135deg, ${tokens.colors.primary} 0%, ${tokens.colors.primaryDark} 100%)`, borderRadius: '16px', p: 4, mb: 3, position: 'relative', overflow: 'hidden' }}>
          <Box sx={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.08)' }} />
          <Box sx={{ position: 'absolute', bottom: -20, right: 80, width: 80, height: 80, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.05)' }} />
          <Typography variant="h4" sx={{ color: '#fff', fontWeight: 700, mb: 0.5, position: 'relative', zIndex: 1 }}>
            Bon retour, {userName.split(' ')[0]} !
          </Typography>
          <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.85)', mb: 2, position: 'relative', zIndex: 1 }}>
            Prêt à explorer de nouveaux horizons aujourd&apos;hui ?
          </Typography>
          <Chip
            label={`Temps total: ${stats.total_hours} heures`}
            sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 600, fontSize: '0.85rem', height: 32, position: 'relative', zIndex: 1 }}
          />
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2.5, mb: 3 }}>
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

        <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 2.5 }}>
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
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
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
                {continueReading.map((book) => {
                  const contentId = book.content_id || book.id;
                  const isAudio = String(book.content_type || '').toLowerCase() === 'audiobook'
                    || ['mp3', 'm4a'].includes(String(book.format || '').toLowerCase());
                  const targetRoute = isAudio ? `/listen/${contentId}` : `/read/${contentId}`;
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
    </Box>
  );
}
