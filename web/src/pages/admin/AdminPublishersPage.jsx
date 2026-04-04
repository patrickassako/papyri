import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Card, Table, TableBody, TableCell,
  TableHead, TableRow, Chip, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Select,
  FormControl, InputLabel, Alert, CircularProgress, Tooltip,
  Avatar, InputAdornment, Snackbar,
} from '@mui/material';
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SearchIcon from '@mui/icons-material/Search';
import tokens from '../../config/tokens';
import {
  adminGetPublishers,
  adminInvitePublisher,
  adminDeletePublisher,
} from '../../services/publisher.service';

const STATUS_CONFIG = {
  active:  { label: 'Actif',    color: '#4CAF50', bg: '#E8F5E9' },
  pending: { label: 'Attente',  color: '#9E9E9E', bg: '#F5F5F5' },
  paused:  { label: 'Pause',    color: '#FF9800', bg: '#FFF3E0' },
  banned:  { label: 'Banni',    color: '#F44336', bg: '#FFEBEE' },
};

const DEFAULT_GRID = { threshold_cad: 5, above_threshold_cad: 5, below_threshold_cad: 2.5 };

export default function AdminPublishersPage() {
  const navigate = useNavigate();
  const [publishers, setPublishers] = useState([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [deleting, setDeleting]   = useState(null);
  const [openInvite, setOpenInvite] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [form, setForm] = useState({
    companyName: '', contactName: '', email: '', description: '', website: '',
    useCustomGrid: false,
    threshold: 5, above: 5, below: 2.5,
  });

  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'error' });
  const showError = (msg) => setSnack({ open: true, msg, severity: 'error' });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (search.trim()) params.search = search.trim();
      const res = await adminGetPublishers(params);
      setPublishers(res.publishers || []);
      setTotal(res.total || 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [statusFilter]);

  async function handleInvite() {
    setInviteError(null);
    if (!form.companyName || !form.contactName || !form.email) {
      setInviteError('Nom, responsable et email sont obligatoires.');
      return;
    }
    setInviting(true);
    try {
      const revenueGrid = form.useCustomGrid
        ? { threshold_cad: +form.threshold, above_threshold_cad: +form.above, below_threshold_cad: +form.below }
        : DEFAULT_GRID;
      await adminInvitePublisher({
        companyName: form.companyName,
        contactName: form.contactName,
        email: form.email,
        description: form.description,
        revenueGrid,
      });
      setInviteSuccess(true);
      await load();
    } catch (e) {
      setInviteError(e.message);
    } finally {
      setInviting(false);
    }
  }

  async function handleDelete(pub, e) {
    e.stopPropagation();
    if (!window.confirm(`Supprimer définitivement l'éditeur "${pub.company_name}" ?\n\nCette action supprime aussi ses livres, codes promo et données associées.`)) return;
    setDeleting(pub.id);
    try {
      await adminDeletePublisher(pub.id);
      setPublishers(prev => prev.filter(p => p.id !== pub.id));
      setTotal(prev => prev - 1);
    } catch (err) {
      showError(err.message);
    } finally {
      setDeleting(null);
    }
  }

  function resetDialog() {
    setOpenInvite(false);
    setInviteError(null);
    setInviteSuccess(false);
    setForm({ companyName: '', contactName: '', email: '', description: '', website: '', useCustomGrid: false, threshold: 5, above: 5, below: 2.5 });
  }

  return (
    <Box sx={{ p: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#1A1A2E', fontFamily: 'Playfair Display, serif' }}>
            Éditeurs
          </Typography>
          <Typography variant="body2" sx={{ color: '#9E9E9E', mt: 0.5 }}>
            {total} éditeur{total !== 1 ? 's' : ''} enregistré{total !== 1 ? 's' : ''}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<PersonAddOutlinedIcon />}
          onClick={() => setOpenInvite(true)}
          sx={{ bgcolor: tokens.colors.primary, borderRadius: '12px', textTransform: 'none', fontWeight: 700, px: 3 }}
        >
          Créer un éditeur
        </Button>
      </Box>

      {/* Filtres */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField
          placeholder="Rechercher par nom ou email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load()}
          size="small"
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: '#9E9E9E', fontSize: 18 }} /></InputAdornment> }}
          sx={{ width: 320, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
        />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Statut</InputLabel>
          <Select value={statusFilter} label="Statut" onChange={e => setStatusFilter(e.target.value)} sx={{ borderRadius: '12px' }}>
            <MenuItem value="">Tous</MenuItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <MenuItem key={k} value={k}>{v.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        {loading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}><CircularProgress /></Box>
        ) : publishers.length === 0 ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <Typography variant="body1" sx={{ color: '#9E9E9E' }}>Aucun éditeur trouvé</Typography>
          </Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#FAFAFA' }}>
                <TableCell sx={{ fontWeight: 600, color: '#757575', pl: 3 }}>Éditeur</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, color: '#757575' }}>Livres</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, color: '#757575' }}>Revenu total</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, color: '#757575' }}>À verser</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#757575' }}>Statut</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#757575' }}>Depuis</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {publishers.map((pub) => {
                const cfg = STATUS_CONFIG[pub.status] || STATUS_CONFIG.pending;
                return (
                  <TableRow
                    key={pub.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/admin/publishers/${pub.id}`)}
                  >
                    <TableCell sx={{ pl: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{ bgcolor: tokens.colors.primary, width: 38, height: 38, fontSize: '0.95rem', fontWeight: 700 }}>
                          {pub.company_name?.charAt(0).toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: '#1A1A2E' }}>{pub.company_name}</Typography>
                          <Typography variant="caption" sx={{ color: '#9E9E9E' }}>{pub.email}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{pub.books_count ?? 0}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 600, color: tokens.colors.primary }}>
                        {Number(pub.total_revenue_cad ?? 0).toFixed(2)} CAD
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 700, color: pub.pending_payout_cad > 0 ? '#FF9800' : '#9E9E9E' }}>
                        {Number(pub.pending_payout_cad ?? 0).toFixed(2)} CAD
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={cfg.label}
                        size="small"
                        sx={{ bgcolor: cfg.bg, color: cfg.color, fontWeight: 700, border: `1px solid ${cfg.color}33` }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ color: '#9E9E9E' }}>
                        {pub.activated_at
                          ? new Date(pub.activated_at).toLocaleDateString('fr-FR')
                          : 'Invitation envoyée'}
                      </Typography>
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Tooltip title="Voir détail">
                        <IconButton size="small" onClick={() => navigate(`/admin/publishers/${pub.id}`)} sx={{ color: tokens.colors.primary }}>
                          <OpenInNewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Supprimer l'éditeur">
                        <IconButton size="small" onClick={(e) => handleDelete(pub, e)} disabled={deleting === pub.id} sx={{ color: '#F44336', ml: 0.5 }}>
                          {deleting === pub.id ? <CircularProgress size={16} /> : <DeleteOutlineIcon fontSize="small" />}
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

      {/* Dialog créer éditeur */}
      <Dialog open={openInvite} onClose={resetDialog} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
          {inviteSuccess ? '✅ Éditeur créé' : 'Créer un éditeur'}
        </DialogTitle>
        <DialogContent>
          {inviteSuccess ? (
            <Alert severity="success" sx={{ mt: 1 }}>
              L'éditeur a été créé. Un email avec le lien d'activation a été envoyé à <strong>{form.email}</strong>.
            </Alert>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
              {inviteError && <Alert severity="error">{inviteError}</Alert>}

              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  required
                  label="Maison d'édition"
                  value={form.companyName}
                  onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
                  fullWidth
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                />
                <TextField
                  required
                  label="Responsable"
                  value={form.contactName}
                  onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))}
                  fullWidth
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                />
              </Box>
              <TextField
                required
                label="Email"
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                fullWidth
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
              />
              <TextField
                label="Site web (optionnel)"
                value={form.website}
                onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                placeholder="https://example.com"
                fullWidth
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
              />
              <TextField
                label="Description (optionnel)"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                fullWidth
                multiline
                rows={2}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
              />

              {/* Grille de revenus */}
              <Box sx={{ border: '1px solid #E0E0E0', borderRadius: '12px', p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: form.useCustomGrid ? 2 : 0 }}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>Grille de revenus</Typography>
                    {!form.useCustomGrid && (
                      <Typography variant="caption" sx={{ color: '#9E9E9E' }}>
                        Standard : &gt;5 CAD → 5.00 CAD | ≤5 CAD → 2.50 CAD
                      </Typography>
                    )}
                  </Box>
                  <Button
                    size="small"
                    onClick={() => setForm(f => ({ ...f, useCustomGrid: !f.useCustomGrid }))}
                    sx={{ textTransform: 'none', color: tokens.colors.primary, fontWeight: 600 }}
                  >
                    {form.useCustomGrid ? 'Standard' : 'Personnaliser'}
                  </Button>
                </Box>
                {form.useCustomGrid && (
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <TextField label="Seuil (CAD)" value={form.threshold} onChange={e => setForm(f => ({ ...f, threshold: e.target.value }))} type="number" size="small" fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
                    <TextField label="Au-dessus" value={form.above} onChange={e => setForm(f => ({ ...f, above: e.target.value }))} type="number" size="small" fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
                    <TextField label="En-dessous" value={form.below} onChange={e => setForm(f => ({ ...f, below: e.target.value }))} type="number" size="small" fullWidth sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
                  </Box>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button onClick={resetDialog} sx={{ textTransform: 'none', color: '#757575' }}>
            {inviteSuccess ? 'Fermer' : 'Annuler'}
          </Button>
          {!inviteSuccess && (
            <Button
              variant="contained"
              onClick={handleInvite}
              disabled={inviting}
              startIcon={inviting ? <CircularProgress size={16} color="inherit" /> : null}
              sx={{ bgcolor: tokens.colors.primary, borderRadius: '12px', textTransform: 'none', fontWeight: 700 }}
            >
              Créer et envoyer l'invitation
            </Button>
          )}
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
