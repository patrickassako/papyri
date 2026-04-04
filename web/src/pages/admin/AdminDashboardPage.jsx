import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, Grid, Chip,
  Table, TableBody, TableCell, TableHead, TableRow,
  CircularProgress, Alert, LinearProgress, Skeleton,
} from '@mui/material';
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import LibraryBooksOutlinedIcon from '@mui/icons-material/LibraryBooksOutlined';
import HeadphonesOutlinedIcon from '@mui/icons-material/HeadphonesOutlined';
import AutoStoriesOutlinedIcon from '@mui/icons-material/AutoStoriesOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import tokens from '../../config/tokens';
import { getGlobalStats } from '../../services/admin.service';

const C = {
  primary: tokens.colors.primary,
  or: tokens.colors.secondary,
  indigo: tokens.colors.accent,
  green: '#27ae60',
  red: '#e74c3c',
  blue: '#2196F3',
};

function KpiCard({ icon, label, value, sub, color = C.primary, loading, onClick }) {
  return (
    <Card
      onClick={onClick}
      sx={{
        borderRadius: '16px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.15s, box-shadow 0.15s',
        '&:hover': onClick ? { transform: 'translateY(-2px)', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' } : {},
      }}
    >
      <CardContent sx={{ p: 3 }}>
        {loading ? (
          <>
            <Skeleton variant="rounded" width={44} height={44} sx={{ mb: 2 }} />
            <Skeleton width="60%" height={32} sx={{ mb: 0.5 }} />
            <Skeleton width="40%" height={20} />
          </>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            <Box sx={{ bgcolor: `${color}1A`, borderRadius: '12px', p: 1.5, display: 'flex', flexShrink: 0 }}>
              {React.cloneElement(icon, { sx: { color, fontSize: 26 } })}
            </Box>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#1a1a2e', lineHeight: 1.1 }}>
                {value?.toLocaleString('fr-FR') ?? '—'}
              </Typography>
              <Typography variant="body2" sx={{ color: '#666', mt: 0.5, fontWeight: 500 }}>{label}</Typography>
              {sub && (
                <Typography variant="caption" sx={{ color: '#999', display: 'block', mt: 0.25 }}>{sub}</Typography>
              )}
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

function MiniBar({ data }) {
  if (!data?.length) return null;
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: 80 }}>
      {data.map((d, i) => (
        <Box key={i} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <Box sx={{
            width: '100%',
            height: `${Math.max(4, Math.round((d.count / max) * 64))}px`,
            bgcolor: i === data.length - 1 ? C.primary : `${C.primary}44`,
            borderRadius: '4px 4px 0 0',
            transition: 'height 0.4s',
          }} />
          <Typography variant="caption" sx={{ fontSize: '10px', color: '#999', fontWeight: i === data.length - 1 ? 700 : 400 }}>
            {d.month}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

const STATUS_COLORS = {
  ACTIVE:    { label: 'Actif',    bg: '#e8f5e9', color: C.green },
  EXPIRED:   { label: 'Expiré',  bg: '#fff8e1', color: C.or },
  CANCELLED: { label: 'Annulé',  bg: '#ffebee', color: C.red },
};

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    getGlobalStats()
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const s = stats;

  return (
    <Box sx={{ p: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, color: C.indigo, fontFamily: 'Playfair Display, serif', mb: 0.5 }}>
          Tableau de bord
        </Typography>
        <Typography variant="body2" sx={{ color: '#888' }}>
          Vue globale de la plateforme Papyri
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }}>{error}</Alert>}

      {/* KPI section : Utilisateurs */}
      <Typography variant="overline" sx={{ color: '#999', fontWeight: 700, letterSpacing: 1.5, display: 'block', mb: 1.5 }}>
        Utilisateurs
      </Typography>
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard loading={loading} icon={<PeopleOutlinedIcon />} label="Total utilisateurs"
            value={s?.users.total} sub={`${s?.users.active ?? '—'} actifs`}
            color={C.indigo} onClick={() => navigate('/admin/users')} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard loading={loading} icon={<PersonAddOutlinedIcon />} label="Nouveaux ce mois"
            value={s?.users.newThisMonth} color={C.green} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard loading={loading} icon={<BlockOutlinedIcon />} label="Comptes bloqués"
            value={s?.users.blocked} color={C.red} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard loading={loading} icon={<CreditCardOutlinedIcon />} label="Abonnements actifs"
            value={s?.subscriptions.active}
            sub={s ? `${s.subscriptions.totalRevenue.toLocaleString('fr-FR')} ${s.subscriptions.currency} total` : undefined}
            color={C.or} />
        </Grid>
      </Grid>

      {/* KPI section : Catalogue */}
      <Typography variant="overline" sx={{ color: '#999', fontWeight: 700, letterSpacing: 1.5, display: 'block', mb: 1.5 }}>
        Catalogue
      </Typography>
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard loading={loading} icon={<LibraryBooksOutlinedIcon />} label="Contenus publiés"
            value={s?.contents.published} sub={`${s?.contents.total ?? '—'} total`}
            color={C.primary} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard loading={loading} icon={<AutoStoriesOutlinedIcon />} label="Ebooks"
            value={s?.contents.ebooks} color={C.blue} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard loading={loading} icon={<HeadphonesOutlinedIcon />} label="Audiolivres"
            value={s?.contents.audiobooks} color={C.indigo} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard loading={loading} icon={<AccessTimeOutlinedIcon />} label="Heures de lecture"
            value={s?.reading.totalTimeHours}
            sub={`${s?.reading.completed ?? '—'} terminées`}
            color={C.green} />
        </Grid>
      </Grid>

      {/* Bottom row: Chart + Recent subs */}
      <Grid container spacing={3}>
        {/* Monthly signups chart */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: C.indigo, mb: 2 }}>
                Inscriptions (6 mois)
              </Typography>
              {loading
                ? <Skeleton variant="rounded" height={80} />
                : <MiniBar data={s?.monthlySignups} />
              }
              {!loading && s && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: C.indigo }}>
                      {s.users.total.toLocaleString('fr-FR')}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#999' }}>membres au total</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: C.green }}>
                      +{s.users.newThisMonth}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#999' }}>ce mois</Typography>
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Recent subscriptions */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: C.indigo, mb: 2 }}>
                Derniers abonnements
              </Typography>
              {loading ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {[...Array(4)].map((_, i) => <Skeleton key={i} height={44} sx={{ borderRadius: '8px' }} />)}
                </Box>
              ) : !s?.recentSubscriptions?.length ? (
                <Typography variant="body2" sx={{ color: '#aaa', textAlign: 'center', py: 3 }}>Aucune donnée</Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {['Utilisateur', 'Plan', 'Montant', 'Statut', 'Date'].map(h => (
                        <TableCell key={h} sx={{ fontWeight: 700, fontSize: '11px', color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px', border: 0, pb: 1 }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {s.recentSubscriptions.map((sub, i) => {
                      const sc = STATUS_COLORS[sub.status] || { label: sub.status, bg: '#f5f5f5', color: '#666' };
                      return (
                        <TableRow key={i} sx={{ '&:hover': { bgcolor: '#fafafa' } }}>
                          <TableCell sx={{ border: 0, py: 1.2 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>{sub.user_name}</Typography>
                            <Typography variant="caption" sx={{ color: '#999' }}>{sub.user_email}</Typography>
                          </TableCell>
                          <TableCell sx={{ border: 0, py: 1.2 }}>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {sub.plan_type === 'MONTHLY' || sub.plan_type === 'monthly' ? 'Mensuel' : 'Annuel'}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ border: 0, py: 1.2 }}>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {sub.amount?.toLocaleString('fr-FR')} {sub.currency}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ border: 0, py: 1.2 }}>
                            <Chip label={sc.label} size="small"
                              sx={{ bgcolor: sc.bg, color: sc.color, fontWeight: 700, fontSize: '11px', height: 22 }} />
                          </TableCell>
                          <TableCell sx={{ border: 0, py: 1.2 }}>
                            <Typography variant="caption" sx={{ color: '#999' }}>
                              {sub.created_at ? new Date(sub.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '—'}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Reading stats */}
        {!loading && s && (
          <Grid size={{ xs: 12 }}>
            <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: C.indigo, mb: 2 }}>
                  Activité de lecture
                </Typography>
                <Grid container spacing={3}>
                  {[
                    { label: 'Sessions de lecture', value: s.reading.total, color: C.blue },
                    { label: 'Lectures terminées', value: s.reading.completed, color: C.green },
                    { label: 'Taux de complétion', value: s.reading.total ? `${Math.round((s.reading.completed / s.reading.total) * 100)}%` : '0%', color: C.primary },
                    { label: 'Heures totales', value: `${s.reading.totalTimeHours}h`, color: C.indigo },
                  ].map((item, i) => (
                    <Grid size={{ xs: 6, sm: 3 }} key={i}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h4" sx={{ fontWeight: 800, color: item.color }}>
                          {typeof item.value === 'number' ? item.value.toLocaleString('fr-FR') : item.value}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#888', display: 'block', mt: 0.5 }}>
                          {item.label}
                        </Typography>
                        {i < 2 && (
                          <LinearProgress
                            variant="determinate"
                            value={s.reading.total ? Math.min(100, Math.round((s.reading.completed / s.reading.total) * 100)) : 0}
                            sx={{ mt: 1, height: 4, borderRadius: 2, bgcolor: `${item.color}22`, '& .MuiLinearProgress-bar': { bgcolor: item.color } }}
                          />
                        )}
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
