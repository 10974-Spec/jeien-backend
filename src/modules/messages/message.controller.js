const Message = require('./message.model');

// Create a new message
const createMessage = async (req, res) => {
    try {
        const { message, senderName, senderEmail, type } = req.body;

        if (!message || !senderName) {
            return res.status(400).json({
                success: false,
                message: 'Message and sender name are required'
            });
        }

        const newMessage = await Message.create({
            sender: req.user?.id || null,
            senderName,
            senderEmail: senderEmail || req.user?.email,
            message,
            type: type || 'chat',
            metadata: {
                userAgent: req.headers['user-agent'],
                ipAddress: req.ip,
                page: req.body.page || 'unknown'
            }
        });

        res.status(201).json({
            success: true,
            message: 'Message sent successfully',
            data: newMessage
        });
    } catch (error) {
        console.error('Create message error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send message',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
        });
    }
};

// Get all messages (admin only)
const getAllMessages = async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN') {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }

        const { status, type, page = 1, limit = 20 } = req.query;

        const filter = {};
        if (status) filter.status = status;
        if (type) filter.type = type;

        const messages = await Message.find(filter)
            .populate('sender', 'name email')
            .populate('reply.repliedBy', 'name')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));

        const total = await Message.countDocuments(filter);

        res.status(200).json({
            success: true,
            data: {
                messages,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit))
                }
            }
        });
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch messages',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
        });
    }
};

// Update message status (admin only)
const updateMessageStatus = async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN') {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }

        const { id } = req.params;
        const { status } = req.body;

        if (!['unread', 'read', 'replied'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }

        const message = await Message.findByIdAndUpdate(
            id,
            { status },
            { new: true }
        );

        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Message status updated',
            data: message
        });
    } catch (error) {
        console.error('Update message status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update message status',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
        });
    }
};

// Reply to message (admin only)
const replyToMessage = async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN') {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }

        const { id } = req.params;
        const { replyMessage } = req.body;

        if (!replyMessage) {
            return res.status(400).json({
                success: false,
                message: 'Reply message is required'
            });
        }

        const message = await Message.findByIdAndUpdate(
            id,
            {
                status: 'replied',
                reply: {
                    message: replyMessage,
                    repliedBy: req.user.id,
                    repliedAt: new Date()
                }
            },
            { new: true }
        ).populate('reply.repliedBy', 'name');

        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        // TODO: Send email notification to user if they provided email

        res.status(200).json({
            success: true,
            message: 'Reply sent successfully',
            data: message
        });
    } catch (error) {
        console.error('Reply to message error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send reply',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
        });
    }
};

// Delete message (admin only)
const deleteMessage = async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN') {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }

        const { id } = req.params;

        const message = await Message.findByIdAndDelete(id);

        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Message deleted successfully'
        });
    } catch (error) {
        console.error('Delete message error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete message',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
        });
    }
};

module.exports = {
    createMessage,
    getAllMessages,
    updateMessageStatus,
    replyToMessage,
    deleteMessage
};
