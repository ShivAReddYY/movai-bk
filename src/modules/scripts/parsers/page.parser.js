const fs = require('fs').promises;
const { PDFParse } = require('pdf-parse');

class HybridScriptParser {
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
      
      // Clean text
      const cleanedText = this.cleanScriptText(text);
      
      // ✅ IMPROVED: Smart page detection
      const pages = this.extractPages(cleanedText, totalPages);
      
      console.log(`📖 Extracted ${pages.length} pages`);
      
      // ✅ Parse scenes ACROSS pages (not per-page)
      const scenes = this.parseScenes(pages);
      const characters = this.extractCharacters(scenes);
      const metadata = this.generateMetadata(pages, scenes, characters);
      
      console.log(`✅ Parsed: ${scenes.length} scenes, ${characters.length} characters`);
      
      return {
        pages,
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
   * ✅ IMPROVED: Smart page extraction (hybrid approach)
   */
  extractPages(text, totalPages) {
    // Try form feed split first
    const formFeedPages = text.split('\f').filter(t => t.trim());
    
    // Use form feed if reasonable
    if (formFeedPages.length > 1 && formFeedPages.length <= totalPages * 1.5) {
      console.log('✅ Using form feed page breaks');
      return formFeedPages.map((content, index) => ({
        pageNumber: index + 1,
        rawText: content.trim(),
        formatted: this.analyzePageLines(content.trim()),
      }));
    }
    
    // Fallback: Estimate by lines
    console.log('⚠️ Using estimated page breaks');
    const lines = text.split('\n');
    const linesPerPage = Math.ceil(lines.length / totalPages);
    
    const pages = [];
    for (let i = 0; i < totalPages; i++) {
      const start = i * linesPerPage;
      const end = start + linesPerPage;
      const pageLines = lines.slice(start, end);
      const content = pageLines.join('\n').trim();
      
      pages.push({
        pageNumber: i + 1,
        rawText: content,
        formatted: this.analyzePageLines(content),
      });
    }
    
    return pages;
  }

  /**
   * Analyze page lines for frontend editor
   */
  analyzePageLines(pageText) {
    const lines = pageText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !this.isPageNumber(l) && !this.isPageFooter(l));
    
    return lines.map((line, index) => ({
      index,
      type: this.detectLineType(line, lines, index),
      text: line,
    }));
  }

  detectLineType(line, allLines, currentIndex) {
    if (this.isSceneHeading(line)) return 'scene_heading';
    if (this.isTransition(line)) return 'transition';
    if (this.isParenthetical(line)) return 'parenthetical';
    if (this.isCharacterName(line, allLines, currentIndex)) return 'character';
    return 'dialogue_or_action';
  }

  /**
   * ✅ IMPROVED: Parse scenes ACROSS pages (like PDF parser)
   */
  parseScenes(pages) {
    const scenes = [];
    let currentScene = null;
    let currentCharacter = null;
    let sceneLines = [];
    
    // Flatten all pages into single line stream with page markers
    const allLines = [];
    pages.forEach(page => {
      const lines = page.rawText.split('\n').map(l => l.trim()).filter(Boolean);
      lines.forEach(line => {
        allLines.push({
          text: line,
          pageNumber: page.pageNumber,
        });
      });
    });
    
    // Parse line by line
    for (let i = 0; i < allLines.length; i++) {
      const lineObj = allLines[i];
      const line = lineObj.text;
      
      if (this.isPageNumber(line) || this.isPageFooter(line)) continue;
      
      if (this.isSceneHeading(line)) {
        // Save previous scene
        if (currentScene) {
          currentScene.fullText = sceneLines.join('\n');
          currentScene.summary = this.generateSceneSummary(currentScene);
          currentScene.props = this.extractProps(sceneLines);
          scenes.push(currentScene);
        }
        
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
        currentCharacter = null;
        continue;
      }
      
      if (!currentScene) continue;
      
      sceneLines.push(line);
      
      // Character name
      if (this.isCharacterName(line, allLines, i)) {
        const characterName = this.cleanCharacterName(line);
        currentCharacter = characterName;
        currentScene.charactersInScene.add(characterName);
        
        if (!currentScene.actors.includes(characterName)) {
          currentScene.actors.push(characterName);
        }
        
        // Collect dialogue
        let dialogueLines = [];
        let j = i + 1;
        
        while (j < allLines.length) {
          const nextLine = allLines[j].text.trim();
          if (!nextLine) {
            j++;
            continue;
          }
          
          if (this.isCharacterName(nextLine, allLines, j) || 
              this.isSceneHeading(nextLine) || 
              this.isTransition(nextLine) ||
              this.isPageNumber(nextLine) ||
              this.isPageFooter(nextLine)) {
            break;
          }
          
          if (this.isParenthetical(nextLine)) {
            sceneLines.push(nextLine);
            j++;
            continue;
          }
          
          if (this.isLikelyActionLine(nextLine)) break;
          
          dialogueLines.push(nextLine);
          sceneLines.push(nextLine);
          j++;
        }
        
        if (dialogueLines.length > 0) {
          currentScene.dialogue.push({
            character: characterName,
            text: dialogueLines.join(' '),
          });
        }
        
        i = j - 1;
        continue;
      }
      
      // Action line
      if (!this.isTransition(line) && !this.looksLikeCharacterName(line)) {
        currentScene.actions.push(line);
      }
    }
    
    // Save last scene
    if (currentScene) {
      currentScene.fullText = sceneLines.join('\n');
      currentScene.summary = this.generateSceneSummary(currentScene);
      currentScene.props = this.extractProps(sceneLines);
      scenes.push(currentScene);
    }
    
    scenes.forEach(scene => {
      scene.charactersInScene = Array.from(scene.charactersInScene);
    });
    
    return scenes;
  }

