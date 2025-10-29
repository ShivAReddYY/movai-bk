const { GoogleGenAI } = require('@google/genai');
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');
const geminiService = require('./gemini.service');
require('dotenv').config();

class MediaAIService {
  constructor() {
    // ✅ KEEP GEMINI FOR VIDEO (VEO)
    if (process.env.GEMINI_API_KEY) {
      this.ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY
      });
    }
    
    // ✅ ADD FREEPIK API KEY FOR IMAGE GENERATION
    if (!process.env.FREEPIK_API_KEY) {
      console.warn('⚠️  FREEPIK_API_KEY not found - image generation will be disabled');
    }
    
    this.freepikApiKey = process.env.FREEPIK_API_KEY;
    this.freepikBaseUrl = 'https://api.freepik.com/v1';
    
    this.uploadsDir = path.join(__dirname, '../../uploads/ai-generated');
    this.ensureUploadDirExists();
    
    console.log('✅ Media AI Service initialized');
    console.log('   - Veo 3.1 (Video):', process.env.GEMINI_API_KEY ? '✅' : '❌');
    console.log('   - Freepik Mystic (Image):', process.env.FREEPIK_API_KEY ? '✅' : '❌');
  }

  ensureUploadDirExists() {
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
      console.log('📁 Created AI uploads directory:', this.uploadsDir);
    }
  }

  // ==================== IMAGE GENERATION WITH FREEPIK ====================

  /**
   * Generate image using Freepik Mystic API
   */
  /**
 * Generate image using Freepik Mystic API with Gemini context enhancement
 */
