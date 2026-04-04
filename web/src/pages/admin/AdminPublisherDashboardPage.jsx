import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, Grid, Avatar, Chip,
  Table, TableBody, TableCell, TableHead, TableRow,
  Alert, LinearProgress, Skeleton, Button, Divider, IconButton, Tooltip,
} from '@mui/material';
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import LibraryBooksOutlinedIcon from '@mui/icons-material/LibraryBooksOutlined';
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';
import tokens from '../../config/tokens';
import { adminGetDashboardStats } from '../../services/publisher.service';

const C = {
  primary:  tokens.colors.primary,
  or:       tokens.colors.secondary,
  indigo:   tokens.colors.accent,
  green:    '#27ae60',
  orange:   '#FF9800',
  blue:     '#2196F3',
  purple:   '#9C27B0',
  red:      '#e74c3c',
};

const MEDALS = ['🥇', '🥈', '🥉'];

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, color = C.primary, loading, badge, onClick }) {
  return (
    <Card
      onClick={onClick}
      sx={{
        borderRadius: '18px',
        boxShadow: '0 2px 14px rgba(0,0,0,0.06)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.15s, box-shadow 0.15s',
        '&:hover': onClick ? { transform: 'translateY(-3px)', boxShadow: '0 10px 28px rgba(0,0,0,0.1)' } : {},
        position: 'relative',
        overflow: 'visible',
      }}
    >
      {badge > 0 && (
        <Box sx={{
          position: 'absolute', top: -8, right: -8,
          bgcolor: C.red, color: '#fff', borderRadius: '50%',
          width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '11px', fontWeight: 800, boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
        }}>
          {badge > 99 ? '99+' : badge}
        </Box>
      )}
      <CardContent sx={{ p: 3 }}>
        {loading ? (
          <>
            <Skeleton variant="rounded" width={48} height={48} sx={{ mb: 2, borderRadius: '12px' }} />
            <Skeleton width="55%" height={34} sx={{ mb: 0.5 }} />
            <Skeleton width="40%" height={18} />
          </>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            <Box sx={{ bgcolor: `${color}18`, borderRadius: '14px', p: 1.5, display: 'flex', flexShrink: 0 }}>
              {React.cloneElement(icon, { sx: { color, fontSize: 28 } })}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h4" sx={{ fontWeight: 900, color: '#1a1a2e', lineHeight: 1.1 }}>
                {value ?? '—'}
              </Typography>
              <Typography variant="body2" sx={{ color: '#666', mt: 0.4, fontWeight: 600, fontSize: '0.82rem' }}>
                {label}
              </Typography>
              {sub && (
                <Typography variant="caption" sx={{ color: '#aaa', display: 'block', mt: 0.3 }}>
                  {sub}
                </Typography>
              )}
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ title, action, onAction }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 800, color: C.indigo, fontSize: '1rem' }}>
        {title}
      </Typography>
      {action && (
        <Button size="small" endIcon={<ArrowForwardIcon fontSize="small" />}
          onClick={onAction}
          sx={{ textTransform: 'none', color: C.primary, fontWeight: 700, fontSize: '0.8rem',
            '&:hover': { bgcolor: `${C.primary}10` } }}>
          {action}
        </Button>
      )}
    </Box>
  );
}

