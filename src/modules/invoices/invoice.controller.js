const invoiceService = require('../../utils/invoice.service');
const Order = require('../orders/order.model');

/**
 * Generate and download invoice PDF
 */
const downloadInvoice = async (req, res) => {
    try {
        const { orderId } = req.params;

        // Verify order exists
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        console.log(`Generating invoice for order: ${order.orderId}`);

        // Generate and send PDF
        await invoiceService.sendInvoicePDF(res, orderId, true);

    } catch (error) {
        console.error('Download invoice error:', error);

        // Check if headers already sent
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: 'Failed to generate invoice',
                error: error.message
            });
        }
    }
};

/**
 * Preview invoice PDF in browser
 */
const previewInvoice = async (req, res) => {
    try {
        const { orderId } = req.params;

        // Verify order exists
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        console.log(`Previewing invoice for order: ${order.orderId}`);

        // Generate and send PDF (inline, not download)
        await invoiceService.sendInvoicePDF(res, orderId, false);

    } catch (error) {
        console.error('Preview invoice error:', error);

        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: 'Failed to preview invoice',
                error: error.message
            });
        }
    }
};

module.exports = {
    downloadInvoice,
    previewInvoice
};
