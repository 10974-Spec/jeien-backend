const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    type: { type: String, enum: ['string', 'number', 'boolean', 'json', 'array'], required: true },
    category: {
        type: String,
        enum: [
            'General Settings',
            'Commission & Revenue Settings',
            'Payment Settings',
            'Vendor Settings',
            'Product Settings',
            'Shipping Settings',
            'Tax & VAT Settings',
            'Security Settings',
            'Analytics & Tracking',
            'Email & Notification Settings',
            'Review & Rating Settings',
            'Legal & Compliance',
            'AI & Automation',
            'Marketing Settings',
            'Subscription / Vendor Plan Settings',
            'Order Management Rules',
            'System & Technical Settings'
        ],
        required: true
    },
    isPublic: { type: Boolean, default: false }, // If true, accessible without auth (e.g., site name)
    description: { type: String } // Helper text for admin dashboard
}, { timestamps: true });

module.exports = mongoose.model('Setting', settingSchema);
