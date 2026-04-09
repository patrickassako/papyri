import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Card, Button, Chip, IconButton, CircularProgress, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Tooltip,
  Checkbox, FormControlLabel, Divider, Skeleton,
} from '@mui/material';
import AddOutlinedIcon         from '@mui/icons-material/AddOutlined';
import EditOutlinedIcon        from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon       from '@mui/icons-material/DeleteOutline';
import LockOutlinedIcon        from '@mui/icons-material/LockOutlined';
import PeopleOutlinedIcon      from '@mui/icons-material/PeopleOutlined';
import SecurityOutlinedIcon    from '@mui/icons-material/SecurityOutlined';
import tokens from '../../config/tokens';
import * as adminService from '../../services/admin.service';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminEmptyState from '../../components/admin/AdminEmptyState';
import AdminConfirmDialog from '../../components/admin/AdminConfirmDialog';

const C = {
  primary: tokens.colors.primary,
  indigo:  tokens.colors.accent,
  or:      tokens.colors.secondary,
  purple:  '#7b1fa2',
  green:   '#27ae60',
  red:     '#e74c3c',
};

// Couleur par rôle
function roleColor(name) {
  if (name === 'admin')     return { color: C.purple,  bg: '#ede7f6' };
  if (name === 'publisher') return { color: C.or,      bg: '#fff8e1' };
  if (name === 'user')      return { color: '#666',    bg: '#f5f5f5' };
  return { color: C.indigo, bg: '#e8eaf6' };
}

