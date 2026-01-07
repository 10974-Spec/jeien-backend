const express = require('express');
const router = express.Router();
const authenticate = require('../../middlewares/auth.middleware');
const {
  processMpesaPayment,
  processPayPalPayment,
  processCardPayment,
  handlePaymentWebhook,
  getPaymentMethods,
  getPaymentStatus
} = require('./payment.controller');

router.post('/mpesa', authenticate, processMpesaPayment);
router.post('/paypal', authenticate, processPayPalPayment);
router.post('/card', authenticate, processCardPayment);
router.post('/webhook', handlePaymentWebhook);
router.get('/methods', getPaymentMethods);
router.get('/status/:orderId', authenticate, getPaymentStatus);

module.exports = router;