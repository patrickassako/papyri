const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/database');
const { verifyJWT } = require('../middleware/auth');
const contentsService = require('../services/contents.service');
const contentAccessService = require('../services/content-access.service');
const familyProfilesService = require('../services/family-profiles.service');
const r2Service = require('../services/r2.service');
const geoService = require('../services/geo.service');

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

function isNoRowError(error) {
  return Boolean(error && error.code === 'PGRST116');
}

function isMissingAudioPlaylistTable(error) {
  if (!error) return false;
  if (error.code === '42P01') return true;
  const message = String(error.message || '').toLowerCase();
  return message.includes('audio_playlist_items');
}

function isSkippableReadingHistoryError(error) {
  if (!error) return false;

  // Missing table handled separately, but keep extra guards for schema drift.
  if (isMissingReadingHistoryTable(error)) return true;

  // FK violations should NOT be silently skipped — log them so we can diagnose
  if (error.code === '23503') {
    console.error('[reading] FK violation on reading_history — user may not exist in legacy users table:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    // Return false so the caller can attempt to fix the FK issue and retry
    return false;
  }

  return false;
}

async function resolveProfileContext(req) {
  const requestedProfileId = req.headers['x-profile-id'] || null;
  return familyProfilesService.resolveProfileForUser(req.user.id, requestedProfileId);
}

function applyProfileScope(query, profileId) {
  if (profileId) {
    return query.eq('profile_id', profileId);
  }
  return query.is('profile_id', null);
}

async function upsertReadingProgress({
  userId,
  profileId = null,
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

  console.log('[upsertReadingProgress] userId=%s, contentId=%s, progress=%s', userId, contentId, progressPercent);

  // Check if reading history entry exists
  let existingHistoryQuery = supabaseAdmin
    .from('reading_history')
    .select('id, started_at, total_time_seconds')
    .eq('user_id', userId)
    .eq('content_id', contentId);

  existingHistoryQuery = applyProfileScope(existingHistoryQuery, profileId);

  const { data: existingHistory, error: existingHistoryError } = await existingHistoryQuery.single();

  if (isMissingReadingHistoryTable(existingHistoryError)) {
    console.warn('[upsertReadingProgress] reading_history table missing');
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

  if (existingHistoryError && !isNoRowError(existingHistoryError)) {
    console.error('[upsertReadingProgress] Unexpected error checking existing history:', existingHistoryError);
    throw existingHistoryError;
  }

  const now = new Date().toISOString();
  const normalizedProgress = Number(progressPercent);
  const normalizedTotalTime = Number(totalTimeSeconds || 0);

  // Prepare update data
  const updateData = {
    user_id: userId,
    profile_id: profileId,
    content_id: contentId,
    progress_percent: normalizedProgress,
    last_position: normalizeLastPosition(lastPosition),
    last_read_at: now,
    updated_at: now,
    is_completed: normalizedProgress >= 100,
  };

  if (Number.isFinite(normalizedTotalTime) && normalizedTotalTime >= 0) {
    updateData.total_time_seconds = Math.floor(normalizedTotalTime);
  }

  // Set completion timestamps consistently
  if (normalizedProgress >= 100) {
    updateData.is_completed = true;
    updateData.completed_at = now;
  } else {
    updateData.completed_at = null;
  }

  if (existingHistory) {
    // Update existing entry
    console.log('[upsertReadingProgress] Updating existing history id=%s', existingHistory.id);
    const { data: updatedHistory, error: updateError } = await supabaseAdmin
      .from('reading_history')
      .update(updateData)
      .eq('id', existingHistory.id)
      .select()
      .single();

    if (updateError) {
      console.error('[upsertReadingProgress] Update FAILED:', updateError);
      throw new Error('Failed to update reading history');
    }

    console.log('[upsertReadingProgress] Update OK, last_position cfi=%s', updatedHistory?.last_position?.cfi?.slice(0, 50));
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

  console.log('[upsertReadingProgress] Inserting new history entry');
  const { data: newHistory, error: insertError } = await supabaseAdmin
    .from('reading_history')
    .insert(updateData)
    .select()
    .single();

  if (insertError) {
    console.error('[upsertReadingProgress] Insert FAILED:', {
      code: insertError.code,
      message: insertError.message,
      details: insertError.details,
      hint: insertError.hint,
    });

    // If FK violation on user_id, force-create legacy user row and retry once
    if (insertError.code === '23503') {
      console.log('[upsertReadingProgress] FK violation — force-creating legacy user row for', userId);
      // Try upsert with all common columns
      const { error: upsertErr } = await supabaseAdmin
        .from('users')
        .upsert({
          id: userId,
          email: `${userId}@supabase.auth`,
          password_hash: 'SUPABASE_AUTH_USER',
          full_name: 'Utilisateur',
          language: 'fr',
          role: 'user',
          is_active: true,
          onboarding_completed: true,
        }, { onConflict: 'id', ignoreDuplicates: true });

      if (upsertErr) {
        console.error('[upsertReadingProgress] User upsert failed:', upsertErr.message, '— trying minimal insert');
        // Fallback: minimal columns
        await supabaseAdmin
          .from('users')
          .upsert({ id: userId, email: `${userId}@supabase.auth`, password_hash: 'X' },
            { onConflict: 'id', ignoreDuplicates: true });
      }

      // Retry the reading_history insert
      const { data: retryData, error: retryErr } = await supabaseAdmin
        .from('reading_history')
        .insert(updateData)
        .select()
        .single();

      if (!retryErr && retryData) {
        console.log('[upsertReadingProgress] Retry insert OK after user creation, id=%s', retryData.id);
        return {
          ok: true,
          status: 201,
          payload: { success: true, data: retryData },
        };
      }

      console.error('[upsertReadingProgress] Retry still failed:', retryErr?.message);
      return {
        ok: false,
        status: 500,
        payload: {
          success: false,
          error: {
            code: 'FK_VIOLATION',
            message: `Contrainte FK: exécutez la migration 029_fix_reading_history_fk.sql. Détail: ${insertError.details || insertError.message}`,
          },
        },
      };
    }

    throw new Error('Failed to create reading history');
  }

  console.log('[upsertReadingProgress] Insert OK, id=%s, cfi=%s', newHistory?.id, newHistory?.last_position?.cfi?.slice(0, 50));
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
      const msg = String(readError.message || '').toLowerCase();
      // If legacy users table does not exist in this environment, ignore.
      if (msg.includes('relation') && msg.includes('users')) {
        return;
      }
      console.warn('[ensureLegacyUserRow] Read error:', readError.message);
      return;
    }
    if (existing) return;

    const fallbackEmail = user.email || `${user.id}@local.invalid`;
    const { error: insertError } = await supabaseAdmin
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

    if (insertError) {
      console.error('[ensureLegacyUserRow] Insert FAILED for user', user.id, ':', insertError.message, insertError.details || '');
    } else {
      console.log('[ensureLegacyUserRow] Created legacy user row for', user.id);
    }
  } catch (err) {
    console.error('[ensureLegacyUserRow] Unexpected error:', err.message);
  }
}

async function getUserAudioPlaylist(userId) {
  const { data: items, error: itemsError } = await supabaseAdmin
    .from('audio_playlist_items')
    .select(`
      id,
      content_id,
      position_index,
      created_at,
      contents (
        id,
        title,
        author,
        content_type,
        format,
        cover_url,
        duration_seconds,
        language
      )
    `)
    .eq('user_id', userId)
    .order('position_index', { ascending: true });

  if (itemsError) {
    if (isMissingAudioPlaylistTable(itemsError)) {
      return {
        missingTable: true,
        items: [],
      };
    }
    throw itemsError;
  }

  const contentIds = (items || []).map((item) => item.content_id);
  let progressByContentId = new Map();

  if (contentIds.length > 0) {
    const { data: progressRows, error: progressError } = await supabaseAdmin
      .from('reading_history')
      .select('content_id, progress_percent, last_position, last_read_at, is_completed')
      .eq('user_id', userId)
      .in('content_id', contentIds);

    if (!progressError && Array.isArray(progressRows)) {
      progressByContentId = new Map(progressRows.map((row) => [row.content_id, row]));
    }
  }

  const playlist = (items || []).map((item) => {
    const progress = progressByContentId.get(item.content_id) || null;
    return {
      id: item.id,
      content_id: item.content_id,
      position_index: Number(item.position_index || 0),
      added_at: item.created_at,
      content: item.contents || null,
      progress: progress
        ? {
            progress_percent: Number(progress.progress_percent || 0),
            last_position: progress.last_position || null,
            last_read_at: progress.last_read_at || null,
            is_completed: Boolean(progress.is_completed),
          }
        : null,
    };
  });

  return {
    missingTable: false,
    items: playlist,
  };
}

/**
 * GET /reading-history
 * Protected endpoint - Get user's reading history with pagination
 * Note: Requires active subscription (checkSubscription middleware to be added in Epic 2)
 */
router.get('/reading-history', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const profileContext = await resolveProfileContext(req);
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100); // Max 100 items per page
    const offset = (page - 1) * limit;

    // Get reading history with content details
    let historyQuery = supabaseAdmin
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
          content_type,
          format,
          cover_url,
          duration_seconds
        )
      `, { count: 'exact' })
      .eq('user_id', userId)
      .order('last_read_at', { ascending: false });

    historyQuery = applyProfileScope(historyQuery, profileContext.profileId);

    const { data: history, error: historyError, count } = await historyQuery.range(offset, offset + limit - 1);

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
      content_type: item.contents?.content_type || 'unknown',
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
    const profileContext = await resolveProfileContext(req);
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
      profileId: profileContext.profileId,
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
 * GET /reading-history/stats
 * Protected endpoint - Reading statistics for the current user
 */
router.get('/reading-history/stats', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const profileContext = await resolveProfileContext(req);

    let statsQuery = supabaseAdmin
      .from('reading_history')
      .select('content_id, status, progress_percent, total_time_seconds, last_read_at, contents(type)')
      .eq('user_id', userId);

    statsQuery = applyProfileScope(statsQuery, profileContext.profileId);

    const { data: history, error } = await statsQuery;

    if (error && !isMissingReadingHistoryTable(error)) {
      return next(error);
    }

    const rows = history || [];
    const totalBooks = rows.length;
    const completed = rows.filter(r => r.status === 'completed').length;
    const inProgress = rows.filter(r => r.status === 'in_progress').length;
    const totalSeconds = rows.reduce((sum, r) => sum + (r.total_time_seconds || 0), 0);
    const audioSeconds = rows
      .filter(r => r.contents?.type === 'audio')
      .reduce((sum, r) => sum + (r.total_time_seconds || 0), 0);
    const completionRate = totalBooks > 0 ? Math.round((completed / totalBooks) * 100) : 0;

    // Streak: consecutive days with at least one read (desc order)
    const readDates = [...new Set(
      rows
        .filter(r => r.last_read_at)
        .map(r => r.last_read_at.slice(0, 10))
    )].sort((a, b) => b.localeCompare(a));

    let streakDays = 0;
    const today = new Date().toISOString().slice(0, 10);
    let cursor = today;
    for (const d of readDates) {
      if (d === cursor) {
        streakDays++;
        const prev = new Date(cursor);
        prev.setDate(prev.getDate() - 1);
        cursor = prev.toISOString().slice(0, 10);
      } else {
        break;
      }
    }

    // Daily activity for last 30 days
    const dailyMap = {};
    rows.forEach(r => {
      if (!r.last_read_at) return;
      const day = r.last_read_at.slice(0, 10);
      dailyMap[day] = (dailyMap[day] || 0) + 1;
    });

    const activity = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      activity.push({ date: key, count: dailyMap[key] || 0 });
    }

    return res.status(200).json({
      success: true,
      data: {
        total_books: totalBooks,
        completed,
        in_progress: inProgress,
        total_time_seconds: totalSeconds,
        audio_time_seconds: audioSeconds,
        streak_days: streakDays,
        completion_rate: completionRate,
        daily_activity: activity,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /reading-history
 * Protected endpoint - Clear all reading history for the current user
 */
router.delete('/reading-history', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const profileContext = await resolveProfileContext(req);

    let deleteQuery = supabaseAdmin
      .from('reading_history')
      .delete()
      .eq('user_id', userId);

    deleteQuery = applyProfileScope(deleteQuery, profileContext.profileId);

    const { error } = await deleteQuery;

    if (error && !isMissingReadingHistoryTable(error)) {
      return next(error);
    }

    return res.status(200).json({ success: true, message: 'Historique effacé.' });
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
    const profileContext = await resolveProfileContext(req);
    const contentId = req.params.content_id;

    const accessContext = await contentAccessService.resolveContentAccess({
      userId,
      contentId,
      zone: geoService.getGeoFromRequest(req),
      profileId: profileContext.profileId,
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

    let sessionQuery = supabaseAdmin
      .from('reading_history')
      .select('*')
      .eq('user_id', userId)
      .eq('content_id', contentId);

    sessionQuery = applyProfileScope(sessionQuery, profileContext.profileId);

    const { data: history, error: historyError } = await sessionQuery.maybeSingle();

    console.log('[session] userId=%s, contentId=%s, hasHistory=%s, historyError=%s, cfi=%s',
      userId, contentId, !!history, historyError?.message || 'none',
      history?.last_position?.cfi?.slice(0, 50) || 'none');

    return res.status(200).json({
      success: true,
      data: {
        content: {
          id: content.id,
          title: content.title,
          author: content.author,
          content_type: content.content_type,
          format: content.format,
          file_size_bytes: Number(content.file_size_bytes || 0),
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
    const profileContext = await resolveProfileContext(req);
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
      zone: geoService.getGeoFromRequest(req),
      profileId: profileContext.profileId,
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
      profileId: profileContext.profileId,
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
    const profileContext = await resolveProfileContext(req);
    const contentId = req.params.content_id;
    const accessContext = await contentAccessService.resolveContentAccess({
      userId,
      contentId,
      zone: geoService.getGeoFromRequest(req),
      profileId: profileContext.profileId,
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

    // Priority #1: Structured chapters from DB
    if (content.content_type === 'audiobook') {
      const { data: dbChapters, error: dbChaptersError } = await supabaseAdmin
        .from('audiobook_chapters')
        .select(`
          id,
          chapter_number,
          title,
          start_seconds,
          end_seconds,
          duration_seconds,
          chapter_content_id,
          chapter_file_key,
          chapter_format
        `)
        .eq('parent_content_id', content.id)
        .order('chapter_number', { ascending: true });

      if (!dbChaptersError && Array.isArray(dbChapters) && dbChapters.length > 0) {
        chapters = dbChapters.map((row) => ({
          id: row.id,
          index: Number(row.chapter_number || 0),
          title: row.title || `Chapitre ${row.chapter_number || ''}`.trim(),
          start_seconds: Number(row.start_seconds || 0),
          end_seconds: row.end_seconds == null ? null : Number(row.end_seconds),
          duration_seconds: row.duration_seconds == null ? null : Number(row.duration_seconds),
          content_id: row.chapter_content_id || null,
          file_key: row.chapter_file_key || null,
          format: row.chapter_format || null,
        }));
      }

      if (chapters.length === 0) {
        const { data: legacyChapters, error: legacyError } = await supabaseAdmin
          .from('audio_chapters')
          .select('id, title, position, file_key, duration_seconds')
          .eq('content_id', content.id)
          .order('position', { ascending: true });

        if (!legacyError && Array.isArray(legacyChapters) && legacyChapters.length > 0) {
          chapters = legacyChapters.map((row) => ({
            id: row.id,
            index: Number(row.position || 0),
            title: row.title || `Chapitre ${row.position || ''}`.trim(),
            start_seconds: null,
            end_seconds: null,
            duration_seconds: row.duration_seconds == null ? null : Number(row.duration_seconds),
            content_id: content.id,
            file_key: row.file_key || null,
            format: 'mp3',
          }));
        }
      }
    }

    // Priority #2: metadata fallback
    if (chapters.length === 0) {
      const metadataChapters = Array.isArray(content?.metadata?.chapters)
        ? content.metadata.chapters
        : (Array.isArray(content?.metadata?.toc)
          ? content.metadata.toc
          : (Array.isArray(content?.metadata?.table_of_contents)
            ? content.metadata.table_of_contents
            : null));
      if (metadataChapters && metadataChapters.length > 0) {
        chapters = metadataChapters;
      } else if (content.content_type === 'audiobook') {
        // Priority #3: simple generated chunks fallback
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
 * GET /api/reading/:content_id/chapters/:chapter_id/file-url
 * Protected endpoint - Return signed URL for a structured audiobook chapter
 */
router.get('/api/reading/:content_id/chapters/:chapter_id/file-url', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const profileContext = await resolveProfileContext(req);
    const contentId = req.params.content_id;
    const chapterId = req.params.chapter_id;

    const accessContext = await contentAccessService.resolveContentAccess({
      userId,
      contentId,
      zone: geoService.getGeoFromRequest(req),
      profileId: profileContext.profileId,
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

    const fallbackChapterMatch = /^ch-(\d+)$/.exec(String(chapterId || ''));
    if (chapterId === 'intro' || fallbackChapterMatch) {
      const signedUrl = await contentsService.generateSignedUrl(
        accessContext.content.file_key,
        3600,
        'audiobook',
      );

      return res.status(200).json({
        success: true,
        data: {
          chapter_id: chapterId,
          url: signedUrl,
          expires_in: 3600,
        },
      });
    }

    let { data: chapter, error: chapterError } = await supabaseAdmin
      .from('audiobook_chapters')
      .select('id, parent_content_id, chapter_file_key, chapter_format')
      .eq('id', chapterId)
      .eq('parent_content_id', contentId)
      .maybeSingle();

    if (chapterError) throw chapterError;
    // Fallback: tolerate legacy/changing parent linkage and resolve by chapter id only.
    if (!chapter) {
      const fallbackResult = await supabaseAdmin
        .from('audiobook_chapters')
        .select('id, parent_content_id, chapter_file_key, chapter_format')
        .eq('id', chapterId)
        .maybeSingle();
      if (fallbackResult.error) throw fallbackResult.error;
      chapter = fallbackResult.data || null;
    }

    if (!chapter) {
      const legacyResult = await supabaseAdmin
        .from('audio_chapters')
        .select('id, content_id, file_key, duration_seconds')
        .eq('id', chapterId)
        .eq('content_id', contentId)
        .maybeSingle();
      if (legacyResult.error) throw legacyResult.error;
      if (legacyResult.data) {
        chapter = {
          id: legacyResult.data.id,
          parent_content_id: legacyResult.data.content_id,
          chapter_file_key: legacyResult.data.file_key,
          chapter_format: 'mp3',
        };
      }
    }

    if (!chapter) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CHAPTER_NOT_FOUND',
          message: 'Chapitre introuvable pour ce livre audio.',
        },
      });
    }

    const fileKey = chapter.chapter_file_key || accessContext.content.file_key;
    const signedUrl = await contentsService.generateSignedUrl(fileKey, 3600, 'audiobook');

    return res.status(200).json({
      success: true,
      data: {
        chapter_id: chapter.id,
        url: signedUrl,
        expires_in: 3600,
      },
    });
  } catch (error) {
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
    const profileContext = await resolveProfileContext(req);
    const contentId = req.params.content_id;

    const accessContext = await contentAccessService.resolveContentAccess({
      userId,
      contentId,
      zone: geoService.getGeoFromRequest(req),
      profileId: profileContext.profileId,
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
    const signature = objectData.buffer
      ? objectData.buffer.subarray(0, 4).toString('hex')
      : 'none';

    console.log('[reading:file] OK', {
      contentId: content.id,
      fileKey: content.file_key,
      format: content.format,
      mimeType,
      contentLength: objectData.contentLength || objectData.buffer?.length || 0,
      signature,
    });

    res.setHeader('Content-Type', mimeType);
    if (objectData.contentLength) {
      res.setHeader('Content-Length', String(objectData.contentLength));
    }
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.status(200).send(objectData.buffer);
  } catch (error) {
    console.error('[reading:file] ERROR', {
      contentId: req.params.content_id,
      message: error?.message,
      code: error?.code,
      details: error?.details,
    });
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
    const profileContext = await resolveProfileContext(req);
    const limit = parseInt(req.query.limit) || 10;

    // Get currently in-progress reading history items
    let continueQuery = supabaseAdmin
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
          content_type,
          format,
          cover_url,
          duration_seconds
        )
      `)
      .eq('user_id', userId)
      .gt('progress_percent', 0)
      .lt('progress_percent', 100)
      .order('last_read_at', { ascending: false });

    continueQuery = applyProfileScope(continueQuery, profileContext.profileId);

    const { data: history, error: historyError } = await continueQuery.limit(limit);

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
      content_type: item.contents?.content_type || 'unknown',
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

