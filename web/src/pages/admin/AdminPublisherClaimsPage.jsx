import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Card, Chip, TextField, MenuItem, Select,
  FormControl, InputLabel, Dialog, DialogTitle, DialogContent,
  DialogActions, Alert, CircularProgress, Button, Table,
  TableHead, TableRow, TableCell, TableBody, Avatar, Divider, Snackbar,
} from '@mui/material';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import ReplyIcon from '@mui/icons-material/Reply';
import tokens from '../../config/tokens';
import { adminGetClaims, adminReplyClaim, adminUpdateClaimStatus } from '../../services/publisher.service';

const CATEGORIES = {
  payout:    'Versement / Paiement',
  content:   'Contenu / Validation',
  technical: 'Problème technique',
  account:   'Compte / Accès',
  other:     'Autre',
};

const STATUS_CFG = {
  open:        { label: 'Ouvert',   color: '#FF9800', bg: '#FFF3E0' },
  in_progress: { label: 'En cours', color: '#2196F3', bg: '#E3F2FD' },
  resolved:    { label: 'Résolu',   color: '#4CAF50', bg: '#E8F5E9' },
  closed:      { label: 'Fermé',    color: '#9E9E9E', bg: '#F5F5F5' },
};

function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AdminPublisherClaimsPage() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');

  const [selected, setSelected] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replyStatus, setReplyStatus] = useState('resolved');
  const [replying, setReplying] = useState(false);
  const [replyError, setReplyError] = useState(null);

  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'error' });
  const showError = (msg) => setSnack({ open: true, msg, severity: 'error' });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const res = await adminGetClaims(params);
      setClaims(res.claims || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [statusFilter]);

  function openClaim(c) {
    setSelected(c);
    setReplyText(c.admin_reply || '');
    setReplyStatus(c.status === 'open' || c.status === 'in_progress' ? 'resolved' : c.status);
    setReplyError(null);
  }

  async function handleReply() {
    if (!replyText.trim()) { setReplyError('La réponse est requise.'); return; }
    setReplying(true);
    setReplyError(null);
    try {
      const updated = await adminReplyClaim(selected.id, { reply: replyText, status: replyStatus });
      setSelected(updated.claim);
      setClaims(prev => prev.map(c => c.id === updated.claim.id ? updated.claim : c));
    } catch (e) {
      setReplyError(e.message);
    } finally {
      setReplying(false);
    }
  }

  async function handleStatusChange(claimId, status) {
    try {
      const res = await adminUpdateClaimStatus(claimId, status);
      setClaims(prev => prev.map(c => c.id === claimId ? { ...c, status: res.claim.status } : c));
      if (selected?.id === claimId) setSelected(s => ({ ...s, status: res.claim.status }));
    } catch (e) {
      showError(e.message);
    }
  }

  const openCount = claims.filter(c => c.status === 'open').length;

  return (
    <Box sx={{ p: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
        <Box sx={{ bgcolor: '#EDD9C8', borderRadius: '14px', p: 1.5, display: 'flex' }}>
          <SupportAgentIcon sx={{ color: tokens.colors.primary, fontSize: 26 }} />
        </Box>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: tokens.colors.onBackground.light, fontFamily: 'Playfair Display, serif', lineHeight: 1.1 }}>
            Réclamations éditeurs
          </Typography>
          <Typography variant="body2" sx={{ color: '#9E9E9E', mt: 0.3 }}>
            {openCount > 0 ? `${openCount} réclamation(s) ouverte(s) en attente` : 'Aucune réclamation ouverte'}
          </Typography>
        </Box>
      </Box>

      {/* Filtres */}
      <Box sx={{ mb: 3 }}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Statut</InputLabel>
          <Select
            value={statusFilter}
            label="Statut"
            onChange={e => setStatusFilter(e.target.value)}
            sx={{ borderRadius: '10px' }}
          >
            <MenuItem value="">Tous</MenuItem>
            {Object.entries(STATUS_CFG).map(([k, v]) => (
              <MenuItem key={k} value={k}>{v.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}><CircularProgress sx={{ color: tokens.colors.primary }} /></Box>
      ) : claims.length === 0 ? (
        <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <SupportAgentIcon sx={{ fontSize: 64, color: '#E0D4C8', mb: 2 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#9E9E9E' }}>
              Aucune réclamation
            </Typography>
          </Box>
        </Card>
      ) : (
        <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#FAFAFA' }}>
                {['Éditeur', 'Sujet', 'Catégorie', 'Statut', 'Date', 'Action'].map(h => (
                  <TableCell key={h} sx={{ fontWeight: 700, color: '#555' }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {claims.map(c => {
                const cfg = STATUS_CFG[c.status] || STATUS_CFG.open;
                return (
                  <TableRow
                    key={c.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => openClaim(c)}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{ width: 32, height: 32, bgcolor: tokens.colors.primary, fontSize: '0.8rem', fontWeight: 700 }}>
                          {(c.publishers?.company_name || 'E').charAt(0).toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: tokens.colors.onBackground.light, fontSize: '0.85rem' }}>
                            {c.publishers?.company_name || '—'}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#9E9E9E' }}>
                            {c.publishers?.contact_name}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: tokens.colors.onBackground.light, fontWeight: 600, fontSize: '0.875rem' }}>
                        {c.subject}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#9E9E9E' }}>
                        {c.message.substring(0, 50)}{c.message.length > 50 ? '…' : ''}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={CATEGORIES[c.category] || c.category}
                        size="small"
                        sx={{ bgcolor: '#F5F0EB', color: tokens.colors.primaryDark, fontWeight: 600, fontSize: '0.75rem' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip label={cfg.label} size="small" sx={{ bgcolor: cfg.bg, color: cfg.color, fontWeight: 700 }} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ color: '#757575' }}>{fmt(c.created_at)}</Typography>
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Select
                        value={c.status}
                        size="small"
                        onChange={e => handleStatusChange(c.id, e.target.value)}
                        sx={{ fontSize: '0.78rem', borderRadius: '8px', minWidth: 120 }}
                      >
                        {Object.entries(STATUS_CFG).map(([k, v]) => (
                          <MenuItem key={k} value={k}>{v.label}</MenuItem>
                        ))}
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Dialog : détail + réponse */}
      {selected && (
        <Dialog open onClose={() => setSelected(null)} maxWidth="md" fullWidth>
          <DialogTitle sx={{ fontWeight: 800, fontFamily: 'Playfair Display, serif', display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <SupportAgentIcon sx={{ color: tokens.colors.primary }} />
            {selected.subject}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <Chip label={CATEGORIES[selected.category] || selected.category} size="small" sx={{ bgcolor: '#F5F0EB', color: tokens.colors.primary, fontWeight: 600 }} />
              <Chip label={STATUS_CFG[selected.status]?.label} size="small" sx={{ bgcolor: STATUS_CFG[selected.status]?.bg, color: STATUS_CFG[selected.status]?.color, fontWeight: 700 }} />
            </Box>

            <Box sx={{ display: 'flex', gap: 3, mb: 2 }}>
              <Typography variant="caption" sx={{ color: '#9E9E9E' }}>
                <strong>Éditeur :</strong> {selected.publishers?.company_name} ({selected.publishers?.contact_name})
              </Typography>
              <Typography variant="caption" sx={{ color: '#9E9E9E' }}>
                <strong>Email :</strong> {selected.publishers?.email}
              </Typography>
              <Typography variant="caption" sx={{ color: '#9E9E9E' }}>
                <strong>Date :</strong> {fmt(selected.created_at)}
              </Typography>
            </Box>

            <Card sx={{ bgcolor: '#FAFAFA', borderRadius: '12px', mb: 3 }} elevation={0}>
              <Box sx={{ p: 2.5 }}>
                <Typography variant="overline" sx={{ color: '#9E9E9E', fontWeight: 700 }}>Message de l'éditeur</Typography>
                <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{selected.message}</Typography>
              </Box>
            </Card>

            {selected.admin_reply && (
              <>
                <Divider sx={{ mb: 2 }} />
                <Card sx={{ bgcolor: '#E8F5E9', borderRadius: '12px', mb: 3 }} elevation={0}>
                  <Box sx={{ p: 2.5 }}>
                    <Typography variant="overline" sx={{ color: '#4CAF50', fontWeight: 700 }}>Réponse envoyée ({fmt(selected.replied_at)})</Typography>
                    <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>{selected.admin_reply}</Typography>
                  </Box>
                </Card>
              </>
            )}

            <Divider sx={{ mb: 2 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
              {selected.admin_reply ? 'Modifier la réponse' : 'Répondre à l\'éditeur'}
            </Typography>

            {replyError && <Alert severity="error" sx={{ mb: 2 }}>{replyError}</Alert>}

            <TextField
              label="Votre réponse"
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              fullWidth
              multiline
              rows={4}
              sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
            />

            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Statut après réponse</InputLabel>
              <Select
                value={replyStatus}
                label="Statut après réponse"
                onChange={e => setReplyStatus(e.target.value)}
                sx={{ borderRadius: '10px' }}
              >
                {Object.entries(STATUS_CFG).map(([k, v]) => (
                  <MenuItem key={k} value={k}>{v.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={() => setSelected(null)} sx={{ textTransform: 'none', color: '#757575' }}>Fermer</Button>
            <Button
              variant="contained"
              startIcon={replying ? <CircularProgress size={16} color="inherit" /> : <ReplyIcon />}
              onClick={handleReply}
              disabled={replying || !replyText.trim()}
              sx={{ bgcolor: tokens.colors.primary, borderRadius: '12px', textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: '#9e5519' } }}
            >
              {replying ? 'Envoi...' : selected.admin_reply ? 'Mettre à jour' : 'Envoyer la réponse'}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.severity} onClose={() => setSnack(s => ({ ...s, open: false }))} sx={{ borderRadius: '10px' }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
