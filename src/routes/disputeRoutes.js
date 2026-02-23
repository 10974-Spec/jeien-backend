const express = require('express');
const router = express.Router();
const {
    createDispute,
    getMyDisputes,
    getAllDisputes,
    updateDispute,
    addDisputeMessage
} = require('../controllers/disputeController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/')
    .post(protect, createDispute)
    .get(protect, admin, getAllDisputes);

router.route('/my-disputes')
    .get(protect, getMyDisputes);

router.route('/:id')
    .put(protect, admin, updateDispute);

router.route('/:id/messages')
    .post(protect, addDisputeMessage);

module.exports = router;