// ============================================
// Highlights CRUD
// ============================================

/**
 * GET /api/reading/:content_id/highlights
 * Protected - List user highlights for a content
 */
router.get('/api/reading/:content_id/highlights', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const profileContext = await resolveProfileContext(req);
    const contentId = req.params.content_id;

    let query = supabaseAdmin
      .from('highlights')
      .select('*')
      .eq('user_id', userId)
      .eq('content_id', contentId)
      .order('created_at', { ascending: true });

    query = applyProfileScope(query, profileContext.profileId);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching highlights:', error);
      throw new Error('Failed to fetch highlights');
    }

    return res.status(200).json({ success: true, data: data || [] });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/reading/:content_id/highlights
 * Protected - Create a highlight
 */
router.post('/api/reading/:content_id/highlights', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const profileContext = await resolveProfileContext(req);
    const contentId = req.params.content_id;
    const { text, cfi_range, position, color, note } = req.body;

    if (!text || !cfi_range || !position) {
      return res.status(422).json({
        success: false,
        error: { code: 'INVALID_HIGHLIGHT', message: 'text, cfi_range et position sont requis.' },
      });
    }

    const { data, error } = await supabaseAdmin
      .from('highlights')
      .insert({
        user_id: userId,
        profile_id: profileContext.profileId,
        content_id: contentId,
        text,
        cfi_range,
        position,
        color: color || 'yellow',
        note: note || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating highlight:', error);
      throw new Error('Failed to create highlight');
    }

    return res.status(201).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
});

