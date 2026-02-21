const express = require('express');
const router = express.Router();
const Banner = require('../models/Banner');
const { protect, admin } = require('../middleware/authMiddleware');

// Public: get all active banners (sorted by order)
router.get('/', async (req, res) => {
    try {
        const banners = await Banner.find({ isActive: true }).sort({ order: 1 });
        res.json(banners);
    } catch (e) { res.status(500).json({ message: e.message }); }
});

// Admin: get ALL banners (incl. inactive)
router.get('/all', protect, admin, async (req, res) => {
    try {
        const banners = await Banner.find({}).sort({ order: 1 });
        res.json(banners);
    } catch (e) { res.status(500).json({ message: e.message }); }
});

// Admin: create banner
router.post('/', protect, admin, async (req, res) => {
    try {
        const banner = await Banner.create(req.body);
        res.status(201).json(banner);
    } catch (e) { res.status(400).json({ message: e.message }); }
});

// Admin: update banner
router.put('/:id', protect, admin, async (req, res) => {
    try {
        const banner = await Banner.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!banner) return res.status(404).json({ message: 'Banner not found' });
        res.json(banner);
    } catch (e) { res.status(400).json({ message: e.message }); }
});

// Admin: delete banner
router.delete('/:id', protect, admin, async (req, res) => {
    try {
        await Banner.findByIdAndDelete(req.params.id);
        res.json({ message: 'Banner deleted' });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;
