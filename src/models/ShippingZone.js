const mongoose = require('mongoose');

const shippingZoneSchema = new mongoose.Schema({
    name: { type: String, required: true },
    areas: { type: String, required: true },
    baseRate: { type: Number, required: true, default: 0 },
    freeAbove: { type: Number, default: null }, // Null means no free shipping
    isActive: { type: Boolean, default: true }
}, {
    timestamps: true
});

module.exports = mongoose.model('ShippingZone', shippingZoneSchema);
