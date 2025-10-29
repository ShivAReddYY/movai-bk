const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { NotFoundError, BadRequestError } = require('../../shared/utils/errors');
const fs = require('fs');
const fsPromises = require('fs').promises; 
const path = require('path');

// Parsers
const pageParser = require('./parsers/page.parser');
const pdfParser = require('./parsers/pdf.parser');
const fountainParser = require('./parsers/fountain.parser');
const fdxParser = require('./parsers/fdx.parser');

class ScriptService {
  /**
   * Get all scripts for a user
   */
  async getUserScripts(userId, filters = {}) {
    const { search, fileType, isPublic } = filters;

    const where = {
      ownerId: userId,
    };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (fileType) {
      where.fileType = fileType;
    }

    if (isPublic !== undefined) {
      where.isPublic = isPublic === 'true';
    }

    const scripts = await prisma.script.findMany({
      where,
      include: {
        scenes: {
          select: {
            id: true,
          },
        },
        characters: {
          select: {
            id: true,
          },
        },
        _count: {
          select: {
            scenes: true,
            characters: true,
            collaborators: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return scripts;
  }

  /**
   * Get single script by ID
   */
  async getScriptById(scriptId, userId) {
    const script = await prisma.script.findFirst({
      where: {
        id: scriptId,
        OR: [
          { ownerId: userId },
          {
            collaborators: {
              some: { userId },
            },
          },
        ],
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        scenes: {
          orderBy: { sceneNumber: 'asc' },
        },
        characters: {
          orderBy: { lines: 'desc' },
        },
        collaborators: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
        _count: {
          select: {
            scenes: true,
            characters: true,
            comments: true,
            tasks: true,
            pages: true,
          },
        },
      },
    });

    if (!script) {
      throw new NotFoundError('Script not found');
    }

    return script;
  }

  /**
   * ✅ COMPLETE FIXED: Upload and parse script
   */
  async uploadScript(userId, file, metadata) {
    const tempPath = path.join('uploads', 'scripts', file.filename);
    
    try {
      console.log(`📄 Processing script: ${file.originalname}`);
      
      const parser = require('./parsers/advanced.parser');
      const parsed = await parser.parse(tempPath);
      
      // Determine file type
      const ext = path.extname(file.originalname).toLowerCase();
      let fileType = 'PDF';
      if (ext === '.fountain') fileType = 'FOUNTAIN';
      else if (ext === '.fdx') fileType = 'FDX';
      else if (ext === '.txt') fileType = 'TXT';
      
      // Create script
      const script = await prisma.script.create({
        data: {
          ownerId: userId,
          title: metadata.title || path.parse(file.originalname).name,
          originalFilename: file.originalname,
          storedFilename: file.filename,
          fileType: fileType,
          fileSize: file.size,
          filePath: tempPath,
          metadata: parsed.metadata || {},
        },
      });
      
      console.log(`✅ Script created: ${script.id}`);
      
      // Save text pages
      if (parsed.textPages && parsed.textPages.length > 0) {
        await prisma.scriptPage.createMany({
          data: parsed.textPages.map((page) => ({
            scriptId: script.id,
            pageNumber: page.pageNumber,
            rawText: page.rawText,
            lineCount: page.lineCount,
            formatted: [],
            isReviewed: false,
          })),
        });
        console.log(`✅ Saved ${parsed.textPages.length} text pages`);
      }
      
      // Save scenes
      if (parsed.scenes && parsed.scenes.length > 0) {
        await prisma.scene.createMany({
          data: parsed.scenes.map((scene, index) => ({
            scriptId: script.id,
            sceneNumber: scene.sceneNumber || index + 1,
            page: scene.pageNumber || 1,
            heading: scene.heading || `Scene ${index + 1}`,
            location: scene.location || 'Unknown',
            intExt: scene.intExt || 'INT',
            timeOfDay: scene.timeOfDay || 'DAY',
            summary: scene.summary || '',
            sceneText: scene.text || '',
            actors: scene.actors || [],
            props: scene.props || [],
            order: index,
          })),
        });
        console.log(`✅ Saved ${parsed.scenes.length} scenes`);
      }
      
      // Save characters - ✅ FIXED: Use prisma.character
      if (parsed.characters && parsed.characters.length > 0) {
        await prisma.character.createMany({
          data: parsed.characters.map((char) => ({
            scriptId: script.id,
            name: char.name,
            lines: char.lines || 0,
            scenes: char.scenes || 0,
            dialogue: char.dialogue || [],
            sceneIds: char.sceneIds || [],
          })),
        });
        console.log(`✅ Saved ${parsed.characters.length} characters`);
      }
      
      return script;
      
    } catch (error) {
      console.error('❌ Upload error:', error);
      await fsPromises.unlink(tempPath).catch(() => {});
      throw error;
    }
  }

  /**
   * Update page text
   */
  async updatePageText(scriptId, pageNumber, newText, userId) {
    await this.getScriptById(scriptId, userId);
    
    const page = await prisma.scriptPage.update({
      where: {
        scriptId_pageNumber: {
          scriptId,
          pageNumber,
        },
      },
      data: {
        rawText: newText,
        updatedAt: new Date(),
      },
    });
    
    console.log(`✅ Updated page ${pageNumber} text`);
    return page;
  }

  /**
   * Get script pages
   */
/**
 * Get script pages
 */
async getScriptPages(scriptId, userId) {
  await this.getScriptById(scriptId, userId);
  
  const pages = await prisma.scriptPage.findMany({
    where: { scriptId },
    orderBy: { pageNumber: 'asc' },
  });
  
  // ✅ ADD DEBUGGING
  console.log(`📖 Retrieved ${pages.length} pages for script ${scriptId}`);
  if (pages.length > 0) {
    console.log(`📄 Page 1 sample:`, {
      pageNumber: pages[0].pageNumber,
      rawTextLength: pages[0].rawText?.length || 0,
      lineCount: pages[0].lineCount,
      hasText: !!pages[0].rawText,
    });
  }
  
  return pages;
}


  /**
   * Update single page
   */
  async updateScriptPage(scriptId, pageNumber, userId, formatted) {
    await this.getScriptById(scriptId, userId);
    
    const updated = await prisma.scriptPage.update({
      where: {
        scriptId_pageNumber: {
          scriptId,
          pageNumber,
        },
      },
      data: {
        formatted,
        isReviewed: true,
        updatedAt: new Date(),
      },
    });
    
    return updated;
  }

  /**
   * Update script
   */
  async updateScript(scriptId, userId, updateData) {
    const script = await prisma.script.findFirst({
      where: {
        id: scriptId,
        ownerId: userId,
      },
    });

    if (!script) {
      throw new NotFoundError('Script not found or you do not have permission');
    }

    const updated = await prisma.script.update({
      where: { id: scriptId },
      data: {
        ...updateData,
        version: { increment: 1 },
      },
    });

    return updated;
  }

  /**
   * Delete script
   */
  async deleteScript(scriptId, userId) {
    const script = await prisma.script.findFirst({
      where: {
        id: scriptId,
        ownerId: userId,
      },
    });

    if (!script) {
      throw new NotFoundError('Script not found or you do not have permission');
    }

    try {
      await fsPromises.unlink(script.filePath);
    } catch (error) {
      console.error('Failed to delete file:', error);
    }

    await prisma.script.delete({
      where: { id: scriptId },
    });

    return { message: 'Script deleted successfully' };
  }

  /**
   * ✅ COMPLETE FIXED: Re-analyze script from edited pages
   */
  async reanalyzeScript(scriptId, userId) {
    const script = await this.getScriptById(scriptId, userId);
    
    console.log(`🔄 Re-analyzing script: ${scriptId}`);
    
    const pages = await prisma.scriptPage.findMany({
      where: { scriptId },
      orderBy: { pageNumber: 'asc' },
    });
    
    if (pages.length === 0) {
      throw new BadRequestError('No pages to analyze');
    }
    
    const parser = require('./parsers/document.parser');
    
    // Re-analyze from text pages
    const pagesForParsing = pages.map(p => ({ 
      pageNumber: p.pageNumber, 
      rawText: p.rawText, 
      lineCount: p.lineCount 
    }));
    
    const scenes = parser.analyzeScenes(pagesForParsing);
    const characters = parser.extractCharacters(scenes);
    const metadata = parser.generateMetadata(pagesForParsing, scenes, characters);
    
    console.log(`✅ Re-analyzed: ${scenes.length} scenes, ${characters.length} characters`);
    
    // Delete old data - ✅ FIXED: Use prisma.character
    await prisma.$transaction([
      prisma.scene.deleteMany({ where: { scriptId } }),
      prisma.character.deleteMany({ where: { scriptId } }),
    ]);
    
    // Create new scenes
    if (scenes.length > 0) {
      await prisma.scene.createMany({
        data: scenes.map((scene, index) => ({
          scriptId: script.id,
          sceneNumber: scene.sceneNumber || index + 1,
          page: scene.pageNumber || 1,
          heading: scene.heading || `Scene ${index + 1}`,
          location: scene.location || 'Unknown',
          intExt: scene.intExt || 'INT',
          timeOfDay: scene.timeOfDay || 'DAY',
          summary: scene.summary || '',
          sceneText: scene.text || '',
          actors: scene.actors || [],
          props: scene.props || [],
          order: index,
        })),
      });
    }
    
    // Create new characters - ✅ FIXED: Use prisma.character
    if (characters.length > 0) {
      await prisma.character.createMany({
        data: characters.map((char) => ({
          scriptId: script.id,
          name: char.name,
          lines: char.lines || 0,
          scenes: char.scenes || 0,
          dialogue: char.dialogue || [],
          sceneIds: char.sceneIds || [],
        })),
      });
    }
    
    // Update metadata
    await prisma.script.update({
      where: { id: scriptId },
      data: {
        metadata: metadata,
        updatedAt: new Date(),
      },
    });
    
    return {
      success: true,
      scenes: scenes.length,
      characters: characters.length,
      metadata,
    };
  }

  /**
   * Get script statistics
   */
  async getScriptStats(scriptId, userId) {
    const script = await this.getScriptById(scriptId, userId);

    const scenes = await prisma.scene.findMany({
      where: { scriptId },
    });

    // ✅ FIXED: Use prisma.character
    const characters = await prisma.character.findMany({
      where: { scriptId },
    });

    const totalScenes = scenes.length;
    const intScenes = scenes.filter(s => s.intExt === 'INT').length;
    const extScenes = scenes.filter(s => s.intExt === 'EXT').length;
    const dayScenes = scenes.filter(s => s.timeOfDay?.includes('DAY')).length;
    const nightScenes = scenes.filter(s => s.timeOfDay?.includes('NIGHT')).length;

    const totalCharacters = characters.length;
    const totalDialogue = characters.reduce((sum, c) => sum + c.lines, 0);

    const estimatedBudget = this.calculateBudget(scenes, characters);
    const estimatedDays = Math.ceil(totalScenes / 3);

    return {
      totalScenes,
      intScenes,
      extScenes,
      dayScenes,
      nightScenes,
      totalCharacters,
      totalDialogue,
      estimatedBudget,
      estimatedDays,
      locations: [...new Set(scenes.map(s => s.location).filter(Boolean))],
      props: [...new Set(scenes.flatMap(s => s.props || []))],
    };
  }

  /**
   * Calculate estimated budget
   */
  calculateBudget(scenes, characters) {
    let budget = 0;
    budget += 50000;
    budget += scenes.length * 5000;
    budget += characters.length * 10000;

    const extScenes = scenes.filter(s => s.intExt === 'EXT').length;
    budget += extScenes * 3000;

    const nightScenes = scenes.filter(s => s.timeOfDay?.includes('NIGHT')).length;
    budget += nightScenes * 2000;

    return Math.round(budget);
  }
}

module.exports = new ScriptService();
