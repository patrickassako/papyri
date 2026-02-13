const express = require('express');
const router = express.Router();
const { supabase } = require('../config/database');
const { verifyJWT } = require('../middleware/auth');

/**
 * GET /reading-history
 * Protected endpoint - Get user's reading history with pagination
 * Note: Requires active subscription (checkSubscription middleware to be added in Epic 2)
 */
router.get('/reading-history', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100); // Max 100 items per page
    const offset = (page - 1) * limit;

    // Get reading history with content details
    const { data: history, error: historyError, count } = await supabase
      .from('reading_history')
      .select(`
        id,
        content_id,
        progress_percent,
        last_position,
        total_time_seconds,
        is_completed,
        started_at,
        last_read_at,
        completed_at,
        contents (
          id,
          title,
          author,
          type,
          format,
          cover_url,
          duration_seconds
        )
      `, { count: 'exact' })
      .eq('user_id', userId)
      .order('last_read_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (historyError) {
      console.error('Error fetching reading history:', historyError);
      throw new Error('Failed to fetch reading history');
    }

    // Transform response to flatten content data
    const formattedHistory = (history || []).map(item => ({
      id: item.id,
      content_id: item.content_id,
      title: item.contents?.title || 'Titre inconnu',
      author: item.contents?.author || 'Auteur inconnu',
      content_type: item.contents?.type || 'unknown',
      format: item.contents?.format || null,
      cover_url: item.contents?.cover_url || null,
      duration_seconds: item.contents?.duration_seconds || null,
      progress_percent: parseFloat(item.progress_percent) || 0,
      last_position: item.last_position || null,
      total_time_seconds: item.total_time_seconds || 0,
      is_completed: item.is_completed || false,
      started_at: item.started_at,
      last_read_at: item.last_read_at,
      completed_at: item.completed_at,
    }));

    res.status(200).json({
      success: true,
      data: formattedHistory,
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /reading-history/:content_id
 * Protected endpoint - Update reading progress for a content
 * UPSERT operation: creates if not exists, updates if exists
 */
router.put('/reading-history/:content_id', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const contentId = req.params.content_id;
    const { progress_percent, last_position } = req.body;

    // Validation
    if (progress_percent === undefined || progress_percent < 0 || progress_percent > 100) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'INVALID_PROGRESS',
          message: 'La progression doit être entre 0 et 100.',
        },
      });
    }

    // Check if content exists
    const { data: content, error: contentError } = await supabase
      .from('contents')
      .select('id')
      .eq('id', contentId)
      .single();

    if (contentError || !content) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CONTENT_NOT_FOUND',
          message: 'Contenu non trouvé.',
        },
      });
    }

    // Check if reading history entry exists
    const { data: existingHistory } = await supabase
      .from('reading_history')
      .select('id, started_at, total_time_seconds')
      .eq('user_id', userId)
      .eq('content_id', contentId)
      .single();

    const now = new Date().toISOString();

    // Prepare update data
    const updateData = {
      user_id: userId,
      content_id: contentId,
      progress_percent: progress_percent,
      last_position: last_position || null,
      last_read_at: now,
      updated_at: now,
    };

    // Set completion if progress >= 100
    if (progress_percent >= 100) {
      updateData.is_completed = true;
      updateData.completed_at = now;
    }

    // UPSERT operation
    if (existingHistory) {
      // Update existing entry
      const { data: updatedHistory, error: updateError } = await supabase
        .from('reading_history')
        .update(updateData)
        .eq('id', existingHistory.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating reading history:', updateError);
        throw new Error('Failed to update reading history');
      }

      res.status(200).json({
        success: true,
        data: updatedHistory,
      });
    } else {
      // Insert new entry
      updateData.started_at = now;
      updateData.total_time_seconds = 0;

      const { data: newHistory, error: insertError } = await supabase
        .from('reading_history')
        .insert(updateData)
        .select()
        .single();

      if (insertError) {
        console.error('Error creating reading history:', insertError);
        throw new Error('Failed to create reading history');
      }

      res.status(201).json({
        success: true,
        data: newHistory,
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /reading-history/continue
 * Protected endpoint - Get "Continue Reading" items for homepage
 * Returns incomplete items sorted by last_read_at
 */
router.get('/reading-history/continue', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;

    // Get incomplete reading history items
    const { data: history, error: historyError } = await supabase
      .from('reading_history')
      .select(`
        id,
        content_id,
        progress_percent,
        last_position,
        last_read_at,
        contents (
          id,
          title,
          author,
          type,
          format,
          cover_url,
          duration_seconds
        )
      `)
      .eq('user_id', userId)
      .eq('is_completed', false)
      .order('last_read_at', { ascending: false })
      .limit(limit);

    if (historyError) {
      console.error('Error fetching continue reading:', historyError);
      throw new Error('Failed to fetch continue reading items');
    }

    // Transform response
    const formattedHistory = (history || []).map(item => ({
      id: item.id,
      content_id: item.content_id,
      title: item.contents?.title || 'Titre inconnu',
      author: item.contents?.author || 'Auteur inconnu',
      content_type: item.contents?.type || 'unknown',
      format: item.contents?.format || null,
      cover_url: item.contents?.cover_url || null,
      duration_seconds: item.contents?.duration_seconds || null,
      progress_percent: parseFloat(item.progress_percent) || 0,
      last_position: item.last_position || null,
      last_read_at: item.last_read_at,
    }));

    res.status(200).json({
      success: true,
      data: formattedHistory,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
