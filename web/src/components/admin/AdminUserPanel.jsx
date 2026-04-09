import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Skeleton,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import tokens from '../../config/tokens';
import * as adminService from '../../services/admin.service';
import AdminUserProfileTab from './AdminUserProfileTab';
import AdminUserSubscriptionTab from './AdminUserSubscriptionTab';
import AdminUserUnlocksTab from './AdminUserUnlocksTab';
import AdminUserHistoryTab from './AdminUserHistoryTab';

const C = {
  primary: tokens.colors.primary,
  indigo: tokens.colors.accent,
};

export default function AdminUserPanel({ userId, onClose, onUserUpdated, currentUserId, roleOpts }) {
  const frontendUrl = (import.meta.env.VITE_FRONTEND_URL || window.location.origin).replace(/\/$/, '');
  const [data, setData] = useState(null);
  const [unlocks, setUnlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    adminService.getUser(userId)
      .then((result) => {
        setData(result);
        setUnlocks(result.unlocks || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  function handleProfileUpdated(profile) {
    setData((prev) => ({ ...prev, profile }));
    onUserUpdated(userId, { ...data, profile });
  }

  function handleSubUpdated({ subscription }) {
    setData((prev) => ({ ...prev, subscription }));
  }

  return (
    <Box sx={{ width: 600, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ p: 2.5, borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 1.5 }}>
        {data && (
          <Avatar sx={{ width: 40, height: 40, bgcolor: C.indigo, fontWeight: 700 }}>
            {(data.profile.full_name || data.profile.email || '?').charAt(0).toUpperCase()}
          </Avatar>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {loading ? (
            <>
              <Skeleton width={120} height={18} />
              <Skeleton width={160} height={14} sx={{ mt: 0.5 }} />
            </>
          ) : (
            <>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {data?.profile.full_name || '—'}
              </Typography>
              <Typography variant="caption" sx={{ color: '#999' }}>{data?.profile.email}</Typography>
            </>
          )}
        </Box>
        <Button
          size="small"
          variant="outlined"
          onClick={() => window.open(frontendUrl, '_blank', 'noopener,noreferrer')}
          sx={{
            borderRadius: '10px',
            textTransform: 'none',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            borderColor: '#d9d4cb',
            color: '#555',
            '&:hover': { borderColor: C.primary, color: C.primary, bgcolor: '#fff8f0' },
          }}
        >
          Visiter le site
        </Button>
        <IconButton size="small" onClick={onClose}>
          <CloseOutlinedIcon fontSize="small" />
        </IconButton>
      </Box>

      {loading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} /></Box>}
      {error && <Alert severity="error" sx={{ m: 2, borderRadius: '10px' }}>{error}</Alert>}

      {data && !loading && (
        <>
          <Tabs
            value={tab}
            onChange={(_, value) => setTab(value)}
            sx={{ px: 2, borderBottom: '1px solid #eee', minHeight: 44 }}
            TabIndicatorProps={{ style: { backgroundColor: C.primary } }}
          >
            {['Profil', 'Abonnement', `Accès (${unlocks.length})`, `Lectures (${data.history?.length || 0})`].map((label, index) => (
              <Tab
                key={index}
                label={label}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '13px',
                  minHeight: 44,
                  px: 1.5,
                  color: tab === index ? C.primary : '#888',
                  '&.Mui-selected': { color: C.primary },
                }}
              />
            ))}
          </Tabs>

          <Box sx={{ flex: 1, overflow: 'auto', p: 2.5 }}>
            {tab === 0 && (
              <AdminUserProfileTab
                profile={data.profile}
                onUpdated={handleProfileUpdated}
                currentUserId={currentUserId}
                roleOpts={roleOpts}
              />
            )}
            {tab === 1 && (
              <AdminUserSubscriptionTab
                userId={userId}
                subscription={data.subscription}
                onUpdated={handleSubUpdated}
              />
            )}
            {tab === 2 && (
              <AdminUserUnlocksTab userId={userId} unlocks={unlocks} setUnlocks={setUnlocks} />
            )}
            {tab === 3 && <AdminUserHistoryTab history={data.history || []} />}
          </Box>
        </>
      )}
    </Box>
  );
}
