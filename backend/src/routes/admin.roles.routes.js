/**
 * Admin Roles & Permissions Routes — /api/admin/roles
 * CRUD roles, gestion permissions par rôle
 * Protected by verifyJWT + requireRole('admin')
 */

const express = require('express');
const router  = express.Router();
const { verifyJWT, requirePermissionForMethod, clearPermissionsCache } = require('../middleware/auth');
const { supabaseAdmin } = require('../config/database');
const { logResourceCreated, logResourceUpdated, logResourceDeleted } = require('../services/audit.service');

const isAdmin = [verifyJWT, requirePermissionForMethod({ read: 'roles.read', write: 'roles.write', delete: 'roles.delete' })];

// ── GET /api/admin/roles — liste tous les rôles avec nb d'utilisateurs ────────
router.get('/', ...isAdmin, async (req, res) => {
  try {
    const { data: roles, error } = await supabaseAdmin
      .from('roles')
      .select('*')
      .order('is_system', { ascending: false })
      .order('created_at', { ascending: true });
    if (error) throw error;

    // Enrichir avec le nb d'utilisateurs et de permissions par rôle
    const roleNames = roles.map(r => r.name);
    const userCounts = {};
    const permCounts = {};
    await Promise.all([
      ...roleNames.map(async (name) => {
        const { count } = await supabaseAdmin
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('role', name);
        userCounts[name] = count || 0;
      }),
      ...roles.map(async (role) => {
        const { count } = await supabaseAdmin
          .from('role_permissions')
          .select('permission_id', { count: 'exact', head: true })
          .eq('role_id', role.id);
        permCounts[role.id] = count || 0;
      }),
    ]);

    const result = roles.map(r => ({
      ...r,
      user_count: userCounts[r.name] || 0,
      permission_count: permCounts[r.id] || 0,
    }));
    res.json({ roles: result });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/admin/roles/:id — détail rôle + ses permissions ─────────────────
router.get('/:id', ...isAdmin, async (req, res) => {
  try {
    const { data: role, error } = await supabaseAdmin
      .from('roles').select('*').eq('id', req.params.id).single();
    if (error || !role) return res.status(404).json({ error: 'Rôle introuvable.' });

    const { data: rp } = await supabaseAdmin
      .from('role_permissions')
      .select('permissions(id, key, resource, action, description)')
      .eq('role_id', role.id);

    const rolePermissions = (rp || []).map(r => r.permissions).filter(Boolean);
    res.json({ role, permissions: rolePermissions });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/admin/permissions — liste toutes les permissions disponibles ─────
router.get('/permissions/all', ...isAdmin, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('permissions')
      .select('*')
      .order('resource', { ascending: true })
      .order('action',   { ascending: true });
    if (error) throw error;

    // Grouper par ressource pour l'UI
    const grouped = {};
    (data || []).forEach(p => {
      if (!grouped[p.resource]) grouped[p.resource] = [];
      grouped[p.resource].push(p);
    });

    res.json({ permissions: data, grouped });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/admin/roles — créer un rôle custom ──────────────────────────────
router.post('/', ...isAdmin, express.json(), async (req, res) => {
  try {
    const { name, display_name, description, permission_ids = [] } = req.body;
    if (!name || !display_name) return res.status(400).json({ error: 'name et display_name requis.' });

    // Valider le slug
    if (!/^[a-z_]{2,50}$/.test(name)) {
      return res.status(400).json({ error: 'name doit être en minuscules, lettres et underscores uniquement (2-50 chars).' });
    }

    // Créer le rôle
    const { data: role, error } = await supabaseAdmin
      .from('roles')
      .insert({ name, display_name, description: description || null, is_system: false })
      .select().single();
    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: `Le rôle '${name}' existe déjà.` });
      throw error;
    }

    // Attacher les permissions
    if (permission_ids.length > 0) {
      const inserts = permission_ids.map(pid => ({ role_id: role.id, permission_id: pid }));
      const { error: rpError } = await supabaseAdmin.from('role_permissions').insert(inserts);
      if (rpError) throw rpError;
    }

    clearPermissionsCache(name);

    await logResourceCreated(req.user.id, 'roles', role.id,
      { name, display_name, permission_count: permission_ids.length },
      { ip_address: req.headers['x-forwarded-for'] || req.ip }
    );

    res.status(201).json({ success: true, role });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── PATCH /api/admin/roles/:id — modifier display_name/description ────────────
router.patch('/:id', ...isAdmin, express.json(), async (req, res) => {
  try {
    const { display_name, description } = req.body;

    const { data: current, error: fetchErr } = await supabaseAdmin
      .from('roles').select('*').eq('id', req.params.id).single();
    if (fetchErr || !current) return res.status(404).json({ error: 'Rôle introuvable.' });

    // On ne peut pas modifier le name d'un rôle système ni d'un rôle custom
    const updates = {};
    if (display_name !== undefined) updates.display_name = display_name;
    if (description  !== undefined) updates.description  = description;
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'Aucun champ à modifier.' });

    const { data: updated, error } = await supabaseAdmin
      .from('roles').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;

    clearPermissionsCache(current.name);
    await logResourceUpdated(req.user.id, 'roles', req.params.id,
      { display_name: current.display_name, description: current.description },
      { display_name: updated.display_name, description: updated.description },
      { ip_address: req.headers['x-forwarded-for'] || req.ip }
    );

    res.json({ success: true, role: updated });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── PUT /api/admin/roles/:id/permissions — remplacer toutes les permissions ───
router.put('/:id/permissions', ...isAdmin, express.json(), async (req, res) => {
  try {
    const { permission_ids = [] } = req.body;

    const { data: role, error: fetchErr } = await supabaseAdmin
      .from('roles').select('name, is_system').eq('id', req.params.id).single();
    if (fetchErr || !role) return res.status(404).json({ error: 'Rôle introuvable.' });

    // Supprimer les anciennes permissions
    await supabaseAdmin.from('role_permissions').delete().eq('role_id', req.params.id);

    // Insérer les nouvelles
    if (permission_ids.length > 0) {
      const inserts = permission_ids.map(pid => ({ role_id: req.params.id, permission_id: pid }));
      const { error: rpError } = await supabaseAdmin.from('role_permissions').insert(inserts);
      if (rpError) throw rpError;
    }

    clearPermissionsCache(role.name);
    await logResourceUpdated(req.user.id, 'roles', req.params.id,
      { action: 'permissions_replaced' },
      { permission_count: permission_ids.length },
      { ip_address: req.headers['x-forwarded-for'] || req.ip }
    );

    res.json({ success: true, permission_count: permission_ids.length });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ── DELETE /api/admin/roles/:id — supprimer un rôle custom ───────────────────
router.delete('/:id', ...isAdmin, async (req, res) => {
  try {
    const { data: role, error: fetchErr } = await supabaseAdmin
      .from('roles').select('*').eq('id', req.params.id).single();
    if (fetchErr || !role) return res.status(404).json({ error: 'Rôle introuvable.' });

    if (role.is_system) {
      return res.status(403).json({ error: 'Les rôles système (user, admin, publisher) ne peuvent pas être supprimés.' });
    }

    // Vérifier qu'aucun utilisateur n'a ce rôle
    const { count } = await supabaseAdmin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', role.name);

    if (count > 0) {
      return res.status(409).json({
        error: `Impossible — ${count} utilisateur(s) ont ce rôle. Réassignez-les d'abord.`,
      });
    }

    await supabaseAdmin.from('roles').delete().eq('id', req.params.id);
    clearPermissionsCache(role.name);

    await logResourceDeleted(req.user.id, 'roles', req.params.id,
      { name: role.name, display_name: role.display_name },
      { ip_address: req.headers['x-forwarded-for'] || req.ip }
    );

    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
