const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Setting = require('../models/Setting');

// ─── USER MANAGEMENT ──────────────────────────────────────────────────────────

const getUsers = async (req, res) => {
    try {
        const users = await User.find({}).select('-password');
        res.json(users);
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const deleteUser = async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.json({ message: 'User deleted' });
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const updateVendorStatus = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user || user.role !== 'vendor') return res.status(404).json({ message: 'Vendor not found' });
        user.vendorStatus = req.body.status || 'approved';
        user.isVerified = user.vendorStatus === 'approved';
        const updated = await user.save();
        res.json(updated);
    } catch (e) { res.status(500).json({ message: e.message }); }
};

// ─── PRODUCT MANAGEMENT ───────────────────────────────────────────────────────

const getAllProducts = async (req, res) => {
    try {
        const products = await Product.find({}).populate('vendor', 'name storeName email');
        res.json(products);
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const approveProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ message: 'Product not found' });
        product.isApproved = req.body.isApproved !== undefined ? req.body.isApproved : true;
        product.isActive = product.isApproved;
        const updated = await product.save();
        res.json(updated);
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const deleteAnyProduct = async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.json({ message: 'Product deleted' });
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const toggleFeaturedProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ message: 'Not found' });
        product.isFeatured = !product.isFeatured;
        const updated = await product.save();
        res.json(updated);
    } catch (e) { res.status(500).json({ message: e.message }); }
};

// ─── ORDER MANAGEMENT ─────────────────────────────────────────────────────────

const getAllOrders = async (req, res) => {
    try {
        const orders = await Order.find({})
            .populate('user', 'name email phone')
            .populate('orderItems.product', 'name images')
            .populate('orderItems.vendor', 'name storeName')
            .sort({ createdAt: -1 });
        res.json(orders);
    } catch (e) { res.status(500).json({ message: e.message }); }
};

// ─── PAYMENT HISTORY ──────────────────────────────────────────────────────────

const getPayments = async (req, res) => {
    try {
        const payments = await Payment.find({})
            .populate('order', 'totalPrice status createdAt')
            .populate('user', 'name email phone')
            .sort({ createdAt: -1 });
        res.json(payments);
    } catch (e) { res.status(500).json({ message: e.message }); }
};

// ─── STATS ────────────────────────────────────────────────────────────────────

const getStats = async (req, res) => {
    try {
        const [salesAgg] = await Order.aggregate([
            { $match: { isPaid: true } },
            { $group: { _id: null, total: { $sum: '$totalPrice' } } }
        ]);
        const salesAmount = salesAgg ? salesAgg.total : 0;

        const [usersCount, vendorsCount, ordersCount, productsCount, pendingProducts] = await Promise.all([
            User.countDocuments({ role: 'user' }),
            User.countDocuments({ role: 'vendor' }),
            Order.countDocuments({}),
            Product.countDocuments({}),
            Product.countDocuments({ isApproved: false }),
        ]);

        // Monthly revenue for chart (last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
        const monthlyRevenue = await Order.aggregate([
            { $match: { isPaid: true, createdAt: { $gte: sixMonthsAgo } } },
            {
                $group: {
                    _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
                    total: { $sum: '$totalPrice' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        res.json({
            salesAmount,
            commission: salesAmount * 0.07,
            vendorEarnings: salesAmount * 0.93,
            usersCount,
            vendorsCount,
            ordersCount,
            productsCount,
            pendingProducts,
            monthlyRevenue
        });
    } catch (e) { res.status(500).json({ message: e.message }); }
};

// ─── REPORTS ──────────────────────────────────────────────────────────────────

const getReport = async (req, res) => {
    try {
        const { type } = req.params;
        let data = [], fields = [];

        if (type === 'sales') {
            const orders = await Order.find({ isPaid: true })
                .populate('user', 'name email').sort({ paidAt: -1 });
            data = orders.map(o => ({
                orderId: o._id, customer: o.user?.name, email: o.user?.email,
                amount: o.totalPrice, status: o.status, paidAt: o.paidAt
            }));
        } else if (type === 'users') {
            const users = await User.find({}).select('-password');
            data = users.map(u => ({ id: u._id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt }));
        } else if (type === 'vendors') {
            const vendors = await User.find({ role: 'vendor' }).select('-password');
            data = vendors.map(v => ({ id: v._id, name: v.name, store: v.storeName, status: v.vendorStatus, createdAt: v.createdAt }));
        } else if (type === 'products') {
            const products = await Product.find({}).populate('vendor', 'name storeName');
            data = products.map(p => ({ id: p._id, name: p.name, vendor: p.vendor?.storeName, price: p.price, stock: p.stock, approved: p.isApproved }));
        } else {
            return res.status(400).json({ message: 'Unknown report type' });
        }

        res.json(data);
    } catch (e) { res.status(500).json({ message: e.message }); }
};

// ─── ADMIN PRODUCT CREATION ───────────────────────────────────────────────────

const createAdminProduct = async (req, res) => {
    try {
        const { name, description, price, category, stock, images, colors, sizes, tags, salesType, wholesalePrice, wholesaleMinQty } = req.body;
        if (!name || !price || !category) return res.status(400).json({ message: 'Name, price and category are required' });

        const product = await Product.create({
            name,
            description: description || '',
            price: Number(price),
            originalPrice: req.body.originalPrice ? Number(req.body.originalPrice) : undefined,
            category,
            stock: Number(stock) || 0,
            images: images || [],
            colors: colors || [],
            sizes: sizes || [],
            tags: tags || [],
            salesType: salesType || 'retail',
            wholesalePrice: wholesalePrice ? Number(wholesalePrice) : undefined,
            wholesaleMinQty: wholesaleMinQty ? Number(wholesaleMinQty) : undefined,
            vendor: req.user._id,   // admin is the vendor for these products
            isApproved: true,        // auto-approved
            isActive: true,
        });

        res.status(201).json(product);
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const updateAdminProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ message: 'Product not found' });

        const fields = ['name', 'description', 'price', 'originalPrice', 'category', 'stock', 'images', 'colors', 'sizes', 'tags', 'salesType', 'wholesalePrice', 'wholesaleMinQty', 'isActive', 'isFeatured'];
        fields.forEach(f => { if (req.body[f] !== undefined) product[f] = req.body[f]; });

        const updated = await product.save();
        res.json(updated);
    } catch (e) { res.status(500).json({ message: e.message }); }
};

// ─── SITE SETTINGS ────────────────────────────────────────────────────────────

const getSettings = async (req, res) => {
    try {
        const settings = await Setting.find({});
        res.json(settings);
    } catch (e) { res.status(500).json({ message: e.message }); }
};

const updateSettings = async (req, res) => {
    try {
        const updates = req.body;
        if (Array.isArray(updates)) {
            for (const update of updates) {
                await Setting.findOneAndUpdate({ key: update.key }, { value: update.value }, { upsert: true });
            }
            res.json({ message: 'Updated' });
        } else {
            // Fallback for single object patches (legacy code support)
            for (const [key, value] of Object.entries(updates)) {
                await Setting.findOneAndUpdate({ key }, { value }, { upsert: true });
            }
            res.json({ message: 'Updated' });
        }
    } catch (e) { res.status(500).json({ message: e.message }); }
};

module.exports = {
    getUsers, deleteUser, updateVendorStatus,
    getAllProducts, approveProduct, deleteAnyProduct, toggleFeaturedProduct,
    createAdminProduct, updateAdminProduct,
    getAllOrders, getPayments,
    getStats, getReport,
    getSettings, updateSettings,
};
