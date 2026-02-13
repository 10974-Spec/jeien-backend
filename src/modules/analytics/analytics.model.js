const mongoose = require('mongoose');

const analyticsEventSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: [
            'PAGE_VIEW',
            'PRODUCT_VIEW',
            'CATEGORY_VIEW',
            'SEARCH',
            'ADD_TO_CART',
            'REMOVE_FROM_CART',
            'CHECKOUT_START',
            'PURCHASE',
            'REGISTER',
            'LOGIN'
        ],
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    data: {
        type: mongoose.Schema.Types.Mixed
    }
});

const analyticsSchema = new mongoose.Schema({
    sessionId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
        index: true
    },
    ipAddress: {
        type: String,
        required: true
    },
    userAgent: {
        type: String,
        required: true
    },
    referrer: {
        type: String,
        default: ''
    },
    landingPage: {
        type: String,
        required: true
    },
    events: [analyticsEventSchema],
    duration: {
        type: Number, // in seconds
        default: 0
    },
    device: {
        type: String,
        enum: ['Desktop', 'Mobile', 'Tablet', 'Unknown'],
        default: 'Unknown'
    },
    browser: {
        type: String,
        default: 'Unknown'
    },
    country: {
        type: String,
        default: 'Unknown'
    },
    lastActivity: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Indexes for performance
analyticsSchema.index({ createdAt: -1 });
analyticsSchema.index({ 'events.type': 1 });
analyticsSchema.index({ 'events.data.productId': 1 });
analyticsSchema.index({ 'events.data.page': 1 });

// Helper method to add event
analyticsSchema.methods.addEvent = function (type, data = {}) {
    this.events.push({
        type,
        timestamp: new Date(),
        data
    });
    this.lastActivity = new Date();
    return this.save();
};

// Static method to get active sessions (last 5 minutes)
analyticsSchema.statics.getActiveSessions = function () {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return this.countDocuments({ lastActivity: { $gte: fiveMinutesAgo } });
};

const Analytics = mongoose.model('Analytics', analyticsSchema);

module.exports = Analytics;
