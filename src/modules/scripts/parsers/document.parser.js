const fs = require('fs').promises;
const { PDFParse } = require('pdf-parse');

class DocumentBasedScriptParser {
  async parse(filePath) {
    try {
      console.log('📄 Parsing PDF:', filePath);
      
      const buffer = await fs.readFile(filePath);
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      await parser.destroy();
      
      const text = result.text;
      const totalPages = result.total;
      
      console.log(`✅ PDF loaded: ${totalPages} pages, ${text.length} chars`);
      
      // ✅ NEW: Extract pages as PURE TEXT (preserving all formatting)
      const textPages = this.extractTextPages(text, totalPages);
      
      console.log(`📖 Extracted ${textPages.length} text pages`);
      
      // ✅ Analyze from text pages
      const scenes = this.analyzeScenes(textPages);
      const characters = this.extractCharacters(scenes);
      const metadata = this.generateMetadata(textPages, scenes, characters);
      
      console.log(`✅ Analyzed: ${scenes.length} scenes, ${characters.length} characters`);
      
      return {
        textPages,      // ✅ NEW: Raw text pages for editor
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
   * ✅ NEW: Extract text pages preserving ALL formatting
   * Each page is stored as RAW TEXT exactly as PDF shows
   */
  extractTextPages(text, totalPages) {
    // Split by form feed (PDF page breaks)
    let pages = text.split('\f');
    
    // If form feed worked, use it
    if (pages.length > 1 && pages.length <= totalPages * 1.5) {
      console.log('✅ Using PDF form feed page breaks');
      return pages
        .filter(p => p.trim())
        .map((pageText, index) => ({
          pageNumber: index + 1,
          rawText: this.cleanScriptText(pageText), // Preserve ALL formatting
          lineCount: pageText.split('\n').length,
        }));
    }
    
    // Fallback: Estimate by lines
    console.log('⚠️ Estimating page breaks by line count');
    const allLines = text.split('\n');
    const linesPerPage = Math.ceil(allLines.length / totalPages);
    
    const textPages = [];
    for (let i = 0; i < totalPages; i++) {
      const start = i * linesPerPage;
      const end = start + linesPerPage;
      const pageLines = allLines.slice(start, end);
      
      textPages.push({
        pageNumber: i + 1,
        rawText: this.cleanScriptText(pageLines.join('\n')),
        lineCount: pageLines.length,
      });
    }
    
    return textPages;
  }

  /**
   * ✅ IMPROVED: Clean text but PRESERVE spacing and line breaks
   */
  cleanScriptText(text) {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // ✅ KEEP tabs (don't convert to spaces)
      .replace(/\t/g, '\t')
      // ✅ Fix encoding ONLY
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
      .replace(/piÃ¹/g, 'più');
    // ✅ DON'T trim() - preserve spacing!
  }

  /**
   * ✅ Analyze scenes from text pages
   */
  analyzeScenes(textPages) {
    const scenes = [];
    let currentScene = null;
    let sceneLines = [];
    let sceneNumber = 1;
    
    textPages.forEach((page) => {
      const lines = page.rawText.split('\n');
      
      lines.forEach((line, lineIndex) => {
        const trimmed = line.trim();
        if (!trimmed || this.isPageNumber(trimmed) || this.isPageFooter(trimmed)) return;
        
        // Scene heading detected
        if (this.isSceneHeading(trimmed)) {
          // Save previous scene
          if (currentScene) {
            currentScene.text = sceneLines.join('\n');
            currentScene.summary = this.generateSceneSummary(currentScene);
            scenes.push(currentScene);
          }
          
          const sceneData = this.parseSceneHeading(trimmed);
          
          currentScene = {
            sceneNumber: sceneNumber++,
            pageNumber: page.pageNumber,
            heading: trimmed,
            location: sceneData.location,
            intExt: sceneData.intExt,
            timeOfDay: sceneData.time,
            dialogue: [],
            actions: [],
            actors: [],
            props: [],
          };
          
          sceneLines = [trimmed];
          return;
        }
        
        if (currentScene) {
          sceneLines.push(line); // ✅ Keep original spacing
          
          // Character detection
          if (this.isCharacterName(trimmed, lines, lineIndex)) {
            const characterName = this.cleanCharacterName(trimmed);
            if (!currentScene.actors.includes(characterName)) {
              currentScene.actors.push(characterName);
            }
            
            // Collect dialogue
            let dialogueText = '';
            for (let j = lineIndex + 1; j < lines.length; j++) {
              const nextLine = lines[j].trim();
              if (!nextLine) continue;
              if (this.isCharacterName(nextLine, lines, j) || this.isSceneHeading(nextLine)) break;
              dialogueText += nextLine + ' ';
            }
            
            if (dialogueText.trim()) {
              currentScene.dialogue.push({
                character: characterName,
                text: dialogueText.trim(),
              });
            }
          }
          
          // Action detection
          if (!this.isCharacterName(trimmed, lines, lineIndex) && 
              !this.isTransition(trimmed) && 
              !this.isParenthetical(trimmed)) {
            currentScene.actions.push(trimmed);
          }
          
          // Props extraction
          this.extractPropsFromLine(trimmed).forEach(prop => {
            if (!currentScene.props.includes(prop)) {
              currentScene.props.push(prop);
            }
          });
        }
      });
    });
    
    // Save last scene
    if (currentScene) {
      currentScene.text = sceneLines.join('\n');
      currentScene.summary = this.generateSceneSummary(currentScene);
      scenes.push(currentScene);
    }
    
    return scenes;
  }

  // ... (keep all helper methods: isSceneHeading, isCharacterName, etc.)
  
  isSceneHeading(line) {
    const pattern1 = /^(INT\.?|EXT\.?|INT\/EXT\.?|I\/E\.?)\s+.+\s*[-–—]\s*(DAY|NIGHT|LATER|MORNING|EVENING|DAWN|DUSK|CONTINUOUS|SAME TIME|MOMENTS LATER)/i;
    const pattern2 = /^(INT\.?|EXT\.?|INT\/EXT\.?|I\/E\.?)\s+.+\.\s*(DAY|NIGHT|LATER|MORNING|EVENING|DAWN|DUSK|CONTINUOUS|SAME TIME|MOMENTS LATER)/i;
    const pattern3 = /^(INT\.?|EXT\.?|INT\/EXT\.?|I\/E\.?)\s+[A-Z\s']{3,}/i;
    return pattern1.test(line) || pattern2.test(line) || pattern3.test(line);
  }

  parseSceneHeading(heading) {
    let intExt = 'INT', location = 'Unknown', time = 'DAY';
    const pattern1 = /^(INT\.?|EXT\.?|INT\/EXT\.?|I\/E\.?)\s+(.+?)\s*[-–—]\s*(DAY|NIGHT|LATER|MORNING|EVENING|DAWN|DUSK|CONTINUOUS|SAME TIME|MOMENTS LATER)/i;
    const match1 = heading.match(pattern1);
    
    if (match1) {
      intExt = match1[1].replace('.', '').toUpperCase();
      location = match1[2].trim();
      time = match1[3].toUpperCase();
    }
    return { intExt, location, time };
  }

  isCharacterName(line, allLines, currentIndex) {
    const trimmed = line.trim();
    if (trimmed.length < 2 || trimmed.length > 50) return false;
    if (this.isSceneHeading(trimmed) || this.isTransition(trimmed)) return false;
    
    const withoutParens = trimmed.replace(/\([^)]*\)/g, '').trim();
    if (!withoutParens || !/[A-Z]/.test(withoutParens)) return false;
    
    const characterPattern = /^[A-Z][A-Z\s'.-]*$/;
    if (!characterPattern.test(withoutParens)) return false;
    
    const nextLineIndex = currentIndex + 1;
    if (nextLineIndex >= allLines.length) return false;
    const nextLine = allLines[nextLineIndex].trim();
    if (!nextLine || this.isSceneHeading(nextLine)) return false;
    
    return true;
  }

  isTransition(line) {
    const transitions = ['FADE OUT', 'FADE IN', 'CUT TO', 'DISSOLVE TO', 'THE END', 'CONTINUED'];
    return transitions.some(t => line.toUpperCase().includes(t));
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

  cleanCharacterName(line) {
    return line.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
  }

  extractPropsFromLine(line) {
    const props = [];
    const propKeywords = ['glasses', 'phone', 'bottle', 'gun', 'knife', 'car', 'computer'];
    propKeywords.forEach(prop => {
      if (new RegExp(`\\b${prop}\\b`, 'i').test(line)) {
        props.push(prop.charAt(0).toUpperCase() + prop.slice(1));
      }
    });
    return props;
  }

  generateSceneSummary(scene) {
    const actionText = scene.actions.slice(0, 3).join(' ');
    const dialogueText = scene.dialogue.slice(0, 2).map(d => `${d.character}: ${d.text.substring(0, 50)}...`).join(' ');
    return `${actionText} ${dialogueText}`.trim() || 'No summary available';
  }

  extractCharacters(scenes) {
    const characterMap = new Map();
    scenes.forEach((scene, sceneIndex) => {
      scene.actors.forEach(charName => {
        if (!characterMap.has(charName)) {
          characterMap.set(charName, { name: charName, lines: 0, scenes: [], dialogue: [] });
        }
        const char = characterMap.get(charName);
        if (!char.scenes.includes(sceneIndex)) char.scenes.push(sceneIndex);
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
    return {
      totalPages: textPages.length,
      scenes: scenes.length,
      characters: characters.length,
      totalDialogue: scenes.reduce((sum, s) => sum + s.dialogue.length, 0),
      totalActions: scenes.reduce((sum, s) => sum + s.actions.length, 0),
    };
  }
}

module.exports = new DocumentBasedScriptParser();
