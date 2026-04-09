import React from 'react';
import { Box, Typography } from '@mui/material';

export default function AdminEmptyState({ title = 'Aucune donnée', subtitle = '', description = '' }) {
  const text = description || subtitle;
  return (
    <Box
      sx={{
        py: 4,
        px: 2,
        textAlign: 'center',
        borderRadius: '16px',
        border: '1px dashed #ddd',
        bgcolor: '#fff',
      }}
    >
      <Typography variant="body1" sx={{ color: '#666', fontWeight: 700 }}>
        {title}
      </Typography>
      {text ? (
        <Typography variant="body2" sx={{ color: '#999', mt: 0.75 }}>
          {text}
        </Typography>
      ) : null}
    </Box>
  );
}
