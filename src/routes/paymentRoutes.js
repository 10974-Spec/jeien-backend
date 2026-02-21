const express = require('express');
const router = express.Router();
const { initiateStkPush, mpesaCallback } = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

router.post('/stkpush', protect, initiateStkPush);
router.post('/callback', mpesaCallback);

module.exports = router;
