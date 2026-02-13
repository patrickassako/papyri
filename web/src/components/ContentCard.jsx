import React from 'react';
import {
  Card,
  CardContent,
  CardMedia,
  Typography,
  Chip,
  Box,
  CardActionArea
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Headphones, Book } from 'lucide-react';

/**
 * Carte de contenu pour le catalogue
 */
export default function ContentCard({ content }) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/catalogue/${content.id}`);
  };

  const formatDuration = (seconds) => {
    if (!seconds) return null;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h${minutes.toString().padStart(2, '0')}`;
  };

  const getTypeIcon = () => {
    return content.content_type === 'audiobook' ? (
      <Headphones size={16} />
    ) : (
      <Book size={16} />
    );
  };

  const getTypeLabel = () => {
    return content.content_type === 'audiobook' ? 'Livre audio' : 'Ebook';
  };

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 6
        }
      }}
    >
      <CardActionArea onClick={handleClick} sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
        <CardMedia
          component="img"
          height="280"
          image={content.cover_url || 'https://placehold.co/400x600/2E4057/FFF?text=Pas+de+couverture'}
          alt={content.title}
          sx={{
            objectFit: 'cover',
            backgroundColor: 'grey.200'
          }}
        />
        <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ mb: 1, display: 'flex', gap: 1, alignItems: 'center' }}>
            <Chip
              icon={getTypeIcon()}
              label={getTypeLabel()}
              size="small"
              color="primary"
              variant="outlined"
            />
            {content.language && (
              <Chip
                label={content.language.toUpperCase()}
                size="small"
                variant="outlined"
              />
            )}
          </Box>

          <Typography
            gutterBottom
            variant="h6"
            component="h2"
            sx={{
              fontFamily: 'Playfair Display, serif',
              fontSize: '1.1rem',
              lineHeight: 1.3,
              mb: 1,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}
          >
            {content.title}
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mb: 1, fontWeight: 500 }}
          >
            {content.author}
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              flexGrow: 1,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              mb: 1
            }}
          >
            {content.description}
          </Typography>

          {content.content_type === 'audiobook' && content.duration_seconds && (
            <Typography variant="caption" color="text.secondary">
              Durée : {formatDuration(content.duration_seconds)}
            </Typography>
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
