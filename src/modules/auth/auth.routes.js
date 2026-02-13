const express = require('express');
const router = express.Router();
const authenticate = require('../../middlewares/auth.middleware');
const { singleUpload } = require('../../config/upload');
const {
  register,
  login,
  requestPasswordReset,
  verifyResetToken,
  resetPassword,
  googleAuth,
  facebookAuth,
  me,
  updateProfile,
  updateProfileImage
} = require('./auth.controller');

// Public routes
router.post('/register', register);
router.post('/login', login);

// Password reset routes
router.post('/forgot-password', requestPasswordReset);
router.get('/reset-password/:token', verifyResetToken);
router.post('/reset-password', resetPassword);

// OAuth routes
router.post('/google', googleAuth);
router.post('/facebook', facebookAuth);

// Protected routes
router.get('/me', authenticate, me);
router.put('/profile', authenticate, updateProfile);
router.put('/profile-image', authenticate, singleUpload, updateProfileImage);

module.exports = router;