import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  CircularProgress,
  FormControl,
  Grid,
  InputBase,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import MenuBookOutlined from '@mui/icons-material/MenuBookOutlined';
import HeadphonesOutlined from '@mui/icons-material/HeadphonesOutlined';
import AutoStoriesOutlined from '@mui/icons-material/AutoStoriesOutlined';
import tokens from '../config/tokens';
import * as authService from '../services/auth.service';
import { contentsService } from '../services/contents.service';
import { subscriptionsService } from '../services/subscriptions.service';
import UserSpaceSidebar from '../components/UserSpaceSidebar';
import MobileBottomNav from '../components/MobileBottomNav';
import ContentCard from '../components/ContentCard';

const textMuted = '#9c7e49';
const surfaceVariant = tokens.colors.surfaces.light.variant;

export default function LibraryCatalogPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [user, setUser] = useState(null);
  const [subscriptionData, setSubscriptionData] = useState(null);
  const subscriptionLabel = useMemo(() => {
    if (!subscriptionData) return t('common.loading');
    const { type, endDate } = subscriptionData;
    if (type === 'cancelled' && endDate) return t('libraryCatalog.subscriptionCancelled', { date: endDate });
    if (type === 'active' && endDate) return t('libraryCatalog.subscriptionActive', { date: endDate });
    if (type === 'active') return t('libraryCatalog.subscriptionActiveNoDate');
    return t('libraryCatalog.subscriptionNone');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscriptionData, i18n.language]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [contentType, setContentType] = useState('');
  const [language, setLanguage] = useState('');
  const [category, setCategory] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [categories, setCategories] = useState([]);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const activeFiltersCount = [contentType, language, category].filter(Boolean).length;

  useEffect(() => {
    let alive = true;

    const loadContext = async () => {
      try {
        const u = await authService.getUser();
        if (alive) setUser(u);

        try {
          const sub = await subscriptionsService.getMySubscription();
          if (!alive) return;
          const subscription = sub?.subscription || null;
          const isActive = sub?.isActive === true;
          const cancelAtPeriodEnd = Boolean(subscription?.cancel_at_period_end);
          const locale = i18n.language?.startsWith('fr') ? 'fr-FR' : 'en-US';
          const endDate = subscription?.current_period_end
            ? new Date(subscription.current_period_end).toLocaleDateString(locale)
            : '';

          setHasActiveSubscription(isActive);

          if (isActive && cancelAtPeriodEnd && endDate) {
            setSubscriptionData({ type: 'cancelled', endDate });
          } else if (isActive && endDate) {
            setSubscriptionData({ type: 'active', endDate });
          } else if (isActive) {
            setSubscriptionData({ type: 'active', endDate: '' });
          } else {
            setSubscriptionData({ type: 'none', endDate: '' });
          }
        } catch (_) {
          if (alive) {
            setHasActiveSubscription(false);
            setSubscriptionData({ type: 'none', endDate: '' });
          }
        }
      } catch (err) {
        console.error('Failed to load user context:', err);
      }
    };

    loadContext();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;

    const loadCategories = async () => {
      try {
        const data = await contentsService.getCategories();
        if (!alive) return;
        setCategories(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to load user catalog categories:', err);
      }
    };

    loadCategories();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    const loadContents = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await contentsService.getContents({
          page: 1,
          limit: 60,
          sort: sortBy,
          ...(contentType ? { type: contentType } : {}),
          ...(language ? { language } : {}),
          ...(category ? { category } : {}),
        });
        if (!alive) return;
        setItems(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error('Failed to load user catalog:', err);
        if (alive) setError(t('libraryCatalog.cannotLoad'));
      } finally {
        if (alive) setLoading(false);
      }
    };

    loadContents();
    return () => { alive = false; };
  }, [category, contentType, language, sortBy, t]);

  const visibleItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const title = String(item.title || '').toLowerCase();
      const author = String(item.author || '').toLowerCase();
      return title.includes(q) || author.includes(q);
    });
  }, [items, searchQuery]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: tokens.colors.backgrounds.light, display: 'flex' }}>
      <UserSpaceSidebar user={user} activeKey="catalog" subscriptionLabel={subscriptionLabel} />

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ maxWidth: 1440, mx: 'auto', px: { xs: 1.25, sm: 2, md: 3 }, py: { xs: 1.5, md: 3 } }}>
          <Box sx={{ mb: 3 }}>
            <Typography
              variant="h1"
              sx={{
                fontFamily: '"Newsreader", Georgia, serif',
                fontSize: { xs: '1.9rem', sm: '2.2rem', md: '3.1rem' },
                fontWeight: 800,
                color: tokens.colors.onBackground.light,
                lineHeight: 1.2,
                letterSpacing: '-0.033em',
              }}
            >
              {t('libraryCatalog.pageTitle')}
            </Typography>
            <Typography sx={{ mt: 0.75, fontSize: '1rem', color: textMuted }}>
              {t('libraryCatalog.pageSubtitle')}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 1.5, mb: 3, alignItems: 'stretch', flexWrap: 'wrap' }}>
            <Box sx={{ flex: '1 1 280px', bgcolor: surfaceVariant, borderRadius: '12px', minHeight: 48, display: 'flex', alignItems: 'center', px: 2 }}>
              <SearchIcon sx={{ color: textMuted, mr: 1.5 }} />
              <InputBase
                placeholder={t('libraryCatalog.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={{ flex: 1, fontSize: '0.95rem', color: tokens.colors.onBackground.light, '& input::placeholder': { color: textMuted, opacity: 1 } }}
              />
            </Box>

            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 220, md: 180 } }}>
              <InputLabel id="user-catalog-type-label">{t('catalog.format')}</InputLabel>
              <Select
                labelId="user-catalog-type-label"
                value={contentType}
                label={t('catalog.format')}
                onChange={(e) => setContentType(e.target.value)}
                sx={{ borderRadius: '12px', bgcolor: '#fff' }}
              >
                <MenuItem value="">{t('libraryCatalog.allContents')}</MenuItem>
                <MenuItem value="ebook">{t('libraryCatalog.ebooks')}</MenuItem>
                <MenuItem value="audiobook">{t('libraryCatalog.audiobooks')}</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 220, md: 180 } }}>
              <InputLabel id="user-catalog-language-label">{t('catalog.language')}</InputLabel>
              <Select
                labelId="user-catalog-language-label"
                value={language}
                label={t('catalog.language')}
                onChange={(e) => setLanguage(e.target.value)}
                sx={{ borderRadius: '12px', bgcolor: '#fff' }}
              >
                <MenuItem value="">{t('catalog.allLanguages')}</MenuItem>
                <MenuItem value="fr">Français</MenuItem>
                <MenuItem value="en">English</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 220, md: 220 } }}>
              <InputLabel id="user-catalog-category-label">{t('catalog.category')}</InputLabel>
              <Select
                labelId="user-catalog-category-label"
                value={category}
                label={t('catalog.category')}
                onChange={(e) => setCategory(e.target.value)}
                sx={{ borderRadius: '12px', bgcolor: '#fff' }}
              >
                <MenuItem value="">{t('catalog.allCategories')}</MenuItem>
                {categories.map((cat) => (
                  <MenuItem key={cat.id} value={cat.slug}>
                    {cat.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 220, md: 180 } }}>
              <InputLabel id="user-catalog-sort-label">{t('catalog.sortBy')}</InputLabel>
              <Select
                labelId="user-catalog-sort-label"
                value={sortBy}
                label={t('catalog.sortBy')}
                onChange={(e) => setSortBy(e.target.value)}
                sx={{ borderRadius: '12px', bgcolor: '#fff' }}
              >
                <MenuItem value="newest">{t('catalog.sortNewest')}</MenuItem>
                <MenuItem value="title">{t('catalog.sortAlpha')}</MenuItem>
                <MenuItem value="popular">{t('catalog.sortPopular')}</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
            {[
              { key: '', label: t('common.all'), icon: <AutoStoriesOutlined fontSize="small" /> },
              { key: 'ebook', label: t('libraryCatalog.ebooks'), icon: <MenuBookOutlined fontSize="small" /> },
              { key: 'audiobook', label: t('libraryCatalog.audiobooks'), icon: <HeadphonesOutlined fontSize="small" /> },
            ].map((filter) => {
              const isActive = contentType === filter.key;
              return (
                <Box
                  key={filter.label}
                  onClick={() => setContentType(filter.key)}
                  sx={{
                    px: 1.5,
                    py: 1,
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    cursor: 'pointer',
                    bgcolor: isActive ? `${tokens.colors.primary}1A` : surfaceVariant,
                    color: isActive ? tokens.colors.primary : tokens.colors.onBackground.light,
                    '&:hover': { bgcolor: isActive ? `${tokens.colors.primary}1A` : `${tokens.colors.primary}12` },
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

          {activeFiltersCount > 0 && (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 3 }}>
              <Typography sx={{ fontSize: '0.8rem', color: textMuted, fontWeight: 600 }}>
                {t('catalog.filterBy')}
              </Typography>
              <Box
                onClick={() => {
                  setContentType('');
                  setLanguage('');
                  setCategory('');
                }}
                sx={{
                  px: 1.25,
                  py: 0.7,
                  borderRadius: '999px',
                  bgcolor: `${tokens.colors.primary}18`,
                  color: tokens.colors.primary,
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {activeFiltersCount}
              </Box>
            </Box>
          )}

          {error ? <Alert severity="warning" sx={{ mb: 3 }}>{error}</Alert> : null}

          {loading ? (
            <Box sx={{ minHeight: '40vh', display: 'grid', placeItems: 'center' }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.2, gap: 1 }}>
                <Typography sx={{ fontSize: '1.2rem', fontWeight: 700, color: tokens.colors.onBackground.light }}>
                  {t('libraryCatalog.allBooks')}
                </Typography>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: tokens.colors.primary }}>
                  {visibleItems.length} {t(visibleItems.length > 1 ? 'libraryCatalog.titlePlural' : 'libraryCatalog.titleSingular')}
                </Typography>
              </Box>

              {visibleItems.length === 0 ? (
                <Paper elevation={0} sx={{ p: 2.5, borderRadius: '16px', border: `1px solid ${surfaceVariant}` }}>
                  <Typography sx={{ color: textMuted, fontSize: '0.95rem' }}>
                    {t('libraryCatalog.noResults')}
                  </Typography>
                </Paper>
              ) : (
                <Grid container spacing={{ xs: 1.5, md: 2 }}>
                  {visibleItems.map((item) => (
                    <Grid size={{ xs: 6, sm: 4, md: 3, lg: 2.4 }} key={item.id}>
                      <ContentCard content={item} hasActiveSubscription={hasActiveSubscription} />
                    </Grid>
                  ))}
                </Grid>
              )}
            </>
          )}
        </Box>
      </Box>

      <MobileBottomNav />
    </Box>
  );
}
