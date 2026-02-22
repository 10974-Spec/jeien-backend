const mongoose = require('mongoose');
const Order = require('./src/models/Order');

async function testUpdate() {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/jeien');
    const order = await Order.findOne();
    if (order) {
        console.log('Found order:', order._id);
        order.status = 'shipped'; // Valid enum: ['pending', 'paid', 'processing', 'completed', 'cancelled'] Oh! Wait...
        try {
            await order.save();
            console.log('Saved successfully');
        } catch (e) {
            console.error('Validation error:', e.message);
        }
    } else {
        console.log('No orders found');
    }
    process.exit(0);
}

testUpdate();
