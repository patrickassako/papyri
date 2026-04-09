import React from 'react';
import { Box, Card, CardContent, Skeleton, Typography } from '@mui/material';

export default function AdminStatCard({
  icon,
  label,
  value,
  sub,
  color,
  loading = false,
  onClick = null,
}) {
  return (
    <Card
      onClick={onClick}
      sx={{
        borderRadius: '16px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.15s, box-shadow 0.15s',
        '&:hover': onClick ? { transform: 'translateY(-2px)', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' } : {},
      }}
    >
      <CardContent sx={{ p: 3 }}>
        {loading ? (
          <>
            <Skeleton variant="rounded" width={44} height={44} sx={{ mb: 2 }} />
            <Skeleton width="60%" height={32} sx={{ mb: 0.5 }} />
            <Skeleton width="40%" height={20} />
          </>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            <Box sx={{ bgcolor: `${color}1A`, borderRadius: '12px', p: 1.5, display: 'flex', flexShrink: 0 }}>
              {React.cloneElement(icon, { sx: { color, fontSize: 26 } })}
            </Box>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#1a1a2e', lineHeight: 1.1 }}>
                {value?.toLocaleString?.('fr-FR') ?? value ?? '—'}
              </Typography>
              <Typography variant="body2" sx={{ color: '#666', mt: 0.5, fontWeight: 500 }}>
                {label}
              </Typography>
              {sub ? (
                <Typography variant="caption" sx={{ color: '#999', display: 'block', mt: 0.25 }}>
                  {sub}
                </Typography>
              ) : null}
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