  /**
   * ✅ IMPROVED: Better character detection
   */
  isCharacterName(line, allLines, currentIndex) {
    const trimmed = typeof line === 'string' ? line.trim() : line.text?.trim();
    if (!trimmed) return false;
    
    if (trimmed.length < 2 || trimmed.length > 50) return false;
    if (this.isPageNumber(trimmed) || this.isPageFooter(trimmed)) return false;
    if (this.isSceneHeading(trimmed) || this.isTransition(trimmed)) return false;
    
    const withoutParens = trimmed.replace(/\([^)]*\)/g, '').trim();
    if (!withoutParens || withoutParens.length < 2) return false;
    if (!/[A-Z]/.test(withoutParens)) return false;
    
    // ✅ Support apostrophes like "JJ' DAD"
    const characterPattern = /^[A-Z][A-Z\s'.-]*$/;
    if (!characterPattern.test(withoutParens)) return false;
    
    if (withoutParens.includes('.') && !/^[A-Z]\.[A-Z]\.?/.test(withoutParens)) {
      return false;
    }
    
    const nextLineIndex = currentIndex + 1;
    if (nextLineIndex >= allLines.length) return false;
    
    const nextLine = allLines[nextLineIndex];
    const nextText = typeof nextLine === 'string' ? nextLine.trim() : nextLine.text?.trim();
    if (!nextText) return false;
    
    if (this.looksLikeCharacterName(nextText)) return false;
    if (this.isSceneHeading(nextText)) return false;
    
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
    } else {
      const pattern2 = /^(INT\.?|EXT\.?|INT\/EXT\.?|I\/E\.?)\s+(.+?)\.\s*(DAY|NIGHT|LATER|MORNING|EVENING|DAWN|DUSK|CONTINUOUS|SAME TIME|MOMENTS LATER)/i;
      const match2 = heading.match(pattern2);
      
      if (match2) {
        intExt = match2[1].replace('.', '').toUpperCase();
        location = match2[2].trim();
        time = match2[3].toUpperCase();
      } else {
        const pattern3 = /^(INT\.?|EXT\.?|INT\/EXT\.?|I\/E\.?)\s+(.+)/i;
        const match3 = heading.match(pattern3);
        
        if (match3) {
          intExt = match3[1].replace('.', '').toUpperCase();
          location = match3[2].trim();
        }
      }
    }

    return { intExt, location, time };
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
      'THE END', 'CONTINUED'
    ];
    return transitions.some(t => line.toUpperCase().includes(t));
  }

  extractProps(lines) {
    const props = new Set();
    const propKeywords = [
      'glasses', 'phone', 'bottle', 'gun', 'knife', 'car', 'train', 'computer', 
      'scanner', 'qr', 'kiosk', 'robot', 'tray', 'lift', 'elevator', 'apron', 
      'luggage', 'locker', 'juice', 'beer', 'metro', 'sofa', 'camera', 'dress',
      'frame', 'machine', 'caviar', 'vending', 'jet', 'airhostess'
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

  generateMetadata(pages, scenes, characters) {
    const uniqueLocations = [...new Set(scenes.map(s => s.location).filter(Boolean))];
    const uniqueTimes = [...new Set(scenes.map(s => s.timeOfDay).filter(Boolean))];
    
    return {
      totalPages: pages.length,
      scenes: scenes.length,
      characters: characters.length,
      locations: uniqueLocations.length,
      timePeriods: uniqueTimes.length,
      totalDialogue: scenes.reduce((sum, s) => sum + s.dialogue.length, 0),
      totalActions: scenes.reduce((sum, s) => sum + s.actions.length, 0),
      needsReview: true,
    };
  }
}

module.exports = new HybridScriptParser();
