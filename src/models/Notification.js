const mongoose = require('mongoose');
const notificationSchema = new mongoose.Schema({
    type: { type: String, enum: ['new_user', 'new_vendor', 'new_order', 'low_stock', 'product_approved', 'product_pending', 'payment_received', 'password_reset_request'], required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    data: { type: mongoose.Schema.Types.Mixed }, // linked entity id etc
    isRead: { type: Boolean, default: false },
    forAdmin: { type: Boolean, default: true },
}, { timestamps: true });
module.exports = mongoose.model('Notification', notificationSchema);
