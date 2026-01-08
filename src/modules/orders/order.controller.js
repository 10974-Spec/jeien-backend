const Order = require('./order.model');
const Product = require('../products/product.model');
const Vendor = require('../vendors/vendor.model');
const Category = require('../categories/category.model');
const User = require('../users/user.model');
const { processOrderCommission } = require('../../utils/commission.util');

const generateOrderId = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9).toUpperCase();
  return `ORD-${timestamp}-${random}`;
};
const createOrder = async (req, res) => {
  try {
    const buyerId = req.user.id;
    const { items, deliveryAddress, paymentMethod, shippingMethod, customerNotes, flags } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Order must contain at least one item' });
    }

    if (!deliveryAddress || !deliveryAddress.fullName || !deliveryAddress.phone || !deliveryAddress.country || !deliveryAddress.city || !deliveryAddress.street) {
      return res.status(400).json({ message: 'Complete delivery address is required' });
    }

    const buyer = await User.findById(buyerId);
    if (!buyer) {
      return res.status(404).json({ message: 'Buyer not found' });
    }

    let subtotal = 0;
    let shippingCost = 0;
    const orderItems = [];
    const productUpdates = [];
    const vendorIds = new Set();

    for (const item of items) {
      const product = await Product.findById(item.productId)
        .populate('category')
        .populate('vendor');

      if (!product) {
        return res.status(404).json({ message: `Product not found: ${item.productId}` });
      }

      if (!product.approved || !product.published) {
        return res.status(400).json({ message: `Product ${product.title} is not available for purchase` });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({ 
          message: `Insufficient stock for ${product.title}. Available: ${product.stock}, Requested: ${item.quantity}` 
        });
      }

      if (product.price !== item.price) {
        return res.status(400).json({ message: `Price mismatch for ${product.title}` });
      }

      const itemTotal = product.price * item.quantity;
      subtotal += itemTotal;

      if (product.shipping && product.shipping.cost) {
        shippingCost += product.shipping.cost;
      }

      orderItems.push({
        product: product._id,
        title: product.title,
        price: product.price,
        quantity: item.quantity,
        image: product.images[0],
        category: product.category._id,
        attributes: item.attributes || [],
        variant: item.variant || null
      });

      vendorIds.add(product.vendor._id);

      productUpdates.push({
        productId: product._id,
        price: product.price, // ADD THIS LINE
        quantity: item.quantity
      });
    }

    if (vendorIds.size > 1) {
      return res.status(400).json({ message: 'All items must be from the same vendor' });
    }

    const vendorId = Array.from(vendorIds)[0];
    const vendor = await Vendor.findById(vendorId);
    if (!vendor || !vendor.active) {
      return res.status(400).json({ message: 'Vendor is not active' });
    }

    const taxAmount = subtotal * 0.16;
    const totalAmount = subtotal + shippingCost + taxAmount;

    const commissionData = await processOrderCommission(
      { items: orderItems },
      Category
    );

    const order = new Order({
      orderId: generateOrderId(),
      buyer: buyerId,
      vendor: vendorId,
      items: orderItems,
      deliveryAddress: {
        ...deliveryAddress,
        email: deliveryAddress.email || buyer.email
      },
      subtotal: parseFloat(subtotal.toFixed(2)),
      shippingCost: parseFloat(shippingCost.toFixed(2)),
      taxAmount: parseFloat(taxAmount.toFixed(2)),
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      commissionAmount: parseFloat(commissionData.totalCommission.toFixed(2)),
      vendorAmount: parseFloat((totalAmount - commissionData.totalCommission).toFixed(2)),
      paymentMethod,
      paymentStatus: 'PENDING',
      status: 'PENDING',
      shippingMethod: shippingMethod || 'Standard',
      customerNotes: customerNotes || '',
      flags: flags || {},
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        deviceType: req.deviceType || 'unknown',
        browser: req.browser || 'unknown'
      }
    });

    await order.save();

    for (const update of productUpdates) {
      const revenue = update.price * update.quantity;
      
      await Product.findByIdAndUpdate(update.productId, {
        $inc: { 
          stock: -update.quantity,
          'stats.sales': update.quantity,
          'stats.revenue': revenue // FIX: Use the calculated revenue
        }
      });
    }

    await Vendor.findByIdAndUpdate(vendorId, {
      $inc: { 
        'stats.totalOrders': 1,
        'stats.totalSales': 1,
        'stats.totalRevenue': totalAmount
      }
    });

    res.status(201).json({
      message: 'Order created successfully',
      order: {
        _id: order._id,
        orderId: order.orderId,
        totalAmount: order.totalAmount,
        items: order.items,
        vendor: order.vendor,
        status: order.status,
        paymentStatus: order.paymentStatus
      }
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ message: 'Failed to create order', error: error.message });
  }

  // In your order.controller.js or wherever orders are created
