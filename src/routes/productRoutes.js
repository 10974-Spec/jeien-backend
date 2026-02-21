const express = require('express');
const router = express.Router();
const { getProducts, getMyProducts, getProductById, createProduct, updateProduct, deleteProduct } = require('../controllers/productController');
const { protect, vendor } = require('../middleware/authMiddleware');
const { parser } = require('../config/cloudinary');

router.get('/mine', protect, vendor, getMyProducts);

router.route('/')
    .get(getProducts)
    .post(protect, vendor, parser.array('images', 5), createProduct);

router.route('/:id')
    .get(getProductById)
    .put(protect, vendor, parser.array('images', 5), updateProduct)
    .delete(protect, vendor, deleteProduct);

module.exports = router;
