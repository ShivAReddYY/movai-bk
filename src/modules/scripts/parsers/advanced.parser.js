const fs = require('fs').promises;
const { PDFParse } = require('pdf-parse');

/**
 * 🔥 ULTIMATE PRODUCTION-GRADE SCRIPT PARSER WITH FORMATTING
 * - Accurate page-by-page extraction
 * - Clean dialogue parsing
 * - Perfect character detection
 * - Formatted line types for visual rendering
 * - Multi-language support
 * - Enhanced PDF page detection
 */
class AdvancedScriptParser {
  async parse(filePath) {
    try {
      console.log('📄 Parsing PDF:', filePath);
      
      const buffer = await fs.readFile(filePath);
      const parser = new PDFParse({ 
        data: buffer,
        // Enhanced options for better text extraction
        normalizeWhitespace: false,
        disableCombineTextItems: false
      });
      const result = await parser.getText();
      await parser.destroy();
      
      const text = result.text;
      const totalPages = result.total;
      
      console.log(`✅ PDF loaded: ${totalPages} pages, ${text.length} chars`);
      console.log(`📊 First 200 chars:`, text.substring(0, 200));
      
      // Step 1: Extract and analyze each page individually
      const textPages = this.extractTextPages(text, totalPages);
      console.log(`📖 Extracted ${textPages.length} text pages`);
      
      // Step 2: Analyze each page for formatting
      const analyzedPages = this.analyzePages(textPages);
      console.log(`🔍 Analyzed ${analyzedPages.length} pages`);
      
      // Step 3: Parse scenes ACROSS pages (not per-page)
      const scenes = this.parseScenes(analyzedPages);
      console.log(`🎬 Parsed ${scenes.length} scenes`);
      
      // Step 4: Extract character data with full dialogue
      const characters = this.extractCharacters(scenes);
      console.log(`👥 Found ${characters.length} characters`);
      
      // Step 5: Generate metadata
      const metadata = this.generateMetadata(analyzedPages, scenes, characters);
      console.log(`✅ Analysis complete!`);
      
      return {
        textPages: analyzedPages, // Return analyzed pages with formatting
        scenes,
        characters,
        metadata,
      };
      
    } catch (error) {
      console.error('❌ Parsing error:', error);
      throw error;
    }
  }

  /**
   * ✅ ENHANCED: Extract text pages with better PDF page detection
   */
  extractTextPages(text, totalPages) {
    console.log(`🔍 Analyzing PDF structure...`);
    
    // Method 1: Try form feed detection first
    const formFeedPages = text.split('\f').filter(p => p.trim());
    console.log(`📄 Form feed pages found: ${formFeedPages.length}`);
    
    if (formFeedPages.length >= totalPages && formFeedPages.length <= totalPages * 1.5) {
      console.log(`✅ Using PDF form feed page breaks (${formFeedPages.length} pages)`);
      return formFeedPages.map((pageText, index) => {
        const cleaned = this.cleanScriptText(pageText);
        return {
          pageNumber: index + 1,
          rawText: cleaned,
          lineCount: cleaned.split('\n').length,
          originalLength: pageText.length,
        };
      });
    }
    
    // Method 2: Try page number detection
    const pageNumberPages = this.detectPagesByPageNumbers(text, totalPages);
    if (pageNumberPages.length > 0) {
      console.log(`✅ Using page number detection (${pageNumberPages.length} pages)`);
      return pageNumberPages;
    }
    
    // Method 3: Smart line-based distribution with content analysis
    console.log(`⚠️ Using smart line-based page breaks (${totalPages} pages)`);
    return this.distributeLinesByContent(text, totalPages);
  }

  /**
   * ✅ NEW: Detect pages by looking for page numbers
   */
  detectPagesByPageNumbers(text, totalPages) {
    const lines = text.split('\n');
    const pageBreaks = [];
    
    // Look for page numbers (1, 2, 3, etc.) at start of lines
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (/^\d{1,3}\s*$/.test(line)) {
        const pageNum = parseInt(line);
        if (pageNum >= 1 && pageNum <= totalPages) {
          pageBreaks.push({ lineIndex: i, pageNumber: pageNum });
        }
      }
    }
    
    if (pageBreaks.length < totalPages * 0.5) {
      return []; // Not enough page numbers found
    }
    
    console.log(`📊 Found ${pageBreaks.length} page number markers`);
    
