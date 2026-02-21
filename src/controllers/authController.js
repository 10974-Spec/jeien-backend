const User = require('../models/User');
const Setting = require('../models/Setting');
const Notification = require('../models/Notification');
const generateToken = require('../utils/generateToken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// helper to fire-and-forget a notification
const notify = (type, title, message, data = {}) =>
    Notification.create({ type, title, message, data, forAdmin: true }).catch(() => { });

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
    try {
        const { name, email, password, phone, role, storeName, idNumber, storeDescription } = req.body;
        const userRole = role || 'user';

        if (userRole !== 'user') {
            if (!email || !password) return res.status(400).json({ message: 'Email and password are required for vendors' });
            const userExists = await User.findOne({ email });
            if (userExists) return res.status(400).json({ message: 'User already exists with this email' });
        } else {
            if (!phone) return res.status(400).json({ message: 'Phone number is required for buyers' });
            const userExists = await User.findOne({ phone });
            if (userExists) return res.status(400).json({ message: 'User already exists with this phone number' });
        }

        let hashedPassword;
        if (password) {
            const salt = await bcrypt.genSalt(10);
            hashedPassword = await bcrypt.hash(password, salt);
        }

        let initialVendorStatus = 'pending';
        if (userRole === 'vendor') {
            const autoApproveSetting = await Setting.findOne({ key: 'auto_approve_vendors' });
            if (autoApproveSetting && autoApproveSetting.value === true) {
                initialVendorStatus = 'approved';
            }
        }

        const user = await User.create({
            name, email: email || undefined, password: hashedPassword, phone,
            role: userRole, storeName, idNumber, storeDescription,
            vendorStatus: userRole === 'vendor' ? initialVendorStatus : undefined
        });

        if (user) {
            const isVendor = user.role === 'vendor';
            notify(
                isVendor ? 'new_vendor' : 'new_user',
                isVendor ? `New Vendor: ${name}` : `New User: ${name}`,
                `${email} just registered as a ${user.role}.`,
                { userId: user._id }
            );

            res.status(201).json({
                _id: user._id, name: user.name, email: user.email,
                role: user.role, token: generateToken(user._id), isVerified: user.isVerified,
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        console.error('Register error:', error.message);
        res.status(400).json({ message: error.message || 'Registration failed' });
    }
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
    try {
        const { email, password, phone } = req.body;
        let user;

        if (phone) {
            user = await User.findOne({ phone, role: 'user' });
            if (!user) return res.status(401).json({ message: 'Invalid phone number' });
        } else if (email && password) {
            user = await User.findOne({ email });
            if (!user || !(await bcrypt.compare(password, user.password))) {
                return res.status(401).json({ message: 'Invalid email or password' });
            }
        } else {
            return res.status(400).json({ message: 'Please provide phone number or email and password' });
        }

        res.json({
            _id: user._id, name: user.name, email: user.email, role: user.role,
            token: generateToken(user._id), isVerified: user.isVerified,
            vendorStatus: user.vendorStatus, storeName: user.storeName,
            storeDescription: user.storeDescription, phone: user.phone,
            profileImage: user.profileImage,
        });
    } catch (error) {
        console.error('Login error:', error.message);
        res.status(500).json({ message: 'Server error during login' });
    }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
const getUserProfile = async (req, res) => {
    const user = await User.findById(req.user._id);
    if (user) {
        res.json({
            _id: user._id, name: user.name, email: user.email, role: user.role,
            phone: user.phone, isVerified: user.isVerified,
            storeName: user.storeName, storeDescription: user.storeDescription,
            vendorStatus: user.vendorStatus, profileImage: user.profileImage,
        });
    } else {
        res.status(404).json({ message: 'User not found' });
    }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const { name, phone, storeName, storeDescription, profileImage } = req.body;
        if (name !== undefined) user.name = name;
        if (phone !== undefined) user.phone = phone;
        if (storeName !== undefined) user.storeName = storeName;
        if (storeDescription !== undefined) user.storeDescription = storeDescription;
        if (profileImage !== undefined) user.profileImage = profileImage;

        const saved = await user.save();
        res.json({
            _id: saved._id, name: saved.name, email: saved.email, role: saved.role,
            phone: saved.phone, storeName: saved.storeName, storeDescription: saved.storeDescription,
            profileImage: saved.profileImage, token: generateToken(saved._id),
        });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

// @desc    Forgot password — generate reset token
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
    try {
        const { email, reason } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: 'No account found with that email.' });

        const resetToken = crypto.randomBytes(32).toString('hex');
        user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        user.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour
        user.passwordResetReason = reason || '';
        await user.save({ validateBeforeSave: false });

        if (user.role === 'vendor') {
            notify(
                'password_reset_request',
                `Password Reset Request: ${user.storeName || user.name}`,
                `Reason: ${reason || 'Not specified'}`,
                { userId: user._id }
            );
        }

        const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:8080'}/reset-password/${resetToken}`;
        console.log('[Dev] Password reset link:', resetUrl);

        res.json({
            message: 'Password reset link sent! Check your email (or console in dev mode).',
            ...(process.env.NODE_ENV !== 'production' && { resetToken, resetUrl })
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// @desc    Reset password with token
// @route   POST /api/auth/reset-password/:token
// @access  Public
const resetPassword = async (req, res) => {
    try {
        const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
        const user = await User.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: Date.now() },
        });

        if (!user) return res.status(400).json({ message: 'Reset token is invalid or has expired.' });

        const { password } = req.body;
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        user.passwordResetReason = undefined;
        await user.save();

        res.json({ message: 'Password reset successful. You can now log in.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { registerUser, loginUser, getUserProfile, updateProfile, forgotPassword, resetPassword };
