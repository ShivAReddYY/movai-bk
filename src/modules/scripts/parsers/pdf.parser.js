const fs = require('fs').promises;
const { PDFParse } = require('pdf-parse');

class PDFScriptParser {
  async parse(filePath) {
    try {
      console.log('📄 Parsing PDF:', filePath);
      
      const buffer = await fs.readFile(filePath);
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      await parser.destroy();
      
      const text = result.text;
      
      if (text && text.length > 100) {
        console.log(`✅ PDF parsed! Pages: ${result.total}, Text length: ${text.length} chars`);
        
        const parsed = this.parseScript(text, result.total);
        
        return {
          metadata: {
            pages: result.total,
            totalLines: parsed.metadata.textLength,
            ...parsed.metadata,
          },
          scenes: parsed.scenes.map((scene, index) => ({
            sceneNumber: index + 1,
            page: scene.page,
            heading: scene.originalHeading,
            location: scene.location || 'Unknown',
            intExt: scene.intExt || 'INT',
            timeOfDay: scene.time || 'DAY',
            summary: scene.summary || '',
            text: scene.sceneText || '',
            actors: scene.actors || [],
            props: scene.props || [],
            actions: scene.action || [],
          })),
          characters: parsed.characters,
        };
      }
    } catch (error) {
      console.error('❌ PDF parsing error:', error.message);
    }
    
    return this.basicParse(filePath);
  }

  async basicParse(filePath) {
    console.log('⚠️ Using basic PDF parsing (fallback)');
    return {
      metadata: { pages: 1, totalLines: 0 },
      scenes: [{
        sceneNumber: 1,
        heading: 'INT. SCENE - DAY',
        intExt: 'INT',
        location: 'Unknown Location',
        timeOfDay: 'DAY',
        text: 'PDF parsing failed - check backend logs',
        actors: [],
        props: [],
        page: 1,
      }],
      characters: [],
    };
  }

  parseScript(scriptText, totalPages = 1) {
    try {
      const cleanedText = this.cleanScriptText(scriptText);
      const lines = cleanedText.split('\n').filter(line => line.trim());
      const scenes = this.parseScenes(lines, totalPages);
      const characters = this.parseCharacters(scenes);
      const metadata = this.generateMetadata(scenes, characters, totalPages);
      
      return { scenes, characters, metadata };
    } catch (error) {
      console.error('Error parsing script:', error);
      return { scenes: [], characters: [], metadata: {} };
    }
  }

  cleanScriptText(text) {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\t/g, '    ')
      .replace(/\f/g, '\n')
      .replace(/\s+\n/g, '\n')
      // Fix UTF-8 encoding issues
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

