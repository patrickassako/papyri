/**
 * AdminGeoPricingPage — /admin/geo-pricing
 * Tarification géographique par contenu (zones / pays)
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Card, Typography, Button, IconButton, Chip, TextField,
  Table, TableHead, TableBody, TableRow, TableCell,
  Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Alert, Skeleton, Tooltip, Collapse,
  Select, MenuItem, FormControl, InputLabel, InputAdornment,
  Autocomplete,
} from '@mui/material';
import PublicOutlinedIcon     from '@mui/icons-material/PublicOutlined';
import AddIcon                from '@mui/icons-material/Add';
import EditOutlinedIcon       from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon      from '@mui/icons-material/DeleteOutline';
import ExpandMoreIcon         from '@mui/icons-material/ExpandMore';
import ExpandLessIcon         from '@mui/icons-material/ExpandLess';
import SearchIcon             from '@mui/icons-material/Search';
import MenuBookOutlinedIcon   from '@mui/icons-material/MenuBookOutlined';
import { authFetch } from '../../services/auth.service';
import tokens from '../../config/tokens';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const C = {
  indigo: tokens.colors.accent, primary: tokens.colors.primary, green: '#27ae60',
  red: '#e74c3c', grey: '#8c8c8c', orange: '#FF9800',
  bg: '#F7F6F3', textPrimary: '#1a1a2e', textSecondary: '#6b7280',
};

const ZONES = [
  { value: 'africa',        label: 'Afrique' },
  { value: 'europe',        label: 'Europe' },
  { value: 'north_america', label: 'Amérique du Nord' },
  { value: 'south_america', label: 'Amérique du Sud' },
  { value: 'asia',          label: 'Asie' },
  { value: 'middle_east',   label: 'Moyen-Orient' },
  { value: 'oceania',       label: 'Océanie' },
];

const CURRENCIES = ['EUR', 'USD', 'XAF', 'XOF', 'GBP', 'CAD', 'MAD', 'TND'];

function fmtPrice(cents, currency) {
  if (cents == null) return '—';
  return `${(cents / 100).toFixed(2)} ${currency || 'EUR'}`;
}

function savingBadge(entryPriceCents, basePriceCents, currency) {
  if (basePriceCents == null || basePriceCents === 0) return null;
  const diff = basePriceCents - entryPriceCents;
  const pct  = Math.round((diff / basePriceCents) * 100);
  if (pct === 0) return null;
  return { pct, positive: diff > 0 };
}

// ── Zone Entry Dialog ─────────────────────────────────────────
const EMPTY_ZONE = { zone: '', zone_label: '', price_cents: '', currency: 'EUR', notes: '', is_active: true };

function ZoneDialog({ open, entry, contentId, usedZones, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_ZONE);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);
  const isEdit = !!entry?.id;

  useEffect(() => {
    if (entry) {
      setForm({
        zone:        entry.zone || '',
        zone_label:  entry.zone_label || '',
        price_cents: entry.price_cents ?? '',
        currency:    entry.currency || 'EUR',
        notes:       entry.notes || '',
        is_active:   entry.is_active !== false,
      });
    } else {
      setForm(EMPTY_ZONE);
    }
    setError(null);
  }, [entry, open]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function handleZoneChange(zoneValue) {
    const found = ZONES.find(z => z.value === zoneValue);
    set('zone', zoneValue);
    if (found) set('zone_label', found.label);
  }

  async function handleSave() {
    if (!form.zone) { setError('Sélectionnez une zone.'); return; }
    if (form.price_cents === '' || isNaN(Number(form.price_cents))) { setError('Prix invalide.'); return; }
    setSaving(true); setError(null);
    try {
      const url    = isEdit
        ? `${API}/api/admin/geo-pricing/entry/${entry.id}`
        : `${API}/api/admin/geo-pricing/${contentId}`;
      const method = isEdit ? 'PUT' : 'POST';
      const body   = {
        zone:        form.zone,
        zone_label:  form.zone_label || ZONES.find(z => z.value === form.zone)?.label || form.zone,
        price_cents: Math.round(Number(form.price_cents) * 100),
        currency:    form.currency,
        notes:       form.notes || null,
        is_active:   form.is_active,
      };
      const res  = await authFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      onSaved(data);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  const availableZones = ZONES.filter(z => !usedZones.includes(z.value) || z.value === form.zone);
  const inputSx = { '& .MuiOutlinedInput-root': { borderRadius: '10px' } };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '20px' } }}>
      <DialogTitle sx={{ fontWeight: 700, color: C.textPrimary, pb: 1 }}>
        {isEdit ? 'Modifier le prix' : 'Ajouter une zone'}
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        {error && <Alert severity="error" sx={{ borderRadius: '10px' }}>{error}</Alert>}

        <FormControl size="small" fullWidth sx={inputSx} disabled={isEdit}>
          <InputLabel>Zone / Continent *</InputLabel>
          <Select
            value={form.zone}
            label="Zone / Continent *"
            onChange={e => handleZoneChange(e.target.value)}
          >
            {availableZones.map(z => (
              <MenuItem key={z.value} value={z.value}>{z.label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            label="Prix *"
            size="small"
            type="number"
            sx={{ flex: 1, ...inputSx }}
            value={form.price_cents}
            onChange={e => set('price_cents', e.target.value)}
            helperText="En unités (ex: 3.99)"
            inputProps={{ step: '0.01', min: '0' }}
          />
          <FormControl size="small" sx={{ width: 110, ...inputSx }}>
            <InputLabel>Devise</InputLabel>
            <Select value={form.currency} label="Devise" onChange={e => set('currency', e.target.value)}>
              {CURRENCIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              onClick={() => set('is_active', !form.is_active)}
              sx={{ cursor: 'pointer', px: 1.5, py: 0.75, borderRadius: '8px', bgcolor: form.is_active ? `${C.green}18` : '#f0ede8', border: `1px solid ${form.is_active ? C.green : '#ddd'}`, color: form.is_active ? C.green : C.grey, fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}
            >
              {form.is_active ? 'Actif' : 'Inactif'}
            </Box>
          </Box>
        </Box>

        <TextField label="Notes (optionnel)" size="small" fullWidth sx={inputSx}
          value={form.notes} onChange={e => set('notes', e.target.value)}
          placeholder="Ex: Prix solidaire Afrique francophone" />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none', color: C.grey }}>Annuler</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '10px', bgcolor: C.indigo, '&:hover': { bgcolor: '#1a2d47' } }}>
          {saving ? 'Enregistrement…' : isEdit ? 'Mettre à jour' : 'Ajouter'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Add Content Dialog ────────────────────────────────────────
function AddContentDialog({ open, onClose, onSelected }) {
  const [search, setSearch]     = useState('');
  const [contents, setContents] = useState([]);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    authFetch(`${API}/api/admin/geo-pricing/contents?search=${encodeURIComponent(search)}`)
      .then(r => r.json())
      .then(d => setContents(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, search]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '20px' } }}>
      <DialogTitle sx={{ fontWeight: 700, color: C.textPrimary }}>Choisir un contenu</DialogTitle>
      <DialogContent>
        <TextField
          size="small" fullWidth placeholder="Rechercher un livre…"
          value={search} onChange={e => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: C.grey, fontSize: 18 }} /></InputAdornment> }}
          sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
        />
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} sx={{ color: C.primary }} /></Box>
        ) : contents.length === 0 ? (
          <Typography variant="body2" color={C.textSecondary} textAlign="center" py={3}>Aucun contenu trouvé</Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {contents.map(c => (
              <Box key={c.id} onClick={() => { onSelected(c); onClose(); }}
                sx={{ p: 1.5, borderRadius: '10px', cursor: 'pointer', '&:hover': { bgcolor: '#f0ede8' }, display: 'flex', gap: 1.5, alignItems: 'center' }}>
                <MenuBookOutlinedIcon sx={{ color: C.primary, fontSize: 20 }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" fontWeight={700} color={C.textPrimary}>{c.title}</Typography>
                  <Typography variant="caption" color={C.textSecondary}>
                    {c.content_type} · {fmtPrice(c.price_cents, c.price_currency)}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none', color: C.grey }}>Annuler</Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Content Row (expandable) ──────────────────────────────────
function ContentRow({ item, onZoneSaved, onZoneDeleted }) {
  const [expanded, setExpanded]   = useState(false);
  const [zoneDialog, setZoneDialog] = useState(false);
  const [editing, setEditing]       = useState(null);

  const content    = item.content || {};
  const zones      = item.zones  || [];
  const usedZones  = zones.map(z => z.zone);

  function handleSaved(data) {
    onZoneSaved(content.id, data);
    setZoneDialog(false);
    setEditing(null);
  }

  async function handleDelete(zoneId) {
    if (!window.confirm('Supprimer ce prix géographique ?')) return;
    try {
      await authFetch(`${API}/api/admin/geo-pricing/entry/${zoneId}`, { method: 'DELETE' });
      onZoneDeleted(content.id, zoneId);
    } catch {}
  }

  return (
    <>
      <TableRow
        onClick={() => setExpanded(e => !e)}
        sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#faf9f7' }, '& td': { borderBottom: expanded ? 'none' : undefined } }}
      >
        <TableCell sx={{ py: 1.5, pl: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <MenuBookOutlinedIcon sx={{ color: C.primary, fontSize: 18 }} />
            <Box>
              <Typography variant="body2" fontWeight={700} color={C.textPrimary}>{content.title || '—'}</Typography>
              <Typography variant="caption" color={C.textSecondary}>{content.content_type || ''}</Typography>
            </Box>
          </Box>
        </TableCell>
        <TableCell sx={{ py: 1.5 }}>
          <Typography variant="body2" color={C.textSecondary}>
            {fmtPrice(content.price_cents, content.price_currency)}
          </Typography>
        </TableCell>
        <TableCell sx={{ py: 1.5 }}>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {zones.slice(0, 4).map(z => (
              <Chip key={z.id} label={z.zone_label} size="small"
                sx={{ bgcolor: z.is_active ? `${C.indigo}12` : '#f0ede8', color: z.is_active ? C.indigo : C.grey, fontSize: '0.68rem', height: 20, fontWeight: 600 }} />
            ))}
            {zones.length > 4 && (
              <Chip label={`+${zones.length - 4}`} size="small"
                sx={{ bgcolor: '#f0ede8', color: C.grey, fontSize: '0.68rem', height: 20 }} />
            )}
          </Box>
        </TableCell>
        <TableCell sx={{ py: 1.5, pr: 2, textAlign: 'right' }}>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
            <Tooltip title="Ajouter une zone">
              <IconButton size="small" onClick={e => { e.stopPropagation(); setEditing(null); setZoneDialog(true); }}
                sx={{ color: C.indigo, '&:hover': { bgcolor: `${C.indigo}10` } }}>
                <AddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {expanded ? <ExpandLessIcon sx={{ fontSize: 18, color: C.grey }} /> : <ExpandMoreIcon sx={{ fontSize: 18, color: C.grey }} />}
          </Box>
        </TableCell>
      </TableRow>

      {/* Expanded zones detail */}
      <TableRow>
        <TableCell colSpan={4} sx={{ p: 0, border: 0 }}>
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Box sx={{ bgcolor: '#faf9f7', borderBottom: '1px solid #e5e0d8' }}>
              {zones.length === 0 ? (
                <Typography variant="caption" color={C.textSecondary} sx={{ px: 3, py: 1.5, display: 'block' }}>
                  Aucune zone configurée — le prix de base s'applique partout.
                </Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {['Zone', 'Prix', 'Économie', 'Statut', 'Notes', ''].map((h, i) => (
                        <TableCell key={h} sx={{ fontSize: '0.68rem', fontWeight: 700, color: C.textSecondary, py: 1, pl: i === 0 ? 5 : undefined }}>
                          {h}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {zones.map(z => {
                      const badge = savingBadge(z.price_cents, content.price_cents, z.currency);
                      return (
                        <TableRow key={z.id} sx={{ '&:last-child td': { border: 0 }, opacity: z.is_active ? 1 : 0.5 }}>
                          <TableCell sx={{ py: 1, pl: 5 }}>
                            <Typography variant="body2" fontWeight={600} color={C.textPrimary}>{z.zone_label}</Typography>
                          </TableCell>
                          <TableCell sx={{ py: 1 }}>
                            <Typography variant="body2" fontWeight={700} color={C.primary}>{fmtPrice(z.price_cents, z.currency)}</Typography>
                          </TableCell>
                          <TableCell sx={{ py: 1 }}>
                            {badge ? (
                              <Chip
                                label={`${badge.positive ? '-' : '+'}${Math.abs(badge.pct)}%`}
                                size="small"
                                sx={{ bgcolor: badge.positive ? `${C.green}18` : `${C.red}18`, color: badge.positive ? C.green : C.red, fontWeight: 700, fontSize: '0.68rem', height: 20 }}
                              />
                            ) : <Typography variant="caption" color={C.grey}>—</Typography>}
                          </TableCell>
                          <TableCell sx={{ py: 1 }}>
                            <Chip
                              label={z.is_active ? 'Actif' : 'Inactif'}
                              size="small"
                              sx={{ bgcolor: z.is_active ? `${C.green}18` : '#f0ede8', color: z.is_active ? C.green : C.grey, fontWeight: 700, fontSize: '0.68rem', height: 20 }}
                            />
                          </TableCell>
                          <TableCell sx={{ py: 1, maxWidth: 180 }}>
                            <Typography variant="caption" color={C.textSecondary} noWrap>{z.notes || '—'}</Typography>
                          </TableCell>
                          <TableCell sx={{ py: 1, pr: 2, textAlign: 'right' }}>
                            <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                              <Tooltip title="Modifier">
                                <IconButton size="small" onClick={() => { setEditing(z); setZoneDialog(true); }}
                                  sx={{ color: C.indigo, '&:hover': { bgcolor: `${C.indigo}10` } }}>
                                  <EditOutlinedIcon sx={{ fontSize: 15 }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Supprimer">
                                <IconButton size="small" onClick={() => handleDelete(z.id)}
                                  sx={{ color: C.red, '&:hover': { bgcolor: `${C.red}10` } }}>
                                  <DeleteOutlineIcon sx={{ fontSize: 15 }} />
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
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>

      <ZoneDialog
        open={zoneDialog}
        entry={editing}
        contentId={content.id}
        usedZones={usedZones}
        onClose={() => { setZoneDialog(false); setEditing(null); }}
        onSaved={handleSaved}
      />
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function AdminGeoPricingPage() {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [addDialog, setAddDialog] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    authFetch(`${API}/api/admin/geo-pricing`)
      .then(r => r.json())
      .then(d => setItems(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleContentSelected(content) {
    // Add content to list with empty zones if not already there
    setItems(prev => {
      if (prev.find(i => i.content?.id === content.id)) return prev;
      return [{ content, zones: [] }, ...prev];
    });
  }

  function handleZoneSaved(contentId, zoneData) {
    setItems(prev => prev.map(item => {
      if (item.content?.id !== contentId) return item;
      const exists = item.zones.find(z => z.id === zoneData.id);
      return {
        ...item,
        zones: exists
          ? item.zones.map(z => z.id === zoneData.id ? zoneData : z)
          : [...item.zones, zoneData],
      };
    }));
  }

  function handleZoneDeleted(contentId, zoneId) {
    setItems(prev => prev.map(item => {
      if (item.content?.id !== contentId) return item;
      return { ...item, zones: item.zones.filter(z => z.id !== zoneId) };
    }));
  }

  const filtered = items.filter(i =>
    !search || (i.content?.title || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalZones = items.reduce((s, i) => s + i.zones.length, 0);

  return (
    <Box sx={{ bgcolor: C.bg, minHeight: '100vh' }}>

      {/* Header */}
      <Box sx={{ bgcolor: '#fff', height: 60, display: 'flex', alignItems: 'center', px: 3, borderBottom: '1px solid #e5e0d8', position: 'sticky', top: 0, zIndex: 10, gap: 1 }}>
        <PublicOutlinedIcon sx={{ color: C.indigo, mr: 1 }} />
        <Typography variant="h6" fontWeight={700} color={C.textPrimary} sx={{ flex: 1 }}>
          Tarification géographique
        </Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />}
          onClick={() => setAddDialog(true)}
          sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700, bgcolor: C.indigo, boxShadow: 'none', '&:hover': { bgcolor: '#1a2d47' } }}>
          Ajouter un contenu
        </Button>
      </Box>

      <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1000, mx: 'auto' }}>

        {/* Stats */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          {[
            { label: 'Contenus configurés', value: items.length, color: C.indigo },
            { label: 'Zones définies', value: totalZones, color: C.primary },
          ].map(s => (
            <Card key={s.label} sx={{ borderRadius: '14px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', px: 2.5, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography variant="h5" fontWeight={900} color={s.color}>{s.value}</Typography>
              <Typography variant="body2" color={C.textSecondary} fontWeight={600}>{s.label}</Typography>
            </Card>
          ))}
        </Box>

        {/* Info banner */}
        <Box sx={{ bgcolor: `${C.indigo}08`, border: `1px solid ${C.indigo}20`, borderRadius: '12px', p: 2, mb: 2.5, display: 'flex', gap: 1.5 }}>
          <PublicOutlinedIcon sx={{ color: C.indigo, fontSize: 20, mt: 0.25 }} />
          <Typography variant="body2" color={C.textSecondary}>
            Les prix géographiques permettent de définir des tarifs différenciés par continent pour les contenus à l'achat.
            Si aucune zone n'est définie pour un contenu, le prix de base s'applique partout.
          </Typography>
        </Box>

        {/* Search */}
        <TextField size="small" placeholder="Rechercher un contenu…" value={search}
          onChange={e => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: C.grey, fontSize: 18 }} /></InputAdornment> }}
          sx={{ mb: 2, width: 320, '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: '#fff' } }}
        />

        {/* Table */}
        <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#faf9f7' }}>
                {['Contenu', 'Prix de base', 'Zones configurées', ''].map((h, i) => (
                  <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.72rem', color: C.textSecondary, py: 1.5, pl: i === 0 ? 3 : undefined, pr: i === 3 ? 2 : undefined }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                [1, 2, 3].map(i => (
                  <TableRow key={i}>
                    {[1, 2, 3, 4].map(j => <TableCell key={j} sx={{ py: 1.5 }}><Skeleton height={20} /></TableCell>)}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} sx={{ textAlign: 'center', py: 8, color: C.textSecondary }}>
                    <PublicOutlinedIcon sx={{ fontSize: 40, mb: 1, opacity: 0.2, display: 'block', mx: 'auto' }} />
                    {search ? 'Aucun résultat' : 'Aucun contenu avec tarification géographique'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((item, idx) => (
                  <ContentRow
                    key={item.content?.id || idx}
                    item={item}
                    onZoneSaved={handleZoneSaved}
                    onZoneDeleted={handleZoneDeleted}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </Box>

      <AddContentDialog
        open={addDialog}
        onClose={() => setAddDialog(false)}
        onSelected={handleContentSelected}
      />
    </Box>
  );
}
