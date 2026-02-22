const express = require('express');
const router = express.Router();
const { getAllSettings, getPublicSettings, updateSettingsBulk, getPublicStats } = require('../controllers/settingController');
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

module.exports = router;
