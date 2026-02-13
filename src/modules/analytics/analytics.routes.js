const express = require('express');
const router = express.Router();
const authenticate = require('../../middlewares/auth.middleware');
const { adminOnly } = require('../../middlewares/role.middleware');
const {
    trackEvent,
    getOverview,
    getVisitStats,
    getProductViews,
    getTopPages,
    getDeviceBreakdown,
    getRealtimeVisitors
} = require('./analytics.controller');

// Public route - track events
router.post('/track', trackEvent);

// Admin routes - analytics data
router.get('/overview', authenticate, adminOnly, getOverview);
router.get('/visits', authenticate, adminOnly, getVisitStats);
router.get('/products', authenticate, adminOnly, getProductViews);
router.get('/pages', authenticate, adminOnly, getTopPages);
router.get('/devices', authenticate, adminOnly, getDeviceBreakdown);
router.get('/realtime', authenticate, adminOnly, getRealtimeVisitors);

module.exports = router;
