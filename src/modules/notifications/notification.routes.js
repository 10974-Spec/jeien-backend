const express = require('express');
const router = express.Router();
const authenticate = require('../../middlewares/auth.middleware');
const { adminOnly } = require('../../middlewares/role.middleware');
const {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications
} = require('./notification.controller');

// All routes require authentication and admin role
router.use(authenticate);
router.use(adminOnly);

// Get notifications
router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);

// Mark as read
router.patch('/:id/read', markAsRead);
router.patch('/mark-all-read', markAllAsRead);

// Delete notifications
router.delete('/:id', deleteNotification);
router.delete('/all/delete', deleteAllNotifications);

module.exports = router;
