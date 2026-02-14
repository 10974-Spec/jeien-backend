
require('dotenv').config();
const mongoose = require('mongoose');

const checkOrder = async (orderId) => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const Order = mongoose.model('Order', new mongoose.Schema({
            orderId: String,
            paymentStatus: String,
            status: String,
            totalAmount: Number,
            paymentDetails: Object, // mapping logic might vary, Schemaless for flexibility here
            createdAt: Date
        }, { strict: false }));

        const order = await Order.findById(orderId);

        if (!order) {
            console.log('❌ Order not found');
            return;
        }

        console.log('📦 Order ID:', order.orderId);
        console.log('   _id:', order._id);
        console.log('   Transaction ID:', order.paymentDetails?.transactionId);
        console.log('   Exact Transaction ID Length:', order.paymentDetails?.transactionId?.length);
        console.log('   Expected ID:', 'ws_CO_14022026224548448117041805');
        console.log('   Match:', order.paymentDetails?.transactionId === 'ws_CO_14022026224548448117041805');
        console.log('   Payment details:', JSON.stringify(order.paymentDetails, null, 2));

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
    }
};

const id = process.argv[2];
if (id) checkOrder(id);
else console.log('Please provide order ID');