// ── Publisher row ─────────────────────────────────────────────────────────────
function PublisherRow({ pub, rank, onClick }) {
  const medal = MEDALS[rank] ?? null;
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.5,
        p: 1.5, borderRadius: '12px', cursor: 'pointer',
        transition: 'background 0.12s',
        '&:hover': { bgcolor: '#F8F6F3' },
      }}
    >
      <Typography sx={{ width: 24, textAlign: 'center', fontSize: '1.1rem' }}>
        {medal ?? <Typography component="span" sx={{ fontWeight: 800, color: '#C7C7C7', fontSize: '0.82rem' }}>#{rank + 1}</Typography>}
      </Typography>
      <Avatar sx={{ bgcolor: C.primary, width: 36, height: 36, fontSize: '0.9rem', fontWeight: 800 }}>
        {pub.company_name?.charAt(0).toUpperCase()}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {pub.company_name}
        </Typography>
        <Typography variant="caption" sx={{ color: '#aaa' }}>
          {pub.content_count ?? 0} contenus
        </Typography>
      </Box>
      <Box sx={{ textAlign: 'right' }}>
        <Typography variant="body2" sx={{ fontWeight: 900, color: C.primary }}>
          {pub.total_cad.toFixed(2)}
        </Typography>
        <Typography variant="caption" sx={{ color: '#aaa' }}>CAD</Typography>
      </Box>
    </Box>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminPublisherDashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    adminGetDashboardStats()
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const s = stats;
  const maxCat = s?.trendingCategories?.[0]?.count || 1;

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, bgcolor: '#F7F6F3', minHeight: '100vh' }}>

      {/* ── Header ── */}
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="overline" sx={{ color: C.primary, fontWeight: 700, letterSpacing: 2, fontSize: '0.7rem' }}>
            MODULE ÉDITEURS
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 900, color: C.indigo, fontFamily: 'Playfair Display, serif', lineHeight: 1.15 }}>
            Tableau de bord Éditeurs
          </Typography>
          <Typography variant="body2" sx={{ color: '#9E9E9E', mt: 0.5 }}>
            Vue d'ensemble — revenus, validations et performances
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button variant="outlined" size="small" onClick={() => navigate('/admin/content-validation')}
            sx={{ textTransform: 'none', borderRadius: '10px', fontWeight: 700, borderColor: C.orange, color: C.orange,
              '&:hover': { bgcolor: '#FFF3E0', borderColor: C.orange } }}>
            Valider contenus
          </Button>
          <Button variant="contained" size="small" onClick={() => navigate('/admin/publishers')}
            sx={{ textTransform: 'none', borderRadius: '10px', fontWeight: 700, bgcolor: C.primary,
              boxShadow: 'none', '&:hover': { bgcolor: '#8B4513' } }}>
            Gérer éditeurs
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }}>{error}</Alert>}

      {/* ── Alerte contenus en attente ── */}
      {!loading && s?.pendingContent > 0 && (
        <Alert
          severity="warning" variant="filled"
          action={
            <Button color="inherit" size="small" sx={{ fontWeight: 700, textTransform: 'none' }}
              onClick={() => navigate('/admin/content-validation')}>
              Traiter maintenant →
            </Button>
          }
          sx={{ mb: 3, borderRadius: '14px', fontWeight: 600 }}
        >
          {s.pendingContent} contenu{s.pendingContent > 1 ? 's' : ''} en attente de validation
        </Alert>
      )}

      {/* ── KPIs ── */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard loading={loading}
            icon={<PeopleOutlinedIcon />}
            label="Éditeurs actifs"
            value={s?.publishers.active}
            sub={`${s?.publishers.total ?? '—'} total · ${s?.publishers.pending ?? '—'} en attente`}
            color={C.indigo}
            onClick={() => navigate('/admin/publishers')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard loading={loading}
            icon={<FactCheckOutlinedIcon />}
            label="Contenus à valider"
            value={s?.pendingContent ?? 0}
            color={!loading && s?.pendingContent > 0 ? C.orange : C.green}
            sub={!loading ? (s?.pendingContent > 0 ? 'En attente de décision' : 'File vide — tout à jour') : undefined}
            badge={!loading ? s?.pendingContent : 0}
            onClick={() => navigate('/admin/content-validation')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard loading={loading}
            icon={<AccountBalanceOutlinedIcon />}
            label="Solde à verser"
            value={s ? `${s.totalPendingPayout.toFixed(2)} CAD` : '—'}
            color={C.blue}
            sub="Revenus éditeurs non versés"
            onClick={() => navigate('/admin/payouts')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard loading={loading}
            icon={<LibraryBooksOutlinedIcon />}
            label="Contenus approuvés"
            value={s?.approvedContent ?? '—'}
            color={C.green}
            sub="Dans le catalogue"
          />
        </Grid>
      </Grid>

      {/* ── Row 2 : Top éditeurs + Top livres ── */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ borderRadius: '18px', boxShadow: '0 2px 14px rgba(0,0,0,0.06)', height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <SectionHeader title="Top Éditeurs" action="Voir tous" onAction={() => navigate('/admin/publishers')} />
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5 }}>
                    <Skeleton variant="circular" width={36} height={36} />
                    <Box sx={{ flex: 1 }}>
                      <Skeleton width="60%" height={18} />
                      <Skeleton width="40%" height={14} />
                    </Box>
                    <Skeleton width={60} height={18} />
                  </Box>
                ))
              ) : s?.topPublishers.length === 0 ? (
                <Box sx={{ py: 5, textAlign: 'center' }}>
                  <EmojiEventsOutlinedIcon sx={{ fontSize: 40, color: '#E0E0E0', mb: 1 }} />
                  <Typography variant="body2" sx={{ color: '#BDBDBD' }}>Aucune vente pour le moment</Typography>
                </Box>
              ) : (
                <Box>
                  {s.topPublishers.map((pub, i) => (
                    <React.Fragment key={pub.id}>
                      <PublisherRow pub={pub} rank={i} onClick={() => navigate(`/admin/publishers/${pub.id}`)} />
                      {i < s.topPublishers.length - 1 && <Divider sx={{ my: 0.5, opacity: 0.5 }} />}
                    </React.Fragment>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ borderRadius: '18px', boxShadow: '0 2px 14px rgba(0,0,0,0.06)', height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <SectionHeader title="Livres les plus demandés" />
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1, mb: 1 }}>
                    <Skeleton variant="rounded" width={36} height={48} />
                    <Box sx={{ flex: 1 }}>
                      <Skeleton width="70%" height={18} />
                      <Skeleton width="45%" height={14} />
                    </Box>
                    <Skeleton variant="rounded" width={60} height={24} />
                  </Box>
                ))
              ) : s?.topBooks.length === 0 ? (
                <Box sx={{ py: 5, textAlign: 'center' }}>
                  <LibraryBooksOutlinedIcon sx={{ fontSize: 40, color: '#E0E0E0', mb: 1 }} />
                  <Typography variant="body2" sx={{ color: '#BDBDBD' }}>Aucune vente enregistrée</Typography>
                </Box>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {['#', 'Livre', 'Éditeur', 'Ventes'].map(h => (
                        <TableCell key={h} sx={{ fontWeight: 700, color: '#9E9E9E', fontSize: '11px',
                          textTransform: 'uppercase', letterSpacing: '0.5px', border: 0, pb: 1.5 }}>
                          {h}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {s.topBooks.map((book, i) => (
                      <TableRow key={book.id} sx={{ '&:hover': { bgcolor: '#F8F6F3' } }}>
                        <TableCell sx={{ border: 0, py: 1.2, width: 36 }}>
                          <Typography sx={{ fontWeight: 800, color: '#BDBDBD', fontSize: '0.85rem' }}>
                            {MEDALS[i] ?? `#${i + 1}`}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ border: 0, py: 1.2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            {book.cover_url ? (
                              <Box component="img" src={book.cover_url}
                                sx={{ width: 32, height: 44, objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} />
                            ) : (
                              <Box sx={{ width: 32, height: 44, bgcolor: '#F0EDE8', borderRadius: '4px', flexShrink: 0 }} />
                            )}
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: 'nowrap',
                                overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>
                                {book.title || '—'}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#9E9E9E' }}>{book.author}</Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ border: 0, py: 1.2 }}>
                          <Typography variant="caption" sx={{ color: '#757575' }}>
                            {book.publisher_name || '—'}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ border: 0, py: 1.2 }}>
                          <Chip label={`${book.count} vente${book.count > 1 ? 's' : ''}`} size="small"
                            sx={{ bgcolor: '#E8F5E9', color: '#2E7D32', fontWeight: 700, fontSize: '11px', height: 22 }} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── Row 3 : Catégories + File de validation ── */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ borderRadius: '18px', boxShadow: '0 2px 14px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: 3 }}>
              <SectionHeader title="Catégories du catalogue" />
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <Box key={i} sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Skeleton width="50%" height={16} />
                      <Skeleton width="20%" height={16} />
                    </Box>
                    <Skeleton variant="rounded" height={6} sx={{ borderRadius: 3 }} />
                  </Box>
                ))
              ) : s?.trendingCategories.length === 0 ? (
                <Typography variant="body2" sx={{ color: '#BDBDBD', textAlign: 'center', py: 4 }}>Aucune donnée</Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {s.trendingCategories.map((cat, i) => {
                    const pct = Math.round((cat.count / maxCat) * 100);
                    const barColors = [C.primary, C.indigo, C.blue, C.green, C.or];
                    const barColor = barColors[i % barColors.length];
                    return (
                      <Box key={cat.name}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: '#3a3a3a' }}>{cat.name}</Typography>
                          <Typography variant="caption" sx={{ color: '#9E9E9E', fontWeight: 600 }}>
                            {cat.count} livre{cat.count > 1 ? 's' : ''}
                          </Typography>
                        </Box>
                        <Box sx={{ position: 'relative', height: 7, bgcolor: '#F0EDE8', borderRadius: 4, overflow: 'hidden' }}>
                          <Box sx={{
                            position: 'absolute', left: 0, top: 0, height: '100%',
                            width: `${pct}%`, bgcolor: barColor, borderRadius: 4,
                            transition: 'width 0.6s ease',
                          }} />
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ borderRadius: '18px', boxShadow: '0 2px 14px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: 3 }}>
              <SectionHeader
                title="File de validation"
                action={s?.pendingContent > 5 ? `Voir tout (${s.pendingContent})` : undefined}
                onAction={() => navigate('/admin/content-validation')}
              />
              {loading ? (
                [...Array(3)].map((_, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5, borderBottom: '1px solid #F5F5F5' }}>
                    <Skeleton variant="rounded" width={28} height={38} />
                    <Box sx={{ flex: 1 }}>
                      <Skeleton width="55%" height={16} />
                      <Skeleton width="35%" height={13} />
                    </Box>
                    <Skeleton width={80} height={16} />
                  </Box>
                ))
              ) : s?.pendingItems.length === 0 ? (
                <Box sx={{ py: 5, textAlign: 'center' }}>
                  <CheckCircleOutlineIcon sx={{ fontSize: 44, color: '#A5D6A7', mb: 1 }} />
                  <Typography variant="body1" sx={{ color: C.green, fontWeight: 700 }}>File vide — tout est à jour</Typography>
                  <Typography variant="caption" sx={{ color: '#BDBDBD' }}>Aucun contenu en attente de validation</Typography>
                </Box>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {['Contenu', 'Éditeur', 'Soumis le', ''].map((h, i) => (
                        <TableCell key={i} sx={{ fontWeight: 700, color: '#9E9E9E', fontSize: '11px',
                          textTransform: 'uppercase', letterSpacing: '0.5px', border: 0, pb: 1.5 }}>
                          {h}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {s.pendingItems.slice(0, 6).map((item) => (
                      <TableRow key={item.id} hover
                        onClick={() => navigate('/admin/content-validation')}
                        sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#FFF8F0' } }}>
                        <TableCell sx={{ border: 0, py: 1.3 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            {item.contents?.cover_url ? (
                              <Box component="img" src={item.contents.cover_url}
                                sx={{ width: 28, height: 38, objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} />
                            ) : (
                              <Box sx={{ width: 28, height: 38, bgcolor: '#F0EDE8', borderRadius: '4px', flexShrink: 0 }} />
                            )}
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {item.contents?.title || '—'}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ border: 0, py: 1.3 }}>
                          <Typography variant="caption" sx={{ color: '#757575', fontWeight: 600 }}>
                            {item.publishers?.company_name || '—'}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ border: 0, py: 1.3 }}>
                          <Typography variant="caption" sx={{ color: '#9E9E9E' }}>
                            {new Date(item.submitted_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ border: 0, py: 1.3, textAlign: 'right' }}>
                          <Chip label="En attente" size="small"
                            sx={{ bgcolor: '#FFF3E0', color: C.orange, fontWeight: 700, fontSize: '10px', height: 20 }} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
