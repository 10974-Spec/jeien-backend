const express = require('express');
const router = express.Router();
const authenticate = require('../../middlewares/auth.middleware');
const { vendorOrAdmin, adminOnly } = require('../../middlewares/role.middleware');
const { upload } = require('../../config/upload');
const {
  registerVendor,
  getVendorStore,
  updateVendorStore,
  updateStoreImages,
  updateBankDetails,
  getVendorStats,
  getAllVendors,
  getVendorById,
  updateVendorStatus,
  getPublicVendorProfile
} = require('./vendor.controller');

router.post('/register', authenticate, registerVendor);

router.get('/store', authenticate, vendorOrAdmin, getVendorStore);
router.put('/store', authenticate, vendorOrAdmin, updateVendorStore);
router.put('/store-images', authenticate, vendorOrAdmin, upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'banner', maxCount: 1 }
]), updateStoreImages);
router.put('/bank-details', authenticate, vendorOrAdmin, updateBankDetails);
router.get('/stats', authenticate, vendorOrAdmin, getVendorStats);

router.get('/all', authenticate, adminOnly, getAllVendors);
router.get('/:vendorId', authenticate, adminOnly, getVendorById);
router.put('/:vendorId/status', authenticate, adminOnly, updateVendorStatus);

router.get('/public/:vendorId', getPublicVendorProfile);

module.exports = router;