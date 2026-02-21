const Message = require('../models/Message');

// @desc    Send a message
// @route   POST /api/messages
// @access  Private
const sendMessage = async (req, res) => {
    try {
        const { receiverId, subject, content } = req.body;
        const senderId = req.user._id;

        if (!receiverId || !content) {
            return res.status(400).json({ message: "Receiver and content are required." });
        }

        const message = await Message.create({
            sender: senderId,
            receiver: receiverId,
            subject,
            content
        });

        res.status(201).json(message);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get received messages
// @route   GET /api/messages
// @access  Private
const getMyMessages = async (req, res) => {
    try {
        const messages = await Message.find({ receiver: req.user._id })
            .populate('sender', 'name email profileImage')
            .sort({ createdAt: -1 });

        res.status(200).json(messages);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    sendMessage,
    getMyMessages
};
