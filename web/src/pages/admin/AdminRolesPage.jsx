import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Card, Button, Chip, IconButton, CircularProgress, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Tooltip,
  Checkbox, Divider, Skeleton,
} from '@mui/material';
import AddOutlinedIcon               from '@mui/icons-material/AddOutlined';
import EditOutlinedIcon              from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon             from '@mui/icons-material/DeleteOutline';
import LockOutlinedIcon              from '@mui/icons-material/LockOutlined';
import PeopleOutlinedIcon            from '@mui/icons-material/PeopleOutlined';
import SecurityOutlinedIcon          from '@mui/icons-material/SecurityOutlined';
import MenuBookOutlinedIcon          from '@mui/icons-material/MenuBookOutlined';
import CreditCardOutlinedIcon        from '@mui/icons-material/CreditCardOutlined';
import BarChartOutlinedIcon          from '@mui/icons-material/BarChartOutlined';
import SettingsOutlinedIcon          from '@mui/icons-material/SettingsOutlined';
import NotificationsOutlinedIcon     from '@mui/icons-material/NotificationsOutlined';
import CategoryOutlinedIcon          from '@mui/icons-material/CategoryOutlined';
import BusinessOutlinedIcon          from '@mui/icons-material/BusinessOutlined';
import LocalOfferOutlinedIcon        from '@mui/icons-material/LocalOfferOutlined';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import VpnKeyOutlinedIcon            from '@mui/icons-material/VpnKeyOutlined';
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

// Métadonnées par ressource
const RESOURCE_META = {
  users:         { label: 'Utilisateurs',  Icon: PeopleOutlinedIcon },
  content:       { label: 'Contenu',       Icon: MenuBookOutlinedIcon },
  subscriptions: { label: 'Abonnements',   Icon: CreditCardOutlinedIcon },
  analytics:     { label: 'Analytiques',   Icon: BarChartOutlinedIcon },
  settings:      { label: 'Paramètres',    Icon: SettingsOutlinedIcon },
  notifications: { label: 'Notifications', Icon: NotificationsOutlinedIcon },
  categories:    { label: 'Catégories',    Icon: CategoryOutlinedIcon },
  publishers:    { label: 'Éditeurs',      Icon: BusinessOutlinedIcon },
  promo_codes:   { label: 'Codes promo',   Icon: LocalOfferOutlinedIcon },
  roles:         { label: 'Rôles',         Icon: AdminPanelSettingsOutlinedIcon },
};

// Labels traduits pour les actions
const ACTION_LABELS = {
  read:          'Consulter',
  write:         'Modifier',
  delete:        'Supprimer',
  toggle_active: 'Activer/Bloquer',
  publish:       'Publier',
  cancel:        'Annuler',
  extend:        'Prolonger',
  send:          'Envoyer',
  approve:       'Approuver',
};

// Couleur par rôle
function roleColor(name) {
  if (name === 'admin')     return { color: C.purple, bg: '#ede7f6' };
  if (name === 'publisher') return { color: C.or,     bg: '#fff8e1' };
  if (name === 'user')      return { color: '#666',   bg: '#f5f5f5' };
  return { color: C.indigo, bg: '#e8eaf6' };
}

