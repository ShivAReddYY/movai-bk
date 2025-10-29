const mediaAIService = require('../../services/mediaAIService');
const geminiService = require('../../services/gemini.service');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class AIController {
  /**
   * 🎬 Generate video from text prompt
   * POST /api/ai/generate/video
   */
  async generateVideo(req, res) {
    try {
      const { scriptId, sceneId, characterId, prompt, config } = req.body;
      const userId = req.user.id;

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🎬 VIDEO GENERATION REQUEST');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Script ID:', scriptId);
      console.log('Scene ID:', sceneId || 'N/A');
      console.log('User ID:', userId);
      console.log('Prompt:', prompt.substring(0, 100) + '...');
      console.log('Config:', JSON.stringify(config, null, 2));

      // Validation
      if (!scriptId || !prompt) {
        return res.status(400).json({
          success: false,
          error: 'scriptId and prompt are required',
        });
      }

      // Check script ownership
      const script = await prisma.script.findUnique({
        where: { id: scriptId },
      });

      if (!script || script.ownerId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this script',
        });
      }

      // Generate video
      const result = await mediaAIService.generateVideo(
        scriptId,
        sceneId,
        characterId,
        prompt,
        config || {},
        userId
      );

      console.log('✅ Video generation started:', result.generationId);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      res.json(result);
    } catch (error) {
      console.error('❌ Generate video error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 🎨 Generate image from text prompt
   * POST /api/ai/generate/image
   */
  async generateImage(req, res) {
    try {
      const { scriptId, sceneId, characterId, prompt, config } = req.body;
      const userId = req.user.id;

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🎨 IMAGE GENERATION REQUEST');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Script ID:', scriptId);
      console.log('Scene ID:', sceneId || 'N/A');
      console.log('Prompt:', prompt.substring(0, 100) + '...');

      if (!scriptId || !prompt) {
        return res.status(400).json({
          success: false,
          error: 'scriptId and prompt are required',
        });
      }

      // Check script ownership
      const script = await prisma.script.findUnique({
        where: { id: scriptId },
      });

      if (!script || script.ownerId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this script',
        });
      }

      const result = await mediaAIService.generateImage(
        scriptId,
        sceneId,
        characterId,
        prompt,
        config || {},
        userId
      );

      console.log('✅ Image generated:', result.generationId);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      res.json(result);
    } catch (error) {
      console.error('❌ Generate image error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 🎤 Generate audio from text
   * POST /api/ai/generate/audio
   */
  async generateAudio(req, res) {
    try {
      const { scriptId, sceneId, text, config } = req.body;
      const userId = req.user.id;

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🎤 AUDIO GENERATION REQUEST');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Script ID:', scriptId);
      console.log('Text:', text.substring(0, 100) + '...');

      if (!scriptId || !text) {
        return res.status(400).json({
          success: false,
          error: 'scriptId and text are required',
        });
      }

      const result = await mediaAIService.generateAudio(
        scriptId,
        sceneId,
        text,
        config || {},
        userId
      );

      console.log('✅ Audio generation started');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      res.json(result);
    } catch (error) {
      console.error('❌ Generate audio error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 🎬➡️🎥 Generate video from image
   * POST /api/ai/generate/video-from-image
   */
  async generateVideoFromImage(req, res) {
    try {
      const { scriptId, imageUrl, prompt, config } = req.body;
      const userId = req.user.id;

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🎬 IMAGE-TO-VIDEO GENERATION');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Script ID:', scriptId);
      console.log('Image URL:', imageUrl);
      console.log('Prompt:', prompt);

      if (!scriptId || !imageUrl || !prompt) {
        return res.status(400).json({
          success: false,
          error: 'scriptId, imageUrl, and prompt are required',
        });
      }

      const result = await mediaAIService.generateVideoFromImage(
        scriptId,
        imageUrl,
        prompt,
        config || {},
        userId
      );

      console.log('✅ Image-to-video started');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      res.json(result);
    } catch (error) {
      console.error('❌ Image-to-video error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 🎥➕ Extend existing video
   * POST /api/ai/generate/extend-video
   */
  async extendVideo(req, res) {
    try {
      const { scriptId, videoUrl, prompt, config } = req.body;
      const userId = req.user.id;

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🎥 VIDEO EXTENSION REQUEST');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Script ID:', scriptId);
      console.log('Video URL:', videoUrl);
      console.log('Prompt:', prompt);

      if (!scriptId || !videoUrl || !prompt) {
        return res.status(400).json({
          success: false,
          error: 'scriptId, videoUrl, and prompt are required',
        });
      }

      const result = await mediaAIService.extendVideo(
        scriptId,
        videoUrl,
        prompt,
        config || {},
        userId
      );

      console.log('✅ Video extension started');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      res.json(result);
    } catch (error) {
      console.error('❌ Extend video error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 📊 Get generation status
   * GET /api/ai/generation/:id
   */
  async getGenerationStatus(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const generation = await mediaAIService.getGenerationStatus(id);

      if (!generation) {
        return res.status(404).json({
          success: false,
          error: 'Generation not found',
        });
      }

      // Check ownership
      const script = await prisma.script.findUnique({
        where: { id: generation.scriptId },
      });

      if (!script || script.ownerId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
        });
      }

      res.json({
        success: true,
        generation,
      });
    } catch (error) {
      console.error('❌ Get generation status error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 📋 List all generations for a script
   * GET /api/ai/generations/:scriptId
   */
  async listGenerations(req, res) {
    try {
      const { scriptId } = req.params;
      const userId = req.user.id;
      const { type, status } = req.query;

      // Check script ownership
      const script = await prisma.script.findUnique({
        where: { id: scriptId },
      });

      if (!script || script.ownerId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this script',
        });
      }

      const filters = {};
      if (type) filters.type = type;
      if (status) filters.status = status;

      const generations = await mediaAIService.listGenerations(
        scriptId,
        filters
      );

      res.json({
        success: true,
        count: generations.length,
        generations,
      });
    } catch (error) {
      console.error('❌ List generations error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 🗑️ Delete generation
   * DELETE /api/ai/generation/:id
   */
  async deleteGeneration(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const generation = await mediaAIService.getGenerationStatus(id);

      if (!generation) {
        return res.status(404).json({
          success: false,
          error: 'Generation not found',
        });
      }

      // Check ownership
      const script = await prisma.script.findUnique({
        where: { id: generation.scriptId },
      });

      if (!script || script.ownerId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
        });
      }

      const result = await mediaAIService.deleteGeneration(id);

      console.log('🗑️  Generation deleted:', id);

      res.json(result);
    } catch (error) {
      console.error('❌ Delete generation error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 🧪 Test AI connection
   * GET /api/ai/test
   */
  async testConnection(req, res) {
    try {
      const result = await mediaAIService.testConnection();
      res.json({
        success: true,
        message: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('❌ Test connection error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 📦 List AI assets for a script
   * GET /api/ai/assets/:scriptId
   */
  async listAssets(req, res) {
    try {
      const { scriptId } = req.params;
      const userId = req.user.id;
      const { type } = req.query;

      // Check ownership
      const script = await prisma.script.findUnique({
        where: { id: scriptId },
      });

      if (!script || script.ownerId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
        });
      }

      const where = { scriptId };
      if (type) where.type = type;

      const assets = await prisma.aIAsset.findMany({
        where,
        include: {
          generation: {
            select: {
              id: true,
              type: true,
              prompt: true,
              status: true,
              createdAt: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      res.json({
        success: true,
        count: assets.length,
        assets,
      });
    } catch (error) {
      console.error('❌ List assets error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 📖 Generate script summary using Gemini AI
   * POST /api/ai/script/summary
   */
  async generateScriptSummary(req, res) {
    try {
      const { scriptId } = req.body;
      const userId = req.user.id;

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📖 SCRIPT SUMMARY GENERATION');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Script ID:', scriptId);
      console.log('User ID:', userId);

      // Validation
      if (!scriptId) {
        return res.status(400).json({
          success: false,
          error: 'scriptId is required',
        });
      }

      // Check script ownership
      const script = await prisma.script.findUnique({
        where: { id: scriptId },
        include: {
          scenes: {
            select: {
              id: true,
              sceneNumber: true,
              heading: true,
              location: true,
              intExt: true,
              timeOfDay: true,
              summary: true,
              sceneText: true
            }
          },
          characters: {
            select: {
              id: true,
              name: true,
              description: true
            }
          }
        }
      });

      if (!script || script.ownerId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this script',
        });
      }

      // Check if summary already exists
      if (script.metadata?.aiSummary) {
        console.log('📖 Using cached script summary');
        return res.json({
          success: true,
          summary: script.metadata.aiSummary,
          cached: true,
          generatedAt: script.metadata.aiSummaryGeneratedAt
        });
      }

      // Generate script text from scenes
      let scriptText = '';
      if (script.scenes && script.scenes.length > 0) {
        scriptText = script.scenes.map(scene => scene.sceneText).join('\n\n');
      }

      if (!scriptText.trim()) {
        return res.status(400).json({
          success: false,
          error: 'No script content found to analyze',
        });
      }

      console.log('🧠 Generating script summary with Gemini...');
      console.log('   Script text length:', scriptText.length);
      console.log('   Scenes:', script.scenes.length);
      console.log('   Characters:', script.characters.length);

      // Generate summary using Gemini
      const summary = await geminiService.generateScriptSummary(
        scriptText,
        script.scenes || [],
        script.characters || []
      );

      // Cache the summary in script metadata
      await prisma.script.update({
        where: { id: scriptId },
        data: {
          metadata: {
            ...script.metadata,
            aiSummary: summary,
            aiSummaryGeneratedAt: new Date()
          }
        }
      });

      console.log('✅ Script summary generated and cached');

      res.json({
        success: true,
        summary,
        cached: false,
        generatedAt: new Date()
      });

    } catch (error) {
      console.error('❌ Script summary generation error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 🧪 Test prompt enhancement (debug endpoint)
   * POST /api/ai/test/prompt-enhancement
   */
  async testPromptEnhancement(req, res) {
    try {
      const { scriptId, sceneId, characterId, prompt, generationType } = req.body;
      const userId = req.user.id;

      console.log('🧪 Testing prompt enhancement...');
      console.log('   Script ID:', scriptId);
      console.log('   Scene ID:', sceneId || 'N/A');
      console.log('   Character ID:', characterId || 'N/A');
      console.log('   Original Prompt:', prompt);
      console.log('   Generation Type:', generationType);

      // Get context data
      const [script, scene, character, scriptSummary] = await Promise.all([
        mediaAIService.getScriptContext(scriptId),
        sceneId ? mediaAIService.getSceneContext(sceneId) : null,
        characterId ? mediaAIService.getCharacterContext(characterId) : null,
        mediaAIService.getScriptSummary(scriptId)
      ]);

      console.log('📊 Context data retrieved:');
      console.log('   Script:', script ? `${script.title} (${script.scenes?.length || 0} scenes)` : 'N/A');
      console.log('   Scene:', scene ? `${scene.heading} (${scene.dialogue?.length || 0} dialogue lines)` : 'N/A');
      console.log('   Character:', character ? `${character.name}` : 'N/A');
      console.log('   Script Summary:', scriptSummary ? 'Available' : 'N/A');

      // Generate enhanced prompt
      const enhancedPrompt = await geminiService.generateContextAwarePrompt(
        prompt,
        scriptSummary,
        scene,
        character,
        generationType || 'image'
      );

      // Validate intent preservation
      const intentPreserved = mediaAIService.validateUserIntentPreserved(prompt, enhancedPrompt);

      res.json({
        success: true,
        originalPrompt: prompt,
        enhancedPrompt,
        intentPreserved,
        context: {
          script: script ? { id: script.id, title: script.title } : null,
          scene: scene ? { id: scene.id, heading: scene.heading } : null,
          character: character ? { id: character.id, name: character.name } : null,
          scriptSummary: scriptSummary ? {
            genre: scriptSummary.genre,
            tone: scriptSummary.tone,
            themes: scriptSummary.themes
          } : null
        }
      });

    } catch (error) {
      console.error('❌ Prompt enhancement test error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 📊 Check script summary status
   * GET /api/ai/script/summary/status/:scriptId
   */
  async getScriptSummaryStatus(req, res) {
    try {
      const { scriptId } = req.params;
      const userId = req.user.id;

      console.log('📊 Checking script summary status for:', scriptId);

      // Check script ownership
      const script = await prisma.script.findUnique({
        where: { id: scriptId },
        select: {
          id: true,
          title: true,
          ownerId: true,
          metadata: true,
          updatedAt: true,
          version: true
        }
      });

      if (!script || script.ownerId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this script',
        });
      }

      // Check if summary needs regeneration
      const needsRegeneration = await mediaAIService.shouldRegenerateSummary(scriptId);

      const summaryInfo = {
        hasSummary: !!script.metadata?.aiSummary,
        needsRegeneration,
        generatedAt: script.metadata?.aiSummaryGeneratedAt,
        scriptVersion: script.version,
        summaryVersion: script.metadata?.aiSummaryVersion,
        scriptLength: script.metadata?.aiSummaryScriptLength,
        sceneCount: script.metadata?.aiSummarySceneCount,
        characterCount: script.metadata?.aiSummaryCharacterCount,
        cacheAge: script.metadata?.aiSummaryGeneratedAt ? 
          Math.round((Date.now() - new Date(script.metadata.aiSummaryGeneratedAt).getTime()) / (1000 * 60 * 60)) : null
      };


      res.json({
        success: true,
        ...summaryInfo
      });

    } catch (error) {
      console.error('❌ Get script summary status error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * 📊 Get script summary (cached or generate new)
   * GET /api/ai/script/summary/:scriptId
   */
  async getScriptSummary(req, res) {
    try {
      const { scriptId } = req.params;
      const userId = req.user.id;

      console.log('📖 Getting script summary for:', scriptId);

      // Check script ownership
      const script = await prisma.script.findUnique({
        where: { id: scriptId },
        select: {
          id: true,
          title: true,
          ownerId: true,
          metadata: true
        }
      });

      if (!script || script.ownerId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this script',
        });
      }

      // Check if summary exists
      if (script.metadata?.aiSummary) {
        return res.json({
          success: true,
          summary: script.metadata.aiSummary,
          cached: true,
          generatedAt: script.metadata.aiSummaryGeneratedAt
        });
      }

      // No summary found
      return res.status(404).json({
        success: false,
        error: 'No script summary found. Generate one first.',
      });

    } catch (error) {
      console.error('❌ Get script summary error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}

module.exports = new AIController();
