const Settings = require('./settings.model');
const Vendor = require('../vendors/vendor.model');

// Get platform settings (admin only)
const getAdminSettings = async (req, res) => {
    try {
        const settings = await Settings.getPlatformSettings();

        res.status(200).json({
            success: true,
            data: {
                settings: settings.platform,
                version: settings.version,
                lastUpdated: settings.updatedAt
            }
        });
    } catch (error) {
        console.error('Get admin settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch admin settings',
            error: error.message
        });
    }
};

// Update platform settings (admin only)
const updateAdminSettings = async (req, res) => {
    try {
        const userId = req.user.id;
        const updates = req.body;

        let settings = await Settings.getPlatformSettings();

        // Update platform settings
        if (updates.siteName !== undefined) settings.platform.siteName = updates.siteName;
        if (updates.siteEmail !== undefined) settings.platform.siteEmail = updates.siteEmail;
        if (updates.sitePhone !== undefined) settings.platform.sitePhone = updates.sitePhone;
        if (updates.currency !== undefined) settings.platform.currency = updates.currency;
        if (updates.defaultCommission !== undefined) {
            settings.platform.defaultCommission = Math.max(0, Math.min(50, updates.defaultCommission));
        }
        if (updates.allowVendorRegistration !== undefined) {
            settings.platform.allowVendorRegistration = updates.allowVendorRegistration;
        }
        if (updates.autoApproveVendors !== undefined) {
            settings.platform.autoApproveVendors = updates.autoApproveVendors;
        }
        if (updates.requireProductApproval !== undefined) {
            settings.platform.requireProductApproval = updates.requireProductApproval;
        }
        if (updates.maintenanceMode !== undefined) {
            settings.platform.maintenanceMode = updates.maintenanceMode;
        }

        // Update payment methods
        if (updates.enableMpesa !== undefined) {
            settings.platform.paymentMethods.enableMpesa = updates.enableMpesa;
        }
        if (updates.enablePaypal !== undefined) {
            settings.platform.paymentMethods.enablePaypal = updates.enablePaypal;
        }
        if (updates.enableCards !== undefined) {
            settings.platform.paymentMethods.enableCards = updates.enableCards;
        }
        if (updates.enableCashOnDelivery !== undefined) {
            settings.platform.paymentMethods.enableCashOnDelivery = updates.enableCashOnDelivery;
        }

        settings.lastModifiedBy = userId;
        await settings.save();

        res.status(200).json({
            success: true,
            message: 'Admin settings updated successfully',
            data: {
                settings: settings.platform,
                version: settings.version,
                lastUpdated: settings.updatedAt
            }
        });
    } catch (error) {
        console.error('Update admin settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update admin settings',
            error: error.message
        });
    }
};

// Get vendor settings
const getVendorSettings = async (req, res) => {
    try {
        const userId = req.user.id;

        // Find vendor for this user
        const vendor = await Vendor.findOne({ user: userId });
        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: 'Vendor not found'
            });
        }

        const settings = await Settings.getVendorSettings(vendor._id);

        res.status(200).json({
            success: true,
            data: {
                settings: settings.vendorSettings,
                version: settings.version,
                lastUpdated: settings.updatedAt
            }
        });
    } catch (error) {
        console.error('Get vendor settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch vendor settings',
            error: error.message
        });
    }
};

