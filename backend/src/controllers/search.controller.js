/**
 * Search Controller
 * Handlers pour la recherche avec Meilisearch + fallback DB
 */

const meilisearchService = require('../services/meilisearch.service');
const { supabase } = require('../config/database');

// ── DB fallback search ──────────────────────────────────────────
async function dbSearch({ query, limit, offset, type, language, category }) {
  let q = supabase
    .from('contents')
    .select(
      'id, title, author, description, content_type, language, cover_url, published_at, created_at',
      { count: 'exact' }
    )
    .eq('is_published', true)
    .is('deleted_at', null);

  if (query) {
    q = q.or(`title.ilike.%${query}%,author.ilike.%${query}%,description.ilike.%${query}%`);
  }
  if (type)     q = q.eq('content_type', type);
  if (language) q = q.eq('language', language);

  if (category) {
    const { data: cat } = await supabase.from('categories').select('id').eq('slug', category).single();
    if (cat) {
      const { data: cids } = await supabase.from('content_categories').select('content_id').eq('category_id', cat.id);
      const ids = (cids || []).map(c => c.content_id);
      if (ids.length > 0) q = q.in('id', ids);
      else return { results: [], total: 0 };
    }
  }

  q = q.order('published_at', { ascending: false }).range(offset, offset + limit - 1);

  const { data, count, error } = await q;
  if (error) throw error;
  return { results: data || [], total: count || 0 };
}

/**
 * GET /api/search
 * Search contents — Meilisearch first, DB fallback
 */
async function searchContents(req, res) {
  try {
    const { q = '', limit = 20, offset = 0, type, language, category, sort } = req.query;
    const lim = Math.min(parseInt(limit) || 20, 100);
    const off = parseInt(offset) || 0;

    // Try Meilisearch first
    try {
      const isHealthy = await meilisearchService.healthCheck();
      if (isHealthy) {
        const results = await meilisearchService.search({ query: q, limit: lim, offset: off, type, language, category, sort });
        return res.json({
          success: true,
          data: { results: results.results, total: results.total, processingTime: results.processingTime, query: q, engine: 'meilisearch' },
        });
      }
    } catch (_) { /* fall through to DB */ }

    // DB fallback
    const { results, total } = await dbSearch({ query: q, limit: lim, offset: off, type, language, category });
    return res.json({
      success: true,
      data: {
        results,
        total,
        query: q,
        engine: 'db',
      },
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'SEARCH_FAILED', message: 'Erreur lors de la recherche.' },
    });
  }
}

/**
 * GET /api/search/suggest?q=
 * Autocomplete — returns up to 6 title/author suggestions
 */
async function suggestContents(req, res) {
  try {
    const { q = '' } = req.query;
    if (!q || q.length < 2) return res.json({ success: true, data: [] });

    // Try Meilisearch first
    try {
      const isHealthy = await meilisearchService.healthCheck();
      if (isHealthy) {
        const results = await meilisearchService.search({
          query: q, limit: 6, offset: 0,
        });
        const suggestions = (results.results || []).map(r => ({
          id: r.id,
          title: r.title,
          author: r.author || r.author_name,
          content_type: r.content_type,
          cover_url: r.cover_url,
        }));
        return res.json({ success: true, data: suggestions });
      }
    } catch { /* fallback */ }

    // DB fallback
    const { data } = await supabase
      .from('contents')
      .select('id, title, author, content_type, cover_url')
      .eq('is_published', true)
      .is('deleted_at', null)
      .or(`title.ilike.%${q}%,author.ilike.%${q}%`)
      .order('published_at', { ascending: false })
      .limit(6);

    const suggestions = (data || []).map(r => ({
      id: r.id,
      title: r.title,
      author: r.author,
      content_type: r.content_type,
      cover_url: r.cover_url,
    }));

    res.json({ success: true, data: suggestions });
  } catch (error) {
    console.error('Suggest error:', error);
    res.json({ success: true, data: [] }); // never break the UI
  }
}

/**
 * POST /api/search/index
 * Re-index all contents (admin only)
 */
async function reindexContents(req, res) {
  try {
    const isHealthy = await meilisearchService.healthCheck();
    if (!isHealthy) {
      return res.status(503).json({
        success: false,
        error: { code: 'SEARCH_UNAVAILABLE', message: 'Meilisearch est indisponible.' },
      });
    }
    await meilisearchService.initializeIndex();
    const task = await meilisearchService.indexAllContents();
    res.json({ success: true, message: 'Indexation en cours…', data: { taskId: task.taskUid } });
  } catch (error) {
    console.error('Reindex error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'REINDEX_FAILED', message: 'Erreur lors de la réindexation.' },
    });
  }
}

/**
 * GET /api/search/stats
 * Get search index stats (admin only)
 */
async function getSearchStats(req, res) {
  try {
    const isHealthy = await meilisearchService.healthCheck();
    if (!isHealthy) {
      return res.json({ success: true, data: { available: false, engine: 'db' } });
    }
    const stats = await meilisearchService.getStats();
    res.json({ success: true, data: { ...stats, available: true, engine: 'meilisearch' } });
  } catch (error) {
    res.json({ success: true, data: { available: false, engine: 'db' } });
  }
}

module.exports = { searchContents, suggestContents, reindexContents, getSearchStats };