async generateImage(scriptId, sceneId, characterId, prompt, config, userId) {
  let generation = null;
  
  try {
    console.log('🎨 Starting image generation with Freepik Mystic...');
    console.log('   Original Prompt:', prompt.substring(0, 100) + '...');

    if (!this.freepikApiKey) {
      throw new Error('FREEPIK_API_KEY not configured');
    }

    // ✅ ENHANCED: Get context-aware prompt using Gemini
    let enhancedPrompt = prompt;
    let contextData = null;

    try {
      console.log('🧠 Getting context-aware prompt from Gemini...');
      
      // Get script, scene, and character data for context
      // Only get script summary if we don't have a valid cached one
      const needsSummary = await this.shouldRegenerateSummary(scriptId);
      
      const [script, scene, character, scriptSummary] = await Promise.all([
        this.getScriptContext(scriptId),
        sceneId ? this.getSceneContext(sceneId) : null,
        characterId ? this.getCharacterContext(characterId) : null,
        needsSummary ? this.getScriptSummary(scriptId) : this.getScriptSummary(scriptId, false)
      ]);

      contextData = { script, scene, character, scriptSummary };

      // Generate context-aware prompt
      enhancedPrompt = await geminiService.generateContextAwarePrompt(
        prompt,
        scriptSummary,
        scene,
        character,
        'image'
      );

      // ✅ SAFETY CHECK: Ensure user intent is preserved
      const userIntentPreserved = this.validateUserIntentPreserved(prompt, enhancedPrompt);
      if (!userIntentPreserved) {
        console.warn('⚠️ User intent may not be preserved, using original prompt');
        enhancedPrompt = prompt;
      }

      console.log('✅ Context-aware prompt generated');
      console.log('📝 Enhanced prompt:', enhancedPrompt.substring(0, 150) + '...');
      console.log('🎯 User intent preserved:', userIntentPreserved ? '✅' : '❌');

    } catch (contextError) {
      console.warn('⚠️ Context enhancement failed, using original prompt:', contextError.message);
      enhancedPrompt = prompt;
    }

    // Create generation record with enhanced prompt
    generation = await prisma.aIGeneration.create({
      data: {
        scriptId,
        sceneId,
        characterId,
        createdById: userId,
        type: 'IMAGE',
        model: config.model || 'MYSTIC_REALISM',
        prompt: enhancedPrompt, // Use enhanced prompt
        config: {
          ...config,
          originalPrompt: prompt, // Store original user prompt
          contextEnhanced: true,
          contextData: contextData
        },
        status: 'PROCESSING',
        startedAt: new Date(),
      },
    });

    console.log(`📝 Generation record created: ${generation.id}`);

    // ✅ PREPARE FREEPIK MYSTIC REQUEST WITH ENHANCED PROMPT
    const freepikPayload = {
      prompt: enhancedPrompt, // Use enhanced prompt
      resolution: this.mapFreepikResolution(config.resolution),
      aspect_ratio: this.mapFreepikAspectRatio(config.aspectRatio) || 'square_1_1',
      model: this.mapFreepikModel(config.model) || 'realism',
    };

    // Optional parameters
    if (config.negativePrompt) freepikPayload.negative_prompt = config.negativePrompt;
    if (config.creative_detailing) freepikPayload.creative_detailing = config.creative_detailing;
    if (config.engine) freepikPayload.engine = config.engine;

    console.log('🚀 Sending request to Freepik Mystic API...');
    console.log('📦 Payload:', JSON.stringify(freepikPayload, null, 2));

    // ✅ CALL FREEPIK API
    const response = await axios.post(
      `${this.freepikBaseUrl}/ai/mystic`,
      freepikPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-freepik-api-key': this.freepikApiKey,
        },
      }
    );

    const { task_id, status } = response.data.data;
    console.log(`✅ Freepik task created: ${task_id}`);
    console.log(`   Status: ${status}`);

    // Save task ID
    await prisma.aIGeneration.update({
      where: { id: generation.id },
      data: {
        operationId: task_id,
        operationName: task_id,
      },
    });

    // ✅ START POLLING IN BACKGROUND
    this.pollFreepikGeneration(generation.id, task_id).catch(err => {
      console.error(`❌ Background polling error for ${generation.id}:`, err);
    });

    return {
      success: true,
      generationId: generation.id,
      taskId: task_id,
      status: 'PROCESSING',
      message: 'Image generation started. This may take 1-3 minutes.',
    };
    
  } catch (error) {
    console.error('❌ Image generation error:', error.response?.data || error.message);

    if (generation) {
      await prisma.aIGeneration.update({
        where: { id: generation.id },
        data: {
          status: 'FAILED',
          errorMessage: error.response?.data?.message || error.message,
          completedAt: new Date(),
        },
      });
    }

    throw new Error(`Image generation failed: ${error.response?.data?.message || error.message}`);
  }
}


  /**
   * Poll Freepik task status and download image when ready
   */
  async pollFreepikGeneration(generationId, taskId) {
    try {
      console.log(`⏳ Polling Freepik generation: ${generationId} (Task: ${taskId})`);

      let pollCount = 0;
      const maxPolls = 60; // 10 minutes max (10 sec intervals)
      let taskStatus = 'IN_PROGRESS';

      while (taskStatus === 'IN_PROGRESS' && pollCount < maxPolls) {
        await new Promise((resolve) => setTimeout(resolve, 10000)); // 10 seconds

        // ✅ CHECK TASK STATUS
        const statusResponse = await axios.get(
          `${this.freepikBaseUrl}/ai/mystic/${taskId}`,
          {
            headers: {
              'x-freepik-api-key': this.freepikApiKey,
            },
          }
        );

        taskStatus = statusResponse.data.data.status;
        pollCount++;

        console.log(`   Poll ${pollCount}/${maxPolls}: ${taskStatus}`);

        if (taskStatus === 'COMPLETED') {
          const imageUrls = statusResponse.data.data.generated;
          
          if (imageUrls && imageUrls.length > 0) {
            const imageUrl = imageUrls[0]; // Get first image
            console.log(`✅ Image generated: ${imageUrl}`);

            // ✅ DOWNLOAD IMAGE
            const filename = `image_${generationId}_${Date.now()}.png`;
            const outputPath = path.join(this.uploadsDir, filename);

            const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            fs.writeFileSync(outputPath, imageResponse.data);

            const fileStats = fs.statSync(outputPath);
            console.log(`✅ Image saved: ${filename} (${fileStats.size} bytes)`);

            // Update generation record
            await prisma.aIGeneration.update({
              where: { id: generationId },
              data: {
                status: 'COMPLETED',
                outputUrl: `/uploads/ai-generated/${filename}`,
                fileSize: fileStats.size,
                filePath: outputPath,
                completedAt: new Date(),
                metadata: {
                  originalUrl: imageUrl,
                  fileSize: fileStats.size,
                  mimeType: 'image/png',
                },
              },
            });

            // Create AI Asset
            await this.createAIAsset(generationId, 'IMAGE', filename, fileStats.size);

            console.log(`✅ Image generation completed: ${generationId}`);
            return;
          } else {
            throw new Error('No generated images in response');
          }
        } else if (taskStatus === 'FAILED' || taskStatus === 'ERROR') {
          throw new Error(`Freepik task failed with status: ${taskStatus}`);
        }
      }

      if (taskStatus === 'IN_PROGRESS') {
        throw new Error('Image generation timeout after 10 minutes');
      }

    } catch (error) {
      console.error(`❌ Freepik polling error for ${generationId}:`, error);
      await prisma.aIGeneration.update({
        where: { id: generationId },
        data: {
          status: 'FAILED',
          errorMessage: error.message,
          completedAt: new Date(),
        },
      });
    }
  }

  /**
   * Map aspect ratios to Freepik format
   */
  mapFreepikAspectRatio(ratio) {
    const map = {
      'RATIO_16_9': 'widescreen_16_9',
      'RATIO_9_16': 'social_story_9_16',
      'RATIO_1_1': 'square_1_1',
      'RATIO_4_3': 'classic_4_3',
      'RATIO_3_4': 'traditional_3_4',
    };
    return map[ratio] || 'square_1_1';
  }

  /**
   * Map model to Freepik format
   */
  mapFreepikModel(model) {
    const map = {
      'MYSTIC_REALISM': 'realism',
      'MYSTIC_FLUID': 'fluid',
      'MYSTIC_ZEN': 'zen',
      'MYSTIC_FLEXIBLE': 'flexible',
      'MYSTIC_SUPER_REAL': 'super_real',
      'MYSTIC_EDITORIAL': 'editorial_portraits',
    };
    return map[model] || 'realism';
  }
  /**
 * Map resolution to Freepik format
 */
