/**
 * NotificationBell — Icône cloche avec badge + panel historique
 * À placer dans le header de l'app
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Chip,
  CircularProgress,
  ClickAwayListener,
  Divider,
  IconButton,
  Paper,
  Popper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import tokens from '../config/tokens';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  requestPermissionAndRegister,
  onForegroundMessage,
} from '../services/notifications.service';

const TYPE_LABELS = {
  new_content:          { label: '📚 Nouveau contenu', color: tokens.colors.primary },
  expiration_reminder:  { label: '⏰ Rappel abonnement', color: '#f9a825' },
  subscription_expired: { label: '🔴 Abonnement expiré', color: '#d32f2f' },
  payment_failed:       { label: '💳 Paiement échoué', color: '#d32f2f' },
  subscription_update:  { label: '📋 Mise à jour', color: tokens.colors.accent },
  promo:                { label: '🎁 Offre spéciale', color: '#388e3c' },
  system:               { label: '🔔 Papyri', color: '#666' },
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
}

export default function NotificationBell() {
  const [anchorEl, setAnchorEl] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const unsubscribeRef = useRef(null);

  const open = Boolean(anchorEl);

  const load = useCallback(async () => {
    try {
      const { notifications: notifs, unreadCount: count } = await getNotifications({ limit: 15 });
      setNotifications(notifs);
      setUnreadCount(count);
    } catch (_) {}
  }, []);

  useEffect(() => {
    load();

    // Demander permission push + écouter messages foreground
    requestPermissionAndRegister().catch(() => {});

    onForegroundMessage(({ title, body }) => {
      // Recharger la liste quand un message arrive en foreground
      load();
    }).then((unsub) => {
      unsubscribeRef.current = unsub;
    });

    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current();
    };
  }, [load]);

  const handleOpen = (e) => {
    setAnchorEl(e.currentTarget);
    load();
  };

  const handleClose = () => setAnchorEl(null);

  const handleMarkRead = async (id) => {
    await markAsRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const handleMarkAll = async () => {
    setLoading(true);
    await markAllAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    setLoading(false);
  };

  const typeInfo = (type) => TYPE_LABELS[type] || TYPE_LABELS.system;

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton onClick={handleOpen} size="medium" sx={{ color: 'inherit' }}>
          <Badge badgeContent={unreadCount || null} color="error" max={99}>
            {unreadCount > 0 ? <NotificationsIcon /> : <NotificationsNoneIcon />}
          </Badge>
        </IconButton>
      </Tooltip>

      <Popper open={open} anchorEl={anchorEl} placement="bottom-end" style={{ zIndex: 1400 }}>
        <ClickAwayListener onClickAway={handleClose}>
          <Paper
            elevation={8}
            sx={{
              width: 360,
              maxHeight: 520,
              borderRadius: 3,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header */}
            <Stack direction="row" alignItems="center" justifyContent="space-between"
              sx={{ px: 2, py: 1.5, borderBottom: '1px solid #f0ece6' }}
            >
              <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: '#1c160d' }}>
                Notifications
                {unreadCount > 0 && (
                  <Chip
                    label={unreadCount}
                    size="small"
                    sx={{ ml: 1, bgcolor: tokens.colors.primary, color: '#fff', fontWeight: 700, height: 20, fontSize: '0.72rem' }}
                  />
                )}
              </Typography>
              {unreadCount > 0 && (
                <Tooltip title="Tout marquer comme lu">
                  <IconButton size="small" onClick={handleMarkAll} disabled={loading}>
                    {loading ? <CircularProgress size={16} /> : <DoneAllIcon fontSize="small" sx={{ color: tokens.colors.primary }} />}
                  </IconButton>
                </Tooltip>
              )}
            </Stack>

            {/* Liste */}
            <Box sx={{ overflowY: 'auto', flex: 1 }}>
              {notifications.length === 0 ? (
                <Box sx={{ py: 6, textAlign: 'center' }}>
                  <Typography sx={{ color: '#aaa', fontSize: '0.9rem' }}>Aucune notification</Typography>
                </Box>
              ) : (
                notifications.map((notif) => {
                  const info = typeInfo(notif.type);
                  return (
                    <Box
                      key={notif.id}
                      onClick={() => !notif.is_read && handleMarkRead(notif.id)}
                      sx={{
                        px: 2, py: 1.5,
                        cursor: notif.is_read ? 'default' : 'pointer',
                        bgcolor: notif.is_read ? 'transparent' : '#fdf8f3',
                        borderBottom: '1px solid #f4f0eb',
                        transition: 'background 0.15s',
                        '&:hover': { bgcolor: '#f8f3ee' },
                      }}
                    >
                      <Stack direction="row" spacing={1.5} alignItems="flex-start">
                        {!notif.is_read && (
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: tokens.colors.primary, mt: 0.7, flexShrink: 0 }} />
                        )}
                        <Box sx={{ flex: 1, pl: notif.is_read ? 2 : 0 }}>
                          <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: info.color }}>
                            {info.label}
                          </Typography>
                          <Typography sx={{ fontSize: '0.88rem', fontWeight: 700, color: '#1c160d', mt: 0.2 }}>
                            {notif.title}
                          </Typography>
                          <Typography sx={{ fontSize: '0.82rem', color: '#6b5e52', mt: 0.2, lineHeight: 1.4 }}>
                            {notif.body}
                          </Typography>
                          <Typography sx={{ fontSize: '0.75rem', color: '#aaa', mt: 0.5 }}>
                            {timeAgo(notif.sent_at)}
                          </Typography>
                        </Box>
                      </Stack>
                    </Box>
                  );
                })
              )}
            </Box>
          </Paper>
        </ClickAwayListener>
      </Popper>
    </>
  );
}
