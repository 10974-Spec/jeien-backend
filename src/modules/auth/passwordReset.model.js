const mongoose = require('mongoose');
const crypto = require('crypto');

const passwordResetSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    token: {
        type: String,
        required: true,
        unique: true
    },
    expiresAt: {
        type: Date,
        required: true
    },
    used: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Index for faster queries and automatic cleanup
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
passwordResetSchema.index({ token: 1 });

// Static method to create reset token
passwordResetSchema.statics.createResetToken = async function (userId) {
    // Generate random token
    const token = crypto.randomBytes(32).toString('hex');

    // Delete any existing tokens for this user
    await this.deleteMany({ user: userId });

    // Create new token (expires in 1 hour)
    const resetToken = await this.create({
        user: userId,
        token,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
    });

    return token;
};

// Static method to verify token
passwordResetSchema.statics.verifyToken = async function (token) {
    const resetToken = await this.findOne({
        token,
        used: false,
        expiresAt: { $gt: new Date() }
    }).populate('user');

    return resetToken;
};

const PasswordReset = mongoose.model('PasswordReset', passwordResetSchema);

module.exports = PasswordReset;