console.log('Order being saved to database:', {
  totalAmount: order.totalAmount,
  type: typeof order.totalAmount,
  stringValue: order.totalAmount.toString()
});
 };

const getMyOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      page = 1, 
      limit = 20,
      status,
      paymentStatus,
      vendorId,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const filter = {};

    if (req.user.role === 'BUYER') {
      filter.buyer = userId;
    } else if (req.user.role === 'VENDOR' || req.user.role === 'ADMIN') {
      const vendor = await Vendor.findOne({ user: userId });
      if (!vendor && req.user.role === 'VENDOR') {
        return res.status(404).json({ message: 'Vendor not found' });
      }
      filter.vendor = vendor ? vendor._id : null;
    }

    if (status) filter.status = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (vendorId && req.user.role === 'ADMIN') filter.vendor = vendorId;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortDirection;

    const orders = await Order.find(filter)
      .populate(req.user.role === 'BUYER' ? 'vendor' : 'buyer', 'name email profileImage storeName')
      .populate('items.product', 'title images slug')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .select('orderId items totalAmount status paymentStatus createdAt deliveryAddress');

    const total = await Order.countDocuments(filter);

    const stats = await Order.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          pendingOrders: { $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] } },
          completedOrders: { $sum: { $cond: [{ $eq: ['$status', 'DELIVERED'] }, 1, 0] } },
          cancelledOrders: { $sum: { $cond: [{ $eq: ['$status', 'CANCELLED'] }, 1, 0] } }
        }
      }
    ]);

    res.json({
      orders,
      stats: stats[0] || {
        totalOrders: 0,
        totalAmount: 0,
        pendingOrders: 0,
        completedOrders: 0,
        cancelledOrders: 0
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get my orders error:', error);
    res.status(500).json({ message: 'Failed to get orders', error: error.message });
  }
};

const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const order = await Order.findById(id)
      .populate('buyer', 'name email profileImage phone')
      .populate('vendor', 'storeName storeLogo contactInfo')
      .populate('items.product', 'title images slug category');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (req.user.role === 'BUYER' && order.buyer._id.toString() !== userId) {
      return res.status(403).json({ message: 'Not authorized to view this order' });
    }

    if (req.user.role === 'VENDOR') {
      const vendor = await Vendor.findOne({ user: userId });
      if (!vendor || order.vendor._id.toString() !== vendor._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to view this order' });
      }
    }

    if (req.user.role !== 'ADMIN' && order.buyer._id.toString() !== userId && order.vendor.user.toString() !== userId) {
      return res.status(403).json({ message: 'Not authorized to view this order' });
    }

    const categoryIds = order.items.map(item => item.product?.category).filter(Boolean);
    const categories = await Category.find({ _id: { $in: categoryIds } });

    const orderWithCategories = {
      ...order.toObject(),
      categories: categories.reduce((acc, cat) => {
        acc[cat._id] = cat;
        return acc;
      }, {})
    };

    res.json(orderWithCategories);
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ message: 'Failed to get order', error: error.message });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, trackingNumber, shippingProvider, estimatedDelivery, cancellationReason } = req.body;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    let vendor = null;
    if (req.user.role === 'VENDOR') {
      vendor = await Vendor.findOne({ user: req.user.id });
      if (!vendor || order.vendor.toString() !== vendor._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to update this order' });
      }
    }

    if (!['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'].includes(status)) {
      return res.status(400).json({ message: 'Invalid order status' });
    }

    if (order.status === 'CANCELLED' || order.status === 'DELIVERED') {
      return res.status(400).json({ message: `Cannot update ${order.status.toLowerCase()} order` });
    }

    const oldStatus = order.status;
    order.status = status;

    if (status === 'CANCELLED') {
      if (!cancellationReason && req.user.role === 'VENDOR') {
        return res.status(400).json({ message: 'Cancellation reason is required' });
      }
      order.cancelledAt = new Date();
      order.cancellationReason = cancellationReason || order.cancellationReason;

      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { stock: item.quantity }
        });
      }
    } else if (status === 'DELIVERED') {
      order.deliveredAt = new Date();
    } else if (status === 'SHIPPED') {
      if (trackingNumber) order.trackingNumber = trackingNumber;
      if (shippingProvider) order.shippingProvider = shippingProvider;
      if (estimatedDelivery) order.estimatedDelivery = new Date(estimatedDelivery);
    }

    if (notes) order.notes = notes;

    await order.save();

    if (vendor) {
      if (status === 'DELIVERED') {
        await Vendor.findByIdAndUpdate(vendor._id, {
          $inc: { 'performance.fulfillmentRate': 1 }
        });
      }
    }

    res.json({
      message: `Order status updated from ${oldStatus} to ${status}`,
      order: {
        _id: order._id,
        orderId: order.orderId,
        status: order.status,
        trackingNumber: order.trackingNumber,
        estimatedDelivery: order.estimatedDelivery
      }
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ message: 'Failed to update order status', error: error.message });
  }
};

const updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentStatus, transactionId, reference, paidAt, receiptUrl } = req.body;

    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (!['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(paymentStatus)) {
      return res.status(400).json({ message: 'Invalid payment status' });
    }

    const oldPaymentStatus = order.paymentStatus;
    order.paymentStatus = paymentStatus;

    if (paymentStatus === 'COMPLETED') {
      order.paymentDetails = {
        transactionId: transactionId || order.paymentDetails?.transactionId,
        reference: reference || order.paymentDetails?.reference,
        provider: order.paymentMethod,
        paidAt: paidAt ? new Date(paidAt) : new Date(),
        receiptUrl: receiptUrl || order.paymentDetails?.receiptUrl
      };

      if (order.status === 'PENDING') {
        order.status = 'PROCESSING';
      }
    }

    await order.save();

    res.json({
      message: `Payment status updated from ${oldPaymentStatus} to ${paymentStatus}`,
      order: {
        _id: order._id,
        orderId: order.orderId,
        paymentStatus: order.paymentStatus,
        status: order.status
      }
    });
  } catch (error) {
    console.error('Update payment status error:', error);
    res.status(500).json({ message: 'Failed to update payment status', error: error.message });
  }
};

const getAllOrders = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { 
      page = 1, 
      limit = 50,
      status,
      paymentStatus,
      vendorId,
      buyerId,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const filter = {};

    if (status) filter.status = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (vendorId) filter.vendor = vendorId;
    if (buyerId) filter.buyer = buyerId;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    if (minAmount !== undefined || maxAmount !== undefined) {
      filter.totalAmount = {};
      if (minAmount !== undefined) filter.totalAmount.$gte = parseFloat(minAmount);
      if (maxAmount !== undefined) filter.totalAmount.$lte = parseFloat(maxAmount);
    }

    if (search) {
      filter.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { 'deliveryAddress.fullName': { $regex: search, $options: 'i' } },
        { 'deliveryAddress.phone': { $regex: search, $options: 'i' } },
        { 'deliveryAddress.email': { $regex: search, $options: 'i' } },
        { 'paymentDetails.transactionId': { $regex: search, $options: 'i' } },
        { trackingNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortDirection;

    const orders = await Order.find(filter)
      .populate('buyer', 'name email')
      .populate('vendor', 'storeName')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .select('orderId buyer vendor totalAmount status paymentStatus createdAt deliveryAddress.phone deliveryAddress.city');

    const total = await Order.countDocuments(filter);

    const analytics = await Order.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          totalCommission: { $sum: '$commissionAmount' },
          avgOrderValue: { $avg: '$totalAmount' },
          byStatus: {
            $push: {
              status: '$status',
              amount: '$totalAmount'
            }
          },
          byPaymentStatus: {
            $push: {
              paymentStatus: '$paymentStatus',
              amount: '$totalAmount'
            }
          }
        }
      }
    ]);

    const dailyStats = await Order.aggregate([
      { $match: { ...filter, createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          orders: { $sum: 1 },
          revenue: { $sum: '$totalAmount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      orders,
      analytics: analytics[0] || {
        totalOrders: 0,
        totalRevenue: 0,
        totalCommission: 0,
        avgOrderValue: 0,
        byStatus: [],
        byPaymentStatus: []
      },
      dailyStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({ message: 'Failed to get orders', error: error.message });
  }
};

const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.buyer.toString() !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Not authorized to cancel this order' });
    }

    if (order.status !== 'PENDING' && order.status !== 'PROCESSING') {
      return res.status(400).json({ message: `Cannot cancel order with status: ${order.status}` });
    }

    if (order.paymentStatus === 'COMPLETED') {
      return res.status(400).json({ message: 'Cannot cancel order with completed payment' });
    }

    order.status = 'CANCELLED';
    order.cancelledAt = new Date();
    order.cancellationReason = reason || 'Cancelled by customer';

    if (order.paymentStatus === 'PENDING' || order.paymentStatus === 'PROCESSING') {
      order.paymentStatus = 'FAILED';
    }

    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.quantity }
      });
    }

    await order.save();

    res.json({
      message: 'Order cancelled successfully',
      order: {
        _id: order._id,
        orderId: order.orderId,
        status: order.status,
        cancellationReason: order.cancellationReason
      }
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({ message: 'Failed to cancel order', error: error.message });
  }
};

const trackOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId })
      .populate('vendor', 'storeName storeLogo contactInfo')
      .select('orderId status paymentStatus trackingNumber shippingProvider estimatedDelivery deliveredAt createdAt items totalAmount deliveryAddress');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const statusHistory = [
      {
        status: 'ORDER_PLACED',
        date: order.createdAt,
        description: 'Order was placed'
      }
    ];

    if (order.status === 'PROCESSING') {
      statusHistory.push({
        status: 'PROCESSING',
        date: order.updatedAt,
        description: 'Order is being processed'
      });
    }

    if (order.status === 'SHIPPED') {
      statusHistory.push({
        status: 'SHIPPED',
        date: order.updatedAt,
        description: 'Order has been shipped'
      });
    }

    if (order.status === 'DELIVERED' && order.deliveredAt) {
      statusHistory.push({
        status: 'DELIVERED',
        date: order.deliveredAt,
        description: 'Order has been delivered'
      });
    }

    if (order.status === 'CANCELLED') {
      statusHistory.push({
        status: 'CANCELLED',
        date: order.cancelledAt,
        description: 'Order was cancelled'
      });
    }

    res.json({
      order,
      statusHistory,
      estimatedDelivery: order.estimatedDelivery,
      tracking: {
        number: order.trackingNumber,
        provider: order.shippingProvider,
        status: order.status
      }
    });
  } catch (error) {
    console.error('Track order error:', error);
    res.status(500).json({ message: 'Failed to track order', error: error.message });
  }


};

module.exports = {
  createOrder,
  getMyOrders,
  getOrderById,
  updateOrderStatus,
  updatePaymentStatus,
  getAllOrders,
  cancelOrder,
  trackOrder
};