// Update vendor settings
const updateVendorSettings = async (req, res) => {
    try {
        const userId = req.user.id;
        const updates = req.body;

        // Find vendor for this user
        const vendor = await Vendor.findOne({ user: userId });
        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: 'Vendor not found'
            });
        }

        let settings = await Settings.getVendorSettings(vendor._id);

        // Update vendor settings
        if (updates.storeName !== undefined) settings.vendorSettings.storeName = updates.storeName;
        if (updates.description !== undefined) settings.vendorSettings.description = updates.description;

        // Update contact info
        if (updates.contactInfo) {
            if (!settings.vendorSettings.contactInfo) settings.vendorSettings.contactInfo = {};
            if (updates.contactInfo.email !== undefined) {
                settings.vendorSettings.contactInfo.email = updates.contactInfo.email;
            }
            if (updates.contactInfo.phone !== undefined) {
                settings.vendorSettings.contactInfo.phone = updates.contactInfo.phone;
            }
            if (updates.contactInfo.address !== undefined) {
                settings.vendorSettings.contactInfo.address = updates.contactInfo.address;
            }
        }

        // Update social links
        if (updates.socialLinks) {
            if (!settings.vendorSettings.socialLinks) settings.vendorSettings.socialLinks = {};
            if (updates.socialLinks.website !== undefined) {
                settings.vendorSettings.socialLinks.website = updates.socialLinks.website;
            }
            if (updates.socialLinks.facebook !== undefined) {
                settings.vendorSettings.socialLinks.facebook = updates.socialLinks.facebook;
            }
            if (updates.socialLinks.instagram !== undefined) {
                settings.vendorSettings.socialLinks.instagram = updates.socialLinks.instagram;
            }
            if (updates.socialLinks.twitter !== undefined) {
                settings.vendorSettings.socialLinks.twitter = updates.socialLinks.twitter;
            }
        }

        // Update preferences
        if (updates.preferences) {
            if (!settings.vendorSettings.preferences) settings.vendorSettings.preferences = {};
            if (updates.preferences.autoApproveProducts !== undefined) {
                settings.vendorSettings.preferences.autoApproveProducts = updates.preferences.autoApproveProducts;
            }
            if (updates.preferences.lowStockThreshold !== undefined) {
                settings.vendorSettings.preferences.lowStockThreshold = updates.preferences.lowStockThreshold;
            }
            if (updates.preferences.allowReviews !== undefined) {
                settings.vendorSettings.preferences.allowReviews = updates.preferences.allowReviews;
            }
            if (updates.preferences.emailNotifications !== undefined) {
                settings.vendorSettings.preferences.emailNotifications = updates.preferences.emailNotifications;
            }
            if (updates.preferences.smsNotifications !== undefined) {
                settings.vendorSettings.preferences.smsNotifications = updates.preferences.smsNotifications;
            }
        }

        // Update bank details
        if (updates.bankDetails) {
            if (!settings.vendorSettings.bankDetails) settings.vendorSettings.bankDetails = {};
            if (updates.bankDetails.provider !== undefined) {
                settings.vendorSettings.bankDetails.provider = updates.bankDetails.provider;
            }
            if (updates.bankDetails.accountName !== undefined) {
                settings.vendorSettings.bankDetails.accountName = updates.bankDetails.accountName;
            }
            if (updates.bankDetails.accountNumber !== undefined) {
                settings.vendorSettings.bankDetails.accountNumber = updates.bankDetails.accountNumber;
            }
            if (updates.bankDetails.phoneNumber !== undefined) {
                settings.vendorSettings.bankDetails.phoneNumber = updates.bankDetails.phoneNumber;
            }
            if (updates.bankDetails.bankName !== undefined) {
                settings.vendorSettings.bankDetails.bankName = updates.bankDetails.bankName;
            }
            if (updates.bankDetails.branch !== undefined) {
                settings.vendorSettings.bankDetails.branch = updates.bankDetails.branch;
            }
            if (updates.bankDetails.swiftCode !== undefined) {
                settings.vendorSettings.bankDetails.swiftCode = updates.bankDetails.swiftCode;
            }
        }

        settings.lastModifiedBy = userId;
        await settings.save();

        res.status(200).json({
            success: true,
            message: 'Vendor settings updated successfully',
            data: {
                settings: settings.vendorSettings,
                version: settings.version,
                lastUpdated: settings.updatedAt
            }
        });
    } catch (error) {
        console.error('Update vendor settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update vendor settings',
            error: error.message
        });
    }
};

module.exports = {
    getAdminSettings,
    updateAdminSettings,
    getVendorSettings,
    updateVendorSettings
};
