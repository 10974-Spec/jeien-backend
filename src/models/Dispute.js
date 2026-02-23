const mongoose = require('mongoose');

const disputeSchema = new mongoose.Schema({
    order: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Order',
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User',
    },
    vendor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    reason: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: ['Pending', 'In Review', 'Resolved', 'Closed'],
        default: 'Pending',
    },
    resolution: {
        type: String,
    },
    evidence: [{
        type: String, // URLs to uploaded images/documents
    }],
    messages: [{
        sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        message: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
    }]
}, {
    timestamps: true,
});

module.exports = mongoose.model('Dispute', disputeSchema);
