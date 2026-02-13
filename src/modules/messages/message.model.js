const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // Allow anonymous messages
    },
    senderName: {
        type: String,
        required: true
    },
    senderEmail: {
        type: String,
        required: false
    },
    message: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['chat', 'whatsapp', 'support'],
        default: 'chat'
    },
    status: {
        type: String,
        enum: ['unread', 'read', 'replied'],
        default: 'unread'
    },
    reply: {
        message: String,
        repliedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        repliedAt: Date
    },
    metadata: {
        userAgent: String,
        ipAddress: String,
        page: String
    }
}, {
    timestamps: true
});

// Index for faster queries
messageSchema.index({ status: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
