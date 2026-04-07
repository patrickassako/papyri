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

/**
 * Carte de contenu pour le catalogue
 */
export default function ContentCard({ content, hasActiveSubscription = false }) {
  const navigate = useNavigate();
  const { formatFrom } = useCurrency();

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

          {(() => {
            const baseCents = content.localized_price?.price_cents ?? content.price_cents;
            const currency = content.localized_price?.currency || content.price_currency || 'EUR';
            if (!baseCents || Number(baseCents) <= 0) return null;
            const renderPrice = (cents) => formatFrom(cents, currency);

            const discountPct = Number(
              (hasActiveSubscription ? content.subscriber_discount_percent : 0) ?? 0
            );
            const discountedCents = content.discounted_price_cents ?? (
              discountPct > 0
                ? Math.max(0, Math.round(Number(baseCents) * (100 - discountPct) / 100))
                : Number(baseCents)
            );
            const hasDiscount = discountPct > 0 && discountedCents < Number(baseCents);

            return (
              <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                <Chip
                  label={renderPrice(hasDiscount ? discountedCents : baseCents)}
                  size="small"
                  sx={{
                    fontWeight: 700,
                    height: 'auto',
                    maxWidth: '100%',
                    bgcolor: hasDiscount ? '#fff8e1' : undefined,
                    color: hasDiscount ? '#b5651d' : undefined,
                    '& .MuiChip-label': {
                      display: 'block',
                      whiteSpace: 'normal',
                      overflowWrap: 'anywhere',
                      paddingTop: '4px',
                      paddingBottom: '4px',
                    },
                  }}
                />
                {hasDiscount && (
                  <>
                    <Typography variant="caption" sx={{ textDecoration: 'line-through', color: 'text.disabled' }}>
                      {renderPrice(baseCents)}
                    </Typography>
                    <Chip
                      label={`-${discountPct}%`}
                      size="small"
                      sx={{ bgcolor: '#e8f5e9', color: '#2e7d32', fontWeight: 700, fontSize: '10px', height: 18 }}
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