/**
 * DELETE /api/reading/:content_id/highlights/:id
 * Protected - Delete a highlight
 */
router.delete('/api/reading/:content_id/highlights/:id', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const profileContext = await resolveProfileContext(req);
    const highlightId = req.params.id;

    let query = supabaseAdmin
      .from('highlights')
      .delete()
      .eq('id', highlightId)
      .eq('user_id', userId);

    query = applyProfileScope(query, profileContext.profileId);

    const { error } = await query;

    if (error) {
      console.error('Error deleting highlight:', error);
      throw new Error('Failed to delete highlight');
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return next(error);
  }
});

// ============================================
// Bookmarks CRUD
// ============================================

/**
 * GET /api/reading/:content_id/bookmarks
 * Protected - List user bookmarks for a content
 */
router.get('/api/reading/:content_id/bookmarks', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const profileContext = await resolveProfileContext(req);
    const contentId = req.params.content_id;

    let query = supabaseAdmin
      .from('bookmarks')
      .select('*')
      .eq('user_id', userId)
      .eq('content_id', contentId)
      .order('created_at', { ascending: true });

    query = applyProfileScope(query, profileContext.profileId);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching bookmarks:', error);
      throw new Error('Failed to fetch bookmarks');
    }

    return res.status(200).json({ success: true, data: data || [] });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/reading/:content_id/bookmarks
 * Protected - Create a bookmark
 */
