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
                const product = await Product.findById(item.product);
                if (!product) throw new Error(`Product ${item.product} not found`);
                if (!product.vendor) throw new Error(`Product ${item.product} has no vendor assigned`);
                return {
                    product: product._id,
                    name: item.name || product.name,
                    quantity: item.quantity,
                    price: item.price || product.price,
                    image: item.image || '',
                    vendor: product.vendor._id || product.vendor,
                    status: 'pending',
                };
            })
        );

        const createdOrder = await Order.create({
            orderItems: enrichedItems,
            user: req.user._id,
            shippingAddress,
            paymentMethod,
            itemsPrice,
            taxPrice,
            shippingPrice,
            totalPrice,
        });

        res.status(201).json(createdOrder);
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = async (req, res) => {
    const order = await Order.findById(req.params.id);

    if (order) {
        const userId = order.user?._id?.toString() || order.user?.toString();
        if (userId !== req.user._id.toString() && req.user.role !== 'admin') {
            if (req.user.role === 'vendor') {
                const hasItems = order.orderItems.some(item => {
                    const vid = item.vendor?._id?.toString() || item.vendor?.toString();
                    return vid === req.user._id.toString();
                });
                if (!hasItems) return res.status(401).json({ message: 'Not authorized' });
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
        order.paidAt = new Date();
        order.paymentResult = {
            id: req.body.id,
            status: req.body.status,
            update_time: req.body.update_time,
            email_address: req.body.email_address,
        };
        order.status = 'paid';

        const updatedOrder = await Order.save(order);
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
        order.status = 'delivered';
        const updatedOrder = await Order.save(order);
        res.json(updatedOrder);
    } else {
        res.status(404).json({ message: 'Order not found' });
    }
};

// @desc    Update order to completed (User confirms receipt)
// @route   PUT /api/orders/:id/complete
// @access  Private
const updateOrderToCompleted = async (req, res) => {
    const order = await Order.findById(req.params.id);

    if (order) {
        const userId = order.user?._id?.toString() || order.user?.toString();
        if (userId !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(401).json({ message: 'Not authorized' });
        }

        order.status = 'completed';

        // Calculate Commission and Create Payouts per vendor
        const vendorMap = {};
        order.orderItems.forEach(item => {
            const vendorId = item.vendor?._id?.toString() || item.vendor?.toString();
            const itemTotal = item.price * item.quantity;
            vendorMap[vendorId] = (vendorMap[vendorId] || 0) + itemTotal;
        });

        for (const vendorId of Object.keys(vendorMap)) {
            const totalAmount = vendorMap[vendorId];
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

        const updatedOrder = await Order.save(order);
        res.json(updatedOrder);
    } else {
        res.status(404).json({ message: 'Order not found' });
    }
};

// @desc    Get logged in user orders
// @route   GET /api/orders/myorders
// @access  Private
const getMyOrders = async (req, res) => {
    const orders = await Order.find({ user: req.user._id });
    res.json(orders);
};

// @desc    Get all orders (admin)
// @route   GET /api/orders
// @access  Private/Admin
const getOrders = async (req, res) => {
    const orders = await Order.find({});
    res.json(orders);
};

// @desc    Get orders containing vendor's products
// @route   GET /api/orders/vendor
// @access  Private/Vendor
const getVendorOrders = async (req, res) => {
    try {
        const orders = await Order.find({ 'orderItems.vendor': req.user._id });

        // Filter each order's items to only this vendor's items
        const filtered = orders.map(order => {
            const orderObj = { ...order };
            orderObj.orderItems = (order.orderItems || []).filter(item => {
                const vid = item.vendor?._id?.toString() || item.vendor?.toString();
                return vid === req.user._id.toString();
            });
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

        const item = (order.orderItems || []).find(i => i._id.toString() === req.params.itemId);
        if (!item) return res.status(404).json({ message: 'Item not found' });

        const vid = item.vendor?._id?.toString() || item.vendor?.toString();
        if (vid !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(401).json({ message: 'Not authorized' });
        }

        await Order.updateItemStatus(req.params.id, req.params.itemId, req.body.status);
        const updated = await Order.findById(req.params.id);
        res.json(updated);
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
