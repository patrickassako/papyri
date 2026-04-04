import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Tabs, Tab, CircularProgress, Alert,
  Card, CardContent, Button, Chip, Table, TableHead, TableRow,
  TableCell, TableBody, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Select, MenuItem, FormControl, InputLabel,
  Switch, FormControlLabel, Tooltip, Divider, ToggleButtonGroup, ToggleButton,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PublicIcon from '@mui/icons-material/Public';
import LockIcon from '@mui/icons-material/Lock';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import tokens from '../../config/tokens';
import { getBooks, getBookGeoPricing, upsertBookGeoPricing, deleteBookGeoPricing,
  getBookGeoRestrictions, setBookGeoRestrictionConfig, deleteBookGeoRestrictionConfig,
  upsertBookGeoZone, deleteBookGeoZone } from '../../services/publisher.service';

const ZONES = [
  { id: 'africa',        label: 'Afrique',         flag: '🌍' },
  { id: 'europe',        label: 'Europe',           flag: '🌍' },
  { id: 'north_america', label: 'Amérique du Nord', flag: '🌎' },
  { id: 'south_america', label: 'Amérique du Sud',  flag: '🌎' },
  { id: 'asia',          label: 'Asie',             flag: '🌏' },
  { id: 'middle_east',   label: 'Moyen-Orient',     flag: '🌏' },
  { id: 'oceania',       label: 'Océanie',          flag: '🌏' },
];

const CURRENCIES = ['EUR', 'USD', 'XAF', 'XOF', 'GBP', 'CAD', 'MAD', 'TND'];

function formatMoney(cents, currency = 'USD') {
  const amount = Number(cents || 0) / 100;
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, minimumFractionDigits: amount % 1 === 0 ? 0 : 2 }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

// ─── Tab Geo Pricing ──────────────────────────────────────────────────────────

