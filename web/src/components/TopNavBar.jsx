import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
  Avatar,
  InputBase,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import tokens from '../config/tokens';

const navLinks = [
  { label: 'Bibliothèque', path: '/catalogue' },
  { label: 'Explorer', path: '/catalogue' },
  { label: 'Historique', path: '/history' },
  { label: 'Favoris', path: '/my-list' },
];

export default function TopNavBar({ user, searchPlaceholder = 'Rechercher un titre...' }) {
  const navigate = useNavigate();
  const location = useLocation();

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
            <AutoStoriesIcon sx={{ fontSize: 28, color: '#f29e0d' }} />
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.015em', color: tokens.colors.onBackground.light }}>
              Emoti Num&eacute;rique
            </Typography>
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

        {/* Right: Search + Avatar */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Box
            sx={{
              display: { xs: 'none', md: 'flex' },
              alignItems: 'center',
              bgcolor: '#f4efe7',
              borderRadius: '12px',
              px: 2,
              height: 40,
              minWidth: 210,
              maxWidth: 280,
            }}
          >
            <SearchIcon sx={{ color: '#9c7e49', fontSize: 20, mr: 1 }} />
            <InputBase
              placeholder={searchPlaceholder}
              sx={{ fontSize: '0.875rem', color: tokens.colors.onBackground.light, flex: 1 }}
            />
          </Box>

          <Avatar
            src={user?.avatar_url}
            sx={{
              width: 40,
              height: 40,
              bgcolor: tokens.colors.primary,
              cursor: 'pointer',
              border: '2px solid rgba(242, 158, 13, 0.2)',
            }}
            onClick={() => navigate('/profile')}
          >
            {user?.full_name?.[0]?.toUpperCase() || 'U'}
          </Avatar>
        </Box>
      </Box>
    </Box>
  );
}
