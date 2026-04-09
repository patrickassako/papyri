import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import tokens from '../../config/tokens';
import * as adminService from '../../services/admin.service';
import AdminConfirmDialog from './AdminConfirmDialog';
import AdminRoleChip from './AdminRoleChip';
import AdminActiveStatusChip from './AdminActiveStatusChip';

const C = {
  primary: tokens.colors.primary,
  green: '#27ae60',
  red: '#e74c3c',
  indigo: tokens.colors.accent,
  or: tokens.colors.secondary,
  purple: '#7b1fa2',
};

export default function AdminUserProfileTab({ profile, onUpdated, currentUserId, roleOpts }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [form, setForm] = useState({ full_name: profile.full_name || '', role: profile.role || 'user', is_active: profile.is_active });
  const [confirm, setConfirm] = useState(null);

  useEffect(() => {
    setForm({ full_name: profile.full_name || '', role: profile.role || 'user', is_active: profile.is_active });
    setEditing(false);
  }, [profile.id, profile.full_name, profile.role, profile.is_active]);

  const isSelf = profile.id === currentUserId;

  function requestSave() {
    const promotingToAdmin = form.role === 'admin' && profile.role !== 'admin';
    const demotingFromAdmin = form.role !== 'admin' && profile.role === 'admin';
    const blocking = form.is_active === false && profile.is_active === true;

    if (isSelf && (demotingFromAdmin || blocking)) {
      setMsg({ type: 'error', text: 'Vous ne pouvez pas modifier votre propre rôle admin ni désactiver votre compte.' });
      setTimeout(() => setMsg(null), 4000);
      return;
    }

    if (promotingToAdmin) {
      setConfirm({
        title: 'Accorder les droits administrateur ?',
        body: `${profile.email} aura un accès complet au back-office. Cette action est enregistrée dans l'audit trail.`,
        onConfirm: doSave,
      });
      return;
    }
    if (demotingFromAdmin) {
      setConfirm({
        title: 'Retirer les droits administrateur ?',
        body: `${profile.email} perdra l'accès au back-office. Cette action est enregistrée dans l'audit trail.`,
        onConfirm: doSave,
      });
      return;
    }
    if (blocking) {
      setConfirm({
        title: 'Bloquer cet utilisateur ?',
        body: `${profile.email} ne pourra plus se connecter. L'accès est coupé immédiatement.`,
        onConfirm: doSave,
      });
      return;
    }
    doSave();
  }

  async function doSave() {
    setConfirm(null);
    setSaving(true);
    setMsg(null);
    try {
      const res = await adminService.updateUser(profile.id, form);
      setMsg({ type: 'success', text: 'Profil mis à jour.' });
      setEditing(false);
      onUpdated(res.profile);
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
    setTimeout(() => setMsg(null), 3000);
  }

  const field = (label, content) => (
    <Box sx={{ mb: 2 }}>
      <Typography variant="caption" sx={{ color: '#999', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', mb: 0.5 }}>
        {label}
      </Typography>
      {content}
    </Box>
  );

  return (
    <Box>
      {msg && <Alert severity={msg.type === 'error' ? 'error' : 'success'} sx={{ mb: 2, borderRadius: '10px' }} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        {!editing ? (
          <Button size="small" startIcon={<EditOutlinedIcon />} onClick={() => setEditing(true)} variant="outlined"
            sx={{ borderRadius: '10px', textTransform: 'none', borderColor: C.indigo, color: C.indigo }}>
            Modifier
          </Button>
        ) : (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button size="small" onClick={() => setEditing(false)} sx={{ borderRadius: '10px', textTransform: 'none', color: '#666' }}>
              Annuler
            </Button>
            <Button size="small" startIcon={saving ? <CircularProgress size={14} /> : <SaveOutlinedIcon />}
              onClick={requestSave} disabled={saving} variant="contained"
              sx={{ borderRadius: '10px', textTransform: 'none', bgcolor: C.primary, '&:hover': { bgcolor: '#9a4f15' } }}>
              Enregistrer
            </Button>
          </Box>
        )}
      </Box>

      {field('Email', <Typography variant="body2" sx={{ color: '#555', fontFamily: 'monospace', fontSize: 13 }}>{profile.email}</Typography>)}

      {field('Nom d\'affichage',
        editing
          ? <TextField fullWidth size="small" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
          : <Typography variant="body2">{profile.full_name || '—'}</Typography>
      )}

      {field('Rôle',
        editing
          ? (
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <Select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} sx={{ borderRadius: '10px' }}>
                {roleOpts.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
              </Select>
            </FormControl>
          )
          : <AdminRoleChip role={profile.role} roleOpts={roleOpts} />
      )}

      {field('Statut',
        editing
          ? (
            <Box sx={{ display: 'flex', gap: 1 }}>
              {[{ v: true, label: 'Actif' }, { v: false, label: 'Bloqué' }].map((opt) => (
                <Button
                  key={String(opt.v)}
                  size="small"
                  onClick={() => setForm((f) => ({ ...f, is_active: opt.v }))}
                  variant={form.is_active === opt.v ? 'contained' : 'outlined'}
                  sx={{
                    borderRadius: '10px',
                    textTransform: 'none',
                    fontWeight: 700,
                    ...(form.is_active === opt.v
                      ? { bgcolor: opt.v ? C.green : C.red, '&:hover': { bgcolor: opt.v ? '#219150' : '#c0392b' } }
                      : { borderColor: opt.v ? C.green : C.red, color: opt.v ? C.green : C.red }),
                  }}
                >
                  {opt.label}
                </Button>
              ))}
            </Box>
          )
          : <AdminActiveStatusChip active={profile.is_active} />
      )}

      {field('Membre depuis',
        <Typography variant="body2" sx={{ color: '#555' }}>
          {profile.created_at ? new Date(profile.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
        </Typography>
      )}

      {field('ID', <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#aaa', wordBreak: 'break-all' }}>{profile.id}</Typography>)}

      <AdminConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title}
        body={confirm?.body}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm?.onConfirm()}
      />
    </Box>
  );
}