router.post('/api/reading/:content_id/bookmarks', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const profileContext = await resolveProfileContext(req);
    const contentId = req.params.content_id;
    const { position, label } = req.body;

    if (!position) {
      return res.status(422).json({
        success: false,
        error: { code: 'INVALID_BOOKMARK', message: 'position est requis.' },
      });
    }

    const { data, error } = await supabaseAdmin
      .from('bookmarks')
      .insert({
        user_id: userId,
        profile_id: profileContext.profileId,
        content_id: contentId,
        position,
        label: label || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating bookmark:', error);
      throw new Error('Failed to create bookmark');
    }

    return res.status(201).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
});

/**
 * DELETE /api/reading/:content_id/bookmarks/:id
 * Protected - Delete a bookmark
 */
router.delete('/api/reading/:content_id/bookmarks/:id', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const profileContext = await resolveProfileContext(req);
    const bookmarkId = req.params.id;

    let query = supabaseAdmin
      .from('bookmarks')
      .delete()
      .eq('id', bookmarkId)
      .eq('user_id', userId);

    query = applyProfileScope(query, profileContext.profileId);

    const { error } = await query;

    if (error) {
      console.error('Error deleting bookmark:', error);
      throw new Error('Failed to delete bookmark');
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return next(error);
  }
});

