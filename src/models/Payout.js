const mongoose = require('mongoose');

const payoutSchema = new mongoose.Schema({
    vendor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    orderItem: { // Link to specific item in an order if doing per-item payouts, or Order schema needs adjust
        // For simplicity, let's link to the Order and maybe specific product reference if needed,
        // or just calculate total payout per order.
        // Given the requirement: "Funds are released... after order completion"
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true,
    },
    amount: {
        type: Number,
        required: true, // The 93% amount
    },
    commission: {
        type: Number,
        required: true, // The 7% amount
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'paid', 'failed'],
        default: 'pending',
    },
    transactionId: String, // B2C transaction ID
    paidAt: Date,
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Payout', payoutSchema);
