const Dispute = require('../models/Dispute');
const Order = require('../models/Order');
const { pool } = require('../config/db');

// @desc    Create a new dispute
// @route   POST /api/disputes
// @access  Private (Buyer/Vendor)
const createDispute = async (req, res) => {
    try {
        const { orderId, reason, description, evidence } = req.body;

        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ message: 'Order not found' });

        const vendorId = order.orderItems[0]?.vendor || null;

        const dispute = await Dispute.create({
            order: orderId,
            user: req.user._id,
            vendor: vendorId,
            reason,
            description,
            evidence: evidence || [],
        });

        // Add initial message
        if (description) {
            await pool.query(
                'INSERT INTO dispute_messages (dispute_id, sender_id, message) VALUES ($1,$2,$3)',
                [dispute._id, req.user._id, description]
            );
        }

        const created = await Dispute.findById(dispute._id);
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
        const { rows } = await pool.query(
            `SELECT * FROM disputes WHERE user_id = $1 OR vendor_id = $1 ORDER BY created_at DESC`,
            [req.user._id]
        );
        const disputes = rows.map(r => ({
            _id: r.id, id: r.id,
            order: r.order_id, user: r.user_id, vendor: r.vendor_id,
            reason: r.reason, description: r.description, status: r.status,
            resolution: r.resolution, evidence: r.evidence || [],
            createdAt: r.created_at, updatedAt: r.updated_at,
        }));
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
        const disputes = await Dispute.find({});
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
        const updated = await Dispute.save(dispute);
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

        await pool.query(
            'INSERT INTO dispute_messages (dispute_id, sender_id, message) VALUES ($1,$2,$3)',
            [dispute._id, req.user._id, message]
        );

        const updated = await Dispute.findById(dispute._id);
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