// ============================================
// Audio Playlist (Epic 5)
// ============================================

/**
 * GET /api/reading/audio/playlist
 * Protected - List user personal audiobook playlist
 */
router.get('/api/reading/audio/playlist', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const result = await getUserAudioPlaylist(userId);

    if (result.missingTable) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'AUDIO_PLAYLIST_TABLE_MISSING',
          message: 'La table audio_playlist_items est absente. Exécutez la migration 027_audio_playlist.sql.',
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        items: result.items,
      },
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/reading/audio/playlist
 * Protected - Add an audiobook to personal playlist
 */
router.post('/api/reading/audio/playlist', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { content_id: contentId } = req.body || {};

    if (!contentId) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'INVALID_CONTENT_ID',
          message: 'content_id est requis.',
        },
      });
    }

    const { data: content, error: contentError } = await supabaseAdmin
      .from('contents')
      .select('id, content_type')
      .eq('id', contentId)
      .maybeSingle();

    if (contentError || !content) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CONTENT_NOT_FOUND',
          message: 'Contenu non trouvé.',
        },
      });
    }

    if (content.content_type !== 'audiobook') {
      return res.status(422).json({
        success: false,
        error: {
          code: 'ONLY_AUDIOBOOK_ALLOWED',
          message: 'Seuls les contenus audio peuvent être ajoutés à la playlist.',
        },
      });
    }

    const { data: existing } = await supabaseAdmin
      .from('audio_playlist_items')
      .select('id')
      .eq('user_id', userId)
      .eq('content_id', contentId)
      .maybeSingle();

    if (existing) {
      const playlist = await getUserAudioPlaylist(userId);
      return res.status(200).json({
        success: true,
        data: {
          already_exists: true,
          items: playlist.items,
        },
      });
    }

    const { data: lastItem, error: lastItemError } = await supabaseAdmin
      .from('audio_playlist_items')
      .select('position_index')
      .eq('user_id', userId)
      .order('position_index', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastItemError && !isMissingAudioPlaylistTable(lastItemError)) {
      throw lastItemError;
    }

    if (isMissingAudioPlaylistTable(lastItemError)) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'AUDIO_PLAYLIST_TABLE_MISSING',
          message: 'La table audio_playlist_items est absente. Exécutez la migration 027_audio_playlist.sql.',
        },
      });
    }

    const nextPosition = Number(lastItem?.position_index ?? -1) + 1;
    const { error: insertError } = await supabaseAdmin
      .from('audio_playlist_items')
      .insert({
        user_id: userId,
        content_id: contentId,
        position_index: nextPosition,
      });

    if (insertError) {
      if (isMissingAudioPlaylistTable(insertError)) {
        return res.status(503).json({
          success: false,
          error: {
            code: 'AUDIO_PLAYLIST_TABLE_MISSING',
            message: 'La table audio_playlist_items est absente. Exécutez la migration 027_audio_playlist.sql.',
          },
        });
      }
      throw insertError;
    }

    const playlist = await getUserAudioPlaylist(userId);
    return res.status(201).json({
      success: true,
      data: {
        items: playlist.items,
      },
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * PUT /api/reading/audio/playlist/reorder
 * Protected - Reorder full playlist by content ids
 */
router.put('/api/reading/audio/playlist/reorder', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { content_ids: contentIds } = req.body || {};

    if (!Array.isArray(contentIds)) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'INVALID_PAYLOAD',
          message: 'content_ids (array) est requis.',
        },
      });
    }

    const { data: currentItems, error: currentError } = await supabaseAdmin
      .from('audio_playlist_items')
      .select('id, content_id')
      .eq('user_id', userId)
      .order('position_index', { ascending: true });

    if (currentError) {
      if (isMissingAudioPlaylistTable(currentError)) {
        return res.status(503).json({
          success: false,
          error: {
            code: 'AUDIO_PLAYLIST_TABLE_MISSING',
            message: 'La table audio_playlist_items est absente. Exécutez la migration 027_audio_playlist.sql.',
          },
        });
      }
      throw currentError;
    }

    const currentContentIds = (currentItems || []).map((item) => item.content_id);
    const dedupRequested = Array.from(new Set(contentIds));

    if (
      dedupRequested.length !== currentContentIds.length ||
      dedupRequested.some((contentId) => !currentContentIds.includes(contentId))
    ) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'INVALID_REORDER_SET',
          message: 'content_ids doit contenir exactement les éléments actuels de la playlist.',
        },
      });
    }

    // Phase 1: shift all indexes to avoid unique(user_id, position_index) conflicts
    for (let idx = 0; idx < (currentItems || []).length; idx += 1) {
      const item = currentItems[idx];
      const { error: shiftError } = await supabaseAdmin
        .from('audio_playlist_items')
        .update({ position_index: idx + 1000 })
        .eq('id', item.id)
        .eq('user_id', userId);

      if (shiftError) throw shiftError;
    }

    // Phase 2: write final order
    for (let idx = 0; idx < dedupRequested.length; idx += 1) {
      const contentId = dedupRequested[idx];
      const { error: reorderError } = await supabaseAdmin
        .from('audio_playlist_items')
        .update({ position_index: idx })
        .eq('user_id', userId)
        .eq('content_id', contentId);

      if (reorderError) throw reorderError;
    }

    const playlist = await getUserAudioPlaylist(userId);
    return res.status(200).json({
      success: true,
      data: {
        items: playlist.items,
      },
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * DELETE /api/reading/audio/playlist/:content_id
 * Protected - Remove audiobook from playlist
 */
router.delete('/api/reading/audio/playlist/:content_id', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const contentId = req.params.content_id;

    const { error: deleteError } = await supabaseAdmin
      .from('audio_playlist_items')
      .delete()
      .eq('user_id', userId)
      .eq('content_id', contentId);

    if (deleteError) {
      if (isMissingAudioPlaylistTable(deleteError)) {
        return res.status(503).json({
          success: false,
          error: {
            code: 'AUDIO_PLAYLIST_TABLE_MISSING',
            message: 'La table audio_playlist_items est absente. Exécutez la migration 027_audio_playlist.sql.',
          },
        });
      }
      throw deleteError;
    }

    // Re-compact positions after delete
    const { data: restItems, error: restError } = await supabaseAdmin
      .from('audio_playlist_items')
      .select('id')
      .eq('user_id', userId)
      .order('position_index', { ascending: true });

    if (restError) {
      throw restError;
    }

    for (let idx = 0; idx < (restItems || []).length; idx += 1) {
      const item = restItems[idx];
      const { error: compactError } = await supabaseAdmin
        .from('audio_playlist_items')
        .update({ position_index: idx })
        .eq('id', item.id)
        .eq('user_id', userId);

      if (compactError) throw compactError;
    }

    const playlist = await getUserAudioPlaylist(userId);
    return res.status(200).json({
      success: true,
      data: {
        items: playlist.items,
      },
    });
  } catch (error) {
    return next(error);
  }
});

