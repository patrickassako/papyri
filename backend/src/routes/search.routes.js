/**
 * Search Routes
 */
const express = require('express');
const router = express.Router();
const searchController = require('../controllers/search.controller');
const { verifyJWT, requireRole } = require('../middleware/auth');

router.get('/search',         searchController.searchContents);
router.get('/search/suggest', searchController.suggestContents);
router.post('/search/index',  verifyJWT, requireRole('admin'), searchController.reindexContents);
router.get('/search/stats',   verifyJWT, requireRole('admin'), searchController.getSearchStats);

module.exports = router;
