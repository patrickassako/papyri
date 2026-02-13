/**
 * Search Routes
 * Routes pour la recherche avec Meilisearch
 */

const express = require('express');
const router = express.Router();
const searchController = require('../controllers/search.controller');
const { verifyJWT, requireRole } = require('../middleware/auth');

// Public search route
router.get('/search', searchController.searchContents);

// Admin routes
router.post('/search/index', verifyJWT, requireRole('admin'), searchController.reindexContents);
router.get('/search/stats', verifyJWT, requireRole('admin'), searchController.getSearchStats);

module.exports = router;
