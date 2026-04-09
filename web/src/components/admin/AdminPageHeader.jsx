import React from 'react';
import { Box, Typography } from '@mui/material';
import tokens from '../../config/tokens';

export default function AdminPageHeader({ title, subtitle, actions = null, sx = {} }) {
  return (
    <Box
      sx={{
        mb: 4,
        display: 'flex',
        alignItems: { xs: 'flex-start', md: 'center' },
        justifyContent: 'space-between',
        gap: 2,
        flexWrap: 'wrap',
        ...sx,
      }}
    >
      <Box>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 800,
            color: tokens.colors.accent,
            fontFamily: 'Playfair Display, serif',
            mb: 0.5,
          }}
        >
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="body2" sx={{ color: '#888' }}>
            {subtitle}
          </Typography>
        ) : null}
      </Box>
      {actions ? <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>{actions}</Box> : null}
    </Box>
  );
}
