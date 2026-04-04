import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, IconButton, Avatar, Menu, MenuItem, Divider, Tooltip } from '@mui/material';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import AdminPublisherSidebar from './AdminPublisherSidebar';
import * as authService from '../services/auth.service';
import tokens from '../config/tokens';

function AdminHeader() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [anchor, setAnchor] = useState(null);

  useEffect(() => {
    authService.getUser().then(setUser).catch(() => {});
  }, []);

  async function handleLogout() {
    await authService.logout();
    navigate('/login');
  }

  const initials = user?.full_name
    ? user.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : user?.email?.charAt(0).toUpperCase() || 'A';

  return (
    <Box
      sx={{
        height: 56,
        bgcolor: '#fff',
        borderBottom: '1px solid #eee',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        px: 3,
        gap: 1,
        flexShrink: 0,
      }}
    >
      {user && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ color: '#666', display: { xs: 'none', sm: 'block' } }}>
            {user.full_name || user.email}
          </Typography>
          <Tooltip title="Compte">
            <IconButton size="small" onClick={e => setAnchor(e.currentTarget)}>
              <Avatar sx={{ width: 32, height: 32, bgcolor: tokens.colors.primary, fontSize: 13, fontWeight: 700 }}>
                {initials}
              </Avatar>
            </IconButton>
          </Tooltip>
        </Box>
      )}

      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{ sx: { mt: 1, minWidth: 200, borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' } }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>{user?.full_name || '—'}</Typography>
          <Typography variant="caption" sx={{ color: '#999' }}>{user?.email}</Typography>
        </Box>
        <Divider />
        <MenuItem onClick={() => { setAnchor(null); navigate('/profile'); }} sx={{ gap: 1.5, py: 1.2 }}>
          <PersonOutlinedIcon fontSize="small" sx={{ color: '#666' }} />
          <Typography variant="body2">Mon profil</Typography>
        </MenuItem>
        <MenuItem onClick={() => { setAnchor(null); handleLogout(); }} sx={{ gap: 1.5, py: 1.2, color: '#e53935' }}>
          <LogoutOutlinedIcon fontSize="small" />
          <Typography variant="body2">Déconnexion</Typography>
        </MenuItem>
      </Menu>
    </Box>
  );
}

export default function AdminPublisherLayout({ children }) {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#F5F5F5' }}>
      <AdminPublisherSidebar />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <AdminHeader />
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
