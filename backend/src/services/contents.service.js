/**
 * Contents Service
 * Gestion du catalogue de contenus (ebooks et audiobooks)
 */

const { supabase, supabaseAdmin } = require('../config/database');
const r2Service = require('./r2.service');

/**
 * Get all contents with pagination and filters
 * @param {Object} options - Query options
 * @param {number} options.page - Page number (default: 1)
 * @param {number} options.limit - Items per page (default: 20)
 * @param {string} options.type - Filter by type (ebook/audiobook)
 * @param {string} options.language - Filter by language
 * @param {string} options.category - Filter by category slug
 * @param {string} options.sort - Sort by (newest/popular/title)
 * @returns {Promise<{contents, total, page, totalPages}>}
 */
async function getContents(options = {}) {
  const {
    page = 1,
    limit = 20,
    type,
    language,
    category,
    sort = 'newest',
  } = options;

  const offset = (page - 1) * limit;

  // Éditeurs non-actifs (paused, banned, pending) → exclure leurs contenus
  const { data: blockedPubs } = await supabaseAdmin
    .from('publishers')
    .select('id')
    .neq('status', 'active');

  // Base query
  let query = supabase
    .from('contents')
    .select(`
      *,
      categories:content_categories(
        category:categories(id, name, slug)
      ),
      rights_holder:rights_holders(id, name)
    `, { count: 'exact' })
    .is('deleted_at', null)
    .eq('is_published', true)
    .eq('is_archived', false);

  // Exclure les contenus d'éditeurs non-actifs (garder publisher_id null = contenus plateforme)
  if (blockedPubs?.length) {
    const ids = blockedPubs.map(p => p.id).join(',');
    query = query.or(`publisher_id.is.null,publisher_id.not.in.(${ids})`);
  }

  // Filters
  if (type) {
    query = query.eq('content_type', type);
  }

  if (language) {
    query = query.eq('language', language);
  }

  // Category filter (needs join)
  if (category) {
    // Get category ID first
    const { data: categoryData } = await supabase
      .from('categories')
      .select('id')
      .eq('slug', category)
      .single();

    if (categoryData) {
      // Get content IDs for this category
      const { data: contentIds } = await supabase
        .from('content_categories')
        .select('content_id')
        .eq('category_id', categoryData.id);

      if (contentIds && contentIds.length > 0) {
        const ids = contentIds.map(item => item.content_id);
        query = query.in('id', ids);
      } else {
        // No contents in this category
        return { contents: [], total: 0, page, totalPages: 0 };
      }
    }
  }

  // Popular sort requires a separate approach: count reading_history per content
  if (sort === 'popular') {
    // Get read counts per content (bypass RLS with supabaseAdmin)
    const { data: readCounts, error: rcError } = await supabaseAdmin
      .from('reading_history')
      .select('content_id');

    if (rcError) {
      throw rcError;
    }

    // Count reads per content_id
    const countMap = {};
    for (const row of readCounts || []) {
      countMap[row.content_id] = (countMap[row.content_id] || 0) + 1;
    }

    // Get all matching content IDs sorted by popularity
    const popularIds = Object.entries(countMap)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);

    if (popularIds.length > 0) {
      query = query.in('id', popularIds);
    }

    // Fallback ordering for contents with no reads
    query = query.order('published_at', { ascending: false });
    query = query.range(offset, offset + limit - 1);

    const { data: contents, error, count } = await query;
    if (error) throw error;

    // Sort results by popularity (read count descending)
    const sorted = (contents || []).sort((a, b) => {
      return (countMap[b.id] || 0) - (countMap[a.id] || 0);
    });

    const transformedContents = sorted.map(content => ({
      ...content,
      categories: content.categories?.map(cc => cc.category).filter(Boolean) || [],
    }));

    return {
      contents: transformedContents,
      total: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  // Sorting (non-popular)
  switch (sort) {
    case 'newest':
      query = query.order('published_at', { ascending: false });
      break;
    case 'oldest':
      query = query.order('published_at', { ascending: true });
      break;
    case 'title':
      query = query.order('title', { ascending: true });
      break;
    default:
      query = query.order('published_at', { ascending: false });
  }

  // Pagination
  query = query.range(offset, offset + limit - 1);

  const { data: contents, error, count } = await query;

  if (error) {
    throw error;
  }

  // Transform categories array
  const transformedContents = contents.map(content => ({
    ...content,
    categories: content.categories?.map(cc => cc.category).filter(Boolean) || [],
  }));

  return {
    contents: transformedContents,
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  };
}

/**
 * Get single content by ID
 * @param {string} contentId - Content UUID
 * @returns {Promise<Object>} Content with categories and rights holder
 */
async function getContentById(contentId) {
  // Vérifier le statut de l'éditeur avant de retourner le contenu
  const { data: contentCheck } = await supabaseAdmin
    .from('contents')
    .select('publisher_id')
    .eq('id', contentId)
    .single();

  if (contentCheck?.publisher_id) {
    const { data: pub } = await supabaseAdmin
      .from('publishers')
      .select('status')
      .eq('id', contentCheck.publisher_id)
      .single();

    if (pub && pub.status !== 'active') {
      throw new Error('CONTENT_NOT_FOUND');
    }
  }

  const { data, error } = await supabase
    .from('contents')
    .select(`
      *,
      categories:content_categories(
        category:categories(id, name, slug, description)
      ),
      rights_holder:rights_holders(id, name, email, website)
    `)
    .eq('id', contentId)
    .is('deleted_at', null)
    .eq('is_published', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error('CONTENT_NOT_FOUND');
    }
    throw error;
  }

  // Transform categories array
  return {
    ...data,
    categories: data.categories?.map(cc => cc.category).filter(Boolean) || [],
  };
}

