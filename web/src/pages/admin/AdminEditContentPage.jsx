import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import tokens from '../../config/tokens';
import { authFetch } from '../../services/auth.service';
import RichTextEditor from '../../components/RichTextEditor';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const C = {
  terre: tokens.colors.primary,
  indigo: tokens.colors.accent,
  green: '#27ae60',
  red: '#e74c3c',
  textPrimary: '#1a1a2e',
  textSecondary: '#6b7280',
  bg: '#F7F6F3',
};

export default function AdminEditContentPage() {
  const { contentId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [content, setContent] = useState(null);
  const [form, setForm] = useState({
    title: '',
    author: '',
    language: 'fr',
    access_type: 'subscription',
    price: '',
    description: '',
    cover_url: '',
  });

  useEffect(() => {
    setLoading(true);
    setError(null);
    authFetch(`${API}/api/admin/books-overview/content/${contentId}`)
      .then(r => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setContent(data);
        setForm({
          title: data.title || '',
          author: data.author || '',
          language: data.language || 'fr',
          access_type: data.access_type || 'subscription',
          price: data.price_cents ? String(data.price_cents / 100) : '',
          description: data.description || '',
          cover_url: data.cover_url || '',
        });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [contentId]);

  const needsPrice = useMemo(
    () => form.access_type === 'paid' || form.access_type === 'subscription_or_paid',
    [form.access_type]
  );

  function setField(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleCoverFile(file) {
    setUploadingCover(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('cover', file);
      const res = await authFetch(`${API}/api/admin/upload-cover`, { method: 'POST', body: fd });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setField('cover_url', data.url || '');
      setSuccess('Couverture mise à jour.');
    } catch (e) {
      setError(e.message);
    } finally {
      setUploadingCover(false);
    }
  }

  async function handleSave() {
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      if (!form.title.trim()) throw new Error('Le titre est requis.');
      const priceCents = needsPrice ? Math.round(Number(form.price || 0) * 100) : 0;
      if (needsPrice && priceCents <= 0) throw new Error('Un prix supérieur à 0 est requis.');

      const res = await authFetch(`${API}/api/contents/${contentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          author: form.author.trim() || null,
          language: form.language || 'fr',
          access_type: form.access_type,
          is_purchasable: needsPrice,
          price_cents: priceCents,
          price_currency: content?.price_currency || 'EUR',
          description: form.description || null,
          cover_url: form.cover_url || null,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data?.error?.message || data?.error || 'Erreur de mise à jour');
      setContent(prev => ({ ...(prev || {}), ...data.data }));
      setSuccess('Contenu mis à jour.');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Box sx={{ minHeight: '70vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: C.bg, minHeight: '100vh', p: { xs: 2, md: 3 } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ mb: 3, flexWrap: 'wrap' }}>
        <Box>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ textTransform: 'none', mb: 1 }}>
            Retour
          </Button>
          <Typography variant="h4" fontWeight={800} color={C.textPrimary}>
            Modification complète
          </Typography>
          <Typography variant="body2" color={C.textSecondary}>
            Métadonnées, accès, prix, couverture et description.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveOutlinedIcon />}
          onClick={handleSave}
          disabled={saving}
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '12px', bgcolor: C.indigo, '&:hover': { bgcolor: '#1a2d47' } }}
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2, borderRadius: '12px' }}>{success}</Alert>}

      <Stack spacing={3}>
        <Card sx={{ borderRadius: '20px' }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>
              Métadonnées
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
              <TextField label="Titre" value={form.title} onChange={(e) => setField('title', e.target.value)} fullWidth required />
              <TextField label="Auteur" value={form.author} onChange={(e) => setField('author', e.target.value)} fullWidth />
              <TextField label="Langue" value={form.language} onChange={(e) => setField('language', e.target.value)} fullWidth />
              <TextField select label="Accès" value={form.access_type} onChange={(e) => setField('access_type', e.target.value)} fullWidth>
                <MenuItem value="free">Gratuit</MenuItem>
                <MenuItem value="subscription">Abonnement</MenuItem>
                <MenuItem value="paid">Payant</MenuItem>
                <MenuItem value="subscription_or_paid">Abonnement ou achat</MenuItem>
              </TextField>
              <TextField
                label="Prix"
                type="number"
                inputProps={{ min: 0, step: '0.01' }}
                value={form.price}
                onChange={(e) => setField('price', e.target.value)}
                disabled={!needsPrice}
                helperText="Montant en unité monétaire, ex: 4.99"
                fullWidth
              />
            </Box>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color={C.textSecondary} sx={{ mb: 1 }}>
                Description
              </Typography>
              <RichTextEditor value={form.description} onChange={(value) => setField('description', value)} placeholder="Synopsis du livre…" />
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ borderRadius: '20px' }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>
              Couverture et fichiers
            </Typography>
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
                <Box
                  sx={{
                    width: 128,
                    height: 180,
                    borderRadius: '14px',
                    bgcolor: '#efe9dd',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {form.cover_url ? (
                    <img src={form.cover_url} alt={form.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Typography variant="caption" color={C.textSecondary}>Aucune couverture</Typography>
                  )}
                </Box>
                <Stack spacing={1} sx={{ minWidth: 0 }}>
                  <Button
                    component="label"
                    variant="outlined"
                    startIcon={uploadingCover ? <CircularProgress size={16} /> : <UploadFileOutlinedIcon />}
                    sx={{ width: 'fit-content', textTransform: 'none', fontWeight: 700, borderRadius: '12px' }}
                  >
                    {uploadingCover ? 'Upload…' : 'Remplacer la couverture'}
                    <input hidden type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => e.target.files?.[0] && handleCoverFile(e.target.files[0])} />
                  </Button>
                  <Typography variant="body2" color={C.textSecondary}>
                    Format: {content?.format || '—'}
                  </Typography>
                  <Typography variant="body2" color={C.textSecondary} sx={{ wordBreak: 'break-all' }}>
                    Fichier principal: {content?.file_key || '—'}
                  </Typography>
                  {content?.publisher_book && (
                    <Chip label={`Workflow éditeur: ${content.publisher_book.validation_status || '—'}`} size="small" sx={{ width: 'fit-content' }} />
                  )}
                </Stack>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Card sx={{ borderRadius: '20px' }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>
              Contexte
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Stack spacing={1.25}>
              <Typography variant="body2" color={C.textSecondary}>ID contenu: {contentId}</Typography>
              <Typography variant="body2" color={C.textSecondary}>Créé le: {content?.created_at ? new Date(content.created_at).toLocaleString('fr-FR') : '—'}</Typography>
              <Typography variant="body2" color={C.textSecondary}>Dernière mise à jour: {content?.updated_at ? new Date(content.updated_at).toLocaleString('fr-FR') : '—'}</Typography>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
