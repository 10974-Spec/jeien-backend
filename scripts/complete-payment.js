#!/usr/bin/env node

/**
 * Manual Payment Completion Script
 * Use this to manually complete stuck M-Pesa payments in development/production
 */

require('dotenv').config();
const mongoose = require('mongoose');

const completePayment = async (orderId) => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        const Order = mongoose.model('Order', new mongoose.Schema({}, { strict: false }));

        // Find the order
        const order = await Order.findById(orderId);

        if (!order) {
            console.log('❌ Order not found with ID:', orderId);
            process.exit(1);
        }

        console.log('📦 Order found:');
        console.log('   Order ID:', order.orderId);
        console.log('   Payment Status:', order.paymentStatus);
        console.log('   Order Status:', order.status);
        console.log('   Total Amount:', order.totalAmount);
        console.log('   Transaction ID:', order.paymentDetails?.transactionId);

        if (order.paymentStatus === 'COMPLETED') {
            console.log('\n✅ Payment already completed!');
            process.exit(0);
        }

        // Update the order
        order.paymentStatus = 'COMPLETED';
        order.status = 'CONFIRMED';
        order.paymentDetails = order.paymentDetails || {};
        order.paymentDetails.paidAt = new Date();
        order.paymentDetails.mpesaReceiptNumber = `MANUAL-${Date.now()}`;
        order.paymentDetails.notes = 'Payment manually completed via script';

        await order.save();

        console.log('\n✅ Payment completed successfully!');
        console.log('   New Payment Status:', order.paymentStatus);
        console.log('   New Order Status:', order.status);
        console.log('   Receipt Number:', order.paymentDetails.mpesaReceiptNumber);

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');
    }
};

// Get order ID from command line
const orderId = process.argv[2];

if (!orderId) {
    console.log('Usage: node complete-payment.js <orderId>');
    console.log('Example: node complete-payment.js 6990b731250b4bef09974012');
    process.exit(1);
}

completePayment(orderId);
