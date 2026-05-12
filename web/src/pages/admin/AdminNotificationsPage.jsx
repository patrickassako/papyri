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
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminEmptyState from '../../components/admin/AdminEmptyState';

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
  { value: 'bought_paid',           label: 'Acheteurs livres payants', icon: '💳' },
  { value: 'read_category',         label: 'Lecteurs d\'une catégorie', icon: '📚' },
  { value: 'kid_profiles',          label: 'Comptes avec profil enfant', icon: '🧒' },
  { value: 'adult_profiles',        label: 'Comptes adultes uniquement', icon: '🧑' },
  { value: 'push_enabled',          label: 'Push activé',            icon: '🔔' },
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
  const [categoryId, setCategoryId] = useState('');
  const [type,      setType]      = useState('system');
  const [titleFr,   setTitleFr]   = useState('');
  const [bodyFr,    setBodyFr]    = useState('');
  const [titleEn,   setTitleEn]   = useState('');
  const [bodyEn,    setBodyEn]    = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [sending,   setSending]   = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [sendError,  setSendError]  = useState(null);
  const [audiencePreview, setAudiencePreview] = useState(null);
  const [scheduled, setScheduled] = useState([]);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      authFetch(`${API}/api/admin/notifications/stats`).then(r => r.json()),
      authFetch(`${API}/api/admin/notifications/scheduled?status=pending`).then(r => r.json()).catch(() => ({ scheduled: [] })),
    ])
      .then(([statsData, schedData]) => {
        setStats(statsData.stats || {});
        setRecent(statsData.recent || []);
        setScheduled(schedData.scheduled || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Live audience preview whenever segment/criteria change.
  useEffect(() => {
    let cancelled = false;
    const criteria = {};
    if (segment === 'user' && userEmail) criteria.userEmail = userEmail;
    if (segment === 'read_category' && categoryId) criteria.categoryId = categoryId;
    const qs = new URLSearchParams({ target: segment, criteria_json: JSON.stringify(criteria) }).toString();
    authFetch(`${API}/api/admin/notifications/audience-preview?${qs}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setAudiencePreview(typeof d.count === 'number' ? d.count : null); })
      .catch(() => { if (!cancelled) setAudiencePreview(null); });
    return () => { cancelled = true; };
  }, [segment, userEmail, categoryId]);

  const cancelScheduled = async (id) => {
    try {
      await authFetch(`${API}/api/admin/notifications/scheduled/${id}`, { method: 'DELETE' });
      load();
    } catch (_) { /* ignore */ }
  };

  useEffect(() => { load(); }, [load]);

  async function handleSend() {
    if (!titleFr.trim() || !bodyFr.trim()) { setSendError('Titre et message FR requis.'); return; }
    if (segment === 'user' && !userEmail.trim()) { setSendError('Email utilisateur requis.'); return; }
    if (segment === 'read_category' && !categoryId.trim()) { setSendError('Catégorie requise.'); return; }
    setSending(true); setSendError(null); setSendResult(null);
    try {
      const payload = {
        target: segment,
        type,
        title_fr: titleFr,
        body_fr: bodyFr,
        title_en: titleEn || null,
        body_en: bodyEn || null,
        saveToDb: true,
      };
      if (segment === 'user') payload.userEmail = userEmail.trim();
      if (segment === 'read_category') payload.categoryId = categoryId.trim();
      if (scheduledFor) payload.scheduledFor = new Date(scheduledFor).toISOString();
      const res = await authFetch(`${API}/api/admin/notifications/send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Erreur envoi');
      setSendResult(data.message);
      setTitleFr(''); setBodyFr(''); setTitleEn(''); setBodyEn(''); setScheduledFor('');
      setTimeout(load, 1500);
    } catch (e) { setSendError(e.message); }
    finally { setSending(false); }
  }

  const kpis = [
    { label: 'Envoyées',           value: stats?.total ?? '—',       icon: NotificationsOutlinedIcon, color: C.indigo },
    { label: 'Lues',               value: `${stats?.readRate ?? 0}%`,    icon: CheckCircleOutlineIcon,  color: C.green },
    { label: 'Cliquées',           value: `${stats?.clickedRate ?? 0}%`, icon: SendIcon,                color: C.primary },
    { label: 'Appareils push',     value: stats?.pushEnabled ?? '—', icon: PhoneAndroidOutlinedIcon, color: C.indigo },
  ];

  return (
    <Box sx={{ bgcolor: C.bg, minHeight: '100vh' }}>
      <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1000, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <AdminPageHeader
          title="Notifications push"
          subtitle={`${stats?.total ?? 0} notification${(stats?.total ?? 0) > 1 ? 's' : ''} envoyée${(stats?.total ?? 0) > 1 ? 's' : ''}`}
        />

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

              {segment === 'read_category' && (
                <TextField label="ID de la catégorie" size="small" fullWidth sx={inputSx}
                  value={categoryId} onChange={e => setCategoryId(e.target.value)}
                  placeholder="UUID de la catégorie" />
              )}

              {audiencePreview !== null && (
                <Alert severity="info" sx={{ borderRadius: '10px', py: 0.5 }}>
                  Audience estimée : <strong>{audiencePreview}</strong> utilisateur{audiencePreview > 1 ? 's' : ''}
                </Alert>
              )}

              <FormControl size="small" fullWidth sx={inputSx}>
                <InputLabel>Type</InputLabel>
                <Select value={type} label="Type" onChange={e => setType(e.target.value)}>
                  {TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                </Select>
              </FormControl>

              {/* FR */}
              <Box sx={{ borderLeft: `3px solid ${C.primary}`, pl: 1.5 }}>
                <Typography variant="caption" fontWeight={700} color={C.primary} sx={{ display: 'block', mb: 1 }}>
                  🇫🇷 Français
                </Typography>
                <TextField label="Titre FR *" size="small" fullWidth sx={{ ...inputSx, mb: 1 }}
                  value={titleFr} onChange={e => setTitleFr(e.target.value)}
                  placeholder="Ex : Nouveau livre disponible !" />
                <TextField label="Message FR *" size="small" fullWidth multiline rows={2} sx={inputSx}
                  value={bodyFr} onChange={e => setBodyFr(e.target.value)}
                  placeholder="Ex : Découvrez notre dernière nouveauté…" />
              </Box>

              {/* EN */}
              <Box sx={{ borderLeft: `3px solid ${C.indigo}`, pl: 1.5 }}>
                <Typography variant="caption" fontWeight={700} color={C.indigo} sx={{ display: 'block', mb: 1 }}>
                  🇬🇧 English (optionnel — fallback FR)
                </Typography>
                <TextField label="Title EN" size="small" fullWidth sx={{ ...inputSx, mb: 1 }}
                  value={titleEn} onChange={e => setTitleEn(e.target.value)}
                  placeholder="Ex: New book available!" />
                <TextField label="Body EN" size="small" fullWidth multiline rows={2} sx={inputSx}
                  value={bodyEn} onChange={e => setBodyEn(e.target.value)}
                  placeholder="Ex: Check out our latest title…" />
              </Box>

              {/* Scheduling */}
              <TextField label="Programmer pour (laisser vide = envoi immédiat)" size="small" fullWidth sx={inputSx}
                type="datetime-local" InputLabelProps={{ shrink: true }}
                value={scheduledFor} onChange={e => setScheduledFor(e.target.value)} />

              {/* Aperçu */}
              {(titleFr || bodyFr) && (
                <Box sx={{ bgcolor: '#1a1a2e', borderRadius: '14px', p: 2, display: 'flex', gap: 1.5 }}>
                  <Box sx={{ width: 40, height: 40, borderRadius: '10px', bgcolor: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <NotificationsOutlinedIcon sx={{ color: '#fff', fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Typography variant="body2" fontWeight={700} color="#fff">{titleFr || 'Titre'}</Typography>
                    <Typography variant="caption" color="rgba(255,255,255,0.65)">{bodyFr || 'Message…'}</Typography>
                  </Box>
                </Box>
              )}

              <Button
                variant="contained" fullWidth
                startIcon={sending ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
                onClick={handleSend} disabled={sending}
                sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '10px', bgcolor: C.indigo, py: 1.2, '&:hover': { bgcolor: '#1a2d47' } }}
              >
                {sending ? 'Envoi en cours…' : scheduledFor ? `Programmer ${SEGMENTS.find(s => s.value === segment)?.icon || ''}` : `Envoyer ${SEGMENTS.find(s => s.value === segment)?.icon || ''}`}
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
                <AdminEmptyState
                  title="Aucune notification envoyée"
                  description="L’historique s’affichera ici après le premier envoi."
                />
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

        {/* ── Notifications programmées ── */}
        {scheduled.length > 0 && (
          <Card sx={{ borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #e5e0d8', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle1" fontWeight={700} color={C.textPrimary}>
                ⏰ Notifications programmées ({scheduled.length})
              </Typography>
            </Box>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date prévue</TableCell>
                  <TableCell>Cible</TableCell>
                  <TableCell>Titre</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {scheduled.map(s => (
                  <TableRow key={s.id}>
                    <TableCell>{fmtDate(s.scheduled_for)}</TableCell>
                    <TableCell>{s.target}</TableCell>
                    <TableCell sx={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title_fr}</TableCell>
                    <TableCell align="right">
                      <Button size="small" color="error" onClick={() => cancelScheduled(s.id)}>
                        Annuler
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </Box>
    </Box>
  );
}
