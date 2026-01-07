const express = require('express');
const router = express.Router();
const authenticate = require('../../middlewares/auth.middleware');
const { singleUpload } = require('../../config/upload');
const {
  register,
  login,
  googleAuth,
  facebookAuth,
  me,
  updateProfile,
  updateProfileImage
} = require('./auth.controller');

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleAuth);
router.post('/facebook', facebookAuth);
router.get('/me', authenticate, me);
router.put('/profile', authenticate, updateProfile);
router.put('/profile-image', authenticate, singleUpload, updateProfileImage);

module.exports = router;