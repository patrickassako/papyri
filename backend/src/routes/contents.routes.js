/**
 * Contents Routes
 * Routes pour le catalogue de contenus
 */

const express = require('express');
const router = express.Router();
const contentsController = require('../controllers/contents.controller');
const { authenticate, requireRole } = require('../middleware/auth');
const { resolveContentAccessContext, requireReadableContent } = require('../middleware/contentAccess');

// Public routes (accessible sans auth pour landing page)
router.get('/contents', contentsController.listContents);
router.get('/contents/:id/recommendations', contentsController.getContentRecommendations);
router.get('/contents/:id', contentsController.getContent);
router.get('/categories', contentsController.listCategories);
router.get('/categories/:slug', contentsController.getCategory);

// Protected routes (require authentication + content access)
router.get(
  '/contents/:id/file-url',
  authenticate,
  resolveContentAccessContext,
  requireReadableContent,
  contentsController.getContentFileUrl
);
router.get('/contents/:id/access', authenticate, contentsController.getContentAccess);
router.post('/contents/:id/unlock', authenticate, contentsController.unlockContent);
router.post('/contents/:id/unlock/verify-payment', authenticate, contentsController.verifyUnlockPayment);

// Admin routes
router.post('/contents', authenticate, requireRole('admin'), contentsController.createContent);
router.put('/contents/:id', authenticate, requireRole('admin'), contentsController.updateContent);
router.delete('/contents/:id', authenticate, requireRole('admin'), contentsController.deleteContent);

module.exports = router;