async function getContentByIdForUnlock(contentId) {
  const { data, error } = await supabaseAdmin
    .from('contents')
    .select(`
      *,
      categories:content_categories(
        category:categories(id, name, slug, description)
      ),
      rights_holder:rights_holders(id, name, email, website)
    `)
    .eq('id', contentId)
    .is('deleted_at', null)
    .eq('is_published', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error('CONTENT_NOT_FOUND');
    }
    throw error;
  }

  return {
    ...data,
    categories: data.categories?.map((cc) => cc.category).filter(Boolean) || [],
  };
}

async function getUserContentUnlock(userId, contentId, profileId = null) {
  let query = supabaseAdmin
    .from('content_unlocks')
    .select('*')
    .eq('user_id', userId)
    .eq('content_id', contentId);

  query = profileId ? query.eq('profile_id', profileId) : query.is('profile_id', null);

  const { data, error } = await query.maybeSingle();

  if (error) throw error;
  return data || null;
}

async function createContentUnlock(unlockData) {
  const { data, error } = await supabaseAdmin
    .from('content_unlocks')
    .insert(unlockData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get all categories
 * @returns {Promise<Array>} List of categories
 */
async function getCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug, description, parent_id, sort_order')
    .order('sort_order', { ascending: true });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Get category by slug
 * @param {string} slug - Category slug
 * @returns {Promise<Object>} Category with content count
 */
async function getCategoryBySlug(slug) {
  const { data: category, error } = await supabase
    .from('categories')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error('CATEGORY_NOT_FOUND');
    }
    throw error;
  }

  // Get content count for this category
  const { count } = await supabase
    .from('content_categories')
    .select('content_id', { count: 'exact', head: true })
    .eq('category_id', category.id);

  return {
    ...category,
    content_count: count || 0,
  };
}

/**
 * Generate signed URL for content file
 * @param {string} fileKey - R2/S3 file key
 * @param {number} expiresIn - Expiration in seconds (default: 900 = 15min)
 * @param {string} contentType - Content type (ebook/audiobook)
 * @returns {Promise<string>} Signed URL
 */
async function generateSignedUrl(fileKey, expiresIn = 900, contentType = 'ebook') {
  // Use appropriate TTL based on content type
  // Ebook (EPUB/PDF): 15 minutes (900s)
  // Audio (MP3/M4A): 60 minutes (3600s)
  const ttl = contentType === 'audiobook' ? 3600 : 900;
  const actualExpiry = expiresIn || ttl;

  // Generate presigned URL via R2 service
  return await r2Service.generatePresignedUrl(fileKey, actualExpiry);
}

/**
 * Create new content (admin only)
 * @param {Object} contentData - Content data
 * @returns {Promise<Object>} Created content
 */
