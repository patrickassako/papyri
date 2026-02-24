import React, { useState, useEffect } from 'react';
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
  Alert
} from '@mui/material';
import { Search } from 'lucide-react';
import { contentsService } from '../services/contents.service';
import ContentCard from '../components/ContentCard';
import * as authService from '../services/auth.service';
import PublicHeader from '../components/PublicHeader';

/**
 * Page de catalogue des contenus
 */
export default function CatalogPage() {
  const [contents, setContents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Filtres
  const [contentType, setContentType] = useState('');
  const [language, setLanguage] = useState('');
  const [category, setCategory] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const limit = 12;

  // Auth check
  useEffect(() => {
    authService.isAuthenticated()
      .then((v) => setIsAuthenticated(Boolean(v)))
      .catch(() => setIsAuthenticated(false));
  }, []);

  // Charger les catégories au montage
  useEffect(() => {
    loadCategories();
  }, []);

  // Charger les contenus quand les filtres changent
  useEffect(() => {
    loadContents();
  }, [page, contentType, language, category, sortBy]);

  // Recherche avec debounce
  useEffect(() => {
    if (!searchQuery) {
      return; // Ne rien faire, laisser loadContents() gérer le chargement normal
    }

    const debounceTimer = setTimeout(() => {
      performSearch();
    }, 500); // 500ms de délai

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, contentType, language, category]);

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

  const performSearch = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = { limit };
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
      setPage(1);
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

  const handleResetFilters = () => {
    setContentType('');
    setLanguage('');
    setCategory('');
    setSortBy('newest');
    setSearchQuery('');
    setPage(1);
  };

  const activeFiltersCount = [contentType, language, category].filter(Boolean).length;

  return (
    <Box sx={{ bgcolor: '#fcfaf8', minHeight: '100vh' }}>
      <PublicHeader activeKey="catalogue" isAuthenticated={isAuthenticated} background="#fcfaf8" />

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
        {/* Recherche */}
        <TextField
          fullWidth
          placeholder="Rechercher un titre, un auteur..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search size={20} />
              </InputAdornment>
            )
          }}
        />

        {/* Filtres */}
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Type</InputLabel>
              <Select
                value={contentType}
                label="Type"
                onChange={(e) => {
                  setContentType(e.target.value);
                  setPage(1);
                }}
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
                onChange={(e) => {
                  setLanguage(e.target.value);
                  setPage(1);
                }}
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
                onChange={(e) => {
                  setCategory(e.target.value);
                  setPage(1);
                }}
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
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setPage(1);
                }}
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
              <ContentCard content={content} />
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
