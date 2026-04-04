import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Card, Table, TableBody, TableCell,
  TableHead, TableRow, Chip, IconButton, MenuItem, Select,
  FormControl, InputLabel, CircularProgress, Alert, Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import BarChartIcon from '@mui/icons-material/BarChart';
import TuneIcon from '@mui/icons-material/Tune';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import tokens from '../../config/tokens';
import { getBooks, deleteBook } from '../../services/publisher.service';

const STATUS_CONFIG = {
  draft:     { label: 'Brouillon',  color: '#9C6644', bg: '#FDF3E7' },
  approved:  { label: 'Publié',     color: '#4CAF50', bg: '#E8F5E9' },
  pending:   { label: 'En attente', color: '#9E9E9E', bg: '#F5F5F5' },
  rejected:  { label: 'Rejeté',     color: '#F44336', bg: '#FFEBEE' },
  paused:    { label: 'En pause',   color: '#FF9800', bg: '#FFF3E0' },
};

export default function PublisherBooksPage() {
  const navigate = useNavigate();
  const [books, setBooks] = useState([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const res = await getBooks(params);
      setBooks(res.books || []);
      setTotal(res.total || 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [statusFilter]);

  async function handleDelete(contentId) {
    if (!window.confirm('Supprimer ce livre définitivement ?')) return;
    setDeleting(contentId);
    try {
      await deleteBook(contentId);
      setBooks(prev => prev.filter(b => b.contents?.id !== contentId));
    } catch (e) {
      alert(e.message);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <Box sx={{ p: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: tokens.colors.onBackground.light, fontFamily: 'Playfair Display, serif' }}>
            Mes livres
          </Typography>
          <Typography variant="body2" sx={{ color: '#9E9E9E', mt: 0.5 }}>{total} livre{total !== 1 ? 's' : ''} au total</Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/publisher/books/new')}
          sx={{ bgcolor: tokens.colors.primary, borderRadius: '12px', textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: '#9e5519' } }}
        >
          Ajouter un livre
        </Button>
      </Box>

      {/* Filtres */}
      <Box sx={{ mb: 3 }}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Statut</InputLabel>
          <Select value={statusFilter} label="Statut" onChange={e => setStatusFilter(e.target.value)} sx={{ borderRadius: '12px' }}>
            <MenuItem value="">Tous</MenuItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <MenuItem key={k} value={k}>{v.label}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        {loading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}><CircularProgress /></Box>
        ) : books.length === 0 ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <Typography variant="body1" sx={{ color: '#9E9E9E', mb: 2 }}>Aucun livre trouvé</Typography>
            <Button variant="outlined" onClick={() => navigate('/publisher/books/new')} sx={{ borderRadius: '12px', textTransform: 'none' }}>
              Soumettre mon premier livre
            </Button>
          </Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#FAFAFA' }}>
                <TableCell sx={{ fontWeight: 600, color: '#757575' }}>Livre</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#757575' }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#757575' }}>Statut</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#757575' }}>Soumis le</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#757575' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {books.map((pb) => {
                const content = pb.contents;
                const cfg = STATUS_CONFIG[pb.validation_status] || STATUS_CONFIG.pending;
                return (
                  <TableRow key={pb.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        {content?.cover_url ? (
                          <Box component="img" src={content.cover_url} sx={{ width: 40, height: 52, objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }} />
                        ) : (
                          <Box sx={{ width: 40, height: 52, bgcolor: '#F5F5F5', borderRadius: '6px', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                            <Typography variant="caption" sx={{ color: '#BDBDBD' }}>N/A</Typography>
                          </Box>
                        )}
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: tokens.colors.onBackground.light }}>
                            {content?.title || '—'}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#9E9E9E' }}>{content?.author}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip label={content?.content_type === 'audio' ? 'Audio' : content?.content_type === 'both' ? 'Ebook + Audio' : 'Ebook'} size="small" sx={{ bgcolor: '#F0EDE8', color: '#5D4037', fontWeight: 600 }} />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={cfg.label}
                        size="small"
                        sx={{ bgcolor: cfg.bg, color: cfg.color, fontWeight: 700, border: `1px solid ${cfg.color}33` }}
                      />
                      {pb.validation_status === 'rejected' && pb.rejection_reason && (
                        <Typography variant="caption" sx={{ display: 'block', color: '#F44336', mt: 0.5 }}>
                          {pb.rejection_reason}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: '#757575' }}>
                        {new Date(pb.submitted_at).toLocaleDateString('fr-FR')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {pb.validation_status === 'draft' ? (
                          <Tooltip title="Continuer le brouillon">
                            <IconButton size="small" onClick={() => navigate(`/publisher/books/edit/${content?.id}`)} sx={{ color: '#9C6644' }}>
                              <EditOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <>
                            <Tooltip title="Prix & restrictions géographiques">
                              <IconButton size="small" onClick={() => navigate(`/publisher/books/${content?.id}`)} sx={{ color: tokens.colors.primary }}>
                                <TuneIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Statistiques">
                              <IconButton size="small" onClick={() => navigate('/publisher/revenue')} sx={{ color: tokens.colors.primary }}>
                                <BarChartIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                        {(pb.validation_status === 'rejected' || pb.validation_status === 'draft') && (
                          <Tooltip title="Supprimer">
                            <IconButton
                              size="small"
                              onClick={() => handleDelete(content?.id)}
                              disabled={deleting === content?.id}
                              sx={{ color: '#F44336' }}
                            >
                              {deleting === content?.id ? <CircularProgress size={16} /> : <DeleteOutlineIcon fontSize="small" />}
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </Box>
  );
}
