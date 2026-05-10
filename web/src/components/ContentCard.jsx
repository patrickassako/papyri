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
import { useCurrency } from '../hooks/useCurrency';
import { stripRichText } from '../utils/richText';

/**
 * Carte de contenu pour le catalogue
 */
export default function ContentCard({ content, hasActiveSubscription = false }) {
  const navigate = useNavigate();
  const { formatFrom } = useCurrency();
  const plainDescription = stripRichText(content.description);

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
            {plainDescription}
          </Typography>

          {content.content_type === 'audiobook' && content.duration_seconds && (
            <Typography variant="caption" color="text.secondary">
              Durée : {formatDuration(content.duration_seconds)}
            </Typography>
          )}

          {(() => {
            const baseCents = content.localized_price?.price_cents ?? content.price_cents;
            const currency = content.localized_price?.currency || content.price_currency || 'CAD';
            if (!baseCents || Number(baseCents) <= 0) return null;
            const renderPrice = (cents) => formatFrom(cents, currency);

            // For non-subscribers the backend returns discounted_price_cents = base * (1 + markup/100).
            // For subscribers it returns the base price as-is. Show the final price; if there's a markup
            // (i.e. the user is not subscribed) cross out the subscriber price next to it as a teaser.
            const finalCents = Number(content.discounted_price_cents ?? baseCents);
            const markupPct = Number(content.subscriber_discount_percent ?? 0);
            const hasMarkup = !hasActiveSubscription && markupPct > 0 && finalCents > Number(baseCents);

            return (
              <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                <Chip
                  label={renderPrice(finalCents)}
                  size="small"
                  sx={{
                    fontWeight: 700,
                    height: 'auto',
                    maxWidth: '100%',
                    bgcolor: hasMarkup ? '#fff8e1' : undefined,
                    color: hasMarkup ? '#b5651d' : undefined,
                    '& .MuiChip-label': {
                      display: 'block',
                      whiteSpace: 'normal',
                      overflowWrap: 'anywhere',
                      paddingTop: '4px',
                      paddingBottom: '4px',
                    },
                  }}
                />
                {hasMarkup && (
                  <>
                    <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                      {renderPrice(baseCents)} ·
                    </Typography>
                    <Chip
                      label={`+${markupPct}%`}
                      size="small"
                      sx={{ bgcolor: '#fbe9e7', color: '#c84315', fontWeight: 700, fontSize: '10px', height: 18 }}
                    />
                  </>
                )}
              </Box>
            );
          })()}
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
