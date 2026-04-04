/**
 * Admin Geographic Pricing Routes
 * Mounted on /api/admin/geo-pricing
 */
const express = require('express');
const router  = express.Router();
const { verifyJWT, requireRole } = require('../middleware/auth');
const { supabaseAdmin } = require('../config/database');

const isAdmin = [verifyJWT, requireRole('admin')];

// ── GET /  — all contents that have geo pricing, with their zones ──
router.get('/', isAdmin, async (req, res) => {
  try {
    const { data: prices, error } = await supabaseAdmin
      .from('content_geographic_pricing')
      .select(`
        id, content_id, zone, zone_label, price_cents, currency, is_active, notes,
        contents ( id, title, price_cents, price_currency, access_type, content_type )
      `)
      .order('content_id')
      .order('zone');

    if (error) throw error;

    // Group by content
    const map = {};
    for (const row of (prices || [])) {
      const cid = row.content_id;
      if (!map[cid]) {
        map[cid] = { content: row.contents, zones: [] };
      }
      map[cid].zones.push({
        id: row.id, zone: row.zone, zone_label: row.zone_label,
        price_cents: row.price_cents, currency: row.currency,
        is_active: row.is_active, notes: row.notes,
      });
    }

    return res.json(Object.values(map));
  } catch (err) {
    console.error('[admin.geo] GET /:', err);
    return res.status(500).json({ error: 'Erreur chargement tarifs géographiques.' });
  }
});

// ── GET /contents  — list contents for select picker ──────────
router.get('/contents', isAdmin, async (req, res) => {
  try {
    const { search } = req.query;
    let query = supabaseAdmin
      .from('contents')
      .select('id, title, content_type, price_cents, price_currency, access_type')
      .eq('is_published', true)
      .order('title');

    if (search) query = query.ilike('title', `%${search}%`);
    query = query.limit(50);

    const { data, error } = await query;
    if (error) throw error;
    return res.json(data || []);
  } catch (err) {
    console.error('[admin.geo] GET /contents:', err);
    return res.status(500).json({ error: 'Erreur chargement contenus.' });
  }
});

// ── GET /:contentId  — zones for a specific content ───────────
router.get('/:contentId', isAdmin, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('content_geographic_pricing')
      .select('*')
      .eq('content_id', req.params.contentId)
      .order('zone');

    if (error) throw error;
    return res.json(data || []);
  } catch (err) {
    console.error('[admin.geo] GET /:contentId:', err);
    return res.status(500).json({ error: 'Erreur chargement zones.' });
  }
});

// ── POST /:contentId  — add a zone for a content ──────────────
router.post('/:contentId', isAdmin, express.json(), async (req, res) => {
  try {
    const { zone, zone_label, price_cents, currency, notes, is_active } = req.body;
    if (!zone || price_cents == null) {
      return res.status(400).json({ error: 'zone et price_cents sont requis.' });
    }

    const { data, error } = await supabaseAdmin
      .from('content_geographic_pricing')
      .insert({
        content_id: req.params.contentId,
        zone, zone_label: zone_label || zone,
        price_cents: Number(price_cents),
        currency: currency || 'EUR',
        notes: notes || null,
        is_active: is_active !== false,
      })
      .select().single();

    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'Cette zone existe déjà pour ce contenu.' });
      throw error;
    }
    return res.status(201).json(data);
  } catch (err) {
    console.error('[admin.geo] POST /:contentId:', err);
    return res.status(500).json({ error: 'Erreur ajout zone.' });
  }
});

// ── PUT /entry/:id  — update a zone entry ─────────────────────
router.put('/entry/:id', isAdmin, express.json(), async (req, res) => {
  try {
    const { price_cents, currency, notes, is_active } = req.body;
    const patch = { updated_at: new Date().toISOString() };
    if (price_cents  !== undefined) patch.price_cents = Number(price_cents);
    if (currency     !== undefined) patch.currency    = currency;
    if (notes        !== undefined) patch.notes       = notes || null;
    if (is_active    !== undefined) patch.is_active   = is_active;

    const { data, error } = await supabaseAdmin
      .from('content_geographic_pricing')
      .update(patch)
      .eq('id', req.params.id)
      .select().single();

    if (error) throw error;
    return res.json(data);
  } catch (err) {
    console.error('[admin.geo] PUT /entry/:id:', err);
    return res.status(500).json({ error: 'Erreur mise à jour zone.' });
  }
});

// ── DELETE /entry/:id  — remove a zone entry ──────────────────
router.delete('/entry/:id', isAdmin, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('content_geographic_pricing')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    return res.json({ success: true });
  } catch (err) {
    console.error('[admin.geo] DELETE /entry/:id:', err);
    return res.status(500).json({ error: 'Erreur suppression zone.' });
  }
});

module.exports = router;
