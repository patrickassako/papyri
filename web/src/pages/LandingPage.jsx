import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Grid,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  ArrowRight,
  AudioLines,
  Book,
  Headphones,
  Library,
  Lock,
  Smartphone,
  Sparkles,
  Star,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { contentsService } from '../services/contents.service';
import * as authService from '../services/auth.service';
import PublicHeader from '../components/PublicHeader';
import CurrencyFloatingSelector from '../components/CurrencyFloatingSelector';
import { useCurrency } from '../hooks/useCurrency';
import tokens from '../config/tokens';
import papyriLogo from '../assets/papyri-wordmark-150x50.png';

/* ─── helpers ─────────────────────────────────────────────── */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function TypeBadge({ type }) {
  const isAudio = type === 'audiobook';
  const { t } = useTranslation();
  return (
    <Box sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.5,
      px: 1, py: 0.3, borderRadius: 99,
      bgcolor: isAudio ? '#1565c0' : tokens.colors.primary,
      color: '#fff',
      fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
      boxShadow: '0 4px 10px rgba(0,0,0,0.16)',
    }}>
      {isAudio ? <Headphones size={10} /> : <Book size={10} />}
      {isAudio ? t('landing.typeAudio') : t('landing.typeBook')}
    </Box>
  );
}

/* ─── animated section wrapper ────────────────────────────── */
function FadeIn({ children, delay = 0, sx = {} }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold: 0.08 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <Box ref={ref} sx={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(32px)',
      transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      ...sx,
    }}>
      {children}
    </Box>
  );
}

