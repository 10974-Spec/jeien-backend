const express = require('express');
const router = express.Router();
const authenticate = require('../../middlewares/auth.middleware');
const { vendorOrAdmin, adminOnly } = require('../../middlewares/role.middleware');
const { multipleUpload } = require('../../config/upload');
const {
  createReview,
  getProductReviews,
  getVendorReviews,
  updateReview,
  deleteReview,
  addReplyToReview,
  updateReply,
  markHelpful,
  reportReview,
  moderateReview,
  getAllReviews
} = require('./review.controller');

router.post('/', authenticate, multipleUpload, createReview);
router.get('/product/:productId', getProductReviews);
router.get('/vendor/my', authenticate, vendorOrAdmin, getVendorReviews);
router.put('/:id', authenticate, multipleUpload, updateReview);
router.delete('/:id', authenticate, deleteReview);

router.post('/:id/reply', authenticate, vendorOrAdmin, addReplyToReview);
router.put('/:id/reply', authenticate, vendorOrAdmin, updateReply);
router.post('/:id/helpful', authenticate, markHelpful);
router.post('/:id/report', authenticate, reportReview);

router.put('/:id/moderate', authenticate, adminOnly, moderateReview);
router.get('/admin/all', authenticate, adminOnly, getAllReviews);

module.exports = router;