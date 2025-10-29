const scriptService = require('./script.service');

class ScriptController {
  /**
   * Get all scripts for current user
   * GET /api/scripts
   */
  async getUserScripts(req, res, next) {
    try {
      const userId = req.user.id;
      const filters = {
        search: req.query.search,
        fileType: req.query.fileType,
        isPublic: req.query.isPublic,
      };

      const scripts = await scriptService.getUserScripts(userId, filters);

      res.json({
        success: true,
        message: 'Scripts retrieved successfully',
        data: scripts,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single script by ID
   * GET /api/scripts/:id
   */
  async getScriptById(req, res, next) {
    try {
      const scriptId = req.params.id;
      const userId = req.user.id;

      const script = await scriptService.getScriptById(scriptId, userId);

      res.json({
        success: true,
        message: 'Script retrieved successfully',
        data: script,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Upload new script
   * POST /api/scripts/upload
   */
  async uploadScript(req, res, next) {
    try {
      const userId = req.user.id;
      const file = req.file;
      const metadata = req.body;

      if (!file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded',
        });
      }

      const script = await scriptService.uploadScript(userId, file, metadata);

      res.status(201).json({
        success: true,
        message: 'Script uploaded and parsed successfully',
        data: script,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get script pages
   * GET /api/scripts/:id/pages
   */
  async getScriptPages(req, res, next) {
    try {
      const scriptId = req.params.id;
      const userId = req.user.id;
      
      const pages = await scriptService.getScriptPages(scriptId, userId);
      
      res.json({
        success: true,
        message: 'Script pages retrieved successfully',
        data: pages,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update script page
   * PATCH /api/scripts/:id/pages/:pageNumber
   */
  async updateScriptPage(req, res, next) {
    try {
      const { id: scriptId, pageNumber } = req.params;
      const userId = req.user.id;
      const { formatted } = req.body;
      
      const updated = await scriptService.updateScriptPage(
        scriptId,
        parseInt(pageNumber),
        userId,
        formatted
      );
      
      res.json({
        success: true,
        message: 'Page updated successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update script
   * PATCH /api/scripts/:id
   */
  async updateScript(req, res, next) {
    try {
      const scriptId = req.params.id;
      const userId = req.user.id;
      const updateData = req.body;

      const script = await scriptService.updateScript(scriptId, userId, updateData);

      res.json({
        success: true,
        message: 'Script updated successfully',
        data: script,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete script
   * DELETE /api/scripts/:id
   */
  async deleteScript(req, res, next) {
    try {
      const scriptId = req.params.id;
      const userId = req.user.id;

      await scriptService.deleteScript(scriptId, userId);

      res.json({
        success: true,
        message: 'Script deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
  /**
 * Re-analyze script
 * POST /api/scripts/:id/reanalyze
 */
async reanalyzeScript(req, res, next) {
  try {
    const scriptId = req.params.id;
    const userId = req.user.id;
    
    const result = await scriptService.reanalyzeScript(scriptId, userId);
    
    res.json({
      success: true,
      message: 'Script re-analyzed successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

async updatePageText(req, res, next) {
  try {
    const { id, pageNumber } = req.params;
    const { text } = req.body;
    const userId = req.user.id;
    
    const page = await scriptService.updatePageText(id, parseInt(pageNumber), text, userId);
    
    res.json({
      success: true,
      data: page,
    });
  } catch (error) {
    next(error);
  }
}

  /**
   * Get script statistics
   * GET /api/scripts/:id/stats
   */
  async getScriptStats(req, res, next) {
    try {
      const scriptId = req.params.id;
      const userId = req.user.id;

      const stats = await scriptService.getScriptStats(scriptId, userId);

      res.json({
        success: true,
        message: 'Script statistics retrieved successfully',
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ScriptController();