// ── Éditeur de permissions — grille de chips ─────────────────────────────────
function PermissionsEditor({ grouped, selected, onChange, readOnly }) {
  const resources = Object.keys(grouped).sort();

  function toggleAll(resource, permIds) {
    const allSelected = permIds.every(id => selected.has(id));
    const next = new Set(selected);
    if (allSelected) {
      permIds.forEach(id => next.delete(id));
    } else {
      permIds.forEach(id => next.add(id));
    }
    onChange(next);
  }

  function toggle(id) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(next);
  }

  // Compteur global
  const totalPerms = Object.values(grouped).reduce((s, p) => s + p.length, 0);
  const selectedCount = resources.reduce((s, r) => {
    return s + grouped[r].filter(p => selected.has(p.id)).length;
  }, 0);

  function toggleAllGlobal() {
    const allIds = Object.values(grouped).flatMap(p => p.map(x => x.id));
    const allSelected = allIds.every(id => selected.has(id));
    const next = new Set(allSelected ? [] : allIds);
    onChange(next);
  }

  return (
    <Box>
      {/* Header global */}
      {!readOnly && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2,
          px: 1.5, py: 1, bgcolor: '#f8f8f8', borderRadius: '10px', border: '1px solid #efefef' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <VpnKeyOutlinedIcon sx={{ fontSize: 15, color: '#999' }} />
            <Typography sx={{ fontSize: '0.78rem', color: '#666', fontWeight: 600 }}>
              {selectedCount} / {totalPerms} permissions sélectionnées
            </Typography>
          </Box>
          <Button size="small" onClick={toggleAllGlobal}
            sx={{ fontSize: '0.72rem', textTransform: 'none', color: C.indigo, fontWeight: 700,
              px: 1.5, borderRadius: '8px', '&:hover': { bgcolor: '#e8eaf6' } }}>
            {selectedCount === totalPerms ? 'Tout désélectionner' : 'Tout sélectionner'}
          </Button>
        </Box>
      )}

      {/* Grille 2 colonnes */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25 }}>
        {resources.map(resource => {
          const perms = grouped[resource];
          const permIds = perms.map(p => p.id);
          const selCount = permIds.filter(id => selected.has(id)).length;
          const allChecked = selCount === permIds.length;
          const someChecked = selCount > 0 && !allChecked;
          const meta = RESOURCE_META[resource] || { label: resource, Icon: SecurityOutlinedIcon };
          const { Icon } = meta;

          return (
            <Box key={resource} sx={{
              border: '1px solid',
              borderColor: allChecked ? `${C.primary}50` : someChecked ? `${C.indigo}30` : '#e8e8e8',
              borderRadius: '12px',
              p: 1.5,
              bgcolor: allChecked ? `${C.primary}07` : someChecked ? `${C.indigo}04` : '#fafafa',
              transition: 'border-color 0.15s, background-color 0.15s',
            }}>
              {/* En-tête ressource */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Icon sx={{ fontSize: 15, color: allChecked ? C.primary : C.indigo }} />
                  <Typography sx={{ fontWeight: 700, fontSize: '0.76rem',
                    color: allChecked ? C.primary : C.indigo, letterSpacing: '0.02em' }}>
                    {meta.label}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography sx={{ fontSize: '0.68rem', color: selCount > 0 ? C.primary : '#bbb',
                    fontWeight: 600, minWidth: 28, textAlign: 'right' }}>
                    {selCount}/{permIds.length}
                  </Typography>
                  {!readOnly && (
                    <Checkbox
                      size="small"
                      checked={allChecked}
                      indeterminate={someChecked}
                      onChange={() => toggleAll(resource, permIds)}
                      sx={{ p: 0.25, ml: 0.25,
                        color: '#ccc',
                        '&.Mui-checked':        { color: C.primary },
                        '&.MuiCheckbox-indeterminate': { color: C.indigo },
                      }}
                    />
                  )}
                </Box>
              </Box>

              {/* Chips d'actions */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {perms.map(p => {
                  const isOn = selected.has(p.id);
                  return (
                    <Tooltip key={p.id} title={p.description || ''} arrow placement="top">
                      <Chip
                        label={ACTION_LABELS[p.action] || p.action}
                        size="small"
                        onClick={readOnly ? undefined : () => toggle(p.id)}
                        sx={{
                          height: 22,
                          fontSize: '0.7rem',
                          fontWeight: isOn ? 700 : 400,
                          cursor: readOnly ? 'default' : 'pointer',
                          bgcolor: isOn ? C.primary : 'transparent',
                          color: isOn ? '#fff' : '#888',
                          border: '1px solid',
                          borderColor: isOn ? C.primary : '#ddd',
                          borderRadius: '6px',
                          transition: 'all 0.12s',
                          '& .MuiChip-label': { px: 1 },
                          '&:hover': readOnly ? {} : {
                            bgcolor: isOn ? '#9a4f15' : '#f0f0f0',
                            borderColor: isOn ? '#9a4f15' : '#bbb',
                            color: isOn ? '#fff' : '#555',
                          },
                        }}
                      />
                    </Tooltip>
                  );
                })}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

// ── Dialog : créer / éditer un rôle ─────────────────────────────────────────
function RoleDialog({ open, role, grouped, allPermissions, onClose, onSaved }) {
  const isEdit = Boolean(role);
  const [form, setForm]               = useState({ name: '', display_name: '', description: '' });
  const [selectedPerms, setSelectedPerms] = useState(new Set());
  const [saving, setSaving]           = useState(false);
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [error, setError]             = useState(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (role) {
      setForm({ name: role.name, display_name: role.display_name, description: role.description || '' });
      setLoadingPerms(true);
      adminService.getRole(role.id)
        .then(d => setSelectedPerms(new Set((d.permissions || []).map(p => p.id))))
        .catch(() => setSelectedPerms(new Set()))
        .finally(() => setLoadingPerms(false));
    } else {
      setForm({ name: '', display_name: '', description: '' });
      setSelectedPerms(new Set());
    }
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

  const hasPermissions = Object.keys(grouped).length > 0;
  const isSystemReadOnly = isEdit && role?.is_system;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { borderRadius: '20px' } }}>
      <DialogTitle sx={{ fontWeight: 800, fontSize: '1.1rem', pb: 0.5, pt: 2.5, px: 3 }}>
        {isEdit ? `Modifier — ${role.display_name}` : 'Créer un rôle'}
      </DialogTitle>

      <DialogContent sx={{ pt: 1.5, px: 3 }}>
        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '10px' }}>{error}</Alert>}

        {/* Champs nom / description */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          {!isEdit && (
            <TextField label="Identifiant (slug)" size="small"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value.toLowerCase().replace(/[^a-z_]/g, '') }))}
              placeholder="ex: moderateur"
              helperText="Minuscules et underscores. Non modifiable après création."
              sx={{ flex: '1 1 160px', '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
            />
          )}
          <TextField label="Nom affiché" size="small"
            value={form.display_name}
            onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
            placeholder="ex: Modérateur"
            disabled={isSystemReadOnly}
            sx={{ flex: '1 1 180px', '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
          />
          <TextField label="Description" size="small" multiline rows={1}
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Ce rôle peut…"
            disabled={isSystemReadOnly}
            sx={{ flex: '2 1 240px', '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
          />
        </Box>

        <Divider sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: '0.75rem', color: '#aaa', fontWeight: 600, letterSpacing: '0.06em',
            textTransform: 'uppercase' }}>
            Permissions
          </Typography>
        </Divider>

        {isSystemReadOnly && (
          <Alert severity="info" icon={<LockOutlinedIcon fontSize="small" />}
            sx={{ mb: 2, borderRadius: '10px', fontSize: '0.8rem' }}>
            Les rôles système ont toutes les permissions — elles ne peuvent pas être modifiées ici.
          </Alert>
        )}

        {!hasPermissions || loadingPerms
          ? (
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25 }}>
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} variant="rounded" height={80} sx={{ borderRadius: '12px' }} />
              ))}
            </Box>
          )
          : (
            <PermissionsEditor
              grouped={grouped}
              selected={selectedPerms}
              onChange={setSelectedPerms}
              readOnly={isSystemReadOnly}
            />
          )
        }
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose}
          sx={{ borderRadius: '10px', textTransform: 'none', color: '#666' }}>
          Annuler
        </Button>
        <Button onClick={save} variant="contained"
          disabled={saving || !form.display_name.trim() || (!isEdit && !form.name.trim())}
          startIcon={saving ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : null}
          sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700,
            bgcolor: C.primary, '&:hover': { bgcolor: '#9a4f15' } }}>
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
  const [deleteError, setDeleteError]   = useState(null);

  const totalPerms = Object.values(grouped).reduce((s, p) => s + p.length, 0);

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

  async function handleDeleteRole() {
    if (!deleteRole) return;
    setDeleteLoading(true); setDeleteError(null);
    try {
      await adminService.deleteRole(deleteRole.id);
      setRoles(prev => prev.filter(r => r.id !== deleteRole.id));
      setDeleteRoleItem(null);
    } catch (e) { setDeleteError(e.message); }
    finally { setDeleteLoading(false); }
  }

  return (
    <Box sx={{ p: 4 }}>
      <AdminPageHeader
        title="Rôles & Permissions"
        subtitle={`${roles.length} rôle${roles.length > 1 ? 's' : ''} — ${roles.filter(r => r.is_system).length} système · ${totalPerms} permissions disponibles`}
        actions={(
          <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={openCreate}
            sx={{ borderRadius: '12px', textTransform: 'none', fontWeight: 700,
              bgcolor: C.primary, '&:hover': { bgcolor: '#9a4f15' } }}>
            Nouveau rôle
          </Button>
        )}
      />

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }}>{error}</Alert>}

      {/* Grille de rôles */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 2 }}>
        {loading
          ? [...Array(4)].map((_, i) => (
              <Skeleton key={i} variant="rounded" height={170} sx={{ borderRadius: '16px' }} />
            ))
          : roles.length === 0
            ? <AdminEmptyState title="Aucun rôle"
                description="Créez un premier rôle pour structurer les accès du back-office." />
            : roles.map(role => {
                const { color, bg } = roleColor(role.name);
                return (
                  <Card key={role.id} sx={{
                    borderRadius: '16px', p: 2.5,
                    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                    border: `1px solid ${bg}`,
                    transition: 'box-shadow 0.2s',
                    display: 'flex', flexDirection: 'column', gap: 1,
                    '&:hover': { boxShadow: '0 4px 20px rgba(0,0,0,0.10)' },
                  }}>
                    {/* Header */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <SecurityOutlinedIcon sx={{ fontSize: 18, color }} />
                        <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: C.indigo }}>
                          {role.display_name}
                        </Typography>
                        {role.is_system && (
                          <Tooltip title="Rôle système — non supprimable">
                            <LockOutlinedIcon sx={{ fontSize: 13, color: '#bbb' }} />
                          </Tooltip>
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title="Modifier les permissions">
                          <IconButton size="small" onClick={() => openEdit(role)}
                            sx={{ color: C.indigo, '&:hover': { bgcolor: '#e8eaf6' } }}>
                            <EditOutlinedIcon sx={{ fontSize: 17 }} />
                          </IconButton>
                        </Tooltip>
                        {!role.is_system && (
                          <Tooltip title="Supprimer">
                            <IconButton size="small" onClick={() => setDeleteRoleItem(role)}
                              sx={{ color: C.red, '&:hover': { bgcolor: '#ffebee' } }}>
                              <DeleteOutlineIcon sx={{ fontSize: 17 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </Box>

                    {/* Slug */}
                    <Chip label={role.name} size="small"
                      sx={{ bgcolor: bg, color, fontWeight: 700, fontSize: '11px',
                        height: 20, width: 'fit-content', borderRadius: '6px' }} />

                    {/* Description */}
                    {role.description && (
                      <Typography variant="body2" sx={{ color: '#888', fontSize: '0.8rem', lineHeight: 1.4 }}>
                        {role.description}
                      </Typography>
                    )}

                    <Divider sx={{ my: 0.5 }} />

                    {/* Stats */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <PeopleOutlinedIcon sx={{ fontSize: 14, color: '#bbb' }} />
                        <Typography variant="caption" sx={{ color: '#999', fontWeight: 600 }}>
                          {role.user_count} utilisateur{role.user_count !== 1 ? 's' : ''}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <VpnKeyOutlinedIcon sx={{ fontSize: 14, color: '#bbb' }} />
                        <Typography variant="caption" sx={{ color: '#999', fontWeight: 600 }}>
                          {role.permission_count ?? '—'} permission{(role.permission_count ?? 0) !== 1 ? 's' : ''}
                        </Typography>
                      </Box>
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
            : `Le rôle "${deleteRole?.display_name || ''}" sera supprimé définitivement. Cette action est irréversible.`
        }
        confirmLabel={deleteLoading ? 'Suppression…' : 'Supprimer'}
        confirmColor="error"
        onCancel={() => { setDeleteRoleItem(null); setDeleteError(null); }}
        onConfirm={handleDeleteRole}
      />
    </Box>
  );
}
