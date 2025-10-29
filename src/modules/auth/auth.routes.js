const express = require('express');
const router = express.Router();
const passport = require('passport');
const authController = require('./auth.controller');
const { authenticateJWT } = require('../../shared/middleware/auth.middleware');
const { uploadAvatar } = require('../../config/storage.config');

// Public routes
router.post('/register', authController.register.bind(authController));
router.post('/login', authController.login.bind(authController));
router.post('/refresh', authController.refresh.bind(authController));

// Google OAuth routes
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false
  })
);

router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${process.env.CLIENT_URL}/login?error=google_auth_failed`,
    session: false
  }),
  authController.googleCallback.bind(authController)
);

// Protected routes (require JWT)
router.get('/me', authenticateJWT, authController.getCurrentUser.bind(authController));
router.patch('/profile', authenticateJWT, authController.updateProfile.bind(authController));
router.post('/change-password', authenticateJWT, authController.changePassword.bind(authController));
router.post('/logout', authenticateJWT, authController.logout.bind(authController));

// Avatar upload (NEW!)
router.post(
  '/avatar',
  authenticateJWT,
  uploadAvatar.single('avatar'),
  authController.uploadAvatar.bind(authController)
);

module.exports = router;
