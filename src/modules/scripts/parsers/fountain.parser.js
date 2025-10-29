const fs = require('fs').promises;
const fountain = require('fountain-js');

class FountainParser {
  async parse(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = fountain.parse(content, true);

      const scenes = this.extractScenes(parsed.tokens);
      const characters = this.extractCharacters(parsed.tokens);

      return {
        metadata: {
          title: parsed.title || 'Untitled',
          author: parsed.author,
          source: parsed.source,
        },
        scenes,
        characters,
      };
    } catch (error) {
      console.error('Fountain parsing error:', error);
      throw new Error('Failed to parse Fountain file');
    }
  }

  extractScenes(tokens) {
    const scenes = [];
    let currentScene = null;
    let sceneNumber = 0;

    tokens.forEach((token, index) => {
      if (token.type === 'scene_heading') {
        // Save previous scene
        if (currentScene) {
          scenes.push(currentScene);
        }

        // Parse scene heading
        sceneNumber++;
        const heading = token.text;
        const match = heading.match(/^(INT|EXT|INT\/EXT)[\.\s]+(.+?)[\s\-]+(DAY|NIGHT|DAWN|DUSK|MORNING|AFTERNOON|EVENING|CONTINUOUS|LATER)?/i);

        let intExt = 'INT';
        let location = heading;
        let timeOfDay = 'DAY';

        if (match) {
          intExt = match[1].toUpperCase();
          location = match[2].trim();
          timeOfDay = match[3] ? match[3].toUpperCase() : 'DAY';
        }

        currentScene = {
          sceneNumber,
          heading,
          intExt,
          location,
          timeOfDay,
          text: '',
          actors: [],
          props: [],
        };
      } else if (currentScene) {
        // Add to current scene
        if (token.type === 'dialogue') {
          currentScene.text += `${token.text}\n`;
        } else if (token.type === 'action') {
          currentScene.text += `${token.text}\n`;
        } else if (token.type === 'character') {
          const characterName = token.text.trim();
          if (!currentScene.actors.includes(characterName)) {
            currentScene.actors.push(characterName);
          }
        }
      }
    });

    // Add last scene
    if (currentScene) {
      scenes.push(currentScene);
    }

    return scenes;
  }

  extractCharacters(tokens) {
    const characterMap = new Map();

    tokens.forEach(token => {
      if (token.type === 'character') {
        const name = token.text.trim();
        
        if (!characterMap.has(name)) {
          characterMap.set(name, {
            name,
            lines: 0,
            scenes: 0,
            dialogue: [],
          });
        }
      } else if (token.type === 'dialogue') {
        // Find last character
        const chars = Array.from(characterMap.keys());
        if (chars.length > 0) {
          const lastChar = characterMap.get(chars[chars.length - 1]);
          lastChar.lines++;
          lastChar.dialogue.push(token.text);
        }
      }
    });

    return Array.from(characterMap.values());
  }
}

module.exports = new FountainParser();
