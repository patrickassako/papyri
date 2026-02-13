import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  CircularProgress,
  Alert,
  Pagination,
  Button,
  Tabs,
  Tab,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ContentCardWithProgress from '../components/ContentCardWithProgress';

// Import shared design tokens
import tokens from '../../../shared/tokens';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const History = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 0,
  });
  const [filter, setFilter] = useState('all'); // 'all', 'ebook', 'audiobook', 'completed'

  // Fetch reading history
  const fetchHistory = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('access_token');
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await fetch(
        `${API_URL}/reading-history?page=${page}&limit=${pagination.limit}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          navigate('/login');
          return;
        }
        throw new Error(data.error?.message || 'Erreur lors du chargement de l\'historique.');
      }

      setHistory(data.data || []);
      setPagination(data.pagination);
      setLoading(false);
    } catch (err) {
      console.error('Fetch history error:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory(1);
  }, []);

  // Handle pagination
  const handlePageChange = (event, page) => {
    fetchHistory(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle filter change
  const handleFilterChange = (event, newFilter) => {
    setFilter(newFilter);
  };

  // Filter history items
  const filteredHistory = history.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'ebook') return item.content_type === 'ebook';
    if (filter === 'audiobook') return item.content_type === 'audiobook';
    if (filter === 'completed') return item.is_completed;
    return true;
  });

  // Handle continue reading
  const handleContinue = (contentId, lastPosition) => {
    // Navigate to reader with saved position
    const positionParam = lastPosition ? `?position=${encodeURIComponent(JSON.stringify(lastPosition))}` : '';
    navigate(`/reader/${contentId}${positionParam}`);
  };

  // Handle card click (navigate to content detail)
  const handleCardClick = (contentId) => {
    navigate(`/contents/${contentId}`);
  };

  if (loading && history.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          backgroundColor: tokens.colors.backgrounds.light,
        }}
      >
        <CircularProgress sx={{ color: tokens.colors.primary }} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: tokens.colors.backgrounds.light,
        py: 6,
      }}
    >
      <Container maxWidth="lg">
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography
            variant="h4"
            sx={{
              fontFamily: tokens.typography.fontFamilies.heading,
              fontWeight: 600,
              color: tokens.colors.text.primary,
              mb: 1,
            }}
          >
            Mon Historique
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Retrouvez tous les contenus que vous avez lus ou écoutés
          </Typography>
        </Box>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Filter Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 4 }}>
          <Tabs
            value={filter}
            onChange={handleFilterChange}
            sx={{
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 500,
              },
              '& .Mui-selected': {
                color: tokens.colors.primary,
              },
              '& .MuiTabs-indicator': {
                backgroundColor: tokens.colors.primary,
              },
            }}
          >
            <Tab label="Tous" value="all" />
            <Tab label="Ebooks" value="ebook" />
            <Tab label="Audiobooks" value="audiobook" />
            <Tab label="Terminés" value="completed" />
          </Tabs>
        </Box>

        {/* History List */}
        {filteredHistory.length === 0 && !loading ? (
          <Box
            sx={{
              textAlign: 'center',
              py: 8,
              px: 3,
            }}
          >
            <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
              Aucun contenu dans votre historique
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Commencez à lire ou écouter des contenus pour les voir apparaître ici
            </Typography>
            <Button
              variant="contained"
              onClick={() => navigate('/catalogue')}
              sx={{
                backgroundColor: tokens.colors.primary,
                '&:hover': {
                  backgroundColor: tokens.colors.primaryDark,
                },
              }}
            >
              Découvrir le catalogue
            </Button>
          </Box>
        ) : (
          <>
            <Box>
              {filteredHistory.map((item) => (
                <ContentCardWithProgress
                  key={item.id}
                  content_id={item.content_id}
                  title={item.title}
                  author={item.author}
                  content_type={item.content_type}
                  cover_url={item.cover_url}
                  progress_percent={item.progress_percent}
                  last_read_at={item.last_read_at}
                  is_completed={item.is_completed}
                  last_position={item.last_position}
                  variant="list"
                  onContinue={handleContinue}
                  onClick={() => handleCardClick(item.content_id)}
                />
              ))}
            </Box>

            {/* Pagination */}
            {pagination.total_pages > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                <Pagination
                  count={pagination.total_pages}
                  page={pagination.page}
                  onChange={handlePageChange}
                  color="primary"
                  size="large"
                  sx={{
                    '& .MuiPaginationItem-root': {
                      color: tokens.colors.text.primary,
                    },
                    '& .Mui-selected': {
                      backgroundColor: tokens.colors.primary,
                      color: 'white',
                      '&:hover': {
                        backgroundColor: tokens.colors.primaryDark,
                      },
                    },
                  }}
                />
              </Box>
            )}

            {/* Stats */}
            <Box
              sx={{
                mt: 4,
                p: 3,
                backgroundColor: tokens.colors.backgrounds.surface,
                borderRadius: 2,
                border: `1px solid ${tokens.colors.neutral[200]}`,
              }}
            >
              <Typography variant="body2" color="text.secondary">
                Total : {pagination.total} contenus dans votre historique
              </Typography>
            </Box>
          </>
        )}

        {/* Loading overlay for pagination */}
        {loading && history.length > 0 && (
          <Box
            sx={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(255, 255, 255, 0.7)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 9999,
            }}
          >
            <CircularProgress sx={{ color: tokens.colors.primary }} />
          </Box>
        )}
      </Container>
    </Box>
  );
};

export default History;
