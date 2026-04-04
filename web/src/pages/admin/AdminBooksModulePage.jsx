/**
 * AdminBooksModulePage
 * Route: /admin/books
 * Overview: global stats + publisher cards
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
  Avatar,
  Skeleton,
  Divider,
  Tooltip,
} from '@mui/material';
import GridViewIcon from '@mui/icons-material/GridView';
import ListIcon from '@mui/icons-material/ViewList';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import HeadphonesIcon from '@mui/icons-material/Headphones';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import LocalLibraryIcon from '@mui/icons-material/LocalLibrary';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import BusinessIcon from '@mui/icons-material/Business';
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

// ── Stat Card ────────────────────────────────────────────────
function StatCard({ icon, label, value, color = C.indigo, loading }) {
  return (
    <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', height: '100%' }}>
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2.5 }}>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: '12px',
            bgcolor: `${color}18`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {React.cloneElement(icon, { sx: { color, fontSize: 24 } })}
        </Box>
        <Box>
          {loading ? (
            <>
              <Skeleton width={60} height={28} />
              <Skeleton width={80} height={18} />
            </>
          ) : (
            <>
              <Typography variant="h5" fontWeight={700} color={C.textPrimary} lineHeight={1.2}>
                {value?.toLocaleString('fr-FR') ?? '—'}
              </Typography>
              <Typography variant="caption" color={C.textSecondary} fontWeight={500}>
                {label}
              </Typography>
            </>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

// ── Publisher Card (grid mode) ───────────────────────────────
function PublisherCard({ item, onClick }) {
  const pub = item.publisher;
  const isOrphan = pub.id === 'orphan';
  const isActive = pub.status === 'active';

  return (
    <Card
      sx={{
        borderRadius: '16px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        border: isOrphan ? `2px solid ${C.terre}` : '2px solid transparent',
        transition: 'box-shadow 0.2s, border-color 0.2s',
        '&:hover': {
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          borderColor: isOrphan ? C.terre : C.indigo,
        },
      }}
    >
      <CardActionArea onClick={onClick} sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
          <Avatar
            sx={{
              width: 48,
              height: 48,
              bgcolor: isOrphan ? `${C.terre}20` : `${C.indigo}15`,
              color: isOrphan ? C.terre : C.indigo,
              borderRadius: '12px',
            }}
          >
            {isOrphan ? <AutoStoriesIcon /> : <BusinessIcon />}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography
                variant="subtitle1"
                fontWeight={700}
                color={C.textPrimary}
                noWrap
                sx={{ flex: 1 }}
              >
                {pub.company_name}
              </Typography>
              {!isOrphan && (
                <Chip
                  label={isActive ? 'Actif' : 'Suspendu'}
                  size="small"
                  sx={{
                    bgcolor: isActive ? `${C.green}18` : `${C.red}18`,
                    color: isActive ? C.green : C.red,
                    fontWeight: 600,
                    fontSize: '0.68rem',
                    height: 22,
                  }}
                />
              )}
              {isOrphan && (
                <Chip
                  label="Papyri"
                  size="small"
                  sx={{
                    bgcolor: `${C.terre}15`,
                    color: C.terre,
                    fontWeight: 600,
                    fontSize: '0.68rem',
                    height: 22,
                  }}
                />
              )}
            </Box>

            <Divider sx={{ my: 1.5 }} />

            <Grid container spacing={1}>
              <Grid size={6}>
                <Typography variant="caption" color={C.textSecondary} display="block">
                  Livres
                </Typography>
                <Typography variant="body2" fontWeight={700} color={C.textPrimary}>
                  {item.bookCount}
                </Typography>
              </Grid>
              <Grid size={6}>
                <Typography variant="caption" color={C.textSecondary} display="block">
                  Approuvés
                </Typography>
                <Typography variant="body2" fontWeight={700} color={C.green}>
                  {item.approvedCount}
                </Typography>
              </Grid>
              <Grid size={6}>
                <Typography variant="caption" color={C.textSecondary} display="block">
                  Lectures
                </Typography>
                <Typography variant="body2" fontWeight={700} color={C.indigo}>
                  {item.totalReads.toLocaleString('fr-FR')}
                </Typography>
              </Grid>
              <Grid size={6}>
                <Typography variant="caption" color={C.textSecondary} display="block">
                  Complétions
                </Typography>
                <Typography variant="body2" fontWeight={700} color={C.orange}>
                  {item.completions.toLocaleString('fr-FR')}
                </Typography>
              </Grid>
            </Grid>
          </Box>
        </Box>
      </CardActionArea>
    </Card>
  );
}

// ── Publisher Row (list mode) ────────────────────────────────
function PublisherRow({ item, onClick }) {
  const pub = item.publisher;
  const isOrphan = pub.id === 'orphan';
  const isActive = pub.status === 'active';

  return (
    <Card
      sx={{
        borderRadius: '12px',
        boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
        border: isOrphan ? `2px solid ${C.terre}` : '2px solid transparent',
        mb: 1,
        '&:hover': { boxShadow: '0 3px 14px rgba(0,0,0,0.1)', borderColor: isOrphan ? C.terre : C.indigo },
        transition: 'all 0.2s',
      }}
    >
      <CardActionArea onClick={onClick}>
        <Box sx={{ display: 'flex', alignItems: 'center', px: 2.5, py: 1.5, gap: 2 }}>
          <Avatar
            sx={{
              width: 40,
              height: 40,
              bgcolor: isOrphan ? `${C.terre}20` : `${C.indigo}15`,
              color: isOrphan ? C.terre : C.indigo,
              borderRadius: '10px',
              flexShrink: 0,
            }}
          >
            {isOrphan ? <AutoStoriesIcon fontSize="small" /> : <BusinessIcon fontSize="small" />}
          </Avatar>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body1" fontWeight={700} color={C.textPrimary} noWrap>
              {pub.company_name}
            </Typography>
          </Box>

          {!isOrphan ? (
            <Chip
              label={isActive ? 'Actif' : 'Suspendu'}
              size="small"
              sx={{
                bgcolor: isActive ? `${C.green}18` : `${C.red}18`,
                color: isActive ? C.green : C.red,
                fontWeight: 600,
                fontSize: '0.68rem',
                height: 22,
                mx: 1,
              }}
            />
          ) : (
            <Chip
              label="Papyri"
              size="small"
              sx={{ bgcolor: `${C.terre}15`, color: C.terre, fontWeight: 600, fontSize: '0.68rem', height: 22, mx: 1 }}
            />
          )}

          <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: { sm: 2, md: 3 }, textAlign: 'right' }}>
            <Box>
              <Typography variant="caption" color={C.textSecondary}>Livres</Typography>
              <Typography variant="body2" fontWeight={700}>{item.bookCount}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color={C.textSecondary}>Approuvés</Typography>
              <Typography variant="body2" fontWeight={700} color={C.green}>{item.approvedCount}</Typography>
            </Box>
            <Box sx={{ display: { sm: 'none', md: 'block' } }}>
              <Typography variant="caption" color={C.textSecondary}>Lectures</Typography>
              <Typography variant="body2" fontWeight={700} color={C.indigo}>{item.totalReads.toLocaleString('fr-FR')}</Typography>
            </Box>
            <Box sx={{ display: { sm: 'none', md: 'block' } }}>
              <Typography variant="caption" color={C.textSecondary}>Complétions</Typography>
              <Typography variant="body2" fontWeight={700} color={C.orange}>{item.completions.toLocaleString('fr-FR')}</Typography>
            </Box>
          </Box>
        </Box>
      </CardActionArea>
    </Card>
  );
}

// ── Main Page ────────────────────────────────────────────────
export default function AdminBooksModulePage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [publishers, setPublishers] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingPub, setLoadingPub] = useState(true);
  const [errorStats, setErrorStats] = useState(null);
  const [errorPub, setErrorPub] = useState(null);
  const [viewMode, setViewMode] = useState('grid');

  useEffect(() => {
    // Load stats
    setLoadingStats(true);
    setErrorStats(null);
    authFetch(`${API}/api/admin/books-overview/stats`)
      .then(r => r.json())
      .then(data => setStats(data))
      .catch(e => setErrorStats(e.message))
      .finally(() => setLoadingStats(false));

    // Load publishers
    setLoadingPub(true);
    setErrorPub(null);
    authFetch(`${API}/api/admin/books-overview/publishers`)
      .then(r => r.json())
      .then(data => setPublishers(Array.isArray(data) ? data : []))
      .catch(e => setErrorPub(e.message))
      .finally(() => setLoadingPub(false));
  }, []);

  const statCards = [
    { icon: <MenuBookIcon />, label: 'Total livres', value: stats?.totalBooks, color: C.indigo },
    { icon: <AutoStoriesIcon />, label: 'Ebooks', value: stats?.ebooks, color: C.terre },
    { icon: <HeadphonesIcon />, label: 'Audiobooks', value: stats?.audiobooks, color: C.orange },
    { icon: <CheckCircleOutlineIcon />, label: 'Publiés', value: stats?.published, color: C.green },
    { icon: <PendingActionsIcon />, label: 'En attente', value: stats?.pending, color: C.red },
    { icon: <LocalLibraryIcon />, label: 'Total lectures', value: stats?.totalReads, color: '#7B5EA7' },
  ];

  return (
    <Box sx={{ bgcolor: C.bg, minHeight: '100vh' }}>
      {/* Header */}
      <Box
        sx={{
          bgcolor: '#fff',
          height: 60,
          display: 'flex',
          alignItems: 'center',
          px: 3,
          borderBottom: '1px solid #e5e0d8',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <AutoStoriesIcon sx={{ color: C.terre, mr: 1.5 }} />
        <Typography variant="h6" fontWeight={700} color={C.textPrimary}>
          Module Livres
        </Typography>
      </Box>

      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        {/* Stats Cards */}
        <Typography variant="overline" color={C.textSecondary} fontWeight={600} sx={{ mb: 1.5, display: 'block' }}>
          Vue d'ensemble
        </Typography>

        {errorStats && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>
            {errorStats}
          </Alert>
        )}

        <Grid container spacing={2} sx={{ mb: 4 }}>
          {statCards.map((card, i) => (
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }} key={i}>
              <StatCard {...card} loading={loadingStats} />
            </Grid>
          ))}
        </Grid>

        {/* Publishers Section */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box>
            <Typography variant="overline" color={C.textSecondary} fontWeight={600} display="block">
              Éditeurs & catalogue
            </Typography>
            <Typography variant="body2" color={C.textSecondary}>
              {loadingPub ? '...' : `${publishers.length} éditeur${publishers.length > 1 ? 's' : ''}`}
            </Typography>
          </Box>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, v) => v && setViewMode(v)}
            size="small"
            sx={{ bgcolor: '#fff', borderRadius: '10px' }}
          >
            <ToggleButton value="grid" sx={{ borderRadius: '10px 0 0 10px', px: 1.5 }}>
              <Tooltip title="Vue grille">
                <GridViewIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="list" sx={{ borderRadius: '0 10px 10px 0', px: 1.5 }}>
              <Tooltip title="Vue liste">
                <ListIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {errorPub && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>
            {errorPub}
          </Alert>
        )}

        {loadingPub ? (
          <Grid container spacing={2}>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
                <Skeleton variant="rounded" height={160} sx={{ borderRadius: '16px' }} />
              </Grid>
            ))}
          </Grid>
        ) : publishers.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6, color: C.textSecondary }}>
            <BusinessIcon sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
            <Typography>Aucun éditeur trouvé.</Typography>
          </Box>
        ) : viewMode === 'grid' ? (
          <Grid container spacing={2}>
            {publishers.map(item => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={item.publisher.id}>
                <PublisherCard
                  item={item}
                  onClick={() => navigate(`/admin/books/publisher/${item.publisher.id}`)}
                />
              </Grid>
            ))}
          </Grid>
        ) : (
          <Box>
            {publishers.map(item => (
              <PublisherRow
                key={item.publisher.id}
                item={item}
                onClick={() => navigate(`/admin/books/publisher/${item.publisher.id}`)}
              />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
