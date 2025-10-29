const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

class GeminiService {
  constructor() {
    // Support multiple API keys for rotation
    this.apiKeys = [
      process.env.GEMINI_API_KEY,
      process.env.GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY_3,
      process.env.GEMINI_API_KEY_4,
      process.env.GEMINI_API_KEY_5
    ].filter(Boolean); // Remove undefined keys
    
    if (this.apiKeys.length === 0) {
      throw new Error('At least one GEMINI_API_KEY environment variable is required');
    }
    
    this.currentKeyIndex = 0;
    this.ai = new GoogleGenAI({
      apiKey: this.apiKeys[this.currentKeyIndex]
    });
    
    console.log(`✅ Gemini AI Service initialized with ${this.apiKeys.length} API key(s)`);
  }

  /**
   * Rotate to next API key if current one fails
   */
  rotateApiKey() {
    if (this.apiKeys.length <= 1) {
      console.warn('⚠️ Only one API key available, cannot rotate');
      return false;
    }
    
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
    this.ai = new GoogleGenAI({
      apiKey: this.apiKeys[this.currentKeyIndex]
    });
    
    console.log(`🔄 Rotated to API key ${this.currentKeyIndex + 1}/${this.apiKeys.length}`);
    return true;
  }

  /**
   * Make API call with automatic retry and key rotation
   */
  async makeApiCall(prompt, maxRetries = 3) {
    let lastError = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`🔄 API call attempt ${attempt + 1}/${maxRetries} (Key ${this.currentKeyIndex + 1})`);
        
