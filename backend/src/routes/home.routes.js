const express = require('express');
const router = express.Router();
const { supabase } = require('../config/database');
const { verifyJWT } = require('../middleware/auth');
const familyProfilesService = require('../services/family-profiles.service');

/**
 * Build category-based recommendations for a user.
 * Looks at the user's reading history → extracts category IDs →
 * fetches other content in those categories (excluding already read).
 * Falls back to newest content if no history.
 */
function applyProfileScope(query, profileId) {
  return profileId ? query.eq('profile_id', profileId) : query.is('profile_id', null);
}

async function buildRecommendations(userId, profileId = null, limit = 12) {
  // Get content IDs the user has already interacted with
  let historyQuery = supabase
    .from('reading_history')
    .select('content_id')
    .eq('user_id', userId)
    .limit(100);

  historyQuery = applyProfileScope(historyQuery, profileId);

  const { data: history } = await historyQuery;

  const readContentIds = (history || []).map((h) => h.content_id).filter(Boolean);

  // Get categories from those content IDs (via content_categories join)
  let categoryIds = [];
  if (readContentIds.length > 0) {
    const { data: cats } = await supabase
      .from('content_categories')
      .select('category_id')
      .in('content_id', readContentIds);
    categoryIds = [...new Set((cats || []).map((c) => c.category_id).filter(Boolean))];
  }

  let recommended = [];

  if (categoryIds.length > 0) {
    // Find content in same categories not yet read by the user
    const { data: catContent } = await supabase
      .from('content_categories')
      .select('content_id')
      .in('category_id', categoryIds);

    const candidateIds = [...new Set(
      (catContent || []).map((c) => c.content_id).filter(
        (id) => id && !readContentIds.includes(id)
      )
    )];

    if (candidateIds.length > 0) {
      const { data: recs } = await supabase
        .from('contents')
        .select('id, title, author, author_name, cover_url, cover_image_url, content_type, language, published_at')
        .eq('is_published', true)
        .in('id', candidateIds.slice(0, 50)) // cap the IN clause
        .order('published_at', { ascending: false })
        .limit(limit);
      recommended = recs || [];
    }
  }

  // Fallback: if no category match or not enough results, pad with newest
  if (recommended.length < limit) {
    const excludeIds = [
      ...readContentIds,
      ...recommended.map((r) => r.id),
    ];
    let fallbackQuery = supabase
      .from('contents')
      .select('id, title, author, author_name, cover_url, cover_image_url, content_type, language, published_at')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(limit - recommended.length);

    if (excludeIds.length > 0) {
      fallbackQuery = fallbackQuery.not('id', 'in', `(${excludeIds.join(',')})`);
    }

    const { data: fallback } = await fallbackQuery;
    recommended = [...recommended, ...(fallback || [])];
  }

  return recommended.slice(0, limit);
}

/**
 * GET /home
 * Protected - personalized home data
 */
router.get('/home', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const familyContext = await familyProfilesService.resolveProfileForUser(userId, req.headers['x-profile-id']);
    const profileId = familyContext?.isFamilyContext ? familyContext.profileId : null;

    let continueReadingQuery = supabase
      .from('reading_history')
      .select(`
        content_id,
        progress_percent,
        last_read_at,
        contents:content_id (
          id, title, author, author_name, cover_url, cover_image_url, content_type, language
        )
      `)
      .eq('user_id', userId)
      .gt('progress_percent', 0)
      .lt('progress_percent', 100)
      .order('last_read_at', { ascending: false })
      .limit(5);

    continueReadingQuery = applyProfileScope(continueReadingQuery, profileId);

    const [continueResult, newReleasesResult, popularResult, recommendedResult] = await Promise.allSettled([
      // Continue Reading
      continueReadingQuery,

      // New Releases
      supabase
        .from('contents')
        .select('id, title, author, author_name, cover_url, cover_image_url, content_type, language, published_at')
        .eq('is_published', true)
        .order('published_at', { ascending: false })
        .limit(10),

      // Popular (by reading_history count)
      supabase
        .from('reading_history')
        .select('content_id')
        .limit(500),

      // Recommended (category-based)
      buildRecommendations(userId, profileId, 12),
    ]);

    // Process continue reading
    const continueReading = continueResult.status === 'fulfilled'
      ? (continueResult.value.data || []).map((item) => ({
          ...(item.contents || {}),
          progress_percent: item.progress_percent,
          last_read_at: item.last_read_at,
        }))
      : [];

    // Process new releases
    const newReleases = newReleasesResult.status === 'fulfilled'
      ? (newReleasesResult.value.data || [])
      : [];

    // Process popular (count occurrences, then fetch details)
    let popular = [];
    if (popularResult.status === 'fulfilled') {
      const allHistory = popularResult.value.data || [];
      const countMap = {};
      allHistory.forEach(({ content_id: cid }) => {
        if (cid) countMap[cid] = (countMap[cid] || 0) + 1;
      });
      const topIds = Object.entries(countMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([id]) => id);

      if (topIds.length > 0) {
        const { data: popularData } = await supabase
          .from('contents')
          .select('id, title, author, author_name, cover_url, cover_image_url, content_type, language')
          .eq('is_published', true)
          .in('id', topIds);
        // Preserve popularity order
        const byId = Object.fromEntries((popularData || []).map((c) => [c.id, c]));
        popular = topIds.map((id) => byId[id]).filter(Boolean);
      }

      // Fallback if not enough popular content
      if (popular.length < 6) {
        const { data: fallback } = await supabase
          .from('contents')
          .select('id, title, author, author_name, cover_url, cover_image_url, content_type, language')
          .eq('is_published', true)
          .order('created_at', { ascending: false })
          .limit(12);
        popular = [...popular, ...(fallback || []).filter((c) => !popular.find((p) => p.id === c.id))].slice(0, 12);
      }
    }

    // Process recommended
    const recommended = recommendedResult.status === 'fulfilled' ? recommendedResult.value : [];

    res.status(200).json({
      success: true,
      data: {
        continue_reading: continueReading,
        new_releases: newReleases,
        popular,
        recommended,
      },
    });
  } catch (error) {
    console.error('Error fetching home data:', error);
    next(error);
  }
});

/**
 * GET /api/recommendations
 * Protected - category-based personalized recommendations
 */
router.get('/api/recommendations', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(Number(req.query.limit) || 12, 24);
    const familyContext = await familyProfilesService.resolveProfileForUser(userId, req.headers['x-profile-id']);
    const profileId = familyContext?.isFamilyContext ? familyContext.profileId : null;
    const recommended = await buildRecommendations(userId, profileId, limit);
    res.status(200).json({ success: true, data: recommended });
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    next(error);
  }
});

module.exports = router;