  parseScenes(lines, totalPages) {
    const scenes = [];
    let currentScene = null;
    let currentSceneLines = [];
    let currentPage = 1;
    let linesPerPage = Math.ceil(lines.length / totalPages);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      currentPage = Math.min(Math.ceil((i + 1) / linesPerPage), totalPages);

      if (this.isPageNumber(line) || this.isPageFooter(line)) {
        continue;
      }

      if (this.isSceneHeading(line)) {
        if (currentScene) {
          currentScene.sceneText = currentSceneLines.join('\n');
          currentScene.summary = this.generateSceneSummary(currentScene);
          currentScene.props = this.extractProps(currentSceneLines);
          scenes.push(currentScene);
        }

        const sceneData = this.parseSceneHeading(line);
        
        currentScene = {
          page: currentPage,
          originalHeading: line,
          intExt: sceneData.intExt,
          location: sceneData.location,
          time: sceneData.time,
          summary: '',
          sceneText: '',
          actors: [],
          action: [],
          dialogue: [],
          charactersInScene: new Set(),
          characterStats: {},
          props: [],
        };
        
        currentSceneLines = [line];
      } else if (currentScene && this.isCharacterName(line, lines, i)) {
        const characterName = this.cleanCharacterName(line);
        currentScene.charactersInScene.add(characterName);
        
        if (!currentScene.actors.includes(characterName)) {
          currentScene.actors.push(characterName);
        }
        
        currentSceneLines.push(line);
        
        let dialogueLines = [];
        let j = i + 1;
        
        while (j < lines.length) {
          const nextLine = lines[j].trim();
          
          if (!nextLine) {
            j++;
            continue;
          }
          
          // Stop at next character name
          if (this.isCharacterName(nextLine, lines, j) || 
              this.isSceneHeading(nextLine) || 
              this.isPageNumber(nextLine) ||
              this.isPageFooter(nextLine) ||
              this.isTransition(nextLine)) {
            break;
          }
          
          if (this.isParenthetical(nextLine)) {
            currentSceneLines.push(nextLine);
            j++;
            continue;
          }
          
          // Stop if next line looks like action
          if (this.isLikelyActionLine(nextLine)) {
            break;
          }
          
          dialogueLines.push(nextLine);
          currentSceneLines.push(nextLine);
          j++;
        }
        
        if (dialogueLines.length > 0) {
          const fullDialogue = dialogueLines.join(' ');
          
          currentScene.dialogue.push({
            character: characterName,
            text: fullDialogue,
            lines: dialogueLines
          });
          
          if (!currentScene.characterStats[characterName]) {
            currentScene.characterStats[characterName] = {
              lineCount: 0,
              dialogues: []
            };
          }
          currentScene.characterStats[characterName].lineCount += dialogueLines.length;
          currentScene.characterStats[characterName].dialogues.push(fullDialogue);
        }
        
        i = j - 1;
      } else if (currentScene) {
        // Only add valid action lines (not character names)
        if (!this.isTransition(line) && 
            !this.isPageFooter(line) && 
            !this.isPageNumber(line) &&
            !this.looksLikeCharacterName(line)) {
          currentScene.action.push(line);
        }
        currentSceneLines.push(line);
      }
    }

    if (currentScene) {
      currentScene.sceneText = currentSceneLines.join('\n');
      currentScene.summary = this.generateSceneSummary(currentScene);
      currentScene.props = this.extractProps(currentSceneLines);
      scenes.push(currentScene);
    }

    scenes.forEach(scene => {
      scene.charactersInScene = Array.from(scene.charactersInScene);
    });

    return scenes;
  }

  isSceneHeading(line) {
    const pattern1 = /^(INT\.?|EXT\.?|INT\/EXT\.?)\s+.+\s*[-–—]\s*(DAY|NIGHT|LATER|MORNING|EVENING|DAWN|DUSK|CONTINUOUS|SAME TIME|MOMENTS LATER)/i;
    const pattern2 = /^(INT\.?|EXT\.?|INT\/EXT\.?)\s+.+\.\s*(DAY|NIGHT|LATER|MORNING|EVENING|DAWN|DUSK|CONTINUOUS|SAME TIME|MOMENTS LATER)/i;
    const pattern3 = /^(INT\.?|EXT\.?|INT\/EXT\.?)\s+[A-Z\s]{3,}/i;
    
    return pattern1.test(line) || pattern2.test(line) || pattern3.test(line);
  }

  parseSceneHeading(heading) {
    let intExt = 'INT';
    let location = 'Unknown';
    let time = 'DAY';

    const pattern1 = /^(INT\.?|EXT\.?|INT\/EXT\.?)\s+(.+?)\s*[-–—]\s*(DAY|NIGHT|LATER|MORNING|EVENING|DAWN|DUSK|CONTINUOUS|SAME TIME|MOMENTS LATER)/i;
    const match1 = heading.match(pattern1);
    
    if (match1) {
      intExt = match1[1].replace('.', '').toUpperCase();
      location = match1[2].trim();
      time = match1[3].toUpperCase();
    } else {
      const pattern2 = /^(INT\.?|EXT\.?|INT\/EXT\.?)\s+(.+?)\.\s*(DAY|NIGHT|LATER|MORNING|EVENING|DAWN|DUSK|CONTINUOUS|SAME TIME|MOMENTS LATER)/i;
      const match2 = heading.match(pattern2);
      
      if (match2) {
        intExt = match2[1].replace('.', '').toUpperCase();
        location = match2[2].trim();
        time = match2[3].toUpperCase();
      } else {
        const pattern3 = /^(INT\.?|EXT\.?|INT\/EXT\.?)\s+(.+)/i;
        const match3 = heading.match(pattern3);
        
        if (match3) {
          intExt = match3[1].replace('.', '').toUpperCase();
          location = match3[2].trim();
        }
      }
    }

    return { intExt, location, time };
  }

  cleanCharacterName(line) {
    return line
      .replace(/\([^)]*\)/g, '')
      .replace(/\s+/g, ' ')
      .replace(/â€™/g, "'")
      .trim();
  }

