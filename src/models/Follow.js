const mongoose = require('mongoose');

const followSchema = new mongoose.Schema({
    follower: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    vendor: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Ensure a user can only follow a vendor once
followSchema.index({ follower: 1, vendor: 1 }, { unique: true });

const Follow = mongoose.model('Follow', followSchema);
module.exports = Follow;
