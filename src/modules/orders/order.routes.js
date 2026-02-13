const express = require('express');
const router = express.Router();
const authenticate = require('../../middlewares/auth.middleware');
const { adminOnly } = require('../../middlewares/role.middleware');
const orderController = require('./order.controller');

// Public routes
router.get('/track/:orderId', orderController.trackOrder);

// Authenticated routes for buyers
router.post('/', authenticate, orderController.createOrder);
router.get('/user/me', authenticate, orderController.getUserOrders);
router.get('/search', authenticate, orderController.searchOrders);
router.get('/:id', authenticate, orderController.getOrderById);
router.post('/:id/cancel', authenticate, orderController.cancelOrder);

// Order status updates (buyer can cancel, admin/vendor can update status)
router.put('/:id/status', authenticate, orderController.updateOrderStatus);

// Payment status updates (admin only)
router.put('/:id/payment', authenticate, adminOnly, orderController.updatePaymentStatus);

// Vendor routes (using adminOnly if vendorOnly doesn't exist)
router.get('/vendor/orders', authenticate, adminOnly, orderController.getVendorOrders);

// Admin routes
router.get('/admin/all', authenticate, adminOnly, orderController.getAdminOrders);
router.delete('/:id', authenticate, adminOnly, orderController.deleteOrder);
router.post('/admin/clear', authenticate, adminOnly, orderController.clearOrders);

module.exports = router;