function GeoPricingTab({ contentId, basePriceCents, baseCurrency }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ zone: '', price_cents: '', currency: 'EUR', notes: '', is_active: true });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getBookGeoPricing(contentId);
      setRows(res.pricing || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [contentId]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditing(null); setForm({ zone: '', price_cents: '', currency: 'EUR', notes: '', is_active: true }); setDialogOpen(true); };
  const openEdit = (row) => { setEditing(row); setForm({ zone: row.zone, price_cents: String(row.price_cents / 100), currency: row.currency, notes: row.notes || '', is_active: row.is_active }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.zone || !form.price_cents) return;
    setSaving(true);
    try {
      const zone = ZONES.find(z => z.id === form.zone);
      await upsertBookGeoPricing(contentId, {
        zone: form.zone,
        zone_label: zone?.label || form.zone,
        price_cents: Math.round(parseFloat(form.price_cents) * 100),
        currency: form.currency,
        is_active: form.is_active,
        notes: form.notes || null,
      });
      setDialogOpen(false);
      await load();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Supprimer le prix pour "${row.zone_label}" ?`)) return;
    try { await deleteBookGeoPricing(contentId, row.id); await load(); } catch (e) { alert(e.message); }
  };

  const usedZones = rows.map(r => r.zone);
  const availableZones = ZONES.filter(z => editing ? true : !usedZones.includes(z.id));

  if (loading) return <Box sx={{ py: 6, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="body2" color="text.secondary">
            Prix de base : <strong>{basePriceCents ? formatMoney(basePriceCents, baseCurrency) : 'Non défini'}</strong>
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Définissez des prix réduits par zone géographique pour élargir votre audience.
          </Typography>
        </Box>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openAdd}
          disabled={availableZones.length === 0}
          sx={{ bgcolor: tokens.colors.primary, borderRadius: '10px', textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: '#9e5519' } }}>
          Ajouter une zone
        </Button>
      </Box>

      {rows.length === 0 ? (
        <Box sx={{ py: 5, textAlign: 'center', color: '#9E9E9E' }}>
          <PublicIcon sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
          <Typography>Aucun prix géographique défini</Typography>
          <Typography variant="caption">Tous les lecteurs voient le prix de base.</Typography>
        </Box>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#FAFAFA' }}>
              <TableCell sx={{ fontWeight: 600 }}>Zone</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Prix localisé</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Écart</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Actif</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map(row => {
              const zone = ZONES.find(z => z.id === row.zone);
              const diff = basePriceCents > 0 ? Math.round((1 - row.price_cents / basePriceCents) * 100) : 0;
              return (
                <TableRow key={row.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <span>{zone?.flag || '🌐'}</span>
                      <Typography variant="body2" fontWeight={600}>{row.zone_label}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell><Typography variant="body2" fontWeight={700} color="primary">{formatMoney(row.price_cents, row.currency)}</Typography></TableCell>
                  <TableCell>
                    {basePriceCents > 0 && (
                      <Chip label={diff > 0 ? `-${diff}%` : diff < 0 ? `+${Math.abs(diff)}%` : '='}
                        size="small"
                        sx={{ bgcolor: diff > 0 ? '#E8F5E9' : diff < 0 ? '#FFEBEE' : '#F5F5F5',
                          color: diff > 0 ? '#4CAF50' : diff < 0 ? '#F44336' : '#9E9E9E', fontWeight: 700 }} />
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip label={row.is_active ? 'Actif' : 'Inactif'} size="small"
                      sx={{ bgcolor: row.is_active ? '#E8F5E9' : '#F5F5F5', color: row.is_active ? '#4CAF50' : '#9E9E9E' }} />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Button size="small" onClick={() => openEdit(row)} sx={{ textTransform: 'none', fontSize: '0.75rem' }}>Modifier</Button>
                      <Tooltip title="Supprimer">
                        <IconButton size="small" onClick={() => handleDelete(row)} sx={{ color: '#F44336' }}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{editing ? 'Modifier le prix' : 'Ajouter un prix par zone'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <FormControl fullWidth size="small" disabled={!!editing}>
            <InputLabel>Zone</InputLabel>
            <Select value={form.zone} label="Zone" onChange={e => setForm(f => ({ ...f, zone: e.target.value }))}>
              {(editing ? ZONES : availableZones).map(z => (
                <MenuItem key={z.id} value={z.id}>{z.flag} {z.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField size="small" label="Prix" type="number" value={form.price_cents}
              onChange={e => setForm(f => ({ ...f, price_cents: e.target.value }))}
              inputProps={{ min: 0, step: 0.01 }} sx={{ flex: 1 }} />
            <FormControl size="small" sx={{ minWidth: 90 }}>
              <InputLabel>Devise</InputLabel>
              <Select value={form.currency} label="Devise" onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                {CURRENCIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
          <TextField size="small" label="Note interne (optionnel)" value={form.notes} multiline rows={2}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          <FormControlLabel control={<Switch checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />} label="Actif" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} sx={{ textTransform: 'none' }}>Annuler</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.zone || !form.price_cents}
            sx={{ textTransform: 'none', bgcolor: tokens.colors.primary, '&:hover': { bgcolor: '#9e5519' } }}>
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ─── Tab Geo Restrictions ─────────────────────────────────────────────────────

function GeoRestrictionsTab({ contentId }) {
  const [config, setConfig] = useState(null);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ zone: '', reason: '', is_active: true });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getBookGeoRestrictions(contentId);
      setConfig(res.config);
      setZones(res.zones || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [contentId]);

  useEffect(() => { load(); }, [load]);

  const handleModeChange = async (_, newMode) => {
    if (!newMode) return;
    setSaving(true);
    try { await setBookGeoRestrictionConfig(contentId, newMode); await load(); } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const handleRemoveRestriction = async () => {
    if (!window.confirm('Supprimer toutes les restrictions géographiques ?')) return;
    try { await deleteBookGeoRestrictionConfig(contentId); await load(); } catch (e) { alert(e.message); }
  };

  const handleAddZone = async () => {
    if (!form.zone) return;
    setSaving(true);
    try {
      const zone = ZONES.find(z => z.id === form.zone);
      await upsertBookGeoZone(contentId, { zone: form.zone, zone_label: zone?.label || form.zone, is_active: form.is_active, reason: form.reason || null });
      setDialogOpen(false);
      await load();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const handleToggleZone = async (z) => {
    try { await upsertBookGeoZone(contentId, { zone: z.zone, zone_label: z.zone_label, is_active: !z.is_active, reason: z.reason }); await load(); }
    catch (e) { alert(e.message); }
  };

  const handleDeleteZone = async (z) => {
    if (!window.confirm(`Retirer "${z.zone_label}" de la liste ?`)) return;
    try { await deleteBookGeoZone(contentId, z.id); await load(); } catch (e) { alert(e.message); }
  };

  const usedZones = zones.map(z => z.zone);
  const availableZones = ZONES.filter(z => !usedZones.includes(z.id));

  if (loading) return <Box sx={{ py: 6, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;

  const isWhitelist = config?.mode === 'whitelist';
  const activeCount = zones.filter(z => z.is_active).length;

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Mode selection */}
      <Card sx={{ mb: 3, borderRadius: '12px', border: '1px solid #F0EDE8' }} elevation={0}>
        <CardContent>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Mode de restriction</Typography>
          <ToggleButtonGroup value={config?.mode || null} exclusive onChange={handleModeChange} size="small" disabled={saving}>
            <ToggleButton value="blacklist" sx={{ textTransform: 'none', fontWeight: 600, px: 3 }}>
              🚫 Blacklist — Bloqué dans les zones listées
            </ToggleButton>
            <ToggleButton value="whitelist" sx={{ textTransform: 'none', fontWeight: 600, px: 3 }}>
              ✅ Whitelist — Disponible uniquement dans les zones listées
            </ToggleButton>
          </ToggleButtonGroup>
          {config && (
            <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip label={isWhitelist ? 'Mode Whitelist actif' : 'Mode Blacklist actif'}
                size="small"
                sx={{ bgcolor: isWhitelist ? '#E3F2FD' : '#FFF3E0', color: isWhitelist ? '#1565C0' : '#E65100', fontWeight: 700 }} />
              <Button size="small" color="error" onClick={handleRemoveRestriction} sx={{ textTransform: 'none', fontSize: '0.75rem' }}>
                Supprimer les restrictions
              </Button>
            </Box>
          )}
          {!config && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Sélectionnez un mode pour activer les restrictions géographiques.
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Warning whitelist vide */}
      {isWhitelist && activeCount === 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Aucune zone active en whitelist — le contenu est <strong>inaccessible partout</strong>.
        </Alert>
      )}

      {/* Zones list */}
      {config && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Typography variant="subtitle2" fontWeight={700}>
              Zones {isWhitelist ? 'autorisées' : 'bloquées'}
            </Typography>
            <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => { setForm({ zone: '', reason: '', is_active: true }); setDialogOpen(true); }}
              disabled={availableZones.length === 0}
              sx={{ textTransform: 'none', borderRadius: '10px', borderColor: tokens.colors.primary, color: tokens.colors.primary }}>
              Ajouter une zone
            </Button>
          </Box>

          {zones.length === 0 ? (
            <Box sx={{ py: 4, textAlign: 'center', color: '#9E9E9E' }}>
              <LockIcon sx={{ fontSize: 40, mb: 1, opacity: 0.3 }} />
              <Typography variant="body2">Aucune zone dans la liste</Typography>
            </Box>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#FAFAFA' }}>
                  <TableCell sx={{ fontWeight: 600 }}>Zone</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Raison</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>État</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {zones.map(z => {
                  const zone = ZONES.find(zn => zn.id === z.zone);
                  return (
                    <TableRow key={z.id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <span>{zone?.flag || '🌐'}</span>
                          <Typography variant="body2" fontWeight={600}>{z.zone_label}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell><Typography variant="caption" color="text.secondary">{z.reason || '—'}</Typography></TableCell>
                      <TableCell>
                        <Chip
                          label={z.is_active ? (isWhitelist ? 'Autorisé' : 'Bloqué') : 'Suspendu'}
                          size="small"
                          sx={{
                            bgcolor: z.is_active ? (isWhitelist ? '#E8F5E9' : '#FFEBEE') : '#F5F5F5',
                            color: z.is_active ? (isWhitelist ? '#4CAF50' : '#F44336') : '#9E9E9E',
                            fontWeight: 700,
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Button size="small" onClick={() => handleToggleZone(z)} sx={{ textTransform: 'none', fontSize: '0.75rem' }}>
                            {z.is_active ? 'Suspendre' : 'Activer'}
                          </Button>
                          <Tooltip title="Retirer">
                            <IconButton size="small" onClick={() => handleDeleteZone(z)} sx={{ color: '#F44336' }}>
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Ajouter une zone</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <FormControl fullWidth size="small">
            <InputLabel>Zone</InputLabel>
            <Select value={form.zone} label="Zone" onChange={e => setForm(f => ({ ...f, zone: e.target.value }))}>
              {availableZones.map(z => <MenuItem key={z.id} value={z.id}>{z.flag} {z.label}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" label="Raison (optionnel)" placeholder="ex: Droits non acquis pour cette région"
            value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
          <FormControlLabel control={<Switch checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />} label="Actif immédiatement" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} sx={{ textTransform: 'none' }}>Annuler</Button>
          <Button variant="contained" onClick={handleAddZone} disabled={saving || !form.zone}
            sx={{ textTransform: 'none', bgcolor: tokens.colors.primary, '&:hover': { bgcolor: '#9e5519' } }}>
            {saving ? 'Enregistrement...' : 'Ajouter'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function PublisherBookDetailPage() {
  const { contentId } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await getBooks();
        const found = (res.books || []).find(pb => pb.contents?.id === contentId);
        if (!found) throw new Error('Livre introuvable.');
        setBook(found);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    }
    load();
  }, [contentId]);

  if (loading) return <Box sx={{ p: 4, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;
  if (error) return <Box sx={{ p: 4 }}><Alert severity="error">{error}</Alert></Box>;

  const content = book?.contents || {};

  return (
    <Box sx={{ p: 4, maxWidth: 900 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton onClick={() => navigate('/publisher/books')} sx={{ color: tokens.colors.primary }}>
          <ArrowBackIcon />
        </IconButton>
        {content.cover_url && (
          <Box component="img" src={content.cover_url}
            sx={{ width: 52, height: 68, objectFit: 'cover', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }} />
        )}
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 800, fontFamily: 'Playfair Display, serif', color: tokens.colors.onBackground.light }}>
            {content.title || '—'}
          </Typography>
          <Typography variant="body2" color="text.secondary">{content.author}</Typography>
        </Box>
        {content.id && (
          <Button
            size="small"
            endIcon={<OpenInNewIcon />}
            onClick={() => window.open(`/catalogue/${content.id}`, '_blank')}
            sx={{
              borderRadius: '10px', textTransform: 'none', fontWeight: 600, fontSize: '0.8rem',
              color: tokens.colors.primary, border: `1px solid ${tokens.colors.primary}40`,
              '&:hover': { bgcolor: `${tokens.colors.primary}10` }, flexShrink: 0,
            }}
          >
            Voir sur la plateforme
          </Button>
        )}
      </Box>

      <Divider sx={{ mb: 3 }} />

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: '1px solid #F0EDE8' }}>
        <Tab label="Prix géographiques" icon={<PublicIcon />} iconPosition="start"
          sx={{ textTransform: 'none', fontWeight: 600, minHeight: 48 }} />
        <Tab label="Restrictions géo" icon={<LockIcon />} iconPosition="start"
          sx={{ textTransform: 'none', fontWeight: 600, minHeight: 48 }} />
      </Tabs>

      <Card sx={{ borderRadius: '16px', p: 2 }} elevation={1}>
        {tab === 0 && (
          <GeoPricingTab
            contentId={contentId}
            basePriceCents={content.price_cents}
            baseCurrency={content.price_currency || 'USD'}
          />
        )}
        {tab === 1 && <GeoRestrictionsTab contentId={contentId} />}
      </Card>
    </Box>
  );
}
