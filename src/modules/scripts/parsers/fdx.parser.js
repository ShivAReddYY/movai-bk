const fs = require('fs').promises;
const xml2js = require('xml2js');

class FDXParser {
  async parse(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parser = new xml2js.Parser();
      const result = await parser.parseStringPromise(content);

      const fdx = result.FinalDraft;
      const content_data = fdx.Content[0];
      const paragraphs = content_data.Paragraph || [];

      const scenes = this.extractScenes(paragraphs);
      const characters = this.extractCharacters(paragraphs);

      return {
        metadata: {
          title: fdx.DocumentType?.[0] || 'Untitled',
        },
        scenes,
        characters,
      };
    } catch (error) {
      console.error('FDX parsing error:', error);
      throw new Error('Failed to parse FDX file');
    }
  }

  extractScenes(paragraphs) {
    const scenes = [];
    let currentScene = null;
    let sceneNumber = 0;

    paragraphs.forEach(para => {
      const type = para.$.Type;
      const text = para.Text ? para.Text.join(' ').trim() : '';

      if (type === 'Scene Heading') {
        // Save previous scene
        if (currentScene) {
          scenes.push(currentScene);
        }

        sceneNumber++;
        const match = text.match(/^(INT|EXT|INT\/EXT)[\.\s]+(.+?)[\s\-]+(DAY|NIGHT|DAWN|DUSK|MORNING|AFTERNOON|EVENING)?/i);

        let intExt = 'INT';
        let location = text;
        let timeOfDay = 'DAY';

        if (match) {
          intExt = match[1].toUpperCase();
          location = match[2].trim();
          timeOfDay = match[3] ? match[3].toUpperCase() : 'DAY';
        }

        currentScene = {
          sceneNumber,
          heading: text,
          intExt,
          location,
          timeOfDay,
          text: '',
          actors: [],
          props: [],
        };
      } else if (currentScene) {
        currentScene.text += text + '\n';

        if (type === 'Character') {
          const characterName = text.trim();
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

  extractCharacters(paragraphs) {
    const characterMap = new Map();
    let lastCharacter = null;

    paragraphs.forEach(para => {
      const type = para.$.Type;
      const text = para.Text ? para.Text.join(' ').trim() : '';

      if (type === 'Character') {
        lastCharacter = text.trim();
        
        if (!characterMap.has(lastCharacter)) {
          characterMap.set(lastCharacter, {
            name: lastCharacter,
            lines: 0,
            scenes: 0,
            dialogue: [],
          });
        }
      } else if (type === 'Dialogue' && lastCharacter) {
        const char = characterMap.get(lastCharacter);
        char.lines++;
        char.dialogue.push(text);
      }
    });

    return Array.from(characterMap.values());
  }
}

module.exports = new FDXParser();
