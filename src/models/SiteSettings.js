const mongoose = require('mongoose');

const siteSettingsSchema = new mongoose.Schema({
    siteId: { type: String, default: 'main', unique: true },
    siteName: { type: String, default: 'Jeien' },
    announcement: { type: String, default: 'Free Returns | 24/7 Support' },
    heroBanners: [{
        imageUrl: String,
        linkUrl: String,
        title: String,
        subtitle: String,
        order: { type: Number, default: 0 }
    }],
    featuredCategories: [String],
    maintenanceMode: { type: Boolean, default: false },
    contactEmail: String,
    socialLinks: {
        facebook: String,
        instagram: String,
        twitter: String,
    },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SiteSettings', siteSettingsSchema);
