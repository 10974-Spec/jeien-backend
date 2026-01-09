const Order = require('./order.model');
const Product = require('../products/product.model');
const User = require('../users/user.model');
const mongoose = require('mongoose');
const crypto = require('crypto');

// =============== DEBUG HELPER ===============
const debugLog = (message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  if (data !== null) {
    console.log(`[${timestamp}] Data:`, JSON.stringify(data, null, 2));
  }
};
// ============================================

const createOrder = async (req, res) => {
  debugLog('=== CREATE ORDER STARTED ===');
  debugLog('Request user:', req.user);
  debugLog('Request body:', req.body);
  debugLog('Cart items count:', req.body.items?.length || 0);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { 
      items, 
      deliveryAddress, 
      paymentMethod, 
      customerNotes, 
      shippingMethod = 'Standard',
      vendorIds = [],
      applyFreeShipping = false, // Add this parameter
      discountCode = '' // Add discount code parameter
    } = req.body;

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      debugLog('ERROR: No items in order');
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false,
        message: 'Order must contain at least one item' 
      });
    }

    if (!deliveryAddress) {
      debugLog('ERROR: Delivery address is required');
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false,
        message: 'Delivery address is required' 
      });
    }

    // Validate delivery address fields
    const { fullName, phone, city, street } = deliveryAddress;
    if (!fullName || !phone || !city || !street) {
      debugLog('ERROR: Missing required address fields');
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false,
        message: 'Please provide full name, phone, city, and street address',
        missingFields: {
          fullName: !fullName,
          phone: !phone,
          city: !city,
          street: !street
        }
      });
    }

    debugLog('Processing order items...');
    
    // Fetch product details and validate stock
    const orderItems = [];
    let subtotal = 0;
    let totalItems = 0;

    for (const item of items) {
      if (!item.productId || !item.quantity) {
        debugLog('ERROR: Item missing productId or quantity', item);
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ 
          success: false,
          message: 'Each item must have productId and quantity',
          invalidItem: item
        });
      }

      debugLog(`Processing product ${item.productId}, quantity: ${item.quantity}`);

      const product = await Product.findById(item.productId)
        .populate('vendor', '_id businessName storeName')
        .populate('category', '_id name');

      if (!product) {
        debugLog('ERROR: Product not found', item.productId);
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ 
          success: false,
          message: `Product not found: ${item.productId}`,
          productId: item.productId
        });
      }

      if (!product.approved) {
        debugLog('ERROR: Product not approved', item.productId);
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ 
          success: false,
          message: `Product "${product.title}" is not approved for sale`,
          productId: item.productId
        });
      }

      if (product.stock < item.quantity) {
        debugLog('ERROR: Insufficient stock', {
          productId: item.productId,
          requested: item.quantity,
          available: product.stock
        });
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ 
          success: false,
          message: `Insufficient stock for "${product.title}". Available: ${product.stock}, Requested: ${item.quantity}`,
          productId: item.productId,
          available: product.stock,
          requested: item.quantity
        });
      }

      // FIXED: Proper price parsing - check if price is already multiplied
      let price = parseFloat(item.price) || parseFloat(product.price);
      
      // Debug log to see what price we're getting
      debugLog('Price details:', {
        itemPrice: item.price,
        productPrice: product.price,
        parsedPrice: price,
        isString: typeof item.price === 'string',
        isNumber: typeof item.price === 'number'
      });

      // If price seems too high (like 20000 instead of 200), divide by 100
      // This fixes the frontend bug where prices are multiplied by 100
      if (price > 10000) { // If price seems unreasonably high for e-commerce
        debugLog('WARNING: Price seems too high, checking for multiplication issue');
        const reasonablePrice = price / 100;
        debugLog(`Adjusted price from ${price} to ${reasonablePrice}`);
        price = reasonablePrice;
      }

      const itemTotal = price * item.quantity;
      subtotal += itemTotal;
      totalItems += item.quantity;

      orderItems.push({
        productId: product._id,
        title: product.title,
        price: price,
        quantity: item.quantity,
        attributes: item.attributes || [],
        vendorId: product.vendor?._id || item.vendorId,
        vendorName: product.vendor?.businessName || product.vendor?.storeName,
        image: item.image || product.images?.[0] || '',
        category: product.category?.name,
        productDetails: {
          sku: product.sku,
          brand: product.brand
        }
      });

      debugLog(`Item added to order: ${product.title} x${item.quantity} @ KES ${price} = KES ${itemTotal}`);
    }

    // FIXED: Add validation for subtotal
    if (subtotal <= 0) {
      debugLog('ERROR: Subtotal must be greater than 0', { subtotal });
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false,
        message: 'Order subtotal must be greater than 0',
        subtotal: subtotal
      });
    }

    // Calculate totals with proper rounding
    subtotal = parseFloat(subtotal.toFixed(2));
    const tax = parseFloat((subtotal * 0.16).toFixed(2));
    
    // NEW: Calculate shipping based on rules
    let shipping = 0; // Default to free shipping
    
    // Only apply shipping fee if:
    // 1. NOT applying free shipping AND
    // 2. Subtotal is less than free shipping threshold
    if (!applyFreeShipping && subtotal < 5000) {
      shipping = shippingMethod === 'Express' ? 1000 : 500;
    }
    
    // Alternative: Always free shipping (uncomment if you want)
    // shipping = 0;
    
    const totalAmount = parseFloat((subtotal + tax + shipping).toFixed(2));

    debugLog('Calculated totals:', {
      subtotal,
      tax,
      shipping,
      totalAmount,
      freeShippingApplied: shipping === 0,
      freeShippingThreshold: 5000,
      calculation: `subtotal(${subtotal}) + tax(${tax}) + shipping(${shipping}) = ${totalAmount}`
    });

    // FIXED: Validate total amount is reasonable
    if (totalAmount > 150000) {
      debugLog('ERROR: Total amount exceeds reasonable limit', { totalAmount });
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false,
        message: 'Order amount is too high. Maximum order amount is KES 150,000.',
        totalAmount: totalAmount,
        maxAmount: 150000
      });
    }

    // Generate unique order ID
    const orderId = `ORD-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    
    debugLog('Generated order ID:', orderId);

    // Create order object
    const orderData = {
      orderId,
      buyer: req.user.id,
      items: orderItems,
      deliveryAddress: {
        ...deliveryAddress,
        country: deliveryAddress.country || 'Kenya',
        postalCode: deliveryAddress.postalCode || ''
      },
      paymentMethod: paymentMethod || 'MPESA',
      customerNotes: customerNotes || '',
      shippingMethod,
      subtotal: subtotal,
      tax: tax,
      shippingFee: shipping, // Use calculated shipping (0 or amount)
      totalAmount: totalAmount,
      status: 'PENDING',
      paymentStatus: paymentMethod === 'CASH_ON_DELIVERY' ? 'PENDING' : 'PROCESSING',
      vendorIds: vendorIds.length > 0 ? vendorIds : [...new Set(orderItems.map(item => item.vendorId).filter(id => id))],
      estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      flags: {
        freeShipping: shipping === 0, // Mark if free shipping was applied
        discountApplied: false, // You can implement discount logic here
        discountAmount: 0,
        discountCode: discountCode || ''
      }
    };

    debugLog('Creating order with data:', {
      ...orderData,
      itemsCount: orderData.items.length,
      itemPrices: orderData.items.map(i => ({ title: i.title, price: i.price, quantity: i.quantity })),
      freeShipping: orderData.flags.freeShipping
    });

    // Create order
    const order = new Order(orderData);
    await order.save({ session });

    debugLog('Order saved successfully:', {
      orderId: order.orderId,
      orderDbId: order._id,
      totalAmount: order.totalAmount,
      shippingFee: order.shippingFee,
      freeShipping: order.flags.freeShipping,
      status: order.status,
      paymentStatus: order.paymentStatus
    });

    // Update product stock
    debugLog('Updating product stock...');
    for (const item of items) {
      await Product.findByIdAndUpdate(
        item.productId,
        { $inc: { stock: -item.quantity } },
        { new: true, session }
      );
      debugLog(`Updated stock for product ${item.productId}: -${item.quantity}`);
    }

    // Update user's order history
    await User.findByIdAndUpdate(req.user.id, {
      $push: { orderHistory: order._id },
      $inc: { 
        'stats.totalOrders': 1,
        'stats.totalSpent': order.totalAmount
      }
    }, { session });

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    debugLog('=== CREATE ORDER COMPLETED SUCCESSFULLY ===');

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order: {
        _id: order._id,
        orderId: order.orderId,
        items: order.items.map(item => ({
          productId: item.productId,
          title: item.title,
          price: item.price,
          quantity: item.quantity,
          image: item.image
        })),
        deliveryAddress: order.deliveryAddress,
        paymentMethod: order.paymentMethod,
        shippingMethod: order.shippingMethod,
        subtotal: order.subtotal,
        tax: order.tax,
        shippingFee: order.shippingFee,
        totalAmount: order.totalAmount,
        status: order.status,
        paymentStatus: order.paymentStatus,
        freeShipping: order.flags.freeShipping,
        createdAt: order.createdAt,
        estimatedDelivery: order.estimatedDelivery
      },
      payment: {
        required: order.paymentMethod !== 'CASH_ON_DELIVERY',
        method: order.paymentMethod,
        amount: order.totalAmount,
        currency: 'KES'
      }
    });

  } catch (error) {
    // Abort transaction on error
    await session.abortTransaction();
    session.endSession();
    
    debugLog('=== CREATE ORDER ERROR ===');
    debugLog('Error name:', error.name);
    debugLog('Error message:', error.message);
    debugLog('Error stack:', error.stack);
    
    if (error.name === 'ValidationError') {
      debugLog('Mongoose Validation Errors:', error.errors);
      const validationErrors = {};
      Object.keys(error.errors).forEach(key => {
        validationErrors[key] = error.errors[key].message;
      });
      
      return res.status(400).json({
        success: false,
        message: 'Order validation failed',
        errors: validationErrors
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Failed to create order', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
};

const getOrderById = async (req, res) => {
  debugLog('=== GET ORDER BY ID ===');
  debugLog('Order ID:', req.params.id);
  debugLog('Request user:', req.user);

  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      debugLog('ERROR: Invalid order ID format');
      return res.status(400).json({ 
        success: false,
        message: 'Invalid order ID format' 
      });
    }

    debugLog('Finding order...');
    const order = await Order.findById(id)
      .populate('buyer', 'name email phone')
      .populate('items.vendorId', 'businessName storeName');

    if (!order) {
      debugLog('ERROR: Order not found');
      return res.status(404).json({ 
        success: false,
        message: 'Order not found' 
      });
    }

    debugLog('Order found:', {
      orderId: order.orderId,
      buyerId: order.buyer?._id,
      currentUserId: req.user.id,
      userRole: req.user.role
    });

    // Check authorization
    const isBuyer = order.buyer?._id.toString() === req.user.id;
    const isVendor = order.vendorIds?.some(vendorId => vendorId.toString() === req.user.id);
    const isAdmin = req.user.role === 'ADMIN';

    if (!isBuyer && !isVendor && !isAdmin) {
      debugLog('ERROR: Unauthorized access to order');
      return res.status(403).json({ 
        success: false,
        message: 'Not authorized to view this order' 
      });
    }

    // Fetch product details for each item
    const itemsWithDetails = await Promise.all(
      order.items.map(async (item) => {
        const product = await Product.findById(item.productId)
          .select('title images sku brand description category')
          .populate('category', 'name slug');
        
        return {
          ...item.toObject(),
          product: {
            _id: product?._id,
            title: product?.title,
            images: product?.images,
            sku: product?.sku,
            brand: product?.brand,
            description: product?.description,
            category: product?.category
          }
        };
      })
    );

    debugLog('Order details fetched successfully');

    res.json({
      success: true,
      order: {
        ...order.toObject(),
        items: itemsWithDetails
      }
    });

  } catch (error) {
    debugLog('Get order error:', error.message);
    res.status(500).json({ 
      success: false,
      message: 'Failed to get order', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
};

const getUserOrders = async (req, res) => {
  debugLog('=== GET USER ORDERS ===');
  debugLog('Request user:', req.user);
  debugLog('Query params:', req.query);

  try {
    const { 
      page = 1, 
      limit = 20,
      status,
      paymentStatus,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const filter = { buyer: req.user.id };

    if (status) {
      filter.status = status;
      debugLog('Filter by status:', status);
    }

    if (paymentStatus) {
      filter.paymentStatus = paymentStatus;
      debugLog('Filter by payment status:', paymentStatus);
    }

    debugLog('Final filter:', filter);
    debugLog('Pagination:', { skip, limit: parseInt(limit) });

    const orders = await Order.find(filter)
      .sort({ [sortBy]: sortDirection })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('items.vendorId', 'businessName storeName');

    const total = await Order.countDocuments(filter);

    debugLog('Orders found:', orders.length);
    debugLog('Total orders:', total);

    res.json({
      success: true,
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    debugLog('Get user orders error:', error.message);
    res.status(500).json({ 
      success: false,
      message: 'Failed to get orders', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
};

const updateOrderStatus = async (req, res) => {
  debugLog('=== UPDATE ORDER STATUS ===');
  debugLog('Order ID:', req.params.id);
  debugLog('Update data:', req.body);
  debugLog('Request user:', req.user);

  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      debugLog('ERROR: Invalid order ID format');
      return res.status(400).json({ 
        success: false,
        message: 'Invalid order ID format' 
      });
    }

    if (!status) {
      debugLog('ERROR: Status is required');
      return res.status(400).json({ 
        success: false,
        message: 'Status is required' 
      });
    }

    const validStatuses = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'];
    if (!validStatuses.includes(status)) {
      debugLog('ERROR: Invalid status value');
      return res.status(400).json({ 
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }

    debugLog('Finding order...');
    const order = await Order.findById(id).populate('buyer', 'name email');

    if (!order) {
      debugLog('ERROR: Order not found');
      return res.status(404).json({ 
        success: false,
        message: 'Order not found' 
      });
    }

    debugLog('Order found:', {
      orderId: order.orderId,
      currentStatus: order.status,
      newStatus: status
    });

    // Check authorization
    const isBuyer = order.buyer._id.toString() === req.user.id;
    const isVendor = order.vendorIds?.some(vendorId => vendorId.toString() === req.user.id);
    const isAdmin = req.user.role === 'ADMIN';

    // Buyers can only cancel their own orders
    if (isBuyer && status !== 'CANCELLED') {
      debugLog('ERROR: Buyers can only cancel orders');
      return res.status(403).json({ 
        success: false,
        message: 'Buyers can only cancel orders' 
      });
    }

    // Only admin/vendor can update to other statuses
    if (!isAdmin && !isVendor && !isBuyer) {
      debugLog('ERROR: Not authorized to update order status');
      return res.status(403).json({ 
        success: false,
        message: 'Not authorized to update order status' 
      });
    }

    // Update order status
    const oldStatus = order.status;
    order.status = status;
    
    if (notes) {
      order.statusNotes = order.statusNotes || [];
      order.statusNotes.push({
        status,
        note: notes,
        updatedBy: req.user.id,
        updatedAt: new Date()
      });
    }

    // Update timestamps based on status
    if (status === 'SHIPPED') {
      order.shippedAt = new Date();
    } else if (status === 'DELIVERED') {
      order.deliveredAt = new Date();
      order.paymentStatus = 'COMPLETED';
    } else if (status === 'CANCELLED') {
      order.cancelledAt = new Date();
      order.cancelledBy = req.user.id;
      
      // Restore product stock if order is cancelled
      if (oldStatus !== 'CANCELLED') {
        debugLog('Restoring product stock for cancelled order...');
        for (const item of order.items) {
          await Product.findByIdAndUpdate(
            item.productId,
            { $inc: { stock: item.quantity } },
            { new: true }
          );
          debugLog(`Restored ${item.quantity} units to product ${item.productId}`);
        }
      }
    }

    await order.save();

    debugLog('Order status updated successfully');

    res.json({
      success: true,
      message: 'Order status updated successfully',
      order: {
        _id: order._id,
        orderId: order.orderId,
        status: order.status,
        previousStatus: oldStatus,
        paymentStatus: order.paymentStatus,
        updatedAt: order.updatedAt
      }
    });

  } catch (error) {
    debugLog('Update order status error:', error.message);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update order status', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
};

const trackOrder = async (req, res) => {
  debugLog('=== TRACK ORDER ===');
  debugLog('Order ID:', req.params.orderId);

  try {
    const { orderId } = req.params;

    // Find order by orderId (not _id)
    const order = await Order.findOne({ orderId })
      .select('orderId status paymentStatus shippedAt deliveredAt estimatedDelivery deliveryAddress items')
      .populate('buyer', 'name email phone')
      .populate('items.vendorId', 'businessName');

    if (!order) {
      debugLog('ERROR: Order not found');
      return res.status(404).json({ 
        success: false,
        message: 'Order not found' 
      });
    }

    debugLog('Order found for tracking:', orderId);

    // Create tracking timeline
    const timeline = [];
    
    timeline.push({
      status: 'ORDER_PLACED',
      date: order.createdAt,
      description: 'Order placed successfully',
      completed: true
    });

    if (order.status === 'PROCESSING') {
      timeline.push({
        status: 'PROCESSING',
        date: order.updatedAt,
        description: 'Order is being processed',
        completed: true,
        current: true
      });
    }

    if (order.shippedAt) {
      timeline.push({
        status: 'SHIPPED',
        date: order.shippedAt,
        description: 'Order has been shipped',
        completed: true
      });
    }

    if (order.deliveredAt) {
      timeline.push({
        status: 'DELIVERED',
        date: order.deliveredAt,
        description: 'Order has been delivered',
        completed: true
      });
    }

    // If no current status, add the next expected status
    if (!timeline.find(item => item.current)) {
      if (order.status === 'PENDING') {
        timeline.push({
          status: 'PROCESSING',
          date: null,
          description: 'Order will be processed soon',
          completed: false,
          current: true
        });
      } else if (order.status === 'SHIPPED') {
        timeline.push({
          status: 'DELIVERED',
          date: order.estimatedDelivery,
          description: 'Estimated delivery',
          completed: false,
          current: true
        });
      }
    }

    res.json({
      success: true,
      order: {
        orderId: order.orderId,
        status: order.status,
        paymentStatus: order.paymentStatus,
        estimatedDelivery: order.estimatedDelivery,
        shippedAt: order.shippedAt,
        deliveredAt: order.deliveredAt,
        deliveryAddress: {
          city: order.deliveryAddress.city,
          street: order.deliveryAddress.street
        },
        vendor: order.items[0]?.vendorId?.businessName || 'Multiple Vendors'
      },
      timeline,
      contact: {
        customerService: process.env.CUSTOMER_SERVICE_PHONE || '0700 000 000',
        email: process.env.CUSTOMER_SERVICE_EMAIL || 'support@example.com'
      }
    });

  } catch (error) {
    debugLog('Track order error:', error.message);
    res.status(500).json({ 
      success: false,
      message: 'Failed to track order', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
};

const updatePaymentStatus = async (req, res) => {
  debugLog('=== UPDATE PAYMENT STATUS ===');
  debugLog('Order ID:', req.params.id);
  debugLog('Payment update:', req.body);
  debugLog('Request user:', req.user);

  try {
    const { id } = req.params;
    const { paymentStatus, transactionId, reference, notes } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      debugLog('ERROR: Invalid order ID format');
      return res.status(400).json({ 
        success: false,
        message: 'Invalid order ID format' 
      });
    }

    if (!paymentStatus) {
      debugLog('ERROR: Payment status is required');
      return res.status(400).json({ 
        success: false,
        message: 'Payment status is required' 
      });
    }

    const validPaymentStatuses = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED'];
    if (!validPaymentStatuses.includes(paymentStatus)) {
      debugLog('ERROR: Invalid payment status');
      return res.status(400).json({ 
        success: false,
        message: `Invalid payment status. Must be one of: ${validPaymentStatuses.join(', ')}` 
      });
    }

    debugLog('Finding order...');
    const order = await Order.findById(id);

    if (!order) {
      debugLog('ERROR: Order not found');
      return res.status(404).json({ 
        success: false,
        message: 'Order not found' 
      });
    }

    debugLog('Order found:', {
      orderId: order.orderId,
      currentPaymentStatus: order.paymentStatus,
      newPaymentStatus: paymentStatus
    });

    // Only admin can update payment status
    if (req.user.role !== 'ADMIN') {
      debugLog('ERROR: Only admin can update payment status');
      return res.status(403).json({ 
        success: false,
        message: 'Only admin can update payment status' 
      });
    }

    // Update payment status
    const oldPaymentStatus = order.paymentStatus;
    order.paymentStatus = paymentStatus;

    if (paymentStatus === 'COMPLETED') {
      order.paymentDetails = order.paymentDetails || {};
      order.paymentDetails.paidAt = new Date();
      
      if (transactionId) order.paymentDetails.transactionId = transactionId;
      if (reference) order.paymentDetails.reference = reference;
      if (notes) order.paymentDetails.notes = notes;
    }

    await order.save();

    debugLog('Payment status updated successfully');

    res.json({
      success: true,
      message: 'Payment status updated successfully',
      order: {
        _id: order._id,
        orderId: order.orderId,
        paymentStatus: order.paymentStatus,
        previousPaymentStatus: oldPaymentStatus,
        totalAmount: order.totalAmount,
        updatedAt: order.updatedAt
      }
    });

  } catch (error) {
    debugLog('Update payment status error:', error.message);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update payment status', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
};

const cancelOrder = async (req, res) => {
  debugLog('=== CANCEL ORDER ===');
  debugLog('Order ID:', req.params.id);
  debugLog('Request user:', req.user);

  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      debugLog('ERROR: Invalid order ID format');
      return res.status(400).json({ 
        success: false,
        message: 'Invalid order ID format' 
      });
    }

    debugLog('Finding order...');
    const order = await Order.findById(id);

    if (!order) {
      debugLog('ERROR: Order not found');
      return res.status(404).json({ 
        success: false,
        message: 'Order not found' 
      });
    }

    debugLog('Order found:', {
      orderId: order.orderId,
      currentStatus: order.status,
      buyerId: order.buyer.toString(),
      currentUserId: req.user.id
    });

    // Check authorization
    const isBuyer = order.buyer.toString() === req.user.id;
    const isAdmin = req.user.role === 'ADMIN';

    if (!isBuyer && !isAdmin) {
      debugLog('ERROR: Not authorized to cancel order');
      return res.status(403).json({ 
        success: false,
        message: 'Not authorized to cancel this order' 
      });
    }

    // Check if order can be cancelled
    const cannotCancelStatuses = ['SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'];
    if (cannotCancelStatuses.includes(order.status)) {
      debugLog('ERROR: Order cannot be cancelled in current status');
      return res.status(400).json({ 
        success: false,
        message: `Cannot cancel order with status: ${order.status}`,
        currentStatus: order.status
      });
    }

    // Update order status
    order.status = 'CANCELLED';
    order.cancelledAt = new Date();
    order.cancelledBy = req.user.id;
    order.cancellationReason = reason || 'Cancelled by user';

    // Restore product stock
    debugLog('Restoring product stock...');
    for (const item of order.items) {
      await Product.findByIdAndUpdate(
        item.productId,
        { $inc: { stock: item.quantity } },
        { new: true }
      );
      debugLog(`Restored ${item.quantity} units to product ${item.productId}`);
    }

    await order.save();

    debugLog('Order cancelled successfully');

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      order: {
        _id: order._id,
        orderId: order.orderId,
        status: order.status,
        cancellationReason: order.cancellationReason,
        cancelledAt: order.cancelledAt
      }
    });

  } catch (error) {
    debugLog('Cancel order error:', error.message);
    res.status(500).json({ 
      success: false,
      message: 'Failed to cancel order', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
};

const getVendorOrders = async (req, res) => {
  debugLog('=== GET VENDOR ORDERS ===');
  debugLog('Request user:', req.user);
  debugLog('Query params:', req.query);

  try {
    const { 
      page = 1, 
      limit = 20,
      status,
      paymentStatus,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    // Filter orders that have items belonging to this vendor
    const filter = {
      'items.vendorId': req.user.id
    };

    if (status) {
      filter.status = status;
      debugLog('Filter by status:', status);
    }

    if (paymentStatus) {
      filter.paymentStatus = paymentStatus;
      debugLog('Filter by payment status:', paymentStatus);
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
        debugLog('Filter by start date:', startDate);
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
        debugLog('Filter by end date:', endDate);
      }
    }

    debugLog('Final filter:', filter);
    debugLog('Pagination:', { skip, limit: parseInt(limit) });

    const orders = await Order.find(filter)
      .sort({ [sortBy]: sortDirection })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('buyer', 'name email phone');

    // Filter items to only show this vendor's items
    const filteredOrders = orders.map(order => {
      const vendorItems = order.items.filter(item => 
        item.vendorId && item.vendorId.toString() === req.user.id
      );
      
      const orderObj = order.toObject();
      orderObj.items = vendorItems;
      
      const vendorSubtotal = vendorItems.reduce((sum, item) => 
        sum + (item.price * item.quantity), 0
      );
      
      const vendorCommission = parseFloat((vendorSubtotal * 0.15).toFixed(2));
      const vendorAmount = parseFloat((vendorSubtotal - vendorCommission).toFixed(2));

      orderObj.vendorSubtotal = vendorSubtotal;
      orderObj.vendorCommission = vendorCommission;
      orderObj.vendorAmount = vendorAmount;
      
      return orderObj;
    });

    const total = await Order.countDocuments(filter);

    debugLog('Vendor orders found:', filteredOrders.length);
    debugLog('Total vendor orders:', total);

    // Calculate vendor statistics
    const stats = await Order.aggregate([
      { $match: { 'items.vendorId': mongoose.Types.ObjectId(req.user.id) } },
      { $unwind: '$items' },
      { $match: { 'items.vendorId': mongoose.Types.ObjectId(req.user.id) } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          pendingOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] }
          },
          completedOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'DELIVERED'] }, 1, 0] }
          },
          totalItemsSold: { $sum: '$items.quantity' }
        }
      }
    ]);

    const statsResult = stats[0] || {
      totalOrders: 0,
      totalRevenue: 0,
      pendingOrders: 0,
      completedOrders: 0,
      totalItemsSold: 0
    };

    debugLog('Vendor stats:', statsResult);

    res.json({
      success: true,
      orders: filteredOrders,
      stats: statsResult,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    debugLog('Get vendor orders error:', error.message);
    res.status(500).json({ 
      success: false,
      message: 'Failed to get vendor orders', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
};

const getAdminOrders = async (req, res) => {
  debugLog('=== GET ADMIN ORDERS ===');
  debugLog('Request user:', req.user);
  debugLog('Query params:', req.query);

  try {
    const { 
      page = 1, 
      limit = 50,
      status,
      paymentStatus,
      search,
      vendorId,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const filter = {};

    if (status) {
      filter.status = status;
      debugLog('Filter by status:', status);
    }

    if (paymentStatus) {
      filter.paymentStatus = paymentStatus;
      debugLog('Filter by payment status:', paymentStatus);
    }

    if (vendorId) {
      filter.vendorIds = vendorId;
      debugLog('Filter by vendor:', vendorId);
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
        debugLog('Filter by start date:', startDate);
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
        debugLog('Filter by end date:', endDate);
      }
    }

    if (search) {
      filter.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { 'buyer.name': { $regex: search, $options: 'i' } },
        { 'deliveryAddress.fullName': { $regex: search, $options: 'i' } },
        { 'deliveryAddress.phone': { $regex: search, $options: 'i' } }
      ];
      debugLog('Filter by search:', search);
    }

    debugLog('Final filter:', filter);
    debugLog('Pagination:', { skip, limit: parseInt(limit) });

    const orders = await Order.find(filter)
      .populate('buyer', 'name email phone')
      .populate('items.vendorId', 'businessName storeName')
      .sort({ [sortBy]: sortDirection })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Order.countDocuments(filter);

    debugLog('Admin orders found:', orders.length);
    debugLog('Total admin orders:', total);

    // Calculate admin statistics
    const stats = await Order.aggregate([
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          totalTax: { $sum: '$tax' },
          totalShipping: { $sum: '$shippingFee' },
          totalCommission: { $sum: { $multiply: ['$subtotal', 0.15] } },
          pendingOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] }
          },
          processingOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'PROCESSING'] }, 1, 0] }
          },
          deliveredOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'DELIVERED'] }, 1, 0] }
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'CANCELLED'] }, 1, 0] }
          }
        }
      }
    ]);

    const statsResult = stats[0] || {
      totalOrders: 0,
      totalRevenue: 0,
      totalTax: 0,
      totalShipping: 0,
      totalCommission: 0,
      pendingOrders: 0,
      processingOrders: 0,
      deliveredOrders: 0,
      cancelledOrders: 0
    };

    debugLog('Admin stats:', statsResult);

    res.json({
      success: true,
      orders,
      stats: statsResult,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    debugLog('Get admin orders error:', error.message);
    res.status(500).json({ 
      success: false,
      message: 'Failed to get orders', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
};

const searchOrders = async (req, res) => {
  debugLog('=== SEARCH ORDERS ===');
  debugLog('Search query:', req.query);
  debugLog('Request user:', req.user);

  try {
    const { q, limit = 10 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({ 
        success: false,
        message: 'Search query must be at least 2 characters' 
      });
    }

    const query = q.trim();
    debugLog('Searching for:', query);

    let filter = {};

    // Admin can search all orders, others can only search their own
    if (req.user.role === 'ADMIN') {
      filter.$or = [
        { orderId: { $regex: query, $options: 'i' } },
        { 'buyer.name': { $regex: query, $options: 'i' } },
        { 'deliveryAddress.fullName': { $regex: query, $options: 'i' } },
        { 'deliveryAddress.phone': { $regex: query, $options: 'i' } },
        { 'deliveryAddress.email': { $regex: query, $options: 'i' } }
      ];
    } else if (req.user.role === 'VENDOR') {
      filter['items.vendorId'] = req.user.id;
      filter.$or = [
        { orderId: { $regex: query, $options: 'i' } },
        { 'buyer.name': { $regex: query, $options: 'i' } },
        { 'deliveryAddress.fullName': { $regex: query, $options: 'i' } }
      ];
    } else {
      filter.buyer = req.user.id;
      filter.$or = [
        { orderId: { $regex: query, $options: 'i' } },
        { 'deliveryAddress.fullName': { $regex: query, $options: 'i' } }
      ];
    }

    debugLog('Search filter:', filter);

    const orders = await Order.find(filter)
      .populate('buyer', 'name email')
      .populate('items.vendorId', 'businessName')
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    debugLog('Search results found:', orders.length);

    res.json({
      success: true,
      orders,
      query
    });

  } catch (error) {
    debugLog('Search orders error:', error.message);
    res.status(500).json({ 
      success: false,
      message: 'Failed to search orders', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
};

module.exports = {
  createOrder,
  getOrderById,
  getUserOrders,
  updateOrderStatus,
  updatePaymentStatus,
  cancelOrder,
  getVendorOrders,
  getAdminOrders,
  searchOrders,
  trackOrder
};