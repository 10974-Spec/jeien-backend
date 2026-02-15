const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        enum: ['PLATFORM', 'VENDOR'],
        index: true
    },
    // For vendor settings, reference the vendor
    vendor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor',
        index: true
    },
    // Platform-wide settings (admin)
    platform: {
        siteName: {
            type: String,
            default: 'jeien agencies'
        },
        siteEmail: {
            type: String,
            default: 'caprufru@gmail.com'
        },
        sitePhone: {
            type: String,
            default: '+254746917511'
        },
        currency: {
            type: String,
            default: 'KES',
            enum: ['KES', 'USD', 'EUR', 'GBP']
        },
        defaultCommission: {
            type: Number,
            default: 7, // Changed from 10% to 7%
            min: 0,
            max: 50
        },
        allowVendorRegistration: {
            type: Boolean,
            default: true
        },
        autoApproveVendors: {
            type: Boolean,
            default: false
        },
        requireProductApproval: {
            type: Boolean,
            default: true
        },
        maintenanceMode: {
            type: Boolean,
            default: false
        },
        paymentMethods: {
            enableMpesa: {
                type: Boolean,
                default: true
            },
            enablePaypal: {
                type: Boolean,
                default: true
            },
            enableCards: {
                type: Boolean,
                default: true
            },
            enableCashOnDelivery: {
                type: Boolean,
                default: true
            }
        }
    },
    // Vendor-specific settings
    vendorSettings: {
        storeName: String,
        description: String,
        contactInfo: {
            email: String,
            phone: String,
            address: String
        },
        socialLinks: {
            website: String,
            facebook: String,
            instagram: String,
            twitter: String
        },
        preferences: {
            autoApproveProducts: {
                type: Boolean,
                default: true
            },
            lowStockThreshold: {
                type: Number,
                default: 10,
                min: 0
            },
            allowReviews: {
                type: Boolean,
                default: true
            },
            emailNotifications: {
                type: Boolean,
                default: true
            },
            smsNotifications: {
                type: Boolean,
                default: false
            }
        },
        bankDetails: {
            provider: {
                type: String,
                enum: ['MPESA', 'BANK', 'PAYPAL', 'OTHER'],
                default: 'MPESA'
            },
            accountName: String,
            accountNumber: String,
            phoneNumber: String,
            bankName: String,
            branch: String,
            swiftCode: String
        }
    },
    // Version tracking for settings history
    version: {
        type: Number,
        default: 1
    },
    lastModifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: function (doc, ret) {
            delete ret.__v;
            return ret;
        }
    }
});

// Ensure only one platform settings document exists
SettingsSchema.index({ type: 1, vendor: 1 }, { unique: true, sparse: true });

// Pre-save middleware to increment version
SettingsSchema.pre('save', function (next) {
    if (!this.isNew) {
        this.version += 1;
    }
    next();
});

// Static method to get or create platform settings
SettingsSchema.statics.getPlatformSettings = async function () {
    let settings = await this.findOne({ type: 'PLATFORM' });

    if (!settings) {
        settings = await this.create({
            type: 'PLATFORM',
            platform: {} // Will use defaults from schema
        });
    }

    return settings;
};

// Static method to get or create vendor settings
SettingsSchema.statics.getVendorSettings = async function (vendorId) {
    let settings = await this.findOne({ type: 'VENDOR', vendor: vendorId });

    if (!settings) {
        settings = await this.create({
            type: 'VENDOR',
            vendor: vendorId,
            vendorSettings: {}
        });
    }

    return settings;
};

module.exports = mongoose.model('Settings', SettingsSchema);
