import React from 'react';
import { Box, Chip, LinearProgress, Typography } from '@mui/material';
import tokens from '../../config/tokens';

const C = {
  primary: tokens.colors.primary,
  green: '#27ae60',
  blue: '#2196F3',
};

function ProgressBar({ percent }) {
  const pct = Math.min(100, Math.max(0, Number(percent) || 0));
  const color = pct >= 100 ? C.green : pct >= 50 ? C.blue : C.primary;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          flex: 1,
          height: 6,
          borderRadius: 3,
          bgcolor: `${color}22`,
          '& .MuiLinearProgress-bar': { bgcolor: color },
        }}
      />
      <Typography variant="caption" sx={{ fontWeight: 700, color, minWidth: 34 }}>
        {pct.toFixed(0)}%
      </Typography>
    </Box>
  );
}

function formatTime(sec) {
  if (!sec) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`;
}

export default function AdminUserHistoryTab({ history }) {
  if (!history.length) {
    return (
      <Typography variant="body2" sx={{ color: '#aaa', textAlign: 'center', py: 3 }}>
        Aucune lecture enregistrée
      </Typography>
    );
  }

  return (
    <Box>
      {history.map((item) => {
        const content = item.contents;
        return (
          <Box
            key={item.id}
            sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, py: 1.5, borderBottom: '1px solid #f5f5f5' }}
          >
            {content?.cover_url ? (
              <img src={content.cover_url} alt="" style={{ width: 28, height: 40, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
            ) : (
              <Box sx={{ width: 28, height: 40, bgcolor: '#eee', borderRadius: '4px', flexShrink: 0 }} />
            )}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="body2"
                sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {content?.title || '—'}
              </Typography>
              <ProgressBar percent={item.progress_percent} />
              <Box sx={{ display: 'flex', gap: 1.5, mt: 0.5 }}>
                <Typography variant="caption" sx={{ color: '#aaa' }}>
                  {formatTime(item.total_time_seconds)}
                </Typography>
                <Typography variant="caption" sx={{ color: '#aaa' }}>
                  {item.last_read_at ? new Date(item.last_read_at).toLocaleDateString('fr-FR') : ''}
                </Typography>
                {item.is_completed && (
                  <Chip
                    label="Terminé"
                    size="small"
                    sx={{ bgcolor: '#e8f5e9', color: C.green, fontWeight: 700, fontSize: '10px', height: 16 }}
                  />
                )}
              </Box>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
