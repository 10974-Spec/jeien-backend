const express = require('express');
const router = express.Router();
const { getTopVendors, getVendorProfile, toggleFollowVendor, getMyFollowers } = require('../controllers/vendorController');
const { protect } = require('../middleware/authMiddleware');

// Public routes
router.get('/top', getTopVendors);
router.get('/:id', getVendorProfile);

// Private Routes
router.post('/:id/follow', protect, toggleFollowVendor);
router.get('/me/followers', protect, getMyFollowers);

module.exports = router;
