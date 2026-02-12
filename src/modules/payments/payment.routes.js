const express = require('express');
const router = express.Router();
const authenticate = require('../../middlewares/auth.middleware');
const {
  processMpesaPayment,
  processPayPalPayment,
  processCardPayment,
  handlePaymentWebhook,
  getPaymentMethods,
  getPaymentStatus,
  testMpesaPayment,
  manualCompletePayment
} = require('./payment.controller');

// Payment processing endpoints
router.post('/mpesa', authenticate, processMpesaPayment);
router.post('/paypal', authenticate, processPayPalPayment);
router.post('/card', authenticate, processCardPayment);

// Payment webhook (no authentication needed for webhooks)
router.post('/webhook', handlePaymentWebhook);
router.post('/mpesa/callback', handlePaymentWebhook); // M-Pesa specific callback endpoint

// Payment methods and status
router.get('/methods', authenticate, getPaymentMethods);
router.get('/status/:orderId', authenticate, getPaymentStatus);

// Test endpoint (only in development)
if (process.env.NODE_ENV === 'development') {
  router.post('/test/mpesa', authenticate, testMpesaPayment);
  router.post('/manual-complete', authenticate, manualCompletePayment); // Manual completion for real payments in dev
}

module.exports = router;