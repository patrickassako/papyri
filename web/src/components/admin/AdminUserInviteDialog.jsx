import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import tokens from '../../config/tokens';
import * as adminService from '../../services/admin.service';

export default function AdminUserInviteDialog({ open, onClose, roleOpts, onInvited }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (open) {
      setEmail('');
      setRole('user');
      setMsg(null);
    }
  }, [open]);

  async function send() {
    if (!email.trim()) return;
    setSending(true);
    setMsg(null);
    try {
      await adminService.sendInvitation(email.trim(), role);
      setMsg({ type: 'success', text: `Invitation envoyée à ${email.trim()}` });
      onInvited();
      setTimeout(() => { onClose(); setMsg(null); }, 1500);
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}>
      <DialogTitle sx={{ fontWeight: 800, fontSize: '1.05rem', pb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <PersonAddOutlinedIcon sx={{ color: tokens.colors.primary }} />
        Inviter un utilisateur
      </DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        {msg && (
          <Alert severity={msg.type === 'error' ? 'error' : 'success'} sx={{ mb: 2, borderRadius: '10px' }} onClose={() => setMsg(null)}>
            {msg.text}
          </Alert>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Adresse email"
            size="small"
            fullWidth
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="exemple@email.com"
            onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
          />
          <FormControl size="small" fullWidth>
            <Typography variant="caption" sx={{ mb: 0.5, color: '#888', fontWeight: 600 }}>Rôle assigné</Typography>
            <Select value={role} onChange={(e) => setRole(e.target.value)} sx={{ borderRadius: '10px' }}>
              {roleOpts.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: option.color }} />
                    {option.label}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography variant="caption" sx={{ color: '#aaa', lineHeight: 1.5 }}>
            L'utilisateur recevra un email avec un lien pour créer son mot de passe.
            Le lien expire dans 7 jours.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} sx={{ borderRadius: '10px', textTransform: 'none', color: '#666' }}>
          Annuler
        </Button>
        <Button
          onClick={send}
          variant="contained"
          disabled={sending || !email.trim()}
          startIcon={sending ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : <SendOutlinedIcon />}
          sx={{ borderRadius: '10px', textTransform: 'none', bgcolor: tokens.colors.primary, '&:hover': { bgcolor: '#9a4f15' } }}
        >
          Envoyer l'invitation
        </Button>
      </DialogActions>
    </Dialog>
  );
}
