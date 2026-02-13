import React, { useState, useEffect } from 'react';
import {
  Container,
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Chip,
  AppBar,
  Toolbar,
  IconButton,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  Book,
  Headphones,
  Library,
  AudioLines,
  Smartphone,
  Lock,
  Star,
  ArrowRight,
  Menu,
  Play,
  Eye
} from 'lucide-react';
import { contentsService } from '../services/contents.service';

/**
 * Landing page pour les visiteurs non authentifiés
 * Design inspiré de emoti numérique avec les couleurs du projet
 */
export default function LandingPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [selectedCategory, setSelectedCategory] = useState('tous');
  const [popularContents, setPopularContents] = useState([]);
  const [loading, setLoading] = useState(true);

  const categories = [
    { id: 'tous', label: 'Tous' },
    { id: 'romans', label: 'Romans' },
    { id: 'essais', label: 'Essais' },
    { id: 'histoire', label: 'Histoire' },
    { id: 'sciences', label: 'Sciences' },
    { id: 'jeunesse', label: 'Jeunesse' },
    { id: 'arts', label: 'Arts' },
    { id: 'philosophie', label: 'Philosophie' }
  ];

  const features = [
    {
      icon: <Library size={32} />,
      title: 'Vaste Catalogue',
      description: 'Une collection riche de littérature africaine et francophone, des classiques aux nouveautés.'
    },
    {
      icon: <AudioLines size={32} />,
      title: 'Audio HD',
      description: 'Des narrations professionnelles de haute qualité pour une immersion totale.'
    },
    {
      icon: <Smartphone size={32} />,
      title: 'Multi-plateforme',
      description: 'Lisez sur votre tablette, smartphone ou ordinateur en toute fluidité.'
    },
    {
      icon: <Lock size={32} />,
      title: 'Accès Sécurisé',
      description: 'Vos lectures et vos données sont protégées par les meilleurs standards de sécurité.'
    }
  ];

  useEffect(() => {
    loadPopularContents();
  }, [selectedCategory]);

  const loadPopularContents = async () => {
    setLoading(true);
    try {
      const params = {
        page: 1,
        limit: 5,
        sort: 'published_at',
        order: 'desc'
      };

      if (selectedCategory !== 'tous') {
        params.category = selectedCategory;
      }

      const response = await contentsService.getContents(params);
      setPopularContents(response.data);
    } catch (err) {
      console.error('Erreur chargement contenus:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ bgcolor: '#fcfaf8', minHeight: '100vh' }}>
      {/* Header */}
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: 'rgba(252, 250, 248, 0.8)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid #f4efe6'
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', py: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Book size={28} color="#B5651D" />
            <Typography
              variant="h6"
              sx={{
                color: '#1d160c',
                fontWeight: 700,
                letterSpacing: '-0.02em'
              }}
            >
              Bibliothèque Numérique
            </Typography>
          </Box>

          {!isMobile && (
            <Box sx={{ display: 'flex', gap: 4 }}>
              <Button sx={{ color: '#1d160c', textTransform: 'none', fontWeight: 500 }}>
                Accueil
              </Button>
              <Button
                sx={{ color: '#1d160c', textTransform: 'none', fontWeight: 500 }}
                onClick={() => navigate('/catalogue')}
              >
                Bibliothèque
              </Button>
              <Button sx={{ color: '#1d160c', textTransform: 'none', fontWeight: 500 }}>
                Tarifs
              </Button>
            </Box>
          )}

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              sx={{
                color: '#1d160c',
                textTransform: 'none',
                fontWeight: 700,
                '&:hover': { bgcolor: '#F5E6D3' }
              }}
              onClick={() => navigate('/login')}
            >
              Se connecter
            </Button>
            <Button
              variant="contained"
              sx={{
                bgcolor: '#B5651D',
                textTransform: 'none',
                fontWeight: 700,
                boxShadow: 'none',
                '&:hover': { bgcolor: '#9a5418' }
              }}
              onClick={() => navigate('/register')}
            >
              S'inscrire
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Hero Section */}
      <Box
        sx={{
          bgcolor: '#F5E6D3',
          py: { xs: 8, lg: 12 }
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={6} alignItems="center">
            <Grid size={{ xs: 12, lg: 6 }}>
              <Box sx={{ mb: 4 }}>
                <Typography
                  variant="h1"
                  sx={{
                    fontFamily: 'Playfair Display, serif',
                    fontSize: { xs: '2.5rem', md: '3.5rem', lg: '4rem' },
                    lineHeight: 1.1,
                    color: '#1d160c',
                    mb: 3
                  }}
                >
                  Explorez la bibliothèque numérique ultime
                </Typography>
                <Typography
                  variant="h6"
                  sx={{
                    fontSize: '1.125rem',
                    lineHeight: 1.7,
                    color: 'rgba(29, 22, 12, 0.8)',
                    mb: 4,
                    maxWidth: '520px'
                  }}
                >
                  Plongez dans un univers de littérature africaine et francophone avec notre collection premium de livres et livres audio. Des classiques aux nouveautés, partout avec vous.
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  <Button
                    variant="contained"
                    size="large"
                    endIcon={<ArrowRight />}
                    sx={{
                      bgcolor: '#B5651D',
                      px: 4,
                      py: 1.5,
                      fontSize: '1.125rem',
                      fontWeight: 700,
                      textTransform: 'none',
                      boxShadow: '0 8px 24px rgba(181, 101, 29, 0.2)',
                      '&:hover': { bgcolor: '#9a5418' }
                    }}
                    onClick={() => navigate('/register')}
                  >
                    Commencer maintenant
                  </Button>
                  <Button
                    variant="outlined"
                    size="large"
                    sx={{
                      px: 4,
                      py: 1.5,
                      fontSize: '1.125rem',
                      fontWeight: 700,
                      textTransform: 'none',
                      color: '#1d160c',
                      borderColor: 'rgba(29, 22, 12, 0.2)',
                      bgcolor: 'rgba(255, 255, 255, 0.5)',
                      '&:hover': {
                        bgcolor: 'white',
                        borderColor: 'rgba(29, 22, 12, 0.3)'
                      }
                    }}
                    onClick={() => navigate('/catalogue')}
                  >
                    En savoir plus
                  </Button>
                </Box>
              </Box>
            </Grid>

            <Grid size={{ xs: 12, lg: 6 }}>
              <Box sx={{ position: 'relative' }}>
                <Box
                  sx={{
                    width: '100%',
                    aspectRatio: '4/3',
                    borderRadius: 3,
                    overflow: 'hidden',
                    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2)',
                    backgroundImage: 'url(https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                />
                {!isMobile && (
                  <Card
                    sx={{
                      position: 'absolute',
                      bottom: -24,
                      left: -24,
                      p: 2,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)'
                    }}
                  >
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        bgcolor: 'rgba(181, 101, 29, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#B5651D'
                      }}
                    >
                      <Headphones size={24} />
                    </Box>
                    <Box>
                      <Typography variant="body2" fontWeight={700}>
                        Mode Audio
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Écoutez sans interruption
                      </Typography>
                    </Box>
                  </Card>
                )}
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Category Filters */}
      <Box
        sx={{
          py: 2,
          borderBottom: '1px solid #f4efe6',
          bgcolor: '#fcfaf8'
        }}
      >
        <Container maxWidth="lg">
          <Box
            sx={{
              display: 'flex',
              gap: 1.5,
              overflowX: 'auto',
              pb: 1,
              '&::-webkit-scrollbar': { display: 'none' },
              msOverflowStyle: 'none',
              scrollbarWidth: 'none'
            }}
          >
            {categories.map((cat) => (
              <Chip
                key={cat.id}
                label={cat.label}
                onClick={() => setSelectedCategory(cat.id)}
                sx={{
                  bgcolor: selectedCategory === cat.id ? '#B5651D' : '#f4efe6',
                  color: selectedCategory === cat.id ? 'white' : '#1d160c',
                  fontWeight: selectedCategory === cat.id ? 600 : 500,
                  fontSize: '0.875rem',
                  px: 1,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: selectedCategory === cat.id ? '#9a5418' : 'rgba(181, 101, 29, 0.1)'
                  }
                }}
              />
            ))}
          </Box>
        </Container>
      </Box>

      {/* Popular Content Grid */}
      <Box sx={{ py: 8, bgcolor: '#fcfaf8' }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 5 }}>
            <Box>
              <Typography
                variant="h3"
                sx={{
                  fontFamily: 'Playfair Display, serif',
                  fontSize: '2rem',
                  color: '#1d160c',
                  mb: 1
                }}
              >
                Livres et Audiobooks Populaires
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Découvrez les titres les plus appréciés de notre communauté
              </Typography>
            </Box>
            <Button
              endIcon={<ArrowRight size={16} />}
              sx={{
                color: '#B5651D',
                fontWeight: 700,
                textTransform: 'none',
                '&:hover': { textDecoration: 'underline' }
              }}
              onClick={() => navigate('/catalogue')}
            >
              Tout voir
            </Button>
          </Box>

          <Grid container spacing={4}>
            {(popularContents || []).slice(0, 5).map((content) => (
              <Grid size={{ xs: 6, sm: 4, md: 3, lg: 2.4 }} key={content.id}>
                <Box
                  sx={{
                    cursor: 'pointer',
                    transition: 'transform 0.3s',
                    '&:hover': {
                      transform: 'translateY(-8px)',
                      '& .content-overlay': { opacity: 1 }
                    }
                  }}
                  onClick={() => navigate(`/catalogue/${content.id}`)}
                >
                  <Box sx={{ position: 'relative', mb: 2 }}>
                    <Box
                      sx={{
                        width: '100%',
                        aspectRatio: '2/3',
                        borderRadius: 2,
                        overflow: 'hidden',
                        bgcolor: 'grey.200',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                        transition: 'box-shadow 0.3s',
                        '&:hover': { boxShadow: '0 12px 32px rgba(0, 0, 0, 0.2)' },
                        backgroundImage: `url(${content.cover_url})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                      }}
                    >
                      <Chip
                        label={content.content_type === 'audiobook' ? 'Audio' : 'Livre'}
                        size="small"
                        sx={{
                          position: 'absolute',
                          top: 12,
                          left: 12,
                          bgcolor: content.content_type === 'audiobook' ? '#2196f3' : '#B5651D',
                          color: 'white',
                          fontWeight: 700,
                          fontSize: '0.625rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em'
                        }}
                      />
                      <Box
                        className="content-overlay"
                        sx={{
                          position: 'absolute',
                          inset: 0,
                          bgcolor: 'rgba(0, 0, 0, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: 0,
                          transition: 'opacity 0.3s'
                        }}
                      >
                        {content.content_type === 'audiobook' ? (
                          <Headphones size={32} color="white" />
                        ) : (
                          <Eye size={32} color="white" />
                        )}
                      </Box>
                    </Box>
                  </Box>

                  <Typography
                    variant="body1"
                    fontWeight={700}
                    sx={{
                      color: '#1d160c',
                      mb: 0.5,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {content.title}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      mb: 0.5,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {content.author}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Star size={14} fill="#B5651D" color="#B5651D" />
                    <Typography variant="caption" fontWeight={700} sx={{ color: '#B5651D' }}>
                      4.8
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      (2.4k)
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Features Grid */}
      <Box sx={{ py: 10, bgcolor: '#f4efe6' }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Typography
              variant="h3"
              sx={{
                fontFamily: 'Playfair Display, serif',
                fontSize: '2.5rem',
                color: '#1d160c',
                mb: 2
              }}
            >
              Pourquoi nous choisir ?
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ maxWidth: '600px', mx: 'auto' }}
            >
              Une expérience de lecture conçue pour les amoureux de la littérature, avec des outils modernes.
            </Typography>
          </Box>

          <Grid container spacing={4}>
            {features.map((feature, index) => (
              <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index}>
                <Card
                  sx={{
                    p: 4,
                    height: '100%',
                    bgcolor: 'white',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                    transition: 'box-shadow 0.3s',
                    '&:hover': { boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)' }
                  }}
                >
                  <Box sx={{ color: '#B5651D', mb: 2 }}>{feature.icon}</Box>
                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                    {feature.description}
                  </Typography>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* CTA Section */}
      <Box sx={{ py: 10, px: 3 }}>
        <Container maxWidth="lg">
          <Box
            sx={{
              background: 'linear-gradient(135deg, #D4A017 0%, #B5651D 100%)',
              borderRadius: 4,
              p: { xs: 6, md: 10 },
              textAlign: 'center',
              color: 'white',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <Box
              sx={{
                position: 'relative',
                zIndex: 1,
                maxWidth: '700px',
                mx: 'auto'
              }}
            >
              <Typography
                variant="h3"
                sx={{
                  fontFamily: 'Playfair Display, serif',
                  fontSize: { xs: '2rem', md: '2.75rem' },
                  mb: 3,
                  lineHeight: 1.2
                }}
              >
                Prêt à commencer votre voyage littéraire ?
              </Typography>
              <Typography variant="h6" sx={{ mb: 5, opacity: 0.95, fontSize: '1.125rem' }}>
                Rejoignez-nous aujourd'hui. Seulement 5€/mois ou 50€/an pour un accès illimité à toute notre bibliothèque.
              </Typography>
              <Button
                variant="contained"
                size="large"
                sx={{
                  bgcolor: 'white',
                  color: '#B5651D',
                  px: 5,
                  py: 2,
                  fontSize: '1.125rem',
                  fontWeight: 700,
                  textTransform: 'none',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                  '&:hover': { bgcolor: '#f5f5f5' }
                }}
                onClick={() => navigate('/register')}
              >
                Créer mon compte
              </Button>
            </Box>

            {/* Decorative elements */}
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: 256,
                height: 256,
                bgcolor: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '50%',
                mr: -10,
                mt: -10,
                filter: 'blur(64px)'
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                width: 256,
                height: 256,
                bgcolor: 'rgba(0, 0, 0, 0.1)',
                borderRadius: '50%',
                ml: -10,
                mb: -10,
                filter: 'blur(64px)'
              }}
            />
          </Box>
        </Container>
      </Box>

      {/* Footer */}
      <Box
        component="footer"
        sx={{
          bgcolor: '#fcfaf8',
          borderTop: '1px solid #f4efe6',
          pt: 8,
          pb: 4
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={6} sx={{ mb: 6 }}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <Book size={28} color="#B5651D" />
                <Typography variant="h6" fontWeight={700} sx={{ color: '#1d160c' }}>
                  Bibliothèque Numérique
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.7 }}>
                La destination privilégiée pour la lecture numérique en français et en langues africaines. Qualité, élégance et passion de la littérature.
              </Typography>
            </Grid>

            <Grid size={{ xs: 6, md: 2 }}>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                Navigation
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Button
                  sx={{ justifyContent: 'flex-start', color: 'text.secondary', textTransform: 'none', p: 0 }}
                >
                  Accueil
                </Button>
                <Button
                  sx={{ justifyContent: 'flex-start', color: 'text.secondary', textTransform: 'none', p: 0 }}
                  onClick={() => navigate('/catalogue')}
                >
                  Bibliothèque
                </Button>
                <Button
                  sx={{ justifyContent: 'flex-start', color: 'text.secondary', textTransform: 'none', p: 0 }}
                >
                  Nouveautés
                </Button>
              </Box>
            </Grid>

            <Grid size={{ xs: 6, md: 2 }}>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                Support
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Button
                  sx={{ justifyContent: 'flex-start', color: 'text.secondary', textTransform: 'none', p: 0 }}
                >
                  Centre d'aide
                </Button>
                <Button
                  sx={{ justifyContent: 'flex-start', color: 'text.secondary', textTransform: 'none', p: 0 }}
                >
                  FAQ
                </Button>
                <Button
                  sx={{ justifyContent: 'flex-start', color: 'text.secondary', textTransform: 'none', p: 0 }}
                >
                  Contact
                </Button>
                <Button
                  sx={{ justifyContent: 'flex-start', color: 'text.secondary', textTransform: 'none', p: 0 }}
                >
                  Tarifs
                </Button>
              </Box>
            </Grid>

            <Grid size={{ xs: 6, md: 2 }}>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                Légal
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Button
                  sx={{ justifyContent: 'flex-start', color: 'text.secondary', textTransform: 'none', p: 0 }}
                >
                  CGU
                </Button>
                <Button
                  sx={{ justifyContent: 'flex-start', color: 'text.secondary', textTransform: 'none', p: 0 }}
                >
                  Confidentialité
                </Button>
                <Button
                  sx={{ justifyContent: 'flex-start', color: 'text.secondary', textTransform: 'none', p: 0 }}
                >
                  Mentions légales
                </Button>
              </Box>
            </Grid>
          </Grid>

          <Box
            sx={{
              pt: 4,
              borderTop: '1px solid #f4efe6',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 2
            }}
          >
            <Typography variant="caption" color="text.secondary">
              © 2026 Bibliothèque Numérique. Tous droits réservés.
            </Typography>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
