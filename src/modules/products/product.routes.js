const express = require('express');
const router = express.Router();
const authenticate = require('../../middlewares/auth.middleware');
const { vendorOrAdmin, adminOnly } = require('../../middlewares/role.middleware');
const { multipleUpload } = require('../../config/multer');
const rateLimit = require('express-rate-limit');

// Rate limiting middleware
const updateRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 requests per windowMs
  message: {
    success: false,
    message: 'Too many update requests, please try again later'
  }
});

const createRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message: 'Too many create requests, please try again later'
  }
});

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

// Apply rate limiting
router.post('/', authenticate, vendorOrAdmin, createRateLimiter, multipleUpload, createProduct);
router.get('/', getAllProducts);
router.get('/search', searchProducts);
router.get('/vendor/my', authenticate, vendorOrAdmin, getVendorProducts); // Moved before /:id
router.get('/:id', getProductById);
router.put('/:id', authenticate, vendorOrAdmin, updateRateLimiter, multipleUpload, updateProduct);
router.delete('/:id', authenticate, vendorOrAdmin, deleteProduct);

router.put('/:id/stock', authenticate, vendorOrAdmin, updateProductStock);
router.put('/bulk/update', authenticate, vendorOrAdmin, bulkUpdateProducts);

module.exports = router;