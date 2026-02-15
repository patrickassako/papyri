const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/database');
const { verifyJWT } = require('../middleware/auth');
const contentsService = require('../services/contents.service');
const contentAccessService = require('../services/content-access.service');
const r2Service = require('../services/r2.service');

function normalizeLastPosition(lastPosition) {
  if (lastPosition === undefined || lastPosition === null) return null;
  if (typeof lastPosition === 'object') return lastPosition;
  try {
    return JSON.parse(lastPosition);
  } catch (_) {
    return null;
  }
}

function isMissingReadingHistoryTable(error) {
  if (!error) return false;
  if (error.code === 'PGRST205' && String(error.message || '').includes('reading_history')) {
    return true;
  }
  return false;
}

async function upsertReadingProgress({
  userId,
  contentId,
  progressPercent,
  lastPosition,
  totalTimeSeconds,
}) {
  // Check if content exists
  const { data: content, error: contentError } = await supabaseAdmin
    .from('contents')
    .select('id')
    .eq('id', contentId)
    .single();

  if (contentError || !content) {
    return {
      ok: false,
      status: 404,
      payload: {
        success: false,
        error: {
          code: 'CONTENT_NOT_FOUND',
          message: 'Contenu non trouvé.',
        },
      },
    };
  }

  // Check if reading history entry exists
  const { data: existingHistory, error: existingHistoryError } = await supabaseAdmin
    .from('reading_history')
    .select('id, started_at, total_time_seconds')
    .eq('user_id', userId)
    .eq('content_id', contentId)
    .single();

  if (isMissingReadingHistoryTable(existingHistoryError)) {
    return {
      ok: true,
      status: 200,
      payload: {
        success: true,
        skipped: true,
        message: 'reading_history table not available; progress tracking skipped.',
        data: null,
      },
    };
  }

  const now = new Date().toISOString();
  const normalizedProgress = Number(progressPercent);
  const normalizedTotalTime = Number(totalTimeSeconds || 0);

  // Prepare update data
  const updateData = {
    user_id: userId,
    content_id: contentId,
    progress_percent: normalizedProgress,
    last_position: normalizeLastPosition(lastPosition),
    last_read_at: now,
    updated_at: now,
  };

  if (Number.isFinite(normalizedTotalTime) && normalizedTotalTime >= 0) {
    updateData.total_time_seconds = Math.floor(normalizedTotalTime);
  }

  // Set completion if progress >= 100
  if (normalizedProgress >= 100) {
    updateData.is_completed = true;
    updateData.completed_at = now;
  }

  if (existingHistory) {
    // Update existing entry
    const { data: updatedHistory, error: updateError } = await supabaseAdmin
      .from('reading_history')
      .update(updateData)
      .eq('id', existingHistory.id)
      .select()
      .single();

    if (isMissingReadingHistoryTable(updateError)) {
      return {
        ok: true,
        status: 200,
        payload: {
          success: true,
          skipped: true,
          message: 'reading_history table not available; progress tracking skipped.',
          data: null,
        },
      };
    }

    if (updateError) {
      console.error('Error updating reading history:', updateError);
      throw new Error('Failed to update reading history');
    }

    return {
      ok: true,
      status: 200,
      payload: {
        success: true,
        data: updatedHistory,
      },
    };
  }

  // Insert new entry
  updateData.started_at = now;
  if (!('total_time_seconds' in updateData)) {
    updateData.total_time_seconds = 0;
  }

  const { data: newHistory, error: insertError } = await supabaseAdmin
    .from('reading_history')
    .insert(updateData)
    .select()
    .single();

  if (isMissingReadingHistoryTable(insertError)) {
    return {
      ok: true,
      status: 200,
      payload: {
        success: true,
        skipped: true,
        message: 'reading_history table not available; progress tracking skipped.',
        data: null,
      },
    };
  }

  if (insertError) {
    console.error('Error creating reading history:', insertError);
    throw new Error('Failed to create reading history');
  }

  return {
    ok: true,
    status: 201,
    payload: {
      success: true,
      data: newHistory,
    },
  };
}

