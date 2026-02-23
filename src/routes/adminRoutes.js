const express = require('express');
const router = express.Router();
const {
    getUsers, deleteUser, deleteUsersBulk, updateVendorStatus, createAdminUser, updateUser, broadcastMessage, getMessages,
    getAllProducts, approveProduct, deleteAnyProduct, toggleFeaturedProduct,
    createAdminProduct, updateAdminProduct,
    getAllOrders, getPayments, cancelOrder, updateOrderStatus,
    getStats, getReport,
    getSettings, updateSettings,
    getSecurityLogs,
    getReviews, updateReviewStatus, deleteReview,
    getShippingZones, createShippingZone, updateShippingZone, deleteShippingZone
} = require('../controllers/adminController');
const { protect, admin } = require('../middleware/authMiddleware');

router.use(protect, admin);

// Users
router.get('/users', getUsers);
router.post('/users', createAdminUser);
router.delete('/users/bulk', deleteUsersBulk);
router.delete('/users/:id', deleteUser);
router.put('/users/:id', updateUser);
router.put('/vendor/:id/verify', updateVendorStatus);
router.post('/broadcast', broadcastMessage);
router.get('/messages', getMessages);

// Products — admin CRUD
router.get('/products', getAllProducts);
router.post('/products', createAdminProduct);                  // ← Admin create product
router.put('/products/:id', updateAdminProduct);               // ← Admin edit product
router.put('/products/:id/approve', approveProduct);
router.delete('/products/:id', deleteAnyProduct);
router.put('/products/:id/feature', toggleFeaturedProduct);

// Orders & Payments
router.get('/orders', getAllOrders);
router.put('/orders/:id/status', updateOrderStatus);
router.put('/orders/:id/cancel', cancelOrder);
router.get('/payments', getPayments);

// Stats & Reports
router.get('/stats', getStats);
router.get('/reports/:type', getReport);

// Site Settings
router.get('/settings', getSettings);
router.put('/settings', updateSettings);

// Security
router.get('/security/logs', getSecurityLogs);

// Reviews
router.get('/reviews', getReviews);
router.put('/reviews/:id/status', updateReviewStatus);
router.delete('/reviews/:id', deleteReview);

// Shipping Zones
router.route('/shipping-zones')
    .get(getShippingZones)
    .post(createShippingZone);

router.route('/shipping-zones/:id')
    .put(updateShippingZone)
    .delete(deleteShippingZone);

module.exports = router;
