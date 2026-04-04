/**
 * AdminCategoriesPage — /admin/categories
 * CRUD complet des catégories de l'application
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Card, Typography, Button, IconButton, Chip, TextField,
  Table, TableHead, TableBody, TableRow, TableCell,
  Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Alert, Skeleton, Tooltip, InputAdornment,
} from '@mui/material';
import AddIcon              from '@mui/icons-material/Add';
import EditOutlinedIcon     from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon    from '@mui/icons-material/DeleteOutline';
import SearchIcon           from '@mui/icons-material/Search';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import { authFetch } from '../../services/auth.service';
import tokens from '../../config/tokens';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const C = {
  indigo: tokens.colors.accent, primary: tokens.colors.primary, green: '#27ae60',
  red: '#e74c3c', grey: '#8c8c8c', bg: '#F7F6F3',
  textPrimary: '#1a1a2e', textSecondary: '#6b7280',
};

function slugify(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const EMPTY = { name: '', slug: '', description: '', icon: '' };

// ── Category Dialog ────────────────────────────────────────────
function CategoryDialog({ open, category, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);
  const isEdit = !!category?.id;

  useEffect(() => {
    setForm(category ? { name: category.name || '', slug: category.slug || '', description: category.description || '', icon: category.icon || '' } : EMPTY);
    setError(null);
  }, [category, open]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function handleNameChange(v) {
    set('name', v);
    if (!isEdit) set('slug', slugify(v));
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Le nom est requis.'); return; }
    setSaving(true); setError(null);
    try {
      const url    = isEdit ? `${API}/api/admin/categories/${category.id}` : `${API}/api/admin/categories`;
      const method = isEdit ? 'PUT' : 'POST';
      const res  = await authFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      onSaved(data);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  const inputSx = { '& .MuiOutlinedInput-root': { borderRadius: '10px' } };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '20px' } }}>
      <DialogTitle sx={{ fontWeight: 700, color: C.textPrimary, pb: 1 }}>
        {isEdit ? `Modifier — ${category?.name}` : 'Nouvelle catégorie'}
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        {error && <Alert severity="error" sx={{ borderRadius: '10px' }}>{error}</Alert>}

        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField label="Emoji / Icône" size="small" value={form.icon}
            onChange={e => set('icon', e.target.value)}
            sx={{ width: 110, ...inputSx }}
            placeholder="📚" />
          <TextField label="Nom *" size="small" fullWidth sx={inputSx}
            value={form.name} onChange={e => handleNameChange(e.target.value)} />
        </Box>

        <TextField label="Slug (URL)" size="small" fullWidth sx={inputSx}
          value={form.slug}
          onChange={e => set('slug', e.target.value.toLowerCase().replace(/\s+/g, '-'))}
          helperText="Identifiant unique pour les URLs" />

        <TextField label="Description" size="small" fullWidth multiline rows={3} sx={inputSx}
          value={form.description} onChange={e => set('description', e.target.value)}
          placeholder="Description courte de la catégorie…" />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none', color: C.grey }}>Annuler</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '10px', bgcolor: C.indigo, '&:hover': { bgcolor: '#1a2d47' } }}>
          {saving ? 'Enregistrement…' : isEdit ? 'Mettre à jour' : 'Créer'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Delete Confirm Dialog ──────────────────────────────────────
function DeleteDialog({ open, category, onClose, onDeleted }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  async function handleDelete() {
    setLoading(true); setError(null);
    try {
      const res  = await authFetch(`${API}/api/admin/categories/${category.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      onDeleted(category.id);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '18px' } }}>
      <DialogTitle sx={{ fontWeight: 700, color: C.red }}>Supprimer la catégorie</DialogTitle>
      <DialogContent>
        {error
          ? <Alert severity="error" sx={{ borderRadius: '10px' }}>{error}</Alert>
          : <Typography variant="body2" color={C.textSecondary}>
              Voulez-vous supprimer <strong>«&nbsp;{category?.name}&nbsp;»</strong> ? Cette action est irréversible.
              {category?.book_count > 0 && (
                <Box component="span" sx={{ display: 'block', mt: 1, color: C.red }}>
                  ⚠️ {category.book_count} livre(s) utilisent cette catégorie.
                </Box>
              )}
            </Typography>
        }
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none', color: C.grey }}>Annuler</Button>
        {!error && (
          <Button variant="contained" onClick={handleDelete} disabled={loading}
            startIcon={loading ? <CircularProgress size={14} color="inherit" /> : null}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '10px', bgcolor: C.red, '&:hover': { bgcolor: '#c0392b' } }}>
            {loading ? 'Suppression…' : 'Supprimer'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [dialog, setDialog]         = useState(false);
  const [editing, setEditing]       = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    authFetch(`${API}/api/admin/categories`)
      .then(r => r.json())
      .then(d => setCategories(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = categories.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.slug.toLowerCase().includes(search.toLowerCase())
  );

  function handleSaved(cat) {
    setCategories(prev => {
      const idx = prev.findIndex(c => c.id === cat.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = { ...next[idx], ...cat }; return next; }
      return [cat, ...prev];
    });
    setDialog(false);
    setEditing(null);
  }

  function handleDeleted(id) {
    setCategories(prev => prev.filter(c => c.id !== id));
    setDeleteTarget(null);
  }

  const totalBooks = categories.reduce((s, c) => s + (c.book_count || 0), 0);

  return (
    <Box sx={{ bgcolor: C.bg, minHeight: '100vh' }}>

      {/* Header */}
      <Box sx={{ bgcolor: '#fff', height: 60, display: 'flex', alignItems: 'center', px: 3, borderBottom: '1px solid #e5e0d8', position: 'sticky', top: 0, zIndex: 10, gap: 1 }}>
        <CategoryOutlinedIcon sx={{ color: C.indigo, mr: 1 }} />
        <Typography variant="h6" fontWeight={700} color={C.textPrimary} sx={{ flex: 1 }}>
          Catégories
        </Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />}
          onClick={() => { setEditing(null); setDialog(true); }}
          sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700, bgcolor: C.indigo, boxShadow: 'none', '&:hover': { bgcolor: '#1a2d47' } }}>
          Nouvelle catégorie
        </Button>
      </Box>

      <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 900, mx: 'auto' }}>

        {/* Stats row */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          {[
            { label: 'Catégories', value: categories.length, color: C.indigo },
            { label: 'Livres associés', value: totalBooks, color: C.primary },
          ].map(s => (
            <Card key={s.label} sx={{ borderRadius: '14px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', px: 2.5, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography variant="h5" fontWeight={900} color={s.color}>{s.value}</Typography>
              <Typography variant="body2" color={C.textSecondary} fontWeight={600}>{s.label}</Typography>
            </Card>
          ))}
        </Box>

        {/* Toolbar */}
        <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
          <TextField size="small" placeholder="Rechercher une catégorie…" value={search}
            onChange={e => setSearch(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: C.grey, fontSize: 18 }} /></InputAdornment> }}
            sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: '#fff' } }} />
        </Box>

        {/* Table */}
        <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#faf9f7' }}>
                {['Catégorie', 'Slug', 'Description', 'Livres', ''].map((h, i) => (
                  <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.72rem', color: C.textSecondary, py: 1.5, pl: i === 0 ? 3 : undefined, pr: i === 4 ? 2 : undefined }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                [1,2,3,4].map(i => (
                  <TableRow key={i}>
                    {[1,2,3,4,5].map(j => <TableCell key={j} sx={{ py: 1.5 }}><Skeleton height={20} /></TableCell>)}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} sx={{ textAlign: 'center', py: 8, color: C.textSecondary }}>
                    <CategoryOutlinedIcon sx={{ fontSize: 40, mb: 1, opacity: 0.2, display: 'block', mx: 'auto' }} />
                    {search ? 'Aucun résultat' : 'Aucune catégorie créée'}
                  </TableCell>
                </TableRow>
              ) : filtered.map(cat => (
                <TableRow key={cat.id} sx={{ '&:hover': { bgcolor: '#faf9f7' }, '&:last-child td': { border: 0 } }}>
                  <TableCell sx={{ py: 1.5, pl: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      {cat.icon
                        ? <Typography sx={{ fontSize: '1.4rem', lineHeight: 1 }}>{cat.icon}</Typography>
                        : <Box sx={{ width: 32, height: 32, borderRadius: '8px', bgcolor: `${C.indigo}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <CategoryOutlinedIcon sx={{ fontSize: 16, color: C.indigo }} />
                          </Box>
                      }
                      <Typography variant="body2" fontWeight={700} color={C.textPrimary}>{cat.name}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ py: 1.5 }}>
                    <Chip label={cat.slug} size="small" sx={{ bgcolor: '#f0ede8', color: C.textSecondary, fontFamily: 'monospace', fontSize: '0.72rem', height: 22 }} />
                  </TableCell>
                  <TableCell sx={{ py: 1.5, maxWidth: 240 }}>
                    <Typography variant="body2" color={C.textSecondary} noWrap>{cat.description || '—'}</Typography>
                  </TableCell>
                  <TableCell sx={{ py: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <MenuBookOutlinedIcon sx={{ fontSize: 14, color: C.textSecondary }} />
                      <Typography variant="body2" fontWeight={700} color={cat.book_count > 0 ? C.indigo : C.grey}>
                        {cat.book_count}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ py: 1.5, pr: 2, textAlign: 'right' }}>
                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                      <Tooltip title="Modifier">
                        <IconButton size="small" onClick={() => { setEditing(cat); setDialog(true); }}
                          sx={{ color: C.indigo, '&:hover': { bgcolor: `${C.indigo}10` } }}>
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Supprimer">
                        <IconButton size="small" onClick={() => setDeleteTarget(cat)}
                          sx={{ color: C.red, '&:hover': { bgcolor: `${C.red}10` } }}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </Box>

      <CategoryDialog
        open={dialog}
        category={editing}
        onClose={() => { setDialog(false); setEditing(null); }}
        onSaved={handleSaved}
      />
      <DeleteDialog
        open={!!deleteTarget}
        category={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={handleDeleted}
      />
    </Box>
  );
}
