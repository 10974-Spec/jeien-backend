const PDFDocument = require('pdfkit');
const Order = require('../modules/orders/order.model');
const User = require('../modules/users/user.model');

/**
 * Generate invoice PDF for an order
 * @param {string} orderId - Order ID
 * @returns {PDFDocument} PDF document stream
 */
const generateInvoicePDF = async (orderId) => {
    // Fetch order with populated fields
    const order = await Order.findById(orderId)
        .populate('buyer', 'name email phone')
        .populate('items.productId', 'title price')
        .populate('vendorIds', 'businessName');

    if (!order) {
        throw new Error('Order not found');
    }

    // Create PDF document
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    // Company header
    doc
        .fontSize(20)
        .font('Helvetica-Bold')
        .text('JEIEN AGENCIES', 50, 50)
        .fontSize(10)
        .font('Helvetica')
        .text('Premium Marketplace', 50, 75)
        .text('Nairobi, Kenya', 50, 88)
        .text('+254746917511', 50, 101)
        .text('info@jeien.com', 50, 114);

    // Invoice title and details
    doc
        .fontSize(18)
        .font('Helvetica-Bold')
        .text('INVOICE', 300, 50, { align: 'right' })
        .fontSize(10)
        .font('Helvetica')
        .text(`Invoice #: INV-${order.orderId}`, 300, 75, { align: 'right' })
        .text(`Date: ${new Date(order.createdAt).toLocaleDateString('en-GB')}`, 300, 88, { align: 'right' })
        .text(`Order: ${order.orderId}`, 300, 101, { align: 'right' });

    // Horizontal line
    doc
        .moveTo(50, 140)
        .lineTo(550, 140)
        .stroke();

    // Bill To section
    doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('Bill To:', 50, 160)
        .fontSize(10)
        .font('Helvetica')
        .text(order.buyer?.name || 'N/A', 50, 178, { width: 230 })
        .text(order.buyer?.email || 'N/A', 50, 191, { width: 230 })
        .text(order.buyer?.phone || 'N/A', 50, 204, { width: 230 });

    // Shipping Address
    if (order.deliveryAddress) {
        const address = order.deliveryAddress;
        doc
            .fontSize(12)
            .font('Helvetica-Bold')
            .text('Ship To:', 300, 160)
            .fontSize(10)
            .font('Helvetica')
            .text(address.fullName || order.buyer?.name || 'N/A', 300, 178, { width: 230 })
            .text(address.street || address.address || 'N/A', 300, 191, { width: 230 })
            .text(`${address.city || ''}, ${address.postalCode || ''}`, 300, 204, { width: 230 })
            .text(address.phone || '', 300, 217, { width: 230 });
    }

    // Items table header
    const tableTop = 250;
    doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('Item', 50, tableTop)
        .text('Qty', 300, tableTop, { width: 50, align: 'center' })
        .text('Price', 370, tableTop, { width: 80, align: 'right' })
        .text('Total', 470, tableTop, { width: 80, align: 'right' });

    // Line under header
    doc
        .moveTo(50, tableTop + 15)
        .lineTo(550, tableTop + 15)
        .stroke();

    // Items
    let yPosition = tableTop + 25;
    doc.font('Helvetica');

    if (order.items && order.items.length > 0) {
        order.items.forEach((item, index) => {
            // Use snapshot title first, fall back to populated product title
            const itemName = item.title || item.productId?.title || 'Product';
            const quantity = item.quantity || 1;
            const price = item.price || item.productId?.price || 0;
            const total = quantity * price;

            // Check if we need a new page
            if (yPosition > 700) {
                doc.addPage();
                yPosition = 50;
            }

            doc
                .fontSize(10)
                .text(itemName, 50, yPosition, { width: 230 })
                .text(quantity.toString(), 300, yPosition, { width: 50, align: 'center' })
                .text(`KES ${price.toLocaleString()}`, 370, yPosition, { width: 80, align: 'right' })
                .text(`KES ${total.toLocaleString()}`, 470, yPosition, { width: 80, align: 'right' });

            yPosition += 25;
        });
    }

    // Line before totals
    yPosition += 10;
    doc
        .moveTo(50, yPosition)
        .lineTo(550, yPosition)
        .stroke();

    // Totals section
    yPosition += 20;
    const subtotal = order.subtotal || order.totalAmount || 0;

    // Calculate commission details safely
    const commissionRate = order.commissionDetails?.rate || 7;
    // Ensure numeric values
    const safeSubtotal = Number(subtotal) || 0;
    const adminCommission = order.commissionDetails?.adminAmount || (safeSubtotal * (commissionRate / 100));
    const vendorAmount = order.commissionDetails?.vendorAmount || (safeSubtotal - adminCommission);

    doc
        .fontSize(10)
        .font('Helvetica')
        .text('Subtotal:', 370, yPosition, { width: 100, align: 'left' })
        .text(`KES ${safeSubtotal.toLocaleString()}`, 470, yPosition, { width: 80, align: 'right' });

    yPosition += 20;
    doc
        .text(`Admin Commission (${commissionRate}%):`, 370, yPosition, { width: 100, align: 'left' })
        .text(`KES ${Number(adminCommission).toLocaleString()}`, 470, yPosition, { width: 80, align: 'right' });

    yPosition += 20;
    doc
        .text(`Vendor Amount (${100 - commissionRate}%):`, 370, yPosition, { width: 100, align: 'left' })
        .text(`KES ${Number(vendorAmount).toLocaleString()}`, 470, yPosition, { width: 80, align: 'right' });

    yPosition += 10;
    doc
        .moveTo(370, yPosition)
        .lineTo(550, yPosition)
        .stroke();

    yPosition += 15;
    doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('TOTAL:', 370, yPosition, { width: 100, align: 'left' })
        .text(`KES ${safeSubtotal.toLocaleString()}`, 470, yPosition, { width: 80, align: 'right' });

    // Payment information
    yPosition += 40;
    doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('Payment Information:', 50, yPosition);

    yPosition += 20;
    doc
        .font('Helvetica')
        .text(`Method: ${order.paymentDetails?.provider || 'N/A'}`, 50, yPosition)
        .text(`Status: ${order.paymentStatus}`, 50, yPosition + 15)
        .text(`Transaction ID: ${order.paymentDetails?.transactionId || 'N/A'}`, 50, yPosition + 30);

    if (order.paymentDetails?.mpesaReceiptNumber) {
        doc.text(`M-Pesa Receipt: ${order.paymentDetails.mpesaReceiptNumber}`, 50, yPosition + 45);
    }

    // Footer
    doc
        .fontSize(8)
        .font('Helvetica')
        .text('Thank you for your business!', 50, 750, { align: 'center', width: 500 })
        .text('This is a computer-generated invoice and does not require a signature.', 50, 765, { align: 'center', width: 500 });

    return doc;
};

/**
 * Generate invoice and send as response
 * @param {Object} res - Express response object
 * @param {string} orderId - Order ID
 * @param {boolean} download - Whether to download or preview
 */
const sendInvoicePDF = async (res, orderId, download = true) => {
    try {
        const doc = await generateInvoicePDF(orderId);

        // Set response headers
        const filename = `invoice-${orderId}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');

        if (download) {
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        } else {
            res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        }

        // Pipe PDF to response
        doc.pipe(res);
        doc.end();
    } catch (error) {
        console.error('Invoice generation error:', error);
        throw error;
    }
};

module.exports = {
    generateInvoicePDF,
    sendInvoicePDF
};
