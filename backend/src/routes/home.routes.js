const express = require('express');
const router = express.Router();
const { supabase } = require('../config/database');
const { verifyJWT } = require('../middleware/auth');

/**
 * GET /home
 * Protected endpoint - Get personalized home data
 * Returns: continue_reading, new_releases, popular, recommended
 */
router.get('/home', verifyJWT, async (req, res, next) => {
  try {
    const userId = req.user.id;

    // 1. Continue Reading - derniers contenus lus avec progression
    const { data: continueReading } = await supabase
      .from('reading_history')
      .select(`
        content_id,
        progress_percent,
        last_read_at,
        contents:content_id (
          id,
          title,
          author,
          cover_url,
          content_type,
          language
        )
      `)
      .eq('user_id', userId)
      .gt('progress_percent', 0)
      .lt('progress_percent', 100)
      .order('last_read_at', { ascending: false })
      .limit(5);

    // 2. New Releases - derniers contenus publiés
    const { data: newReleases } = await supabase
      .from('contents')
      .select('id, title, author, cover_url, content_type, language, published_at')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(5);

    // 3. Popular - contenus les plus lus (pour l'instant, tri par date de création)
    // TODO: Ajouter colonne view_count et l'utiliser ici
    const { data: popular } = await supabase
      .from('contents')
      .select('id, title, author, cover_url, content_type, language')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(5);

    // 4. Recommended - pour l'instant, utilisons les contenus bien notés
    // TODO Epic 5: Implémenter recommandations personnalisées
    const { data: recommended } = await supabase
      .from('contents')
      .select('id, title, author, cover_url, content_type, language')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(5);

    // Formater continue_reading pour ajouter les détails du content
    const formattedContinueReading = (continueReading || []).map(item => ({
      ...item.contents,
      progress_percent: item.progress_percent,
      last_read_at: item.last_read_at
    }));

    res.status(200).json({
      success: true,
      data: {
        continue_reading: formattedContinueReading,
        new_releases: newReleases || [],
        popular: popular || [],
        recommended: recommended || []
      }
    });
  } catch (error) {
    console.error('Error fetching home data:', error);
    next(error);
  }
});

module.exports = router;
