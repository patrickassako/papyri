import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Typography,
  Box,
  Chip,
  Button,
  Card,
  CardMedia,
  Skeleton,
  Alert,
  Divider,
  Breadcrumbs,
  Link,
  Paper
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { Download, Headphones, Book, ArrowLeft, Play, ChevronRight, Clock, Globe, Tag } from 'lucide-react';
import { contentsService } from '../services/contents.service';

/**
 * Page de détails d'un contenu
 */
export default function ContentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloadingUrl, setDownloadingUrl] = useState(false);

  useEffect(() => {
    loadContent();
  }, [id]);

  const loadContent = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await contentsService.getContentById(id);
      setContent(data);
    } catch (err) {
      console.error('Erreur chargement contenu:', err);
      setError('Impossible de charger ce contenu. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    setDownloadingUrl(true);
    try {
      const { url } = await contentsService.getContentFileUrl(id);
      window.open(url, '_blank');
    } catch (err) {
      console.error('Erreur téléchargement:', err);
      alert('Erreur lors du téléchargement. Veuillez réessayer.');
    } finally {
      setDownloadingUrl(false);
    }
  };

  const handleListen = () => {
    // TODO: Ouvrir le lecteur audio (Epic 4)
    alert('Lecteur audio à venir dans Epic 4');
  };

  const handleRead = () => {
    // TODO: Ouvrir le lecteur ebook (Epic 4)
    alert('Lecteur ebook à venir dans Epic 4');
  };

  const formatDuration = (seconds) => {
    if (!seconds) return null;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h${minutes.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return null;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Skeleton variant="text" width={200} height={40} sx={{ mb: 3 }} />
        <Grid container spacing={4}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Skeleton variant="rectangular" height={500} />
          </Grid>
          <Grid size={{ xs: 12, md: 8 }}>
            <Skeleton variant="text" width="80%" height={60} />
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="text" width="100%" sx={{ mt: 2 }} />
            <Skeleton variant="text" width="100%" />
            <Skeleton variant="text" width="100%" />
          </Grid>
        </Grid>
      </Container>
    );
  }

  if (error || !content) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error || 'Contenu introuvable'}
        </Alert>
        <Button startIcon={<ArrowLeft />} onClick={() => navigate('/catalogue')}>
          Retour au catalogue
        </Button>
      </Container>
    );
  }

  const isAudiobook = content.content_type === 'audiobook';

  return (
    <Box sx={{ bgcolor: '#fcfaf8', minHeight: '100vh', pb: 8 }}>
      <Container maxWidth="lg" sx={{ pt: 4 }}>
        {/* Breadcrumb */}
        <Breadcrumbs
          separator={<ChevronRight size={16} />}
          sx={{ mb: 3 }}
        >
          <Link
            component="button"
            variant="body2"
            onClick={() => navigate('/')}
            sx={{ color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline', cursor: 'pointer' } }}
          >
            Accueil
          </Link>
          <Link
            component="button"
            variant="body2"
            onClick={() => navigate('/catalogue')}
            sx={{ color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline', cursor: 'pointer' } }}
          >
            Catalogue
          </Link>
          <Typography variant="body2" color="primary.main">
            {content.title}
          </Typography>
        </Breadcrumbs>

        <Grid container spacing={4}>
          {/* Couverture */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper
              elevation={4}
              sx={{
                borderRadius: 2,
                overflow: 'hidden',
                aspectRatio: '2/3',
                position: 'sticky',
                top: 20
              }}
            >
              <Box
                component="img"
                src={content.cover_url || 'https://placehold.co/600x900/2E4057/FFF?text=Pas+de+couverture'}
                alt={content.title}
                sx={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
            </Paper>

          </Grid>

          {/* Détails */}
          <Grid size={{ xs: 12, md: 8 }}>
            {/* Type et langue */}
            <Box sx={{ mb: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
              {isAudiobook ? (
                <Chip
                  icon={<Headphones size={16} />}
                  label="Livre Audio"
                  color="primary"
                  sx={{ fontWeight: 600 }}
                />
              ) : (
                <Chip
                  icon={<Book size={16} />}
                  label="E-book"
                  color="primary"
                  sx={{ fontWeight: 600 }}
                />
              )}
              {content.language && (
                <Chip
                  label={content.language.toUpperCase()}
                  size="small"
                  variant="outlined"
                />
              )}
            </Box>

            {/* Titre */}
            <Typography
              variant="h3"
              component="h1"
              sx={{
                fontFamily: 'Playfair Display, serif',
                fontSize: { xs: '2rem', md: '2.5rem' },
                lineHeight: 1.2,
                color: '#1d160c',
                mb: 2
              }}
            >
              {content.title}
            </Typography>

            {/* Auteur */}
            <Typography
              variant="h5"
              sx={{
                color: 'text.secondary',
                fontWeight: 500,
                mb: 3
              }}
            >
              par {content.author}
            </Typography>

            {/* Métadonnées */}
            <Box sx={{ display: 'flex', gap: 3, mb: 3, flexWrap: 'wrap' }}>
              {isAudiobook && content.duration_seconds && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Clock size={20} color="#867465" />
                  <Typography variant="body2" color="text.secondary">
                    {formatDuration(content.duration_seconds)}
                  </Typography>
                </Box>
              )}

              {content.language && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Globe size={20} color="#867465" />
                  <Typography variant="body2" color="text.secondary">
                    {content.language === 'fr' ? 'Français' : content.language === 'en' ? 'Anglais' : content.language}
                  </Typography>
                </Box>
              )}

              {content.format && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Tag size={20} color="#867465" />
                  <Typography variant="body2" color="text.secondary">
                    {content.format.toUpperCase()}
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Catégories */}
            {content.categories && content.categories.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'text.secondary' }}>
                  Catégories
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {content.categories.map((cat) => (
                    <Chip
                      key={cat.id || cat}
                      label={cat.name || cat}
                      size="small"
                      variant="outlined"
                      sx={{ borderColor: '#B5651D', color: '#B5651D', cursor: 'pointer' }}
                      onClick={() => navigate(`/catalogue?category=${cat.slug || cat}`)}
                    />
                  ))}
                </Box>
              </Box>
            )}

            <Divider sx={{ my: 3 }} />

            {/* Description */}
            <Box sx={{ mb: 4 }}>
              <Typography
                variant="h6"
                sx={{ mb: 2, fontWeight: 700, color: '#1d160c' }}
              >
                Résumé
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  lineHeight: 1.8,
                  color: 'text.secondary',
                  whiteSpace: 'pre-line'
                }}
              >
                {content.description || 'Aucune description disponible pour ce contenu.'}
              </Typography>
            </Box>

            {/* Boutons d'action */}
            <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
              {isAudiobook ? (
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<Headphones size={20} />}
                  onClick={handleListen}
                  sx={{
                    bgcolor: '#B5651D',
                    flex: 1,
                    py: 1.5,
                    fontSize: '1.125rem',
                    fontWeight: 700,
                    textTransform: 'none',
                    boxShadow: '0 8px 24px rgba(181, 101, 29, 0.2)',
                    '&:hover': { bgcolor: '#9a5418' }
                  }}
                >
                  Écouter maintenant
                </Button>
              ) : (
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<Play size={20} />}
                  onClick={handleRead}
                  sx={{
                    bgcolor: '#B5651D',
                    flex: 1,
                    py: 1.5,
                    fontSize: '1.125rem',
                    fontWeight: 700,
                    textTransform: 'none',
                    boxShadow: '0 8px 24px rgba(181, 101, 29, 0.2)',
                    '&:hover': { bgcolor: '#9a5418' }
                  }}
                >
                  Lire maintenant
                </Button>
              )}

              <Button
                variant="outlined"
                size="large"
                startIcon={<Download />}
                onClick={handleDownload}
                disabled={downloadingUrl}
                sx={{
                  borderColor: '#B5651D',
                  color: '#B5651D',
                  px: 3,
                  py: 1.5,
                  textTransform: 'none',
                  '&:hover': { borderColor: '#9a5418', bgcolor: 'rgba(181, 101, 29, 0.05)' }
                }}
              >
                {downloadingUrl ? 'Préparation...' : 'Télécharger'}
              </Button>
            </Box>

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mb: 4 }}
            >
              Un abonnement actif est requis pour accéder à ce contenu
            </Typography>

            <Divider sx={{ my: 3 }} />

            {/* Informations complémentaires */}
            {(content.isbn || content.published_at || content.narrator || content.file_size_bytes) && (
              <Box sx={{ p: 3, bgcolor: '#f4efe6', borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 700, color: '#1d160c' }}>
                  Informations complémentaires
                </Typography>
                <Grid container spacing={2}>
                  {content.isbn && (
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="body2" color="text.secondary">
                        <strong>ISBN :</strong> {content.isbn}
                      </Typography>
                    </Grid>
                  )}
                  {content.narrator && (
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Narrateur :</strong> {content.narrator}
                      </Typography>
                    </Grid>
                  )}
                  {content.published_at && (
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Publication :</strong> {new Date(content.published_at).toLocaleDateString('fr-FR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </Typography>
                    </Grid>
                  )}
                  {content.file_size_bytes && (
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Taille :</strong> {formatFileSize(content.file_size_bytes)}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </Box>
            )}
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
