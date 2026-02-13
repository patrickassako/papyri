/**
 * Meilisearch Service
 * Gestion de l'indexation et de la recherche avec Meilisearch
 */

const { MeiliSearch } = require('meilisearch');
const contentsService = require('./contents.service');

// Initialize Meilisearch client
const client = new MeiliSearch({
  host: process.env.MEILISEARCH_HOST || 'http://localhost:7700',
  apiKey: process.env.MEILISEARCH_KEY || 'ChangeMe123456789',
});

const INDEX_NAME = 'contents';

/**
 * Initialize Meilisearch index with settings
 */
async function initializeIndex() {
  try {
    // Create index if it doesn't exist
    await client.createIndex(INDEX_NAME, { primaryKey: 'id' });

    const index = client.index(INDEX_NAME);

    // Configure searchable attributes with weights
    await index.updateSearchableAttributes([
      'title',
      'author',
      'description',
    ]);

    // Configure filterable attributes
    await index.updateFilterableAttributes([
      'content_type',
      'language',
      'categories',
      'is_published',
    ]);

    // Configure sortable attributes
    await index.updateSortableAttributes([
      'published_at',
      'title',
      'created_at',
    ]);

    // Configure ranking rules (typo tolerance, etc.)
    await index.updateRankingRules([
      'words',
      'typo',
      'proximity',
      'attribute',
      'sort',
      'exactness',
    ]);

    // Configure typo tolerance
    await index.updateTypoTolerance({
      enabled: true,
      minWordSizeForTypos: {
        oneTypo: 3,
        twoTypos: 7,
      },
    });

    console.log('✅ Meilisearch index initialized successfully');
    return true;
  } catch (error) {
    if (error.code === 'index_already_exists') {
      console.log('ℹ️  Meilisearch index already exists');
      return true;
    }
    console.error('❌ Meilisearch initialization error:', error);
    throw error;
  }
}

/**
 * Index a single content
 * @param {Object} content - Content to index
 */
async function indexContent(content) {
  try {
    const index = client.index(INDEX_NAME);

    // Transform content for indexing
    const document = {
      id: content.id,
      title: content.title,
      author: content.author,
      description: content.description || '',
      content_type: content.content_type,
      language: content.language,
      categories: content.categories?.map(c => c.slug) || [],
      cover_url: content.cover_url,
      is_published: content.is_published,
      published_at: content.published_at,
      created_at: content.created_at,
    };

    await index.addDocuments([document]);
    console.log(`✅ Content indexed: ${content.title}`);
  } catch (error) {
    console.error('❌ Index content error:', error);
    throw error;
  }
}

/**
 * Index all published contents
 */
async function indexAllContents() {
  try {
    const index = client.index(INDEX_NAME);

    // Get all published contents
    const { contents } = await contentsService.getContents({
      page: 1,
      limit: 1000, // Index up to 1000 contents at once
    });

    if (contents.length === 0) {
      console.log('ℹ️  No contents to index');
      return;
    }

    // Transform contents for indexing
    const documents = contents.map(content => ({
      id: content.id,
      title: content.title,
      author: content.author,
      description: content.description || '',
      content_type: content.content_type,
      language: content.language,
      categories: content.categories?.map(c => c.slug) || [],
      cover_url: content.cover_url,
      is_published: content.is_published,
      published_at: content.published_at,
      created_at: content.created_at,
    }));

    // Add all documents
    const task = await index.addDocuments(documents);
    console.log(`✅ Indexing ${documents.length} contents... Task ID: ${task.taskUid}`);

    return task;
  } catch (error) {
    console.error('❌ Index all contents error:', error);
    throw error;
  }
}

/**
 * Search contents with Meilisearch
 * @param {Object} options - Search options
 * @param {string} options.query - Search query
 * @param {number} options.limit - Results limit (default: 20)
 * @param {number} options.offset - Results offset (default: 0)
 * @param {string} options.type - Filter by type (ebook/audiobook)
 * @param {string} options.language - Filter by language
 * @param {string} options.category - Filter by category slug
 * @param {string} options.sort - Sort by field (published_at:desc, title:asc)
 * @returns {Promise<{results, total, processingTime}>}
 */
async function search(options = {}) {
  try {
    const {
      query = '',
      limit = 20,
      offset = 0,
      type,
      language,
      category,
      sort = 'published_at:desc',
    } = options;

    const index = client.index(INDEX_NAME);

    // Build filters
    const filters = ['is_published = true'];

    if (type) {
      filters.push(`content_type = '${type}'`);
    }

    if (language) {
      filters.push(`language = '${language}'`);
    }

    if (category) {
      filters.push(`categories = '${category}'`);
    }

    const filterString = filters.join(' AND ');

    // Search
    const searchResults = await index.search(query, {
      limit,
      offset,
      filter: filterString,
      sort: [sort],
      attributesToRetrieve: [
        'id',
        'title',
        'author',
        'description',
        'content_type',
        'language',
        'categories',
        'cover_url',
        'published_at',
      ],
    });

    return {
      results: searchResults.hits,
      total: searchResults.estimatedTotalHits,
      processingTime: searchResults.processingTimeMs,
      query,
    };
  } catch (error) {
    console.error('❌ Search error:', error);
    throw error;
  }
}

/**
 * Delete content from index
 * @param {string} contentId - Content UUID
 */
async function deleteContent(contentId) {
  try {
    const index = client.index(INDEX_NAME);
    await index.deleteDocument(contentId);
    console.log(`✅ Content removed from index: ${contentId}`);
  } catch (error) {
    console.error('❌ Delete content error:', error);
    throw error;
  }
}

/**
 * Clear entire index
 */
async function clearIndex() {
  try {
    const index = client.index(INDEX_NAME);
    await index.deleteAllDocuments();
    console.log('✅ Index cleared');
  } catch (error) {
    console.error('❌ Clear index error:', error);
    throw error;
  }
}

/**
 * Get index stats
 */
async function getStats() {
  try {
    const index = client.index(INDEX_NAME);
    const stats = await index.getStats();
    return stats;
  } catch (error) {
    console.error('❌ Get stats error:', error);
    throw error;
  }
}

/**
 * Check if Meilisearch is healthy
 */
async function healthCheck() {
  try {
    const health = await client.health();
    return health.status === 'available';
  } catch (error) {
    console.error('❌ Meilisearch health check failed:', error);
    return false;
  }
}

module.exports = {
  initializeIndex,
  indexContent,
  indexAllContents,
  search,
  deleteContent,
  clearIndex,
  getStats,
  healthCheck,
};
