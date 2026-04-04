/**
 * AdminBookContentDetailPage
 * Route: /admin/books/content/:contentId
 * Full detail view: info + reading stats + history
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Chip,
  Alert,
  Avatar,
  IconButton,
  Divider,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Skeleton,
  Pagination,
  LinearProgress,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import UnarchiveOutlinedIcon from '@mui/icons-material/UnarchiveOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import HeadphonesIcon from '@mui/icons-material/Headphones';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PeopleIcon from '@mui/icons-material/People';
import LocalLibraryIcon from '@mui/icons-material/LocalLibrary';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LanguageIcon from '@mui/icons-material/Language';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import BusinessIcon from '@mui/icons-material/Business';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
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

// ── Helpers ──────────────────────────────────────────────────
function fmtDuration(seconds) {
  if (!seconds) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m} min`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtPrice(cents, currency = 'EUR') {
  if (!cents && cents !== 0) return null;
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(cents / 100);
}

const VALIDATION_MAP = {
  approved: { label: 'Approuvé',   color: C.green },
  pending:  { label: 'En attente', color: C.orange },
  rejected: { label: 'Rejeté',     color: C.red },
  paused:   { label: 'Pausé',      color: C.grey },
};

const ACCESS_MAP = {
  free:         { label: 'Gratuit',     icon: <LockOpenIcon /> },
  subscription: { label: 'Abonnement', icon: <LockIcon /> },
  paid:         { label: 'Payant',      icon: <AttachMoneyIcon /> },
};

// ── Meta Tag ─────────────────────────────────────────────────
function MetaTag({ icon, label }) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        bgcolor: '#f0ece6',
        borderRadius: '8px',
        px: 1.25,
        py: 0.5,
      }}
    >
      {React.cloneElement(icon, { sx: { fontSize: 14, color: C.grey } })}
      <Typography variant="caption" color={C.textSecondary} fontWeight={500}>
        {label}
      </Typography>
    </Box>
  );
}

// ── Stat Card ─────────────────────────────────────────────────
function StatCard({ icon, label, value, color = C.indigo, subtitle, loading }) {
  return (
    <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', height: '100%' }}>
      <CardContent sx={{ p: 2.5 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '12px',
            bgcolor: `${color}18`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 1.5,
          }}
        >
          {React.cloneElement(icon, { sx: { color, fontSize: 22 } })}
        </Box>
        {loading ? (
          <>
            <Skeleton width={60} height={32} />
            <Skeleton width={90} height={16} sx={{ mt: 0.5 }} />
          </>
        ) : (
          <>
            <Typography variant="h5" fontWeight={800} color={C.textPrimary} lineHeight={1}>
              {value ?? '—'}
            </Typography>
            <Typography variant="caption" color={C.textSecondary} fontWeight={500} display="block" sx={{ mt: 0.5 }}>
              {label}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color={C.textSecondary} display="block" sx={{ mt: 0.25, opacity: 0.75 }}>
                {subtitle}
              </Typography>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

const HISTORY_LIMIT = 20;

// ── Main Page ────────────────────────────────────────────────
export default function AdminBookContentDetailPage() {
  const navigate = useNavigate();
  const { contentId } = useParams();

  const [content, setContent] = useState(null);
  const [loadingContent, setLoadingContent] = useState(true);
  const [errorContent, setErrorContent] = useState(null);

  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const [history, setHistory] = useState([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [errorHistory, setErrorHistory] = useState(null);

  // Archive / Delete state
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState(null);

  // ── Fetch content (single optimized endpoint) ─────────────
  useEffect(() => {
    setLoadingContent(true);
    setErrorContent(null);
    authFetch(`${API}/api/admin/books-overview/content/${contentId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setContent(data);
      })
      .catch(e => setErrorContent(e.message))
      .finally(() => setLoadingContent(false));
  }, [contentId]);

  // ── Fetch stats ───────────────────────────────────────────
  useEffect(() => {
    setLoadingStats(true);
    authFetch(`${API}/api/admin/books-overview/content/${contentId}/stats`)
      .then(r => r.json())
      .then(data => setStats(data))
      .catch(() => {})
      .finally(() => setLoadingStats(false));
  }, [contentId]);

  // ── Fetch history ─────────────────────────────────────────
  const loadHistory = useCallback(() => {
    setLoadingHistory(true);
    setErrorHistory(null);
    const params = new URLSearchParams({ page: String(historyPage), limit: String(HISTORY_LIMIT) });
    authFetch(`${API}/api/admin/books-overview/content/${contentId}/history?${params}`)
      .then(r => r.json())
      .then(data => {
        setHistory(data.history || []);
        setHistoryTotal(data.total || 0);
      })
      .catch(e => setErrorHistory(e.message))
      .finally(() => setLoadingHistory(false));
  }, [contentId, historyPage]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const historyPages = Math.ceil(historyTotal / HISTORY_LIMIT);

  // ── Archive ───────────────────────────────────────────────
  async function handleArchive() {
    setArchiving(true);
    setActionError(null);
    try {
      const res = await authFetch(`${API}/api/admin/books-overview/content/${contentId}/archive`, { method: 'PATCH' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Erreur');

      const nowArchived = data.content.is_archived;

      if (nowArchived) {
        // Contenu archivé → retour à la liste (il n'apparaît plus dans la vue par défaut)
        navigate(-1);
      } else {
        // Désarchivé → mise à jour locale
        setContent(prev => ({
          ...prev,
          is_archived: false,
          is_published: data.content.is_published,
          archived_at: null,
        }));
        setConfirmArchive(false);
      }
    } catch (e) {
      setActionError(e.message);
      setConfirmArchive(false);
    } finally {
      setArchiving(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────
  async function handleDelete() {
    setDeleting(true);
    setActionError(null);
    try {
      const res = await authFetch(`${API}/api/admin/books-overview/content/${contentId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Erreur');
      navigate('/admin/books', { replace: true });
    } catch (e) {
      setActionError(e.message);
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  // ── Derived ───────────────────────────────────────────────
  const title = content?.title || '';
  const author = content?.author || '';
  const contentType = content?.content_type;
  const isArchived = content?.is_archived || false;
  const validationStatus = content?.publisher_book?.validation_status;
  const typeColor = contentType === 'audiobook' ? C.orange : contentType === 'both' ? C.terre : C.indigo;
  const typeLabel = contentType === 'audiobook' ? 'Audiobook' : contentType === 'both' ? 'Ebook + Audio' : 'Ebook';
  const typeIcon = contentType === 'audiobook' ? <HeadphonesIcon /> : contentType === 'both' ? <AutoStoriesIcon /> : <MenuBookIcon />;
  const validCfg = VALIDATION_MAP[validationStatus] || null;
  const accessCfg = ACCESS_MAP[content?.access_type] || null;

  return (
    <Box sx={{ bgcolor: C.bg, minHeight: '100vh' }}>
      {/* ── Sticky Header ──────────────────────────────────── */}
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
        <IconButton onClick={() => navigate(-1)} size="small" sx={{ color: C.indigo }}>
          <ArrowBackIcon />
        </IconButton>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          {loadingContent ? (
            <Skeleton width={240} height={22} />
          ) : (
            <Typography variant="subtitle1" fontWeight={700} color={C.textPrimary} noWrap>
              {title || 'Détail du contenu'}
            </Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexShrink: 0 }}>
          {contentType && (
            <Chip
              icon={React.cloneElement(typeIcon, { sx: { fontSize: '14px !important' } })}
              label={typeLabel}
              size="small"
              sx={{ bgcolor: `${typeColor}18`, color: typeColor, fontWeight: 600, display: { xs: 'none', sm: 'flex' } }}
            />
          )}
          {validCfg && (
            <Chip
              label={validCfg.label}
              size="small"
              sx={{ bgcolor: `${validCfg.color}18`, color: validCfg.color, fontWeight: 600, display: { xs: 'none', sm: 'flex' } }}
            />
          )}
          {content?.is_published && !isArchived && (
            <Chip label="Publié" size="small" sx={{ bgcolor: `${C.green}18`, color: C.green, fontWeight: 600, display: { xs: 'none', md: 'flex' } }} />
          )}
          {isArchived && (
            <Chip label="Archivé" size="small" sx={{ bgcolor: `${C.orange}18`, color: C.orange, fontWeight: 600 }} />
          )}

          {/* ── Bouton éditeur ── */}
          {!loadingContent && content?.publisher_book && (
            <Button
              variant="contained"
              size="small"
              startIcon={<OpenInNewIcon />}
              onClick={() =>
                navigate(
                  `/admin/publishers/${content.publisher_book.publisher_id}/books/${content.publisher_book.id}`
                )
              }
              sx={{
                borderRadius: '10px',
                textTransform: 'none',
                fontWeight: 700,
                bgcolor: C.indigo,
                '&:hover': { bgcolor: '#1a2d47' },
                px: 2,
                ml: 0.5,
              }}
            >
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Ouvrir dans l'éditeur</Box>
              <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>Éditeur</Box>
            </Button>
          )}

          {/* ── Bouton Archiver ── */}
          {!loadingContent && content && (
            <Tooltip title={isArchived ? 'Désarchiver' : 'Archiver'}>
              <Button
                variant="outlined"
                size="small"
                startIcon={isArchived ? <UnarchiveOutlinedIcon /> : <ArchiveOutlinedIcon />}
                onClick={() => setConfirmArchive(true)}
                sx={{
                  borderRadius: '10px',
                  textTransform: 'none',
                  fontWeight: 600,
                  borderColor: isArchived ? C.green : C.orange,
                  color: isArchived ? C.green : C.orange,
                  '&:hover': { bgcolor: isArchived ? `${C.green}08` : `${C.orange}08` },
                  ml: 0.5,
                  display: { xs: 'none', sm: 'inline-flex' },
                }}
              >
                {isArchived ? 'Désarchiver' : 'Archiver'}
              </Button>
            </Tooltip>
          )}

          {/* ── Bouton Supprimer ── */}
          {!loadingContent && content && (
            <Tooltip title="Supprimer définitivement">
              <Button
                variant="outlined"
                size="small"
                startIcon={<DeleteOutlineIcon />}
                onClick={() => setConfirmDelete(true)}
                sx={{
                  borderRadius: '10px',
                  textTransform: 'none',
                  fontWeight: 600,
                  borderColor: C.red,
                  color: C.red,
                  '&:hover': { bgcolor: `${C.red}08` },
                  ml: 0.5,
                }}
              >
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Supprimer</Box>
              </Button>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* ── Erreur d'action ───────────────────────────────── */}
      {actionError && (
        <Alert severity="error" onClose={() => setActionError(null)} sx={{ mx: 2, mt: 1, borderRadius: '12px' }}>
          {actionError}
        </Alert>
      )}

      {/* ── Dialog : Confirmation archivage ──────────────── */}
      <Dialog open={confirmArchive} onClose={() => setConfirmArchive(false)} PaperProps={{ sx: { borderRadius: '16px', p: 1 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {isArchived ? 'Désarchiver ce contenu ?' : 'Archiver ce contenu ?'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {isArchived
              ? `"${title}" sera désarchivé et restera non publié. Tu pourras le republier manuellement.`
              : `"${title}" sera dépublié et archivé. Les lecteurs n'y auront plus accès. Tu pourras le désarchiver à tout moment.`}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmArchive(false)} sx={{ textTransform: 'none', color: C.textSecondary }}>
            Annuler
          </Button>
          <Button
            onClick={handleArchive}
            disabled={archiving}
            variant="contained"
            startIcon={archiving ? <CircularProgress size={14} color="inherit" /> : (isArchived ? <UnarchiveOutlinedIcon /> : <ArchiveOutlinedIcon />)}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              borderRadius: '10px',
              bgcolor: isArchived ? C.green : C.orange,
              '&:hover': { bgcolor: isArchived ? '#1e8449' : '#e65100' },
            }}
          >
            {archiving ? 'En cours…' : isArchived ? 'Désarchiver' : 'Archiver'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Dialog : Confirmation suppression ────────────── */}
      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} PaperProps={{ sx: { borderRadius: '16px', p: 1 } }}>
        <DialogTitle sx={{ fontWeight: 700, color: C.red }}>
          Supprimer définitivement ce contenu ?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            <strong>"{title}"</strong> sera supprimé de façon permanente avec tout son historique de lecture, ses chapitres audio et ses données éditeur.
            <br /><br />
            <strong style={{ color: C.red }}>Cette action est irréversible.</strong>
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmDelete(false)} sx={{ textTransform: 'none', color: C.textSecondary }}>
            Annuler
          </Button>
          <Button
            onClick={handleDelete}
            disabled={deleting}
            variant="contained"
            startIcon={deleting ? <CircularProgress size={14} color="inherit" /> : <DeleteOutlineIcon />}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              borderRadius: '10px',
              bgcolor: C.red,
              '&:hover': { bgcolor: '#c0392b' },
            }}
          >
            {deleting ? 'Suppression…' : 'Supprimer définitivement'}
          </Button>
        </DialogActions>
      </Dialog>

      {errorContent && (
        <Alert severity="error" sx={{ m: 2, borderRadius: '12px' }}>{errorContent}</Alert>
      )}

      <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1200, mx: 'auto' }}>

        {/* ── Hero Card ──────────────────────────────────────── */}
        <Card sx={{ borderRadius: '20px', boxShadow: '0 4px 24px rgba(0,0,0,0.07)', mb: 3, overflow: 'hidden' }}>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 0 }}>

            {/* Cover */}
            <Box
              sx={{
                width: { xs: '100%', sm: 160 },
                minWidth: { sm: 160 },
                height: { xs: 200, sm: 'auto' },
                minHeight: { sm: 240 },
                bgcolor: '#e8e2d8',
                flexShrink: 0,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {loadingContent ? (
                <Skeleton variant="rectangular" width="100%" height="100%" />
              ) : content?.cover_url ? (
                <img
                  src={content.cover_url}
                  alt={title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MenuBookIcon sx={{ fontSize: 56, color: '#bbb' }} />
                </Box>
              )}
            </Box>

            {/* Info */}
            <Box sx={{ flex: 1, p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>

              {/* Title + badges */}
              <Box>
                {loadingContent ? (
                  <>
                    <Skeleton width="70%" height={32} />
                    <Skeleton width="40%" height={22} sx={{ mt: 0.5 }} />
                  </>
                ) : (
                  <>
                    <Typography variant="h5" fontWeight={800} color={C.textPrimary} sx={{ mb: 0.5, lineHeight: 1.2 }}>
                      {title || 'Sans titre'}
                    </Typography>
                    <Typography variant="body1" color={C.textSecondary} sx={{ mb: 1.5 }}>
                      {author || 'Auteur inconnu'}
                    </Typography>

                    {/* Meta tags */}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                      {fmtDuration(content?.duration_seconds) && (
                        <MetaTag icon={<AccessTimeIcon />} label={fmtDuration(content.duration_seconds)} />
                      )}
                      {content?.language && (
                        <MetaTag icon={<LanguageIcon />} label={content.language.toUpperCase()} />
                      )}
                      {accessCfg && (
                        <MetaTag icon={accessCfg.icon} label={accessCfg.label} />
                      )}
                      {fmtPrice(content?.price_cents, content?.price_currency) && (
                        <MetaTag icon={<AttachMoneyIcon />} label={fmtPrice(content.price_cents, content.price_currency)} />
                      )}
                      {content?.created_at && (
                        <MetaTag icon={<CalendarTodayIcon />} label={`Ajouté ${fmtDate(content.created_at)}`} />
                      )}
                    </Box>
                  </>
                )}
              </Box>

              {/* Description */}
              {(loadingContent || content?.description) && (
                <Box>
                  <Divider sx={{ mb: 1.5 }} />
                  {loadingContent ? (
                    <>
                      <Skeleton width="100%" />
                      <Skeleton width="90%" />
                      <Skeleton width="75%" />
                    </>
                  ) : (
                    <Typography variant="body2" color={C.textSecondary} sx={{ lineHeight: 1.75, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {content.description}
                    </Typography>
                  )}
                </Box>
              )}

              {/* Footer: publisher + action */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mt: 'auto' }}>
                {loadingContent ? (
                  <Skeleton width={140} height={28} />
                ) : content?.publisher ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ width: 26, height: 26, bgcolor: `${C.indigo}15`, color: C.indigo, borderRadius: '8px' }}>
                      <BusinessIcon sx={{ fontSize: 14 }} />
                    </Avatar>
                    <Typography variant="body2" color={C.textSecondary} fontWeight={500}>
                      {content.publisher.company_name}
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ width: 26, height: 26, bgcolor: `${C.terre}15`, color: C.terre, borderRadius: '8px' }}>
                      <AutoStoriesIcon sx={{ fontSize: 14 }} />
                    </Avatar>
                    <Typography variant="body2" color={C.textSecondary} fontWeight={500}>
                      Papyri
                    </Typography>
                  </Box>
                )}

              </Box>
            </Box>
          </Box>
        </Card>

        {/* ── Stats Row ──────────────────────────────────────── */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[
            {
              icon: <LocalLibraryIcon />,
              label: 'Lectures totales',
              value: loadingStats ? undefined : stats?.totalReads?.toLocaleString('fr-FR'),
              color: C.indigo,
            },
            {
              icon: <PeopleIcon />,
              label: 'Lecteurs uniques',
              value: loadingStats ? undefined : stats?.uniqueReaders?.toLocaleString('fr-FR'),
              color: C.terre,
            },
            {
              icon: <CheckCircleIcon />,
              label: 'Complétions',
              value: loadingStats ? undefined : stats?.completions?.toLocaleString('fr-FR'),
              color: C.green,
            },
            {
              icon: <TrendingUpIcon />,
              label: 'Progression moy.',
              value: loadingStats ? undefined : stats ? `${stats.avgProgress}%` : '—',
              color: C.orange,
              subtitle: stats?.avgTimeSeconds ? `Temps moy. : ${fmtDuration(stats.avgTimeSeconds)}` : undefined,
            },
          ].map((card, i) => (
            <Grid size={{ xs: 6, md: 3 }} key={i}>
              <StatCard {...card} loading={loadingStats} />
            </Grid>
          ))}
        </Grid>

        {/* ── Reading History ─────────────────────────────────── */}
        <Card sx={{ borderRadius: '20px', boxShadow: '0 4px 24px rgba(0,0,0,0.07)' }}>
          <CardContent sx={{ p: 0 }}>
            <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid #f0eee9', display: 'flex', alignItems: 'center', gap: 1 }}>
              <LocalLibraryIcon sx={{ color: C.indigo, fontSize: 20 }} />
              <Typography variant="subtitle1" fontWeight={700} color={C.textPrimary}>
                Historique de lecture
              </Typography>
              {historyTotal > 0 && (
                <Chip
                  label={`${historyTotal} entrée${historyTotal > 1 ? 's' : ''}`}
                  size="small"
                  sx={{ bgcolor: `${C.indigo}12`, color: C.indigo, fontWeight: 600, ml: 0.5 }}
                />
              )}
            </Box>

            {errorHistory && (
              <Alert severity="error" sx={{ m: 2, borderRadius: '10px' }}>{errorHistory}</Alert>
            )}

            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#faf9f7' }}>
                    <TableCell sx={{ color: C.textSecondary, fontWeight: 700, fontSize: '0.72rem', py: 1.25, pl: 3 }}>
                      Lecteur
                    </TableCell>
                    <TableCell sx={{ color: C.textSecondary, fontWeight: 700, fontSize: '0.72rem', py: 1.25, minWidth: 140 }}>
                      Progression
                    </TableCell>
                    <TableCell sx={{ color: C.textSecondary, fontWeight: 700, fontSize: '0.72rem', py: 1.25, textAlign: 'center' }}>
                      Complété
                    </TableCell>
                    <TableCell sx={{ color: C.textSecondary, fontWeight: 700, fontSize: '0.72rem', py: 1.25 }}>
                      Durée
                    </TableCell>
                    <TableCell sx={{ color: C.textSecondary, fontWeight: 700, fontSize: '0.72rem', py: 1.25, pr: 3 }}>
                      Dernière lecture
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loadingHistory ? (
                    [1, 2, 3, 4, 5].map(i => (
                      <TableRow key={i}>
                        {[1, 2, 3, 4, 5].map(j => (
                          <TableCell key={j} sx={{ py: 1.5 }}>
                            <Skeleton height={20} />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : history.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} sx={{ textAlign: 'center', py: 6, color: C.textSecondary }}>
                        <LocalLibraryIcon sx={{ fontSize: 40, mb: 1, opacity: 0.2, display: 'block', mx: 'auto' }} />
                        Aucune lecture enregistrée
                      </TableCell>
                    </TableRow>
                  ) : (
                    history.map((row, i) => (
                      <TableRow
                        key={i}
                        sx={{ '&:hover': { bgcolor: '#faf9f7' }, '&:last-child td': { border: 0 } }}
                      >
                        <TableCell sx={{ py: 1.5, pl: 3 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Avatar
                              src={row.user.avatar_url || undefined}
                              sx={{ width: 32, height: 32, fontSize: '0.8rem', bgcolor: `${C.indigo}20`, color: C.indigo }}
                            >
                              {row.user.full_name?.[0]?.toUpperCase() || '?'}
                            </Avatar>
                            <Box sx={{ minWidth: 0 }}>
                              <Tooltip title={row.user.email} placement="top">
                                <Typography variant="body2" fontWeight={600} color={C.textPrimary} noWrap>
                                  {row.user.full_name || 'Inconnu'}
                                </Typography>
                              </Tooltip>
                              <Typography variant="caption" color={C.textSecondary} noWrap display="block">
                                {row.user.email}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>

                        <TableCell sx={{ py: 1.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LinearProgress
                              variant="determinate"
                              value={row.progress_percent || 0}
                              sx={{
                                flex: 1,
                                height: 6,
                                borderRadius: 3,
                                bgcolor: `${C.indigo}15`,
                                '& .MuiLinearProgress-bar': { bgcolor: C.indigo, borderRadius: 3 },
                              }}
                            />
                            <Typography variant="caption" color={C.textSecondary} sx={{ minWidth: 32, textAlign: 'right' }}>
                              {row.progress_percent || 0}%
                            </Typography>
                          </Box>
                        </TableCell>

                        <TableCell sx={{ py: 1.5, textAlign: 'center' }}>
                          {row.is_completed ? (
                            <CheckCircleIcon sx={{ color: C.green, fontSize: 20 }} />
                          ) : (
                            <Typography variant="caption" color={C.textSecondary}>—</Typography>
                          )}
                        </TableCell>

                        <TableCell sx={{ py: 1.5 }}>
                          <Typography variant="body2" color={C.textSecondary}>
                            {fmtDuration(row.total_time_seconds) || '—'}
                          </Typography>
                        </TableCell>

                        <TableCell sx={{ py: 1.5, pr: 3 }}>
                          <Typography variant="body2" color={C.textSecondary} noWrap>
                            {fmtDate(row.last_read_at)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Box>

            {!loadingHistory && historyPages > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2.5 }}>
                <Pagination
                  count={historyPages}
                  page={historyPage}
                  onChange={(_, v) => setHistoryPage(v)}
                  size="small"
                  shape="rounded"
                />
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