// ─────────────────────────────────────────────
// BOOKMARKS
// ─────────────────────────────────────────────

/**
 * GET /api/reading/:content_id/bookmarks
 * List all bookmarks for a content (owned by user)
 */
router.get('/api/reading/:content_id/bookmarks', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const profileContext = await resolveProfileContext(req);
    const contentId = req.params.content_id;

    let query = supabaseAdmin
      .from('bookmarks')
      .select('id, position, label, created_at')
      .eq('user_id', userId)
      .eq('content_id', contentId)
      .order('created_at', { ascending: false });

    query = applyProfileScope(query, profileContext.profileId);

    const { data, error } = await query;

    if (error) throw error;

    return res.status(200).json({ success: true, data: data || [] });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/reading/:content_id/bookmarks
 * Body: { position: {percent, chapter_label, paragraph_index?}, label? }
 */
router.post('/api/reading/:content_id/bookmarks', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const profileContext = await resolveProfileContext(req);
    const contentId = req.params.content_id;
    const { position, label } = req.body;

    if (!position || typeof position !== 'object') {
      return res.status(422).json({
        success: false,
        error: { code: 'INVALID_POSITION', message: 'La position du marque-page est requise.' },
      });
    }

    const { data, error } = await supabaseAdmin
      .from('bookmarks')
      .insert({ user_id: userId, profile_id: profileContext.profileId, content_id: contentId, position, label: label || null })
      .select('id, position, label, created_at')
      .single();

    if (error) throw error;

    return res.status(201).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
});