/**
 * IMPROVED: Better character name detection for multilingual scripts
 */
isCharacterName(line, allLines, currentIndex) {
  // Skip obvious non-characters
  if (this.isPageFooter(line) || this.isPageNumber(line)) return false;
  if (this.isSceneHeading(line) || this.isTransition(line)) return false;
  
  // Trim and basic checks
  const trimmed = line.trim();
  if (trimmed.length < 2 || trimmed.length > 50) return false;
  
  // Remove parenthetical for testing
  const withoutParens = trimmed.replace(/\([^)]*\)/g, '').trim();
  if (!withoutParens || withoutParens.length < 2) return false;
  
  // Must have at least one letter
  if (!/[A-Z]/.test(withoutParens)) return false;
  
  // Check for script enders
  const scriptEnders = ['THE END', 'CONTINUED', 'TO BE CONTINUED', 'FADE OUT', 'FADE IN'];
  if (scriptEnders.some(ender => trimmed.toUpperCase().includes(ender))) {
    return false;
  }
  
  // FIXED: More flexible pattern for character names
  // Allows: "JJ", "JJ' MOM", "JJ' DAD", "CHEF", etc.
  const characterPattern = /^[A-Z][A-Z\s'.-]*[A-Z]$|^[A-Z]$/;
  if (!characterPattern.test(withoutParens)) return false;
  
  // Periods only allowed for initials (J.J.)
  if (withoutParens.includes('.') && !/^[A-Z]\.[A-Z]\.?/.test(withoutParens)) {
    return false;
  }
  
  // Check next line exists and is not empty
  const nextLineIndex = currentIndex + 1;
  if (nextLineIndex >= allLines.length) return false;
  
  const nextLine = allLines[nextLineIndex].trim();
  if (!nextLine) return false;
  
  // If next line is also a potential character name, current line might be action
  if (this.looksLikeCharacterName(nextLine)) {
    return false;
  }
  
  // Next line should not be a scene heading
  if (this.isSceneHeading(nextLine)) return false;
  
  return true;
}

/**
 * IMPROVED: Better action line detection (less aggressive)
 */
