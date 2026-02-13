/**
 * Search Controller
 * Handlers pour la recherche avec Meilisearch
 */

const meilisearchService = require('../services/meilisearch.service');

/**
 * GET /search
 * Search contents with Meilisearch
 */
async function searchContents(req, res) {
  try {
    const { q, limit, offset, type, language, category, sort } = req.query;

    // Check if Meilisearch is available
    const isHealthy = await meilisearchService.healthCheck();
    if (!isHealthy) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'SEARCH_UNAVAILABLE',
          message: 'Le service de recherche est temporairement indisponible.',
        },
      });
    }

    const results = await meilisearchService.search({
      query: q || '',
      limit: parseInt(limit) || 20,
      offset: parseInt(offset) || 0,
      type,
      language,
      category,
      sort,
    });

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SEARCH_FAILED',
        message: 'Erreur lors de la recherche.',
      },
    });
  }
}

/**
 * POST /search/index
 * Re-index all contents (admin only)
 */
async function reindexContents(req, res) {
  try {
    // Check if Meilisearch is available
    const isHealthy = await meilisearchService.healthCheck();
    if (!isHealthy) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'SEARCH_UNAVAILABLE',
          message: 'Le service de recherche est temporairement indisponible.',
        },
      });
    }

    // Initialize index if needed
    await meilisearchService.initializeIndex();

    // Index all contents
    const task = await meilisearchService.indexAllContents();

    res.json({
      success: true,
      message: 'Indexation en cours...',
      data: {
        taskId: task.taskUid,
      },
    });
  } catch (error) {
    console.error('Reindex error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'REINDEX_FAILED',
        message: 'Erreur lors de la réindexation.',
      },
    });
  }
}

/**
 * GET /search/stats
 * Get search index stats (admin only)
 */
async function getSearchStats(req, res) {
  try {
    const stats = await meilisearchService.getStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'STATS_FAILED',
        message: 'Erreur lors de la récupération des statistiques.',
      },
    });
  }
}

module.exports = {
  searchContents,
  reindexContents,
  getSearchStats,
};
