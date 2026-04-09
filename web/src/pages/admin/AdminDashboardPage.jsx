import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, Grid, Chip, Button,
  Table, TableBody, TableCell, TableHead, TableRow,
  Alert, LinearProgress, Skeleton,
} from '@mui/material';
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import LibraryBooksOutlinedIcon from '@mui/icons-material/LibraryBooksOutlined';
import HeadphonesOutlinedIcon from '@mui/icons-material/HeadphonesOutlined';
import AutoStoriesOutlinedIcon from '@mui/icons-material/AutoStoriesOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import GppMaybeOutlinedIcon from '@mui/icons-material/GppMaybeOutlined';
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';
import NorthEastOutlinedIcon from '@mui/icons-material/NorthEastOutlined';
import MonetizationOnOutlinedIcon from '@mui/icons-material/MonetizationOnOutlined';
import tokens from '../../config/tokens';
import { getGlobalStats } from '../../services/admin.service';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminSection from '../../components/admin/AdminSection';
import AdminStatCard from '../../components/admin/AdminStatCard';
import AdminEmptyState from '../../components/admin/AdminEmptyState';

const C = {
  primary: tokens.colors.primary,
  or: tokens.colors.secondary,
  indigo: tokens.colors.accent,
  green: '#27ae60',
  red: '#e74c3c',
  blue: '#2196F3',
};

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

function formatAuditAction(entry) {
  const action = entry?.action || 'action';
  const resource = entry?.resource || 'ressource';
  return `${action} · ${resource}`;
}