async function ensureLegacyUserRow(user) {
  try {
    const { data: existing, error: readError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (readError) {
      // If legacy users table does not exist in this environment, ignore.
      if (String(readError.message || '').toLowerCase().includes('relation') && String(readError.message || '').toLowerCase().includes('users')) {
        return;
      }
      return;
    }
    if (existing) return;

    const fallbackEmail = user.email || `${user.id}@local.invalid`;
    await supabaseAdmin
      .from('users')
      .insert({
        id: user.id,
        email: fallbackEmail,
        password_hash: 'SUPABASE_AUTH_USER',
        full_name: user.full_name || 'Utilisateur',
        language: user.language || 'fr',
        role: 'user',
        is_active: true,
        onboarding_completed: true,
      });
  } catch (_) {
    // Best effort only to support legacy FK on reading_history.user_id.
  }
}

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
    const { data: history, error: historyError, count } = await supabaseAdmin
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
    await ensureLegacyUserRow(req.user);
    const userId = req.user.id;
    const contentId = req.params.content_id;
    const { progress_percent, last_position, total_time_seconds } = req.body;

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

    const result = await upsertReadingProgress({
      userId,
      contentId,
      progressPercent: progress_percent,
      lastPosition: last_position,
      totalTimeSeconds: total_time_seconds,
    });

    return res.status(result.status).json(result.payload);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/reading/:content_id/session
 * Protected endpoint - Resolve reading session (access + signed url + progress)
 */
router.get('/api/reading/:content_id/session', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const contentId = req.params.content_id;

    const accessContext = await contentAccessService.resolveContentAccess({
      userId,
      contentId,
    });

    if (!accessContext.access.can_read) {
      const statusCode = accessContext.access.denial?.code === 'NO_ACTIVE_SUBSCRIPTION' ? 403 : 402;
      return res.status(statusCode).json({
        success: false,
        error: {
          code: accessContext.access.denial?.code || 'READING_ACCESS_DENIED',
          message: accessContext.access.denial?.message || 'Accès refusé.',
        },
        data: {
          access: accessContext.access,
        },
      });
    }

    const content = accessContext.content;
    const expiresIn = content.content_type === 'audiobook' ? 3600 : 900;
    const signedUrl = await contentsService.generateSignedUrl(
      content.file_key,
      expiresIn,
      content.content_type
    );

    const { data: history } = await supabaseAdmin
      .from('reading_history')
      .select('*')
      .eq('user_id', userId)
      .eq('content_id', contentId)
      .maybeSingle();

    return res.status(200).json({
      success: true,
      data: {
        content: {
          id: content.id,
          title: content.title,
          author: content.author,
          content_type: content.content_type,
          format: content.format,
          description: content.description,
          duration_seconds: content.duration_seconds,
          cover_url: content.cover_url,
        },
        access: accessContext.access,
        stream: {
          url: signedUrl,
          proxy_url: `/api/reading/${content.id}/file`,
          expires_in: expiresIn,
        },
        progress: history
          ? {
              progress_percent: Number(history.progress_percent || 0),
              last_position: history.last_position || null,
              total_time_seconds: Number(history.total_time_seconds || 0),
              is_completed: Boolean(history.is_completed),
              last_read_at: history.last_read_at || null,
            }
          : null,
      },
    });
  } catch (error) {
    if (error.message === 'CONTENT_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CONTENT_NOT_FOUND',
          message: 'Contenu non trouvé.',
        },
      });
    }
    return next(error);
  }
});

/**
 * POST /api/reading/:content_id/progress
 * Protected endpoint - Save reading/listening progress
 */
router.post('/api/reading/:content_id/progress', verifyJWT, async (req, res, next) => {
  try {
    await ensureLegacyUserRow(req.user);
    const userId = req.user.id;
    const contentId = req.params.content_id;
    const { progress_percent, last_position, total_time_seconds } = req.body;

    if (progress_percent === undefined || progress_percent < 0 || progress_percent > 100) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'INVALID_PROGRESS',
          message: 'La progression doit être entre 0 et 100.',
        },
      });
    }

    // Ensure access before saving progress.
    const accessContext = await contentAccessService.resolveContentAccess({
      userId,
      contentId,
    });
    if (!accessContext.access.can_read) {
      const statusCode = accessContext.access.denial?.code === 'NO_ACTIVE_SUBSCRIPTION' ? 403 : 402;
      return res.status(statusCode).json({
        success: false,
        error: {
          code: accessContext.access.denial?.code || 'READING_ACCESS_DENIED',
          message: accessContext.access.denial?.message || 'Accès refusé.',
        },
      });
    }

    const result = await upsertReadingProgress({
      userId,
      contentId,
      progressPercent: progress_percent,
      lastPosition: last_position,
      totalTimeSeconds: total_time_seconds,
    });

    return res.status(result.status).json(result.payload);
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/reading/:content_id/chapters
 * Protected endpoint - Return chapters/toc (from metadata fallback)
 */