    const pages = [];
    for (let i = 0; i < pageBreaks.length; i++) {
      const startLine = pageBreaks[i].lineIndex + 1; // Skip page number line
      const endLine = i < pageBreaks.length - 1 ? pageBreaks[i + 1].lineIndex : lines.length;
      
      const pageLines = lines.slice(startLine, endLine);
      const pageText = pageLines.join('\n');
      const cleaned = this.cleanScriptText(pageText);
      
      pages.push({
        pageNumber: pageBreaks[i].pageNumber,
        rawText: cleaned,
        lineCount: pageLines.length,
        originalLength: pageText.length,
      });
    }
    
    return pages;
  }

  /**
   * ✅ NEW: Smart line distribution based on content analysis
   */
  distributeLinesByContent(text, totalPages) {
    const allLines = text.split('\n');
    
    // Clean up empty lines at start/end
    while (allLines.length > 0 && !allLines[0].trim()) allLines.shift();
    while (allLines.length > 0 && !allLines[allLines.length - 1].trim()) allLines.pop();
    
    console.log(`📊 Total lines: ${allLines.length}, Target pages: ${totalPages}`);
    
    // Calculate lines per page with some intelligence
    const baseLinesPerPage = Math.ceil(allLines.length / totalPages);
    const textPages = [];
    
    let currentLine = 0;
    for (let i = 0; i < totalPages; i++) {
      const isLastPage = (i === totalPages - 1);
      const linesForThisPage = isLastPage ? 
        (allLines.length - currentLine) : 
        Math.min(baseLinesPerPage, allLines.length - currentLine);
      
      const endLine = currentLine + linesForThisPage;
      const pageLines = allLines.slice(currentLine, endLine);
      const pageText = pageLines.join('\n');
      const cleaned = this.cleanScriptText(pageText);
      
      console.log(`📄 Page ${i + 1}: lines ${currentLine}-${endLine-1} (${pageLines.length} lines, ${cleaned.length} chars)`);
      
      textPages.push({
        pageNumber: i + 1,
        rawText: cleaned,
        lineCount: pageLines.length,
        originalLength: pageText.length,
      });
      
      currentLine = endLine;
    }
    
    return textPages;
  }

  /**
   * ✅ NEW: Analyze each page for formatting and structure
   */
  analyzePages(textPages) {
    console.log(`🔍 Analyzing ${textPages.length} pages for formatting...`);
    
    return textPages.map((page, index) => {
      console.log(`📄 Analyzing page ${page.pageNumber}...`);
      
      const formattedLines = this.formatPageLines(page.rawText);
      const analysis = this.analyzePageContent(page.rawText, formattedLines);
      
      console.log(`✅ Page ${page.pageNumber}: ${formattedLines.length} lines, ${analysis.sceneHeadings} scenes, ${analysis.characters} characters`);
      
      return {
        ...page,
        formattedLines,
        analysis,
      };
    });
  }

  /**
   * ✅ NEW: Analyze page content for structure
   */
  analyzePageContent(pageText, formattedLines) {
    const sceneHeadings = formattedLines.filter(line => line.type === 'scene_heading').length;
    const characters = formattedLines.filter(line => line.type === 'character').length;
    const dialogue = formattedLines.filter(line => line.type === 'dialogue').length;
    const actions = formattedLines.filter(line => line.type === 'action').length;
    const transitions = formattedLines.filter(line => line.type === 'transition').length;
    
    return {
      sceneHeadings,
      characters,
      dialogue,
      actions,
      transitions,
      totalLines: formattedLines.length,
    };
  }

  /**
   * 🎨 PROFESSIONAL: Format page lines with exact PDF positioning and styling
   */
  formatPageLines(pageText) {
    const lines = pageText.split('\n');
    const formatted = [];
    
    console.log(`🔍 Formatting ${lines.length} lines with professional styling...`);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      const originalLine = line;
      
      if (!trimmed) {
        formatted.push({ 
          type: 'empty', 
          text: '', 
          original: originalLine,
          indentation: this.calculateIndentation(originalLine),
          alignment: 'left'
        });
        continue;
      }
      
      // Skip page numbers and footers
      if (this.isPageNumber(trimmed) || this.isPageFooter(trimmed)) {
        console.log(`⏭️ Skipping page marker: "${trimmed}"`);
        continue;
      }
      
      // Scene heading - highest priority
      if (this.isSceneHeading(trimmed)) {
        formatted.push({
          type: 'scene_heading',
          text: trimmed,
          original: originalLine,
          indentation: this.calculateIndentation(originalLine),
          alignment: 'left',
          formatting: {
            bold: true,
            uppercase: true,
            underline: true,
            marginTop: '1.5em',
            marginBottom: '1em'
          }
        });
        console.log(`🎬 Scene heading: "${trimmed}"`);
        continue;
      }
      
      // Transition
      if (this.isTransition(trimmed)) {
        formatted.push({
          type: 'transition',
          text: trimmed,
          original: originalLine,
          indentation: this.calculateIndentation(originalLine),
          alignment: 'right',
          formatting: {
            bold: true,
            uppercase: true,
            marginTop: '1em',
            marginBottom: '1em'
          }
        });
        console.log(`🎭 Transition: "${trimmed}"`);
        continue;
      }
      
      // Character name (enhanced detection with positioning)
      if (this.isCharacterName(trimmed, lines, i)) {
        const cleanName = this.cleanCharacterName(trimmed);
        const indentation = this.calculateIndentation(originalLine);
        
        formatted.push({
          type: 'character',
          text: cleanName,
          original: originalLine,
          indentation: indentation,
          alignment: this.getCharacterAlignment(indentation),
          formatting: {
            bold: true,
            uppercase: true,
            marginTop: '1em',
            marginBottom: '0.25em'
          }
        });
        console.log(`👤 Character: "${cleanName}" (${this.getCharacterAlignment(indentation)})`);
        continue;
      }
      
      // Parenthetical
      if (this.isParenthetical(trimmed)) {
        const indentation = this.calculateIndentation(originalLine);
        formatted.push({
          type: 'parenthetical',
          text: trimmed,
          original: originalLine,
          indentation: indentation,
          alignment: this.getParentheticalAlignment(indentation),
          formatting: {
            italic: true,
            marginBottom: '0.25em'
          }
        });
        console.log(`💬 Parenthetical: "${trimmed}"`);
        continue;
      }
      
      // Dialogue (after character name or parenthetical)
      if (formatted.length > 0 && 
          (formatted[formatted.length - 1].type === 'character' || 
           formatted[formatted.length - 1].type === 'parenthetical' ||
           formatted[formatted.length - 1].type === 'dialogue')) {
        const indentation = this.calculateIndentation(originalLine);
        formatted.push({
          type: 'dialogue',
          text: trimmed,
          original: originalLine,
          indentation: indentation,
          alignment: this.getDialogueAlignment(indentation),
          formatting: {
            marginBottom: '0.5em',
            maxWidth: '65%'
          }
        });
        console.log(`💭 Dialogue: "${trimmed.substring(0, 50)}..."`);
        continue;
      }
      
      // Action (default for everything else)
      const indentation = this.calculateIndentation(originalLine);
      formatted.push({
        type: 'action',
        text: trimmed,
        original: originalLine,
        indentation: indentation,
        alignment: 'left',
        formatting: {
          marginBottom: '0.75em'
        }
      });
    }
    
    console.log(`✅ Formatted ${formatted.length} lines with professional styling`);
    return formatted;
  }

  /**
   * ✅ NEW: Calculate indentation from original line
   */
  calculateIndentation(originalLine) {
    const leadingSpaces = originalLine.match(/^(\s*)/)[1];
    return leadingSpaces.length;
  }

  /**
   * ✅ NEW: Determine character name alignment based on indentation
   */
  getCharacterAlignment(indentation) {
    // Character names are typically centered or left-aligned
    if (indentation > 20) return 'center';
    if (indentation > 10) return 'center';
    return 'left';
  }

  /**
   * ✅ NEW: Determine parenthetical alignment
   */
  getParentheticalAlignment(indentation) {
    // Parentheticals are typically centered
    if (indentation > 15) return 'center';
    return 'left';
  }

  /**
   * ✅ NEW: Determine dialogue alignment
   */
  getDialogueAlignment(indentation) {
    // Dialogue is typically centered or left-aligned with specific margins
    if (indentation > 20) return 'center';
    if (indentation > 10) return 'center';
    return 'left';
  }

  /**
   * ✅ ENHANCED: Parse scenes ACROSS pages with better analysis
   */
  parseScenes(analyzedPages) {
    console.log(`🎬 Parsing scenes from ${analyzedPages.length} analyzed pages...`);
    
    const scenes = [];
    let currentScene = null;
    let sceneLines = [];
    let formattedLines = [];
    
    // Flatten all formatted lines from all pages
    const allFormattedLines = [];
    analyzedPages.forEach(page => {
      page.formattedLines.forEach(line => {
        allFormattedLines.push({
          ...line,
          pageNumber: page.pageNumber,
        });
      });
    });
    
    console.log(`📊 Total formatted lines: ${allFormattedLines.length}`);
    
    // Parse line by line
    for (let i = 0; i < allFormattedLines.length; i++) {
      const lineObj = allFormattedLines[i];
      const line = lineObj.text;
      const lineType = lineObj.type;
      
      // Scene heading detected
      if (lineType === 'scene_heading') {
        // Save previous scene
        if (currentScene) {
          currentScene.text = sceneLines.join('\n');
          currentScene.formattedText = formattedLines;
          currentScene.summary = this.generateSceneSummary(currentScene);
          currentScene.props = this.extractProps(sceneLines);
          scenes.push(currentScene);
          console.log(`✅ Completed scene ${currentScene.sceneNumber}: ${currentScene.location}`);
        }
        
        // Parse new scene
        const sceneData = this.parseSceneHeading(line);
        
        currentScene = {
          sceneNumber: scenes.length + 1,
          pageNumber: lineObj.pageNumber,
          heading: line,
          location: sceneData.location,
          intExt: sceneData.intExt,
          timeOfDay: sceneData.time,
          dialogue: [],
          actions: [],
          actors: [],
          charactersInScene: new Set(),
        };
        
        sceneLines = [line];
        formattedLines = [lineObj];
        console.log(`🎬 New scene ${currentScene.sceneNumber}: ${line}`);
        continue;
      }
      
      if (!currentScene) continue;
      
      sceneLines.push(line);
      
      // Character name
      if (lineType === 'character') {
        const characterName = this.cleanCharacterName(line);
        currentScene.charactersInScene.add(characterName);
        
        if (!currentScene.actors.includes(characterName)) {
          currentScene.actors.push(characterName);
        }
        
        formattedLines.push(lineObj);
        
        // Collect dialogue that follows
        let dialogueLines = [];
        let j = i + 1;
        
        while (j < allFormattedLines.length) {
          const nextLineObj = allFormattedLines[j];
          const nextLine = nextLineObj.text.trim();
          const nextType = nextLineObj.type;
          
          if (!nextLine) {
            j++;
            continue;
          }
          
          // Stop at next character, scene heading, or transition
          if (nextType === 'character' || 
              nextType === 'scene_heading' || 
              nextType === 'transition') {
            break;
          }
          
          // Handle parenthetical
          if (nextType === 'parenthetical') {
            formattedLines.push(nextLineObj);
            sceneLines.push(nextLine);
            j++;
            continue;
          }
          
          // Handle dialogue
          if (nextType === 'dialogue') {
            dialogueLines.push(nextLine);
            formattedLines.push(nextLineObj);
            sceneLines.push(nextLine);
            j++;
            continue;
          }
          
          // Stop at action lines that look like new scenes
          if (nextType === 'action' && this.isLikelyActionLine(nextLine)) {
            break;
          }
          
          j++;
        }
        
        if (dialogueLines.length > 0) {
          currentScene.dialogue.push({
            character: characterName,
            text: dialogueLines.join(' '),
          });
          console.log(`💭 ${characterName}: "${dialogueLines.join(' ').substring(0, 50)}..."`);
        }
        
        i = j - 1;
        continue;
      }
      
      // Transition
      if (lineType === 'transition') {
        formattedLines.push(lineObj);
        continue;
      }
      
      // Action line
      if (lineType === 'action') {
        currentScene.actions.push(line);
        formattedLines.push(lineObj);
      }
    }
    
    // Save last scene
    if (currentScene) {
      currentScene.text = sceneLines.join('\n');
      currentScene.formattedText = formattedLines;
      currentScene.summary = this.generateSceneSummary(currentScene);
      currentScene.props = this.extractProps(sceneLines);
      scenes.push(currentScene);
      console.log(`✅ Completed final scene ${currentScene.sceneNumber}: ${currentScene.location}`);
    }
    
    // Convert Set to Array
    scenes.forEach(scene => {
      scene.charactersInScene = Array.from(scene.charactersInScene);
    });
    
    console.log(`🎬 Parsed ${scenes.length} scenes total`);
    return scenes;
  }

  /**
   * ✅ IMPROVED: Scene heading parser with better location extraction
   */
  parseSceneHeading(heading) {
    let intExt = 'INT';
    let location = 'Unknown';
    let time = 'DAY';
    
    const pattern1 = /^(INT\.?|EXT\.?|INT\/EXT\.?|I\/E\.?)\s+(.+?)\s*[-–—]\s*(DAY|NIGHT|LATER|MORNING|EVENING|DAWN|DUSK|CONTINUOUS|SAME TIME|MOMENTS LATER|AFTERNOON|SUNSET|SUNRISE)/i;
    const match1 = heading.match(pattern1);
    
    if (match1) {
      intExt = match1[1].replace(/\./g, '').toUpperCase();
      location = match1[2].trim();
      time = match1[3].toUpperCase();
      return { intExt, location, time };
    }
    
    const pattern2 = /^(INT\.?|EXT\.?|INT\/EXT\.?|I\/E\.?)\s+(.+?)\.\s*(DAY|NIGHT|LATER|MORNING|EVENING|DAWN|DUSK|CONTINUOUS|SAME TIME|MOMENTS LATER|AFTERNOON|SUNSET|SUNRISE)/i;
    const match2 = heading.match(pattern2);
    
    if (match2) {
      intExt = match2[1].replace(/\./g, '').toUpperCase();
      location = match2[2].trim();
      time = match2[3].toUpperCase();
      return { intExt, location, time };
    }
    
    const pattern3 = /^(INT\.?|EXT\.?|INT\/EXT\.?|I\/E\.?)\s+(.+)/i;
    const match3 = heading.match(pattern3);
    
    if (match3) {
      intExt = match3[1].replace(/\./g, '').toUpperCase();
      location = match3[2].trim().replace(/\.$/, '');
      return { intExt, location, time };
    }
    
    return { intExt, location, time };
  }

  /**
   * ✅ PROFESSIONAL: Enhanced character name detection with context awareness
   */
  isCharacterName(line, allLines, currentIndex) {
    const trimmed = typeof line === 'string' ? line.trim() : line.text?.trim();
    if (!trimmed) return false;
    
    // Basic length and content checks
    if (trimmed.length < 2 || trimmed.length > 50) return false;
    if (this.isPageNumber(trimmed) || this.isPageFooter(trimmed)) return false;
    if (this.isSceneHeading(trimmed) || this.isTransition(trimmed)) return false;
    
    // Remove parentheticals and check core name
    const withoutParens = trimmed.replace(/\([^)]*\)/g, '').trim();
    if (!withoutParens || withoutParens.length < 2) return false;
    if (!/[A-Z]/.test(withoutParens)) return false;
    
    // Enhanced character pattern - more flexible for international names
    const characterPattern = /^[A-Z][A-Z\s'.-]*$/;
    if (!characterPattern.test(withoutParens)) return false;
    
    // Check for initials (J.D., M.A., etc.)
    if (withoutParens.includes('.') && !/^[A-Z]\.[A-Z]\.?/.test(withoutParens)) {
      return false;
    }
    
    // Check next line to ensure it's not another character or scene
    const nextLineIndex = currentIndex + 1;
    if (nextLineIndex >= allLines.length) return false;
    
    const nextLine = allLines[nextLineIndex];
    const nextText = typeof nextLine === 'string' ? nextLine.trim() : nextLine.text?.trim();
    if (!nextText) return false;
    
    // Don't treat consecutive character names as valid
    if (this.looksLikeCharacterName(nextText) || this.isSceneHeading(nextText)) return false;
    
    // Enhanced validation: character names shouldn't be common words or actions
    const commonWords = [
      'THE', 'AND', 'OR', 'BUT', 'SO', 'IF', 'WHEN', 'WHERE', 'WHY', 'HOW',
      'CUT', 'FADE', 'DISSOLVE', 'SMASH', 'MATCH', 'JUMP', 'WIPE', 'IRIS',
      'CONTINUED', 'MORE', 'CONTINUOUS', 'SAME', 'TIME', 'MOMENTS', 'LATER',
      'STOP', 'START', 'BEGIN', 'END', 'FINISH', 'COMPLETE', 'DONE'
    ];
    if (commonWords.includes(withoutParens.toUpperCase())) return false;
    
    // Check if it looks like an action line (too long, contains action words)
    const actionWords = ['WALKS', 'RUNS', 'SITS', 'STANDS', 'LOOKS', 'TURNS', 'OPENS', 'CLOSES'];
    const hasActionWords = actionWords.some(word => withoutParens.toUpperCase().includes(word));
    if (hasActionWords && withoutParens.length > 20) return false;
    
    // Check context - character names usually have dialogue following
    const hasDialogueFollowing = this.hasDialogueFollowing(allLines, currentIndex);
    if (!hasDialogueFollowing) {
      // If no dialogue follows, it might not be a character name
      return false;
    }
    
    return true;
  }

  /**
   * ✅ NEW: Check if dialogue follows a potential character name
   */
  hasDialogueFollowing(allLines, currentIndex) {
    // Look ahead for dialogue indicators
    for (let i = currentIndex + 1; i < Math.min(currentIndex + 5, allLines.length); i++) {
      const nextLine = allLines[i];
      const nextText = typeof nextLine === 'string' ? nextLine.trim() : nextLine.text?.trim();
      
      if (!nextText) continue;
      
      // If we hit another character or scene heading, stop
      if (this.looksLikeCharacterName(nextText) || this.isSceneHeading(nextText)) {
        break;
      }
      
      // If we find dialogue-like text (not action), it's likely a character
      if (this.looksLikeDialogue(nextText)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * ✅ NEW: Check if text looks like dialogue
   */
  looksLikeDialogue(text) {
    // Dialogue typically has quotes, or is conversational
    if (text.includes('"') || text.includes("'")) return true;
    
    // Check for conversational patterns
    const dialoguePatterns = [
      /^(Yes|No|Hello|Hi|Hey|What|How|Why|Where|When|Who)/i,
      /[.!?]$/,
      /(I|you|he|she|we|they|it)\s/i
    ];
    
    return dialoguePatterns.some(pattern => pattern.test(text));
  }

  looksLikeCharacterName(line) {
    const trimmed = line.trim();
    if (trimmed.length < 2 || trimmed.length > 50) return false;
    
    const withoutParens = trimmed.replace(/\([^)]*\)/g, '').trim();
    if (!withoutParens || !/[A-Z]/.test(withoutParens)) return false;
    
    const characterPattern = /^[A-Z][A-Z\s'.-]*$/;
    if (!characterPattern.test(withoutParens)) return false;
    if (withoutParens.includes('.') && !/^[A-Z]\.[A-Z]\.?/.test(withoutParens)) return false;
    if (this.isSceneHeading(trimmed) || this.isTransition(trimmed)) return false;
    
    return true;
  }

  isLikelyActionLine(line) {
    const trimmed = line.trim();
    if (this.looksLikeCharacterName(trimmed)) return false;
    
    const isAllCaps = /^[A-Z\s'.-]+$/.test(trimmed);
    const startsWithCap = /^[A-Z]/.test(trimmed);
    const hasLowercase = /[a-z]/.test(trimmed);
    
    if (isAllCaps && trimmed.length > 60) return true;
    if (startsWithCap && hasLowercase && trimmed.length > 40) return true;
    
    return false;
  }

  isSceneHeading(line) {
    const pattern1 = /^(INT\.?|EXT\.?|INT\/EXT\.?|I\/E\.?)\s+.+\s*[-–—]\s*(DAY|NIGHT|LATER|MORNING|EVENING|DAWN|DUSK|CONTINUOUS|SAME TIME|MOMENTS LATER|AFTERNOON|SUNSET|SUNRISE)/i;
    const pattern2 = /^(INT\.?|EXT\.?|INT\/EXT\.?|I\/E\.?)\s+.+\.\s*(DAY|NIGHT|LATER|MORNING|EVENING|DAWN|DUSK|CONTINUOUS|SAME TIME|MOMENTS LATER|AFTERNOON|SUNSET|SUNRISE)/i;
    const pattern3 = /^(INT\.?|EXT\.?|INT\/EXT\.?|I\/E\.?)\s+[A-Z\s']{3,}/i;
    
    return pattern1.test(line) || pattern2.test(line) || pattern3.test(line);
  }

  cleanScriptText(text) {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\t/g, '    ')
      .replace(/\s+\n/g, '\n')
      .replace(/â€™/g, "'")
      .replace(/â€œ/g, '"')
      .replace(/â€/g, '"')
      .replace(/â€"/g, '—')
      .replace(/â€"/g, '–')
      .replace(/Ã /g, 'à')
      .replace(/Ã¨/g, 'è')
      .replace(/Ã©/g, 'é')
      .replace(/Ã¬/g, 'ì')
      .replace(/Ã²/g, 'ò')
      .replace(/Ã¹/g, 'ù')
      .replace(/piÃ¹/g, 'più')
      .trim();
  }

  cleanCharacterName(line) {
    return line
      .replace(/\([^)]*\)/g, '')
      .replace(/\s+/g, ' ')
      .replace(/â€™/g, "'")
      .trim();
  }

  isParenthetical(line) {
    return line.startsWith('(') && line.endsWith(')');
  }

  isPageNumber(line) {
    return /^\d{1,3}\.?$/.test(line.trim());
  }

  isPageFooter(line) {
    return /^-*\s*\d+\s+of\s+\d+\s*-*$/i.test(line) || /^Page\s+\d+$/i.test(line);
  }

  isTransition(line) {
    const transitions = [
      'FADE OUT', 'FADE IN', 'CUT TO', 'DISSOLVE TO', 'SMASH CUT TO',
      'MATCH CUT TO', 'JUMP CUT TO', 'WIPE TO', 'IRIS OUT', 'IRIS IN', 
      'THE END', 'CONTINUED', 'TO BE CONTINUED'
    ];
    return transitions.some(t => line.toUpperCase().includes(t));
  }

  extractProps(lines) {
    const props = new Set();
    const propKeywords = [
      'glasses', 'phone', 'bottle', 'gun', 'knife', 'car', 'train', 'computer', 
      'scanner', 'qr', 'kiosk', 'robot', 'tray', 'lift', 'elevator', 'apron', 
      'luggage', 'locker', 'juice', 'beer', 'metro', 'sofa', 'camera', 'dress',
      'frame', 'machine', 'caviar', 'vending', 'jet', 'airhostess', 'ticket',
      'passport', 'bag', 'wallet', 'keys', 'door', 'window', 'table', 'chair'
    ];
    
    lines.forEach(line => {
      const lowerLine = line.toLowerCase();
      propKeywords.forEach(prop => {
        if (new RegExp(`\\b${prop}\\b`, 'i').test(lowerLine)) {
          props.add(prop.charAt(0).toUpperCase() + prop.slice(1));
        }
      });
    });
    
    return Array.from(props);
  }

  generateSceneSummary(scene) {
    const actionText = scene.actions.slice(0, 3).join(' ');
    const dialogueText = scene.dialogue
      .slice(0, 2)
      .map(d => `${d.character}: ${d.text.substring(0, 50)}...`)
      .join(' ');
    
    return `${actionText} ${dialogueText}`.trim() || 'No summary available';
  }

  extractCharacters(scenes) {
    const characterMap = new Map();
    
    scenes.forEach((scene, sceneIndex) => {
      scene.actors.forEach(charName => {
        if (!characterMap.has(charName)) {
          characterMap.set(charName, {
            name: charName,
            lines: 0,
            scenes: [],
            dialogue: [],
          });
        }
        
        const char = characterMap.get(charName);
        if (!char.scenes.includes(sceneIndex)) {
          char.scenes.push(sceneIndex);
        }
      });
      
      scene.dialogue.forEach(d => {
        if (characterMap.has(d.character)) {
          const char = characterMap.get(d.character);
          char.lines += 1;
          char.dialogue.push(d.text);
        }
      });
    });
    
    return Array.from(characterMap.values()).map(char => ({
      name: char.name,
      lines: char.lines,
      scenes: char.scenes.length,
      sceneIds: char.scenes.map(String),
      dialogue: char.dialogue,
    }));
  }

  generateMetadata(textPages, scenes, characters) {
    const uniqueLocations = [...new Set(scenes.map(s => s.location).filter(Boolean))];
    const uniqueTimes = [...new Set(scenes.map(s => s.timeOfDay).filter(Boolean))];
    
    return {
      totalPages: textPages.length,
      scenes: scenes.length,
      characters: characters.length,
      locations: uniqueLocations.length,
      locationList: uniqueLocations,
      timePeriods: uniqueTimes.length,
      timeList: uniqueTimes,
      totalDialogue: scenes.reduce((sum, s) => sum + s.dialogue.length, 0),
      totalActions: scenes.reduce((sum, s) => s.actions.length, 0),
    };
  }
}

module.exports = new AdvancedScriptParser();
