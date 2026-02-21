const PDFDocument = require('pdfkit');

const generateInvoice = (order, res) => {
    const doc = new PDFDocument({ margin: 50 });

    let filename = `Invoice-${order._id}.pdf`;
    filename = encodeURIComponent(filename);

    // Stream response
    res.setHeader('Content-disposition', 'attachment; filename="' + filename + '"');
    res.setHeader('Content-type', 'application/pdf');

    doc.pipe(res);

    // Header
    doc
        .image('backend/src/logo.png', 50, 45, { width: 50 }) // Placeholder path
        .fillColor('#444444')
        .fontSize(20)
        .text('Jeien Agencies', 110, 57)
        .fontSize(10)
        .text('123 Main Street', 200, 65, { align: 'right' })
        .text('Nairobi, Kenya', 200, 80, { align: 'right' })
        .moveDown();

    // Invoice Info
    doc.fontSize(20).text('Invoice', 50, 160);
    doc
        .fontSize(10)
        .text(`Invoice Number: ${order._id}`, 50, 200)
        .text(`Invoice Date: ${new Date().toLocaleDateString()}`, 50, 215)
        .text(`Balance Due: 0.00`, 50, 230)
        .text(`Payment Method: ${order.paymentMethod}`, 50, 245)
        .moveDown();

    // Table Header
    const tableTop = 330;
    doc.font('Helvetica-Bold');
    doc
        .text('Item', 50, tableTop)
        .text('Quantity', 300, tableTop)
        .text('Price', 350, tableTop) // Adjusted X position
        .text('Total', 450, tableTop); // Adjusted X position used to be 400

    // Table Lines
    doc
        .strokeColor('#aaaaaa')
        .lineWidth(1)
        .moveTo(50, tableTop + 15)
        .lineTo(550, tableTop + 15)
        .stroke();

    // Items
    let i = 0;
    doc.font('Helvetica');
    for (const item of order.orderItems) {
        const y = tableTop + 30 + (i * 30);
        doc
            .text(item.name, 50, y)
            .text(item.quantity, 300, y)
            .text(item.price, 350, y)
            .text(item.price * item.quantity, 450, y);
        i++;
    }

    // Total
    const subtotalPosition = tableTop + (i + 1) * 30;
    doc.font('Helvetica-Bold');
    doc.text('Total:', 350, subtotalPosition);
    doc.text(order.totalPrice, 450, subtotalPosition);

    doc.end();
};

module.exports = generateInvoice;
