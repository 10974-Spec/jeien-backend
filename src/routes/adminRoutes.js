const express = require('express');
const router = express.Router();
const {
    getUsers, deleteUser, deleteUsersBulk, updateVendorStatus, createAdminUser, updateUser, broadcastMessage,
    getAllProducts, approveProduct, deleteAnyProduct, toggleFeaturedProduct,
    createAdminProduct, updateAdminProduct,
    getAllOrders, getPayments, cancelOrder, updateOrderStatus,
    getStats, getReport,
    getSettings, updateSettings,
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

module.exports = router;
