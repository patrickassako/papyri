/**
 * Admin Categories Routes
 * Mounted on /api/admin/categories
 */
const express = require('express');
const router  = express.Router();
const { verifyJWT, requirePermissionForMethod } = require('../middleware/auth');
const { supabaseAdmin } = require('../config/database');

const isAdmin = [verifyJWT, requirePermissionForMethod({ read: 'categories.read', write: 'categories.write', delete: 'categories.delete' })];

function slugify(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ─── GET /  — list all categories with book count ─────────────
router.get('/', isAdmin, async (req, res) => {
  try {
    const { data: cats, error } = await supabaseAdmin
      .from('categories')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;

    // Count books per category
    const ids = (cats || []).map(c => c.id);
    let countMap = {};
    if (ids.length > 0) {
      const { data: cc } = await supabaseAdmin
        .from('content_categories')
        .select('category_id');
      for (const row of (cc || [])) {
        countMap[row.category_id] = (countMap[row.category_id] || 0) + 1;
      }
    }

    const result = (cats || []).map(c => ({ ...c, book_count: countMap[c.id] || 0 }));
    return res.json(result);
  } catch (err) {
    console.error('[admin.cats] GET /:', err);
    return res.status(500).json({ error: 'Erreur chargement catégories.' });
  }
});

// ─── POST /  — create ─────────────────────────────────────────
router.post('/', isAdmin, express.json(), async (req, res) => {
  try {
    const { name, slug, description, icon } = req.body;
    if (!name) return res.status(400).json({ error: 'name est requis.' });

    const finalSlug = (slug || slugify(name));
    const { data, error } = await supabaseAdmin
      .from('categories')
      .insert({ name, slug: finalSlug, description: description || null, icon: icon || null })
      .select().single();
    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'Ce slug existe déjà.' });
      throw error;
    }
    return res.status(201).json(data);
  } catch (err) {
    console.error('[admin.cats] POST /:', err);
    return res.status(500).json({ error: 'Erreur création catégorie.' });
  }
});

// ─── PUT /:id  — update ───────────────────────────────────────
router.put('/:id', isAdmin, express.json(), async (req, res) => {
  try {
    const { name, slug, description, icon } = req.body;
    const patch = {};
    if (name        !== undefined) patch.name        = name;
    if (slug        !== undefined) patch.slug        = slug;
    if (description !== undefined) patch.description = description;
    if (icon        !== undefined) patch.icon        = icon;

    const { data, error } = await supabaseAdmin
      .from('categories')
      .update(patch)
      .eq('id', req.params.id)
      .select().single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Catégorie introuvable.' });
    return res.json(data);
  } catch (err) {
    console.error('[admin.cats] PUT /:id:', err);
    return res.status(500).json({ error: 'Erreur mise à jour catégorie.' });
  }
});

// ─── DELETE /:id ─────────────────────────────────────────────
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const { count } = await supabaseAdmin
      .from('content_categories')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', req.params.id);

    if (count > 0) {
      return res.status(409).json({ error: `Impossible de supprimer : ${count} livre(s) utilisent cette catégorie.` });
    }

    const { error } = await supabaseAdmin
      .from('categories')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    return res.json({ success: true });
  } catch (err) {
    console.error('[admin.cats] DELETE /:id:', err);
    return res.status(500).json({ error: 'Erreur suppression catégorie.' });
  }
});

module.exports = router;
