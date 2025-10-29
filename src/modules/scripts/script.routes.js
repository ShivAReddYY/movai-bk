const express = require('express');
const router = express.Router();
const scriptController = require('./script.controller');
const { authenticateJWT } = require('../../shared/middleware/auth.middleware');
const { uploadScript } = require('../../config/storage.config');

// All routes require authentication
router.use(authenticateJWT);

// Get all user scripts
router.get('/', scriptController.getUserScripts.bind(scriptController));

// Upload new script
router.post(
  '/upload',
  uploadScript.single('script'),
  scriptController.uploadScript.bind(scriptController)
);

// Get script by ID
router.get('/:id', scriptController.getScriptById.bind(scriptController));

// Get script pages (for PDF scripts)
router.get('/:id/pages', scriptController.getScriptPages.bind(scriptController));

// Update single page
router.patch('/:id/pages/:pageNumber', scriptController.updateScriptPage.bind(scriptController));

// Update script
router.patch('/:id', scriptController.updateScript.bind(scriptController));

// Delete script
router.delete('/:id', scriptController.deleteScript.bind(scriptController));

// Get script statistics
router.get('/:id/stats', scriptController.getScriptStats.bind(scriptController));

// Re-analyze script (after editing)
router.post('/:id/reanalyze', scriptController.reanalyzeScript.bind(scriptController));
// In script.routes.js
router.put('/:id/pages/:pageNumber/text', scriptController.updatePageText.bind(scriptController));

module.exports = router;
