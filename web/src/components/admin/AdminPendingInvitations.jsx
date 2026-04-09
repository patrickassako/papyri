import React from 'react';
import {
  Box,
  Card,
  IconButton,
  Chip,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import tokens from '../../config/tokens';

const C = { primary: tokens.colors.primary, red: '#e74c3c', indigo: tokens.colors.accent };

export default function AdminPendingInvitations({ invitations, roleOpts, onCancel, onResend }) {
  const pending = invitations.filter((item) => !item.accepted_at);
  if (!pending.length) return null;

  return (
    <Box sx={{ mb: 3 }}>
      <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: C.indigo, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <MailOutlineIcon sx={{ fontSize: 16 }} />
        Invitations en attente ({pending.length})
      </Typography>
      <Card sx={{ borderRadius: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        {pending.map((invitation, idx) => {
          const roleOpt = roleOpts.find((role) => role.value === invitation.role);
          const isExpired = new Date(invitation.expires_at) < new Date();
          return (
            <Box
              key={invitation.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                px: 2.5,
                py: 1.5,
                borderBottom: idx < pending.length - 1 ? '1px solid #f5f5f5' : 'none',
                bgcolor: isExpired ? '#fff9f9' : 'white',
              }}
            >
              <MailOutlineIcon sx={{ fontSize: 18, color: isExpired ? '#e74c3c' : '#bbb', flexShrink: 0 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {invitation.email}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
                  <Chip
                    label={roleOpt?.label || invitation.role}
                    size="small"
                    sx={{ height: 18, fontSize: '10px', fontWeight: 700, bgcolor: roleOpt?.bg || '#f5f5f5', color: roleOpt?.color || '#666' }}
                  />
                  <Typography variant="caption" sx={{ color: isExpired ? '#e74c3c' : '#bbb' }}>
                    {isExpired ? 'Expirée' : `Expire le ${new Date(invitation.expires_at).toLocaleDateString('fr-FR')}`}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                <Tooltip title="Renvoyer l'invitation">
                  <IconButton size="small" onClick={() => onResend(invitation)} sx={{ color: C.indigo, '&:hover': { bgcolor: '#e8eaf6' } }}>
                    <RefreshOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Annuler l'invitation">
                  <IconButton size="small" onClick={() => onCancel(invitation)} sx={{ color: C.red, '&:hover': { bgcolor: '#ffebee' } }}>
                    <DeleteOutlineOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          );
        })}
      </Card>
    </Box>
  );
}
