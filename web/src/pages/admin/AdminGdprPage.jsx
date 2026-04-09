import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControl, InputLabel, MenuItem,
  Select, Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Tooltip, Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined';
import { getGdprRequests, processGdprRequest } from '../../services/admin.service';
import tokens from '../../config/tokens';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminEmptyState from '../../components/admin/AdminEmptyState';

const P = tokens.colors.primary;

const TYPE_LABELS = {
  deletion:      { label: 'Suppression',   color: '#e74c3c', bg: '#ffebee' },
  export:        { label: 'Export données', color: '#1976d2', bg: '#e3f2fd' },
  rectification: { label: 'Rectification', color: '#7b1fa2', bg: '#f3e5f5' },
};
const STATUS_LABELS = {
  pending:    { label: 'En attente',  color: '#FF8F00', bg: '#FFF8E1', icon: HourglassEmptyOutlinedIcon },
  processing: { label: 'En cours',    color: '#1976d2', bg: '#e3f2fd', icon: HourglassEmptyOutlinedIcon },
  completed:  { label: 'Traité',      color: '#27ae60', bg: '#e8f5e9', icon: CheckCircleOutlineIcon },
  rejected:   { label: 'Refusé',      color: '#e74c3c', bg: '#ffebee', icon: CancelOutlinedIcon },
};

function TypeChip({ type }) {
  const t = TYPE_LABELS[type] || { label: type, color: '#666', bg: '#f5f5f5' };
  return <Chip label={t.label} size="small" sx={{ bgcolor: t.bg, color: t.color, fontWeight: 700, fontSize: '11px', height: 22 }} />;
}

function StatusChip({ status }) {
  const s = STATUS_LABELS[status] || { label: status, color: '#666', bg: '#f5f5f5', icon: HourglassEmptyOutlinedIcon };
  const Icon = s.icon;
  return (
    <Chip
      icon={<Icon sx={{ fontSize: '13px !important', color: `${s.color} !important` }} />}
      label={s.label}
      size="small"
      sx={{ bgcolor: s.bg, color: s.color, fontWeight: 700, fontSize: '11px', height: 22 }}
    />
  );
}

function daysUntilDeadline(deadlineAt) {
  if (!deadlineAt) return null;
  const diff = Math.ceil((new Date(deadlineAt) - Date.now()) / (1000 * 60 * 60 * 24));
  return diff;
}

