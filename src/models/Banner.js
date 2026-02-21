const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
    imageUrl: { type: String, required: true },
    subtitle: { type: String, default: '' },         // e.g. "New Arrival"
    title: { type: String, required: true },          // main heading
    description: { type: String, default: '' },       // sub-text / specs
    linkUrl: { type: String, default: '/' },           // CTA link
    linkLabel: { type: String, default: 'Shop Now' },  // CTA button text
    bgColor: { type: String, default: 'bg-navy' },     // Tailwind bg class
    order: { type: Number, default: 0 },              // for sorting
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Banner', bannerSchema);
