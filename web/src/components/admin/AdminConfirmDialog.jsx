import React from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import tokens from '../../config/tokens';

export default function AdminConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  onCancel,
  onConfirm,
}) {
  return (
    <Dialog open={open} onClose={onCancel} PaperProps={{ sx: { borderRadius: '16px', p: 1 } }}>
      <DialogTitle sx={{ fontWeight: 800, fontSize: '1rem', pb: 0.5 }}>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ fontSize: '0.875rem', color: '#555' }}>{body}</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onCancel} sx={{ borderRadius: '10px', textTransform: 'none', color: '#666' }}>
          {cancelLabel}
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          autoFocus
          sx={{ borderRadius: '10px', textTransform: 'none', bgcolor: tokens.colors.primary, '&:hover': { bgcolor: '#9a4f15' } }}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
