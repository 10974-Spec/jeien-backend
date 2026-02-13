const express = require('express');
const router = express.Router();
const settingsController = require('./settings.controller');
const authenticate = require('../../middlewares/auth.middleware');
const { adminOnly } = require('../../middlewares/role.middleware');

// Admin settings routes (admin only)
router.get('/admin', authenticate, adminOnly, settingsController.getAdminSettings);
router.put('/admin', authenticate, adminOnly, settingsController.updateAdminSettings);

// Vendor settings routes (vendor only)
router.get('/vendor', authenticate, settingsController.getVendorSettings);
router.put('/vendor', authenticate, settingsController.updateVendorSettings);

module.exports = router;
