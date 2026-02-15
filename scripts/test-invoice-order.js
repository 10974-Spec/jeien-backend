require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Order = require('../src/modules/orders/order.model');
const Product = require('../src/modules/products/product.model'); // Added Product model
const { generateInvoicePDF } = require('../src/utils/invoice.service');

// Mock response object for PDF generation
const mockRes = {
    setHeader: (key, value) => console.log(`[Header] ${key}: ${value}`),
    write: (chunk) => { }, // No-op for write
    end: () => console.log('PDF generation stream ended'),
    on: (event, cb) => { },
    once: (event, cb) => { },
    emit: (event, ...args) => { }
};

async function testOrderAndInvoice() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // 1. Fetch latest order
        const order = await Order.findOne().sort({ createdAt: -1 });

        if (!order) {
            console.error('❌ No orders found in database to test.');
            process.exit(0);
        }

        console.log(`\n📋 Testing with Order: ${order.orderId} (${order._id})`);
        console.log(`   Current Status: ${order.status}`);

        // 2. Test Status Update Logic (Simulation)
        console.log('\n🔄 Testing Status Update Logic...');
        const validStatuses = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
        const newStatus = 'PROCESSING'; // Pick a safe status or just toggle

        if (validStatuses.includes(newStatus)) {
            order.status = newStatus;
            // Add status note
            order.statusNotes = order.statusNotes || [];
            order.statusNotes.push({
                status: newStatus,
                note: 'Automated test update',
                updatedBy: order.buyer, // Simulating update
                updatedAt: new Date()
            });
            await order.save();
            console.log(`✅ Order status updated locally to: ${order.status}`);
        } else {
            console.error('❌ Invalid status for test');
        }

        // 3. Test Invoice Generation
        console.log('\n📄 Testing Invoice Generation...');
        try {
            const doc = await generateInvoicePDF(order._id);

            const outputPath = path.join(__dirname, `test-invoice-${order.orderId}.pdf`);
            const writeStream = fs.createWriteStream(outputPath);

            doc.pipe(writeStream);
            doc.end();

            await new Promise((resolve, reject) => {
                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
            });

            console.log(`✅ Invoice generated successfully: ${outputPath}`);

            // Check file size
            const stats = fs.statSync(outputPath);
            console.log(`   File Size: ${(stats.size / 1024).toFixed(2)} KB`);

            if (stats.size < 1000) {
                console.warn('⚠️  Warning: Invoice PDF seems suspiciously small.');
            }

        } catch (err) {
            console.error('❌ Invoice Generation Failed:', err);
            console.error(err.stack);
        }

    } catch (error) {
        console.error('❌ Test Script Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Disconnected from MongoDB');
    }
}

testOrderAndInvoice();
