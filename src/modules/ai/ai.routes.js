const express = require('express');
const router = express.Router();
const aiController = require('./ai.controller');
const { authenticateJWT } = require('../../shared/middleware/auth.middleware');

// All routes require authentication
router.use(authenticateJWT);

// ==================== VIDEO GENERATION ====================

/**
 * @route   POST /api/ai/generate/video
 * @desc    Generate video from text prompt using Veo 3.1
 * @access  Private
 */
router.post('/generate/video', aiController.generateVideo.bind(aiController));

/**
 * @route   POST /api/ai/generate/video-from-image
 * @desc    Generate video from image (Image-to-Video)
 * @access  Private
 */
router.post('/generate/video-from-image', aiController.generateVideoFromImage.bind(aiController));

/**
 * @route   POST /api/ai/generate/extend-video
 * @desc    Extend existing video
 * @access  Private
 */
router.post('/generate/extend-video', aiController.extendVideo.bind(aiController));

// ==================== IMAGE GENERATION ====================

/**
 * @route   POST /api/ai/generate/image
 * @desc    Generate image using Imagen 3 / Nano Banana
 * @access  Private
 */
router.post('/generate/image', aiController.generateImage.bind(aiController));

// ==================== AUDIO GENERATION ====================

/**
 * @route   POST /api/ai/generate/audio
 * @desc    Generate audio/voice
 * @access  Private
 */
router.post('/generate/audio', aiController.generateAudio.bind(aiController));

// ==================== GENERATION MANAGEMENT ====================

/**
 * @route   GET /api/ai/generation/:id
 * @desc    Get generation status
 * @access  Private
 */
router.get('/generation/:id', aiController.getGenerationStatus.bind(aiController));

/**
 * @route   GET /api/ai/generations/:scriptId
 * @desc    List all generations for a script
 * @access  Private
 */
router.get('/generations/:scriptId', aiController.listGenerations.bind(aiController));

/**
 * @route   DELETE /api/ai/generation/:id
 * @desc    Delete generation
 * @access  Private
 */
router.delete('/generation/:id', aiController.deleteGeneration.bind(aiController));

// ==================== ASSETS ====================

/**
 * @route   GET /api/ai/assets/:scriptId
 * @desc    List AI assets for a script
 * @access  Private
 */
router.get('/assets/:scriptId', aiController.listAssets.bind(aiController));

// ==================== SCRIPT ANALYSIS ====================

/**
 * @route   POST /api/ai/script/summary
 * @desc    Generate script summary using Gemini AI
 * @access  Private
 */
router.post('/script/summary', aiController.generateScriptSummary.bind(aiController));

/**
 * @route   GET /api/ai/script/summary/status/:scriptId
 * @desc    Check script summary status and cache info
 * @access  Private
 */
router.get('/script/summary/status/:scriptId', aiController.getScriptSummaryStatus.bind(aiController));

/**
 * @route   GET /api/ai/script/summary/:scriptId
 * @desc    Get script summary (cached or generate new)
 * @access  Private
 */
router.get('/script/summary/:scriptId', aiController.getScriptSummary.bind(aiController));

// ==================== UTILITIES ====================

/**
 * @route   POST /api/ai/test/prompt-enhancement
 * @desc    Test prompt enhancement (debug endpoint)
 * @access  Private
 */
router.post('/test/prompt-enhancement', aiController.testPromptEnhancement.bind(aiController));

/**
 * @route   GET /api/ai/test
 * @desc    Test AI API connection
 * @access  Private
 */
router.get('/test', aiController.testConnection.bind(aiController));

module.exports = router;
