const express = require('express');
const router = express.Router();
const authenticate = require('../../middlewares/auth.middleware');
const { adminOnly } = require('../../middlewares/role.middleware');
const { singleUpload, debugMulter } = require('../../config/upload');
const {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  getCategoryProducts,
  updateCategoryStats,
  getFeaturedCategories
} = require('./category.controller');

// Routes with proper middleware order
router.post('/', authenticate, adminOnly, debugMulter, singleUpload, createCategory);
router.get('/', getAllCategories);
router.get('/featured', getFeaturedCategories);
router.get('/:id', getCategoryById);
router.put('/:id', authenticate, adminOnly, debugMulter, singleUpload, updateCategory);
router.delete('/:id', authenticate, adminOnly, deleteCategory);
router.get('/:id/products', getCategoryProducts);
router.put('/stats/update', authenticate, adminOnly, updateCategoryStats);

module.exports = router;