router.get('/api/reading/:content_id/chapters', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const contentId = req.params.content_id;
    const accessContext = await contentAccessService.resolveContentAccess({
      userId,
      contentId,
    });

    if (!accessContext.access.can_read) {
      const statusCode = accessContext.access.denial?.code === 'NO_ACTIVE_SUBSCRIPTION' ? 403 : 402;
      return res.status(statusCode).json({
        success: false,
        error: {
          code: accessContext.access.denial?.code || 'READING_ACCESS_DENIED',
          message: accessContext.access.denial?.message || 'Accès refusé.',
        },
      });
    }

    const content = accessContext.content;
    let chapters = [];

    const metadataChapters = Array.isArray(content?.metadata?.chapters) ? content.metadata.chapters : null;
    if (metadataChapters && metadataChapters.length > 0) {
      chapters = metadataChapters;
    } else if (content.content_type === 'audiobook') {
      const total = Number(content.duration_seconds || 0);
      const chunk = 600; // 10 min fallback
      const count = Math.max(1, Math.ceil(total / chunk));
      chapters = Array.from({ length: count }).map((_, idx) => {
        const start = idx * chunk;
        const end = Math.min(total, (idx + 1) * chunk);
        return {
          id: `ch-${idx + 1}`,
          title: `Chapitre ${idx + 1}`,
          start_seconds: start,
          end_seconds: end,
        };
      });
    } else {
      chapters = [
        {
          id: 'intro',
          title: 'Introduction',
          index: 1,
        },
      ];
    }

    return res.status(200).json({
      success: true,
      data: {
        content_id: content.id,
        content_type: content.content_type,
        chapters,
      },
    });
  } catch (error) {
    if (error.message === 'CONTENT_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CONTENT_NOT_FOUND',
          message: 'Contenu non trouvé.',
        },
      });
    }
    return next(error);
  }
});

/**
 * GET /api/reading/:content_id/file
 * Protected endpoint - proxy binary file from R2 to avoid browser CORS issues
 */
router.get('/api/reading/:content_id/file', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const contentId = req.params.content_id;

    const accessContext = await contentAccessService.resolveContentAccess({
      userId,
      contentId,
    });

    if (!accessContext.access.can_read) {
      const statusCode = accessContext.access.denial?.code === 'NO_ACTIVE_SUBSCRIPTION' ? 403 : 402;
      return res.status(statusCode).json({
        success: false,
        error: {
          code: accessContext.access.denial?.code || 'READING_ACCESS_DENIED',
          message: accessContext.access.denial?.message || 'Accès refusé.',
        },
      });
    }

    const content = accessContext.content;
    const extension = String(content.format || '').toLowerCase();
    const mimeByFormat = {
      epub: 'application/epub+zip',
      pdf: 'application/pdf',
      mp3: 'audio/mpeg',
      m4a: 'audio/mp4',
    };

    const objectData = await r2Service.getObjectBuffer(content.file_key);
    const mimeType = objectData.contentType || mimeByFormat[extension] || 'application/octet-stream';

    res.setHeader('Content-Type', mimeType);
    if (objectData.contentLength) {
      res.setHeader('Content-Length', String(objectData.contentLength));
    }
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.status(200).send(objectData.buffer);
  } catch (error) {
    if (error.message === 'CONTENT_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CONTENT_NOT_FOUND',
          message: 'Contenu non trouvé.',
        },
      });
    }

    if (error.message === 'R2_NOT_CONFIGURED') {
      return res.status(503).json({
        success: false,
        error: {
          code: 'R2_NOT_CONFIGURED',
          message: 'Stockage contenu non configuré.',
        },
      });
    }

    return next(error);
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
    const { data: history, error: historyError } = await supabaseAdmin
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
