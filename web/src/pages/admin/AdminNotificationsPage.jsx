/**
 * AdminNotificationsPage — /admin/notifications
 * Envoi de notifications push par segment + historique
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Card, Typography, Button, TextField, Chip,
  CircularProgress, Alert, Snackbar,
  Table, TableHead, TableBody, TableRow, TableCell,
  ToggleButton, ToggleButtonGroup, Skeleton, Divider,
  Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import SendIcon                  from '@mui/icons-material/Send';
import PeopleOutlinedIcon        from '@mui/icons-material/PeopleOutlined';
import CheckCircleOutlineIcon    from '@mui/icons-material/CheckCircleOutline';
import PhoneAndroidOutlinedIcon  from '@mui/icons-material/PhoneAndroidOutlined';
import { authFetch } from '../../services/auth.service';
import tokens from '../../config/tokens';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const C = {
  indigo: tokens.colors.accent, primary: tokens.colors.primary, green: '#27ae60',
  red: '#e74c3c', orange: '#FF9800', grey: '#8c8c8c',
  bg: '#F7F6F3', textPrimary: '#1a1a2e', textSecondary: '#6b7280',
};

const inputSx = { '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: '#fff' } };

const SEGMENTS = [
  { value: 'all',                   label: 'Tous les utilisateurs',  icon: '👥' },
  { value: 'active_subscribers',    label: 'Abonnés actifs',         icon: '✅' },
  { value: 'expired_subscribers',   label: 'Abonnés expirés',        icon: '⏰' },
  { value: 'cancelled_subscribers', label: 'Abonnés résiliés',       icon: '❌' },
  { value: 'user',                  label: 'Utilisateur spécifique', icon: '🎯' },
];

const TYPES = [
  { value: 'system', label: 'Système' },
  { value: 'promo',  label: 'Promo' },
  { value: 'new_content', label: 'Nouveau contenu' },
];

function typeChip(type) {
  const colors = { system: C.indigo, promo: C.primary, new_content: C.green };
  return colors[type] || C.grey;
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function AdminNotificationsPage() {
  const [stats, setStats]     = useState(null);
  const [recent, setRecent]   = useState([]);
  const [loading, setLoading] = useState(true);

  // Form
  const [segment,   setSegment]   = useState('all');
  const [userEmail, setUserEmail] = useState('');
  const [type,      setType]      = useState('system');
  const [title,     setTitle]     = useState('');
  const [body,      setBody]      = useState('');
  const [sending,   setSending]   = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [sendError,  setSendError]  = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    authFetch(`${API}/api/admin/notifications/stats`)
      .then(r => r.json())
      .then(d => { setStats(d.stats || {}); setRecent(d.recent || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSend() {
    if (!title.trim() || !body.trim()) { setSendError('Titre et message requis.'); return; }
    if (segment === 'user' && !userEmail.trim()) { setSendError('Email utilisateur requis.'); return; }
    setSending(true); setSendError(null); setSendResult(null);
    try {
      const payload = { target: segment, type, title, body, saveToDb: true };
      if (segment === 'user') payload.userEmail = userEmail.trim();
      const res  = await authFetch(`${API}/api/admin/notifications/send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Erreur envoi');
      setSendResult(data.message);
      setTitle(''); setBody('');
      setTimeout(load, 1500);
    } catch (e) { setSendError(e.message); }
    finally { setSending(false); }
  }

  const kpis = [
    { label: 'Notifications envoyées', value: stats?.total ?? '—', icon: NotificationsOutlinedIcon, color: C.indigo },
    { label: 'Non lues',               value: stats?.unread ?? '—', icon: CheckCircleOutlineIcon,  color: C.orange },
    { label: 'Appareils push actifs',  value: stats?.pushEnabled ?? '—', icon: PhoneAndroidOutlinedIcon, color: C.green },
  ];

  return (
    <Box sx={{ bgcolor: C.bg, minHeight: '100vh' }}>

      {/* Header */}
      <Box sx={{ bgcolor: '#fff', height: 60, display: 'flex', alignItems: 'center', px: 3, borderBottom: '1px solid #e5e0d8', position: 'sticky', top: 0, zIndex: 10 }}>
        <NotificationsOutlinedIcon sx={{ color: C.indigo, mr: 1 }} />
        <Typography variant="h6" fontWeight={700} color={C.textPrimary}>Notifications push</Typography>
      </Box>

      <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1000, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>

        {/* KPIs */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {kpis.map(k => {
            const Icon = k.icon;
            return (
              <Card key={k.label} sx={{ borderRadius: '14px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', px: 2.5, py: 2, display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 180 }}>
                <Box sx={{ width: 40, height: 40, borderRadius: '10px', bgcolor: `${k.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon sx={{ color: k.color, fontSize: 20 }} />
                </Box>
                <Box>
                  {loading ? <Skeleton width={40} height={28} /> : (
                    <Typography variant="h5" fontWeight={900} color={k.color}>{k.value}</Typography>
                  )}
                  <Typography variant="caption" color={C.textSecondary} fontWeight={600}>{k.label}</Typography>
                </Box>
              </Card>
            );
          })}
        </Box>

        <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start', flexWrap: { xs: 'wrap', md: 'nowrap' } }}>

          {/* ── Formulaire d'envoi ── */}
          <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', p: 3, flex: 1, minWidth: 300 }}>
            <Typography variant="subtitle1" fontWeight={700} color={C.textPrimary} sx={{ mb: 2.5 }}>
              Composer une notification
            </Typography>

            {sendResult && <Alert severity="success" sx={{ mb: 2, borderRadius: '10px' }}>{sendResult}</Alert>}
            {sendError  && <Alert severity="error"   sx={{ mb: 2, borderRadius: '10px' }}>{sendError}</Alert>}

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

              {/* Segment */}
              <Box>
                <Typography variant="caption" fontWeight={600} color={C.textSecondary} sx={{ display: 'block', mb: 1 }}>
                  Destinataires
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {SEGMENTS.map(s => (
                    <Chip
                      key={s.value}
                      label={`${s.icon} ${s.label}`}
                      onClick={() => setSegment(s.value)}
                      sx={{
                        cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem',
                        bgcolor: segment === s.value ? C.indigo : '#f0ede8',
                        color:   segment === s.value ? '#fff' : C.textSecondary,
                        border:  segment === s.value ? `2px solid ${C.indigo}` : '2px solid transparent',
                      }}
                    />
                  ))}
                </Box>
              </Box>

              {segment === 'user' && (
                <TextField label="Email de l'utilisateur" size="small" fullWidth sx={inputSx}
                  value={userEmail} onChange={e => setUserEmail(e.target.value)}
                  placeholder="user@example.com" type="email" />
              )}

              <FormControl size="small" fullWidth sx={inputSx}>
                <InputLabel>Type</InputLabel>
                <Select value={type} label="Type" onChange={e => setType(e.target.value)}>
                  {TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                </Select>
              </FormControl>

              <TextField label="Titre *" size="small" fullWidth sx={inputSx}
                value={title} onChange={e => setTitle(e.target.value)}
                placeholder="Ex : Nouveau livre disponible !" />

              <TextField label="Message *" size="small" fullWidth multiline rows={3} sx={inputSx}
                value={body} onChange={e => setBody(e.target.value)}
                placeholder="Ex : Découvrez notre dernière nouveauté…" />

              {/* Aperçu */}
              {(title || body) && (
                <Box sx={{ bgcolor: '#1a1a2e', borderRadius: '14px', p: 2, display: 'flex', gap: 1.5 }}>
                  <Box sx={{ width: 40, height: 40, borderRadius: '10px', bgcolor: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <NotificationsOutlinedIcon sx={{ color: '#fff', fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Typography variant="body2" fontWeight={700} color="#fff">{title || 'Titre'}</Typography>
                    <Typography variant="caption" color="rgba(255,255,255,0.65)">{body || 'Message…'}</Typography>
                  </Box>
                </Box>
              )}

              <Button
                variant="contained" fullWidth
                startIcon={sending ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
                onClick={handleSend} disabled={sending}
                sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '10px', bgcolor: C.indigo, py: 1.2, '&:hover': { bgcolor: '#1a2d47' } }}
              >
                {sending ? 'Envoi en cours…' : `Envoyer ${SEGMENTS.find(s => s.value === segment)?.icon || ''}`}
              </Button>
            </Box>
          </Card>

          {/* ── Historique ── */}
          <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', flex: 1.2, minWidth: 300, overflow: 'hidden' }}>
            <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #e5e0d8' }}>
              <Typography variant="subtitle1" fontWeight={700} color={C.textPrimary}>
                Dernières notifications
              </Typography>
            </Box>
            {loading ? (
              <Box sx={{ p: 2 }}>
                {[1,2,3,4].map(i => <Skeleton key={i} height={52} sx={{ mb: 1, borderRadius: '8px' }} />)}
              </Box>
            ) : recent.length === 0 ? (
              <Box sx={{ py: 8, textAlign: 'center' }}>
                <NotificationsOutlinedIcon sx={{ fontSize: 40, opacity: 0.15, display: 'block', mx: 'auto', mb: 1 }} />
                <Typography variant="body2" color={C.textSecondary}>Aucune notification envoyée</Typography>
              </Box>
            ) : (
              <Box sx={{ maxHeight: 480, overflow: 'auto' }}>
                {recent.map((n, i) => (
                  <Box key={n.id} sx={{ px: 3, py: 1.5, borderBottom: i < recent.length - 1 ? '1px solid #f0ede8' : 'none', '&:hover': { bgcolor: '#faf9f7' } }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                          <Chip label={n.type || 'system'} size="small"
                            sx={{ bgcolor: `${typeChip(n.type)}18`, color: typeChip(n.type), fontWeight: 700, fontSize: '0.65rem', height: 18 }} />
                          {!n.is_read && <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: C.orange }} />}
                        </Box>
                        <Typography variant="body2" fontWeight={700} color={C.textPrimary} noWrap>{n.title}</Typography>
                        <Typography variant="caption" color={C.textSecondary} noWrap sx={{ display: 'block', maxWidth: 260 }}>{n.body}</Typography>
                      </Box>
                      <Typography variant="caption" color={C.grey} sx={{ whiteSpace: 'nowrap', mt: 0.25 }}>
                        {fmtDate(n.sent_at)}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </Card>
        </Box>
      </Box>
    </Box>
  );
}
