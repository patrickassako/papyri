/**
 * Admin Books Overview Routes
 * Mounted on /api/admin/books-overview
 * Protected: admin only
 */

const express = require('express');
const router = express.Router();
const { verifyJWT, requirePermissionForMethod } = require('../middleware/auth');
const { supabaseAdmin } = require('../config/database');
const publisherService = require('../services/publisher.service');

const isAdmin = [verifyJWT, requirePermissionForMethod({ read: 'content.read', write: 'content.write', delete: 'content.delete' })];

// ─────────────────────────────────────────────────────────────
// GET /stats
// Returns global KPIs about the books catalogue
// ─────────────────────────────────────────────────────────────
router.get('/stats', isAdmin, async (req, res) => {
  try {
    // Total contents
    const { count: totalBooks, error: totalErr } = await supabaseAdmin
      .from('contents')
      .select('*', { count: 'exact', head: true });
    if (totalErr) throw totalErr;

    // Ebooks
    const { count: ebooks, error: ebooksErr } = await supabaseAdmin
      .from('contents')
      .select('*', { count: 'exact', head: true })
      .eq('content_type', 'ebook');
    if (ebooksErr) throw ebooksErr;

    // Audiobooks
    const { count: audiobooks, error: audioErr } = await supabaseAdmin
      .from('contents')
      .select('*', { count: 'exact', head: true })
      .eq('content_type', 'audiobook');
    if (audioErr) throw audioErr;

    // Published
    const { count: published, error: pubErr } = await supabaseAdmin
      .from('contents')
      .select('*', { count: 'exact', head: true })
      .eq('is_published', true);
    if (pubErr) throw pubErr;

    // Pending (validation_status = 'pending' in publisher_books)
    const { count: pending, error: pendingErr } = await supabaseAdmin
      .from('publisher_books')
      .select('*', { count: 'exact', head: true })
      .eq('validation_status', 'pending');
    if (pendingErr) throw pendingErr;

    // Approved
    const { count: approved, error: approvedErr } = await supabaseAdmin
      .from('publisher_books')
      .select('*', { count: 'exact', head: true })
      .eq('validation_status', 'approved');
    if (approvedErr) throw approvedErr;

    // Reading history stats
    const { data: historyStats, error: histErr } = await supabaseAdmin
      .from('reading_history')
      .select('is_completed, progress_percent');
    if (histErr) throw histErr;

    const totalReads = historyStats ? historyStats.length : 0;
    const completions = historyStats ? historyStats.filter(h => h.is_completed).length : 0;
    const avgProgress = totalReads > 0
      ? Math.round(historyStats.reduce((sum, h) => sum + (h.progress_percent || 0), 0) / totalReads)
      : 0;

    return res.json({
      totalBooks: totalBooks || 0,
      ebooks: ebooks || 0,
      audiobooks: audiobooks || 0,
      published: published || 0,
      pending: pending || 0,
      approved: approved || 0,
      totalReads,
      completions,
      avgProgress,
    });
  } catch (err) {
    console.error('[admin.books] GET /stats error:', err);
    return res.status(500).json({ error: 'Erreur lors du chargement des statistiques.' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /publishers
// Returns one entry per publisher + one "orphan" entry
// ─────────────────────────────────────────────────────────────
router.get('/publishers', isAdmin, async (req, res) => {
  try {
    // Fetch all publishers
    const { data: publishers, error: pubErr } = await supabaseAdmin
      .from('publishers')
      .select('id, company_name, status')
      .order('company_name');
    if (pubErr) throw pubErr;

    // Fetch all publisher_books
    const { data: publisherBooks, error: pbErr } = await supabaseAdmin
      .from('publisher_books')
      .select('id, publisher_id, content_id, validation_status');
    if (pbErr) throw pbErr;

    // Fetch all reading_history
    const { data: history, error: histErr } = await supabaseAdmin
      .from('reading_history')
      .select('content_id, is_completed');
    if (histErr) throw histErr;

    // Build a map: content_id → { totalReads, completions }
    const readMap = {};
    if (history) {
      for (const row of history) {
        if (!readMap[row.content_id]) readMap[row.content_id] = { totalReads: 0, completions: 0 };
        readMap[row.content_id].totalReads += 1;
        if (row.is_completed) readMap[row.content_id].completions += 1;
      }
    }

    // Build publisher stats
    const result = (publishers || []).map(pub => {
      const books = (publisherBooks || []).filter(pb => pb.publisher_id === pub.id);
      const approvedCount = books.filter(b => b.validation_status === 'approved').length;
      let totalReads = 0;
      let completions = 0;
      for (const b of books) {
        const stats = readMap[b.content_id] || {};
        totalReads += stats.totalReads || 0;
        completions += stats.completions || 0;
      }
      return {
        publisher: pub,
        bookCount: books.length,
        approvedCount,
        totalReads,
        completions,
      };
    });

    // Orphan books: contents without any entry in publisher_books
    const linkedContentIds = new Set((publisherBooks || []).map(pb => pb.content_id));
    const { data: allContents, error: contErr } = await supabaseAdmin
      .from('contents')
      .select('id');
    if (contErr) throw contErr;

    const orphanContentIds = (allContents || [])
      .map(c => c.id)
      .filter(id => !linkedContentIds.has(id));

    let orphanReads = 0;
    let orphanCompletions = 0;
    for (const cid of orphanContentIds) {
      const stats = readMap[cid] || {};
      orphanReads += stats.totalReads || 0;
      orphanCompletions += stats.completions || 0;
    }

    const orphan = {
      publisher: { id: 'orphan', company_name: 'Papyri', status: 'active' },
      bookCount: orphanContentIds.length,
      approvedCount: orphanContentIds.length, // direct books, no validation needed
      totalReads: orphanReads,
      completions: orphanCompletions,
    };

    return res.json([orphan, ...result]);
  } catch (err) {
    console.error('[admin.books] GET /publishers error:', err);
    return res.status(500).json({ error: 'Erreur lors du chargement des éditeurs.' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /publisher/:publisherId/books
// Returns paginated book list for a given publisher (or orphan)
// ─────────────────────────────────────────────────────────────
router.get('/publisher/:publisherId/books', isAdmin, async (req, res) => {
  try {
    const { publisherId } = req.params;
    const search      = (req.query.search || '').trim().toLowerCase();
    const filterType  = req.query.type   || '';   // ebook | audiobook | both
    const filterStatus= req.query.status || '';   // pending | approved | rejected | paused | published | unpublished | archived
    const sortBy      = req.query.sort   || 'title'; // title | recent | reads
    const showArchived = filterStatus === 'archived'; // true = show only archived; false = hide archived
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    let books = [];
    let total = 0;

    if (publisherId === 'orphan') {
      const { data: allPB, error: pbErr } = await supabaseAdmin
        .from('publisher_books').select('content_id');
      if (pbErr) throw pbErr;
      const linkedIds = (allPB || []).map(pb => pb.content_id);

      let query = supabaseAdmin
        .from('contents')
        .select('id, title, author, cover_url, content_type, format, is_published, language, created_at', { count: 'exact' });

      if (linkedIds.length > 0) query = query.not('id', 'in', `(${linkedIds.join(',')})`);
      if (search)      query = query.or(`title.ilike.%${search}%,author.ilike.%${search}%`);
      if (filterType)  query = query.eq('content_type', filterType);
      // Archive filter: show only archived OR hide archived (default)
      query = query.eq('is_archived', showArchived);
      if (filterStatus === 'published')   query = query.eq('is_published', true);
      if (filterStatus === 'unpublished') query = query.eq('is_published', false);

      const orderCol = sortBy === 'recent' ? 'created_at' : 'title';
      const ascending = sortBy !== 'recent';

      const { data: contents, count, error: contErr } = await query
        .order(orderCol, { ascending })
        .range(offset, offset + limit - 1);
      if (contErr) throw contErr;
      total = count || 0;

      const contentIds = (contents || []).map(c => c.id);
      let readMap = {};
      if (contentIds.length > 0) {
        const { data: history } = await supabaseAdmin
          .from('reading_history').select('content_id, is_completed').in('content_id', contentIds);
        for (const row of (history || [])) {
          if (!readMap[row.content_id]) readMap[row.content_id] = { totalReads: 0, completions: 0 };
          readMap[row.content_id].totalReads += 1;
          if (row.is_completed) readMap[row.content_id].completions += 1;
        }
      }

      books = (contents || []).map(c => ({
        id: null,
        content_id: c.id,
        title: c.title,
        author: c.author,
        cover_url: c.cover_url,
        content_type: c.content_type,
        format: c.format,
        validation_status: null,
        is_published: c.is_published,
        is_archived: c.is_archived || false,
        totalReads: readMap[c.id]?.totalReads || 0,
        completions: readMap[c.id]?.completions || 0,
        submitted_at: null,
        created_at: c.created_at,
      }));

    } else {
      // Normal publisher
      let pbQuery = supabaseAdmin
        .from('publisher_books')
        .select('id, content_id, validation_status, submitted_at')
        .eq('publisher_id', publisherId);

      // Status filter on publisher_books side (not archive/published/unpublished — those are on contents)
      if (filterStatus && !['published', 'unpublished', 'archived'].includes(filterStatus)) {
        pbQuery = pbQuery.eq('validation_status', filterStatus);
      }

      const { data: pubBooks, error: pbErr } = await pbQuery;
      if (pbErr) throw pbErr;
      if (!pubBooks || pubBooks.length === 0) return res.json({ books: [], total: 0 });

      const contentIds = pubBooks.map(pb => pb.content_id);

      let contQuery = supabaseAdmin
        .from('contents')
        .select('id, title, author, cover_url, content_type, format, is_published, created_at')
        .in('id', contentIds);

      if (search)     contQuery = contQuery.or(`title.ilike.%${search}%,author.ilike.%${search}%`);
      if (filterType) contQuery = contQuery.eq('content_type', filterType);
      // Archive filter: show only archived OR hide archived (default)
      contQuery = contQuery.eq('is_archived', showArchived);
      if (filterStatus === 'published')   contQuery = contQuery.eq('is_published', true);
      if (filterStatus === 'unpublished') contQuery = contQuery.eq('is_published', false);

      const { data: contents, error: contErr } = await contQuery.order('title');
      if (contErr) throw contErr;

      const contentMap = {};
      for (const c of (contents || [])) contentMap[c.id] = c;

      let matchingPB = pubBooks.filter(pb => contentMap[pb.content_id]);

      // Sort
      if (sortBy === 'recent') {
        matchingPB = matchingPB.sort((a, b) =>
          new Date(b.submitted_at || 0) - new Date(a.submitted_at || 0)
        );
      } else {
        matchingPB = matchingPB.sort((a, b) => {
          const ta = (contentMap[a.content_id]?.title || '').toLowerCase();
          const tb = (contentMap[b.content_id]?.title || '').toLowerCase();
          return ta.localeCompare(tb);
        });
      }

      total = matchingPB.length;
      const paginated = matchingPB.slice(offset, offset + limit);

      const matchingContentIds = paginated.map(pb => pb.content_id);
      let readMap = {};
      if (matchingContentIds.length > 0) {
        const { data: history } = await supabaseAdmin
          .from('reading_history').select('content_id, is_completed').in('content_id', matchingContentIds);
        for (const row of (history || [])) {
          if (!readMap[row.content_id]) readMap[row.content_id] = { totalReads: 0, completions: 0 };
          readMap[row.content_id].totalReads += 1;
          if (row.is_completed) readMap[row.content_id].completions += 1;
        }
      }

      // Sort by reads if requested
      const sortedPaginated = sortBy === 'reads'
        ? [...paginated].sort((a, b) =>
            (readMap[b.content_id]?.totalReads || 0) - (readMap[a.content_id]?.totalReads || 0)
          )
        : paginated;

      books = sortedPaginated.map(pb => {
        const c = contentMap[pb.content_id] || {};
        return {
          id: pb.id,
          content_id: pb.content_id,
          title: c.title || '',
          author: c.author || '',
          cover_url: c.cover_url || null,
          content_type: c.content_type || null,
          format: c.format || null,
          validation_status: pb.validation_status,
          is_published: c.is_published || false,
          is_archived: c.is_archived || false,
          totalReads: readMap[pb.content_id]?.totalReads || 0,
          completions: readMap[pb.content_id]?.completions || 0,
          submitted_at: pb.submitted_at,
          created_at: c.created_at,
        };
      });
    }

    return res.json({ books, total });
  } catch (err) {
    console.error('[admin.books] GET /publisher/:id/books error:', err);
    return res.status(500).json({ error: 'Erreur lors du chargement des livres.' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /content/:contentId
// Full detail for one content: content fields + publisher_book info
// ─────────────────────────────────────────────────────────────
router.get('/content/:contentId', isAdmin, async (req, res) => {
  try {
    const { contentId } = req.params;

    // Fetch full content record
    const { data: content, error: contErr } = await supabaseAdmin
      .from('contents')
      .select('id, title, author, description, cover_url, content_type, format, language, duration_seconds, access_type, price_cents, price_currency, is_published, is_archived, archived_at, created_at, updated_at')
      .eq('id', contentId)
      .single();
    if (contErr) throw contErr;
    if (!content) return res.status(404).json({ error: 'Contenu introuvable.' });

    // Fetch publisher_book entry (if any)
    const { data: pubBook, error: pbErr } = await supabaseAdmin
      .from('publisher_books')
      .select('id, publisher_id, validation_status, rejection_reason, submitted_at')
      .eq('content_id', contentId)
      .maybeSingle();
    if (pbErr) throw pbErr;

    // Fetch publisher info if linked
    let publisher = null;
    if (pubBook?.publisher_id) {
      const { data: pub } = await supabaseAdmin
        .from('publishers')
        .select('id, company_name, status')
        .eq('id', pubBook.publisher_id)
        .maybeSingle();
      publisher = pub || null;
    }

    return res.json({
      ...content,
      publisher_book: pubBook || null,
      publisher: publisher,
    });
  } catch (err) {
    console.error('[admin.books] GET /content/:id error:', err);
    return res.status(500).json({ error: 'Erreur lors du chargement du contenu.' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /content/:contentId/stats
// Aggregated reading stats for one content
// ─────────────────────────────────────────────────────────────
router.get('/content/:contentId/stats', isAdmin, async (req, res) => {
  try {
    const { contentId } = req.params;

    const { data: history, error: histErr } = await supabaseAdmin
      .from('reading_history')
      .select('user_id, progress_percent, is_completed, last_read_at, total_time_seconds')
      .eq('content_id', contentId);
    if (histErr) throw histErr;

    const rows = history || [];
    const totalReads = rows.length;
    const uniqueReaders = new Set(rows.map(r => r.user_id)).size;
    const completions = rows.filter(r => r.is_completed).length;
    const avgProgress = totalReads > 0
      ? Math.round(rows.reduce((s, r) => s + (r.progress_percent || 0), 0) / totalReads)
      : 0;
    const avgTimeSeconds = totalReads > 0
      ? Math.round(rows.reduce((s, r) => s + (r.total_time_seconds || 0), 0) / totalReads)
      : 0;
    const lastReadAt = rows.length > 0
      ? rows.reduce((latest, r) => {
          if (!r.last_read_at) return latest;
          return !latest || r.last_read_at > latest ? r.last_read_at : latest;
        }, null)
      : null;

    return res.json({
      totalReads,
      uniqueReaders,
      completions,
      avgProgress,
      avgTimeSeconds,
      lastReadAt,
    });
  } catch (err) {
    console.error('[admin.books] GET /content/:id/stats error:', err);
    return res.status(500).json({ error: 'Erreur lors du chargement des statistiques.' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /content/:contentId/history
// Paginated reading history for one content
// ─────────────────────────────────────────────────────────────
router.get('/content/:contentId/history', isAdmin, async (req, res) => {
  try {
    const { contentId } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    // Fetch history rows for this content
    const { data: historyRows, count, error: histErr } = await supabaseAdmin
      .from('reading_history')
      .select('user_id, progress_percent, is_completed, last_read_at, total_time_seconds', { count: 'exact' })
      .eq('content_id', contentId)
      .order('last_read_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (histErr) throw histErr;

    const rows = historyRows || [];
    const total = count || 0;

    if (rows.length === 0) {
      return res.json({ history: [], total: 0 });
    }

    // Fetch profiles for these users
    const userIds = [...new Set(rows.map(r => r.user_id))];
    const { data: profiles, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .in('id', userIds);
    if (profErr) throw profErr;

    const profileMap = {};
    for (const p of (profiles || [])) profileMap[p.id] = p;

    const history = rows.map(r => ({
      user: {
        id: r.user_id,
        full_name: profileMap[r.user_id]?.full_name || 'Inconnu',
        email: profileMap[r.user_id]?.email || '',
        avatar_url: profileMap[r.user_id]?.avatar_url || null,
      },
      progress_percent: r.progress_percent || 0,
      is_completed: r.is_completed || false,
      last_read_at: r.last_read_at,
      total_time_seconds: r.total_time_seconds || 0,
    }));

    return res.json({ history, total });
  } catch (err) {
    console.error('[admin.books] GET /content/:id/history error:', err);
    return res.status(500).json({ error: 'Erreur lors du chargement de l\'historique.' });
  }
});

// ─────────────────────────────────────────────────────────────
// PATCH /content/:contentId/archive
// Toggle archive status (archives → depublishes; unarchives → stays unpublished)
// ─────────────────────────────────────────────────────────────
router.patch('/content/:contentId/archive', isAdmin, async (req, res) => {
  try {
    const { contentId } = req.params;

    // Get current state
    const { data: current, error: fetchErr } = await supabaseAdmin
      .from('contents')
      .select('id, is_archived')
      .eq('id', contentId)
      .single();
    if (fetchErr || !current) return res.status(404).json({ error: 'Contenu introuvable.' });

    const newArchived = !current.is_archived;
    const updatePayload = { is_archived: newArchived };
    if (newArchived) {
      // Archiving: depublish and stamp archived_at
      updatePayload.is_published = false;
      updatePayload.archived_at  = new Date().toISOString();
    } else {
      // Unarchiving: clear archived_at (stays unpublished — admin must re-publish manually)
      updatePayload.archived_at = null;
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('contents')
      .update(updatePayload)
      .eq('id', contentId)
      .select('id, is_archived, is_published, archived_at')
      .single();
    if (updateErr) throw updateErr;

    return res.json({ success: true, content: updated });
  } catch (err) {
    console.error('[admin.books] PATCH /content/:id/archive error:', err);
    return res.status(500).json({ error: 'Erreur lors de l\'archivage.' });
  }
});

// ─────────────────────────────────────────────────────────────
// PATCH /content/:contentId/publish
// Toggle publication status. Archived contents cannot be published.
// For publisher-managed books, publish requires approved validation.
// ─────────────────────────────────────────────────────────────
router.patch('/content/:contentId/publish', isAdmin, async (req, res) => {
  try {
    const { contentId } = req.params;

    const { data: content, error: contentErr } = await supabaseAdmin
      .from('contents')
      .select('id, is_published, is_archived')
      .eq('id', contentId)
      .single();
    if (contentErr || !content) return res.status(404).json({ error: 'Contenu introuvable.' });

    const { data: pubBook, error: pubBookErr } = await supabaseAdmin
      .from('publisher_books')
      .select('id, validation_status')
      .eq('content_id', contentId)
      .maybeSingle();
    if (pubBookErr) throw pubBookErr;

    const nextPublished = !content.is_published;
    if (nextPublished && content.is_archived) {
      return res.status(400).json({ error: 'Un contenu archivé doit être désarchivé avant publication.' });
    }
    if (nextPublished && pubBook && pubBook.validation_status !== 'approved') {
      return res.status(400).json({ error: 'Le contenu doit être approuvé avant publication.' });
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('contents')
      .update({ is_published: nextPublished })
      .eq('id', contentId)
      .select('id, is_published, is_archived')
      .single();
    if (updateErr) throw updateErr;

    return res.json({ success: true, content: updated });
  } catch (err) {
    console.error('[admin.books] PATCH /content/:id/publish error:', err);
    return res.status(500).json({ error: 'Erreur lors de la mise à jour de la publication.' });
  }
});

// ─────────────────────────────────────────────────────────────
// PATCH /content/:contentId/validation
// Manage moderation state for publisher-managed content.
// action: approve | reject | pause | pending
// ─────────────────────────────────────────────────────────────
router.patch('/content/:contentId/validation', isAdmin, express.json(), async (req, res) => {
  try {
    const { contentId } = req.params;
    const { action, reason } = req.body || {};

    if (!['approve', 'reject', 'pause', 'pending'].includes(action)) {
      return res.status(400).json({ error: 'Action de validation invalide.' });
    }

    const { data: pubBook, error: pubBookErr } = await supabaseAdmin
      .from('publisher_books')
      .select('id')
      .eq('content_id', contentId)
      .maybeSingle();
    if (pubBookErr) throw pubBookErr;
    if (!pubBook) {
      return res.status(400).json({ error: 'Ce contenu n’a pas de workflow éditeur à modérer.' });
    }

    if ((action === 'reject' || action === 'pause') && !String(reason || '').trim()) {
      return res.status(400).json({ error: 'Un motif est requis pour cette action.' });
    }

    let result;
    if (action === 'approve') result = await publisherService.approveContent(pubBook.id, req.user.id);
    if (action === 'reject') result = await publisherService.rejectContent(pubBook.id, req.user.id, String(reason).trim());
    if (action === 'pause') result = await publisherService.pauseContent(pubBook.id, req.user.id, String(reason).trim());
    if (action === 'pending') result = await publisherService.setPendingContent(pubBook.id, req.user.id);

    const { data: content } = await supabaseAdmin
      .from('contents')
      .select('id, is_published, is_archived')
      .eq('id', contentId)
      .single();

    return res.json({
      success: true,
      publisher_book: result,
      content: content || null,
    });
  } catch (err) {
    console.error('[admin.books] PATCH /content/:id/validation error:', err);
    return res.status(500).json({ error: err.message || 'Erreur lors de la modération.' });
  }
});

// ─────────────────────────────────────────────────────────────
// DELETE /content/:contentId
// Permanently delete a content and all related data
// ─────────────────────────────────────────────────────────────
router.delete('/content/:contentId', isAdmin, async (req, res) => {
  try {
    const { contentId } = req.params;

    // Verify content exists
    const { data: content, error: fetchErr } = await supabaseAdmin
      .from('contents')
      .select('id, title')
      .eq('id', contentId)
      .single();
    if (fetchErr || !content) return res.status(404).json({ error: 'Contenu introuvable.' });

    // Cascade delete in order (FK dependencies)
    // 1. audio_chapters
    const { error: chapErr } = await supabaseAdmin
      .from('audio_chapters')
      .delete()
      .eq('content_id', contentId);
    if (chapErr) console.warn('[admin.books] delete chapters warning:', chapErr.message);

    // 2. reading_history
    const { error: histErr } = await supabaseAdmin
      .from('reading_history')
      .delete()
      .eq('content_id', contentId);
    if (histErr) console.warn('[admin.books] delete history warning:', histErr.message);

    // 3. publisher_books
    const { error: pbErr } = await supabaseAdmin
      .from('publisher_books')
      .delete()
      .eq('content_id', contentId);
    if (pbErr) console.warn('[admin.books] delete publisher_books warning:', pbErr.message);

    // 4. contents (final delete)
    const { error: contErr } = await supabaseAdmin
      .from('contents')
      .delete()
      .eq('id', contentId);
    if (contErr) throw contErr;

    return res.json({ success: true, deleted: contentId });
  } catch (err) {
    console.error('[admin.books] DELETE /content/:id error:', err);
    return res.status(500).json({ error: 'Erreur lors de la suppression.' });
  }
});

module.exports = router;
