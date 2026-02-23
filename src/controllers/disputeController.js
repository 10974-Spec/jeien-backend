const Dispute = require('../models/Dispute');
const Order = require('../models/Order');

// @desc    Create a new dispute
// @route   POST /api/disputes
// @access  Private (Buyer/Vendor)
const createDispute = async (req, res) => {
    try {
        const { orderId, reason, description, evidence } = req.body;

        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ message: 'Order not found' });

        // Ensure user owns the order or is the vendor
        // For simplicity, we just attach the user creating it
        const dispute = new Dispute({
            order: orderId,
            user: req.user._id,
            vendor: order.orderItems[0]?.vendor || null,
            reason,
            description,
            evidence: evidence || [],
            messages: [{ sender: req.user._id, message: description }]
        });

        const created = await dispute.save();
        res.status(201).json(created);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get logged in user's disputes
// @route   GET /api/disputes/my-disputes
// @access  Private
const getMyDisputes = async (req, res) => {
    try {
        const disputes = await Dispute.find({
            $or: [{ user: req.user._id }, { vendor: req.user._id }]
        }).populate('order').populate('user', 'name email');
        res.json(disputes);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all disputes (Admin)
// @route   GET /api/disputes
// @access  Private/Admin
const getAllDisputes = async (req, res) => {
    try {
        const disputes = await Dispute.find({})
            .populate('order')
            .populate('user', 'name email')
            .populate('vendor', 'name email')
            .sort({ createdAt: -1 });
        res.json(disputes);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update dispute status or internal resolution (Admin)
// @route   PUT /api/disputes/:id
// @access  Private/Admin
const updateDispute = async (req, res) => {
    try {
        const { status, resolution } = req.body;
        const dispute = await Dispute.findById(req.params.id);

        if (!dispute) return res.status(404).json({ message: 'Dispute not found' });

        dispute.status = status || dispute.status;
        if (resolution) dispute.resolution = resolution;

        const updated = await dispute.save();
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Add message to dispute
// @route   POST /api/disputes/:id/messages
// @access  Private
const addDisputeMessage = async (req, res) => {
    try {
        const { message } = req.body;
        const dispute = await Dispute.findById(req.params.id);

        if (!dispute) return res.status(404).json({ message: 'Dispute not found' });

        dispute.messages.push({
            sender: req.user._id,
            message
        });

        const updated = await dispute.save();

        // Deep populate to get sender names for the UI, though not strictly required
        await updated.populate('messages.sender', 'name role');

        res.status(201).json(updated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createDispute,
    getMyDisputes,
    getAllDisputes,
    updateDispute,
    addDisputeMessage
};
