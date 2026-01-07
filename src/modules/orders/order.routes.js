const express = require('express');
const router = express.Router();
const authenticate = require('../../middlewares/auth.middleware');
const { adminOnly } = require('../../middlewares/role.middleware');
const {
  createOrder,
  getMyOrders,
  getOrderById,
  updateOrderStatus,
  updatePaymentStatus,
  getAllOrders,
  cancelOrder,
  trackOrder
} = require('./order.controller');

router.post('/', authenticate, createOrder);
router.get('/my', authenticate, getMyOrders);
router.get('/:id', authenticate, getOrderById);
router.put('/:id/status', authenticate, updateOrderStatus);
router.put('/:id/cancel', authenticate, cancelOrder);
router.get('/track/:orderId', trackOrder);

router.put('/:id/payment-status', authenticate, adminOnly, updatePaymentStatus);
router.get('/admin/all', authenticate, adminOnly, getAllOrders);

module.exports = router;