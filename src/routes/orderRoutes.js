const express = require('express');
const router = express.Router();
const {
    addOrderItems,
    getOrderById,
    updateOrderToPaid,
    updateOrderToDelivered,
    updateOrderToCompleted,
    getMyOrders,
    getOrders,
    getVendorOrders,
    updateOrderItemStatus,
} = require('../controllers/orderController');
const { protect, admin, vendor } = require('../middleware/authMiddleware');

router.route('/').post(protect, addOrderItems).get(protect, admin, getOrders);
router.route('/myorders').get(protect, getMyOrders);
router.route('/vendor').get(protect, vendor, getVendorOrders);
router.route('/:id').get(protect, getOrderById);
router.route('/:id/pay').put(protect, updateOrderToPaid);
router.route('/:id/deliver').put(protect, admin, updateOrderToDelivered);
router.route('/:id/complete').put(protect, updateOrderToCompleted);
router.route('/:id/items/:itemId/status').put(protect, vendor, updateOrderItemStatus);

module.exports = router;
