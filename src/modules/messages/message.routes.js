const express = require('express');
const router = express.Router();
const messageController = require('./message.controller');
const authenticate = require('../../middlewares/auth.middleware');
const { adminOnly } = require('../../middlewares/role.middleware');

// Public route - anyone can send a message
router.post('/', messageController.createMessage);

// Admin routes
router.get('/', authenticate, adminOnly, messageController.getAllMessages);
router.patch('/:id/status', authenticate, adminOnly, messageController.updateMessageStatus);
router.post('/:id/reply', authenticate, adminOnly, messageController.replyToMessage);
router.delete('/:id', authenticate, adminOnly, messageController.deleteMessage);

module.exports = router;
