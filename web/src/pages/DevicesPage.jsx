import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  Paper,
  Button,
  Chip,
  Alert,
  Snackbar,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
} from '@mui/material';
import DevicesOutlined from '@mui/icons-material/DevicesOutlined';
import SmartphoneOutlined from '@mui/icons-material/SmartphoneOutlined';
import TabletOutlined from '@mui/icons-material/TabletOutlined';
import LaptopOutlined from '@mui/icons-material/LaptopOutlined';
import LogoutOutlined from '@mui/icons-material/LogoutOutlined';
import AccessTimeOutlined from '@mui/icons-material/AccessTimeOutlined';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import MenuBookOutlined from '@mui/icons-material/MenuBookOutlined';
import tokens from '../config/tokens';
import UserSpaceSidebar from '../components/UserSpaceSidebar';
import MobileBottomNav from '../components/MobileBottomNav';
import { authFetch } from '../services/auth.service';
import * as authService from '../services/auth.service';
import { deviceService } from '../services/device.service';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function formatDate(dateStr, locale = 'fr-FR') {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString(locale, {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function DeviceIcon({ deviceType, size = 40 }) {
  const sx = { fontSize: size, color: tokens.colors.primary };
  if (deviceType === 'mobile') return <SmartphoneOutlined sx={sx} />;
  if (deviceType === 'tablet') return <TabletOutlined sx={sx} />;
  return <LaptopOutlined sx={sx} />;
}

export default function DevicesPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith('fr') ? 'fr-FR' : 'en-US';
  const [user, setUser] = useState(null);
  const [devices, setDevices] = useState([]);
  const [meta, setMeta] = useState({ limit: 3, count: 0 });
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null); // { deviceId, deviceName }
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  const loadData = async () => {
    try {
      // Register current device first (idempotent — updates last_seen if already registered)
      await deviceService.register().catch(() => {});

      const [userRes, devicesRes] = await Promise.all([
        authFetch(`${API_URL}/users/me`),
        deviceService.list(),
      ]);
      const userData = await userRes.json();
      if (userData?.data) setUser(userData.data);
      if (devicesRes?.data) {
        setDevices(devicesRes.data);
        if (devicesRes.meta) setMeta(devicesRes.meta);
      }
    } catch (err) {
      console.error('DevicesPage load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleRemoveDevice = async () => {
    if (!removeTarget) return;
    setRemovingId(removeTarget.deviceId);
    setRemoveTarget(null);
    try {
      const result = await deviceService.remove(removeTarget.deviceId);
      if (result?.sessions_revoked) {
        setSnack({ open: true, message: 'Appareil supprimé. Toutes les sessions ont été révoquées. Reconnexion requise…', severity: 'success' });
        setTimeout(async () => {
          await authService.logout();
          navigate('/login');
        }, 2500);
      } else {
        setSnack({ open: true, message: 'Appareil supprimé.', severity: 'success' });
        await loadData();
      }
    } catch {
      setSnack({ open: true, message: 'Erreur lors de la suppression.', severity: 'error' });
    } finally {
      setRemovingId(null);
    }
  };

  const handleRevokeAll = async () => {
    setConfirmOpen(false);
    setRevoking(true);
    try {
      await authFetch(`${API_URL}/users/me/sessions`, { method: 'DELETE' });
      setSnack({ open: true, message: 'Toutes les sessions ont été révoquées. Reconnexion requise.', severity: 'success' });
      setTimeout(async () => {
        await authService.logout();
        navigate('/login');
      }, 2000);
    } catch {
      setSnack({ open: true, message: 'Erreur lors de la révocation des sessions.', severity: 'error' });
    } finally {
      setRevoking(false);
    }
  };

  const subscriptionLabel = user?.subscription?.status === 'active'
    ? t('devices.activeUntil', { date: new Date(user.subscription.current_period_end).toLocaleDateString(locale) })
    : t('devices.noActiveSubscription');

  const slotsUsed = meta.count;
  const slotsTotal = meta.limit;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: tokens.colors.backgrounds.light }}>
      <UserSpaceSidebar user={user} activeKey="devices" subscriptionLabel={subscriptionLabel} />

      <Box sx={{ flex: 1, p: { xs: 2, md: 4 }, maxWidth: 760 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: tokens.colors.onBackground.light, mb: 0.5 }}>
            {t('devices.myDevices')}
          </Typography>
          <Typography variant="body2" sx={{ color: '#9c7e49' }}>
            {t('devices.registeredDevices')} · {slotsUsed}/{slotsTotal} {t('devices.slotsUsed')}
          </Typography>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress sx={{ color: tokens.colors.primary }} />
          </Box>
        ) : (
          <>
            {/* Slots bar */}
            <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
              {Array.from({ length: slotsTotal }).map((_, i) => (
                <Box
                  key={i}
                  sx={{
                    height: 6, flex: 1, borderRadius: 3,
                    bgcolor: i < slotsUsed ? tokens.colors.primary : tokens.colors.surfaces.light.variant,
                    transition: 'background-color 0.3s',
                  }}
                />
              ))}
            </Box>

            {/* Device list */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 4 }}>
              {devices.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
                  <DevicesOutlined sx={{ fontSize: 48, color: '#ccc', mb: 2 }} />
                  <Typography color="text.secondary">{t('devices.noDevices')}</Typography>
                </Paper>
              ) : (
                devices.map((device) => (
                  <Paper
                    key={device.id}
                    elevation={0}
                    sx={{
                      p: 3, borderRadius: 3,
                      border: `1px solid ${device.is_current ? tokens.colors.primary : tokens.colors.surfaces.light.variant}`,
                      bgcolor: device.is_current ? `${tokens.colors.primary}08` : '#fff',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2.5 }}>
                      {/* Icon */}
                      <Box sx={{
                        width: 56, height: 56, borderRadius: 2,
                        bgcolor: `${tokens.colors.primary}15`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <DeviceIcon deviceType={device.device_type} size={30} />
                      </Box>

                      {/* Info */}
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: tokens.colors.onBackground.light }}>
                            {device.device_name}
                          </Typography>
                          {device.is_current && (
                            <Chip
                              label={t('devices.currentDevice')}
                              size="small"
                              sx={{ bgcolor: tokens.colors.primary, color: '#fff', fontWeight: 700, fontSize: '0.7rem', height: 20 }}
                            />
                          )}
                          {device.is_reading && (
                            <Chip
                              icon={<MenuBookOutlined sx={{ fontSize: '0.85rem !important' }} />}
                              label={t('devices.reading')}
                              size="small"
                              sx={{ bgcolor: '#1e7d32', color: '#fff', fontWeight: 700, fontSize: '0.7rem', height: 20 }}
                            />
                          )}
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <AccessTimeOutlined sx={{ fontSize: 14, color: '#9c7e49' }} />
                          <Typography variant="caption" sx={{ color: '#9c7e49' }}>
                            {t('devices.lastActive')} : {formatDate(device.last_seen_at, locale)}
                          </Typography>
                        </Box>
                      </Box>

                      {/* Remove button — disabled if currently reading on this device */}
                      {!device.is_current && (
                        <Tooltip title={device.is_reading ? t('devices.reading') : t('devices.removeDevice')}>
                          <span>
                            <IconButton
                              size="small"
                              disabled={!!removingId || device.is_reading}
                              onClick={() => setRemoveTarget({ deviceId: device.device_id, deviceName: device.device_name })}
                              sx={{ color: '#c25450', '&:hover': { bgcolor: '#ffeaea' } }}
                            >
                              {removingId === device.device_id
                                ? <CircularProgress size={16} />
                                : <DeleteOutlined fontSize="small" />
                              }
                            </IconButton>
                          </span>
                        </Tooltip>
                      )}
                    </Box>
                  </Paper>
                ))
              )}
            </Box>

            {/* Info card */}
            <Alert
              severity="info"
              icon={<DevicesOutlined />}
              sx={{
                mb: 3, borderRadius: 2,
                bgcolor: `${tokens.colors.accent}10`,
                color: tokens.colors.accent,
                '& .MuiAlert-icon': { color: tokens.colors.accent },
              }}
            >
              {t('devices.limitInfo', { total: slotsTotal })}
            </Alert>

            {/* Danger zone */}
            <Paper
              elevation={0}
              sx={{ p: 3, borderRadius: 3, border: '1px solid #f5c2c2', bgcolor: '#fff9f9' }}
            >
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#c25450', mb: 1 }}>
                {t('devices.globalLogout')}
              </Typography>
              <Typography variant="body2" sx={{ color: '#9c7e49', mb: 2.5 }}>
                {t('devices.globalLogoutDesc')}
              </Typography>
              <Button
                variant="outlined"
                startIcon={revoking ? <CircularProgress size={16} /> : <LogoutOutlined />}
                disabled={revoking}
                onClick={() => setConfirmOpen(true)}
                sx={{
                  color: '#c25450', borderColor: '#c25450', borderRadius: 2, fontWeight: 700,
                  '&:hover': { bgcolor: '#ffeaea', borderColor: '#c25450' },
                }}
              >
                {revoking ? t('devices.revoking') : t('devices.signOutAll')}
              </Button>
            </Paper>
          </>
        )}
      </Box>

      {/* Confirm remove device */}
      <Dialog open={!!removeTarget} onClose={() => setRemoveTarget(null)} PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>{t('devices.removeDeviceTitle')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t('devices.removeDeviceConfirm', { name: removeTarget?.deviceName })}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setRemoveTarget(null)} sx={{ borderRadius: 2 }}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            onClick={handleRemoveDevice}
            sx={{ bgcolor: '#c25450', borderRadius: 2, fontWeight: 700, '&:hover': { bgcolor: '#a83e3b' } }}
          >
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm global logout */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>{t('devices.signOutAllConfirmTitle')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t('devices.signOutAllConfirm')}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setConfirmOpen(false)} sx={{ borderRadius: 2 }}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            onClick={handleRevokeAll}
            sx={{ bgcolor: '#c25450', borderRadius: 2, fontWeight: 700, '&:hover': { bgcolor: '#a83e3b' } }}
          >
            {t('devices.signOutAllConfirmButton')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} sx={{ borderRadius: 2 }}>{snack.message}</Alert>
      </Snackbar>
      <MobileBottomNav />
    </Box>
  );
}
