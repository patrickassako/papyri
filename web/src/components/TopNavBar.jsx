import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
  Avatar,
  InputAdornment,
  TextField,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import FavoriteOutlinedIcon from '@mui/icons-material/FavoriteOutlined';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import tokens from '../config/tokens';
import NotificationBell from './NotificationBell';
import papyriWordmark from '../assets/papyri-wordmark-150x50.png';
import * as authService from '../services/auth.service';

const navLinks = [
  { label: 'Bibliothèque', path: '/catalogue' },
  { label: 'Explorer', path: '/catalogue' },
  { label: 'Historique', path: '/history' },
  { label: 'Favoris', path: '/my-list' },
];

export default function TopNavBar({
  user,
  searchPlaceholder = 'Rechercher un titre...',
  searchValue = '',
  onSearchChange,
  onSearch,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [anchorEl, setAnchorEl] = useState(null);
  const menuOpen = Boolean(anchorEl);

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      const q = e.target.value.trim();
      if (onSearch) {
        onSearch(q);
      } else {
        navigate(`/catalogue${q ? `?q=${encodeURIComponent(q)}` : ''}`);
      }
    }
  };

  const handleAvatarClick = (e) => {
    setAnchorEl(e.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleMenuNav = (path) => {
    handleMenuClose();
    navigate(path);
  };

  const handleLogout = async () => {
    handleMenuClose();
    await authService.logout();
    navigate('/login');
  };

  return (
    <Box
      component="header"
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        bgcolor: 'rgba(252, 250, 248, 0.95)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid #f4efe7',
        px: { xs: 2, md: 4 },
        py: 1.5,
      }}
    >
      <Box
        sx={{
          maxWidth: 1280,
          mx: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
        }}
      >
        {/* Left: Logo + Nav */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 2, md: 4 } }}>
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer' }}
            onClick={() => navigate('/dashboard')}
          >
            <Box
              component="img"
              src={papyriWordmark}
              alt="Papyri"
              sx={{ width: '150px', height: '50px', objectFit: 'contain', objectPosition: 'left center', display: 'block' }}
            />
          </Box>

          <Box component="nav" sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 4.5 }}>
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <Typography
                  key={link.label}
                  component="a"
                  onClick={(e) => { e.preventDefault(); navigate(link.path); }}
                  href={link.path}
                  sx={{
                    fontSize: '0.875rem',
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? '#f29e0d' : tokens.colors.onBackground.light,
                    textDecoration: 'none',
                    cursor: 'pointer',
                    transition: 'color 0.2s',
                    '&:hover': { color: '#f29e0d' },
                  }}
                >
                  {link.label}
                </Typography>
              );
            })}
          </Box>
        </Box>

        {/* Right: Search + Notif + Avatar */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <TextField
            size="small"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            autoComplete="off"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: '#9c7e49', fontSize: 18 }} />
                </InputAdornment>
              ),
            }}
            sx={{
              width: { xs: 160, sm: 220, md: 280 },
              '& .MuiOutlinedInput-root': {
                borderRadius: '12px',
                bgcolor: '#f4efe7',
                fontSize: '0.875rem',
                '& fieldset': { border: 'none' },
                '&:hover fieldset': { border: '1px solid #d4c9b8' },
                '&.Mui-focused fieldset': { border: `1.5px solid ${tokens.colors.primary}` },
              },
              '& input': { py: '8px' },
            }}
          />

          <NotificationBell />

          <Avatar
            src={user?.avatar_url}
            sx={{
              width: 38,
              height: 38,
              bgcolor: tokens.colors.primary,
              cursor: 'pointer',
              border: menuOpen ? `2px solid ${tokens.colors.primary}` : '2px solid rgba(242, 158, 13, 0.2)',
              flexShrink: 0,
              transition: 'border-color 0.2s',
            }}
            onClick={handleAvatarClick}
          >
            {user?.full_name?.[0]?.toUpperCase() || 'U'}
          </Avatar>
        </Box>
      </Box>

      {/* Profile dropdown menu */}
      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        slotProps={{
          paper: {
            elevation: 0,
            sx: {
              mt: 1,
              minWidth: 220,
              borderRadius: '14px',
              border: '1px solid #f0e8dc',
              boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
              overflow: 'visible',
              '&::before': {
                content: '""',
                display: 'block',
                position: 'absolute',
                top: -6,
                right: 18,
                width: 12,
                height: 12,
                bgcolor: 'background.paper',
                borderTop: '1px solid #f0e8dc',
                borderLeft: '1px solid #f0e8dc',
                transform: 'rotate(45deg)',
                zIndex: 0,
              },
            },
          },
        }}
      >
        {/* User info header */}
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#3d2c1e' }}>
            {user?.full_name || 'Utilisateur'}
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: '#9c7e49' }}>
            {user?.email || ''}
          </Typography>
        </Box>

        <Divider sx={{ borderColor: '#f0e8dc' }} />

        <MenuItem onClick={() => handleMenuNav('/dashboard')} sx={menuItemSx}>
          <ListItemIcon><DashboardOutlinedIcon sx={{ fontSize: 18, color: '#9c7e49' }} /></ListItemIcon>
          <ListItemText primary="Tableau de bord" primaryTypographyProps={{ fontSize: '0.875rem' }} />
        </MenuItem>

        <MenuItem onClick={() => handleMenuNav('/my-list')} sx={menuItemSx}>
          <ListItemIcon><FavoriteOutlinedIcon sx={{ fontSize: 18, color: '#9c7e49' }} /></ListItemIcon>
          <ListItemText primary="Ma liste" primaryTypographyProps={{ fontSize: '0.875rem' }} />
        </MenuItem>

        <MenuItem onClick={() => handleMenuNav('/notifications')} sx={menuItemSx}>
          <ListItemIcon><NotificationsOutlinedIcon sx={{ fontSize: 18, color: '#9c7e49' }} /></ListItemIcon>
          <ListItemText primary="Notifications" primaryTypographyProps={{ fontSize: '0.875rem' }} />
        </MenuItem>

        <MenuItem onClick={() => handleMenuNav('/profile')} sx={menuItemSx}>
          <ListItemIcon><PersonOutlinedIcon sx={{ fontSize: 18, color: '#9c7e49' }} /></ListItemIcon>
          <ListItemText primary="Mon profil" primaryTypographyProps={{ fontSize: '0.875rem' }} />
        </MenuItem>

        <Divider sx={{ borderColor: '#f0e8dc' }} />

        <MenuItem onClick={handleLogout} sx={{ ...menuItemSx, color: '#c0392b', '& .MuiListItemIcon-root': { color: '#c0392b' } }}>
          <ListItemIcon><LogoutIcon sx={{ fontSize: 18 }} /></ListItemIcon>
          <ListItemText primary="Déconnexion" primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 600 }} />
        </MenuItem>
      </Menu>
    </Box>
  );
}

const menuItemSx = {
  px: 2,
  py: 1,
  mx: 0.5,
  borderRadius: '8px',
  color: '#3d2c1e',
  '&:hover': { bgcolor: '#faf5ee' },
};
