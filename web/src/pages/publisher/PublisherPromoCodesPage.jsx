import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Button, Card, CardContent, Table, TableBody,
  TableCell, TableHead, TableRow, Chip, IconButton, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Select, FormControl, InputLabel, Alert, CircularProgress,
  LinearProgress, Tooltip, Switch, Drawer, Avatar, Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import CloseIcon from '@mui/icons-material/Close';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import tokens from '../../config/tokens';
import {
  getPromoCodes, createPromoCode, deletePromoCode, getPromoQuota,
  togglePromoCode, getPromoCodeUsages,
} from '../../services/publisher.service';

function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function PublisherPromoCodesPage() {
  const [codes, setCodes] = useState([]);
  const [quota, setQuota] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Création
  const [openDialog, setOpenDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ code: generateCode(), discountType: 'percent', discountValue: '', maxUses: '', validFrom: '', validUntil: '' });
  const [formError, setFormError] = useState(null);

  // Toggle
  const [toggling, setToggling] = useState(null);

  // Suppression
  const [deleting, setDeleting] = useState(null);

  // Usages drawer
  const [usageCode, setUsageCode] = useState(null);
  const [usages, setUsages] = useState([]);
  const [usagesLoading, setUsagesLoading] = useState(false);

  async function load() {
    setLoading(true); setError(null);
    try {
      const [codesRes, quotaRes] = await Promise.all([getPromoCodes(), getPromoQuota()]);
      setCodes(codesRes.codes || []);
      setQuota(quotaRes.quota);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function openUsages(code) {
    setUsageCode(code);
    setUsagesLoading(true);
    setUsages([]);
    try {
      const res = await getPromoCodeUsages(code.id);
      setUsages(res.usages || []);
    } catch (e) { setUsages([]); }
    finally { setUsagesLoading(false); }
  }

  async function handleToggle(id) {
    setToggling(id);
    try {
      const res = await togglePromoCode(id);
      setCodes(prev => prev.map(c => c.id === id ? { ...c, is_active: res.code.is_active } : c));
    } catch (e) { alert(e.message); }
    finally { setToggling(null); }
  }

  async function handleCreate() {
    setFormError(null);
    if (!form.code || !form.discountValue || !form.validUntil) { setFormError('Code, valeur et date de fin sont requis.'); return; }
    if (form.discountType === 'percent' && parseFloat(form.discountValue) > 80) { setFormError('La réduction ne peut pas dépasser 80%.'); return; }
    setCreating(true);
    try {
      await createPromoCode({
        code: form.code,
        discountType: form.discountType,
        discountValue: parseFloat(form.discountValue),
        maxUses: form.maxUses ? parseInt(form.maxUses) : null,
        validFrom: form.validFrom || null,
        validUntil: form.validUntil,
      });
      setOpenDialog(false);
      await load();
    } catch (e) { setFormError(e.message); }
    finally { setCreating(false); }
  }

  async function handleDelete(id) {
    if (!window.confirm('Supprimer ce code promo ?')) return;
    setDeleting(id);
    try {
      await deletePromoCode(id);
      setCodes(prev => prev.filter(c => c.id !== id));
      setQuota(q => q ? { ...q, used: Math.max(0, q.used - 1), remaining: q.remaining + 1 } : q);
    } catch (e) { alert(e.message); }
    finally { setDeleting(null); }
  }

  const quotaPct = quota ? (quota.used / quota.limit) * 100 : 0;
  const activeCount = codes.filter(c => {
    const expired = c.valid_until && new Date(c.valid_until) < new Date();
    return c.is_active && !expired;
  }).length;

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
              Codes promo
            </Typography>
            <Typography variant="body2" sx={{ color: '#9E9E9E', mt: 0.3 }}>
              {activeCount} actif{activeCount !== 1 ? 's' : ''} · Maximum 80% de réduction
            </Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => { setForm({ code: generateCode(), discountType: 'percent', discountValue: '', maxUses: '', validFrom: '', validUntil: '' }); setFormError(null); setOpenDialog(true); }}
          disabled={quota?.remaining === 0}
          sx={{ bgcolor: tokens.colors.primary, borderRadius: '12px', textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: tokens.colors.primaryDark } }}
        >
          Créer un code
        </Button>
      </Box>

      {/* Quota mensuel */}
      {quota && (
        <Card sx={{ borderRadius: '16px', mb: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: tokens.colors.onBackground.light }}>
                Quota ce mois
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: quotaPct >= 90 ? '#F44336' : tokens.colors.onBackground.light }}>
                {quota.used} / {quota.limit}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={quotaPct}
              sx={{
                height: 8, borderRadius: 4, bgcolor: '#F5F5F5',
                '& .MuiLinearProgress-bar': {
                  bgcolor: quotaPct >= 90 ? '#F44336' : quotaPct >= 70 ? '#FF9800' : tokens.colors.primary,
                  borderRadius: 4,
                },
              }}
            />
            <Typography variant="caption" sx={{ color: '#9E9E9E', mt: 0.5, display: 'block' }}>
              {quota.remaining} code{quota.remaining !== 1 ? 's' : ''} restant{quota.remaining !== 1 ? 's' : ''}. Quota réinitialisé le 1er du mois.
            </Typography>
          </CardContent>
        </Card>
      )}

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        {loading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}><CircularProgress sx={{ color: tokens.colors.primary }} /></Box>
        ) : codes.length === 0 ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <LocalOfferOutlinedIcon sx={{ fontSize: 56, color: '#E0D4C8', mb: 2 }} />
            <Typography variant="body1" sx={{ color: '#9E9E9E', fontWeight: 600 }}>Aucun code promo créé</Typography>
            <Typography variant="body2" sx={{ color: '#BDBDBD', mt: 0.5 }}>Créez votre premier code pour offrir des réductions à vos lecteurs.</Typography>
          </Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#FAFAFA' }}>
                <TableCell sx={{ fontWeight: 600, color: '#757575' }}>Code</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#757575' }}>Réduction</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#757575' }}>Utilisations</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#757575' }}>Validité</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#757575' }}>Actif</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#757575' }}>Statut</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {codes.map(c => {
                const expired = c.valid_until && new Date(c.valid_until) < new Date();
                const exhausted = c.max_uses && c.used_count >= c.max_uses;
                const active = c.is_active && !expired && !exhausted;
                return (
                  <TableRow key={c.id} hover>
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
                      <Typography variant="caption" sx={{ color: expired ? '#F44336' : '#757575', fontWeight: expired ? 700 : 400 }}>
                        {c.valid_from ? `${fmtDate(c.valid_from)} →` : ''} {fmtDate(c.valid_until)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Switch
                        size="small"
                        checked={!!c.is_active}
                        onChange={() => handleToggle(c.id)}
                        disabled={toggling === c.id || expired || exhausted}
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': { color: tokens.colors.primary },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: tokens.colors.primary },
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={active ? 'Actif' : expired ? 'Expiré' : exhausted ? 'Épuisé' : 'Inactif'}
                        size="small"
                        sx={{
                          bgcolor: active ? '#E8F5E9' : expired ? '#FFEBEE' : '#F5F5F5',
                          color: active ? '#4CAF50' : expired ? '#F44336' : '#9E9E9E',
                          fontWeight: 700,
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Supprimer">
                        <IconButton size="small" onClick={() => handleDelete(c.id)} disabled={deleting === c.id} sx={{ color: '#F44336' }}>
                          {deleting === c.id ? <CircularProgress size={16} /> : <DeleteOutlineIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
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
        PaperProps={{ sx: { width: { xs: '100vw', sm: 400 } } }}
      >
        {usageCode && (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Entête */}
            <Box sx={{ bgcolor: tokens.colors.primary, p: 3, color: '#fff' }}>
              <IconButton onClick={() => setUsageCode(null)} size="small" sx={{ position: 'absolute', top: 12, right: 12, color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#fff' } }}>
                <CloseIcon fontSize="small" />
              </IconButton>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5 }}>
                <Box sx={{ bgcolor: 'rgba(255,255,255,0.15)', borderRadius: '12px', p: 1.5, display: 'flex' }}>
                  <LocalOfferOutlinedIcon sx={{ fontSize: 22, color: '#fff' }} />
                </Box>
                <Box>
                  <Typography variant="h6" sx={{ fontFamily: 'monospace', fontWeight: 900, letterSpacing: 2 }}>{usageCode.code}</Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)' }}>
                    {usageCode.discount_type === 'percent' ? `-${usageCode.discount_value}%` : `-${usageCode.discount_value} €`}
                    {' · '}
                    {usageCode.max_uses ? `${usageCode.used_count}/${usageCode.max_uses} utilisations` : `${usageCode.used_count} utilisations`}
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* Contenu */}
            <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5 }}>
              <Typography variant="overline" sx={{ color: '#9E9E9E', fontWeight: 700, fontSize: '0.68rem', letterSpacing: 1 }}>
                Historique des utilisations
              </Typography>
              {usagesLoading ? (
                <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}><CircularProgress size={28} sx={{ color: tokens.colors.primary }} /></Box>
              ) : usages.length === 0 ? (
                <Box sx={{ py: 6, textAlign: 'center' }}>
                  <PeopleOutlineIcon sx={{ fontSize: 48, color: '#E0D4C8', mb: 1 }} />
                  <Typography variant="body2" sx={{ color: '#BDBDBD' }}>Aucune utilisation pour ce code.</Typography>
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
                              {u.profiles?.full_name || u.profiles?.email || 'Utilisateur inconnu'}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#9E9E9E' }}>
                              {fmtDateTime(u.used_at)}
                            </Typography>
                          </Box>
                          <Chip
                            label={`-${u.discount_applied} €`}
                            size="small"
                            sx={{ bgcolor: '#FFF8F0', color: tokens.colors.primary, fontWeight: 700, border: `1px solid ${tokens.colors.primary}33` }}
                          />
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

      {/* ── Dialog : Création ── */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 800, fontFamily: 'Playfair Display, serif', color: tokens.colors.onBackground.light }}>
          Créer un code promo
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: '8px !important' }}>
          {formError && <Alert severity="error" sx={{ borderRadius: '10px' }}>{formError}</Alert>}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              label="Code *"
              value={form.code}
              onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
              fullWidth
              inputProps={{ style: { fontFamily: 'monospace', fontWeight: 700, letterSpacing: 2 } }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
            />
            <IconButton onClick={() => setForm(f => ({ ...f, code: generateCode() }))} sx={{ border: '1px solid #E0E0E0', borderRadius: '12px', px: 2 }}>
              <RefreshIcon />
            </IconButton>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControl sx={{ minWidth: 160 }}>
              <InputLabel>Type</InputLabel>
              <Select value={form.discountType} label="Type" onChange={e => setForm(f => ({ ...f, discountType: e.target.value }))} sx={{ borderRadius: '12px' }}>
                <MenuItem value="percent">Pourcentage (%)</MenuItem>
                <MenuItem value="fixed">Montant fixe (€)</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label={`Valeur * ${form.discountType === 'percent' ? '(max 80%)' : '(€)'}`}
              value={form.discountValue}
              onChange={e => setForm(f => ({ ...f, discountValue: e.target.value }))}
              type="number"
              inputProps={{ min: 0.01, max: form.discountType === 'percent' ? 80 : undefined }}
              fullWidth
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
            />
          </Box>
          <TextField
            label="Nb utilisations max (vide = illimité)"
            value={form.maxUses}
            onChange={e => setForm(f => ({ ...f, maxUses: e.target.value }))}
            type="number"
            inputProps={{ min: 1 }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField label="Date début" type="date" value={form.validFrom} onChange={e => setForm(f => ({ ...f, validFrom: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
            <TextField label="Date fin *" type="date" value={form.validUntil} onChange={e => setForm(f => ({ ...f, validUntil: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setOpenDialog(false)} sx={{ textTransform: 'none', color: '#757575' }}>Annuler</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={creating}
            startIcon={creating ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ bgcolor: tokens.colors.primary, borderRadius: '12px', textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: tokens.colors.primaryDark } }}
          >
            {creating ? 'Création...' : 'Créer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
