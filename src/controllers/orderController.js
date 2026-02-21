const Order = require('../models/Order');
const Product = require('../models/Product');
const Payout = require('../models/Payout');
const Setting = require('../models/Setting');

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
const addOrderItems = async (req, res) => {
    try {
        const {
            orderItems,
            shippingAddress,
            paymentMethod,
            itemsPrice,
            taxPrice,
            shippingPrice,
            totalPrice,
        } = req.body;

        if (!orderItems || orderItems.length === 0) {
            return res.status(400).json({ message: 'No order items' });
        }

        // Populate each item's vendor from the product in DB
        const enrichedItems = await Promise.all(
            orderItems.map(async (item) => {
                const product = await Product.findById(item.product).select('vendor name price');
                if (!product) {
                    throw new Error(`Product ${item.product} not found`);
                }
                if (!product.vendor) {
                    throw new Error(`Product ${item.product} has no vendor assigned`);
                }
                return {
                    product: product._id,
                    name: item.name || product.name,
                    quantity: item.quantity,
                    price: item.price || product.price,
                    image: item.image || '',
                    vendor: product.vendor,
                    status: 'pending',
                };
            })
        );

        const order = new Order({
            orderItems: enrichedItems,
            user: req.user._id,
            shippingAddress,
            paymentMethod,
            itemsPrice,
            taxPrice,
            shippingPrice,
            totalPrice,
        });

        const createdOrder = await order.save();
        res.status(201).json(createdOrder);
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = async (req, res) => {
    const order = await Order.findById(req.params.id).populate(
        'user',
        'name email'
    );

    if (order) {
        // Check if user is admin, vendor of an item, or the order owner
        // For simplicity, strict ownership for now
        if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            // If vendor, check if they have items in this order
            // This logic can get complex. For MVP, allow admin and owner.
            // Vendor specific view should filter items.
            if (req.user.role === 'vendor') {
                // Allow if vendor has items
                const hasItems = order.orderItems.some(item => item.vendor.toString() === req.user._id.toString());
                if (!hasItems) {
                    return res.status(401).json({ message: 'Not authorized' });
                }
            } else {
                return res.status(401).json({ message: 'Not authorized' });
            }
        }
        res.json(order);
    } else {
        res.status(404).json({ message: 'Order not found' });
    }
};

// @desc    Update order to paid
// @route   PUT /api/orders/:id/pay
// @access  Private
const updateOrderToPaid = async (req, res) => {
    const order = await Order.findById(req.params.id);

    if (order) {
        order.isPaid = true;
        order.paidAt = Date.now();
        order.paymentResult = {
            id: req.body.id,
            status: req.body.status,
            update_time: req.body.update_time,
            email_address: req.body.email_address,
        };
        order.status = 'paid';

        const updatedOrder = await order.save();
        res.json(updatedOrder);
    } else {
        res.status(404).json({ message: 'Order not found' });
    }
};

// @desc    Update order to delivered
// @route   PUT /api/orders/:id/deliver
// @access  Private/Admin/Vendor
const updateOrderToDelivered = async (req, res) => {
    const order = await Order.findById(req.params.id);

    if (order) {
        // Ideally update individual items if mixed vendors
        order.isDelivered = true;
        order.deliveredAt = Date.now();
        order.status = 'delivered';

        const updatedOrder = await order.save();
        res.json(updatedOrder);
    } else {
        res.status(404).json({ message: 'Order not found' });
    }
};

// @desc    Update order to completed (User confirms receipt)
// @route   PUT /api/orders/:id/complete
// @access  Private
const updateOrderToCompleted = async (req, res) => {
    const order = await Order.findById(req.params.id).populate('orderItems.product');

    if (order) {
        if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(401).json({ message: 'Not authorized' });
        }

        order.status = 'completed';
        // const updatedOrder = await order.save(); 

        // Calculate Commission and Create Payouts
        const vendorMap = {};

        order.orderItems.forEach(item => {
            // item.vendor is an ObjectId
            const vendorId = item.vendor.toString();
            const itemTotal = item.price * item.quantity;
            if (!vendorMap[vendorId]) {
                vendorMap[vendorId] = 0;
            }
            vendorMap[vendorId] += itemTotal;
        });

        for (const vendorId of Object.keys(vendorMap)) {
            const totalAmount = vendorMap[vendorId];

            // Get rate dynamically from settings
            const commissionRateSetting = await Setting.findOne({ key: 'default_commission_rate' });
            const commissionRate = commissionRateSetting ? Number(commissionRateSetting.value) / 100 : 0.07;

            const commission = totalAmount * commissionRate;
            const payoutAmount = totalAmount - commission;

            await Payout.create({
                vendor: vendorId,
                orderItem: order._id,
                amount: payoutAmount,
                commission: commission,
                status: 'pending'
            });
        }

        const updatedOrder = await order.save();
        res.json(updatedOrder);
    } else {
        res.status(404).json({ message: 'Order not found' });
    }
};


// @desc    Get logged in user orders
// @route   GET /api/orders/myorders
// @access  Private
const getMyOrders = async (req, res) => {
    const orders = await Order.find({ user: req.user._id })
        .populate('orderItems.product', 'name images')
        .sort({ createdAt: -1 });
    res.json(orders);
};

// @desc    Get all orders (admin)
// @route   GET /api/orders
// @access  Private/Admin
const getOrders = async (req, res) => {
    const orders = await Order.find({}).populate('user', 'id name');
    res.json(orders);
};

// @desc    Get orders containing vendor's products
// @route   GET /api/orders/vendor
// @access  Private/Vendor
const getVendorOrders = async (req, res) => {

    try {
        const orders = await Order.find({
            'orderItems.vendor': req.user._id
        })
            .populate('user', 'name email phone')
            .populate('orderItems.product', 'name images price')
            .sort({ createdAt: -1 });

        // Filter each order's items to only this vendor's items
        const filtered = orders.map(order => {
            const orderObj = order.toObject();
            orderObj.orderItems = orderObj.orderItems.filter(
                item => item.vendor?.toString() === req.user._id.toString()
            );
            return orderObj;
        });

        res.json(filtered);
    } catch (e) { res.status(500).json({ message: e.message }); }
};

// @desc    Update individual order item status (vendor)
// @route   PUT /api/orders/:id/items/:itemId/status
// @access  Private/Vendor
const updateOrderItemStatus = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ message: 'Order not found' });

        const item = order.orderItems.id(req.params.itemId);
        if (!item) return res.status(404).json({ message: 'Item not found' });

        if (item.vendor?.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(401).json({ message: 'Not authorized' });
        }

        item.status = req.body.status;
        await order.save();
        res.json(order);
    } catch (e) { res.status(500).json({ message: e.message }); }
};

module.exports = {
    addOrderItems,
    getOrderById,
    updateOrderToPaid,
    updateOrderToDelivered,
    updateOrderToCompleted,
    getMyOrders,
    getOrders,
    getVendorOrders,
    updateOrderItemStatus,
};

