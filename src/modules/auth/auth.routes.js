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

// ADD THIS TEST ENDPOINT
router.post('/test-login', (req, res) => {
  console.log('Test login called:', req.body);
  
  res.json({
    success: true,
    message: 'Test login successful',
    token: 'test_jwt_token_' + Date.now(),
    user: {
      id: 'test_id_123',
      email: req.body.email || 'admin@example.com',
      name: 'Test Admin',
      role: 'ADMIN',
      profileImage: null,
      createdAt: new Date().toISOString()
    }
  });
});

module.exports = router;