function severityLabel(value) {
  if (value > 0) return { label: 'Action requise', color: '#b42318', bg: '#fef3f2' };
  return { label: 'Stable', color: '#027a48', bg: '#ecfdf3' };
}

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
  const attentionItems = s ? [
    {
      key: 'blocked-users',
      title: 'Comptes bloqués',
      value: s.users.blocked,
      tone: s.users.blocked > 0 ? C.red : '#9e9e9e',
      description: s.users.blocked > 0 ? 'Des utilisateurs nécessitent une revue d’accès.' : 'Aucun blocage utilisateur actuellement.',
      cta: { label: 'Voir les utilisateurs', onClick: () => navigate('/admin/users') },
    },
    {
      key: 'expired-subs',
      title: 'Abonnements expirés',
      value: s.subscriptions.expired,
      tone: s.subscriptions.expired > 0 ? C.or : '#9e9e9e',
      description: s.subscriptions.expired > 0 ? 'Des comptes à relancer ou analyser côté churn.' : 'Aucun abonnement expiré à surveiller.',
      cta: { label: 'Voir les abonnements', onClick: () => navigate('/admin/subscriptions') },
    },
    {
      key: 'content-without-rights',
      title: 'Contenus sans ayant droit',
      value: s.contents.noRightsHolder,
      tone: s.contents.noRightsHolder > 0 ? C.red : '#9e9e9e',
      description: s.contents.noRightsHolder > 0 ? 'Des contenus publiés manquent d’information contractuelle.' : 'Aucun contenu orphelin détecté.',
      cta: { label: 'Voir le catalogue', onClick: () => navigate('/admin/books') },
    },
  ] : [];

  const quickActions = [
    { label: 'Gérer les utilisateurs', icon: <PeopleOutlinedIcon fontSize="small" />, onClick: () => navigate('/admin/users') },
    { label: 'Valider le contenu', icon: <LibraryBooksOutlinedIcon fontSize="small" />, onClick: () => navigate('/admin/content-validation') },
    { label: 'Suivre les abonnements', icon: <CreditCardOutlinedIcon fontSize="small" />, onClick: () => navigate('/admin/subscriptions') },
    { label: 'Traiter le RGPD', icon: <GppMaybeOutlinedIcon fontSize="small" />, onClick: () => navigate('/admin/gdpr') },
  ];

  return (
    <Box sx={{ p: 4 }}>
      <AdminPageHeader
        title="Tableau de bord"
        subtitle="Pilotage global de la plateforme Papyri"
      />

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }}>{error}</Alert>}

      <Card sx={{ borderRadius: '18px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', mb: 3, bgcolor: '#fbfaf7' }}>
        <CardContent sx={{ p: 2.5 }}>
          {loading ? (
            <Grid container spacing={2}>
              {[1, 2, 3].map((item) => (
                <Grid key={item} size={{ xs: 12, md: 4 }}>
                  <Skeleton variant="rounded" height={72} />
                </Grid>
              ))}
            </Grid>
          ) : (
            <Grid container spacing={2}>
              {[
                { label: 'Revenus agrégés', value: `${s.subscriptions.totalRevenue.toLocaleString('fr-FR')} ${s.subscriptions.currency}`, icon: <MonetizationOnOutlinedIcon sx={{ color: C.or }} /> },
                { label: 'Catalogue publié', value: `${s.contents.published.toLocaleString('fr-FR')} contenus`, icon: <LibraryBooksOutlinedIcon sx={{ color: C.primary }} /> },
                { label: 'Nouveaux utilisateurs', value: `+${s.users.newThisMonth.toLocaleString('fr-FR')} ce mois`, icon: <PersonAddOutlinedIcon sx={{ color: C.green }} /> },
              ].map((item) => (
                <Grid key={item.label} size={{ xs: 12, md: 4 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderRadius: '14px', bgcolor: '#fff', border: '1px solid #efe7da' }}>
                    <Box sx={{ width: 42, height: 42, borderRadius: '12px', bgcolor: '#faf6ef', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {item.icon}
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ color: '#8a8a8a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                        {item.label}
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 800, color: '#1f2937' }}>
                        {item.value}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
              ))}
            </Grid>
          )}
        </CardContent>
      </Card>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <AdminSection title="Points d’attention" subtitle="Éléments qui méritent une action ou une vérification rapide.">
            <Grid container spacing={2}>
              {(loading ? [1, 2, 3] : attentionItems).map((item, index) => (
                <Grid key={item.key || index} size={{ xs: 12, md: 4 }}>
                  <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', height: '100%' }}>
                    <CardContent sx={{ p: 2.5 }}>
                      {loading ? (
                        <>
                          <Skeleton width={80} height={18} />
                          <Skeleton width={64} height={36} sx={{ mt: 1 }} />
                          <Skeleton width="100%" height={16} sx={{ mt: 1.5 }} />
                          <Skeleton width={120} height={30} sx={{ mt: 2 }} />
                        </>
                      ) : (
                        <>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#4b5563' }}>
                                {item.title}
                              </Typography>
                              <Chip
                                label={severityLabel(item.value).label}
                                size="small"
                                sx={{
                                  height: 20,
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  bgcolor: severityLabel(item.value).bg,
                                  color: severityLabel(item.value).color,
                                }}
                              />
                            </Box>
                            <WarningAmberOutlinedIcon sx={{ color: item.tone, fontSize: 18 }} />
                          </Box>
                          <Typography variant="h4" sx={{ fontWeight: 800, color: item.tone, mb: 1 }}>
                            {item.value.toLocaleString('fr-FR')}
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#7a7a7a', minHeight: 44 }}>
                            {item.description}
                          </Typography>
                          <Button
                            size="small"
                            endIcon={<NorthEastOutlinedIcon fontSize="small" />}
                            onClick={item.cta.onClick}
                            sx={{ mt: 2, px: 0, textTransform: 'none', fontWeight: 700, color: C.indigo }}
                          >
                            {item.cta.label}
                          </Button>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </AdminSection>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <AdminSection title="Actions rapides" subtitle="Raccourcis vers les modules critiques du back-office.">
            <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {quickActions.map((action) => (
                    <Button
                      key={action.label}
                      onClick={action.onClick}
                      startIcon={action.icon}
                      endIcon={<NorthEastOutlinedIcon fontSize="small" />}
                      sx={{
                        justifyContent: 'flex-start',
                        borderRadius: '12px',
                        px: 1.5,
                        py: 1.2,
                        textTransform: 'none',
                        color: '#344054',
                        bgcolor: '#f8f7f4',
                        '&:hover': { bgcolor: '#f0ede8' },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <BoltOutlinedIcon sx={{ fontSize: 16, color: C.primary }} />
                        <Typography variant="body2" sx={{ fontWeight: 600, flex: 1, textAlign: 'left' }}>{action.label}</Typography>
                      </Box>
                    </Button>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </AdminSection>
        </Grid>
      </Grid>

      <AdminSection title="Utilisateurs" subtitle="Taille, acquisition et état du parc utilisateurs.">
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <AdminStatCard loading={loading} icon={<PeopleOutlinedIcon />} label="Total utilisateurs"
            value={s?.users.total} sub={`${s?.users.active ?? '—'} actifs`}
            color={C.indigo} onClick={() => navigate('/admin/users')} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <AdminStatCard loading={loading} icon={<PersonAddOutlinedIcon />} label="Nouveaux ce mois"
            value={s?.users.newThisMonth} color={C.green} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <AdminStatCard loading={loading} icon={<BlockOutlinedIcon />} label="Comptes bloqués"
            value={s?.users.blocked} color={C.red} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <AdminStatCard loading={loading} icon={<CreditCardOutlinedIcon />} label="Abonnements actifs"
            value={s?.subscriptions.active}
            sub={s ? `${s.subscriptions.totalRevenue.toLocaleString('fr-FR')} ${s.subscriptions.currency} total` : undefined}
            color={C.or} />
        </Grid>
      </Grid>
      </AdminSection>

      <AdminSection title="Catalogue" subtitle="Couverture éditoriale et volume de lecture consommé.">
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <AdminStatCard loading={loading} icon={<LibraryBooksOutlinedIcon />} label="Contenus publiés"
            value={s?.contents.published} sub={`${s?.contents.total ?? '—'} total`}
            color={C.primary} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <AdminStatCard loading={loading} icon={<AutoStoriesOutlinedIcon />} label="Ebooks"
            value={s?.contents.ebooks} color={C.blue} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <AdminStatCard loading={loading} icon={<HeadphonesOutlinedIcon />} label="Audiolivres"
            value={s?.contents.audiobooks} color={C.indigo} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <AdminStatCard loading={loading} icon={<AccessTimeOutlinedIcon />} label="Heures de lecture"
            value={s?.reading.totalTimeHours}
            sub={`${s?.reading.completed ?? '—'} terminées`}
            color={C.green} />
        </Grid>
      </Grid>
      </AdminSection>

      <Grid container spacing={3}>
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

        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: C.indigo, mb: 2 }}>
                Audit récent
              </Typography>
              {loading ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {[...Array(5)].map((_, i) => <Skeleton key={i} height={40} sx={{ borderRadius: '8px' }} />)}
                </Box>
              ) : !s?.recentAudit?.length ? (
                <AdminEmptyState title="Aucun log" description="L’activité d’administration récente apparaîtra ici." />
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {s.recentAudit.map((entry, i) => (
                    <Box
                      key={`${entry.created_at}-${i}`}
                      sx={{ p: 1.25, borderRadius: '12px', bgcolor: '#faf9f7', border: '1px solid #f1eee8' }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#27303f' }}>
                        {formatAuditAction(entry)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#8c8c8c' }}>
                        {entry.created_at ? new Date(entry.created_at).toLocaleString('fr-FR') : '—'}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
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
                  <AdminEmptyState title="Aucune donnée" description="Aucun abonnement récent à afficher." />
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
