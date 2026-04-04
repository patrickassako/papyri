/**
 * Admin Promo Codes Routes
 * Mounted on /api/admin/promo-codes
 */
const express = require('express');
const router  = express.Router();
const { verifyJWT, requireRole } = require('../middleware/auth');
const { supabaseAdmin } = require('../config/database');

const isAdmin = [verifyJWT, requireRole('admin')];

// ─── GET /  — list all with usage count + filters ─────────────
router.get('/', isAdmin, async (req, res) => {
  try {
    const { status, scope, search } = req.query;
    // status: active | expired | inactive | all (default: all)
    // scope: global | publisher | all (default: all)

    let query = supabaseAdmin
      .from('promo_codes')
      .select(`
        id, code, description, discount_type, discount_value,
        max_uses, used_count, valid_from, valid_until,
        applicable_plans, applicable_contents,
        is_active, publisher_id, monthly_slot, created_at, updated_at,
        publishers ( id, company_name )
      `)
      .order('created_at', { ascending: false });

    if (status === 'active')   query = query.eq('is_active', true);
    if (status === 'inactive') query = query.eq('is_active', false);
    if (status === 'expired') {
      const now = new Date().toISOString();
      query = query.lt('valid_until', now).not('valid_until', 'is', null);
    }
    if (scope === 'global')    query = query.is('publisher_id', null);
    if (scope === 'publisher') query = query.not('publisher_id', 'is', null);
    if (search) query = query.ilike('code', `%${search}%`);

    const { data, error } = await query;
    if (error) throw error;

    const now = new Date();
    const result = (data || []).map(p => ({
      ...p,
      publisher: p.publishers || null,
      publishers: undefined,
      isExpired:  p.valid_until ? new Date(p.valid_until) < now : false,
      isPending:  p.valid_from  ? new Date(p.valid_from)  > now : false,
      usageRate:  p.max_uses ? Math.round((p.used_count / p.max_uses) * 100) : null,
    }));

    return res.json(result);
  } catch (err) {
    console.error('[admin.promos] GET /:', err);
    return res.status(500).json({ error: 'Erreur chargement codes promo.' });
  }
});

// ─── POST /  — create global code (publisher_id = null) ───────
router.post('/', isAdmin, express.json(), async (req, res) => {
  try {
    const {
      code, description, discount_type, discount_value,
      max_uses, valid_from, valid_until, applicable_plans, is_active,
    } = req.body;

    if (!code || !discount_type || discount_value == null) {
      return res.status(400).json({ error: 'code, discount_type et discount_value sont requis.' });
    }
    if (!['percent', 'fixed'].includes(discount_type)) {
      return res.status(400).json({ error: 'discount_type doit être percent ou fixed.' });
    }

    const { data, error } = await supabaseAdmin
      .from('promo_codes')
      .insert({
        code: code.trim().toUpperCase(),
        description:       description     || null,
        discount_type,
        discount_value:    Number(discount_value),
        max_uses:          max_uses        ? Number(max_uses) : null,
        valid_from:        valid_from      || null,
        valid_until:       valid_until     || null,
        applicable_plans:  applicable_plans?.length > 0 ? applicable_plans : null,
        is_active:         is_active !== false,
        publisher_id:      null,
        used_count:        0,
      })
      .select().single();

    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'Ce code promo existe déjà.' });
      throw error;
    }
    return res.status(201).json(data);
  } catch (err) {
    console.error('[admin.promos] POST /:', err);
    return res.status(500).json({ error: 'Erreur création code promo.' });
  }
});

// ─── PUT /:id  — update ───────────────────────────────────────
router.put('/:id', isAdmin, express.json(), async (req, res) => {
  try {
    const allowed = [
      'code', 'description', 'discount_type', 'discount_value',
      'max_uses', 'valid_from', 'valid_until', 'applicable_plans', 'is_active',
    ];
    const patch = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) patch[k] = req.body[k];
    }
    if (patch.code) patch.code = patch.code.trim().toUpperCase();
    patch.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('promo_codes')
      .update(patch)
      .eq('id', req.params.id)
      .select().single();
    if (error) throw error;
    return res.json(data);
  } catch (err) {
    console.error('[admin.promos] PUT /:id:', err);
    return res.status(500).json({ error: 'Erreur mise à jour code promo.' });
  }
});

// ─── PATCH /:id/toggle  — activate / deactivate ───────────────
router.patch('/:id/toggle', isAdmin, async (req, res) => {
  try {
    const { data: current } = await supabaseAdmin
      .from('promo_codes').select('is_active').eq('id', req.params.id).single();
    if (!current) return res.status(404).json({ error: 'Code introuvable.' });

    const { data, error } = await supabaseAdmin
      .from('promo_codes')
      .update({ is_active: !current.is_active, updated_at: new Date().toISOString() })
      .eq('id', req.params.id).select().single();
    if (error) throw error;
    return res.json(data);
  } catch (err) {
    console.error('[admin.promos] PATCH /:id/toggle:', err);
    return res.status(500).json({ error: 'Erreur toggle code promo.' });
  }
});

// ─── DELETE /:id ─────────────────────────────────────────────
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const { count } = await supabaseAdmin
      .from('promo_code_usages')
      .select('*', { count: 'exact', head: true })
      .eq('promo_code_id', req.params.id);

    if (count > 0) {
      return res.status(409).json({ error: `Ce code a déjà été utilisé ${count} fois. Désactivez-le plutôt que le supprimer.` });
    }

    const { error } = await supabaseAdmin
      .from('promo_codes').delete().eq('id', req.params.id);
    if (error) throw error;
    return res.json({ success: true });
  } catch (err) {
    console.error('[admin.promos] DELETE /:id:', err);
    return res.status(500).json({ error: 'Erreur suppression code promo.' });
  }
});

// ─── GET /:id/usages  — utilisation détaillée ─────────────────
router.get('/:id/usages', isAdmin, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('promo_code_usages')
      .select(`
        id, discount_applied, used_at,
        profiles ( id, full_name, email )
      `)
      .eq('promo_code_id', req.params.id)
      .order('used_at', { ascending: false });
    if (error) throw error;
    return res.json(data || []);
  } catch (err) {
    console.error('[admin.promos] GET /:id/usages:', err);
    return res.status(500).json({ error: 'Erreur chargement utilisations.' });
  }
});

module.exports = router;
