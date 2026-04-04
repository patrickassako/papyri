/**
 * AdminPublisherPromoCodesPage — /admin/publisher-promo-codes
 * Gestion des codes promo des éditeurs : limites, actifs, utilisations
 */
import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, Table, TableHead, TableBody,
  TableRow, TableCell, CircularProgress, Alert, Switch, IconButton,
  Select, MenuItem, FormControl, InputLabel, Drawer, Avatar, Button,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Divider,
  Tooltip, LinearProgress, Snackbar,
} from '@mui/material';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import PeopleOutlineIcon      from '@mui/icons-material/PeopleOutline';
import TuneIcon               from '@mui/icons-material/Tune';
import CloseIcon              from '@mui/icons-material/Close';
import EditOutlinedIcon       from '@mui/icons-material/EditOutlined';
import tokens from '../../config/tokens';
import {
  adminGetPublisherPromoCodes,
  adminTogglePublisherPromoCode,
  adminGetPublisherPromoCodeUsages,
  adminUpdatePublisherPromoLimit,
} from '../../services/publisher.service';
import { authFetch } from '../../services/auth.service';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const STATUS_CFG = {
  active:   { label: 'Actif',    bgcolor: '#E8F5E9', color: '#2E7D32' },
  expired:  { label: 'Expiré',   bgcolor: '#FFEBEE', color: '#C62828' },
  inactive: { label: 'Inactif',  bgcolor: '#F5F5F5', color: '#757575' },
  exhausted:{ label: 'Épuisé',   bgcolor: '#FFF3E0', color: '#E65100' },
};

