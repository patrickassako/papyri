/**
 * AdminPublisherBooksListPage
 * Route: /admin/books/publisher/:publisherId
 * List of books for a given publisher (or orphan Papyri books)
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Grid,
  Card,
  CardActionArea,
  CardMedia,
  CardContent,
  Typography,
  Chip,
  Alert,
  TextField,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  IconButton,
  Avatar,
  Skeleton,
  Pagination,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  Button,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import GridViewIcon from '@mui/icons-material/GridView';
import ListIcon from '@mui/icons-material/ViewList';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import HeadphonesIcon from '@mui/icons-material/Headphones';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import LocalLibraryIcon from '@mui/icons-material/LocalLibrary';
import FilterListIcon from '@mui/icons-material/FilterList';
import SortIcon from '@mui/icons-material/Sort';
import { authFetch } from '../../services/auth.service';
import tokens from '../../config/tokens';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const C = {
  terre: tokens.colors.primary,
  indigo: tokens.colors.accent,
  green: '#27ae60',
  red: '#e74c3c',
  orange: '#FF9800',
  grey: '#8c8c8c',
  lightGrey: '#f0f0f0',
  textPrimary: '#1a1a2e',
  textSecondary: '#6b7280',
  bg: '#F7F6F3',
};

const VALIDATION_CONFIG = {
  pending:  { label: 'En attente', color: C.orange },
  approved: { label: 'Approuvé',   color: C.green },
  rejected: { label: 'Rejeté',     color: C.red },
  paused:   { label: 'Pausé',      color: C.grey },
  null:     { label: 'Direct',     color: C.indigo },
};

function ValidationBadge({ status }) {
  const cfg = VALIDATION_CONFIG[status] || VALIDATION_CONFIG.null;
  return (
    <Chip
      label={cfg.label}
      size="small"
      sx={{
        bgcolor: `${cfg.color}18`,
        color: cfg.color,
        fontWeight: 600,
        fontSize: '0.68rem',
        height: 22,
      }}
    />
  );
}

function TypeBadge({ type }) {
  if (type === 'audiobook')
    return (
      <Chip
        icon={<HeadphonesIcon sx={{ fontSize: '14px !important' }} />}
        label="Audio"
        size="small"
        sx={{ bgcolor: `${C.orange}18`, color: C.orange, fontWeight: 600, fontSize: '0.68rem', height: 22 }}
      />
    );
  if (type === 'both')
    return (
      <Chip
        icon={<AutoStoriesIcon sx={{ fontSize: '14px !important' }} />}
        label="Les 2"
        size="small"
        sx={{ bgcolor: `${C.terre}18`, color: C.terre, fontWeight: 600, fontSize: '0.68rem', height: 22 }}
      />
    );
  return (
    <Chip
      icon={<MenuBookIcon sx={{ fontSize: '14px !important' }} />}
      label="Ebook"
      size="small"
      sx={{ bgcolor: `${C.indigo}18`, color: C.indigo, fontWeight: 600, fontSize: '0.68rem', height: 22 }}
    />
  );
}

function ArchiveBadge() {
  return (
    <Chip
      label="Archivé"
      size="small"
      sx={{ bgcolor: '#37474f22', color: '#37474f', fontWeight: 700, fontSize: '0.68rem', height: 22 }}
    />
  );
}

// ── Book Card (grid) ─────────────────────────────────────────
function BookCard({ book, onClick }) {
  return (
    <Card
      sx={{
        borderRadius: '16px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        transition: 'box-shadow 0.2s',
        '&:hover': { boxShadow: '0 4px 20px rgba(0,0,0,0.12)' },
        overflow: 'hidden',
      }}
    >
      <CardActionArea onClick={onClick} sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
        <Box sx={{ position: 'relative', height: 160, bgcolor: C.lightGrey, flexShrink: 0 }}>
          {book.cover_url ? (
            <CardMedia
              component="img"
              image={book.cover_url}
              alt={book.title}
              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MenuBookIcon sx={{ fontSize: 48, color: '#ccc' }} />
            </Box>
          )}
          <Box sx={{ position: 'absolute', top: 8, left: 8 }}>
            <TypeBadge type={book.content_type} />
          </Box>
          <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
            <ValidationBadge status={book.validation_status} />
          </Box>
          {book.is_archived && (
            <Box sx={{ position: 'absolute', bottom: 8, left: 8 }}>
              <ArchiveBadge />
            </Box>
          )}
        </Box>
        <CardContent sx={{ flex: 1, p: 1.5 }}>
          <Typography variant="subtitle2" fontWeight={700} color={C.textPrimary} noWrap>
            {book.title || 'Sans titre'}
          </Typography>
          <Typography variant="caption" color={C.textSecondary} noWrap display="block" sx={{ mb: 1 }}>
            {book.author || 'Auteur inconnu'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Box>
              <Typography variant="caption" color={C.textSecondary}>Lectures</Typography>
              <Typography variant="body2" fontWeight={700} color={C.indigo}>{book.totalReads}</Typography>
            </Box>
            {book.submitted_at && (
              <Box>
                <Typography variant="caption" color={C.textSecondary}>Soumis</Typography>
                <Typography variant="body2" fontWeight={500} color={C.textSecondary}>
                  {new Date(book.submitted_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                </Typography>
              </Box>
            )}
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

// ── Book Row (list) ──────────────────────────────────────────
function BookRow({ book, onClick }) {
  return (
    <Card
      sx={{
        borderRadius: '12px',
        boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
        mb: 1,
        '&:hover': { boxShadow: '0 3px 14px rgba(0,0,0,0.1)' },
        transition: 'all 0.2s',
      }}
    >
      <CardActionArea onClick={onClick}>
        <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1.5, gap: 2 }}>
          {/* Cover thumbnail */}
          <Box
            sx={{
              width: 44,
              height: 60,
              borderRadius: '6px',
              overflow: 'hidden',
              bgcolor: C.lightGrey,
              flexShrink: 0,
            }}
          >
            {book.cover_url ? (
              <img src={book.cover_url} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MenuBookIcon sx={{ fontSize: 20, color: '#ccc' }} />
              </Box>
            )}
          </Box>

          {/* Title + author */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight={700} color={C.textPrimary} noWrap>
              {book.title || 'Sans titre'}
            </Typography>
            <Typography variant="caption" color={C.textSecondary} noWrap display="block">
              {book.author || 'Auteur inconnu'}
            </Typography>
          </Box>

          {/* Badges */}
          <Box sx={{ display: 'flex', gap: 0.75, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <TypeBadge type={book.content_type} />
            <ValidationBadge status={book.validation_status} />
            {book.is_archived && <ArchiveBadge />}
          </Box>

          {/* Stats */}
          <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: { sm: 2, md: 3 }, textAlign: 'right', flexShrink: 0 }}>
            <Box>
              <Typography variant="caption" color={C.textSecondary}>Lectures</Typography>
              <Typography variant="body2" fontWeight={700} color={C.indigo}>{book.totalReads}</Typography>
            </Box>
            <Box sx={{ display: { sm: 'none', md: 'block' } }}>
              <Typography variant="caption" color={C.textSecondary}>Complétions</Typography>
              <Typography variant="body2" fontWeight={700} color={C.orange}>{book.completions}</Typography>
            </Box>
            {book.submitted_at && (
              <Box sx={{ display: { sm: 'none', lg: 'block' } }}>
                <Typography variant="caption" color={C.textSecondary}>Soumis</Typography>
                <Typography variant="body2" color={C.textSecondary}>
                  {new Date(book.submitted_at).toLocaleDateString('fr-FR')}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </CardActionArea>
    </Card>
  );
}

// ── Main Page ────────────────────────────────────────────────
const LIMIT = 20;

export default function AdminPublisherBooksListPage() {
  const navigate = useNavigate();
  const { publisherId } = useParams();

  const [books, setBooks] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [sortBy, setSortBy] = useState('title');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState('grid');

  // Publisher display name (resolved from first load)
  const [publisherName, setPublisherName] = useState(
    publisherId === 'orphan' ? 'Papyri — Livres directs' : 'Chargement...'
  );
  const [publisherStats, setPublisherStats] = useState(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page on filter/sort change
  useEffect(() => { setPage(1); }, [filterStatus, filterType, sortBy]);

  const loadBooks = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (filterStatus)   params.set('status', filterStatus);
    if (filterType)     params.set('type', filterType);
    if (sortBy)         params.set('sort', sortBy);

    authFetch(`${API}/api/admin/books-overview/publisher/${publisherId}/books?${params}`)
      .then(r => r.json())
      .then(data => {
        setBooks(data.books || []);
        setTotal(data.total || 0);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [publisherId, page, debouncedSearch, filterStatus, filterType, sortBy]);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  // Fetch publisher name from the publishers list (one-time)
  useEffect(() => {
    if (publisherId === 'orphan') return;
    authFetch(`${API}/api/admin/books-overview/publishers`)
      .then(r => r.json())
      .then(list => {
        const found = list.find(item => item.publisher.id === publisherId);
        if (found) {
          setPublisherName(found.publisher.company_name);
          setPublisherStats(found);
        }
      })
      .catch(() => {});
  }, [publisherId]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <Box sx={{ bgcolor: C.bg, minHeight: '100vh' }}>
      {/* Header */}
      <Box
        sx={{
          bgcolor: '#fff',
          height: 60,
          display: 'flex',
          alignItems: 'center',
          px: 2,
          borderBottom: '1px solid #e5e0d8',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          gap: 1,
        }}
      >
        <IconButton onClick={() => navigate('/admin/books')} size="small" sx={{ color: C.indigo }}>
          <ArrowBackIcon />
        </IconButton>

        {publisherId === 'orphan' ? (
          <AutoStoriesIcon sx={{ color: C.terre, fontSize: 22 }} />
        ) : (
          <LocalLibraryIcon sx={{ color: C.indigo, fontSize: 22 }} />
        )}

        <Typography variant="h6" fontWeight={700} color={C.textPrimary} sx={{ flex: 1 }}>
          {publisherName}
        </Typography>

        {/* Quick stats */}
        {publisherStats && (
          <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 2, mr: 1 }}>
            <Chip
              label={`${publisherStats.bookCount} livres`}
              size="small"
              sx={{ bgcolor: `${C.indigo}12`, color: C.indigo, fontWeight: 600 }}
            />
            <Chip
              label={`${publisherStats.totalReads} lectures`}
              size="small"
              sx={{ bgcolor: `${C.terre}12`, color: C.terre, fontWeight: 600 }}
            />
          </Box>
        )}

        {/* Bouton Ajouter */}
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => navigate(`/admin/publishers/${publisherId}/create-content`)}
          sx={{
            borderRadius: '10px',
            textTransform: 'none',
            fontWeight: 700,
            bgcolor: C.terre,
            '&:hover': { bgcolor: '#9a4f12' },
            px: 2,
            flexShrink: 0,
          }}
        >
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Ajouter un contenu</Box>
          <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>Ajouter</Box>
        </Button>
      </Box>

      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        {/* ── Toolbar row 1: Search + Sort + View toggle ── */}
        <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder="Titre, auteur..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: C.grey, fontSize: 18 }} />
                </InputAdornment>
              ),
            }}
            sx={{ flex: 1, minWidth: 180, '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: '#fff' } }}
          />

          {/* Sort */}
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <Select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              displayEmpty
              startAdornment={<SortIcon sx={{ color: C.grey, fontSize: 18, mr: 0.5 }} />}
              sx={{ borderRadius: '10px', bgcolor: '#fff' }}
            >
              <MenuItem value="title">A → Z</MenuItem>
              <MenuItem value="recent">Plus récents</MenuItem>
              <MenuItem value="reads">Plus lus</MenuItem>
            </Select>
          </FormControl>

          {/* Count */}
          <Typography variant="body2" color={C.textSecondary} sx={{ display: { xs: 'none', md: 'block' }, flex: 1 }}>
            {loading ? '' : `${total} livre${total > 1 ? 's' : ''} trouvé${total > 1 ? 's' : ''}`}
          </Typography>

          {/* View toggle */}
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, v) => v && setViewMode(v)}
            size="small"
            sx={{ bgcolor: '#fff', borderRadius: '10px', flexShrink: 0 }}
          >
            <ToggleButton value="grid" sx={{ borderRadius: '10px 0 0 10px', px: 1.5 }}>
              <Tooltip title="Grille"><GridViewIcon fontSize="small" /></Tooltip>
            </ToggleButton>
            <ToggleButton value="list" sx={{ borderRadius: '0 10px 10px 0', px: 1.5 }}>
              <Tooltip title="Liste"><ListIcon fontSize="small" /></Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* ── Toolbar row 2: Filter chips ── */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2.5, flexWrap: 'wrap', alignItems: 'center' }}>
          <FilterListIcon sx={{ color: C.grey, fontSize: 18, mr: 0.25 }} />

          {/* Status filters */}
          {[
            { value: '', label: 'Tous' },
            { value: 'pending',     label: 'En attente',  color: C.orange  },
            { value: 'approved',    label: 'Approuvés',   color: C.green   },
            { value: 'rejected',    label: 'Rejetés',     color: C.red     },
            { value: 'paused',      label: 'Pausés',      color: C.grey    },
            { value: 'published',   label: 'Publiés',     color: C.indigo  },
            { value: 'unpublished', label: 'Non publiés', color: '#9e9e9e' },
            { value: 'archived',    label: 'Archivés',    color: '#795548' },
          ].map(f => (
            <Chip
              key={f.value}
              label={f.label}
              size="small"
              onClick={() => setFilterStatus(f.value)}
              sx={{
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.72rem',
                bgcolor: filterStatus === f.value
                  ? (f.color || C.indigo)
                  : (f.color ? `${f.color}15` : '#e8e2d8'),
                color: filterStatus === f.value
                  ? '#fff'
                  : (f.color || C.textSecondary),
                border: 'none',
                transition: 'all 0.15s',
                '&:hover': {
                  bgcolor: filterStatus === f.value
                    ? (f.color || C.indigo)
                    : (f.color ? `${f.color}28` : '#ddd7ce'),
                },
              }}
            />
          ))}

          {/* Divider dot */}
          <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: '#ccc', mx: 0.5 }} />

          {/* Type filters */}
          {[
            { value: '',          label: 'Tous types' },
            { value: 'ebook',     label: 'Ebook',     color: C.indigo  },
            { value: 'audiobook', label: 'Audio',     color: C.orange  },
            { value: 'both',      label: 'Les 2',     color: C.terre   },
          ].map(f => (
            <Chip
              key={f.value}
              label={f.label}
              size="small"
              onClick={() => setFilterType(f.value)}
              sx={{
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.72rem',
                bgcolor: filterType === f.value
                  ? (f.color || C.textSecondary)
                  : (f.color ? `${f.color}15` : '#e8e2d8'),
                color: filterType === f.value ? '#fff' : (f.color || C.textSecondary),
                border: 'none',
                transition: 'all 0.15s',
                '&:hover': {
                  bgcolor: filterType === f.value
                    ? (f.color || C.textSecondary)
                    : (f.color ? `${f.color}28` : '#ddd7ce'),
                },
              }}
            />
          ))}

          {/* Reset button if any filter active */}
          {(filterStatus || filterType || search) && (
            <Chip
              label="Réinitialiser"
              size="small"
              onClick={() => { setFilterStatus(''); setFilterType(''); setSearch(''); }}
              sx={{ fontWeight: 600, fontSize: '0.72rem', bgcolor: 'transparent', border: `1px solid #ccc`, color: C.textSecondary }}
            />
          )}
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>{error}</Alert>
        )}

        {/* Content */}
        {loading ? (
          viewMode === 'grid' ? (
            <Grid container spacing={2}>
              {[1,2,3,4,5,6,7,8].map(i => (
                <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={i}>
                  <Skeleton variant="rounded" height={240} sx={{ borderRadius: '16px' }} />
                </Grid>
              ))}
            </Grid>
          ) : (
            <Box>{[1,2,3,4,5].map(i => (
              <Skeleton key={i} variant="rounded" height={76} sx={{ borderRadius: '12px', mb: 1 }} />
            ))}</Box>
          )
        ) : books.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8, color: C.textSecondary }}>
            <MenuBookIcon sx={{ fontSize: 56, mb: 1.5, opacity: 0.25 }} />
            <Typography variant="h6" fontWeight={600} color={C.textSecondary}>
              {debouncedSearch ? 'Aucun résultat pour cette recherche' : 'Aucun livre trouvé'}
            </Typography>
          </Box>
        ) : viewMode === 'grid' ? (
          <Grid container spacing={2}>
            {books.map(book => (
              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={book.content_id}>
                <BookCard
                  book={book}
                  onClick={() => navigate(`/admin/books/content/${book.content_id}`)}
                />
              </Grid>
            ))}
          </Grid>
        ) : (
          <Box>
            {books.map(book => (
              <BookRow
                key={book.content_id}
                book={book}
                onClick={() => navigate(`/admin/books/content/${book.content_id}`)}
              />
            ))}
          </Box>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
            <Pagination
              count={totalPages}
              page={page}
              onChange={(_, v) => setPage(v)}
              color="primary"
              shape="rounded"
            />
          </Box>
        )}
      </Box>
    </Box>
  );
}
