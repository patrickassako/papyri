import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Card, Table, TableBody, TableCell, TableHead,
  TableRow, Chip, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Alert, CircularProgress, Avatar, Snackbar,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import tokens from '../../config/tokens';
import {
  adminGetPendingContent,
  adminApproveContent,
  adminRejectContent,
} from '../../services/publisher.service';

export default function AdminContentValidationPage() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Dialog rejet
  const [rejectDialog, setRejectDialog] = useState(null); // { id }
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  // Dialog approbation
  const [approvingId, setApprovingId] = useState(null);

  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'error' });
  const showError = (msg) => setSnack({ open: true, msg, severity: 'error' });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await adminGetPendingContent();
      setItems(res.items || []);
      setTotal(res.total || 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleApprove(id) {
    setApprovingId(id);
    try {
      await adminApproveContent(id);
      setItems(prev => prev.filter(i => i.id !== id));
      setTotal(t => Math.max(0, t - 1));
    } catch (e) {
      showError(e.message);
    } finally {
      setApprovingId(null);
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) return;
    setRejecting(true);
    try {
      await adminRejectContent(rejectDialog.id, rejectReason);
      setItems(prev => prev.filter(i => i.id !== rejectDialog.id));
      setTotal(t => Math.max(0, t - 1));
      setRejectDialog(null);
      setRejectReason('');
    } catch (e) {
      showError(e.message);
    } finally {
      setRejecting(false);
    }
  }

  return (
    <Box sx={{ p: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, color: '#1A1A2E', fontFamily: 'Playfair Display, serif' }}>
          Validation de contenu
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
          <Typography variant="body2" sx={{ color: '#9E9E9E' }}>Contenus soumis par les éditeurs en attente de votre validation</Typography>
          {total > 0 && (
            <Chip
              label={`${total} en attente`}
              size="small"
              sx={{ bgcolor: '#FFF3E0', color: '#FF9800', fontWeight: 700, border: '1px solid #FF980033' }}
            />
          )}
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        {loading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}><CircularProgress /></Box>
        ) : items.length === 0 ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <CheckCircleOutlineIcon sx={{ fontSize: 64, color: '#4CAF50', mb: 2 }} />
            <Typography variant="body1" sx={{ color: '#4CAF50', fontWeight: 700 }}>File vide</Typography>
            <Typography variant="body2" sx={{ color: '#9E9E9E', mt: 0.5 }}>Aucun contenu en attente de validation</Typography>
          </Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#FAFAFA' }}>
                <TableCell sx={{ fontWeight: 600, color: '#757575', pl: 3 }}>Contenu</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#757575' }}>Éditeur</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#757575' }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#757575' }}>Soumis le</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, color: '#757575', pr: 3 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => {
                const content = item.contents;
                const publisher = item.publishers;
                const isApproving = approvingId === item.id;
                return (
                  <TableRow key={item.id} hover>
                    <TableCell sx={{ pl: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        {content?.cover_url ? (
                          <Box component="img" src={content.cover_url} sx={{ width: 44, height: 58, objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }} />
                        ) : (
                          <Box sx={{ width: 44, height: 58, bgcolor: '#F0EDE8', borderRadius: '6px', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                            <Typography variant="caption" sx={{ color: '#BDBDBD' }}>N/A</Typography>
                          </Box>
                        )}
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: '#1A1A2E' }}>
                            {content?.title || '—'}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#9E9E9E' }}>{content?.author}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ bgcolor: tokens.colors.primary, width: 28, height: 28, fontSize: '0.75rem', fontWeight: 700 }}>
                          {publisher?.company_name?.charAt(0).toUpperCase()}
                        </Avatar>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{publisher?.company_name}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={content?.content_type === 'audio' ? 'Audio' : content?.content_type === 'both' ? 'Ebook + Audio' : 'Ebook'}
                        size="small"
                        sx={{ bgcolor: '#F0EDE8', color: '#5D4037', fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: '#757575' }}>
                        {new Date(item.submitted_at).toLocaleDateString('fr-FR')}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ pr: 3 }}>
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={isApproving ? <CircularProgress size={14} /> : <CheckCircleOutlineIcon />}
                          onClick={() => handleApprove(item.id)}
                          disabled={isApproving}
                          sx={{
                            borderRadius: '8px',
                            textTransform: 'none',
                            fontWeight: 700,
                            color: '#4CAF50',
                            borderColor: '#4CAF50',
                            '&:hover': { bgcolor: '#E8F5E9', borderColor: '#4CAF50' },
                          }}
                        >
                          Approuver
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<CancelOutlinedIcon />}
                          onClick={() => { setRejectDialog({ id: item.id }); setRejectReason(''); }}
                          sx={{
                            borderRadius: '8px',
                            textTransform: 'none',
                            fontWeight: 700,
                            color: '#F44336',
                            borderColor: '#F44336',
                            '&:hover': { bgcolor: '#FFEBEE', borderColor: '#F44336' },
                          }}
                        >
                          Rejeter
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Dialog rejet */}
      <Dialog open={!!rejectDialog} onClose={() => setRejectDialog(null)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 700, color: '#F44336' }}>Rejeter ce contenu</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#757575', mb: 2 }}>
            L'éditeur recevra ce motif par email et pourra corriger et re-soumettre son contenu.
          </Typography>
          <TextField
            label="Motif de rejet *"
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            fullWidth
            multiline
            rows={4}
            placeholder="Ex: La description est insuffisante. Le fichier EPUB contient des erreurs de formatage..."
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button onClick={() => setRejectDialog(null)} sx={{ textTransform: 'none', color: '#757575' }}>Annuler</Button>
          <Button
            variant="contained"
            onClick={handleReject}
            disabled={rejecting || !rejectReason.trim()}
            startIcon={rejecting ? <CircularProgress size={16} color="inherit" /> : <CancelOutlinedIcon />}
            sx={{ bgcolor: '#F44336', borderRadius: '12px', textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: '#D32F2F' } }}
          >
            Confirmer le rejet
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