        const response = await this.ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt
        });
        
        return response;
        
      } catch (error) {
        lastError = error;
        console.error(`❌ API call attempt ${attempt + 1} failed:`, error.message);
        
        // Check if it's a rate limit or quota error
        const isRateLimit = error.message.includes('quota') || 
                           error.message.includes('rate') || 
                           error.message.includes('limit') ||
                           error.message.includes('429');
        
        if (isRateLimit && attempt < maxRetries - 1) {
          console.log('⏰ Rate limit detected, rotating API key...');
          const rotated = this.rotateApiKey();
          
          if (rotated) {
            // Wait before retrying with new key
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
        }
        
        // Wait before retry
        if (attempt < maxRetries - 1) {
          const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.log(`⏳ Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Clean JSON from AI response (removes markdown, extracts JSON)
   */
  cleanJSON(text) {
    try {
      console.log('🧹 Cleaning JSON, original length:', text.length);
      
      // Remove markdown code blocks
      text = text.replace(/``````\n?/g, '').trim();
      
      // Find first { and last }
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1) {
        text = text.substring(firstBrace, lastBrace + 1);
      }
      
      // Fix trailing commas
      text = text.replace(/,(\s*[}\]])/g, '$1');
      
      console.log('✅ Cleaned JSON, new length:', text.length);
      
      return text;
    } catch (error) {
      console.error('❌ JSON cleaning failed:', error.message);
      return text;
    }
  }

  /**
   * Safe JSON parse with fallback
   */
  safeParse(text, fallback = null) {
    try {
      const cleaned = this.cleanJSON(text);
      const parsed = JSON.parse(cleaned);
      console.log('✅ JSON parsed successfully');
      return parsed;
    } catch (error) {
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('❌ JSON PARSE ERROR');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('Error:', error.message);
      console.error('');
      console.error('📝 RAW AI RESPONSE (first 1000 chars):');
      console.error(text.substring(0, 1000));
      console.error('');
      console.error('📝 RAW AI RESPONSE (last 1000 chars):');
      console.error(text.substring(Math.max(0, text.length - 1000)));
      console.error('');
      console.error('📝 FULL RAW RESPONSE (copy this entire block):');
      console.error('━━━━━━━━ START OF AI RESPONSE ━━━━━━━━');
      console.error(text);
      console.error('━━━━━━━━ END OF AI RESPONSE ━━━━━━━━');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      return fallback;
    }
  }

  /**
   * Extract ALL characters from script
   */
  async extractCharacters(scriptText, maxChars = 80000) {
    const truncated = scriptText.substring(0, maxChars);
    
    const prompt = `You are an expert screenplay analyst. Extract ALL character names from this script.

**INSTRUCTIONS:**
1. Find EVERY character name (including those with apostrophes like "JJ' DAD", "JJ' MOM")
2. Character names are typically in ALL CAPS before dialogue
3. Ignore scene headings (INT., EXT.), transitions (CUT TO, FADE), and page numbers
4. Handle multilingual scripts (English, Telugu, Italian, etc.)
5. Each character should appear ONCE in the list

**Script Text:**
${truncated}

**Return ONLY valid JSON (no markdown, no explanation):**
{
  "characters": [
    {
      "name": "CHARACTER_NAME",
      "role": "protagonist|supporting|minor",
      "description": "brief description"
    }
  ]
}`;

    try {
      console.log('🎭 Extracting characters with AI...');
      
      const response = await this.makeApiCall(prompt);
      
      let text = response.text;
      console.log('📥 AI response received, length:', text.length);
      
      const result = this.safeParse(text, { characters: [] });
      
      console.log(`✅ Extracted ${result.characters?.length || 0} characters`);
      
      return result;
    } catch (error) {
      console.error('❌ Character extraction failed:', error.message);
      return { characters: [] };
    }
  }

  /**
   * Analyze scenes with full context
   */
  async analyzeScenes(scriptText, characters, maxChars = 80000) {
    const truncated = scriptText.substring(0, maxChars);
    const characterNames = characters.map(c => c.name).join(', ');
    
    const prompt = `You are an expert screenplay analyst. Break this script into scenes and analyze each one.

**Known Characters:** ${characterNames}

**INSTRUCTIONS:**
1. Identify scene headings (INT./EXT., location, time of day)
2. Extract dialogue for each character (match to known characters list)
3. Identify action descriptions
4. List props/objects mentioned
5. Provide 2-3 sentence summary
6. Determine emotional tone/mood

**Script Text:**
${truncated}

**Return ONLY valid JSON (no markdown):**
{
  "scenes": [
    {
      "sceneNumber": 1,
      "heading": "INT. LOCATION - TIME",
      "location": "Location Name",
      "intExt": "INT|EXT",
      "timeOfDay": "DAY|NIGHT|etc",
      "characters": ["CHARACTER1", "CHARACTER2"],
      "dialogue": [
        {"character": "CHARACTER1", "text": "dialogue text", "emotion": "happy|sad|angry|neutral"}
      ],
      "actions": ["action description 1", "action description 2"],
      "props": ["prop1", "prop2"],
      "summary": "2-3 sentence summary",
      "tone": "comedic|dramatic|tense|romantic"
    }
  ]
}`;

    try {
      console.log('🎬 Analyzing scenes with AI...');
      
      const response = await this.makeApiCall(prompt);
      
      let text = response.text;
      console.log('📥 AI response received, length:', text.length);
      
      const result = this.safeParse(text, { scenes: [] });
      
      console.log(`✅ Analyzed ${result.scenes?.length || 0} scenes`);
      
      return result;
    } catch (error) {
      console.error('❌ Scene analysis failed:', error.message);
      return { scenes: [] };
    }
  }

  /**
   * Validate and fix parsing results (SIMPLIFIED VERSION)
   */
  async validateAndFix(regexResult, scriptText) {
    // SIMPLIFIED: Only validate characters, not full scenes
    const characterNames = regexResult.characters.map(c => c.name).join(', ');
    
    const prompt = `You are validating screenplay character detection. Check if any major characters are missing.

**Currently Found:** ${characterNames}

**Script Sample (first 8000 chars):**
${scriptText.substring(0, 8000)}

**INSTRUCTIONS:**
1. Check if all MAJOR speaking characters are in the list
2. Look for names with apostrophes (like "JJ' DAD", "MOM' FRIEND")
3. Look for multilingual names that might be missed
4. ONLY add characters that speak 3+ lines
5. Return a simple list of NEW characters to add (if any)

**Return ONLY valid JSON:**
{
  "newCharacters": [
    {"name": "CHARACTER_NAME", "role": "supporting|minor", "description": "brief"}
  ],
  "reasoning": "why these were added"
}`;

    try {
      console.log('🤖 AI validating character list...');
      
      const response = await this.makeApiCall(prompt);
      
      let text = response.text;
      console.log('📥 AI validation response received, length:', text.length);
      
      const result = this.safeParse(text, { newCharacters: [] });
      
      if (!result || !result.newCharacters) {
        console.warn('⚠️  AI returned invalid response, using regex results');
        return regexResult;
      }
      
      // Merge new characters with existing
      const merged = this.mergeCharacters(regexResult.characters, result.newCharacters);
      
      console.log(`✅ AI validation complete: ${result.newCharacters.length} characters added`);
      if (result.newCharacters.length > 0) {
        console.log(`   New: ${result.newCharacters.map(c => c.name).join(', ')}`);
        console.log(`   Reasoning: ${result.reasoning}`);
      }
      
      return {
        ...regexResult,
        characters: merged,
        metadata: {
          ...regexResult.metadata,
          aiValidated: true,
          aiAddedCharacters: result.newCharacters.map(c => c.name)
        }
      };
      
    } catch (error) {
      console.error('❌ Validation failed:', error.message);
      return regexResult;
    }
  }

  /**
   * Merge character lists (avoid duplicates)
   */
  mergeCharacters(existingChars, newChars) {
    const merged = [...existingChars];
    const existingNames = new Set(existingChars.map(c => c.name.toUpperCase()));
    
    newChars.forEach(newChar => {
      if (!existingNames.has(newChar.name.toUpperCase())) {
        merged.push(newChar);
        existingNames.add(newChar.name.toUpperCase());
      }
    });
    
    return merged;
  }

  /**
   * Analyze character relationships
   */
  async analyzeRelationships(characters, scenes) {
    const prompt = `Analyze relationships between characters based on their interactions.

**Characters:** ${JSON.stringify(characters)}
**Scenes (first 10):** ${JSON.stringify(scenes.slice(0, 10))}

**Return JSON:**
{
  "relationships": [
    {
      "from": "CHARACTER1",
      "to": "CHARACTER2",
      "type": "parent-child|romantic|friend|enemy|colleague",
      "sentiment": "positive|negative|neutral",
      "strength": 1-10
    }
  ]
}`;

    try {
      console.log('🔗 Analyzing relationships...');
      
      const response = await this.makeApiCall(prompt);
      
      let text = response.text;
      const result = this.safeParse(text, { relationships: [] });
      
      console.log(`✅ Found ${result.relationships?.length || 0} relationships`);
      
      return result;
    } catch (error) {
      console.error('❌ Relationship analysis failed:', error.message);
      return { relationships: [] };
    }
  }

  /**
   * Suggest character casting
   */
  async suggestCasting(character, dialogueSamples) {
    const prompt = `Suggest casting for this character based on their dialogue and role.

**Character:** ${character.name}
**Role:** ${character.role}
**Dialogue Samples:**
${dialogueSamples.slice(0, 5).join('\n')}

**Return JSON:**
{
  "ageRange": "20-30",
  "gender": "male|female|non-binary|any",
  "characteristics": ["trait1", "trait2"],
  "physicalTraits": ["trait1", "trait2"],
  "actingStyle": "description",
  "similarCharacters": ["character from other films"],
  "suggestedActors": ["actor name 1", "actor name 2"]
}`;

    try {
      console.log(`🎭 Generating casting suggestions for ${character.name}...`);
      
      const response = await this.makeApiCall(prompt);
      
      let text = response.text;
      const result = this.safeParse(text, null);
      
      return result;
    } catch (error) {
      console.error('❌ Casting suggestion failed:', error.message);
      return null;
    }
  }

  /**
   * Generate production insights
   */
  async analyzeProduction(scenes, characters) {
    const prompt = `Analyze production requirements for this screenplay.

**Scenes:** ${scenes.length} total
**Characters:** ${characters.length} total
**Sample Scenes (first 5):** ${JSON.stringify(scenes.slice(0, 5))}

**Return JSON:**
{
  "budget": {
    "estimatedRange": "$X - $Y",
    "complexity": "low|medium|high",
    "breakdown": {
      "locations": "estimate",
      "cast": "estimate",
      "props": "estimate",
      "postProduction": "estimate"
    }
  },
  "shootingDays": "estimated number",
  "locations": {
    "interior": ["location1", "location2"],
    "exterior": ["location1", "location2"],
    "complexity": "simple|moderate|complex"
  },
  "specialRequirements": ["requirement1", "requirement2"],
  "challenges": ["challenge1", "challenge2"]
}`;

    try {
      console.log('📊 Analyzing production requirements...');
      
      const response = await this.makeApiCall(prompt);
      
      let text = response.text;
      const result = this.safeParse(text, null);
      
      return result;
    } catch (error) {
      console.error('❌ Production analysis failed:', error.message);
      return null;
    }
  }

  /**
   * Generate comprehensive script summary with chunked processing and resume capability
   */
  async generateScriptSummary(scriptText, scenes, characters, maxChars = 100000) {
    const truncated = scriptText.substring(0, maxChars);
    const characterNames = characters.map(c => c.name).join(', ');
    const sceneCount = scenes.length;
    
    // Check if we need to process in chunks
    const needsChunking = truncated.length > 50000; // Process in chunks if > 50k chars
    
    if (needsChunking) {
      console.log('📚 Large script detected, processing in chunks...');
      return await this.generateChunkedScriptSummary(truncated, scenes, characters);
    }
    
    const prompt = `You are an expert screenplay analyst. Generate a comprehensive summary and analysis of this script.

**Script Information:**
- Characters: ${characterNames}
- Total Scenes: ${sceneCount}
- Script Length: ${truncated.length} characters

**INSTRUCTIONS:**
1. Provide a compelling 2-3 paragraph story summary
2. Identify the main themes and genre
3. Analyze the protagonist's journey
4. Highlight key plot points and turning points
5. Assess the emotional tone and pacing
6. Identify unique visual or narrative elements
7. Suggest the target audience and market appeal

**Script Text:**
${truncated}

**Return ONLY valid JSON (no markdown):**
{
  "summary": "2-3 paragraph compelling story summary",
  "genre": "drama|comedy|thriller|romance|sci-fi|horror|action|other",
  "themes": ["theme1", "theme2", "theme3"],
  "protagonist": {
    "name": "character name",
    "journey": "brief description of character arc",
    "motivation": "what drives the character"
  },
  "keyPlotPoints": [
    "major plot point 1",
    "major plot point 2",
    "climax description"
  ],
  "tone": "dramatic|comedic|tense|romantic|dark|uplifting",
  "pacing": "fast|moderate|slow",
  "visualElements": ["unique visual element 1", "unique visual element 2"],
  "targetAudience": "description of target audience",
  "marketAppeal": "commercial|artistic|niche|mainstream",
  "uniqueSellingPoints": ["what makes this script special"]
}`;

    try {
      console.log('📖 Generating comprehensive script summary...');
      
      const response = await this.makeApiCall(prompt);
      
      let text = response.text;
      console.log('📥 AI summary response received, length:', text.length);
      
      const result = this.safeParse(text, {
        summary: "Script analysis unavailable",
        genre: "drama",
        themes: [],
        protagonist: { name: "Unknown", journey: "Unknown", motivation: "Unknown" },
        keyPlotPoints: [],
        tone: "dramatic",
        pacing: "moderate",
        visualElements: [],
        targetAudience: "General audience",
        marketAppeal: "mainstream",
        uniqueSellingPoints: []
      });
      
      console.log('✅ Script summary generated successfully');
      return result;
    } catch (error) {
      console.error('❌ Script summary generation failed:', error.message);
      return {
        summary: "Script analysis unavailable",
        genre: "drama",
        themes: [],
        protagonist: { name: "Unknown", journey: "Unknown", motivation: "Unknown" },
        keyPlotPoints: [],
        tone: "dramatic",
        pacing: "moderate",
        visualElements: [],
        targetAudience: "General audience",
        marketAppeal: "mainstream",
        uniqueSellingPoints: []
      };
    }
  }

  /**
   * Generate script summary in chunks for large scripts
   */
  async generateChunkedScriptSummary(scriptText, scenes, characters) {
    const chunkSize = 40000; // 40k chars per chunk
    const chunks = [];
    
    // Split script into chunks
    for (let i = 0; i < scriptText.length; i += chunkSize) {
      chunks.push(scriptText.substring(i, i + chunkSize));
    }
    
    console.log(`📚 Processing ${chunks.length} chunks of script...`);
    
    const chunkSummaries = [];
    let processedChunks = 0;
    
    for (let i = 0; i < chunks.length; i++) {
      try {
        console.log(`📖 Processing chunk ${i + 1}/${chunks.length}...`);
        
        const chunkPrompt = `Analyze this chunk of a screenplay and provide key insights.

**Chunk ${i + 1} of ${chunks.length}:**
${chunks[i]}

**Return JSON with:**
{
  "keyEvents": ["event1", "event2"],
  "characters": ["character1", "character2"],
  "locations": ["location1", "location2"],
  "mood": "dramatic|comedic|tense|romantic|dark|uplifting",
  "visualElements": ["element1", "element2"],
  "summary": "brief summary of this chunk"
}`;

        const response = await this.makeApiCall(chunkPrompt);
        
        const chunkResult = this.safeParse(response.text, {
          keyEvents: [],
          characters: [],
          locations: [],
          mood: "dramatic",
          visualElements: [],
          summary: "Chunk analysis unavailable"
        });
        
        chunkSummaries.push(chunkResult);
        processedChunks++;
        
        console.log(`✅ Chunk ${i + 1} processed successfully`);
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`❌ Chunk ${i + 1} processing failed:`, error.message);
        
        // Save progress and continue with next chunk
        chunkSummaries.push({
          keyEvents: [],
          characters: [],
          locations: [],
          mood: "dramatic",
          visualElements: [],
          summary: "Chunk processing failed"
        });
      }
    }
    
    // Combine chunk summaries into final summary
    return await this.combineChunkSummaries(chunkSummaries, scenes, characters);
  }

  /**
   * Combine chunk summaries into final comprehensive summary
   */
  async combineChunkSummaries(chunkSummaries, scenes, characters) {
    try {
      console.log('🔄 Combining chunk summaries into final analysis...');
      
      const combinedData = {
        totalChunks: chunkSummaries.length,
        allEvents: chunkSummaries.flatMap(c => c.keyEvents),
        allCharacters: [...new Set(chunkSummaries.flatMap(c => c.characters))],
        allLocations: [...new Set(chunkSummaries.flatMap(c => c.locations))],
        allVisualElements: [...new Set(chunkSummaries.flatMap(c => c.visualElements))],
        chunkSummaries: chunkSummaries.map(c => c.summary)
      };
      
      const prompt = `Create a comprehensive script analysis from these chunk summaries.

**Combined Data:**
- Total Chunks: ${combinedData.totalChunks}
- All Events: ${combinedData.allEvents.join(', ')}
- All Characters: ${combinedData.allCharacters.join(', ')}
- All Locations: ${combinedData.allLocations.join(', ')}
- All Visual Elements: ${combinedData.allVisualElements.join(', ')}

**Chunk Summaries:**
${combinedData.chunkSummaries.map((summary, i) => `Chunk ${i + 1}: ${summary}`).join('\n')}

**Return comprehensive JSON:**
{
  "summary": "2-3 paragraph compelling story summary",
  "genre": "drama|comedy|thriller|romance|sci-fi|horror|action|other",
  "themes": ["theme1", "theme2", "theme3"],
  "protagonist": {
    "name": "character name",
    "journey": "brief description of character arc",
    "motivation": "what drives the character"
  },
  "keyPlotPoints": ["major plot point 1", "major plot point 2"],
  "tone": "dramatic|comedic|tense|romantic|dark|uplifting",
  "pacing": "fast|moderate|slow",
  "visualElements": ["unique visual element 1", "unique visual element 2"],
  "targetAudience": "description of target audience",
  "marketAppeal": "commercial|artistic|niche|mainstream",
  "uniqueSellingPoints": ["what makes this script special"],
  "processingInfo": {
    "chunked": true,
    "totalChunks": ${combinedData.totalChunks},
    "processedChunks": ${chunkSummaries.filter(c => c.summary !== "Chunk processing failed").length}
  }
}`;

      const response = await this.makeApiCall(prompt);
      
      const result = this.safeParse(response.text, {
        summary: "Script analysis unavailable",
        genre: "drama",
        themes: [],
        protagonist: { name: "Unknown", journey: "Unknown", motivation: "Unknown" },
        keyPlotPoints: [],
        tone: "dramatic",
        pacing: "moderate",
        visualElements: [],
        targetAudience: "General audience",
        marketAppeal: "mainstream",
        uniqueSellingPoints: [],
        processingInfo: {
          chunked: true,
          totalChunks: combinedData.totalChunks,
          processedChunks: chunkSummaries.filter(c => c.summary !== "Chunk processing failed").length
        }
      });
      
      console.log('✅ Chunked script summary completed successfully');
      return result;
      
    } catch (error) {
      console.error('❌ Chunk combination failed:', error.message);
      return {
        summary: "Script analysis unavailable - chunked processing failed",
        genre: "drama",
        themes: [],
        protagonist: { name: "Unknown", journey: "Unknown", motivation: "Unknown" },
        keyPlotPoints: [],
        tone: "dramatic",
        pacing: "moderate",
        visualElements: [],
        targetAudience: "General audience",
        marketAppeal: "mainstream",
        uniqueSellingPoints: [],
        processingInfo: {
          chunked: true,
          totalChunks: chunkSummaries.length,
          processedChunks: 0,
          error: error.message
        }
      };
    }
  }

  /**
   * Generate context-aware prompt for AI generation
   * PRESERVES USER INTENT while adding contextual enhancement
   */
  async generateContextAwarePrompt(userPrompt, scriptSummary, scene, character, generationType) {
    let contextInfo = '';
    
    // Add script context
    if (scriptSummary) {
      contextInfo += `**Script Context:**\n`;
      contextInfo += `- Genre: ${scriptSummary.genre}\n`;
      contextInfo += `- Tone: ${scriptSummary.tone}\n`;
      contextInfo += `- Themes: ${scriptSummary.themes.join(', ')}\n`;
      contextInfo += `- Visual Elements: ${scriptSummary.visualElements.join(', ')}\n\n`;
    }
    
    // Enhanced scene and character context handling
    if (scene && character) {
      // Both scene and character selected - analyze character's role in this specific scene
      contextInfo += `**Scene & Character Analysis:**\n`;
      contextInfo += `- Scene: ${scene.heading}\n`;
      contextInfo += `- Location: ${scene.location || 'Unknown'}\n`;
      contextInfo += `- Time: ${scene.timeOfDay || 'Unknown'}\n`;
      contextInfo += `- Setting: ${scene.intExt || 'Unknown'}\n`;
      if (scene.summary) contextInfo += `- Scene Summary: ${scene.summary}\n`;
      
      contextInfo += `- Character: ${character.name}\n`;
      if (character.description) contextInfo += `- Character Description: ${character.description}\n`;
      
      // Add character's specific role in this scene
      if (scene.actions && scene.actions.length > 0) {
        contextInfo += `- Scene Actions: ${scene.actions.slice(0, 3).join(', ')}\n`;
      }
      
      // Look for character's dialogue in this scene
      if (scene.dialogue && scene.dialogue.length > 0) {
        const characterDialogue = scene.dialogue.filter(d => 
          d.character && d.character.toLowerCase().includes(character.name.toLowerCase())
        );
        if (characterDialogue.length > 0) {
          contextInfo += `- Character's Dialogue: "${characterDialogue[0].text.substring(0, 100)}..."\n`;
        }
      }
      contextInfo += `\n`;
    } else if (scene) {
      // Only scene selected
      contextInfo += `**Scene Context:**\n`;
      contextInfo += `- Scene: ${scene.heading}\n`;
      contextInfo += `- Location: ${scene.location || 'Unknown'}\n`;
      contextInfo += `- Time: ${scene.timeOfDay || 'Unknown'}\n`;
      contextInfo += `- Setting: ${scene.intExt || 'Unknown'}\n`;
      if (scene.summary) contextInfo += `- Summary: ${scene.summary}\n`;
      if (scene.actions && scene.actions.length > 0) {
        contextInfo += `- Key Actions: ${scene.actions.slice(0, 3).join(', ')}\n`;
      }
      contextInfo += `\n`;
    } else if (character) {
      // Only character selected
      contextInfo += `**Character Context:**\n`;
      contextInfo += `- Name: ${character.name}\n`;
      if (character.description) contextInfo += `- Description: ${character.description}\n`;
      contextInfo += `\n`;
    }

    const prompt = `You are an expert AI content generation prompt optimizer. Your job is to ENHANCE the user's prompt while PRESERVING their exact intent and vision.

${contextInfo}

**USER'S ORIGINAL PROMPT (PRESERVE THIS INTENT):**
"${userPrompt}"

**CRITICAL INSTRUCTIONS:**
1. 🎯 KEEP the user's original vision and intent as the PRIMARY focus
2. 🎨 ADD contextual details that SUPPORT the user's request (don't change it)
3. 📝 Enhance with script context ONLY if it helps achieve what the user wants
4. 🎬 Add cinematic details that match the script's tone and genre
5. ⚡ Include technical specs for ${generationType} generation
6. 🔒 NEVER change the core subject, style, or mood the user requested
7. 📏 Keep under 500 characters for API performance
8. 🎭 If both scene and character are provided, focus on the character's role in that specific scene
9. 🎪 Use the scene's location, time, and mood to enhance the character's portrayal
10. 🎨 Match the visual style to the scene's emotional tone and setting

**EXAMPLES:**
- User wants "a red car" → Enhanced: "a red car in a dramatic scene, cinematic lighting, matching the script's tense tone"
- User wants "close-up of character" → Enhanced: "close-up portrait of [character name], dramatic lighting, matching the script's emotional tone"
- User wants "sunset scene" → Enhanced: "cinematic sunset scene, golden hour lighting, matching the script's romantic/dramatic tone"
- User wants "character portrait" + scene context → Enhanced: "portrait of [character] in [scene location], [scene mood], cinematic lighting"

**Return ONLY the enhanced prompt (no explanations, no JSON):`;

    try {
      console.log(`🎯 Generating context-aware prompt for ${generationType}...`);
      console.log(`📝 User's original intent: "${userPrompt}"`);
      
      const response = await this.makeApiCall(prompt);
      
      const enhancedPrompt = response.text.trim();
      console.log('✅ Context-aware prompt generated');
      console.log('📝 Enhanced prompt:', enhancedPrompt);
      console.log('🔍 User intent preserved:', userPrompt.toLowerCase().includes(enhancedPrompt.toLowerCase().split(' ')[0]) ? '✅' : '⚠️');
      
      return enhancedPrompt;
    } catch (error) {
      console.error('❌ Context-aware prompt generation failed:', error.message);
      console.log('🔄 Falling back to original user prompt');
      return userPrompt; // Fallback to original prompt
    }
  }

  /**
   * Generate scene-specific visual description
   */
  async generateSceneVisualDescription(scene, scriptSummary) {
    const prompt = `Generate a detailed visual description for this scene that would be perfect for AI image/video generation.

**Scene Information:**
- Heading: ${scene.heading}
- Location: ${scene.location || 'Unknown'}
- Time: ${scene.timeOfDay || 'Unknown'}
- Setting: ${scene.intExt || 'Unknown'}

**Script Context:**
- Genre: ${scriptSummary?.genre || 'drama'}
- Tone: ${scriptSummary?.tone || 'dramatic'}
- Visual Elements: ${scriptSummary?.visualElements?.join(', ') || 'None specified'}

**Scene Details:**
${scene.summary || 'No scene summary available'}

**INSTRUCTIONS:**
1. Create a cinematic visual description suitable for AI generation
2. Include lighting, mood, composition, and atmosphere
3. Match the script's genre and tone
4. Be specific about camera angles and visual style
5. Include relevant props and environmental details
6. Keep it under 300 characters

**Return ONLY the visual description (no explanations):`;

    try {
      console.log(`🎨 Generating visual description for scene: ${scene.heading}`);
      
      const response = await this.makeApiCall(prompt);
      
      const visualDescription = response.text.trim();
      console.log('✅ Scene visual description generated');
      
      return visualDescription;
    } catch (error) {
      console.error('❌ Scene visual description generation failed:', error.message);
      return `Cinematic shot of ${scene.location || 'the scene'} during ${scene.timeOfDay || 'the day'}`;
    }
  }

  /**
   * Generate character-specific visual description
   */
  async generateCharacterVisualDescription(character, scriptSummary) {
    const prompt = `Generate a detailed visual description for this character that would be perfect for AI image generation.

**Character Information:**
- Name: ${character.name}
- Description: ${character.description || 'No description available'}

**Script Context:**
- Genre: ${scriptSummary?.genre || 'drama'}
- Tone: ${scriptSummary?.tone || 'dramatic'}
- Visual Elements: ${scriptSummary?.visualElements?.join(', ') || 'None specified'}

**INSTRUCTIONS:**
1. Create a detailed character visual description
2. Include physical appearance, clothing, and style
3. Match the script's genre and tone
4. Be specific about facial features, age, and demeanor
5. Include relevant props or accessories
6. Keep it under 300 characters

**Return ONLY the visual description (no explanations):`;

    try {
      console.log(`👤 Generating visual description for character: ${character.name}`);
      
      const response = await this.makeApiCall(prompt);
      
      const visualDescription = response.text.trim();
      console.log('✅ Character visual description generated');
      
      return visualDescription;
    } catch (error) {
      console.error('❌ Character visual description generation failed:', error.message);
      return `Portrait of ${character.name}, a character from the script`;
    }
  }

  /**
   * Test connection
   */
  async testConnection() {
    try {
      console.log('🧪 Testing Gemini API connection...');
      
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: 'Respond with "API connection successful" to confirm.'
      });
      
      console.log('✅ API connection test passed');
      return response.text;
    } catch (error) {
      console.error('❌ API connection test failed:', error.message);
      throw new Error(`API connection test failed: ${error.message}`);
    }
  }
}

module.exports = new GeminiService();
