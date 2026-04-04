import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, Typography, Avatar, Button, Badge } from '@mui/material';
import DashboardOutlined from '@mui/icons-material/DashboardOutlined';
import AutoStoriesOutlined from '@mui/icons-material/AutoStoriesOutlined';
import AddCircleOutlined from '@mui/icons-material/AddCircleOutlined';
import AccountBalanceWalletOutlined from '@mui/icons-material/AccountBalanceWalletOutlined';
import LocalOfferOutlined from '@mui/icons-material/LocalOfferOutlined';
import PersonOutlined from '@mui/icons-material/PersonOutlined';
import LogoutOutlined from '@mui/icons-material/LogoutOutlined';
import SupportAgentOutlined from '@mui/icons-material/SupportAgentOutlined';
import BarChartOutlined from '@mui/icons-material/BarChartOutlined';
import NotificationsNoneOutlined from '@mui/icons-material/NotificationsNoneOutlined';
import tokens from '../config/tokens';
import * as authService from '../services/auth.service';
import { getNotifications, markAllAsRead } from '../services/notifications.service';

const navItems = [
  { label: 'Tableau de bord', icon: DashboardOutlined, route: '/publisher/dashboard' },
  { label: 'Mes livres', icon: AutoStoriesOutlined, route: '/publisher/books' },
  { label: 'Ajouter un livre', icon: AddCircleOutlined, route: '/publisher/books/new' },
  { label: 'Revenus', icon: AccountBalanceWalletOutlined, route: '/publisher/revenue' },
  { label: 'Statistiques', icon: BarChartOutlined, route: '/publisher/stats' },
  { label: 'Codes promo', icon: LocalOfferOutlined, route: '/publisher/promo-codes' },
  { label: 'Mon profil', icon: PersonOutlined, route: '/publisher/profile' },
  { label: 'Réclamations', icon: SupportAgentOutlined, route: '/publisher/claims' },
];

export default function PublisherSidebar({ publisher, user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [unread, setUnread] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);

  useEffect(() => {
    getNotifications({ limit: 10 })
      .then(d => { setUnread(d.unreadCount); setNotifs(d.notifications); })
      .catch(() => {});
    const iv = setInterval(() => {
      getNotifications({ limit: 10 })
        .then(d => { setUnread(d.unreadCount); setNotifs(d.notifications); })
        .catch(() => {});
    }, 60000);
    return () => clearInterval(iv);
  }, []);

  const handleOpenNotifs = async () => {
    setNotifOpen(v => !v);
    if (!notifOpen && unread > 0) {
      try { await markAllAsRead(); setUnread(0); } catch (_) {}
    }
  };

  const handleLogout = async () => {
    try { await authService.logout(); } catch (e) { console.error(e); }
  };

  const displayName = publisher?.company_name || user?.full_name || 'Éditeur';
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <Box
      sx={{
        width: 220,
        position: 'sticky',
        top: 0,
        height: '100vh',
        bgcolor: '#fff',
        borderRight: `1px solid ${tokens.colors.surfaces.light.variant}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
        zIndex: 10,
      }}
    >
      {/* En-tête */}
      <Box sx={{ p: 3, textAlign: 'center', borderBottom: `1px solid ${tokens.colors.surfaces.light.variant}` }}>
        <Avatar
          src={publisher?.logo_url}
          sx={{
            width: 72,
            height: 72,
            bgcolor: tokens.colors.primary,
            fontSize: '1.8rem',
            color: '#fff',
            fontWeight: 700,
            mx: 'auto',
            mb: 1.5,
          }}
        >
          {initials}
        </Avatar>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: tokens.colors.onBackground.light, lineHeight: 1.3 }}>
          {displayName}
        </Typography>
        <Typography variant="caption" sx={{ color: '#9c7e49' }}>
          Espace éditeur
        </Typography>
      </Box>

      {/* Navigation */}
      <Box sx={{ flex: 1, p: 2, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.route || location.pathname.startsWith(item.route + '/');
          return (
            <Button
              key={item.route}
              onClick={() => navigate(item.route)}
              startIcon={<Icon />}
              fullWidth
              sx={{
                justifyContent: 'flex-start',
                borderRadius: '12px',
                px: 2,
                py: 1.25,
                textTransform: 'none',
                fontSize: '0.9rem',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? tokens.colors.primary : tokens.colors.onBackground.light,
                bgcolor: isActive ? `${tokens.colors.primary}1A` : 'transparent',
                '&:hover': {
                  bgcolor: isActive ? `${tokens.colors.primary}1A` : tokens.colors.surfaces.light.variant,
                },
                gap: 1,
              }}
            >
              {item.label}
            </Button>
          );
        })}
      </Box>

      {/* Pied de page */}
      <Box sx={{ p: 2, borderTop: `1px solid ${tokens.colors.surfaces.light.variant}` }}>

        {/* Cloche notifications */}
        <Button
          onClick={handleOpenNotifs}
          startIcon={
            <Badge badgeContent={unread} color="error" max={99}>
              <NotificationsNoneOutlined />
            </Badge>
          }
          fullWidth
          sx={{
            justifyContent: 'flex-start', borderRadius: '12px', px: 2, py: 1.25,
            textTransform: 'none', fontSize: '0.9rem', fontWeight: 500,
            color: notifOpen ? tokens.colors.primary : tokens.colors.onBackground.light,
            bgcolor: notifOpen ? `${tokens.colors.primary}1A` : 'transparent',
            '&:hover': { bgcolor: `${tokens.colors.primary}1A` },
            gap: 1, mb: 0.5,
          }}
        >
          Notifications
        </Button>

        {/* Panneau notifications inline */}
        {notifOpen && (
          <Box sx={{ mb: 1, borderRadius: '12px', border: '1px solid #f0ede8', overflow: 'hidden', bgcolor: '#fafafa' }}>
            {notifs.length === 0 ? (
              <Box sx={{ p: 2, fontSize: '0.78rem', color: '#9ca3af', textAlign: 'center' }}>
                Aucune notification
              </Box>
            ) : (
              notifs.slice(0, 5).map(n => (
                <Box key={n.id} sx={{
                  p: '10px 12px', borderBottom: '1px solid #f0ede8',
                  '&:last-child': { borderBottom: 'none' },
                  bgcolor: n.read_at ? 'transparent' : `${tokens.colors.primary}08`,
                }}>
                  <Box sx={{ fontSize: '0.78rem', fontWeight: n.read_at ? 400 : 700, color: '#374151', mb: 0.25, lineHeight: 1.4 }}>
                    {n.title}
                  </Box>
                  {n.body && (
                    <Box sx={{ fontSize: '0.72rem', color: '#9ca3af', lineHeight: 1.3 }}>{n.body}</Box>
                  )}
                </Box>
              ))
            )}
          </Box>
        )}

        <Button
          onClick={handleLogout}
          startIcon={<LogoutOutlined />}
          fullWidth
          sx={{
            justifyContent: 'flex-start', borderRadius: '12px', px: 2, py: 1.25,
            textTransform: 'none', fontSize: '0.9rem', fontWeight: 500,
            color: tokens.colors.semantic.error,
            '&:hover': { bgcolor: `${tokens.colors.semantic.error}0D` },
            gap: 1,
          }}
        >
          Déconnexion
        </Button>
      </Box>
    </Box>
  );
}
