/**
 * AdminTransactionsPage
 * Route: /admin/transactions
 * Liste complète des paiements (Stripe + Flutterwave Mobile Money + carte)
 * avec filtres, recherche, pagination et stats.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Card, Typography, Chip, IconButton,
  Table, TableHead, TableBody, TableRow, TableCell, Avatar,
  TextField, Select, MenuItem, FormControl, InputLabel,
  Skeleton, Pagination, Drawer, Divider, Stack,
} from '@mui/material';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import { authFetch } from '../../services/auth.service';
import tokens from '../../config/tokens';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminEmptyState from '../../components/admin/AdminEmptyState';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const C = {
  primary: tokens.colors.primary, indigo: tokens.colors.accent,
  green: '#27ae60', red: '#e74c3c', orange: '#FF9800', grey: '#8c8c8c',
  bg: '#F7F6F3', textPrimary: '#1a1a2e', textSecondary: '#6b7280',
  border: '#e5e0d8',
};

const STATUS_CFG = {
  pending:   { label: 'En attente', color: C.orange, icon: AccessTimeIcon },
  succeeded: { label: 'Réussi',     color: C.green,  icon: CheckCircleOutlineIcon },
  failed:    { label: 'Échoué',     color: C.red,    icon: CancelOutlinedIcon },
  cancelled: { label: 'Annulé',     color: C.grey,   icon: CancelOutlinedIcon },
};

const PROVIDER_LABELS = {
  stripe: 'Stripe',
  flutterwave: 'Flutterwave',
};

function fmtMoney(amount, currency = 'CAD') {
  if (amount == null) return '—';
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(Number(amount));
  } catch (_) { return `${amount} ${currency}`; }
}
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function paymentTypeLabel(metadata) {
  switch (metadata?.payment_type) {
    case 'subscription_initial':  return 'Abonnement';
    case 'subscription_renewal':  return 'Renouvellement';
    case 'content_unlock':        return 'Déblocage livre';
    case 'extra_seat':            return 'Place supp.';
    default:                      return metadata?.payment_type || '—';
  }
}

const inputSx = { '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: '#fff' } };

export default function AdminTransactionsPage() {
  const [payments, setPayments] = useState([]);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [drawer, setDrawer] = useState(null); // selected payment

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [provider, setProvider] = useState('');
  const [method, setMethod] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const params = new URLSearchParams({ page, limit: '25' });
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      if (provider) params.set('provider', provider);
      if (method) params.set('method', method);
      const r = await authFetch(`${API}/api/payments/admin/list?${params.toString()}`);
      const d = await r.json();
      if (d?.success) {
        setPayments(d.payments || []);
        setPagination(d.pagination || { page: 1, limit: 25, total: 0, pages: 1 });
        setStats(d.stats || null);
      }
    } catch (_) {}
    finally { setLoading(false); setRefreshing(false); }
  }, [page, search, status, provider, method]);

  useEffect(() => { load(); }, [load]);

  const kpis = [
    { label: 'Total transactions', value: stats?.total ?? '—', icon: ReceiptLongOutlinedIcon, color: C.indigo },
    { label: 'Réussies', value: stats?.byStatus?.succeeded ?? 0, icon: CheckCircleOutlineIcon, color: C.green },
    { label: 'En attente', value: stats?.byStatus?.pending ?? 0, icon: AccessTimeIcon, color: C.orange },
    { label: 'Chiffre d\'affaires (CAD)', value: stats?.totalCadAmount ? fmtMoney(stats.totalCadAmount, 'CAD') : 'C$0', icon: PaidOutlinedIcon, color: C.primary },
  ];

  return (
    <Box sx={{ bgcolor: C.bg, minHeight: '100vh' }}>
      <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1300, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <AdminPageHeader
          title="Transactions"
          subtitle={`${pagination.total} paiement${pagination.total > 1 ? 's' : ''} enregistré${pagination.total > 1 ? 's' : ''}`}
          action={
            <IconButton onClick={load} disabled={refreshing} sx={{ bgcolor: '#fff', border: `1px solid ${C.border}` }}>
              <RefreshIcon sx={{ color: C.textSecondary, animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            </IconButton>
          }
        />

        {/* KPIs */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {kpis.map(k => {
            const Icon = k.icon;
            return (
              <Card key={k.label} sx={{ borderRadius: '14px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', px: 2.5, py: 2, display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 200 }}>
                <Box sx={{ width: 42, height: 42, borderRadius: '10px', bgcolor: `${k.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon sx={{ color: k.color, fontSize: 22 }} />
                </Box>
                <Box>
                  {loading ? <Skeleton width={60} height={28} /> : (
                    <Typography variant="h5" fontWeight={900} color={k.color}>{k.value}</Typography>
                  )}
                  <Typography variant="caption" color={C.textSecondary} fontWeight={600}>{k.label}</Typography>
                </Box>
              </Card>
            );
          })}
        </Box>

        {/* Filters */}
        <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', p: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
            <TextField
              size="small" placeholder="Rechercher par tx_ref…"
              value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              sx={{ ...inputSx, flex: 2 }}
              InputProps={{ startAdornment: <SearchIcon sx={{ color: C.grey, mr: 1, fontSize: 18 }} /> }}
            />
            <FormControl size="small" sx={{ ...inputSx, minWidth: 140 }}>
              <InputLabel>Statut</InputLabel>
              <Select value={status} label="Statut" onChange={e => { setStatus(e.target.value); setPage(1); }}>
                <MenuItem value="">Tous</MenuItem>
                <MenuItem value="succeeded">Réussi</MenuItem>
                <MenuItem value="pending">En attente</MenuItem>
                <MenuItem value="failed">Échoué</MenuItem>
                <MenuItem value="cancelled">Annulé</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ ...inputSx, minWidth: 160 }}>
              <InputLabel>Prestataire</InputLabel>
              <Select value={provider} label="Prestataire" onChange={e => { setProvider(e.target.value); setPage(1); }}>
                <MenuItem value="">Tous</MenuItem>
                <MenuItem value="stripe">Stripe</MenuItem>
                <MenuItem value="flutterwave">Flutterwave</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ ...inputSx, minWidth: 160 }}>
              <InputLabel>Méthode</InputLabel>
              <Select value={method} label="Méthode" onChange={e => { setMethod(e.target.value); setPage(1); }}>
                <MenuItem value="">Toutes</MenuItem>
                <MenuItem value="card">Carte</MenuItem>
                <MenuItem value="mobile_money">Mobile Money</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </Card>

        {/* Table */}
        <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          {loading ? (
            <Box sx={{ p: 2 }}>{[1,2,3,4,5].map(i => <Skeleton key={i} height={48} sx={{ mb: 1, borderRadius: '8px' }} />)}</Box>
          ) : payments.length === 0 ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <AdminEmptyState title="Aucune transaction" description="Aucun paiement ne correspond à ces filtres." />
            </Box>
          ) : (
            <>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#faf9f7' }}>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Utilisateur</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Montant</TableCell>
                    <TableCell>Prestataire</TableCell>
                    <TableCell>Méthode</TableCell>
                    <TableCell>Statut</TableCell>
                    <TableCell align="right">Référence</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {payments.map(p => {
                    const cfg = STATUS_CFG[p.status] || { label: p.status, color: C.grey, icon: AccessTimeIcon };
                    const StatusIcon = cfg.icon;
                    return (
                      <TableRow key={p.id} hover sx={{ cursor: 'pointer' }} onClick={() => setDrawer(p)}>
                        <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.78rem', color: C.textSecondary }}>{fmtDate(p.created_at)}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar sx={{ width: 28, height: 28, bgcolor: C.indigo, fontSize: '0.75rem' }}>
                              {(p.profiles?.full_name || p.profiles?.email || '?').charAt(0).toUpperCase()}
                            </Avatar>
                            <Box>
                              <Typography variant="caption" fontWeight={700} color={C.textPrimary} sx={{ display: 'block', lineHeight: 1.2 }}>
                                {p.profiles?.full_name || '—'}
                              </Typography>
                              <Typography variant="caption" color={C.textSecondary} sx={{ fontSize: '0.7rem' }}>
                                {p.profiles?.email || '—'}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.78rem' }}>{paymentTypeLabel(p.metadata)}</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.85rem' }}>{fmtMoney(p.amount, p.currency)}</TableCell>
                        <TableCell sx={{ fontSize: '0.78rem' }}>{PROVIDER_LABELS[p.provider] || p.provider}</TableCell>
                        <TableCell sx={{ fontSize: '0.78rem' }}>{p.payment_method === 'mobile_money' ? '📱 MoMo' : p.payment_method === 'card' ? '💳 Carte' : p.payment_method || '—'}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            icon={<StatusIcon sx={{ fontSize: '0.9rem !important', color: `${cfg.color} !important` }} />}
                            label={cfg.label}
                            sx={{ bgcolor: `${cfg.color}18`, color: cfg.color, fontWeight: 700, fontSize: '0.7rem', height: 22 }}
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: '0.7rem', color: C.textSecondary, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.provider_payment_id || '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {pagination.pages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2, borderTop: `1px solid ${C.border}` }}>
                  <Pagination
                    count={pagination.pages}
                    page={page}
                    onChange={(_, p) => setPage(p)}
                    color="primary"
                    size="small"
                  />
                </Box>
              )}
            </>
          )}
        </Card>
      </Box>

      {/* Drawer détail */}
      <Drawer anchor="right" open={!!drawer} onClose={() => setDrawer(null)} PaperProps={{ sx: { width: { xs: '100%', sm: 460 }, p: 3 } }}>
        {drawer && (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" fontWeight={800}>Détail paiement</Typography>
              <IconButton onClick={() => setDrawer(null)}><CloseIcon /></IconButton>
            </Box>
            <Divider sx={{ mb: 2 }} />
            <Stack spacing={1.5}>
              <Field label="Statut" value={(STATUS_CFG[drawer.status] || {}).label || drawer.status} />
              <Field label="Type" value={paymentTypeLabel(drawer.metadata)} />
              <Field label="Montant (CAD)" value={fmtMoney(drawer.amount, drawer.currency)} />
              {drawer.metadata?.base_cad_amount && drawer.metadata?.fx_rate && drawer.metadata?.country && (
                <Field
                  label={`Montant local (${drawer.metadata.country})`}
                  value={`≈ ${Math.round(Number(drawer.metadata.base_cad_amount) * Number(drawer.metadata.fx_rate))} (taux 1 CAD = ${drawer.metadata.fx_rate})`}
                />
              )}
              <Field label="Utilisateur" value={drawer.profiles?.full_name || drawer.profiles?.email || drawer.user_id} />
              <Field label="Email" value={drawer.profiles?.email || '—'} />
              <Field label="Prestataire" value={PROVIDER_LABELS[drawer.provider] || drawer.provider} />
              <Field label="Méthode" value={drawer.payment_method || '—'} />
              <Field label="Pays" value={drawer.metadata?.country || '—'} />
              <Field label="Opérateur" value={drawer.metadata?.operator || '—'} />
              <Field label="Référence (tx_ref)" value={drawer.provider_payment_id || '—'} mono />
              <Field label="Créé le" value={fmtDate(drawer.created_at)} />
              <Field label="Payé le" value={fmtDate(drawer.paid_at)} />
              {drawer.failure_reason && (
                <Field label="Raison échec" value={drawer.failure_reason} />
              )}
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" fontWeight={700} color={C.textSecondary} sx={{ display: 'block', mb: 1 }}>
                  Métadonnées
                </Typography>
                <Box sx={{ bgcolor: '#1a1a2e', color: '#fff', p: 1.5, borderRadius: 1, fontSize: '0.7rem', fontFamily: 'monospace', overflow: 'auto', maxHeight: 220 }}>
                  <pre style={{ margin: 0 }}>{JSON.stringify(drawer.metadata, null, 2)}</pre>
                </Box>
              </Box>
            </Stack>
          </>
        )}
      </Drawer>

      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </Box>
  );
}

function Field({ label, value, mono }) {
  return (
    <Box>
      <Typography variant="caption" fontWeight={700} color={C.textSecondary} sx={{ display: 'block' }}>{label}</Typography>
      <Typography variant="body2" sx={{ fontFamily: mono ? 'monospace' : 'inherit', fontSize: mono ? '0.78rem' : '0.85rem' }}>{value}</Typography>
    </Box>
  );
}
