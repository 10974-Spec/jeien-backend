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

// Root endpoint for testing
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Payment routes loaded successfully',
    timestamp: new Date().toISOString(),
    availableEndpoints: [
      'POST /api/payments/mpesa',
      'POST /api/payments/paypal',
      'POST /api/payments/card',
      'POST /api/payments/webhook',
      'POST /api/payments/mpesa/callback',
      'GET /api/payments/methods',
      'GET /api/payments/status/:orderId'
    ]
  });
});


// Payment processing endpoints
router.post('/mpesa', authenticate, processMpesaPayment);
router.post('/paypal', authenticate, processPayPalPayment);
router.post('/card', authenticate, processCardPayment);

// Payment webhook (no authentication needed for webhooks)
router.post('/webhook', handlePaymentWebhook);
router.post('/mpesa/callback', handlePaymentWebhook); // M-Pesa specific callback endpoint

// Payment methods and status
router.get('/methods', authenticate, getPaymentMethods);
router.get('/methods', authenticate, getPaymentMethods);
router.get('/status/:orderId', authenticate, getPaymentStatus);
router.post('/verify', authenticate, require('./payment.controller').verifyTransaction); // Admin verification endpoint

// Test endpoint (only in development)
if (process.env.NODE_ENV === 'development') {
  router.post('/test/mpesa', authenticate, testMpesaPayment);
  router.post('/manual-complete', authenticate, manualCompletePayment); // Manual completion for real payments in dev
}

module.exports = router;