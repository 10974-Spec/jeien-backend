const express = require('express');
const router = express.Router();
const authenticate = require('../../middlewares/auth.middleware');
const { adminOnly } = require('../../middlewares/role.middleware');
const { singleUpload } = require('../../config/upload');
const {
  getUserProfile,
  updateUserProfile,
  updateProfileImage,
  updatePassword,
  manageAddresses,
  getAllUsers,
  updateUserRole
} = require('./user.controller');

router.get('/me', authenticate, getUserProfile);
router.put('/profile', authenticate, updateUserProfile);
router.put('/profile-image', authenticate, singleUpload, updateProfileImage);
router.put('/password', authenticate, updatePassword);
router.put('/addresses', authenticate, manageAddresses);

router.get('/', authenticate, adminOnly, getAllUsers);
router.put('/:userId/role', authenticate, adminOnly, updateUserRole);

module.exports = router;