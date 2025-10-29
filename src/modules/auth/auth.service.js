const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const { prisma } = require('../../config/database.config');

class AuthService {
  /**
   * Register new user
   */
  async register({ email, username, password, name }) {
    // Check if user exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          { username: username?.toLowerCase() }
        ]
      }
    });

    if (existingUser) {
      if (existingUser.email === email.toLowerCase()) {
        throw new Error('Email already exists');
      }
      if (existingUser.username === username?.toLowerCase()) {
        throw new Error('Username already exists');
      }
    }

    // Hash password with argon2
    const hashedPassword = await argon2.hash(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        username: username?.toLowerCase(),
        password: hashedPassword,
        name,
        role: 'USER',
        isActive: true
      },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        avatar: true,
        role: true,
        createdAt: true
      }
    });

    // Generate tokens
    const tokens = this.generateTokens(user);

    return { user, ...tokens };
  }

  /**
   * Login user
   */
  async login({ email, password }) {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    // Check if user has password (not OAuth only)
    if (!user.password) {
      throw new Error('Please login with Google');
    }

    // Verify password
    const isValid = await argon2.verify(user.password, password);

    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    // Generate tokens
    const tokens = this.generateTokens(userWithoutPassword);

    return { user: userWithoutPassword, ...tokens };
  }

  /**
   * Google OAuth login/register
   */
async googleAuth(profile) {
  const email = profile.emails[0].value;
  const googleId = profile.id;
  const avatar = profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null;
  const name = profile.displayName;

  // Check if user exists
  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: email.toLowerCase() },
        { googleId }
      ]
    }
  });

  if (user) {
    // Update user with Google info if not already set
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        googleId: googleId,
        avatar: avatar || user.avatar, // Update avatar if available
        name: name || user.name // Update name if available
      }
    });
  } else {
    // Create new user with Google data
    user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        googleId,
        name: name,
        avatar: avatar, // ✅ Save avatar from Google
        role: 'USER',
        isActive: true
      }
    });
  }

  // Remove password from response
  const { password: _, ...userWithoutPassword } = user;

  // Generate tokens
  const tokens = this.generateTokens(userWithoutPassword);

  return { user: userWithoutPassword, ...tokens };
}
  /**
   * Refresh access token
   */
  async refreshToken(refreshToken) {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

      // Get user
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          avatar: true,
          role: true
        }
      });

      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      // Generate new tokens
      const tokens = this.generateTokens(user);

      return { user, ...tokens };
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Get current user by ID
   */
  async getCurrentUser(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        avatar: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  /**
   * Update user profile
   */
  async updateProfile(userId, data) {
    const { username, name, avatar } = data;

    // Check if username is taken (if updating)
    if (username) {
      const existing = await prisma.user.findFirst({
        where: {
          username: username.toLowerCase(),
          NOT: { id: userId }
        }
      });

      if (existing) {
        throw new Error('Username already taken');
      }
    }

    // Update user
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(username && { username: username.toLowerCase() }),
        ...(name && { name }),
        ...(avatar && { avatar })
      },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        avatar: true,
        role: true,
        updatedAt: true
      }
    });

    return user;
  }

  /**
   * Change password
   */
  async changePassword(userId, { currentPassword, newPassword }) {
    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || !user.password) {
      throw new Error('Cannot change password for OAuth users');
    }

    // Verify current password
    const isValid = await argon2.verify(user.password, currentPassword);

    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await argon2.hash(newPassword);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    return { message: 'Password changed successfully' };
  }

  /**
   * Generate JWT tokens
   */
  generateTokens(user) {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role
    };

    const accessToken = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const refreshToken = jwt.sign(
      payload,
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
    );

    return { accessToken, refreshToken };
  }
}

module.exports = new AuthService();
