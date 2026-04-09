import React from 'react';
import { Box, Typography } from '@mui/material';

export default function AdminSection({ title, subtitle = '', actions = null, children, sx = {} }) {
  return (
    <Box sx={{ mb: 4, ...sx }}>
      {(title || actions) ? (
        <Box
          sx={{
            mb: 1.5,
            display: 'flex',
            alignItems: { xs: 'flex-start', md: 'center' },
            justifyContent: 'space-between',
            gap: 1.5,
            flexWrap: 'wrap',
          }}
        >
          <Box>
            {title ? (
              <Typography
                variant="overline"
                sx={{
                  color: '#999',
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  display: 'block',
                }}
              >
                {title}
              </Typography>
            ) : null}
            {subtitle ? (
              <Typography variant="body2" sx={{ color: '#777', mt: 0.25 }}>
                {subtitle}
              </Typography>
            ) : null}
          </Box>
          {actions}
        </Box>
      ) : null}
      {children}
    </Box>
  );
}
