const express = require('express');
const router = express.Router();
const authenticate = require('../../middlewares/auth.middleware');
const { vendorOrAdmin, adminOnly } = require('../../middlewares/role.middleware');
const { multipleUpload, debugMulter } = require('../../config/multer'); // Use fixed multer
const {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getVendorProducts,
  updateProductStock,
  bulkUpdateProducts,
  searchProducts
} = require('./product.controller');

// Add debug middleware for uploads
router.post('/', authenticate, vendorOrAdmin, debugMulter, multipleUpload, createProduct);
router.get('/', getAllProducts);
router.get('/search', searchProducts);
router.get('/:id', getProductById);
router.put('/:id', authenticate, vendorOrAdmin, multipleUpload, updateProduct);
router.delete('/:id', authenticate, vendorOrAdmin, deleteProduct);

router.get('/vendor/my', authenticate, vendorOrAdmin, getVendorProducts);
router.put('/:id/stock', authenticate, vendorOrAdmin, updateProductStock);
router.put('/bulk/update', authenticate, vendorOrAdmin, bulkUpdateProducts);

module.exports = router;