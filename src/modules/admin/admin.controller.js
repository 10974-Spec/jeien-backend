const User = require('../users/user.model');
const Vendor = require('../vendors/vendor.model');
const Product = require('../products/product.model');
const Order = require('../orders/order.model');
const Category = require('../categories/category.model');
const Review = require('../reviews/review.model');
const Message = require('../messages/message.model');

// Database reset - DANGEROUS! Admin only
const resetDatabase = async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN') {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }

        const { confirmationCode } = req.body;

        // Require confirmation code to prevent accidental resets
        if (confirmationCode !== 'RESET_ALL_DATA_PERMANENTLY') {
            return res.status(400).json({
                success: false,
                message: 'Invalid confirmation code. Please provide the correct confirmation code.'
            });
        }

        // Keep admin user but delete everything else
        const adminId = req.user.id;

        const results = {
            users: 0,
            vendors: 0,
            products: 0,
            orders: 0,
            reviews: 0,
            messages: 0
        };

        // Delete all users except admin
        const deletedUsers = await User.deleteMany({ _id: { $ne: adminId }, role: { $ne: 'ADMIN' } });
        results.users = deletedUsers.deletedCount;

        // Delete all vendors
        const deletedVendors = await Vendor.deleteMany({});
        results.vendors = deletedVendors.deletedCount;

        // Delete all products
        const deletedProducts = await Product.deleteMany({});
        results.products = deletedProducts.deletedCount;

        // Delete all orders
        const deletedOrders = await Order.deleteMany({});
        results.orders = deletedOrders.deletedCount;

        // Delete all reviews
        const deletedReviews = await Review.deleteMany({});
        results.reviews = deletedReviews.deletedCount;

        // Delete all messages
        const deletedMessages = await Message.deleteMany({});
        results.messages = deletedMessages.deletedCount;

        // Don't delete categories as they're essential for the platform

        console.log('[ADMIN] Database reset performed by:', req.user.email);
        console.log('[ADMIN] Deleted:', results);

        res.status(200).json({
            success: true,
            message: 'Database reset successfully',
            data: results
        });
    } catch (error) {
        console.error('Database reset error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reset database',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
        });
    }
};

// Get security logs (malicious activity detection)
const getSecurityLogs = async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN') {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }

        // Get suspicious activities
        const suspiciousActivities = [];

        // 1. Users with many failed login attempts (implement in auth controller)
        // 2. Orders with unusual patterns
        const highValueOrders = await Order.find({
            totalAmount: { $gt: 100000 }
        })
            .populate('user', 'name email')
            .sort({ createdAt: -1 })
            .limit(10);

        if (highValueOrders.length > 0) {
            suspiciousActivities.push({
                type: 'high_value_orders',
                count: highValueOrders.length,
                data: highValueOrders
            });
        }

        // 3. Multiple orders from same IP in short time (would need IP tracking)
        // 4. Products with suspicious pricing
        const suspiciousPricing = await Product.find({
            $or: [
                { price: { $lt: 10 } },
                { price: { $gt: 1000000 } }
            ]
        })
            .populate('vendor', 'storeName email')
            .limit(10);

        if (suspiciousPricing.length > 0) {
            suspiciousActivities.push({
                type: 'suspicious_pricing',
                count: suspiciousPricing.length,
                data: suspiciousPricing
            });
        }

        // 5. Vendors with no products but active status
        const inactiveVendors = await Vendor.find({
            status: 'ACTIVE'
        });

        const vendorsWithNoProducts = [];
        for (const vendor of inactiveVendors) {
            const productCount = await Product.countDocuments({ vendor: vendor._id });
            if (productCount === 0) {
                vendorsWithNoProducts.push(vendor);
            }
        }

        if (vendorsWithNoProducts.length > 0) {
            suspiciousActivities.push({
                type: 'inactive_vendors',
                count: vendorsWithNoProducts.length,
                data: vendorsWithNoProducts
            });
        }

        res.status(200).json({
            success: true,
            data: {
                totalSuspiciousActivities: suspiciousActivities.length,
                activities: suspiciousActivities
            }
        });
    } catch (error) {
        console.error('Get security logs error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch security logs',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
        });
    }
};

// Get payment tracking
const getPaymentTracking = async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN') {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }

        const { startDate, endDate } = req.query;

        const filter = {};
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = new Date(endDate);
        }

        // Get all orders with payment information
        const orders = await Order.find(filter)
            .populate('user', 'name email')
            .populate('vendor', 'storeName email')
            .sort({ createdAt: -1 });

        // Calculate statistics
        const stats = {
            totalOrders: orders.length,
            totalRevenue: 0,
            totalAdminCommission: 0,
            totalVendorEarnings: 0,
            paymentStatusBreakdown: {
                PENDING: 0,
                PROCESSING: 0,
                COMPLETED: 0,
                FAILED: 0,
                REFUNDED: 0
            },
            orderStatusBreakdown: {
                PENDING: 0,
                CONFIRMED: 0,
                PROCESSING: 0,
                SHIPPED: 0,
                DELIVERED: 0,
                CANCELLED: 0
            }
        };

        orders.forEach(order => {
            stats.totalRevenue += order.totalAmount || 0;
            stats.totalAdminCommission += order.adminAmount || 0;
            stats.totalVendorEarnings += order.vendorAmount || 0;

            if (order.paymentStatus) {
                stats.paymentStatusBreakdown[order.paymentStatus] =
                    (stats.paymentStatusBreakdown[order.paymentStatus] || 0) + 1;
            }

            if (order.status) {
                stats.orderStatusBreakdown[order.status] =
                    (stats.orderStatusBreakdown[order.status] || 0) + 1;
            }
        });

        res.status(200).json({
            success: true,
            data: {
                stats,
                recentOrders: orders.slice(0, 20) // Return only recent 20 orders
            }
        });
    } catch (error) {
        console.error('Get payment tracking error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch payment tracking',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
        });
    }
};

module.exports = {
    resetDatabase,
    getSecurityLogs,
    getPaymentTracking
};
