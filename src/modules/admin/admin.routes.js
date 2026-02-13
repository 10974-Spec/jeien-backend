const express = require('express');
const router = express.Router();
const adminController = require('./admin.controller');
const authenticate = require('../../middlewares/auth.middleware');
const { adminOnly } = require('../../middlewares/role.middleware');

// All routes require admin authentication
router.use(authenticate);
router.use(adminOnly);

// Database management
router.post('/database/reset', adminController.resetDatabase);

// Security monitoring
router.get('/security/logs', adminController.getSecurityLogs);

// Payment tracking
router.get('/payments/tracking', adminController.getPaymentTracking);

module.exports = router;