isLikelyActionLine(line) {
  const trimmed = line.trim();
  
  // Check if it matches character name pattern first
  if (this.looksLikeCharacterName(trimmed)) {
    return false;
  }
  
  const isAllCaps = /^[A-Z\s'.-]+$/.test(trimmed);
  const startsWithCap = /^[A-Z]/.test(trimmed);
  const hasLowercase = /[a-z]/.test(trimmed);
  
  // All caps and VERY long (60+ chars) = action
  if (isAllCaps && trimmed.length > 60) {
    return true;
  }
  
  // Sentence case and long (40+ chars) = action
  if (startsWithCap && hasLowercase && trimmed.length > 40) {
    return true;
  }
  
  return false;
}

/**
 * IMPROVED: Simple character name pattern check
 */
looksLikeCharacterName(line) {
  const trimmed = line.trim();
  
  // Basic length check
  if (trimmed.length < 2 || trimmed.length > 50) return false;
  
  // Remove parenthetical
  const withoutParens = trimmed.replace(/\([^)]*\)/g, '').trim();
  if (!withoutParens) return false;
  
  // Must have at least one letter
  if (!/[A-Z]/.test(withoutParens)) return false;
  
  // Character name pattern: all caps with spaces, apostrophes, hyphens
  const characterPattern = /^[A-Z][A-Z\s'.-]*[A-Z]$|^[A-Z]$/;
  if (!characterPattern.test(withoutParens)) return false;
  
  // Periods only for initials
  if (withoutParens.includes('.') && !/^[A-Z]\.[A-Z]\.?/.test(withoutParens)) {
    return false;
  }
  
  // Not a scene heading or transition
  if (this.isSceneHeading(trimmed) || this.isTransition(trimmed)) {
    return false;
  }
  
  return true;
}

  isParenthetical(line) {
    return line.startsWith('(') && line.endsWith(')');
  }

  isLikelyActionLine(line) {
    const isAllCaps = /^[A-Z\s]+$/.test(line);
    const startsWithCap = /^[A-Z]/.test(line);
    const hasLowercase = /[a-z]/.test(line);
    
    // If all caps and long, it's likely action description
    if (isAllCaps && line.length > 25) {
      return true;
    }
    
    // If starts with cap and has lowercase, likely action
    if (startsWithCap && hasLowercase && line.length > 15) {
      return true;
    }
    
    return false;
  }

  isPageNumber(line) {
    return /^\d{1,3}\.?$/.test(line);
  }

  isPageFooter(line) {
    return /^-*\s*\d+\s+of\s+\d+\s*-*$/.test(line) || /^Page\s+\d+$/i.test(line);
  }

  isTransition(line) {
    const transitions = [
      'FADE OUT', 'FADE IN', 'CUT TO', 'DISSOLVE TO', 'SMASH CUT TO',
      'MATCH CUT TO', 'JUMP CUT TO', 'WIPE TO', 'IRIS OUT', 'IRIS IN', 'THE END'
    ];
    return transitions.some(t => line.toUpperCase().includes(t));
  }

  generateSceneSummary(scene) {
    const actionText = scene.action.join(' ');
    const dialogueText = scene.dialogue
      .map(d => `${d.character}: ${d.text}`)
      .join(' ');
    
    const summary = `${actionText} ${dialogueText}`.trim();
    return summary || 'No summary available';
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
        if (lowerLine.includes(prop)) {
          props.add(prop.charAt(0).toUpperCase() + prop.slice(1));
        }
      });
    });
    
    return Array.from(props);
  }

  parseCharacters(scenes) {
    const characterMap = {};

    scenes.forEach((scene, sceneIndex) => {
      // FIXED: First, add ALL actors (even without dialogue)
      scene.actors.forEach(actorName => {
        if (!characterMap[actorName]) {
          characterMap[actorName] = {
            name: actorName,
            lines: 0,
            scenes: 0,
            dialogue: [],
            sceneIds: []
          };
        }
        // Mark as appearing in this scene (avoid duplicates)
        if (!characterMap[actorName].sceneIds.includes(sceneIndex.toString())) {
          characterMap[actorName].sceneIds.push(sceneIndex.toString());
          characterMap[actorName].scenes += 1;
        }
      });

      // Then add dialogue stats for characters who spoke
      if (scene.characterStats) {
        Object.entries(scene.characterStats).forEach(([name, stats]) => {
          if (!characterMap[name]) {
            characterMap[name] = {
              name,
              lines: 0,
              scenes: 0,
              dialogue: [],
              sceneIds: []
            };
          }
          
          characterMap[name].lines += stats.lineCount;
          characterMap[name].dialogue.push(...stats.dialogues);
        });
      }
    });

    return Object.values(characterMap).map(char => ({
      name: char.name,
      lines: char.lines,
      scenes: char.scenes,
      dialogue: char.dialogue,
      sceneIds: char.sceneIds
    }));
  }


  generateMetadata(scenes, characters, totalPages) {
    const uniqueLocations = [...new Set(scenes.map(s => s.location).filter(Boolean))];
    const uniqueTimes = [...new Set(scenes.map(s => s.time).filter(Boolean))];
    
    return {
      scenes: scenes.length,
      characters: characters.length,
      pages: totalPages,
      locations: uniqueLocations.length,
      timePeriods: uniqueTimes.length,
      totalDialogue: scenes.reduce((sum, s) => sum + s.dialogue.length, 0),
      totalActions: scenes.reduce((sum, s) => sum + s.action.length, 0),
      textLength: scenes.reduce((sum, s) => sum + s.sceneText.length, 0),
    };
  }

}

module.exports = new PDFScriptParser();
