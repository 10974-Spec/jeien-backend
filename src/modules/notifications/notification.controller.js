const Notification = require('./notification.model');
const User = require('../users/user.model');

// Get all notifications for admin
const getNotifications = async (req, res) => {
    try {
        const { type, read, limit = 50, skip = 0 } = req.query;

        const filter = { recipient: req.user.id };

        if (type) filter.type = type;
        if (read !== undefined) filter.read = read === 'true';

        const notifications = await Notification.find(filter)
            .populate('data.userId', 'name email')
            .populate('data.productId', 'title')
            .populate('data.vendorId', 'storeName')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip));

        const total = await Notification.countDocuments(filter);
        const unreadCount = await Notification.countDocuments({ recipient: req.user.id, read: false });

        res.json({
            success: true,
            data: {
                notifications,
                total,
                unreadCount,
                hasMore: total > parseInt(skip) + notifications.length
            }
        });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch notifications',
            error: error.message
        });
    }
};

// Get unread count
const getUnreadCount = async (req, res) => {
    try {
        const count = await Notification.countDocuments({
            recipient: req.user.id,
            read: false
        });

        res.json({
            success: true,
            data: { count }
        });
    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get unread count',
            error: error.message
        });
    }
};

// Mark notification as read
const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;

        const notification = await Notification.findOneAndUpdate(
            { _id: id, recipient: req.user.id },
            { read: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        res.json({
            success: true,
            data: notification
        });
    } catch (error) {
        console.error('Mark as read error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark notification as read',
            error: error.message
        });
    }
};

// Mark all as read
const markAllAsRead = async (req, res) => {
    try {
        const result = await Notification.updateMany(
            { recipient: req.user.id, read: false },
            { read: true }
        );

        res.json({
            success: true,
            message: `Marked ${result.modifiedCount} notifications as read`,
            data: { count: result.modifiedCount }
        });
    } catch (error) {
        console.error('Mark all as read error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark all as read',
            error: error.message
        });
    }
};

// Delete notification
const deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;

        const notification = await Notification.findOneAndDelete({
            _id: id,
            recipient: req.user.id
        });

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        res.json({
            success: true,
            message: 'Notification deleted successfully'
        });
    } catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete notification',
            error: error.message
        });
    }
};

// Delete all notifications
const deleteAllNotifications = async (req, res) => {
    try {
        const result = await Notification.deleteMany({ recipient: req.user.id });

        res.json({
            success: true,
            message: `Deleted ${result.deletedCount} notifications`,
            data: { count: result.deletedCount }
        });
    } catch (error) {
        console.error('Delete all notifications error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete all notifications',
            error: error.message
        });
    }
};

module.exports = {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications
};