mapFreepikResolution(resolution) {
  const map = {
    'RES_720P': '1k',
    'RES_1080P': '2k',
    'RES_4K': '4k',
  };
  return map[resolution] || '2k'; // Default to 2k
}
  /**
 * Map aspect ratios to Freepik format
 */
mapFreepikAspectRatio(ratio) {
  const map = {
    'RATIO_16_9': 'widescreen_16_9',
    'RATIO_9_16': 'social_story_9_16',
    'RATIO_1_1': 'square_1_1',
    'RATIO_4_3': 'classic_4_3',
    'RATIO_3_4': 'traditional_3_4',
  };
  return map[ratio] || 'square_1_1';
}

/**
 * Map model to Freepik format
 */
mapFreepikModel(model) {
  const map = {
    'MYSTIC_REALISM': 'realism',
    'MYSTIC_FLUID': 'fluid',
    'MYSTIC_ZEN': 'zen',
    'MYSTIC_FLEXIBLE': 'flexible',
    'MYSTIC_SUPER_REAL': 'super_real',
    'MYSTIC_EDITORIAL': 'editorial_portraits',
  };
  return map[model] || 'realism';
}

/**
 * Map resolution to Freepik format
 */
mapFreepikResolution(resolution) {
  const map = {
    'RES_720P': '1k',
    'RES_1080P': '2k',
    'RES_4K': '4k',
  };
  return map[resolution] || '2k'; // ✅ DEFAULT TO 2K
}

  // ==================== VIDEO GENERATION (KEEP GEMINI VEO) ====================

  async generateVideo(scriptId, sceneId, characterId, prompt, config, userId) {
    let generation = null;
    
    try {
      console.log('🎬 Starting video generation with Gemini Veo...');
      console.log('   Original Prompt:', prompt.substring(0, 100) + '...');

      if (!this.ai) {
        throw new Error('GEMINI_API_KEY not configured for video generation');
      }

      // ✅ ENHANCED: Get context-aware prompt using Gemini
      let enhancedPrompt = prompt;
      let contextData = null;

      try {
        console.log('🧠 Getting context-aware prompt from Gemini...');
        
        // Get script, scene, and character data for context
        const [script, scene, character, scriptSummary] = await Promise.all([
          this.getScriptContext(scriptId),
          sceneId ? this.getSceneContext(sceneId) : null,
          characterId ? this.getCharacterContext(characterId) : null,
          this.getScriptSummary(scriptId)
        ]);

        contextData = { script, scene, character, scriptSummary };

        // Generate context-aware prompt
        enhancedPrompt = await geminiService.generateContextAwarePrompt(
          prompt,
          scriptSummary,
          scene,
          character,
          'video'
        );

        // ✅ SAFETY CHECK: Ensure user intent is preserved
        const userIntentPreserved = this.validateUserIntentPreserved(prompt, enhancedPrompt);
        if (!userIntentPreserved) {
          console.warn('⚠️ User intent may not be preserved, using original prompt');
          enhancedPrompt = prompt;
        }

        console.log('✅ Context-aware prompt generated');
        console.log('📝 Enhanced prompt:', enhancedPrompt.substring(0, 150) + '...');
        console.log('🎯 User intent preserved:', userIntentPreserved ? '✅' : '❌');

      } catch (contextError) {
        console.warn('⚠️ Context enhancement failed, using original prompt:', contextError.message);
        enhancedPrompt = prompt;
      }

      // Create generation record with enhanced prompt
      generation = await prisma.aIGeneration.create({
        data: {
          scriptId,
          sceneId,
          characterId,
          createdById: userId,
          type: 'VIDEO',
          model: config.model || 'VEO_3_1',
          prompt: enhancedPrompt, // Use enhanced prompt
          config: {
            ...config,
            originalPrompt: prompt, // Store original user prompt
            contextEnhanced: true,
            contextData: contextData
          },
          status: 'PROCESSING',
          startedAt: new Date(),
        },
      });

      console.log(`📝 Generation record created: ${generation.id}`);

      // TODO: Implement actual Veo 3.1 video generation
      // For now, throw error as video generation requires payment
      throw new Error('Video generation requires Gemini API payment. Coming soon!');
      
    } catch (error) {
      console.error('❌ Video generation error:', error.message);

      if (generation) {
        await prisma.aIGeneration.update({
          where: { id: generation.id },
          data: {
            status: 'FAILED',
            errorMessage: error.message,
            completedAt: new Date(),
          },
        });
      }

      throw error;
    }
  }

  // ==================== CONTEXT HELPER FUNCTIONS ====================

  /**
   * Validate that user intent is preserved in enhanced prompt
   */
  validateUserIntentPreserved(originalPrompt, enhancedPrompt) {
    try {
      const original = originalPrompt.toLowerCase().trim();
      const enhanced = enhancedPrompt.toLowerCase().trim();
      
      // Extract key words from original prompt
      const originalWords = original.split(/\s+/).filter(word => word.length > 2);
      const keyWords = originalWords.filter(word => 
        !['the', 'and', 'or', 'but', 'for', 'with', 'from', 'this', 'that', 'these', 'those'].includes(word)
      );
      
      // Check if key words are present in enhanced prompt
      const preservedWords = keyWords.filter(word => enhanced.includes(word));
      const preservationRatio = preservedWords.length / Math.max(keyWords.length, 1);
      
      console.log(`🔍 Intent validation: ${preservedWords.length}/${keyWords.length} key words preserved (${Math.round(preservationRatio * 100)}%)`);
      
      // Consider intent preserved if at least 70% of key words are maintained
      return preservationRatio >= 0.7;
    } catch (error) {
      console.error('❌ Intent validation error:', error.message);
      return false; // If validation fails, assume intent not preserved
    }
  }

  /**
   * Get script context for AI enhancement
   */
  async getScriptContext(scriptId) {
    try {
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

      return script;
    } catch (error) {
      console.error('❌ Failed to get script context:', error.message);
      return null;
    }
  }

  /**
   * Get scene context for AI enhancement
   */
  async getSceneContext(sceneId) {
    try {
      const scene = await prisma.scene.findUnique({
        where: { id: sceneId },
        include: {
          script: {
            select: {
              id: true,
              title: true
            }
          }
        }
      });

      if (!scene) return null;

      // Parse dialogue from scene text if available
      let dialogue = [];
      if (scene.sceneText) {
        const lines = scene.sceneText.split('\n');
        let currentCharacter = null;
        let currentDialogue = '';
        
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          
          // Check if this is a character name (all caps, centered)
          if (trimmed.match(/^[A-Z][A-Z\s'.-]*$/) && trimmed.length < 50) {
            // Save previous dialogue if exists
            if (currentCharacter && currentDialogue.trim()) {
              dialogue.push({
                character: currentCharacter,
                text: currentDialogue.trim()
              });
            }
            
            currentCharacter = trimmed;
            currentDialogue = '';
          } else if (currentCharacter && trimmed) {
            // This is dialogue for the current character
            currentDialogue += (currentDialogue ? ' ' : '') + trimmed;
          }
        }
        
        // Save last dialogue
        if (currentCharacter && currentDialogue.trim()) {
          dialogue.push({
            character: currentCharacter,
            text: currentDialogue.trim()
          });
        }
      }

      // Add dialogue to scene object
      return {
        ...scene,
        dialogue
      };
    } catch (error) {
      console.error('❌ Failed to get scene context:', error.message);
      return null;
    }
  }

  /**
   * Get character context for AI enhancement
   */
  async getCharacterContext(characterId) {
    try {
      const character = await prisma.character.findUnique({
        where: { id: characterId },
        include: {
          script: {
            select: {
              id: true,
              title: true
            }
          }
        }
      });

      return character;
    } catch (error) {
      console.error('❌ Failed to get character context:', error.message);
      return null;
    }
  }

  /**
   * Get or generate script summary with smart caching
   */
  async getScriptSummary(scriptId, forceRegenerate = false) {
    try {
      // Check if we already have a cached summary
      const script = await prisma.script.findUnique({
        where: { id: scriptId },
        select: { 
          metadata: true,
          updatedAt: true,
          version: true
        }
      });

      if (!script) {
        throw new Error('Script not found');
      }

      // Check if we have a valid cached summary
      const hasValidCache = script.metadata?.aiSummary && 
                           script.metadata?.aiSummaryGeneratedAt &&
                           !forceRegenerate;

      if (hasValidCache) {
        const cacheAge = Date.now() - new Date(script.metadata.aiSummaryGeneratedAt).getTime();
        const cacheAgeHours = cacheAge / (1000 * 60 * 60);
        
        // Use cache if it's less than 24 hours old
        if (cacheAgeHours < 24) {
          console.log('📖 Using cached script summary (age:', Math.round(cacheAgeHours), 'hours)');
          return script.metadata.aiSummary;
        } else {
          console.log('⏰ Cached summary is old (age:', Math.round(cacheAgeHours), 'hours), regenerating...');
        }
      }

      // Generate new summary using Gemini
      console.log('🧠 Generating new script summary with Gemini...');
      
      const scriptContext = await this.getScriptContext(scriptId);
      if (!scriptContext) {
        throw new Error('Script context not found');
      }

      // Get script text from pages or scenes
      let scriptText = '';
      if (scriptContext.scenes && scriptContext.scenes.length > 0) {
        scriptText = scriptContext.scenes.map(scene => scene.sceneText).join('\n\n');
      }

      if (!scriptText.trim()) {
        console.warn('⚠️ No script content found for analysis');
        return null;
      }

      console.log(`📊 Script analysis: ${scriptText.length} chars, ${scriptContext.scenes?.length || 0} scenes, ${scriptContext.characters?.length || 0} characters`);

      const summary = await geminiService.generateScriptSummary(
        scriptText,
        scriptContext.scenes || [],
        scriptContext.characters || []
      );

      // Cache the summary in script metadata with processing info
      const updatedMetadata = {
        ...script.metadata,
        aiSummary: summary,
        aiSummaryGeneratedAt: new Date(),
        aiSummaryVersion: script.version || 1,
        aiSummaryScriptLength: scriptText.length,
        aiSummarySceneCount: scriptContext.scenes?.length || 0,
        aiSummaryCharacterCount: scriptContext.characters?.length || 0
      };

      // Update metadata without changing updatedAt by using a transaction
      await prisma.$transaction(async (tx) => {
        // First get the current updatedAt
        const currentScript = await tx.script.findUnique({
          where: { id: scriptId },
          select: { updatedAt: true }
        });
        
        // Update metadata
        await tx.script.update({
          where: { id: scriptId },
          data: { metadata: updatedMetadata }
        });
        
        // Restore the original updatedAt
        if (currentScript) {
          await tx.$executeRaw`
            UPDATE "scripts" 
            SET "updatedAt" = ${currentScript.updatedAt}::timestamp
            WHERE "id" = ${scriptId}
          `;
        }
      });

      console.log('✅ Script summary generated and cached');
      return summary;

    } catch (error) {
      console.error('❌ Failed to get script summary:', error.message);
      return null;
    }
  }

  /**
   * Check if script summary needs regeneration
   */
  async shouldRegenerateSummary(scriptId) {
    try {
      const script = await prisma.script.findUnique({
        where: { id: scriptId },
        select: { 
          metadata: true,
          updatedAt: true,
          version: true
        }
      });

      if (!script) return true;

      // No summary exists
      if (!script.metadata?.aiSummary) return true;

      // Check if script was updated after summary generation
      const summaryGeneratedAt = new Date(script.metadata.aiSummaryGeneratedAt);
      const scriptUpdatedAt = new Date(script.updatedAt);
      
      if (scriptUpdatedAt > summaryGeneratedAt) {
        console.log('📝 Script updated after summary generation, regeneration needed');
        return true;
      }

      // Check if version changed
      const summaryVersion = script.metadata.aiSummaryVersion || 1;
      const currentVersion = script.version || 1;
      
      if (currentVersion > summaryVersion) {
        console.log('📝 Script version changed, regeneration needed');
        return true;
      }

      // Check cache age (24 hours)
      const cacheAge = Date.now() - summaryGeneratedAt.getTime();
      const cacheAgeHours = cacheAge / (1000 * 60 * 60);
      
      if (cacheAgeHours > 24) {
        console.log('⏰ Summary cache expired, regeneration needed');
        return true;
      }

      console.log('✅ Summary is up to date');
      return false;

    } catch (error) {
      console.error('❌ Failed to check summary regeneration:', error.message);
      return true; // Regenerate on error
    }
  }

  // ==================== UTILITY FUNCTIONS ====================

  async createAIAsset(generationId, type, filename, fileSize) {
    try {
      const generation = await prisma.aIGeneration.findUnique({
        where: { id: generationId },
      });

      const asset = await prisma.aIAsset.create({
        data: {
          scriptId: generation.scriptId,
          generationId: generationId,
          type: type,
          name: filename,
          url: `/uploads/ai-generated/${filename}`,
          filePath: path.join(this.uploadsDir, filename),
          fileSize: fileSize,
          mimeType: type === 'VIDEO' ? 'video/mp4' : 'image/png',
          usedInScenes: generation.sceneId ? [generation.sceneId] : [],
        },
      });

      console.log(`✅ AI Asset created: ${asset.id}`);
      return asset;
    } catch (error) {
      console.error('❌ Create asset error:', error);
    }
  }

  async getGenerationStatus(generationId) {
    const generation = await prisma.aIGeneration.findUnique({
      where: { id: generationId },
      include: {
        scene: true,
        character: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return generation;
  }

  async listGenerations(scriptId, filters = {}) {
    const where = {
      scriptId,
      ...filters,
    };

    const generations = await prisma.aIGeneration.findMany({
      where,
      include: {
        scene: {
          select: {
            id: true,
            sceneNumber: true,
            heading: true,
          },
        },
        character: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return generations;
  }

  async deleteGeneration(generationId) {
    try {
      const generation = await prisma.aIGeneration.findUnique({
        where: { id: generationId },
      });

      if (!generation) {
        throw new Error('Generation not found');
      }

      if (generation.filePath && fs.existsSync(generation.filePath)) {
        fs.unlinkSync(generation.filePath);
        console.log(`🗑️  Deleted file: ${generation.filePath}`);
      }

      await prisma.aIGeneration.delete({
        where: { id: generationId },
      });

      return { success: true, message: 'Generation deleted' };
    } catch (error) {
      console.error('❌ Delete generation error:', error);
      throw new Error(`Failed to delete generation: ${error.message}`);
    }
  }

  async testConnection() {
    try {
      console.log('🧪 Testing Freepik API connection...');
      
      // Simple test request
      const response = await axios.get(
        `${this.freepikBaseUrl}/ai/mystic/test-task-id`, // This will 404 but tests auth
        {
          headers: {
            'x-freepik-api-key': this.freepikApiKey,
          },
          validateStatus: () => true, // Accept any status
        }
      );
      
      if (response.status === 401 || response.status === 403) {
        throw new Error('Invalid API key');
      }
      
      console.log('✅ Freepik API connection test passed');
      return 'Freepik API connection successful';
    } catch (error) {
      console.error('❌ Freepik API connection test failed:', error.message);
      throw new Error(`Connection test failed: ${error.message}`);
    }
  }
}

module.exports = new MediaAIService();
