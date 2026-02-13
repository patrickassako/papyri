/**
 * Contents Routes
 * Routes pour le catalogue de contenus
 */

const express = require('express');
const router = express.Router();
const contentsController = require('../controllers/contents.controller');
const { verifyJWT, requireRole } = require('../middleware/auth');

// Public routes (accessible sans auth pour landing page)
router.get('/contents', contentsController.listContents);
router.get('/contents/:id', contentsController.getContent);
router.get('/categories', contentsController.listCategories);
router.get('/categories/:slug', contentsController.getCategory);

// Protected routes (require authentication)
router.get('/contents/:id/file-url', verifyJWT, contentsController.getContentFileUrl);

// Admin routes
router.post('/contents', verifyJWT, requireRole('admin'), contentsController.createContent);
router.put('/contents/:id', verifyJWT, requireRole('admin'), contentsController.updateContent);
router.delete('/contents/:id', verifyJWT, requireRole('admin'), contentsController.deleteContent);

module.exports = router;
