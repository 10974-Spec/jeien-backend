const Review = require('./review.model');
const Product = require('../products/product.model');
const Order = require('../orders/order.model');
const Vendor = require('../vendors/vendor.model');
const User = require('../users/user.model');
const { uploadMultipleImages } = require('../../utils/upload.util');

const createReview = async (req, res) => {
  try {
    const { productId, orderId, rating, title, comment, attributes } = req.body;
    const buyerId = req.user.id;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const existingReview = await Review.findOne({
      product: productId,
      buyer: buyerId
    });

    if (existingReview) {
      return res.status(400).json({ message: 'You have already reviewed this product' });
    }

    if (orderId) {
      const order = await Order.findOne({
        _id: orderId,
        buyer: buyerId,
        vendor: product.vendor,
        status: 'DELIVERED'
      });

      if (!order) {
        return res.status(400).json({ message: 'Order not found or not eligible for review' });
      }

      const orderHasProduct = order.items.some(item => 
        item.product.toString() === productId
      );

      if (!orderHasProduct) {
        return res.status(400).json({ message: 'This product was not in the specified order' });
      }
    }

    const vendor = await Vendor.findById(product.vendor);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    let uploadedImages = [];
    if (req.files && req.files.length > 0) {
      uploadedImages = await uploadMultipleImages(req.files, 'reviews');
    }

    const reviewData = {
      product: productId,
      order: orderId || null,
      buyer: buyerId,
      vendor: vendor._id,
      rating: parseInt(rating),
      title: title ? title.trim() : null,
      comment: comment.trim(),
      images: uploadedImages,
      attributes: attributes ? JSON.parse(attributes) : [],
      verifiedPurchase: !!orderId,
      status: vendor.settings?.allowReviews ? 'PENDING' : 'APPROVED',
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        deviceType: req.deviceType || 'unknown'
      }
    };

    const review = new Review(reviewData);
    await review.save();

    await updateProductRating(productId);
    await updateVendorRating(vendor._id);

    res.status(201).json({
      message: vendor.settings?.allowReviews ? 'Review submitted for moderation' : 'Review submitted successfully',
      review: {
        _id: review._id,
        product: review.product,
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        images: review.images,
        verifiedPurchase: review.verifiedPurchase,
        status: review.status,
        createdAt: review.createdAt
      }
    });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ message: 'Failed to create review', error: error.message });
  }
};

const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const { 
      page = 1, 
      limit = 10,
      rating,
      verified,
      sortBy = 'helpful.count',
      sortOrder = 'desc',
      withImages
    } = req.query;

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const filter = {
      product: productId,
      status: 'APPROVED'
    };

    if (rating) {
      const ratingInt = parseInt(rating);
      if (ratingInt >= 1 && ratingInt <= 5) {
        filter.rating = ratingInt;
      }
    }

    if (verified === 'true') {
      filter.verifiedPurchase = true;
    }

    if (withImages === 'true') {
      filter.images = { $exists: true, $ne: [] };
    }

    const sortOptions = {};
    if (sortBy === 'recent') {
      sortOptions.createdAt = -1;
    } else if (sortBy === 'helpful') {
      sortOptions['helpful.count'] = -1;
    } else if (sortBy === 'rating') {
      sortOptions.rating = -1;
    } else {
      sortOptions[sortBy] = sortDirection;
    }

    const reviews = await Review.find(filter)
      .populate('buyerInfo', 'name profileImage')
      .populate('reply.repliedBy', 'name')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .select('rating title comment images attributes verifiedPurchase helpful.count reply createdAt');

    const total = await Review.countDocuments(filter);

    const ratingSummary = await Review.aggregate([
      { $match: { product: product._id, status: 'APPROVED' } },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } }
    ]);

    const summary = {
      5: 0, 4: 0, 3: 0, 2: 0, 1: 0,
      total: 0,
      average: product.stats.averageRating || 0,
      withImages: 0,
      verified: 0
    };

    ratingSummary.forEach(item => {
      summary[item._id] = item.count;
      summary.total += item.count;
    });

    const imageReviews = await Review.countDocuments({
      product: productId,
      status: 'APPROVED',
      images: { $exists: true, $ne: [] }
    });

    const verifiedReviews = await Review.countDocuments({
      product: productId,
      status: 'APPROVED',
      verifiedPurchase: true
    });

    summary.withImages = imageReviews;
    summary.verified = verifiedReviews;

    res.json({
      reviews,
      summary,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get product reviews error:', error);
    res.status(500).json({ message: 'Failed to get reviews', error: error.message });
  }
};

