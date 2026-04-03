const Setting = require('../models/Setting');
const Product = require('../models/Product');
const User = require('../models/User');

// Helper to init default settings if not exists
const initSettings = async () => {
    const defaultSettings = [
        { key: 'site_name', value: 'Jeien', type: 'string', category: 'General Settings', isPublic: true, description: 'The official name of your marketplace.' },
        { key: 'logo_favicon', value: '/logo.png', type: 'string', category: 'General Settings', isPublic: true, description: 'URL for the main logo and favicon.' },
        { key: 'contact_email', value: 'support@jeien.com', type: 'string', category: 'General Settings', isPublic: true, description: 'Official public contact email address.' },
        { key: 'support_phone', value: '+254 700 000 000', type: 'string', category: 'General Settings', isPublic: true, description: 'Official support phone number.' },
        { key: 'business_address', value: 'Nairobi, Kenya', type: 'string', category: 'General Settings', isPublic: true, description: 'Physical address of the business.' },
        { key: 'timezone', value: 'Africa/Nairobi', type: 'string', category: 'General Settings', isPublic: true, description: 'Default timezone for dates and times.' },
        { key: 'default_language', value: 'en', type: 'string', category: 'General Settings', isPublic: true, description: 'Primary language of the platform.' },
        { key: 'currency', value: 'KES', type: 'string', category: 'General Settings', isPublic: true, description: 'Primary currency symbol.' },
        { key: 'date_number_formats', value: 'DD/MM/YYYY', type: 'string', category: 'General Settings', isPublic: true, description: 'Format to display dates.' },
        { key: 'multi_language_enable', value: false, type: 'boolean', category: 'General Settings', isPublic: true, description: 'Enable multi-language support.' },
        { key: 'currency_auto_conversion', value: false, type: 'boolean', category: 'General Settings', isPublic: true, description: 'Auto-convert currency based on IP.' },
        { key: 'vat_inclusive_pricing_display', value: true, type: 'boolean', category: 'General Settings', isPublic: true, description: 'Show prices inclusive of VAT.' },
        { key: 'default_commission_rate', value: 7, type: 'number', category: 'Commission & Revenue Settings', isPublic: false, description: 'Default percentage cut the admin takes from vendor sales.' },
        { key: 'minimum_payout_threshold', value: 1000, type: 'number', category: 'Commission & Revenue Settings', isPublic: false, description: 'Minimum balance before vendor can withdraw.' },
        { key: 'payout_schedule', value: 'weekly', type: 'string', category: 'Commission & Revenue Settings', isPublic: false, description: 'When payouts occur.' },
        { key: 'enable_mpesa', value: true, type: 'boolean', category: 'Payment Settings', isPublic: true, description: 'Enable M-Pesa payments.' },
        { key: 'enable_stripe', value: false, type: 'boolean', category: 'Payment Settings', isPublic: true, description: 'Enable Stripe payments.' },
        { key: 'enable_paypal', value: false, type: 'boolean', category: 'Payment Settings', isPublic: true, description: 'Enable PayPal payments.' },
        { key: 'auto_approve_vendors', value: false, type: 'boolean', category: 'Vendor Settings', isPublic: false, description: 'Auto-approve vendors on sign up.' },
        { key: 'require_vendor_admin_approval', value: true, type: 'boolean', category: 'Vendor Settings', isPublic: false, description: 'Require admin review for new vendors.' },
        { key: 'auto_approve_products', value: true, type: 'boolean', category: 'Product Settings', isPublic: false, description: 'Instantly publish new vendor products.' },
        { key: 'low_stock_alert_threshold', value: 5, type: 'number', category: 'Product Settings', isPublic: false, description: 'Stock quantity that triggers low-stock alerts.' },
        { key: 'flat_rate_shipping_fee', value: 0, type: 'number', category: 'Shipping Settings', isPublic: true, description: 'Global flat rate shipping amount.' },
        { key: 'vat_percentage', value: 16, type: 'number', category: 'Tax & VAT Settings', isPublic: false, description: 'Standard VAT percentage.' },
        { key: 'maintenance_mode', value: false, type: 'boolean', category: 'System & Technical Settings', isPublic: true, description: 'Take the storefront offline for maintenance.' },
        { key: 'allow_product_reviews', value: true, type: 'boolean', category: 'Review & Rating Settings', isPublic: true, description: 'Allow users to leave reviews.' },
        { key: 'coupon_system_config', value: true, type: 'boolean', category: 'Marketing Settings', isPublic: false, description: 'Enable global coupon functionality.' },
        { key: 'terms_and_conditions_link', value: '/terms', type: 'string', category: 'Legal & Compliance', isPublic: true, description: 'Link to your public Terms page.' },
        { key: 'privacy_policy_link', value: '/privacy', type: 'string', category: 'Legal & Compliance', isPublic: true, description: 'Link to your Privacy Policy.' },
    ];

    for (const s of defaultSettings) {
        await Setting.updateOne({ key: s.key }, { $setOnInsert: s }, { upsert: true });
    }
};

