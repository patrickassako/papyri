import React from 'react';
import { Chip } from '@mui/material';
import tokens from '../../config/tokens';

const C = {
  indigo: tokens.colors.accent,
  or: tokens.colors.secondary,
  purple: '#7b1fa2',
};

function getRoleStyle(name) {
  if (name === 'admin') return { color: C.purple, bg: '#ede7f6' };
  if (name === 'publisher') return { color: C.or, bg: '#fff8e1' };
  if (name === 'user') return { color: '#666', bg: '#f5f5f5' };
  return { color: C.indigo, bg: '#e8eaf6' };
}

export default function AdminRoleChip({ role, roleOpts, size = 'small' }) {
  const roleOption = roleOpts?.find((item) => item.value === role);
  const style = roleOption ? { color: roleOption.color, bg: roleOption.bg } : getRoleStyle(role);
  const label = roleOption ? roleOption.label : role;

  return (
    <Chip
      label={label}
      size={size}
      sx={{
        bgcolor: style.bg,
        color: style.color,
        fontWeight: 700,
        fontSize: '11px',
        height: 22,
      }}
    />
  );
}
