import React from 'react';
import {
  Card,
  CardMedia,
  CardContent,
  Typography,
  Box,
  LinearProgress,
  Chip,
  Button,
} from '@mui/material';
import {
  MenuBook as BookIcon,
  Headset as AudioIcon,
} from '@mui/icons-material';

// Import shared design tokens
import tokens from '../../../shared/tokens';

/**
 * ContentCardWithProgress Component
 * Displays a content card with progress bar
 *
 * @param {Object} props
 * @param {string} props.content_id - Content ID
 * @param {string} props.title - Content title
 * @param {string} props.author - Content author
 * @param {string} props.content_type - Content type (ebook, audiobook)
 * @param {string} props.cover_url - Cover image URL
 * @param {number} props.progress_percent - Progress percentage (0-100)
 * @param {string} props.last_read_at - Last read timestamp
 * @param {boolean} props.is_completed - Completion status
 * @param {Object} props.last_position - Last reading position
 * @param {string} props.variant - Layout variant (horizontal, vertical, list)
 * @param {function} props.onContinue - Continue reading handler
 * @param {function} props.onClick - Card click handler
 */
const ContentCardWithProgress = ({
  content_id,
  title,
  author,
  content_type,
  cover_url,
  progress_percent = 0,
  last_read_at,
  is_completed = false,
  last_position,
  variant = 'list',
  onContinue,
  onClick,
}) => {
  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // Get content type icon and label
  const getTypeInfo = () => {
    if (content_type === 'audiobook') {
      return {
        icon: <AudioIcon sx={{ fontSize: 16 }} />,
        label: 'Audio',
        color: tokens.colors.secondary,
      };
    }
    return {
      icon: <BookIcon sx={{ fontSize: 16 }} />,
      label: 'Ebook',
      color: tokens.colors.primary,
    };
  };

  const typeInfo = getTypeInfo();

  // Variant: Horizontal (200px width, for carousels)
  if (variant === 'horizontal') {
    return (
      <Card
        sx={{
          width: 200,
          cursor: 'pointer',
          transition: 'transform 0.2s, box-shadow 0.2s',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: 4,
          },
        }}
        onClick={onClick}
      >
        <CardMedia
          component="img"
          height="300"
          image={cover_url || '/placeholder-cover.jpg'}
          alt={title}
          sx={{ objectFit: 'cover' }}
        />
        <CardContent sx={{ p: 2 }}>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 600,
              mb: 0.5,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {title}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            {author}
          </Typography>
          <Box sx={{ mb: 1 }}>
            <LinearProgress
              variant="determinate"
              value={progress_percent}
              sx={{
                height: 6,
                borderRadius: 3,
                backgroundColor: tokens.colors.neutral[200],
                '& .MuiLinearProgress-bar': {
                  backgroundColor: tokens.colors.primary,
                },
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {Math.round(progress_percent)}%
            </Typography>
          </Box>
          {onContinue && (
            <Button
              size="small"
              variant="contained"
              fullWidth
              onClick={(e) => {
                e.stopPropagation();
                onContinue(content_id, last_position);
              }}
              sx={{
                backgroundColor: tokens.colors.primary,
                '&:hover': {
                  backgroundColor: tokens.colors.primaryDark,
                },
              }}
            >
              Reprendre
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // Variant: Vertical (120px width, for grids)
  if (variant === 'vertical') {
    return (
      <Card
        sx={{
          width: 120,
          cursor: 'pointer',
          transition: 'transform 0.2s, box-shadow 0.2s',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: 4,
          },
        }}
        onClick={onClick}
      >
        <CardMedia
          component="img"
          height="180"
          image={cover_url || '/placeholder-cover.jpg'}
          alt={title}
          sx={{ objectFit: 'cover' }}
        />
        <CardContent sx={{ p: 1 }}>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {title}
          </Typography>
          <Box sx={{ mt: 1 }}>
            <LinearProgress
              variant="determinate"
              value={progress_percent}
              sx={{
                height: 4,
                borderRadius: 2,
                backgroundColor: tokens.colors.neutral[200],
                '& .MuiLinearProgress-bar': {
                  backgroundColor: tokens.colors.primary,
                },
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
              {Math.round(progress_percent)}%
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  // Variant: List (full width, for history page)
  return (
    <Card
      sx={{
        display: 'flex',
        mb: 2,
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateX(4px)',
          boxShadow: 3,
        },
      }}
      onClick={onClick}
    >
      <CardMedia
        component="img"
        sx={{ width: 120, minHeight: 180, objectFit: 'cover' }}
        image={cover_url || '/placeholder-cover.jpg'}
        alt={title}
      />
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <CardContent sx={{ flex: '1 0 auto', pb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
            <Box sx={{ flex: 1 }}>
              <Typography
                variant="h6"
                sx={{
                  fontFamily: tokens.typography.fontFamilies.heading,
                  fontWeight: 600,
                  mb: 0.5,
                }}
              >
                {title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {author}
              </Typography>
            </Box>
            <Chip
              icon={typeInfo.icon}
              label={typeInfo.label}
              size="small"
              sx={{
                backgroundColor: `${typeInfo.color}20`,
                color: typeInfo.color,
                fontWeight: 500,
              }}
            />
          </Box>

          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                Progression
              </Typography>
              <Typography variant="caption" fontWeight={600} color={tokens.colors.primary}>
                {Math.round(progress_percent)}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={progress_percent}
              sx={{
                height: 8,
                borderRadius: 4,
                backgroundColor: tokens.colors.neutral[200],
                '& .MuiLinearProgress-bar': {
                  backgroundColor: tokens.colors.primary,
                  borderRadius: 4,
                },
              }}
            />
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              Dernière lecture : {formatDate(last_read_at)}
            </Typography>
            {is_completed && (
              <Chip
                label="Terminé"
                size="small"
                sx={{
                  backgroundColor: tokens.colors.semantic.success,
                  color: 'white',
                  fontWeight: 500,
                  fontSize: 11,
                }}
              />
            )}
          </Box>
        </CardContent>

        {onContinue && !is_completed && (
          <Box sx={{ p: 2, pt: 0 }}>
            <Button
              variant="contained"
              fullWidth
              onClick={(e) => {
                e.stopPropagation();
                onContinue(content_id, last_position);
              }}
              sx={{
                backgroundColor: tokens.colors.primary,
                '&:hover': {
                  backgroundColor: tokens.colors.primaryDark,
                },
              }}
            >
              Reprendre la lecture
            </Button>
          </Box>
        )}
      </Box>
    </Card>
  );
};

export default ContentCardWithProgress;