function codeStatus(c) {
  if (!c.is_active) return 'inactive';
  if (c.isExpired) return 'expired';
  if (c.max_uses && c.used_count >= c.max_uses) return 'exhausted';
  return 'active';
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AdminPublisherPromoCodesPage() {
  const [codes, setCodes]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'error' });
  const showError = (msg) => setSnack({ open: true, msg, severity: 'error' });
  const [error, setError]       = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [toggling, setToggling] = useState(null);

  // Usages drawer
  const [usageCode, setUsageCode]       = useState(null);
  const [usages, setUsages]             = useState([]);
  const [usagesLoading, setUsagesLoading] = useState(false);

  // Limit editor dialog
  const [limitDialog, setLimitDialog] = useState(null); // { publisher }
  const [limitValue, setLimitValue]   = useState('');
  const [limitSaving, setLimitSaving] = useState(false);
  const [limitError, setLimitError]   = useState(null);

  // Publishers summary (for limit panel)
  const [publishers, setPublishers]   = useState([]);
  const [publishersLoading, setPublishersLoading] = useState(true);

  async function loadCodes() {
    setLoading(true); setError(null);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const res = await adminGetPublisherPromoCodes(params);
      setCodes(res.codes || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function loadPublishers() {
    setPublishersLoading(true);
    try {
      const res = await authFetch(`${API}/api/admin/publishers?limit=200`);
      const data = await res.json();
      setPublishers(data.publishers || []);
    } catch (e) { /* silent */ }
    finally { setPublishersLoading(false); }
  }

  useEffect(() => { loadCodes(); }, [statusFilter]);
  useEffect(() => { loadPublishers(); }, []);

  async function openUsages(code) {
    setUsageCode(code); setUsages([]); setUsagesLoading(true);
    try {
      const res = await adminGetPublisherPromoCodeUsages(code.id);
      setUsages(res.usages || []);
    } catch (e) { setUsages([]); }
    finally { setUsagesLoading(false); }
  }

  async function handleToggle(codeId) {
    setToggling(codeId);
    try {
      const res = await adminTogglePublisherPromoCode(codeId);
      setCodes(prev => prev.map(c => c.id === codeId ? { ...c, is_active: res.code.is_active } : c));
      if (usageCode?.id === codeId) setUsageCode(u => ({ ...u, is_active: res.code.is_active }));
    } catch (e) { showError(e.message); }
    finally { setToggling(null); }
  }

  function openLimitDialog(pub) {
    setLimitDialog({ publisher: pub });
    setLimitValue(String(pub.promo_monthly_limit ?? 50));
    setLimitError(null);
  }

  async function handleSaveLimit() {
    const val = parseInt(limitValue);
    if (isNaN(val) || val < 1 || val > 500) { setLimitError('Valeur entre 1 et 500.'); return; }
    setLimitSaving(true); setLimitError(null);
    try {
      const res = await adminUpdatePublisherPromoLimit(limitDialog.publisher.id, val);
      setPublishers(prev => prev.map(p => p.id === res.publisher.id ? { ...p, promo_monthly_limit: res.publisher.promo_monthly_limit } : p));
      setLimitDialog(null);
    } catch (e) { setLimitError(e.message); }
    finally { setLimitSaving(false); }
  }

  // Stats
  const activeCount   = codes.filter(c => codeStatus(c) === 'active').length;
  const expiredCount  = codes.filter(c => codeStatus(c) === 'expired').length;
  const totalUsages   = codes.reduce((acc, c) => acc + (c.used_count || 0), 0);

  return (
    <Box sx={{ p: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ bgcolor: '#EDD9C8', borderRadius: '14px', p: 1.5, display: 'flex' }}>
            <LocalOfferOutlinedIcon sx={{ color: tokens.colors.primary, fontSize: 26 }} />
          </Box>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: tokens.colors.onBackground.light, fontFamily: 'Playfair Display, serif', lineHeight: 1.1 }}>
              Codes promo éditeurs
            </Typography>
            <Typography variant="body2" sx={{ color: '#9E9E9E', mt: 0.3 }}>
              Gestion des codes, limites mensuelles et suivi des utilisations
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Stats cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 3 }}>
        {[
          { label: 'Codes actifs',    value: activeCount,  color: '#2E7D32', bg: '#E8F5E9' },
          { label: 'Codes expirés',   value: expiredCount, color: '#C62828', bg: '#FFEBEE' },
          { label: 'Total utilisations', value: totalUsages, color: tokens.colors.primaryDark, bg: '#FFF8F0' },
        ].map(s => (
          <Card key={s.label} sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h4" sx={{ fontWeight: 800, color: s.color }}>{loading ? '—' : s.value}</Typography>
              <Typography variant="body2" sx={{ color: '#9E9E9E', mt: 0.5 }}>{s.label}</Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Limites par éditeur */}
      <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <TuneIcon sx={{ color: tokens.colors.primary, fontSize: 20 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: tokens.colors.onBackground.light }}>
              Limites mensuelles par éditeur
            </Typography>
          </Box>
          {publishersLoading ? (
            <CircularProgress size={24} sx={{ color: tokens.colors.primary }} />
          ) : publishers.length === 0 ? (
            <Typography variant="body2" sx={{ color: '#BDBDBD' }}>Aucun éditeur actif.</Typography>
          ) : (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
              {publishers.filter(p => p.status === 'active').map(pub => {
                const limit = pub.promo_monthly_limit ?? 50;
                const used = codes.filter(c => c.publisher_id === pub.id).length;
                const pct = Math.min(100, (used / limit) * 100);
                return (
                  <Card key={pub.id} sx={{ borderRadius: '12px', boxShadow: 'none', border: '1px solid #F0EDE8', minWidth: 200, flex: '1 1 200px' }}>
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: tokens.colors.onBackground.light, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {pub.company_name}
                        </Typography>
                        <Tooltip title="Modifier la limite">
                          <IconButton size="small" onClick={() => openLimitDialog(pub)} sx={{ ml: 0.5, color: '#9E9E9E', '&:hover': { color: tokens.colors.primary } }}>
                            <EditOutlinedIcon sx={{ fontSize: 15 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" sx={{ color: '#9E9E9E' }}>Ce mois</Typography>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: pct >= 90 ? '#F44336' : tokens.colors.onBackground.light }}>
                          {used} / {limit}
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={pct}
                        sx={{
                          height: 5, borderRadius: 3, bgcolor: '#F5F5F5',
                          '& .MuiLinearProgress-bar': {
                            bgcolor: pct >= 90 ? '#F44336' : pct >= 70 ? '#FF9800' : tokens.colors.primary,
                            borderRadius: 3,
                          },
                        }}
                      />
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Filtre statut */}
      <Box sx={{ mb: 3 }}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Statut</InputLabel>
          <Select value={statusFilter} label="Statut" onChange={e => setStatusFilter(e.target.value)} sx={{ borderRadius: '10px' }}>
            <MenuItem value="">Tous</MenuItem>
            {Object.entries(STATUS_CFG).map(([k, v]) => <MenuItem key={k} value={k}>{v.label}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {/* Table des codes */}
      <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        {loading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
            <CircularProgress sx={{ color: tokens.colors.primary }} />
          </Box>
        ) : codes.length === 0 ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <LocalOfferOutlinedIcon sx={{ fontSize: 56, color: '#E0D4C8', mb: 2 }} />
            <Typography variant="h6" sx={{ color: '#9E9E9E', fontWeight: 700 }}>Aucun code promo éditeur</Typography>
          </Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#FAFAFA' }}>
                <TableCell sx={{ fontWeight: 700, color: '#555' }}>Éditeur</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#555' }}>Code</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#555' }}>Réduction</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#555' }}>Utilisations</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#555' }}>Validité</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#555' }}>Statut</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#555' }}>Actif</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {codes.map(c => {
                const st = codeStatus(c);
                const cfg = STATUS_CFG[st];
                return (
                  <TableRow key={c.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{ width: 30, height: 30, bgcolor: tokens.colors.primary, fontSize: '0.75rem', fontWeight: 700 }}>
                          {(c.publisher?.company_name || 'E').charAt(0).toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: tokens.colors.onBackground.light, fontSize: '0.83rem' }}>
                            {c.publisher?.company_name || '—'}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#9E9E9E' }}>{c.publisher?.contact_name}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell
                      sx={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: 1, cursor: 'pointer', color: tokens.colors.primary }}
                      onClick={() => openUsages(c)}
                    >
                      {c.code}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={c.discount_type === 'percent' ? `-${c.discount_value}%` : `-${c.discount_value} €`}
                        size="small"
                        sx={{ bgcolor: '#FFF8F0', color: tokens.colors.primary, fontWeight: 700, border: `1px solid ${tokens.colors.primary}33` }}
                      />
                    </TableCell>
                    <TableCell>
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 0.75, cursor: 'pointer' }}
                        onClick={() => openUsages(c)}
                      >
                        <PeopleOutlineIcon sx={{ fontSize: 15, color: '#9E9E9E' }} />
                        <Typography variant="body2" sx={{ color: c.used_count > 0 ? tokens.colors.onBackground.light : '#BDBDBD', fontWeight: c.used_count > 0 ? 700 : 400 }}>
                          {c.max_uses ? `${c.used_count} / ${c.max_uses}` : `${c.used_count} / ∞`}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ color: c.isExpired ? '#F44336' : '#757575', fontWeight: c.isExpired ? 700 : 400 }}>
                        {fmtDate(c.valid_until)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={cfg.label} size="small" sx={{ bgcolor: cfg.bgcolor, color: cfg.color, fontWeight: 700 }} />
                    </TableCell>
                    <TableCell>
                      <Switch
                        size="small"
                        checked={!!c.is_active}
                        onChange={() => handleToggle(c.id)}
                        disabled={toggling === c.id}
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': { color: tokens.colors.primary },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: tokens.colors.primary },
                        }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* ── Drawer : Utilisations ── */}
      <Drawer
        anchor="right"
        open={!!usageCode}
        onClose={() => setUsageCode(null)}
        PaperProps={{ sx: { width: { xs: '100vw', sm: 420 } } }}
      >
        {usageCode && (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box sx={{ bgcolor: tokens.colors.primary, p: 3, color: '#fff', position: 'relative' }}>
              <IconButton onClick={() => setUsageCode(null)} size="small" sx={{ position: 'absolute', top: 12, right: 12, color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#fff' } }}>
                <CloseIcon fontSize="small" />
              </IconButton>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5 }}>
                <Box sx={{ bgcolor: 'rgba(255,255,255,0.15)', borderRadius: '12px', p: 1.5, display: 'flex' }}>
                  <LocalOfferOutlinedIcon sx={{ fontSize: 22 }} />
                </Box>
                <Box>
                  <Typography variant="h6" sx={{ fontFamily: 'monospace', fontWeight: 900, letterSpacing: 2 }}>{usageCode.code}</Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)' }}>
                    {usageCode.publisher?.company_name} · {usageCode.discount_type === 'percent' ? `-${usageCode.discount_value}%` : `-${usageCode.discount_value} €`}
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Box sx={{ p: 2.5, flex: 1, overflowY: 'auto' }}>
              {/* Infos code */}
              <Card sx={{ borderRadius: '12px', boxShadow: 'none', border: '1px solid #F0EDE8', mb: 2.5 }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                    {[
                      ['Statut', <Chip label={STATUS_CFG[codeStatus(usageCode)].label} size="small" sx={{ bgcolor: STATUS_CFG[codeStatus(usageCode)].bgcolor, color: STATUS_CFG[codeStatus(usageCode)].color, fontWeight: 700 }} />],
                      ['Utilisations', usageCode.max_uses ? `${usageCode.used_count} / ${usageCode.max_uses}` : `${usageCode.used_count} / ∞`],
                      ['Début', fmtDate(usageCode.valid_from)],
                      ['Fin', fmtDate(usageCode.valid_until)],
                    ].map(([label, val]) => (
                      <Box key={label}>
                        <Typography variant="caption" sx={{ color: '#9E9E9E', fontWeight: 600, display: 'block', mb: 0.25 }}>{label}</Typography>
                        {typeof val === 'string'
                          ? <Typography variant="body2" sx={{ color: tokens.colors.onBackground.light, fontWeight: 600 }}>{val}</Typography>
                          : val}
                      </Box>
                    ))}
                  </Box>
                </CardContent>
              </Card>

              <Typography variant="overline" sx={{ color: '#9E9E9E', fontWeight: 700, fontSize: '0.68rem', letterSpacing: 1 }}>
                Historique des utilisations
              </Typography>

              {usagesLoading ? (
                <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}><CircularProgress size={28} sx={{ color: tokens.colors.primary }} /></Box>
              ) : usages.length === 0 ? (
                <Box sx={{ py: 5, textAlign: 'center' }}>
                  <PeopleOutlineIcon sx={{ fontSize: 40, color: '#E0D4C8', mb: 1 }} />
                  <Typography variant="body2" sx={{ color: '#BDBDBD' }}>Aucune utilisation.</Typography>
                </Box>
              ) : (
                <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {usages.map(u => (
                    <Card key={u.id} sx={{ borderRadius: '12px', boxShadow: 'none', border: '1px solid #F0EDE8' }}>
                      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar sx={{ width: 32, height: 32, bgcolor: tokens.colors.primary, fontSize: '0.8rem', fontWeight: 700 }}>
                            {(u.profiles?.full_name || u.profiles?.email || '?').charAt(0).toUpperCase()}
                          </Avatar>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: tokens.colors.onBackground.light, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {u.profiles?.full_name || u.profiles?.email || 'Inconnu'}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#9E9E9E' }}>{fmtDateTime(u.used_at)}</Typography>
                          </Box>
                          <Chip label={`-${u.discount_applied} €`} size="small" sx={{ bgcolor: '#FFF8F0', color: tokens.colors.primary, fontWeight: 700 }} />
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              )}
            </Box>
          </Box>
        )}
      </Drawer>

      {/* ── Dialog : Modifier limite ── */}
      <Dialog open={!!limitDialog} onClose={() => setLimitDialog(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 800, fontFamily: 'Playfair Display, serif', color: tokens.colors.onBackground.light }}>
          Limite mensuelle
        </DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          {limitError && <Alert severity="error" sx={{ mb: 2, borderRadius: '10px' }}>{limitError}</Alert>}
          <Typography variant="body2" sx={{ color: '#757575', mb: 2 }}>
            Éditeur : <strong>{limitDialog?.publisher?.company_name}</strong>
          </Typography>
          <TextField
            label="Nombre de codes / mois *"
            type="number"
            value={limitValue}
            onChange={e => setLimitValue(e.target.value)}
            fullWidth
            inputProps={{ min: 1, max: 500 }}
            helperText="Entre 1 et 500 codes par mois"
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setLimitDialog(null)} sx={{ textTransform: 'none', color: '#757575' }}>Annuler</Button>
          <Button
            variant="contained"
            onClick={handleSaveLimit}
            disabled={limitSaving}
            startIcon={limitSaving ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ bgcolor: tokens.colors.primary, borderRadius: '12px', textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: tokens.colors.primaryDark } }}
          >
            {limitSaving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.severity} onClose={() => setSnack(s => ({ ...s, open: false }))} sx={{ borderRadius: '10px' }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
