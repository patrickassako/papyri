import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const [user, setUser] = useState(null);
  const [subscriptionLabel, setSubscriptionLabel] = useState('Chargement de l abonnement...');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [contentType, setContentType] = useState('');
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);

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
          const endDate = subscription?.current_period_end
            ? new Date(subscription.current_period_end).toLocaleDateString('fr-FR')
            : '';

          setHasActiveSubscription(isActive);

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
          if (alive) {
            setHasActiveSubscription(false);
            setSubscriptionLabel('Aucun abonnement actif');
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
    const loadContents = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await contentsService.getContents({
          page: 1,
          limit: 60,
          sort: 'newest',
          order: 'desc',
          ...(contentType ? { content_type: contentType } : {}),
        });
        if (!alive) return;
        setItems(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error('Failed to load user catalog:', err);
        if (alive) setError('Impossible de charger le catalogue.');
      } finally {
        if (alive) setLoading(false);
      }
    };

    loadContents();
    return () => { alive = false; };
  }, [contentType]);

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
              Catalogue
            </Typography>
            <Typography sx={{ mt: 0.75, fontSize: '1rem', color: textMuted }}>
              Retrouvez tout le catalogue depuis votre espace utilisateur.
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 1.5, mb: 3, alignItems: 'stretch', flexWrap: 'wrap' }}>
            <Box sx={{ flex: '1 1 280px', bgcolor: surfaceVariant, borderRadius: '12px', minHeight: 48, display: 'flex', alignItems: 'center', px: 2 }}>
              <SearchIcon sx={{ color: textMuted, mr: 1.5 }} />
              <InputBase
                placeholder="Rechercher un titre ou un auteur..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={{ flex: 1, fontSize: '0.95rem', color: tokens.colors.onBackground.light, '& input::placeholder': { color: textMuted, opacity: 1 } }}
              />
            </Box>

            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 220 } }}>
              <InputLabel id="user-catalog-type-label">Type</InputLabel>
              <Select
                labelId="user-catalog-type-label"
                value={contentType}
                label="Type"
                onChange={(e) => setContentType(e.target.value)}
                sx={{ borderRadius: '12px', bgcolor: '#fff' }}
              >
                <MenuItem value="">Tous les contenus</MenuItem>
                <MenuItem value="ebook">Ebooks</MenuItem>
                <MenuItem value="audiobook">Livres audio</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
            {[
              { key: '', label: 'Tout', icon: <AutoStoriesOutlined fontSize="small" /> },
              { key: 'ebook', label: 'Ebooks', icon: <MenuBookOutlined fontSize="small" /> },
              { key: 'audiobook', label: 'Audio', icon: <HeadphonesOutlined fontSize="small" /> },
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

          {error ? <Alert severity="warning" sx={{ mb: 3 }}>{error}</Alert> : null}

          {loading ? (
            <Box sx={{ minHeight: '40vh', display: 'grid', placeItems: 'center' }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.2, gap: 1 }}>
                <Typography sx={{ fontSize: '1.2rem', fontWeight: 700, color: tokens.colors.onBackground.light }}>
                  Tous les livres
                </Typography>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: tokens.colors.primary }}>
                  {visibleItems.length} titre{visibleItems.length > 1 ? 's' : ''}
                </Typography>
              </Box>

              {visibleItems.length === 0 ? (
                <Paper elevation={0} sx={{ p: 2.5, borderRadius: '16px', border: `1px solid ${surfaceVariant}` }}>
                  <Typography sx={{ color: textMuted, fontSize: '0.95rem' }}>
                    Aucun contenu ne correspond à votre recherche.
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
