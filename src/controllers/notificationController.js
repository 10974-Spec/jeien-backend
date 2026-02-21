const Notification = require('../models/Notification');

// GET /api/notifications — admin only
const getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ forAdmin: true }).sort({ createdAt: -1 }).limit(50);
        res.json(notifications);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// PUT /api/notifications/:id/read
const markRead = async (req, res) => {
    try {
        await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
        res.json({ message: 'Marked as read' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// PUT /api/notifications/read-all
const markAllRead = async (req, res) => {
    try {
        await Notification.updateMany({ forAdmin: true }, { isRead: true });
        res.json({ message: 'All marked as read' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /api/notifications/unread-count
const unreadCount = async (req, res) => {
    try {
        const count = await Notification.countDocuments({ forAdmin: true, isRead: false });
        res.json({ count });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { getNotifications, markRead, markAllRead, unreadCount };