// @desc    Get all settings (Admins only)
// @route   GET /api/settings
const getAllSettings = async (req, res) => {
    try {
        const settings = await Setting.find({});
        res.json(settings);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get public settings
// @route   GET /api/settings/public
const getPublicSettings = async (req, res) => {
    try {
        const settings = await Setting.find({ isPublic: true });
        const formatted = settings.reduce((acc, curr) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {});
        res.json(formatted);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Bulk update settings
// @route   PUT /api/settings/bulk
const updateSettingsBulk = async (req, res) => {
    try {
        const updates = req.body;
        for (const update of updates) {
            await Setting.findOneAndUpdate(
                { key: update.key },
                { value: update.value },
                { upsert: true, new: true }
            );
        }
        res.json({ message: 'Settings updated successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get public statistics
// @route   GET /api/settings/public-stats
const getPublicStats = async (req, res) => {
    try {
        const productsCount = await Product.countDocuments({ isApproved: true, isActive: true });
        const vendorsCount = await User.countDocuments({ role: 'vendor', vendorStatus: 'approved' });
        res.json({ products: productsCount, vendors: vendorsCount, satisfaction: 99 });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all coupons
// @route   GET /api/settings/coupons
const getCoupons = async (req, res) => {
    try {
        const coupons = await Setting.find({ key: { $regex: '^coupon_' } });
        const parsed = coupons.map(c => {
            try { return typeof c.value === 'string' ? JSON.parse(c.value) : c.value; } catch { return null; }
        }).filter(Boolean);
        res.json(parsed);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create or update a coupon
// @route   POST /api/settings/coupons
const createCoupon = async (req, res) => {
    try {
        const { code, discountType, discountValue, minOrder, maxUses, expiresAt, isActive } = req.body;
        if (!code || discountValue === undefined) return res.status(400).json({ message: 'Code and discount value required' });

        const key = `coupon_${code.toUpperCase()}`;
        const couponData = {
            code: code.toUpperCase(),
            discountType, discountValue, minOrder, maxUses, expiresAt, isActive,
            createdAt: new Date().toISOString()
        };

        await Setting.findOneAndUpdate(
            { key },
            { value: JSON.stringify(couponData), type: 'json', category: 'Marketing Settings' },
            { upsert: true, new: true }
        );

        res.status(201).json(couponData);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Submit contact form
// @route   POST /api/settings/contact
const submitContactForm = async (req, res) => {
    try {
        const { name, email, message } = req.body;
        if (!name || !email || !message) {
            return res.status(400).json({ message: 'Please provide name, email and message' });
        }

        const { sendEmail } = require('../utils/email');
        const text = `New contact form submission from ${name} (${email}):\n\n${message}`;
        const html = `<p><strong>Name:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p><strong>Message:</strong><br/>${message}</p>`;

        try {
            await sendEmail({ email: 'info@jeien.com', subject: 'New Contact Form Submission', message: text, html });
            await sendEmail({ email: 'support@jeien.com', subject: 'New Contact Form Submission', message: text, html });
        } catch (emailErr) {
            console.error('Contact form email error:', emailErr.message);
        }

        res.status(200).json({ message: 'Contact form submitted successfully' });
    } catch (error) {
        console.error('Contact form error:', error);
        res.status(500).json({ message: 'Failed to send message' });
    }
};

module.exports = {
    initSettings,
    getAllSettings,
    getPublicSettings,
    updateSettingsBulk,
    getPublicStats,
    getCoupons,
    createCoupon,
    submitContactForm
};
