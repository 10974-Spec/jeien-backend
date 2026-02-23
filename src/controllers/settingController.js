const Setting = require('../models/Setting');
const Product = require('../models/Product');
const User = require('../models/User');

// Helper to init default settings if not exists
const initSettings = async () => {
    const defaultSettings = [
        // 1. General Settings
        { key: 'site_name', value: 'Jeien', type: 'string', category: 'General Settings', isPublic: true, description: 'The official name of your marketplace.' },
        { key: 'logo_favicon', value: '/logo.png', type: 'string', category: 'General Settings', isPublic: true, description: 'URL for the main logo and favicon.' },
        { key: 'contact_email', value: 'support@jeien.com', type: 'string', category: 'General Settings', isPublic: true, description: 'Official public contact email address.' },
        { key: 'support_phone', value: '+254 700 000 000', type: 'string', category: 'General Settings', isPublic: true, description: 'Official support phone number.' },
        { key: 'business_address', value: 'Nairobi, Kenya', type: 'string', category: 'General Settings', isPublic: true, description: 'Physical address of the business.' },
        { key: 'timezone', value: 'Africa/Nairobi', type: 'string', category: 'General Settings', isPublic: true, description: 'Default timezone for dates and times.' },
        { key: 'default_language', value: 'en', type: 'string', category: 'General Settings', isPublic: true, description: 'Primary language of the platform.' },
        { key: 'currency', value: 'KES', type: 'string', category: 'General Settings', isPublic: true, description: 'Primary currency symbol (e.g., KES, USD).' },
        { key: 'date_number_formats', value: 'DD/MM/YYYY', type: 'string', category: 'General Settings', isPublic: true, description: 'Format to display dates.' },
        { key: 'multi_language_enable', value: false, type: 'boolean', category: 'General Settings', isPublic: true, description: 'Enable multi-language support (Localization).' },
        { key: 'currency_auto_conversion', value: false, type: 'boolean', category: 'General Settings', isPublic: true, description: 'Auto-convert currency based on IP.' },
        { key: 'vat_inclusive_pricing_display', value: true, type: 'boolean', category: 'General Settings', isPublic: true, description: 'Show prices inclusive of VAT.' },

        // 2. Commission & Revenue Settings
        { key: 'default_commission_rate', value: 7, type: 'number', category: 'Commission & Revenue Settings', isPublic: false, description: 'Default percentage cut the admin takes from vendor sales.' },
        { key: 'category_based_commission', value: false, type: 'boolean', category: 'Commission & Revenue Settings', isPublic: false, description: 'Allow different commission rates per product category.' },
        { key: 'vendor_specific_commission_override', value: false, type: 'boolean', category: 'Commission & Revenue Settings', isPublic: false, description: 'Allow overriding commission rate per vendor.' },
        { key: 'commission_type', value: 'percentage', type: 'string', category: 'Commission & Revenue Settings', isPublic: false, description: 'Type of commission: percentage, fixed, or hybrid.' },
        { key: 'minimum_payout_threshold', value: 1000, type: 'number', category: 'Commission & Revenue Settings', isPublic: false, description: 'Minimum balance a vendor needs before they can widthdraw.' },
        { key: 'payout_schedule', value: 'weekly', type: 'string', category: 'Commission & Revenue Settings', isPublic: false, description: 'When payouts occur (daily, weekly, monthly).' },
        { key: 'manual_vs_automatic_payouts', value: 'manual', type: 'string', category: 'Commission & Revenue Settings', isPublic: false, description: 'Set whether payouts are automatic or manual.' },
        { key: 'processing_fee_deduction', value: 0, type: 'number', category: 'Commission & Revenue Settings', isPublic: false, description: 'Flat processing fee deducted during payouts.' },
        { key: 'hold_period_days', value: 7, type: 'number', category: 'Commission & Revenue Settings', isPublic: false, description: 'Number of days funds are held in escrow before vendor withdrawal.' },

        // 3. Payment Settings
        { key: 'enable_mpesa', value: true, type: 'boolean', category: 'Payment Settings', isPublic: true, description: 'Enable M-Pesa payments.' },
        { key: 'enable_stripe', value: false, type: 'boolean', category: 'Payment Settings', isPublic: true, description: 'Enable Stripe payments.' },
        { key: 'enable_paypal', value: false, type: 'boolean', category: 'Payment Settings', isPublic: true, description: 'Enable PayPal payments.' },
        { key: 'enable_bank_transfer', value: false, type: 'boolean', category: 'Payment Settings', isPublic: true, description: 'Enable Bank Transfer payments.' },
        { key: 'enable_cash_on_delivery', value: false, type: 'boolean', category: 'Payment Settings', isPublic: true, description: 'Enable Cash on Delivery.' },
        { key: 'mpesa_c2b', value: true, type: 'boolean', category: 'Payment Settings', isPublic: false, description: 'Enable M-Pesa C2B (Paybill/Till).' },
        { key: 'mpesa_stk_push', value: true, type: 'boolean', category: 'Payment Settings', isPublic: false, description: 'Enable M-Pesa STK Push Express.' },
        { key: 'payment_sandbox_mode', value: true, type: 'boolean', category: 'Payment Settings', isPublic: false, description: 'Toggle test/sandbox mode for payments.' },
        { key: 'payment_timeout_duration', value: 10, type: 'number', category: 'Payment Settings', isPublic: false, description: 'Minutes before a pending payment expires.' },

        // 4. Vendor Settings
        { key: 'auto_approve_vendors', value: false, type: 'boolean', category: 'Vendor Settings', isPublic: false, description: 'Auto-approve vendors instantly on sign up.' },
        { key: 'require_vendor_admin_approval', value: true, type: 'boolean', category: 'Vendor Settings', isPublic: false, description: 'Require admin review for all new vendor applications.' },
        { key: 'require_vendor_documents', value: true, type: 'boolean', category: 'Vendor Settings', isPublic: false, description: 'Require ID, KRA PIN, Business License for vendors.' },
        { key: 'vendor_can_create_coupons', value: true, type: 'boolean', category: 'Vendor Settings', isPublic: false, description: 'Allow vendors to generate promo codes.' },
        { key: 'vendor_can_manage_shipping', value: true, type: 'boolean', category: 'Vendor Settings', isPublic: false, description: 'Allow vendors to define their own shipping fees.' },
        { key: 'vendor_can_edit_orders', value: false, type: 'boolean', category: 'Vendor Settings', isPublic: false, description: 'Allow vendors to edit orders after placement.' },
        { key: 'vendor_can_issue_refunds', value: false, type: 'boolean', category: 'Vendor Settings', isPublic: false, description: 'Allow vendors to directly issue refunds.' },
        { key: 'vendor_can_create_variations', value: true, type: 'boolean', category: 'Vendor Settings', isPublic: false, description: 'Allow vendors to create color/size variations.' },
        { key: 'vendor_can_create_digital_products', value: true, type: 'boolean', category: 'Vendor Settings', isPublic: false, description: 'Allow selling digital downloads.' },
        { key: 'vendor_can_access_analytics', value: true, type: 'boolean', category: 'Vendor Settings', isPublic: false, description: 'Provide vendors access to their own dashboards.' },
        { key: 'vendor_can_export_reports', value: true, type: 'boolean', category: 'Vendor Settings', isPublic: false, description: 'Allow vendors to export their sales to CSV.' },
        { key: 'max_products_per_vendor', value: 50, type: 'number', category: 'Vendor Settings', isPublic: false, description: 'Maximum active products allowed per vendor.' },
        { key: 'max_images_per_product', value: 5, type: 'number', category: 'Vendor Settings', isPublic: false, description: 'Maximum allowed image uploads per product.' },
        { key: 'vendor_storage_limits', value: 1000, type: 'number', category: 'Vendor Settings', isPublic: false, description: 'Storage limit per vendor in MBs.' },

        // 5. Product Settings
        { key: 'auto_approve_products', value: true, type: 'boolean', category: 'Product Settings', isPublic: false, description: 'Instantly publish new vendor products.' },
        { key: 'require_product_admin_approval', value: false, type: 'boolean', category: 'Product Settings', isPublic: false, description: 'Admin must approve every new product.' },
        { key: 'product_review_workflow', value: false, type: 'boolean', category: 'Product Settings', isPublic: false, description: 'Require admin review before product goes live.' },
        { key: 'sku_auto_generation', value: true, type: 'boolean', category: 'Product Settings', isPublic: false, description: 'Auto-generate SKUs for missing products.' },
        { key: 'low_stock_alert_threshold', value: 5, type: 'number', category: 'Product Settings', isPublic: false, description: 'Stock quantity limit that triggers low-stock alerts.' },
        { key: 'digital_product_delivery', value: true, type: 'boolean', category: 'Product Settings', isPublic: false, description: 'Enable automatic links for digital delivery.' },
        { key: 'product_attribute_management', value: true, type: 'boolean', category: 'Product Settings', isPublic: false, description: 'Allow advanced generic attributes for products.' },

        // 6. Shipping Settings
        { key: 'flat_rate_shipping_fee', value: 0, type: 'number', category: 'Shipping Settings', isPublic: true, description: 'Global flat rate shipping amount' },
        { key: 'per_vendor_shipping', value: true, type: 'boolean', category: 'Shipping Settings', isPublic: false, description: 'Apply shipping rules per individual vendor.' },
        { key: 'zone_based_shipping', value: false, type: 'boolean', category: 'Shipping Settings', isPublic: false, description: 'Calculate shipping based on geographic zones.' },
        { key: 'weight_based_shipping', value: false, type: 'boolean', category: 'Shipping Settings', isPublic: false, description: 'Calculate shipping based on aggregate cart weight.' },
        { key: 'local_delivery_enable', value: true, type: 'boolean', category: 'Shipping Settings', isPublic: true, description: 'Toggle internal local delivery dispatch system.' },
        { key: 'third_party_shipping_api', value: false, type: 'boolean', category: 'Shipping Settings', isPublic: false, description: 'Integrate with FedEx, DHL, or Sendy APIs.' },
        { key: 'estimated_delivery_time_display', value: true, type: 'boolean', category: 'Shipping Settings', isPublic: true, description: 'Show calculated delivery estimates to buyers.' },

        // 7. Tax & VAT Settings
        { key: 'vat_percentage', value: 16, type: 'number', category: 'Tax & VAT Settings', isPublic: false, description: 'Standard VAT percentage rate applied to orders.' },
        { key: 'vendor_level_vat', value: false, type: 'boolean', category: 'Tax & VAT Settings', isPublic: false, description: 'Allow specific vendors to handle their own VAT.' },
        { key: 'tax_inclusive_pricing', value: true, type: 'boolean', category: 'Tax & VAT Settings', isPublic: false, description: 'Assume products are already taxed in total.' },
        { key: 'country_based_tax_rules', value: false, type: 'boolean', category: 'Tax & VAT Settings', isPublic: false, description: 'Cross-border tax variation rules.' },
        { key: 'generate_tax_invoices_automatically', value: true, type: 'boolean', category: 'Tax & VAT Settings', isPublic: false, description: 'Generate and attach PDF tax invoices to order emails.' },

        // 8. Security Settings
        { key: 'enable_2fa_admin', value: false, type: 'boolean', category: 'Security Settings', isPublic: false, description: 'Enforce 2-Factor Auth for all admins.' },
        { key: 'enable_2fa_vendors', value: false, type: 'boolean', category: 'Security Settings', isPublic: false, description: 'Require 2FA for vendor dashboard access.' },
        { key: 'password_strength_requirements', value: true, type: 'boolean', category: 'Security Settings', isPublic: false, description: 'Enforce uppercase, numbers, and symbols in passwords.' },
        { key: 'login_attempt_limits', value: 5, type: 'number', category: 'Security Settings', isPublic: false, description: 'Max failed logins before IP block.' },
        { key: 'ip_blocking', value: false, type: 'boolean', category: 'Security Settings', isPublic: false, description: 'Temporarily block recurring malicious IPs automatically.' },
        { key: 'enable_captcha', value: false, type: 'boolean', category: 'Security Settings', isPublic: true, description: 'Enable reCAPTCHA on registration/login.' },
        { key: 'order_risk_detection', value: true, type: 'boolean', category: 'Security Settings', isPublic: false, description: 'Flag suspiciously large anonymous orders.' },
        { key: 'payment_verification_checks', value: true, type: 'boolean', category: 'Security Settings', isPublic: false, description: 'Cross-check M-Pesa codes with Safaricom endpoints securely.' },
        { key: 'suspicious_activity_alerts', value: true, type: 'boolean', category: 'Security Settings', isPublic: false, description: 'Send admin alerts for suspicious IPs/orders.' },

        // 9. Analytics & Tracking
        { key: 'google_analytics_id', value: '', type: 'string', category: 'Analytics & Tracking', isPublic: true, description: 'Your active Google Analytics (GA4) Tracking ID.' },
        { key: 'posthog_id', value: '', type: 'string', category: 'Analytics & Tracking', isPublic: true, description: 'Your PostHog telemetry API key.' },
        { key: 'mixpanel_id', value: '', type: 'string', category: 'Analytics & Tracking', isPublic: true, description: 'Your Mixpanel integration ID.' },
        { key: 'hotjar_id', value: '', type: 'string', category: 'Analytics & Tracking', isPublic: true, description: 'Your Hotjar site ID for heatmaps.' },
        { key: 'facebook_pixel_id', value: '', type: 'string', category: 'Analytics & Tracking', isPublic: true, description: 'Your active Facebook Meta Pixel ID.' },
        { key: 'conversion_tracking_settings', value: true, type: 'boolean', category: 'Analytics & Tracking', isPublic: false, description: 'Track order conversions natively.' },

        // 10. Email & Notification Settings
        { key: 'email_template_order_confirmation', value: true, type: 'boolean', category: 'Email & Notification Settings', isPublic: false, description: 'Toggle order confirmation emails.' },
        { key: 'email_template_vendor_payout', value: true, type: 'boolean', category: 'Email & Notification Settings', isPublic: false, description: 'Toggle vendor payout notifications.' },
        { key: 'email_template_refund', value: true, type: 'boolean', category: 'Email & Notification Settings', isPublic: false, description: 'Toggle refund completion emails.' },
        { key: 'email_template_new_vendor', value: true, type: 'boolean', category: 'Email & Notification Settings', isPublic: false, description: 'Toggle emails on successful vendor signups.' },
        { key: 'email_template_password_reset', value: true, type: 'boolean', category: 'Email & Notification Settings', isPublic: false, description: 'Toggle system password reset emails.' },
        { key: 'admin_order_alerts', value: true, type: 'boolean', category: 'Email & Notification Settings', isPublic: false, description: 'Send SMS/Email to admin on every new order.' },
        { key: 'vendor_low_stock_alerts', value: true, type: 'boolean', category: 'Email & Notification Settings', isPublic: false, description: 'Alert vendors when inventory is low.' },
        { key: 'withdrawal_request_alerts', value: true, type: 'boolean', category: 'Email & Notification Settings', isPublic: false, description: 'Alert admins when vendors request payouts.' },
        { key: 'sms_notifications', value: true, type: 'boolean', category: 'Email & Notification Settings', isPublic: false, description: 'Global toggle for SMS delivery (M-Pesa confirmations, delivery updates).' },

        // 11. Review & Rating Settings
        { key: 'allow_product_reviews', value: true, type: 'boolean', category: 'Review & Rating Settings', isPublic: true, description: 'Allow users to leave reviews on items.' },
        { key: 'allow_vendor_reviews', value: true, type: 'boolean', category: 'Review & Rating Settings', isPublic: true, description: 'Allow users to review entire vendor stores.' },
        { key: 'require_purchase_to_review', value: true, type: 'boolean', category: 'Review & Rating Settings', isPublic: false, description: 'Only verified buyers can review products.' },
        { key: 'auto_approve_reviews', value: true, type: 'boolean', category: 'Review & Rating Settings', isPublic: false, description: 'Instantly publish incoming user reviews.' },
        { key: 'profanity_filter', value: true, type: 'boolean', category: 'Review & Rating Settings', isPublic: false, description: 'Censor bad words in product reviews.' },

        // 12. Legal & Compliance
        { key: 'terms_and_conditions_link', value: '/terms', type: 'string', category: 'Legal & Compliance', isPublic: true, description: 'Link to your public Terms page.' },
        { key: 'vendor_agreement_link', value: '/vendor-terms', type: 'string', category: 'Legal & Compliance', isPublic: true, description: 'Link to your vendor agreement page.' },
        { key: 'privacy_policy_link', value: '/privacy', type: 'string', category: 'Legal & Compliance', isPublic: true, description: 'Link to your Privacy Policy.' },
        { key: 'cookie_policy_link', value: '/cookies', type: 'string', category: 'Legal & Compliance', isPublic: true, description: 'Link to your Cookie Policy.' },
        { key: 'gdpr_compliance_toggle', value: true, type: 'boolean', category: 'Legal & Compliance', isPublic: true, description: 'Enable cookie banners and data consent (GDPR).' },
        { key: 'data_retention_settings_days', value: 365, type: 'number', category: 'Legal & Compliance', isPublic: false, description: 'Number of days to keep inactive user data.' },

        // 13. AI & Automation
        { key: 'auto_fraud_detection', value: false, type: 'boolean', category: 'AI & Automation', isPublic: false, description: 'Utilize AI/ML to flag suspicious orders before payment.' },
        { key: 'auto_product_categorization', value: false, type: 'boolean', category: 'AI & Automation', isPublic: false, description: 'Use AI to auto-tag missing categories on vendor products.' },
        { key: 'auto_price_suggestions', value: false, type: 'boolean', category: 'AI & Automation', isPublic: false, description: 'Suggest optimal pricing to vendors.' },
        { key: 'auto_suspicious_vendor_detection', value: true, type: 'boolean', category: 'AI & Automation', isPublic: false, description: 'Flag rapid or bizarre vendor activity automatically.' },

        // 14. Marketing Settings
        { key: 'coupon_system_config', value: true, type: 'boolean', category: 'Marketing Settings', isPublic: false, description: 'Enable global coupon functionality.' },
        { key: 'referral_program_rules', value: false, type: 'boolean', category: 'Marketing Settings', isPublic: false, description: 'Enable users to refer friends for discounts.' },
        { key: 'affiliate_commission_rate', value: 5, type: 'number', category: 'Marketing Settings', isPublic: false, description: 'Default percentage cut for affiliate marketers.' },
        { key: 'enable_flash_sales', value: true, type: 'boolean', category: 'Marketing Settings', isPublic: true, description: 'Enable the flash sales engine module.' },
        { key: 'abandoned_cart_emails', value: false, type: 'boolean', category: 'Marketing Settings', isPublic: false, description: 'Auto-send reminders to users who left items in carts.' },
        { key: 'featured_vendor_logic', value: true, type: 'boolean', category: 'Marketing Settings', isPublic: false, description: 'Enable manual admin curation of featured stalls.' },
        { key: 'homepage_banner_manager', value: true, type: 'boolean', category: 'Marketing Settings', isPublic: false, description: 'Enable CMS for hero section sliders.' },

        // 15. Subscription / Vendor Plan Settings
        { key: 'enable_vendor_plans', value: false, type: 'boolean', category: 'Subscription / Vendor Plan Settings', isPublic: false, description: 'Enable tiered vendor subscriptions (Basic, Enterprise).' },
        { key: 'plan_names', value: 'Basic, Pro, Enterprise', type: 'string', category: 'Subscription / Vendor Plan Settings', isPublic: false, description: 'Comma separated tier names (e.g. Basic, Pro).' },
        { key: 'priority_listing', value: true, type: 'boolean', category: 'Subscription / Vendor Plan Settings', isPublic: false, description: 'Give top-tier subscribers priority search ranking.' },
        { key: 'featured_product_slots', value: 3, type: 'number', category: 'Subscription / Vendor Plan Settings', isPublic: false, description: 'Default featured product slots per vendor plan.' },
        { key: 'analytics_access_level', value: 'Basic', type: 'string', category: 'Subscription / Vendor Plan Settings', isPublic: false, description: 'Default dashboard analytics availability limit.' },

        // 16. Order Management Rules
        { key: 'order_auto_confirm', value: true, type: 'boolean', category: 'Order Management Rules', isPublic: false, description: 'Auto confirming orders if payment validates instantly.' },
        { key: 'vendor_can_cancel_order', value: true, type: 'boolean', category: 'Order Management Rules', isPublic: false, description: 'Allow vendors to cancel orders before shipping.' },
        { key: 'refund_approval_required', value: true, type: 'boolean', category: 'Order Management Rules', isPublic: false, description: 'Require admin approval for any refund.' },
        { key: 'split_order_logic', value: true, type: 'boolean', category: 'Order Management Rules', isPublic: false, description: 'Split single basket into multiple sub-orders per vendor.' },
        { key: 'commission_refund_logic', value: true, type: 'boolean', category: 'Order Management Rules', isPublic: false, description: 'Automatically retract commission if order is refunded.' },

        // 17. System & Technical Settings
        { key: 'maintenance_mode', value: false, type: 'boolean', category: 'System & Technical Settings', isPublic: true, description: 'Take the storefront offline for maintenance.' },
        { key: 'cache_control', value: true, type: 'boolean', category: 'System & Technical Settings', isPublic: false, description: 'Enable memory caching on catalog API endpoints.' },
        { key: 'file_upload_limits_mb', value: 5, type: 'number', category: 'System & Technical Settings', isPublic: false, description: 'Max allowed MBs per image or document upload.' },
        { key: 'api_rate_limits', value: 100, type: 'number', category: 'System & Technical Settings', isPublic: false, description: 'Max API calls per user IP per 15 minutes.' },
        { key: 'backup_frequency', value: 'Daily', type: 'string', category: 'System & Technical Settings', isPublic: false, description: 'Frequency of automated DB snapshots.' },
        { key: 'logs_retention_period_days', value: 30, type: 'number', category: 'System & Technical Settings', isPublic: false, description: 'When to purge old system error logs.' },
        { key: 'role_based_permissions', value: true, type: 'boolean', category: 'System & Technical Settings', isPublic: false, description: 'Turn on hierarchical admin sub-roles.' },
        { key: 'audit_logs', value: true, type: 'boolean', category: 'System & Technical Settings', isPublic: false, description: 'Enable system-wide audit logging tracks.' },
        { key: 'activity_monitoring', value: true, type: 'boolean', category: 'System & Technical Settings', isPublic: false, description: 'Record real-time user navigations via WS.' },
        { key: 'marketplace_health_score', value: true, type: 'boolean', category: 'System & Technical Settings', isPublic: false, description: 'Compute overall vendor trust and health score.' },
        { key: 'escrow_system_config', value: true, type: 'boolean', category: 'System & Technical Settings', isPublic: false, description: 'Hold payments in escrow until delivery is verified.' },
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

// @desc    Get public settings (Unauthenticated users)
// @route   GET /api/settings/public
const getPublicSettings = async (req, res) => {
    try {
        const settings = await Setting.find({ isPublic: true });

        // Format as key: value object for easy frontend consumption
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
        const updates = req.body; // Array of { key, value }
        console.log('--- Incoming bulk settings payload: ---', JSON.stringify(updates, null, 2));

        for (const update of updates) {
            // Validate type internally or just update
            await Setting.findOneAndUpdate(
                { key: update.key },
                { value: update.value },
                { upsert: true, new: true, setDefaultsOnInsert: true }
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

        res.json({
            products: productsCount,
            vendors: vendorsCount,
            satisfaction: 99 // Hardcoded satisfaction metric unless specified otherwise
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all coupons
// @route   GET /api/settings/coupons
const getCoupons = async (req, res) => {
    try {
        const coupons = await Setting.find({ key: { $regex: '^coupon_' } });
        // Return parsed values. We stored them as JSON strings in `value`
        const parsed = coupons.map(c => {
            try { return JSON.parse(c.value); } catch { return null; }
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

        const updated = await Setting.findOneAndUpdate(
            { key },
            { value: JSON.stringify(couponData), type: 'json', category: 'Coupons' },
            { upsert: true, new: true }
        );

        res.status(201).json(couponData);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    initSettings,
    getAllSettings,
    getPublicSettings,
    updateSettingsBulk,
    getPublicStats,
    getCoupons,
    createCoupon
};