// ── Permission checkbox groupé par ressource ──────────────────────────────────
function PermissionsEditor({ grouped, selected, onChange, readOnly }) {
  const resources = Object.keys(grouped).sort();

  function toggleAll(resource, permIds) {
    const allSelected = permIds.every(id => selected.has(id));
    if (allSelected) {
      const next = new Set(selected);
      permIds.forEach(id => next.delete(id));
      onChange(next);
    } else {
      const next = new Set(selected);
      permIds.forEach(id => next.add(id));
      onChange(next);
    }
  }

  function toggle(id) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(next);
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {resources.map(resource => {
        const perms = grouped[resource];
        const permIds = perms.map(p => p.id);
        const allChecked = permIds.every(id => selected.has(id));
        const someChecked = permIds.some(id => selected.has(id)) && !allChecked;

        return (
          <Box key={resource}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
              <Checkbox
                size="small"
                checked={allChecked}
                indeterminate={someChecked}
                disabled={readOnly}
                onChange={() => toggleAll(resource, permIds)}
                sx={{ p: 0.5, color: C.indigo, '&.Mui-checked': { color: C.indigo } }}
              />
              <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase',
                letterSpacing: '0.05em', color: C.indigo, ml: 0.5 }}>
                {resource}
              </Typography>
            </Box>
            <Box sx={{ pl: 3, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {perms.map(p => (
                <FormControlLabel
                  key={p.id}
                  control={
                    <Checkbox
                      size="small"
                      checked={selected.has(p.id)}
                      disabled={readOnly}
                      onChange={() => toggle(p.id)}
                      sx={{ p: 0.5, color: C.primary, '&.Mui-checked': { color: C.primary } }}
                    />
                  }
                  label={
                    <Tooltip title={p.description || ''} arrow placement="top">
                      <Typography sx={{ fontSize: '0.8rem', color: '#444' }}>{p.action}</Typography>
                    </Tooltip>
                  }
                  sx={{ mr: 1, ml: 0 }}
                />
              ))}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

// ── Dialog : créer / éditer un rôle ──────────────────────────────────────────
function RoleDialog({ open, role, grouped, allPermissions, onClose, onSaved }) {
  const isEdit = Boolean(role);
  const [form, setForm]               = useState({ name: '', display_name: '', description: '' });
  const [selectedPerms, setSelectedPerms] = useState(new Set());
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState(null);

  useEffect(() => {
    if (!open) return;
    if (role) {
      setForm({ name: role.name, display_name: role.display_name, description: role.description || '' });
      // Charger les permissions actuelles du rôle
      adminService.getRole(role.id)
        .then(d => setSelectedPerms(new Set((d.permissions || []).map(p => p.id))))
        .catch(() => setSelectedPerms(new Set()));
    } else {
      setForm({ name: '', display_name: '', description: '' });
      setSelectedPerms(new Set());
    }
    setError(null);
  }, [open, role]);

  async function save() {
    setSaving(true); setError(null);
    try {
      const permission_ids = Array.from(selectedPerms);
      if (isEdit) {
        await adminService.updateRole(role.id, {
          display_name: form.display_name,
          description:  form.description,
        });
        await adminService.setRolePermissions(role.id, permission_ids);
      } else {
        await adminService.createRole({ ...form, permission_ids });
      }
      onSaved();
      onClose();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: '16px' } }}>
      <DialogTitle sx={{ fontWeight: 800, fontSize: '1.1rem', pb: 0.5 }}>
        {isEdit ? `Modifier — ${role.display_name}` : 'Créer un rôle'}
      </DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '10px' }}>{error}</Alert>}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
          {!isEdit && (
            <TextField label="Identifiant (slug)" size="small" fullWidth
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value.toLowerCase().replace(/[^a-z_]/g, '') }))}
              placeholder="ex: moderateur"
              helperText="Minuscules et underscores uniquement. Ne peut pas être modifié après création."
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
            />
          )}
          <TextField label="Nom affiché" size="small" fullWidth
            value={form.display_name}
            onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
            placeholder="ex: Modérateur"
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
          />
          <TextField label="Description" size="small" fullWidth multiline rows={2}
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Ce rôle peut…"
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
          />
        </Box>

        <Divider sx={{ mb: 2 }} />
        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', mb: 1.5, color: C.indigo }}>
          Permissions
        </Typography>

        {Object.keys(grouped).length === 0
          ? <CircularProgress size={20} />
          : <PermissionsEditor
              grouped={grouped}
              selected={selectedPerms}
              onChange={setSelectedPerms}
              readOnly={isEdit && role?.is_system}
            />
        }
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} sx={{ borderRadius: '10px', textTransform: 'none', color: '#666' }}>
          Annuler
        </Button>
        <Button onClick={save} variant="contained" disabled={saving || !form.display_name.trim() || (!isEdit && !form.name.trim())}
          startIcon={saving ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : null}
          sx={{ borderRadius: '10px', textTransform: 'none', bgcolor: C.primary, '&:hover': { bgcolor: '#9a4f15' } }}>
          {isEdit ? 'Enregistrer' : 'Créer le rôle'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminRolesPage() {
  const [roles, setRoles]               = useState([]);
  const [grouped, setGrouped]           = useState({});
  const [allPermissions, setAllPerms]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [dialogOpen, setDialogOpen]     = useState(false);
  const [editRole, setEditRole]         = useState(null);
  const [deleteRole, setDeleteRoleItem] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        adminService.getRoles(),
        adminService.getAllPermissions(),
      ]);
      setRoles(rolesRes.roles || []);
      setGrouped(permsRes.grouped || {});
      setAllPerms(permsRes.permissions || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setEditRole(null); setDialogOpen(true); }
  function openEdit(role) { setEditRole(role); setDialogOpen(true); }

  function handleDeleted(id) {
    setRoles(prev => prev.filter(r => r.id !== id));
  }

  async function handleDeleteRole() {
    if (!deleteRole) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await adminService.deleteRole(deleteRole.id);
      handleDeleted(deleteRole.id);
      setDeleteRoleItem(null);
    } catch (e) {
      setDeleteError(e.message);
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <Box sx={{ p: 4 }}>
      <AdminPageHeader
        title="Rôles & Permissions"
        subtitle={`${roles.length} rôle${roles.length > 1 ? 's' : ''} — dont ${roles.filter(r => r.is_system).length} système`}
        actions={(
          <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={openCreate}
            sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700, bgcolor: C.primary, '&:hover': { bgcolor: '#9a4f15' } }}>
            Nouveau rôle
          </Button>
        )}
      />

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }}>{error}</Alert>}

      {/* Roles grid */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 2 }}>
        {loading
          ? [...Array(4)].map((_, i) => <Skeleton key={i} variant="rounded" height={160} sx={{ borderRadius: '16px' }} />)
          : roles.length === 0
            ? <AdminEmptyState title="Aucun rôle" description="Créez un premier rôle pour structurer les accès du back-office." />
          : roles.map(role => {
              const { color, bg } = roleColor(role.name);
              return (
                <Card key={role.id} sx={{ borderRadius: '16px', p: 2.5,
                  boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                  border: `1px solid ${bg}`,
                  transition: 'box-shadow 0.2s',
                  '&:hover': { boxShadow: '0 4px 20px rgba(0,0,0,0.10)' } }}>

                  {/* Card header */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <SecurityOutlinedIcon sx={{ fontSize: 20, color }} />
                      <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: C.indigo }}>
                        {role.display_name}
                      </Typography>
                      {role.is_system && (
                        <Tooltip title="Rôle système — non supprimable">
                          <LockOutlinedIcon sx={{ fontSize: 14, color: '#bbb' }} />
                        </Tooltip>
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title="Modifier les permissions">
                        <IconButton size="small" onClick={() => openEdit(role)}
                          sx={{ color: C.indigo, '&:hover': { bgcolor: '#e8eaf6' } }}>
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {!role.is_system && (
                        <Tooltip title="Supprimer">
                          <IconButton size="small" onClick={() => setDeleteRoleItem(role)}
                            sx={{ color: C.red, '&:hover': { bgcolor: '#ffebee' } }}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </Box>

                  {/* Slug */}
                  <Chip label={role.name} size="small"
                    sx={{ bgcolor: bg, color, fontWeight: 700, fontSize: '11px', height: 20, mb: 1 }} />

                  {/* Description */}
                  {role.description && (
                    <Typography variant="body2" sx={{ color: '#777', fontSize: '0.8rem', mb: 1.5, lineHeight: 1.4 }}>
                      {role.description}
                    </Typography>
                  )}

                  {/* User count */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 'auto' }}>
                    <PeopleOutlinedIcon sx={{ fontSize: 15, color: '#bbb' }} />
                    <Typography variant="caption" sx={{ color: '#999', fontWeight: 600 }}>
                      {role.user_count} utilisateur{role.user_count !== 1 ? 's' : ''}
                    </Typography>
                  </Box>
                </Card>
              );
            })
        }
      </Box>

      {/* Create / Edit dialog */}
      <RoleDialog
        open={dialogOpen}
        role={editRole}
        grouped={grouped}
        allPermissions={allPermissions}
        onClose={() => setDialogOpen(false)}
        onSaved={load}
      />

      {/* Delete confirmation */}
      <AdminConfirmDialog
        open={Boolean(deleteRole)}
        title="Supprimer le rôle ?"
        body={
          deleteError
            ? deleteError
            : `Le rôle ${deleteRole?.display_name || ''} sera supprimé définitivement. Cette action est irréversible.`
        }
        confirmLabel={deleteLoading ? 'Suppression…' : 'Supprimer'}
        confirmColor="error"
        onCancel={() => { setDeleteRoleItem(null); setDeleteError(null); }}
        onConfirm={handleDeleteRole}
      />
    </Box>
  );
}
