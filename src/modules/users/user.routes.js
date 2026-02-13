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
  updateUserRole,
  getUserDetails,
  deleteUser
} = require('./user.controller');

router.get('/me', authenticate, getUserProfile);
router.put('/profile', authenticate, updateUserProfile);
router.put('/profile-image', authenticate, singleUpload, updateProfileImage);
router.put('/password', authenticate, updatePassword);
router.put('/addresses', authenticate, manageAddresses);

router.get('/', authenticate, adminOnly, getAllUsers);
router.get('/:userId/details', authenticate, adminOnly, getUserDetails);
router.put('/:userId/role', authenticate, adminOnly, updateUserRole);
router.delete('/:userId', authenticate, adminOnly, deleteUser);

module.exports = router;