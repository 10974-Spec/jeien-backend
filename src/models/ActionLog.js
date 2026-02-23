const mongoose = require('mongoose');

const actionLogSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false, // For failed login attempts where user isn't found
    },
    emailAttempted: {
        type: String,
        required: true,
    },
    action: {
        type: String,
        required: true,
        enum: ['login_success', 'login_failed', 'logout', 'password_reset'],
    },
    ipAddress: {
        type: String,
        required: true,
        default: '0.0.0.0',
    },
    deviceInfo: {
        type: String,
        default: 'Unknown Device',
    },
    status: {
        type: String,
        enum: ['success', 'failed'],
        required: true,
    },
    failureReason: {
        type: String,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Auto-expire logs older than 30 days to save space
actionLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('ActionLog', actionLogSchema);