export default function AdminGdprPage() {
  const [requests, setRequests] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');

  // Process dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [newStatus, setNewStatus] = useState('processing');
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (filterType) params.type = filterType;
      const res = await getGdprRequests(params);
      setRequests(res.data || []);
      setTotal(res.total || 0);
    } catch (e) {
      setError(e.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterType]);

  useEffect(() => { load(); }, [load]);

  const openDialog = (req) => {
    setSelected(req);
    setNewStatus(req.status === 'pending' ? 'processing' : 'completed');
    setAdminNotes(req.admin_notes || '');
    setDialogOpen(true);
    setSuccessMsg('');
  };

  const handleProcess = async () => {
    if (!selected) return;
    setProcessing(true);
    try {
      await processGdprRequest(selected.id, { status: newStatus, admin_notes: adminNotes });
      setSuccessMsg('Demande mise à jour avec succès.');
      setDialogOpen(false);
      load();
    } catch (e) {
      setError(e.message || 'Erreur lors du traitement.');
    } finally {
      setProcessing(false);
    }
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const urgentCount = requests.filter(r => {
    const days = daysUntilDeadline(r.deadline_at);
    return days !== null && days <= 7 && r.status !== 'completed' && r.status !== 'rejected';
  }).length;

  return (
    <Box sx={{ p: 3, maxWidth: 1100 }}>
      <AdminPageHeader
        title="Demandes RGPD"
        subtitle="Traçabilité des demandes de suppression, export et rectification avec suivi du délai légal de 30 jours"
      />

      {/* KPI chips */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Box sx={{ px: 2, py: 1, bgcolor: '#FFF8E1', borderRadius: '10px', border: '1px solid #FFE082' }}>
          <Typography sx={{ fontSize: '1.4rem', fontWeight: 800, color: '#FF8F00', lineHeight: 1 }}>{pendingCount}</Typography>
          <Typography sx={{ fontSize: '0.72rem', color: '#7a6a4e', fontWeight: 600 }}>En attente</Typography>
        </Box>
        {urgentCount > 0 && (
          <Box sx={{ px: 2, py: 1, bgcolor: '#ffebee', borderRadius: '10px', border: '1px solid #ef9a9a' }}>
            <Typography sx={{ fontSize: '1.4rem', fontWeight: 800, color: '#e74c3c', lineHeight: 1 }}>{urgentCount}</Typography>
            <Typography sx={{ fontSize: '0.72rem', color: '#c62828', fontWeight: 600 }}>Urgentes (≤7j)</Typography>
          </Box>
        )}
        <Box sx={{ px: 2, py: 1, bgcolor: '#f5f5f5', borderRadius: '10px', border: '1px solid #e0e0e0' }}>
          <Typography sx={{ fontSize: '1.4rem', fontWeight: 800, color: '#333', lineHeight: 1 }}>{total}</Typography>
          <Typography sx={{ fontSize: '0.72rem', color: '#666', fontWeight: 600 }}>Total</Typography>
        </Box>
      </Box>

      {successMsg && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg('')}>{successMsg}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Statut</InputLabel>
          <Select value={filterStatus} label="Statut" onChange={e => setFilterStatus(e.target.value)}>
            <MenuItem value="">Tous</MenuItem>
            <MenuItem value="pending">En attente</MenuItem>
            <MenuItem value="processing">En cours</MenuItem>
            <MenuItem value="completed">Traité</MenuItem>
            <MenuItem value="rejected">Refusé</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Type</InputLabel>
          <Select value={filterType} label="Type" onChange={e => setFilterType(e.target.value)}>
            <MenuItem value="">Tous</MenuItem>
            <MenuItem value="deletion">Suppression</MenuItem>
            <MenuItem value="export">Export données</MenuItem>
            <MenuItem value="rectification">Rectification</MenuItem>
          </Select>
        </FormControl>
        <Button variant="outlined" size="small" onClick={load} sx={{ borderColor: P, color: P }}>
          Actualiser
        </Button>
      </Box>

      {/* Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : requests.length === 0 ? (
        <AdminEmptyState
          title="Aucune demande RGPD trouvée"
          description="Les demandes de suppression, export ou rectification apparaîtront ici."
        />
      ) : (
        <Box sx={{ border: '1px solid #f0ebe3', borderRadius: '12px', overflow: 'hidden' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#faf8f5' }}>
                {['Utilisateur', 'Type', 'Statut', 'Délai légal', 'Message', 'Soumis le', 'Actions'].map(h => (
                  <TableCell key={h} sx={{ fontWeight: 700, fontSize: '12px', color: '#666', py: 1.5 }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {requests.map(req => {
                const days = daysUntilDeadline(req.deadline_at);
                const urgent = days !== null && days <= 7 && !['completed', 'rejected'].includes(req.status);
                const profile = req.profiles;
                return (
                  <TableRow
                    key={req.id}
                    sx={{ '&:hover': { bgcolor: '#faf8f5' }, bgcolor: urgent ? '#fff8f8' : 'inherit' }}
                  >
                    <TableCell sx={{ py: 1.2 }}>
                      <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: tokens.colors.accent }}>
                        {profile?.full_name || '—'}
                      </Typography>
                      <Typography sx={{ fontSize: '0.72rem', color: '#9E9E9E' }}>
                        {profile?.email || req.user_id?.slice(0, 8) + '...'}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1.2 }}><TypeChip type={req.request_type} /></TableCell>
                    <TableCell sx={{ py: 1.2 }}><StatusChip status={req.status} /></TableCell>
                    <TableCell sx={{ py: 1.2 }}>
                      {days !== null ? (
                        <Chip
                          label={days <= 0 ? 'Dépassé' : `J-${days}`}
                          size="small"
                          sx={{
                            fontSize: '11px', height: 20, fontWeight: 700,
                            bgcolor: days <= 0 ? '#ffebee' : days <= 7 ? '#FFF8E1' : '#f5f5f5',
                            color: days <= 0 ? '#e74c3c' : days <= 7 ? '#FF8F00' : '#666',
                          }}
                        />
                      ) : '—'}
                    </TableCell>
                    <TableCell sx={{ py: 1.2, maxWidth: 200 }}>
                      <Tooltip title={req.user_message || ''} placement="top">
                        <Typography sx={{ fontSize: '0.78rem', color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                          {req.user_message || <span style={{ color: '#ccc' }}>—</span>}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell sx={{ py: 1.2, whiteSpace: 'nowrap', fontSize: '0.78rem', color: '#666' }}>
                      {new Date(req.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </TableCell>
                    <TableCell sx={{ py: 1.2 }}>
                      {!['completed', 'rejected'].includes(req.status) ? (
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => openDialog(req)}
                          sx={{ bgcolor: P, '&:hover': { bgcolor: '#9a5518' }, fontSize: '11px', py: 0.4, px: 1.5, borderRadius: '8px', textTransform: 'none', fontWeight: 700 }}
                        >
                          Traiter
                        </Button>
                      ) : (
                        <Button size="small" variant="outlined" onClick={() => openDialog(req)}
                          sx={{ fontSize: '11px', py: 0.4, px: 1.5, borderRadius: '8px', textTransform: 'none', borderColor: '#e0e0e0', color: '#666' }}>
                          Voir
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      )}

      {/* Process Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: '#1A1A2E' }}>
          Traiter la demande RGPD
        </DialogTitle>
        <DialogContent>
          {selected && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TypeChip type={selected.request_type} />
                <StatusChip status={selected.status} />
              </Box>
              <Typography sx={{ fontSize: '0.85rem', color: '#555' }}>
                <strong>Utilisateur :</strong> {selected.profiles?.email || selected.user_id}
              </Typography>
              {selected.user_message && (
                <Box sx={{ bgcolor: '#faf8f5', p: 1.5, borderRadius: '8px', border: '1px solid #f0ebe3' }}>
                  <Typography sx={{ fontSize: '0.8rem', color: '#555', fontStyle: 'italic' }}>
                    "{selected.user_message}"
                  </Typography>
                </Box>
              )}
              <FormControl fullWidth size="small">
                <InputLabel>Nouveau statut</InputLabel>
                <Select value={newStatus} label="Nouveau statut" onChange={e => setNewStatus(e.target.value)}>
                  <MenuItem value="processing">En cours (prise en charge)</MenuItem>
                  <MenuItem value="completed">Traité (exécuté)</MenuItem>
                  <MenuItem value="rejected">Refusé</MenuItem>
                </Select>
              </FormControl>
              {newStatus === 'completed' && selected.request_type === 'deletion' && (
                <Alert severity="warning" sx={{ fontSize: '0.8rem' }}>
                  Confirmer "Traité" supprimera définitivement le compte et toutes les données de cet utilisateur.
                </Alert>
              )}
              <TextField
                label="Notes admin (optionnel)"
                multiline
                rows={3}
                size="small"
                value={adminNotes}
                onChange={e => setAdminNotes(e.target.value)}
                placeholder="Raison du refus, délai de traitement, etc."
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ color: '#666', textTransform: 'none' }}>
            Annuler
          </Button>
          <Button
            onClick={handleProcess}
            variant="contained"
            disabled={processing}
            sx={{ bgcolor: newStatus === 'rejected' ? '#e74c3c' : P, '&:hover': { bgcolor: newStatus === 'rejected' ? '#c0392b' : '#9a5518' }, textTransform: 'none', fontWeight: 700 }}
          >
            {processing ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Confirmer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
