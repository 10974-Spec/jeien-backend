const Notification = require('../modules/notifications/notification.model');
const User = require('../modules/users/user.model');

/**
 * Create a notification for admin users
 * @param {String} type - Notification type
 * @param {String} title - Notification title
 * @param {String} message - Notification message
 * @param {Object} data - Additional data (orderId, userId, productId, etc.)
 */
const createNotification = async (type, title, message, data = {}) => {
    try {
        // Get all admin users
        const adminUsers = await User.find({ role: 'ADMIN' }).select('_id');

        if (adminUsers.length === 0) {
            console.warn('No admin users found to send notification');
            return;
        }

        // Create notification for each admin
        const notifications = adminUsers.map(admin => ({
            type,
            title,
            message,
            data,
            recipient: admin._id,
            read: false
        }));

        await Notification.insertMany(notifications);
        console.log(`Created ${notifications.length} notifications of type: ${type}`);
    } catch (error) {
        console.error('Create notification error:', error);
        // Don't throw error - notifications are non-critical
    }
};

/**
 * Create notification for new order
 */
const notifyOrderCreated = async (order) => {
    await createNotification(
        'ORDER_CREATED',
        'New Order Received',
        `Order #${order.orderNumber || order._id.toString().slice(-6)} - KES ${order.totalAmount.toLocaleString()}`,
        {
            orderId: order._id,
            userId: order.user,
            amount: order.totalAmount,
            status: order.status
        }
    );
};

/**
 * Create notification for new user registration
 */
const notifyUserRegistered = async (user) => {
    await createNotification(
        'USER_REGISTERED',
        'New User Registered',
        `${user.name} (${user.email}) joined the platform`,
        {
            userId: user._id,
            extra: { role: user.role }
        }
    );
};

/**
 * Create notification for new vendor registration
 */
const notifyVendorRegistered = async (vendor, user) => {
    await createNotification(
        'VENDOR_REGISTERED',
        'New Vendor Registered',
        `${vendor.storeName} by ${user.name}`,
        {
            vendorId: vendor._id,
            userId: user._id
        }
    );
};

/**
 * Create notification for product publication
 */
const notifyProductPublished = async (product) => {
    await createNotification(
        'PRODUCT_PUBLISHED',
        'New Product Published',
        `${product.title} - KES ${product.price.toLocaleString()}`,
        {
            productId: product._id,
            vendorId: product.vendor,
            amount: product.price
        }
    );
};

/**
 * Create notification for product deletion
 */
const notifyProductDeleted = async (product) => {
    await createNotification(
        'PRODUCT_DELETED',
        'Product Deleted',
        `${product.title} was removed from the platform`,
        {
            productId: product._id,
            vendorId: product.vendor
        }
    );
};

/**
 * Create notification for low stock
 */
const notifyLowStock = async (product) => {
    await createNotification(
        'LOW_STOCK',
        'Low Stock Alert',
        `${product.title} - Only ${product.stock} items left`,
        {
            productId: product._id,
            vendorId: product.vendor,
            quantity: product.stock
        }
    );
};

/**
 * Create notification for payment received
 */
const notifyPaymentReceived = async (payment, order) => {
    await createNotification(
        'PAYMENT_RECEIVED',
        'Payment Received',
        `Payment of KES ${payment.amount.toLocaleString()} received`,
        {
            orderId: order._id,
            userId: order.user,
            amount: payment.amount,
            extra: { paymentMethod: payment.method }
        }
    );
};

module.exports = {
    createNotification,
    notifyOrderCreated,
    notifyUserRegistered,
    notifyVendorRegistered,
    notifyProductPublished,
    notifyProductDeleted,
    notifyLowStock,
    notifyPaymentReceived
};
