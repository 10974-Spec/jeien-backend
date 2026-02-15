const express = require('express');
const router = express.Router();
const SystemLog = require('./system-log.model');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');

/**
 * @desc    Get system logs
 * @route   GET /api/logs
 * @access  Private/Admin
 */
router.get('/', authenticate, authorize('ADMIN'), async (req, res) => {
    try {
        const { category, level, limit = 100, search } = req.query;

        const query = {};
        if (category) query.category = category;
        if (level) query.level = level;
        if (search) {
            query.message = { $regex: search, $options: 'i' };
        }

        const logs = await SystemLog.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));

        res.status(200).json({
            success: true,
            count: logs.length,
            data: logs
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch system logs',
            error: error.message
        });
    }
});

module.exports = router;