const getVendorReviews = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user.id });
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const { 
      page = 1, 
      limit = 20,
      status,
      rating,
      productId,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const filter = { vendor: vendor._id };

    if (status) filter.status = status;
    if (rating) filter.rating = parseInt(rating);
    if (productId) filter.product = productId;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortDirection;

    const reviews = await Review.find(filter)
      .populate('product', 'title images')
      .populate('buyer', 'name profileImage')
      .populate('reply.repliedBy', 'name')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Review.countDocuments(filter);

    const stats = await Review.aggregate([
      { $match: { vendor: vendor._id } },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          averageRating: { $avg: '$rating' },
          pendingReviews: {
            $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] }
          },
          approvedReviews: {
            $sum: { $cond: [{ $eq: ['$status', 'APPROVED'] }, 1, 0] }
          },
          byRating: {
            $push: {
              rating: '$rating',
              count: 1
            }
          }
        }
      }
    ]);

    const ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    if (stats[0]?.byRating) {
      stats[0].byRating.forEach(item => {
        if (ratingDistribution[item.rating] !== undefined) {
          ratingDistribution[item.rating] += item.count;
        }
      });
    }

    res.json({
      reviews,
      stats: {
        totalReviews: stats[0]?.totalReviews || 0,
        averageRating: stats[0]?.averageRating || 0,
        pendingReviews: stats[0]?.pendingReviews || 0,
        approvedReviews: stats[0]?.approvedReviews || 0,
        ratingDistribution
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get vendor reviews error:', error);
    res.status(500).json({ message: 'Failed to get reviews', error: error.message });
  }
};

const updateReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, title, comment, attributes } = req.body;

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    if (review.buyer.toString() !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Not authorized to update this review' });
    }

    const oldRating = review.rating;
    const oldComment = review.comment;

    if (rating) review.rating = parseInt(rating);
    if (title !== undefined) review.title = title ? title.trim() : null;
    if (comment) review.comment = comment.trim();
    if (attributes) review.attributes = JSON.parse(attributes);

    if (req.files && req.files.length > 0) {
      const newImages = await uploadMultipleImages(req.files, 'reviews');
      review.images = [...review.images, ...newImages].slice(0, 5);
    }

    review.editHistory.push({
      comment: oldComment,
      rating: oldRating,
      editedAt: new Date(),
      editedBy: req.user.id
    });

    review.flags.isEdited = true;
    review.status = 'PENDING';

    await review.save();

    if (oldRating !== review.rating) {
      await updateProductRating(review.product);
      await updateVendorRating(review.vendor);
    }

    res.json({
      message: 'Review updated successfully. Waiting for moderation.',
      review: {
        _id: review._id,
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        images: review.images,
        status: review.status,
        updatedAt: review.updatedAt
      }
    });
  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({ message: 'Failed to update review', error: error.message });
  }
};

const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    if (review.buyer.toString() !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Not authorized to delete this review' });
    }

    const productId = review.product;
    const vendorId = review.vendor;

    await Review.findByIdAndDelete(id);

    await updateProductRating(productId);
    await updateVendorRating(vendorId);

    res.json({
      message: 'Review deleted successfully'
    });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ message: 'Failed to delete review', error: error.message });
  }
};

const addReplyToReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    const vendor = await Vendor.findOne({ user: req.user.id });
    if (!vendor || review.vendor.toString() !== vendor._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to reply to this review' });
    }

    if (review.reply && review.reply.comment) {
      return res.status(400).json({ message: 'A reply already exists for this review' });
    }

    review.reply = {
      comment: comment.trim(),
      repliedBy: req.user.id,
      repliedAt: new Date(),
      updatedAt: new Date()
    };

    review.flags.hasReply = true;
    await review.save();

    res.json({
      message: 'Reply added successfully',
      reply: review.reply
    });
  } catch (error) {
    console.error('Add reply error:', error);
    res.status(500).json({ message: 'Failed to add reply', error: error.message });
  }
};

const updateReply = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    if (!review.reply || !review.reply.comment) {
      return res.status(400).json({ message: 'No reply exists for this review' });
    }

    const vendor = await Vendor.findOne({ user: req.user.id });
    if (!vendor || review.vendor.toString() !== vendor._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this reply' });
    }

    if (review.reply.repliedBy.toString() !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Not authorized to update this reply' });
    }

    review.reply.comment = comment.trim();
    review.reply.updatedAt = new Date();

    await review.save();

    res.json({
      message: 'Reply updated successfully',
      reply: review.reply
    });
  } catch (error) {
    console.error('Update reply error:', error);
    res.status(500).json({ message: 'Failed to update reply', error: error.message });
  }
};

const markHelpful = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    if (review.buyer.toString() === userId) {
      return res.status(400).json({ message: 'Cannot mark your own review as helpful' });
    }

    const alreadyVoted = review.helpfulVotes.some(vote => 
      vote.user.toString() === userId
    );

    if (alreadyVoted) {
      return res.status(400).json({ message: 'You have already marked this review as helpful' });
    }

    review.helpfulVotes.push({
      user: userId,
      votedAt: new Date()
    });

    await review.save();

    res.json({
      message: 'Marked as helpful',
      helpfulCount: review.helpful.count
    });
  } catch (error) {
    console.error('Mark helpful error:', error);
    res.status(500).json({ message: 'Failed to mark as helpful', error: error.message });
  }
};

const reportReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, comment } = req.body;
    const userId = req.user.id;

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    if (review.buyer.toString() === userId) {
      return res.status(400).json({ message: 'Cannot report your own review' });
    }

    const alreadyReported = review.reported.reasons.some(report => 
      report.user.toString() === userId
    );

    if (alreadyReported) {
      return res.status(400).json({ message: 'You have already reported this review' });
    }

    review.reported.count += 1;
    review.reported.reasons.push({
      user: userId,
      reason,
      comment: comment || '',
      reportedAt: new Date()
    });

    if (review.reported.count >= 3 && review.status !== 'HIDDEN') {
      review.status = 'HIDDEN';
      review.moderatorNotes = 'Auto-hidden due to multiple reports';
    }

    await review.save();

    res.json({
      message: 'Review reported successfully',
      reportCount: review.reported.count
    });
  } catch (error) {
    console.error('Report review error:', error);
    res.status(500).json({ message: 'Failed to report review', error: error.message });
  }
};

const moderateReview = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { id } = req.params;
    const { status, moderatorNotes } = req.body;

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    if (!['APPROVED', 'REJECTED', 'HIDDEN'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const oldStatus = review.status;
    review.status = status;
    review.moderatedBy = req.user.id;
    review.moderatedAt = new Date();
    
    if (moderatorNotes) {
      review.moderatorNotes = moderatorNotes;
    }

    await review.save();

    if (status === 'APPROVED' && oldStatus !== 'APPROVED') {
      await updateProductRating(review.product);
      await updateVendorRating(review.vendor);
    } else if (oldStatus === 'APPROVED' && status !== 'APPROVED') {
      await updateProductRating(review.product);
      await updateVendorRating(review.vendor);
    }

    res.json({
      message: `Review ${status.toLowerCase()} successfully`,
      review: {
        _id: review._id,
        status: review.status,
        moderatedBy: review.moderatedBy,
        moderatedAt: review.moderatedAt,
        moderatorNotes: review.moderatorNotes
      }
    });
  } catch (error) {
    console.error('Moderate review error:', error);
    res.status(500).json({ message: 'Failed to moderate review', error: error.message });
  }
};

const updateProductRating = async (productId) => {
  try {
    const reviews = await Review.find({
      product: productId,
      status: 'APPROVED'
    });

    if (reviews.length === 0) {
      await Product.findByIdAndUpdate(productId, {
        'stats.averageRating': 0,
        'stats.totalReviews': 0
      });
      return;
    }

    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / reviews.length;

    await Product.findByIdAndUpdate(productId, {
      'stats.averageRating': parseFloat(averageRating.toFixed(1)),
      'stats.totalReviews': reviews.length
    });
  } catch (error) {
    console.error('Update product rating error:', error);
  }
};

const updateVendorRating = async (vendorId) => {
  try {
    const reviews = await Review.aggregate([
      { $match: { vendor: vendorId, status: 'APPROVED' } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 }
        }
      }
    ]);

    if (reviews.length === 0) {
      await Vendor.findByIdAndUpdate(vendorId, {
        'stats.averageRating': 0,
        'stats.totalReviews': 0
      });
      return;
    }

    await Vendor.findByIdAndUpdate(vendorId, {
      'stats.averageRating': parseFloat(reviews[0].averageRating.toFixed(1)),
      'stats.totalReviews': reviews[0].totalReviews
    });
  } catch (error) {
    console.error('Update vendor rating error:', error);
  }
};

const getAllReviews = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { 
      page = 1, 
      limit = 50,
      status,
      rating,
      vendorId,
      productId,
      buyerId,
      startDate,
      endDate,
      hasReply,
      hasImages,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const filter = {};

    if (status) filter.status = status;
    if (rating) filter.rating = parseInt(rating);
    if (vendorId) filter.vendor = vendorId;
    if (productId) filter.product = productId;
    if (buyerId) filter.buyer = buyerId;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    if (hasReply === 'true') {
      filter['reply.comment'] = { $exists: true, $ne: '' };
    } else if (hasReply === 'false') {
      filter['reply.comment'] = { $exists: false };
    }

    if (hasImages === 'true') {
      filter.images = { $exists: true, $ne: [] };
    } else if (hasImages === 'false') {
      filter.images = { $exists: false };
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortDirection;

    const reviews = await Review.find(filter)
      .populate('product', 'title')
      .populate('vendor', 'storeName')
      .populate('buyer', 'name email')
      .populate('moderatedBy', 'name')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Review.countDocuments(filter);

    const stats = await Review.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          averageRating: { $avg: '$rating' },
          pendingCount: {
            $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] }
          },
          approvedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'APPROVED'] }, 1, 0] }
          },
          rejectedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'REJECTED'] }, 1, 0] }
          },
          reportedCount: { $sum: '$reported.count' }
        }
      }
    ]);

    res.json({
      reviews,
      stats: stats[0] || {
        totalReviews: 0,
        averageRating: 0,
        pendingCount: 0,
        approvedCount: 0,
        rejectedCount: 0,
        reportedCount: 0
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get all reviews error:', error);
    res.status(500).json({ message: 'Failed to get reviews', error: error.message });
  }
};

module.exports = {
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
};