/**
 * DELETE /api/reading/:content_id/bookmarks/:bookmark_id
 */
router.delete('/api/reading/:content_id/bookmarks/:bookmark_id', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const profileContext = await resolveProfileContext(req);
    const contentId = req.params.content_id;
    const bookmarkId = req.params.bookmark_id;

    let query = supabaseAdmin
      .from('bookmarks')
      .delete()
      .eq('id', bookmarkId)
      .eq('user_id', userId)
      .eq('content_id', contentId);

    query = applyProfileScope(query, profileContext.profileId);

    const { error } = await query;

    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (error) {
    return next(error);
  }
});

// ─────────────────────────────────────────────
// HIGHLIGHTS
// ─────────────────────────────────────────────

/**
 * GET /api/reading/:content_id/highlights
 */
router.get('/api/reading/:content_id/highlights', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const profileContext = await resolveProfileContext(req);
    const contentId = req.params.content_id;

    let query = supabaseAdmin
      .from('highlights')
      .select('id, text, cfi_range, position, color, note, created_at')
      .eq('user_id', userId)
      .eq('content_id', contentId)
      .order('created_at', { ascending: true });

    query = applyProfileScope(query, profileContext.profileId);

    const { data, error } = await query;

    if (error) throw error;

    return res.status(200).json({ success: true, data: data || [] });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/reading/:content_id/highlights
 * Body: { text, cfi_range, position: {paragraphIndex, chapter_label?}, color?, note? }
 */
router.post('/api/reading/:content_id/highlights', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const profileContext = await resolveProfileContext(req);
    const contentId = req.params.content_id;
    const { text, cfi_range, position, color, note } = req.body;

    if (!text || !cfi_range || !position) {
      return res.status(422).json({
        success: false,
        error: { code: 'INVALID_HIGHLIGHT', message: 'text, cfi_range et position sont requis.' },
      });
    }

    const { data, error } = await supabaseAdmin
      .from('highlights')
      .insert({
        user_id: userId,
        profile_id: profileContext.profileId,
        content_id: contentId,
        text,
        cfi_range,
        position,
        color: color || 'yellow',
        note: note || null,
      })
      .select('id, text, cfi_range, position, color, note, created_at')
      .single();

    if (error) throw error;

    return res.status(201).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
});

/**
 * DELETE /api/reading/:content_id/highlights/:highlight_id
 */
