const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', async (req, res) => {
    try {
        const messages = await Message.find({ recipient: req.user._id })
            .populate('sender', 'name')
            .sort({ createdAt: -1 });
        res.json(messages);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

router.put('/:id/read', async (req, res) => {
    try {
        const message = await Message.findOneAndUpdate(
            { _id: req.params.id, recipient: req.user._id },
            { isRead: true },
            { new: true }
        );
        res.json(message);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

module.exports = router;
