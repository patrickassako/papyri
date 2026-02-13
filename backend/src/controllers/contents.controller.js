/**
 * Contents Controller
 * Handlers pour les routes de catalogue
 */

const contentsService = require('../services/contents.service');

/**
 * GET /contents
 * Get contents with pagination and filters
 */
async function listContents(req, res) {
  try {
    const { page, limit, type, language, category, sort } = req.query;

    const result = await contentsService.getContents({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      type,
      language,
      category,
      sort,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('List contents error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LIST_CONTENTS_FAILED',
        message: 'Impossible de récupérer les contenus.',
      },
    });
  }
}

/**
 * GET /contents/:id
 * Get single content by ID
 */
async function getContent(req, res) {
  try {
    const { id } = req.params;

    const content = await contentsService.getContentById(id);

    res.json({
      success: true,
      data: content,
    });
  } catch (error) {
    console.error('Get content error:', error);

    if (error.message === 'CONTENT_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CONTENT_NOT_FOUND',
          message: 'Contenu introuvable.',
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'GET_CONTENT_FAILED',
        message: 'Impossible de récupérer le contenu.',
      },
    });
  }
}

/**
 * GET /contents/:id/file-url
 * Get signed URL for content file
 */
async function getContentFileUrl(req, res) {
  try {
    const { id } = req.params;

    // Get content to retrieve file_key
    const content = await contentsService.getContentById(id);

    // Determine expiration based on content type
    const expiresIn = content.content_type === 'audiobook' ? 3600 : 900; // 1h for audio, 15min for ebooks

    const signedUrl = await contentsService.generateSignedUrl(content.file_key, expiresIn);

    res.json({
      success: true,
      data: {
        url: signedUrl,
        expires_in: expiresIn,
      },
    });
  } catch (error) {
    console.error('Get file URL error:', error);

    if (error.message === 'CONTENT_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CONTENT_NOT_FOUND',
          message: 'Contenu introuvable.',
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'GET_FILE_URL_FAILED',
        message: 'Impossible de générer l\'URL du fichier.',
      },
    });
  }
}

/**
 * GET /categories
 * Get all categories
 */
async function listCategories(req, res) {
  try {
    const categories = await contentsService.getCategories();

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('List categories error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LIST_CATEGORIES_FAILED',
        message: 'Impossible de récupérer les catégories.',
      },
    });
  }
}

/**
 * GET /categories/:slug
 * Get category by slug
 */
async function getCategory(req, res) {
  try {
    const { slug } = req.params;

    const category = await contentsService.getCategoryBySlug(slug);

    res.json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error('Get category error:', error);

    if (error.message === 'CATEGORY_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CATEGORY_NOT_FOUND',
          message: 'Catégorie introuvable.',
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'GET_CATEGORY_FAILED',
        message: 'Impossible de récupérer la catégorie.',
      },
    });
  }
}

/**
 * POST /contents (admin only)
 * Create new content
 */
async function createContent(req, res) {
  try {
    const contentData = req.body;

    const newContent = await contentsService.createContent(contentData);

    res.status(201).json({
      success: true,
      data: newContent,
    });
  } catch (error) {
    console.error('Create content error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CREATE_CONTENT_FAILED',
        message: 'Impossible de créer le contenu.',
      },
    });
  }
}

/**
 * PUT /contents/:id (admin only)
 * Update content
 */
async function updateContent(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updatedContent = await contentsService.updateContent(id, updates);

    res.json({
      success: true,
      data: updatedContent,
    });
  } catch (error) {
    console.error('Update content error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_CONTENT_FAILED',
        message: 'Impossible de mettre à jour le contenu.',
      },
    });
  }
}

/**
 * DELETE /contents/:id (admin only)
 * Soft delete content
 */
async function deleteContent(req, res) {
  try {
    const { id } = req.params;

    await contentsService.deleteContent(id);

    res.json({
      success: true,
      message: 'Contenu supprimé avec succès.',
    });
  } catch (error) {
    console.error('Delete content error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DELETE_CONTENT_FAILED',
        message: 'Impossible de supprimer le contenu.',
      },
    });
  }
}

module.exports = {
  listContents,
  getContent,
  getContentFileUrl,
  listCategories,
  getCategory,
  createContent,
  updateContent,
  deleteContent,
};