/* ─── horizontal scroll strip ─────────────────────────────── */
function HScrollStrip({ items, onItemClick }) {
  return (
    <Box sx={{
      display: 'flex', gap: 2, overflowX: 'auto', pb: 1.5,
      '&::-webkit-scrollbar': { height: 4 },
      '&::-webkit-scrollbar-track': { bgcolor: '#f4efe6', borderRadius: 4 },
      '&::-webkit-scrollbar-thumb': { bgcolor: tokens.colors.primary, borderRadius: 4 },
    }}>
      {items.map((c, i) => (
        <Box
          key={c.id}
          onClick={() => onItemClick(c.id)}
          sx={{
            flexShrink: 0, width: { xs: 130, md: 160 }, cursor: 'pointer',
            animation: `fadeSlideUp 0.5s ease both`,
            animationDelay: `${i * 60}ms`,
            '@keyframes fadeSlideUp': {
              from: { opacity: 0, transform: 'translateY(16px)' },
              to: { opacity: 1, transform: 'translateY(0)' },
            },
            '&:hover .book-cover': { transform: 'translateY(-6px) scale(1.03)', boxShadow: '0 16px 32px rgba(0,0,0,0.22)' },
          }}
        >
          <Box className="book-cover" sx={{
            width: '100%', aspectRatio: '2/3', borderRadius: 2, overflow: 'hidden',
            bgcolor: '#e8dfd4', boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
            transition: 'transform 0.35s ease, box-shadow 0.35s ease',
            backgroundImage: c.cover_url ? `url(${c.cover_url})` : undefined,
            backgroundSize: 'cover', backgroundPosition: 'center',
            position: 'relative',
          }}>
            <Box sx={{ position: 'absolute', top: 8, left: 8 }}><TypeBadge type={c.content_type} /></Box>
          </Box>
          <Typography sx={{ mt: 1, fontWeight: 700, fontSize: '0.82rem', color: '#1d160c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {c.title}
          </Typography>
          <Typography sx={{ fontSize: '0.74rem', color: '#8a7a6a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {c.author}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

/* ─── skeleton strip ──────────────────────────────────────── */
function SkeletonStrip({ count = 5 }) {
  return (
    <Box sx={{ display: 'flex', gap: 2 }}>
      {Array.from({ length: count }).map((_, i) => (
        <Box key={i} sx={{ flexShrink: 0, width: 145 }}>
          <Box sx={{
            width: '100%', aspectRatio: '2/3', borderRadius: 2,
            background: 'linear-gradient(90deg,#ede8e1 25%,#f7f2ec 50%,#ede8e1 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.4s infinite',
            '@keyframes shimmer': {
              '0%': { backgroundPosition: '200% 0' },
              '100%': { backgroundPosition: '-200% 0' },
            },
          }} />
          <Box sx={{ mt: 1, height: 12, width: '80%', borderRadius: 1, bgcolor: '#ede8e1' }} />
          <Box sx={{ mt: 0.5, height: 10, width: '55%', borderRadius: 1, bgcolor: '#ede8e1' }} />
        </Box>
      ))}
    </Box>
  );
}

/* ─── section header ──────────────────────────────────────── */
function SectionHeader({ icon, title, subtitle, onViewAll }) {
  const { t } = useTranslation();
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 3 }}>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          {icon}
          <Typography sx={{ fontFamily: 'Playfair Display, serif', fontSize: { xs: '1.4rem', md: '1.75rem' }, fontWeight: 800, color: '#1d160c' }}>
            {title}
          </Typography>
        </Box>
        {subtitle && <Typography sx={{ color: '#8a7a6a', fontSize: '0.875rem' }}>{subtitle}</Typography>}
      </Box>
      {onViewAll && (
        <Button endIcon={<ArrowRight size={15} />} onClick={onViewAll}
          sx={{ color: tokens.colors.primary, fontWeight: 700, textTransform: 'none', flexShrink: 0, '&:hover': { textDecoration: 'underline', bgcolor: 'transparent' } }}>
          {t('landing.viewAll')}
        </Button>
      )}
    </Box>
  );
}

/* ═══ MAIN COMPONENT ══════════════════════════════════════════ */
export default function LandingPage() {
  const { formatPrice } = useCurrency();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [categories, setCategories] = useState([{ id: 'tous', label: t('common.all') }]);
  const [selectedCategory, setSelectedCategory] = useState('tous');
  const [loading, setLoading] = useState(true);

  // Content pools — shuffled client-side for variety each visit
  const [featured, setFeatured] = useState(null);       // 1 random spotlight
  const [popular, setPopular] = useState([]);           // sorted by views
  const [recent, setRecent] = useState([]);             // sorted by date
  const [mayLike, setMayLike] = useState([]);           // shuffled pool

  // Counters for animated stats
  const [statsVisible, setStatsVisible] = useState(false);
  const statsRef = useRef(null);

  /* ── auth check ── */
  useEffect(() => {
    authService.isAuthenticated()
      .then((v) => setIsAuthenticated(Boolean(v)))
      .catch(() => {});
  }, []);

  /* ── stats intersection ── */
  useEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStatsVisible(true); }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  /* ── categories ── */
  useEffect(() => {
    contentsService.getCategories()
      .then((data) => {
        const api = (data || []).map((c) => ({ id: c.slug, label: c.name }));
        setCategories([{ id: 'tous', label: 'Tous' }, ...api]);
      })
      .catch(() => {});
  }, []);

  /* ── load content pools ── */
  const loadContents = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: 1, limit: 20 };
      if (selectedCategory !== 'tous') params.category = selectedCategory;

      const [popResp, recentResp] = await Promise.all([
        contentsService.getContents({ ...params, sort: 'popular' }),
        contentsService.getContents({ ...params, sort: 'newest' }),
      ]);

      const popList = popResp?.data || [];
      const recentList = recentResp?.data || [];

      // Shuffle popular pool → every refresh puts a different book first
      const shuffledPop = shuffle(popList);

      setFeatured(shuffledPop[0] || null);
      setPopular(shuffledPop.slice(0, 10));
      setRecent(recentList.slice(0, 10));

      // "Ça peut vous intéresser" — merge both pools, de-dupe, shuffle
      const seen = new Set();
      const merged = [...popList, ...recentList].filter((c) => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });
      setMayLike(shuffle(merged).slice(0, 8));
    } catch (err) {
      console.error('LandingPage load error:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => { loadContents(); }, [loadContents]);

  const features = [
    { icon: <Library size={28} />, title: t('landing.feat1Title'), description: t('landing.feat1Desc') },
    { icon: <AudioLines size={28} />, title: t('landing.feat2Title'), description: t('landing.feat2Desc') },
    { icon: <Smartphone size={28} />, title: t('landing.feat3Title'), description: t('landing.feat3Desc') },
    { icon: <Lock size={28} />, title: t('landing.feat4Title'), description: t('landing.feat4Desc') },
  ];

  const stats = [
    { value: '500+', label: t('landing.statsTitles') },
    { value: '12k+', label: t('landing.statsReaders') },
    { value: '4.9', label: t('landing.statsRating') },
    { value: '3', label: t('landing.statsPlatforms') },
  ];

  return (
    <Box sx={{ bgcolor: '#fcfaf8', minHeight: '100vh', overflowX: 'hidden' }}>
      <CurrencyFloatingSelector />
      <PublicHeader activeKey="home" isAuthenticated={isAuthenticated} background="#fcfaf8" />

      {/* ── HERO ─────────────────────────────────────────────── */}
      <Box sx={{ bgcolor: '#F5E6D3', pt: { xs: 6, md: 10 }, pb: { xs: 8, md: 12 }, overflow: 'hidden' }}>
        <Container maxWidth="lg">
          <Grid container spacing={6} alignItems="center">
            {/* Text */}
            <Grid size={{ xs: 12, lg: 6 }}>
              <Box sx={{
                animation: 'slideInLeft 0.7s ease both',
                '@keyframes slideInLeft': {
                  from: { opacity: 0, transform: 'translateX(-40px)' },
                  to: { opacity: 1, transform: 'translateX(0)' },
                },
              }}>
                <Typography sx={{
                  fontFamily: 'Playfair Display, serif',
                  fontSize: { xs: '2.6rem', md: '3.6rem', lg: '4.2rem' },
                  lineHeight: 1.08, color: '#1d160c', mb: 2.5, fontWeight: 800,
                }}>
                  {t('landing.heroH1')}
                </Typography>
                <Typography sx={{ fontSize: '1.1rem', lineHeight: 1.75, color: 'rgba(29,22,12,0.72)', mb: 4, maxWidth: 520 }}>
                  {t('landing.heroDesc')}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                  <Button variant="contained" size="large" endIcon={<ArrowRight />}
                    sx={{ bgcolor: tokens.colors.primary, px: 3.5, py: 1.5, fontSize: '1rem', fontWeight: 700, textTransform: 'none', boxShadow: '0 8px 24px rgba(181,101,29,0.3)', borderRadius: 2, '&:hover': { bgcolor: '#9a5418', transform: 'translateY(-2px)', boxShadow: '0 12px 32px rgba(181,101,29,0.35)' }, transition: 'all 0.25s' }}
                    onClick={() => navigate('/register')}>
                    {t('landing.heroCta')}
                  </Button>
                  <Button variant="outlined" size="large"
                    sx={{ px: 3.5, py: 1.5, fontSize: '1rem', fontWeight: 700, textTransform: 'none', color: '#1d160c', borderColor: 'rgba(29,22,12,0.25)', borderRadius: 2, bgcolor: 'rgba(255,255,255,0.6)', '&:hover': { bgcolor: 'white', borderColor: 'rgba(29,22,12,0.4)' } }}
                    onClick={() => navigate('/catalogue')}>
                    {t('landing.heroCta2')}
                  </Button>
                </Box>
              </Box>
            </Grid>

            {/* Featured book — floats + rotates each visit */}
            <Grid size={{ xs: 12, lg: 6 }}>
              <Box sx={{
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                animation: 'slideInRight 0.7s ease 0.15s both',
                '@keyframes slideInRight': {
                  from: { opacity: 0, transform: 'translateX(40px)' },
                  to: { opacity: 1, transform: 'translateX(0)' },
                },
              }}>
                {/* Book stack effect */}
                <Box sx={{ position: 'relative', width: { xs: 240, md: 300 } }}>
                  {/* Shadow books behind */}
                  <Box sx={{
                    position: 'absolute', bottom: -12, left: 20, right: -20,
                    height: '90%', borderRadius: 3, bgcolor: '#d4a87a', opacity: 0.4,
                  }} />
                  <Box sx={{
                    position: 'absolute', bottom: -6, left: 10, right: -10,
                    height: '95%', borderRadius: 3, bgcolor: '#c4956a', opacity: 0.5,
                  }} />
                  {/* Main book */}
                  <Box
                    onClick={() => featured && navigate(`/catalogue/${featured.id}`)}
                    sx={{
                      width: '100%', aspectRatio: '2/3', borderRadius: 3, overflow: 'hidden',
                      boxShadow: '0 32px 64px rgba(0,0,0,0.25)',
                      backgroundImage: featured?.cover_url ? `url(${featured.cover_url})` : `linear-gradient(135deg,${tokens.colors.primary},${tokens.colors.secondary})`,
                      backgroundSize: 'cover', backgroundPosition: 'center',
                      cursor: featured ? 'pointer' : 'default',
                      position: 'relative', zIndex: 1,
                      animation: 'floatBook 4s ease-in-out infinite',
                      '@keyframes floatBook': {
                        '0%, 100%': { transform: 'translateY(0px) rotate(-2deg)' },
                        '50%': { transform: 'translateY(-14px) rotate(-1deg)' },
                      },
                      transition: 'box-shadow 0.3s',
                      '&:hover': { boxShadow: '0 40px 80px rgba(0,0,0,0.3)' },
                    }}
                  >
                    {!featured && (
                      <Box sx={{ inset: 0, position: 'absolute', display: 'grid', placeItems: 'center' }}>
                        <CircularProgress sx={{ color: 'rgba(255,255,255,0.6)' }} />
                      </Box>
                    )}
                    {featured && (
                      <Box sx={{
                        position: 'absolute', bottom: 0, left: 0, right: 0, p: 2,
                        background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
                      }}>
                        <TypeBadge type={featured.content_type} />
                        <Typography sx={{ mt: 0.5, fontWeight: 800, color: '#fff', fontSize: '0.9rem', lineHeight: 1.2 }} noWrap>
                          {featured.title}
                        </Typography>
                        <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem' }} noWrap>
                          {featured.author}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                  {/* "À la une" badge */}
                  <Box sx={{
                    position: 'absolute', top: -12, right: -12, zIndex: 2,
                    px: 1.5, py: 0.6, borderRadius: 99,
                    background: `linear-gradient(135deg,${tokens.colors.secondary},${tokens.colors.primary})`,
                    boxShadow: '0 4px 14px rgba(181,101,29,0.4)',
                    animation: 'badgePop 0.5s ease 0.8s both',
                    '@keyframes badgePop': {
                      from: { opacity: 0, transform: 'scale(0.5) rotate(-15deg)' },
                      to: { opacity: 1, transform: 'scale(1) rotate(0deg)' },
                    },
                  }}>
                    <Typography sx={{ color: '#fff', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.05em' }}>
                      {t('landing.featuredBadge')}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ── STATS BAR ─────────────────────────────────────────── */}
      <Box ref={statsRef} sx={{ bgcolor: '#1d160c', py: 3.5 }}>
        <Container maxWidth="lg">
          <Grid container>
            {stats.map((s, i) => (
              <Grid size={{ xs: 6, md: 3 }} key={i}>
                <Box sx={{
                  textAlign: 'center', px: 2,
                  borderRight: i < 3 ? '1px solid rgba(255,255,255,0.1)' : 'none',
                  animation: statsVisible ? `countIn 0.5s ease ${i * 100}ms both` : 'none',
                  '@keyframes countIn': {
                    from: { opacity: 0, transform: 'translateY(12px)' },
                    to: { opacity: 1, transform: 'translateY(0)' },
                  },
                }}>
                  <Typography sx={{ fontFamily: 'Playfair Display, serif', fontSize: { xs: '1.6rem', md: '2rem' }, fontWeight: 800, color: tokens.colors.secondary }}>
                    {s.value}
                  </Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.8rem' }}>
                    {s.label}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ── CATEGORY CHIPS ────────────────────────────────────── */}
      <Box sx={{ py: 2.5, borderBottom: '1px solid #f0ebe3', bgcolor: '#fcfaf8', position: 'sticky', top: 64, zIndex: 10, backdropFilter: 'blur(8px)' }}>
        <Container maxWidth="lg">
          <Box sx={{
            display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5,
            '&::-webkit-scrollbar': { display: 'none' }, scrollbarWidth: 'none',
          }}>
            {categories.map((cat) => (
              <Chip
                key={cat.id}
                label={cat.id === 'tous' ? t('common.all') : cat.label}
                onClick={() => setSelectedCategory(cat.id)}
                sx={{
                  flexShrink: 0,
                  bgcolor: selectedCategory === cat.id ? tokens.colors.primary : '#f0ebe3',
                  color: selectedCategory === cat.id ? '#fff' : '#5a4a3a',
                  fontWeight: selectedCategory === cat.id ? 700 : 500,
                  fontSize: '0.85rem',
                  transition: 'all 0.2s',
                  '&:hover': { bgcolor: selectedCategory === cat.id ? '#9a5418' : 'rgba(181,101,29,0.12)' },
                }}
              />
            ))}
          </Box>
        </Container>
      </Box>

      {/* ── POPULAIRES ────────────────────────────────────────── */}
      <Box sx={{ py: { xs: 6, md: 8 }, bgcolor: '#fcfaf8' }}>
        <Container maxWidth="lg">
          <FadeIn>
            <SectionHeader
              icon={<TrendingUp size={22} color={tokens.colors.primary} />}
              title={t('landing.sectionPopular')}
              subtitle={t('landing.sectionPopularSub')}
              onViewAll={() => navigate('/catalogue?sort=popular')}
            />
            {loading ? <SkeletonStrip count={6} /> : <HScrollStrip items={popular} onItemClick={(id) => navigate(`/catalogue/${id}`)} />}
          </FadeIn>
        </Container>
      </Box>

      {/* ── NOUVEAUTÉS ────────────────────────────────────────── */}
      <Box sx={{ py: { xs: 6, md: 8 }, bgcolor: '#f7f2eb' }}>
        <Container maxWidth="lg">
          <FadeIn delay={60}>
            <SectionHeader
              icon={<Zap size={22} color={tokens.colors.primary} />}
              title={t('landing.sectionNew')}
              subtitle={t('landing.sectionNewSub')}
              onViewAll={() => navigate('/catalogue?sort=newest')}
            />
            {loading ? <SkeletonStrip count={6} /> : <HScrollStrip items={recent} onItemClick={(id) => navigate(`/catalogue/${id}`)} />}
          </FadeIn>
        </Container>
      </Box>

      {/* ── ÇA PEUT VOUS INTÉRESSER ────────────────────────────── */}
      <Box sx={{ py: { xs: 6, md: 8 }, bgcolor: '#fcfaf8' }}>
        <Container maxWidth="lg">
          <FadeIn delay={80}>
            <SectionHeader
              icon={<Sparkles size={22} color={tokens.colors.primary} />}
              title={t('landing.sectionMayLike')}
              subtitle={t('landing.sectionMayLikeSub')}
              onViewAll={() => navigate('/catalogue')}
            />
            {loading ? (
              <Grid container spacing={2.5}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <Grid size={{ xs: 6, sm: 4, md: 3, lg: 3 }} key={i}>
                    <Box sx={{
                      width: '100%', aspectRatio: '2/3', borderRadius: 2,
                      background: 'linear-gradient(90deg,#ede8e1 25%,#f7f2ec 50%,#ede8e1 75%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 1.4s infinite',
                      '@keyframes shimmer': { '0%': { backgroundPosition: '200% 0' }, '100%': { backgroundPosition: '-200% 0' } },
                    }} />
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Grid container spacing={2.5}>
                {mayLike.map((c, i) => (
                  <Grid size={{ xs: 6, sm: 4, md: 3, lg: 3 }} key={c.id}>
                    <Box
                      onClick={() => navigate(`/catalogue/${c.id}`)}
                      sx={{
                        cursor: 'pointer',
                        animation: `fadeSlideUp 0.5s ease ${i * 50}ms both`,
                        '@keyframes fadeSlideUp': {
                          from: { opacity: 0, transform: 'translateY(20px)' },
                          to: { opacity: 1, transform: 'translateY(0)' },
                        },
                        '&:hover .cover-img': { transform: 'translateY(-8px) scale(1.03)', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' },
                        '&:hover .cover-overlay': { opacity: 1 },
                      }}
                    >
                      <Box sx={{ position: 'relative', mb: 1.5 }}>
                        <Box className="cover-img" sx={{
                          width: '100%', aspectRatio: '2/3', borderRadius: 2.5, overflow: 'hidden',
                          bgcolor: '#e8dfd4', boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
                          backgroundImage: c.cover_url ? `url(${c.cover_url})` : undefined,
                          backgroundSize: 'cover', backgroundPosition: 'center',
                          transition: 'transform 0.35s ease, box-shadow 0.35s ease',
                          position: 'relative',
                        }}>
                          <Box sx={{ position: 'absolute', top: 8, left: 8 }}><TypeBadge type={c.content_type} /></Box>
                          <Box className="cover-overlay" sx={{
                            position: 'absolute', inset: 0,
                            background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 60%)',
                            display: 'flex', alignItems: 'flex-end', p: 1.5,
                            opacity: 0, transition: 'opacity 0.3s',
                          }}>
                            <Button size="small" variant="contained"
                              sx={{ bgcolor: tokens.colors.primary, textTransform: 'none', fontSize: '0.72rem', fontWeight: 700, px: 1.5, py: 0.5, borderRadius: 99, '&:hover': { bgcolor: '#9a5418' } }}>
                              {c.content_type === 'audiobook' ? t('common.listen') : t('common.read')}
                            </Button>
                          </Box>
                        </Box>
                      </Box>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#1d160c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.title}
                      </Typography>
                      <Typography sx={{ fontSize: '0.77rem', color: '#8a7a6a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.author}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.3 }}>
                        <Star size={11} fill={tokens.colors.primary} color={tokens.colors.primary} />
                        <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: tokens.colors.primary }}>4.8</Typography>
                      </Box>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            )}
          </FadeIn>
        </Container>
      </Box>

      {/* ── FEATURES ──────────────────────────────────────────── */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: '#f0ebe3' }}>
        <Container maxWidth="lg">
          <FadeIn>
            <Box sx={{ textAlign: 'center', mb: 7 }}>
              <Typography sx={{ fontFamily: 'Playfair Display, serif', fontSize: { xs: '2rem', md: '2.75rem' }, fontWeight: 800, color: '#1d160c', mb: 1.5 }}>
                {t('landing.whyTitle')}
              </Typography>
              <Typography sx={{ color: '#8a7a6a', maxWidth: 560, mx: 'auto', fontSize: '1rem', lineHeight: 1.7 }}>
                {t('landing.whyDesc')}
              </Typography>
            </Box>
            <Grid container spacing={3}>
              {features.map((f, i) => (
                <Grid size={{ xs: 12, sm: 6, md: 3 }} key={i}>
                  <FadeIn delay={i * 80}>
                    <Box sx={{
                      p: 3.5, bgcolor: '#fff', borderRadius: 3,
                      border: '1px solid #e8dfd4',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                      height: '100%',
                      transition: 'transform 0.3s, box-shadow 0.3s',
                      '&:hover': { transform: 'translateY(-6px)', boxShadow: '0 12px 32px rgba(0,0,0,0.1)' },
                    }}>
                      <Box sx={{ width: 52, height: 52, borderRadius: 2, bgcolor: 'rgba(181,101,29,0.1)', display: 'grid', placeItems: 'center', color: tokens.colors.primary, mb: 2 }}>
                        {f.icon}
                      </Box>
                      <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: '#1d160c', mb: 1 }}>{f.title}</Typography>
                      <Typography sx={{ color: '#8a7a6a', fontSize: '0.875rem', lineHeight: 1.65 }}>{f.description}</Typography>
                    </Box>
                  </FadeIn>
                </Grid>
              ))}
            </Grid>
          </FadeIn>
        </Container>
      </Box>

      {/* ── CTA ───────────────────────────────────────────────── */}
      <FadeIn>
        <Box sx={{ py: 10, px: 3, bgcolor: '#fcfaf8' }}>
          <Container maxWidth="lg">
            <Box sx={{
              background: `linear-gradient(135deg, #1d160c 0%, #3d2b1a 60%, ${tokens.colors.primary} 100%)`,
              borderRadius: 4, p: { xs: 5, md: 9 }, textAlign: 'center',
              color: 'white', position: 'relative', overflow: 'hidden',
            }}>
              {/* Decorative orbs */}
              <Box sx={{ position: 'absolute', top: -80, right: -80, width: 280, height: 280, borderRadius: '50%', bgcolor: 'rgba(212,160,23,0.15)', filter: 'blur(60px)' }} />
              <Box sx={{ position: 'absolute', bottom: -60, left: -60, width: 220, height: 220, borderRadius: '50%', bgcolor: 'rgba(181,101,29,0.2)', filter: 'blur(50px)' }} />
              <Box sx={{ position: 'relative', zIndex: 1, maxWidth: 680, mx: 'auto' }}>
                <Typography sx={{ fontFamily: 'Playfair Display, serif', fontSize: { xs: '2rem', md: '2.8rem' }, mb: 2.5, lineHeight: 1.2, fontWeight: 800 }}>
                  {t('landing.ctaReady')}
                </Typography>
                <Typography sx={{ mb: 1.5, opacity: 0.88, fontSize: '1.05rem', lineHeight: 1.7 }}>
                  {t('landing.ctaJoin')}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.5, mb: 4, flexWrap: 'wrap' }}>
                  <Box sx={{ px: 2, py: 0.7, borderRadius: 99, bgcolor: 'rgba(212,160,23,0.2)', border: '1px solid rgba(212,160,23,0.3)', maxWidth: '100%' }}>
                    <Typography sx={{ color: tokens.colors.secondary, fontWeight: 700, fontSize: { xs: '0.95rem', sm: '1.05rem' }, textAlign: 'center', overflowWrap: 'anywhere' }}>{formatPrice(500)} {t('common.per_month')}</Typography>
                  </Box>
                  <Box sx={{ px: 2, py: 0.7, borderRadius: 99, bgcolor: 'rgba(212,160,23,0.2)', border: '1px solid rgba(212,160,23,0.3)', maxWidth: '100%' }}>
                    <Typography sx={{ color: tokens.colors.secondary, fontWeight: 700, fontSize: { xs: '0.95rem', sm: '1.05rem' }, textAlign: 'center', overflowWrap: 'anywhere' }}>{formatPrice(5000)} {t('common.per_year')}</Typography>
                  </Box>
                </Box>
                <Button variant="contained" size="large"
                  sx={{ bgcolor: tokens.colors.secondary, color: '#1d160c', px: 5, py: 1.8, fontSize: '1.05rem', fontWeight: 800, textTransform: 'none', borderRadius: 2.5, boxShadow: '0 8px 32px rgba(212,160,23,0.4)', '&:hover': { bgcolor: '#c49014', transform: 'translateY(-2px)' }, transition: 'all 0.25s' }}
                  onClick={() => navigate('/register')}>
                  {t('landing.heroCta3')}
                </Button>
              </Box>
            </Box>
          </Container>
        </Box>
      </FadeIn>

      {/* ── FOOTER ────────────────────────────────────────────── */}
      <Box component="footer" sx={{ bgcolor: '#1d160c', pt: 8, pb: 4, color: 'rgba(255,255,255,0.7)' }}>
        <Container maxWidth="lg">
          <Grid container spacing={5} sx={{ mb: 6 }}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Box sx={{ mb: 2.5 }}>
                <Box
                  component="img"
                  src={papyriLogo}
                  alt="Papyri"
                  sx={{ height: 44, objectFit: 'contain', objectPosition: 'left center', display: 'block', filter: 'brightness(0) invert(1)' }}
                />
              </Box>
              <Typography sx={{ lineHeight: 1.75, fontSize: '0.875rem', maxWidth: 280 }}>
                {t('landing.footerDesc')}
              </Typography>
            </Grid>
            {[
              {
                title: t('landing.footerNavTitle'),
                links: [
                  { label: t('common.home'), action: () => navigate('/') },
                  { label: t('publicNav.library'), action: () => navigate('/catalogue') },
                  { label: t('publicNav.newReleases'), action: () => navigate('/catalogue?sort=newest') },
                  { label: t('publicNav.pricing'), action: () => navigate('/pricing') },
                  { label: t('publicNav.login'), action: () => navigate('/login') },
                  { label: t('publicNav.register'), action: () => navigate('/register') },
                ],
              },
              {
                title: t('landing.footerSupportTitle'),
                links: [
                  { label: t('landing.footerHelp'), action: null },
                  { label: t('landing.footerFaq'), action: null },
                  { label: t('landing.footerContact'), action: null },
                ],
              },
              {
                title: t('landing.footerLegalTitle'),
                links: [
                  { label: t('legal.cgu'), action: () => navigate('/cgu') },
                  { label: t('legal.cgv'), action: () => navigate('/cgv') },
                  { label: t('legal.privacy'), action: () => navigate('/privacy') },
                  { label: t('legal.cookies'), action: () => navigate('/cookies') },
                  { label: t('legal.legalNotice'), action: () => navigate('/mentions-legales') },
                  { label: t('legal.copyright'), action: () => navigate('/copyright') },
                ],
              },
            ].map((col) => (
              <Grid size={{ xs: 6, md: 4, lg: 2.66 }} key={col.title}>
                <Typography sx={{ fontWeight: 700, color: '#fff', mb: 2, fontSize: '0.9rem' }}>{col.title}</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
                  {col.links.map((link) => (
                    <Typography
                      key={link.label}
                      onClick={link.action}
                      sx={{
                        fontSize: '0.875rem',
                        cursor: link.action ? 'pointer' : 'default',
                        opacity: link.action ? 1 : 0.45,
                        transition: 'color 0.2s',
                        '&:hover': link.action ? { color: tokens.colors.secondary } : {},
                      }}
                    >
                      {link.label}
                    </Typography>
                  ))}
                </Box>
              </Grid>
            ))}
          </Grid>
          <Box sx={{ pt: 4, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Typography sx={{ fontSize: '0.8rem' }}>{t('landing.footerCopyright')}</Typography>
            <Typography sx={{ fontSize: '0.8rem' }}>{t('landing.footerLocation')}</Typography>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
