import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Container,
  Grid,
  Typography,
  Box,
  Pagination,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
  Chip,
  Skeleton,
  Alert,
  Paper,
  List,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  ClickAwayListener,
  IconButton,
  CircularProgress,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import HeadphonesOutlinedIcon from '@mui/icons-material/HeadphonesOutlined';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { contentsService } from '../services/contents.service';
import { subscriptionsService } from '../services/subscriptions.service';
import ContentCard from '../components/ContentCard';
import * as authService from '../services/auth.service';
import tokens from '../config/tokens';
import PublicHeader from '../components/PublicHeader';
import TopNavBar from '../components/TopNavBar';

/**
 * Page de catalogue des contenus
 */
export default function CatalogPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchRef = useRef(null);

  const [contents, setContents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);

  // Filtres — synchronisés avec l'URL
  const contentType = searchParams.get('type') || '';
  const language = searchParams.get('lang') || '';
  const category = searchParams.get('category') || '';
  const sortBy = searchParams.get('sort') || 'newest';
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');

  // Autocomplete
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const suggestTimer = useRef(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const limit = 12;

  // Auth check + user profile
  useEffect(() => {
    authService.isAuthenticated()
      .then(async (v) => {
        setIsAuthenticated(Boolean(v));
        if (v) {
          const u = await authService.getUser().catch(() => null);
          setUser(u);
          const subData = await subscriptionsService.getMySubscription().catch(() => null);
          setHasActiveSubscription(subData?.data?.subscription?.status === 'active');
        }
      })
      .catch(() => setIsAuthenticated(false));
  }, []);

  // Charger les catégories au montage
  useEffect(() => {
    loadCategories();
  }, []);

  // Charger les contenus quand les filtres changent (hors recherche)
  useEffect(() => {
    if (!searchQuery) {
      loadContents();
    }
  }, [page, contentType, language, category, sortBy]); // eslint-disable-line react-hooks/exhaustive-deps

  // Recherche avec debounce — reset page à 1 quand query/filtres changent
  useEffect(() => {
    if (!searchQuery) {
      return;
    }
    setPage(1);
    const debounceTimer = setTimeout(() => {
      performSearch(1);
    }, 500);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, contentType, language, category]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pagination pendant une recherche active
  useEffect(() => {
    if (searchQuery && page > 1) {
      performSearch(page);
    }
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadCategories = async () => {
    try {
      const data = await contentsService.getCategories();
      setCategories(data);
    } catch (err) {
      console.error('Erreur chargement catégories:', err);
    }
  };

  const loadContents = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = {
        page,
        limit,
        sort: sortBy,
        order: 'desc'
      };

      if (contentType) params.type = contentType;
      if (language) params.language = language;
      if (category) params.category = category;

      const response = await contentsService.getContents(params);

      setContents(response.data || []);
      setTotalPages(response.meta?.totalPages || 1);
      setTotalItems(response.meta?.total || 0);
    } catch (err) {
      console.error('Erreur chargement contenus:', err);
      setError('Impossible de charger le catalogue. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const performSearch = async (targetPage = 1) => {
    setLoading(true);
    setError(null);

    try {
      const params = { limit, offset: (targetPage - 1) * limit };
      if (contentType) params.type = contentType;
      if (language) params.language = language;
      if (category) params.category = category;
      if (sortBy) params.sort = sortBy;

      const response = await contentsService.search(searchQuery, params);

      // Meilisearch retourne { hits: [...], estimatedTotalHits: number }
      setContents(response.hits || []);
      const total = response.estimatedTotalHits || 0;
      setTotalItems(total);
      setTotalPages(Math.ceil(total / limit));
    } catch (err) {
      console.error('Erreur recherche:', err);
      setError('Erreur lors de la recherche. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (event, value) => {
    setPage(value);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const updateFilter = (key, value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
      next.delete('page');
      return next;
    }, { replace: true });
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    setSearchParams({}, { replace: true });
    setPage(1);
  };

  const handleSearchChange = useCallback((e) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (!val || val.length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    setSuggestLoading(true);
    suggestTimer.current = setTimeout(async () => {
      const results = await contentsService.suggest(val);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
      setSuggestLoading(false);
    }, 280);
  }, []);

  const handleSuggestionClick = useCallback((item) => {
    setShowSuggestions(false);
    setSuggestions([]);
    navigate(`/catalogue/${item.id}`);
  }, [navigate]);

  const handleSearchBlurAway = useCallback(() => {
    setShowSuggestions(false);
  }, []);

  const activeFiltersCount = [contentType, language, category].filter(Boolean).length;

  return (
    <Box sx={{ bgcolor: '#fcfaf8', minHeight: '100vh' }}>
      {isAuthenticated
        ? (
          <TopNavBar
            user={user}
            searchPlaceholder="Rechercher un titre, un auteur…"
            searchValue={searchQuery}
            onSearchChange={(v) => { setSearchQuery(v); setPage(1); }}
            onSearch={(q) => { setSearchQuery(q); setPage(1); setSearchParams((prev) => { const p = new URLSearchParams(prev); if (q) p.set('q', q); else p.delete('q'); return p; }); }}
          />
        )
        : <PublicHeader activeKey="catalogue" isAuthenticated={false} background="#fcfaf8" />
      }

      <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* En-tête */}
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h3"
          component="h1"
          gutterBottom
          sx={{ fontFamily: 'Playfair Display, serif', color: 'primary.main' }}
        >
          Catalogue
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {searchQuery ? (
            <>
              <strong>{totalItems}</strong> résultat{totalItems > 1 ? 's' : ''} pour "{searchQuery}"
            </>
          ) : (
            <>Découvrez notre collection de {totalItems} livres et livres audio</>
          )}
        </Typography>
      </Box>

      {/* Barre de recherche et filtres */}
      <Box sx={{ mb: 4 }}>
        {/* Recherche avec autocomplete */}
        <ClickAwayListener onClickAway={handleSearchBlurAway}>
          <Box ref={searchRef} sx={{ position: 'relative', mb: 2 }}>
            <TextField
              fullWidth
              placeholder="Rechercher un titre, un auteur…"
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              autoComplete="off"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    {suggestLoading
                      ? <CircularProgress size={18} sx={{ color: 'text.secondary' }} />
                      : <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                    }
                  </InputAdornment>
                ),
                endAdornment: searchQuery ? (
                  <InputAdornment position="end">
                    <IconButton size="small" aria-label="Effacer la recherche" onClick={() => { setSearchQuery(''); setSuggestions([]); setShowSuggestions(false); }}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: showSuggestions ? '12px 12px 0 0' : '12px', bgcolor: '#fff' } }}
            />
            {showSuggestions && (
              <Paper elevation={8} sx={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1200,
                borderRadius: '0 0 12px 12px', overflow: 'hidden',
                border: '1px solid', borderColor: 'divider', borderTop: 'none',
              }}>
                <List disablePadding>
                  {suggestions.map((item, i) => (
                    <ListItemButton
                      key={item.id}
                      onClick={() => handleSuggestionClick(item)}
                      divider={i < suggestions.length - 1}
                      sx={{ py: 1, '&:hover': { bgcolor: '#faf8f5' } }}
                    >
                      <ListItemAvatar sx={{ minWidth: 44 }}>
                        {item.cover_url
                          ? <Avatar src={item.cover_url} alt={item.title} variant="rounded" sx={{ width: 32, height: 44, borderRadius: '4px' }} />
                          : <Avatar variant="rounded" sx={{ width: 32, height: 44, borderRadius: '4px', bgcolor: '#e8e0d8' }}>
                              {item.content_type === 'audiobook'
                                ? <HeadphonesOutlinedIcon sx={{ fontSize: 16, color: tokens.colors.primary }} />
                                : <MenuBookOutlinedIcon sx={{ fontSize: 16, color: tokens.colors.accent }} />
                              }
                            </Avatar>
                        }
                      </ListItemAvatar>
                      <ListItemText
                        primary={<Typography variant="body2" fontWeight={600} noWrap>{item.title}</Typography>}
                        secondary={<Typography variant="caption" color="text.secondary" noWrap>{item.author}</Typography>}
                      />
                      <Chip
                        label={item.content_type === 'audiobook' ? 'Audio' : 'Ebook'}
                        size="small"
                        sx={{ ml: 1, fontSize: '0.65rem', height: 18,
                          bgcolor: item.content_type === 'audiobook' ? '#FFF3E0' : '#E8EAF6',
                          color: item.content_type === 'audiobook' ? '#E65100' : '#1A237E',
                        }}
                      />
                    </ListItemButton>
                  ))}
                </List>
              </Paper>
            )}
          </Box>
        </ClickAwayListener>

        {/* Filtres */}
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Type</InputLabel>
              <Select
                value={contentType}
                label="Type"
                onChange={(e) => updateFilter('type', e.target.value)}
              >
                <MenuItem value="">Tous</MenuItem>
                <MenuItem value="ebook">Ebooks</MenuItem>
                <MenuItem value="audiobook">Livres audio</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Langue</InputLabel>
              <Select
                value={language}
                label="Langue"
                onChange={(e) => updateFilter('lang', e.target.value)}
              >
                <MenuItem value="">Toutes</MenuItem>
                <MenuItem value="fr">Français</MenuItem>
                <MenuItem value="en">Anglais</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Catégorie</InputLabel>
              <Select
                value={category}
                label="Catégorie"
                onChange={(e) => updateFilter('category', e.target.value)}
              >
                <MenuItem value="">Toutes</MenuItem>
                {Array.isArray(categories) && categories.map((cat) => (
                  <MenuItem key={cat.id} value={cat.slug}>
                    {cat.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Trier par</InputLabel>
              <Select
                value={sortBy}
                label="Trier par"
                onChange={(e) => updateFilter('sort', e.target.value)}
              >
                <MenuItem value="newest">Plus récents</MenuItem>
                <MenuItem value="title">Titre (A-Z)</MenuItem>
                <MenuItem value="popular">Populaires</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {/* Filtres actifs */}
        {activeFiltersCount > 0 && (
          <Box sx={{ mt: 2, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="body2" color="text.secondary">
              Filtres actifs :
            </Typography>
            <Chip
              label={`${activeFiltersCount} filtre(s)`}
              size="small"
              onDelete={handleResetFilters}
              color="primary"
            />
          </Box>
        )}
      </Box>

      {/* Erreur */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Grille de contenus */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {loading ? (
          // Skeleton loading
          Array.from(new Array(limit)).map((_, index) => (
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={index}>
              <Skeleton variant="rectangular" height={280} sx={{ mb: 1 }} />
              <Skeleton variant="text" width="80%" />
              <Skeleton variant="text" width="60%" />
              <Skeleton variant="text" width="100%" />
            </Grid>
          ))
        ) : contents.length === 0 ? (
          <Grid size={{ xs: 12 }}>
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                Aucun contenu trouvé
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Essayez de modifier vos critères de recherche
              </Typography>
            </Box>
          </Grid>
        ) : (
          Array.isArray(contents) && contents.map((content) => (
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={content.id}>
              <ContentCard content={content} hasActiveSubscription={hasActiveSubscription} />
            </Grid>
          ))
        )}
      </Grid>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={handlePageChange}
            color="primary"
            size="large"
            showFirstButton
            showLastButton
          />
        </Box>
      )}
      </Container>
    </Box>
  );
}
