const authService = require('./auth.service');

class AuthController {
  /**
   * Register new user
   * POST /api/auth/register
   */
  async register(req, res, next) {
    try {
      const { email, username, password, confirmPassword, name } = req.body;

      // Validation
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'Passwords do not match'
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 8 characters'
        });
      }

      // Register user
      const result = await authService.register({
        email,
        username,
        password,
        name
      });

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Login user
   * POST /api/auth/login
   */
  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      // Validation
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      // Login user
      const result = await authService.login({ email, password });

      res.json({
        success: true,
        message: 'Login successful',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Google OAuth callback
   * GET /api/auth/google/callback
   */
  async googleCallback(req, res, next) {
    try {
      const result = await authService.googleAuth(req.user);

      // Redirect to frontend with tokens
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
      res.redirect(
        `${clientUrl}/auth/callback?token=${result.accessToken}&refreshToken=${result.refreshToken}`
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Refresh access token
   * POST /api/auth/refresh
   */
  async refresh(req, res, next) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token is required'
        });
      }

      const result = await authService.refreshToken(refreshToken);

      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current user
   * GET /api/auth/me
   */
  async getCurrentUser(req, res, next) {
    try {
      const user = await authService.getCurrentUser(req.user.id);

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update profile
   * PATCH /api/auth/profile
   */
  async updateProfile(req, res, next) {
    try {
      const { username, name, avatar } = req.body;

      const user = await authService.updateProfile(req.user.id, {
        username,
        name,
        avatar
      });

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: user
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Change password
   * POST /api/auth/change-password
   */
  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword, confirmPassword } = req.body;

      // Validation
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password and new password are required'
        });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'New passwords do not match'
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'New password must be at least 8 characters'
        });
      }

      const result = await authService.changePassword(req.user.id, {
        currentPassword,
        newPassword
      });

      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  }
  /**
 * Upload avatar
 * POST /api/auth/avatar
 */
async uploadAvatar(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Check if user is Google user
    const user = await authService.getCurrentUser(req.user.id);
    if (user.googleId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot change avatar for Google users'
      });
    }

    // Get file URL
    const { getFileUrl } = require('../../config/storage.config');
    const avatarUrl = getFileUrl(req.file.filename, 'avatars');

    // Update user avatar
    const updatedUser = await authService.updateProfile(req.user.id, {
      avatar: avatarUrl
    });

    res.json({
      success: true,
      message: 'Avatar uploaded successfully',
      data: updatedUser
    });
  } catch (error) {
    next(error);
  }
}

  /**
   * Logout (client-side token removal)
   * POST /api/auth/logout
   */
  async logout(req, res) {
    res.json({
      success: true,
      message: 'Logout successful'
    });
  }
}

module.exports = new AuthController();
