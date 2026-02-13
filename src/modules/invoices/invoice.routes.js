const express = require('express');
const router = express.Router();
const invoiceController = require('./invoice.controller');
const { authenticate, authorize } = require('../../middlewares/auth.middleware');

/**
 * @route   GET /api/invoices/:orderId
 * @desc    Download invoice PDF for an order
 * @access  Admin only
 */
router.get(
    '/:orderId',
    authenticate,
    authorize(['admin']),
    invoiceController.downloadInvoice
);

/**
 * @route   GET /api/invoices/:orderId/preview
 * @desc    Preview invoice PDF in browser
 * @access  Admin only
 */
router.get(
    '/:orderId/preview',
    authenticate,
    authorize(['admin']),
    invoiceController.previewInvoice
);

module.exports = router;