async function createContent(contentData) {
  const { categories, ...content } = contentData;

  // Insert content
  const { data: newContent, error: contentError } = await supabaseAdmin
    .from('contents')
    .insert(content)
    .select()
    .single();

  if (contentError) {
    throw contentError;
  }

  // Insert categories if provided
  if (categories && categories.length > 0) {
    const categoryLinks = categories.map(categoryId => ({
      content_id: newContent.id,
      category_id: categoryId,
    }));

    const { error: categoryError } = await supabaseAdmin
      .from('content_categories')
      .insert(categoryLinks);

    if (categoryError) {
      // Rollback content creation
      await supabaseAdmin.from('contents').delete().eq('id', newContent.id);
      throw categoryError;
    }
  }

  return newContent;
}

/**
 * Update content (admin only)
 * @param {string} contentId - Content UUID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated content
 */
async function updateContent(contentId, updates) {
  const { categories, ...contentUpdates } = updates;

  // Update content
  const { data, error } = await supabaseAdmin
    .from('contents')
    .update({ ...contentUpdates, updated_at: new Date().toISOString() })
    .eq('id', contentId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  // Update categories if provided
  if (categories !== undefined) {
    // Delete existing categories
    await supabaseAdmin
      .from('content_categories')
      .delete()
      .eq('content_id', contentId);

    // Insert new categories
    if (categories.length > 0) {
      const categoryLinks = categories.map(categoryId => ({
        content_id: contentId,
        category_id: categoryId,
      }));

      await supabaseAdmin
        .from('content_categories')
        .insert(categoryLinks);
    }
  }

  return data;
}

/**
 * Delete content (soft delete, admin only)
 * @param {string} contentId - Content UUID
 * @returns {Promise<void>}
 */
async function deleteContent(contentId) {
  const { error } = await supabaseAdmin
    .from('contents')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', contentId);

  if (error) {
    throw error;
  }

  // Sync Meilisearch (non-blocking)
  try {
    const meilisearch = require('./meilisearch.service');
    await meilisearch.deleteContent(contentId);
  } catch (err) {
    console.warn('Meilisearch deleteContent error (non-blocking):', err.message);
  }
}

/**
 * Get content recommendations for a given content.
 * Returns two groups:
 *   - sameGenre: same category, up to 4 items
 *   - youllLike: same author, up to 4 items (excluding sameGenre duplicates)
 * @param {string} contentId
 * @returns {Promise<{ sameGenre: Array, youllLike: Array }>}
 */
async function getRecommendations(contentId) {
  const FIELDS = 'id, title, author, cover_url, content_type';

  // Get the source content (categories + author)
  const { data: source, error: srcErr } = await supabase
    .from('contents')
    .select(`id, author, content_categories(category_id)`)
    .eq('id', contentId)
    .is('deleted_at', null)
    .single();

  if (srcErr || !source) return { sameGenre: [], youllLike: [] };

  const categoryIds = (source.content_categories || []).map((c) => c.category_id);
  const author = source.author;

  // ── Same genre ──────────────────────────────────────────────────────────
  let sameGenre = [];
  if (categoryIds.length > 0) {
    const { data: ccRows } = await supabase
      .from('content_categories')
      .select('content_id')
      .in('category_id', categoryIds)
      .neq('content_id', contentId);

    const ids = [...new Set((ccRows || []).map((r) => r.content_id))].slice(0, 12);

    if (ids.length > 0) {
      const { data } = await supabase
        .from('contents')
        .select(FIELDS)
        .in('id', ids)
        .eq('is_published', true)
        .eq('is_archived', false)
        .is('deleted_at', null)
        .order('published_at', { ascending: false })
        .limit(4);
      sameGenre = data || [];
    }
  }

  // ── Same author ──────────────────────────────────────────────────────────
  let youllLike = [];
  if (author) {
    const sameGenreIds = sameGenre.map((c) => c.id);
    const { data } = await supabase
      .from('contents')
      .select(FIELDS)
      .eq('author', author)
      .eq('is_published', true)
      .eq('is_archived', false)
      .is('deleted_at', null)
      .neq('id', contentId)
      .order('published_at', { ascending: false })
      .limit(8);

    const authorItems = (data || []).filter((c) => !sameGenreIds.includes(c.id));
    youllLike = authorItems.slice(0, 4);
  }

  return { sameGenre, youllLike };
}

module.exports = {
  getContents,
  getContentById,
  getContentByIdForUnlock,
  getCategories,
  getCategoryBySlug,
  generateSignedUrl,
  getUserContentUnlock,
  createContentUnlock,
  createContent,
  updateContent,
  deleteContent,
  getRecommendations,
};
