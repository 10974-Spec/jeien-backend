const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: [
            'ORDER_CREATED',
            'ORDER_UPDATED',
            'USER_REGISTERED',
            'VENDOR_REGISTERED',
            'PRODUCT_PUBLISHED',
            'PRODUCT_DELETED',
            'PRODUCT_UPDATED',
            'PAYMENT_RECEIVED',
            'LOW_STOCK',
            'REVIEW_POSTED',
            'SYSTEM'
        ],
        required: true
    },
    title: {
        type: String,
        required: true,
        maxlength: 200
    },
    message: {
        type: String,
        required: true,
        maxlength: 500
    },
    data: {
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order'
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product'
        },
        vendorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Vendor'
        },
        amount: Number,
        quantity: Number,
        status: String,
        // Additional flexible data
        extra: mongoose.Schema.Types.Mixed
    },
    read: {
        type: Boolean,
        default: false
    },
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Indexes for performance
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ createdAt: -1 });

// Virtual for time ago
notificationSchema.virtual('timeAgo').get(function () {
    const now = new Date();
    const diff = now - this.createdAt;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return this.createdAt.toLocaleDateString();
});

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
