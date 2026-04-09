import React from 'react';
import { Chip } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';

const C = {
  green: '#27ae60',
  red: '#e74c3c',
};

export default function AdminActiveStatusChip({ active, activeLabel = 'Actif', inactiveLabel = 'Bloqué', size = 'small' }) {
  return (
    <Chip
      label={active ? activeLabel : inactiveLabel}
      size={size}
      icon={
        active
          ? <CheckCircleOutlineIcon sx={{ fontSize: '13px !important' }} />
          : <BlockOutlinedIcon sx={{ fontSize: '13px !important' }} />
      }
      sx={{
        bgcolor: active ? '#e8f5e9' : '#ffebee',
        color: active ? C.green : C.red,
        fontWeight: 700,
        fontSize: '11px',
        height: 22,
      }}
    />
  );
}
