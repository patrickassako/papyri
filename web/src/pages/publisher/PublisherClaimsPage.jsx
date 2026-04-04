import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Button, Card, CardContent, Chip, TextField,
  MenuItem, Select, FormControl, InputLabel, Dialog, DialogTitle,
  DialogContent, DialogActions, Alert, CircularProgress, Divider,
  Table, TableHead, TableRow, TableCell, TableBody,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import tokens from '../../config/tokens';
import { getClaims, createClaim } from '../../services/publisher.service';

const CATEGORIES = [
  { value: 'payout',    label: 'Versement / Paiement' },
  { value: 'content',   label: 'Contenu / Validation' },
  { value: 'technical', label: 'Problème technique' },
  { value: 'account',   label: 'Compte / Accès' },
  { value: 'other',     label: 'Autre' },
];

const STATUS_CFG = {
  open:        { label: 'Ouvert',   color: '#E65100', bg: '#FFF3E0' },
  in_progress: { label: 'En cours', color: '#1565C0', bg: '#E3F2FD' },
  resolved:    { label: 'Résolu',   color: '#2E7D32', bg: '#E8F5E9' },
  closed:      { label: 'Fermé',    color: '#757575', bg: '#F5F5F5' },
};

function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function PublisherClaimsPage() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState(null);

  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState({ category: 'other', subject: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const res = await getClaims(params);
      setClaims(res.claims || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [statusFilter]);

  async function handleSubmit() {
    setSubmitError(null);
    if (!form.subject.trim() || !form.message.trim()) {
      setSubmitError('Sujet et message requis.');
      return;
    }
    setSubmitting(true);
    try {
      await createClaim(form);
      setOpenForm(false);
      setForm({ category: 'other', subject: '', message: '' });
      await load();
    } catch (e) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box sx={{ p: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ bgcolor: '#EDD9C8', borderRadius: '14px', p: 1.5, display: 'flex' }}>
            <SupportAgentIcon sx={{ color: tokens.colors.primary, fontSize: 26 }} />
          </Box>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, fontFamily: 'Playfair Display, serif', color: tokens.colors.onBackground.light, lineHeight: 1.1 }}>
              Réclamations
            </Typography>
            <Typography variant="body2" sx={{ color: '#9E9E9E', mt: 0.3 }}>
              Contactez l'équipe Papyri pour toute question ou problème.
            </Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => { setOpenForm(true); setSubmitError(null); }}
          sx={{ bgcolor: tokens.colors.primary, borderRadius: '12px', textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: tokens.colors.primaryDark } }}
        >
          Nouvelle réclamation
        </Button>
      </Box>

      {/* Filtre */}
      <Box sx={{ mb: 3 }}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Statut</InputLabel>
          <Select value={statusFilter} label="Statut" onChange={e => setStatusFilter(e.target.value)} sx={{ borderRadius: '10px' }}>
            <MenuItem value="">Tous</MenuItem>
            {Object.entries(STATUS_CFG).map(([k, v]) => (
              <MenuItem key={k} value={k}>{v.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
          <CircularProgress sx={{ color: tokens.colors.primary }} />
        </Box>
      ) : claims.length === 0 ? (
        <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <CardContent sx={{ py: 8, textAlign: 'center' }}>
            <SupportAgentIcon sx={{ fontSize: 64, color: '#E0D4C8', mb: 2 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#9E9E9E' }}>Aucune réclamation</Typography>
            <Typography variant="body2" sx={{ color: '#BDBDBD', mt: 0.5 }}>
              Vous n'avez pas encore soumis de réclamation.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#FAFAFA' }}>
                <TableCell sx={{ fontWeight: 700, color: '#555' }}>Sujet</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#555' }}>Catégorie</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#555' }}>Statut</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#555' }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#555' }}>Réponse</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {claims.map(c => {
                const cfg = STATUS_CFG[c.status] || STATUS_CFG.open;
                const cat = CATEGORIES.find(x => x.value === c.category);
                return (
                  <TableRow key={c.id} hover sx={{ cursor: 'pointer' }} onClick={() => setSelected(c)}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: tokens.colors.onBackground.light }}>{c.subject}</Typography>
                      <Typography variant="caption" sx={{ color: '#9E9E9E' }}>
                        {c.message.substring(0, 60)}{c.message.length > 60 ? '…' : ''}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={cat?.label || c.category} size="small" sx={{ bgcolor: '#F5F0EB', color: tokens.colors.primaryDark, fontWeight: 600 }} />
                    </TableCell>
                    <TableCell>
                      <Chip label={cfg.label} size="small" sx={{ bgcolor: cfg.bg, color: cfg.color, fontWeight: 700 }} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ color: '#757575' }}>{fmt(c.created_at)}</Typography>
                    </TableCell>
                    <TableCell>
                      {c.admin_reply ? (
                        <Chip label="Réponse reçue" size="small" sx={{ bgcolor: '#E8F5E9', color: '#2E7D32', fontWeight: 600 }} />
                      ) : (
                        <Typography variant="caption" sx={{ color: '#BDBDBD' }}>En attente</Typography>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Dialog : Détail réclamation */}
      {selected && (
        <Dialog open onClose={() => setSelected(null)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 800, fontFamily: 'Playfair Display, serif', color: tokens.colors.onBackground.light }}>
            {selected.subject}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <Chip
                label={CATEGORIES.find(x => x.value === selected.category)?.label || selected.category}
                size="small"
                sx={{ bgcolor: '#F5F0EB', color: tokens.colors.primaryDark, fontWeight: 600 }}
              />
              <Chip
                label={STATUS_CFG[selected.status]?.label || selected.status}
                size="small"
                sx={{ bgcolor: STATUS_CFG[selected.status]?.bg, color: STATUS_CFG[selected.status]?.color, fontWeight: 700 }}
              />
            </Box>

            <Typography variant="caption" sx={{ color: '#9E9E9E' }}>Soumis le {fmt(selected.created_at)}</Typography>

            <Card sx={{ mt: 2, bgcolor: '#FAFAFA', borderRadius: '12px', border: '1px solid #F0EDE8' }} elevation={0}>
              <CardContent>
                <Typography variant="overline" sx={{ color: '#9E9E9E', fontWeight: 700, fontSize: '0.7rem' }}>Votre message</Typography>
                <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap', color: tokens.colors.onSurface.light }}>{selected.message}</Typography>
              </CardContent>
            </Card>

            {selected.admin_reply && (
              <>
                <Divider sx={{ my: 2 }} />
                <Card sx={{ bgcolor: '#E8F5E9', borderRadius: '12px', border: '1px solid #C8E6C9' }} elevation={0}>
                  <CardContent>
                    <Typography variant="overline" sx={{ color: '#2E7D32', fontWeight: 700, fontSize: '0.7rem' }}>Réponse de l'équipe Papyri</Typography>
                    <Typography variant="caption" sx={{ color: '#757575', display: 'block', mb: 0.5 }}>
                      {fmt(selected.replied_at)}
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: '#1B5E20' }}>{selected.admin_reply}</Typography>
                  </CardContent>
                </Card>
              </>
            )}

            {!selected.admin_reply && (
              <Alert severity="info" sx={{ mt: 2, borderRadius: '10px' }}>
                Nous avons bien reçu votre réclamation. Notre équipe vous répondra dans les plus brefs délais.
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSelected(null)} sx={{ textTransform: 'none', color: '#757575' }}>Fermer</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Dialog : Nouvelle réclamation */}
      <Dialog open={openForm} onClose={() => setOpenForm(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, fontFamily: 'Playfair Display, serif', color: tokens.colors.onBackground.light }}>
          Nouvelle réclamation
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: '16px !important' }}>
          {submitError && <Alert severity="error">{submitError}</Alert>}

          <FormControl fullWidth>
            <InputLabel>Catégorie</InputLabel>
            <Select
              value={form.category}
              label="Catégorie"
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              sx={{ borderRadius: '12px' }}
            >
              {CATEGORIES.map(c => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
            </Select>
          </FormControl>

          <TextField
            label="Sujet *"
            value={form.subject}
            onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
            fullWidth
            inputProps={{ maxLength: 120 }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
          />

          <TextField
            label="Message *"
            value={form.message}
            onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
            fullWidth
            multiline
            rows={5}
            placeholder="Décrivez votre problème ou question en détail..."
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setOpenForm(false)} sx={{ textTransform: 'none', color: '#757575' }}>Annuler</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={submitting || !form.subject.trim() || !form.message.trim()}
            startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ bgcolor: tokens.colors.primary, borderRadius: '12px', textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: tokens.colors.primaryDark } }}
          >
            {submitting ? 'Envoi...' : 'Envoyer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
