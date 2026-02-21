const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, unique: true, sparse: true },
    password: { type: String },
    phone: { type: String },
    profileImage: { type: String, default: '' },
    role: { type: String, enum: ['user', 'vendor', 'admin'], default: 'user' },
    isVerified: { type: Boolean, default: false },
    // Vendor fields
    storeName: { type: String, required: function () { return this.role === 'vendor'; } },
    storeDescription: String,
    storeLogo: String,
    storeBanner: String,
    followersCount: { type: Number, default: 0 },
    idNumber: { type: String, required: function () { return this.role === 'vendor'; } },
    idImage: { type: String },
    vendorStatus: { type: String, enum: ['pending', 'approved', 'rejected', 'suspended'], default: 'pending' },
    // Password reset
    passwordResetToken: String,
    passwordResetExpires: Date,
    passwordResetReason: String,
    // Wishlist
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
