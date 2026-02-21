const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { parser } = require('../config/cloudinary');

// POST /api/upload — upload one or more images to Cloudinary
// Returns array of secure_url strings
router.post('/', protect, parser.array('images', 10), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'No files uploaded' });
        }
        const urls = req.files.map(f => f.path); // multer-storage-cloudinary sets f.path = secure_url
        res.json({ urls });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

module.exports = router;