router.delete('/api/reading/:content_id/highlights/:highlight_id', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const profileContext = await resolveProfileContext(req);
    const contentId = req.params.content_id;
    const highlightId = req.params.highlight_id;

    let query = supabaseAdmin
      .from('highlights')
      .delete()
      .eq('id', highlightId)
      .eq('user_id', userId)
      .eq('content_id', contentId);

    query = applyProfileScope(query, profileContext.profileId);

    const { error } = await query;

    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (error) {
    return next(error);
  }
});

// ─────────────────────────────────────────────
// EBOOK READING LIST (liste de lecture)
// ─────────────────────────────────────────────

/**
 * GET /api/reading/ebook/list
 * Récupère la liste de lecture ebooks de l'utilisateur
 */
router.get('/api/reading/ebook/list', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const profileContext = await resolveProfileContext(req);
    let query = supabaseAdmin
      .from('ebook_reading_list')
      .select(`
        id, added_at,
        contents ( id, title, author, cover_url, content_type, language )
      `)
      .eq('user_id', userId)
      .order('added_at', { ascending: false });

    query = applyProfileScope(query, profileContext.profileId);

    const { data, error } = await query;

    if (error) throw error;

    return res.status(200).json({
      success: true,
      data: { items: (data || []).map(item => ({ ...item.contents, added_at: item.added_at })) },
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/reading/ebook/list
 * Ajoute un ebook à la liste de lecture
 * Body: { content_id }
 */
router.post('/api/reading/ebook/list', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const profileContext = await resolveProfileContext(req);
    const { content_id: contentId } = req.body;

    if (!contentId) {
      return res.status(422).json({ success: false, error: { message: 'content_id requis.' } });
    }

    let existingQuery = supabaseAdmin
      .from('ebook_reading_list')
      .select('id')
      .eq('user_id', userId)
      .eq('content_id', contentId);

    existingQuery = applyProfileScope(existingQuery, profileContext.profileId);

    const { data: existing, error: existingError } = await existingQuery.maybeSingle();
    if (existingError) throw existingError;

    if (!existing) {
      const { error } = await supabaseAdmin
        .from('ebook_reading_list')
        .insert({ user_id: userId, profile_id: profileContext.profileId, content_id: contentId });

      if (error) throw error;
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return next(error);
  }
});

/**
 * DELETE /api/reading/ebook/list/:content_id
 * Retire un ebook de la liste de lecture
 */
router.delete('/api/reading/ebook/list/:content_id', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const profileContext = await resolveProfileContext(req);
    const contentId = req.params.content_id;

    let query = supabaseAdmin
      .from('ebook_reading_list')
      .delete()
      .eq('user_id', userId)
      .eq('content_id', contentId);

    query = applyProfileScope(query, profileContext.profileId);

    const { error } = await query;

    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (error) {
    return next(error);
  }
});

// ─────────────────────────────────────────────
// AVIS / REVIEWS
// ─────────────────────────────────────────────

/**
 * GET /api/reading/reviews/:content_id
 * Avis publics d'un contenu + stats + avis de l'utilisateur courant
 */
router.get('/api/reading/reviews/:content_id', async (req, res, next) => {
  try {
    const userId = req.user?.id || null; // optional auth via middleware
    const contentId = req.params.content_id;

    const [reviewsResult, statsResult] = await Promise.allSettled([
      supabaseAdmin
        .from('content_reviews')
        .select('id, rating, body, created_at, profiles ( id, full_name )')
        .eq('content_id', contentId)
        .eq('is_visible', true)
        .order('created_at', { ascending: false })
        .limit(50),
      supabaseAdmin
        .from('content_review_stats')
        .select('*')
        .eq('content_id', contentId)
        .maybeSingle(),
    ]);

    const reviews = reviewsResult.status === 'fulfilled' ? (reviewsResult.value.data || []) : [];
    const stats   = statsResult.status === 'fulfilled' ? statsResult.value.data : null;

    // Avis de l'utilisateur courant (si connecté)
    let myReview = null;
    if (userId) {
      const { data } = await supabaseAdmin
        .from('content_reviews')
        .select('id, rating, body, created_at')
        .eq('content_id', contentId)
        .eq('user_id', userId)
        .maybeSingle();
      myReview = data || null;
    }

    return res.status(200).json({ success: true, data: { reviews, stats, myReview } });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/reading/reviews/:content_id
 * Soumettre ou mettre à jour son avis (upsert)
 * Body: { rating, body? }
 */
router.post('/api/reading/reviews/:content_id', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const contentId = req.params.content_id;
    const { rating, body } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(422).json({ success: false, error: { message: 'rating entre 1 et 5 requis.' } });
    }

    const { data, error } = await supabaseAdmin
      .from('content_reviews')
      .upsert(
        { user_id: userId, content_id: contentId, rating: Number(rating), body: body || null, updated_at: new Date().toISOString() },
        { onConflict: 'content_id,user_id' }
      )
      .select('id, rating, body, created_at')
      .single();

    if (error) throw error;

    return res.status(200).json({ success: true, data: { review: data } });
  } catch (error) {
    return next(error);
  }
});

/**
 * DELETE /api/reading/reviews/:content_id
 * Supprimer son avis
 */
router.delete('/api/reading/reviews/:content_id', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const contentId = req.params.content_id;

    const { error } = await supabaseAdmin
      .from('content_reviews')
      .delete()
      .eq('user_id', userId)
      .eq('content_id', contentId);

    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
