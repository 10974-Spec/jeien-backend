const express = require('express');
const router = express.Router();
const { getAllSettings, getPublicSettings, updateSettingsBulk, getPublicStats, getCoupons, createCoupon, submitContactForm } = require('../controllers/settingController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/')
    .get(getPublicSettings)
    .put(protect, admin, updateSettingsBulk);

router.route('/all')
    .get(protect, admin, getAllSettings);

router.route('/public')
    .get(getPublicSettings);

router.route('/public-stats')
    .get(getPublicStats);

router.route('/bulk')
    .put(protect, admin, updateSettingsBulk);

router.route('/coupons')
    .get(getCoupons)
    .post(protect, admin, createCoupon);

router.route('/contact')
    .post(submitContactForm);

module.exports = router;
