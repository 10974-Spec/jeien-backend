
require('dotenv').config();
const mongoose = require('mongoose');
const SystemLog = require('../src/modules/logs/system-log.model');

const checkFailure = async (orderId) => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // 1. Check the Order
        const Order = mongoose.model('Order', new mongoose.Schema({
            orderId: String,
            paymentStatus: String,
            paymentDetails: Object,
            totalAmount: Number
        }, { strict: false }));

        const order = await Order.findById(orderId);

        if (order) {
            console.log('\n📦 ORDER DETAILS:');
            console.log('   ID:', order.orderId);
            console.log('   Status:', order.paymentStatus);
            console.log('   Transaction ID:', order.paymentDetails?.transactionId);
            console.log('   Error Code:', order.paymentDetails?.errorCode);
            console.log('   Error Desc:', order.paymentDetails?.errorDescription);
        } else {
            console.log('❌ Order not found');
        }

        // 2. Check System Logs for this transaction
        if (order?.paymentDetails?.transactionId) {
            const txId = order.paymentDetails.transactionId;
            console.log(`\n🔍 SEARCHING LOGS FOR TRANSACTION: ${txId}`);

            const logs = await SystemLog.find({
                $or: [
                    { message: { $regex: txId, $options: 'i' } },
                    { 'metadata.CheckoutRequestID': txId },
                    { 'metadata.transactionId': txId }
                ]
            }).sort({ createdAt: 1 });

            if (logs.length > 0) {
                console.log(`✅ Found ${logs.length} log entries:\n`);
                logs.forEach(log => {
                    console.log(`[${log.timestamp.toISOString()}] [${log.level}] ${log.message}`);
                    if (log.metadata && Object.keys(log.metadata).length > 0) {
                        console.log('   Metadata:', JSON.stringify(log.metadata, null, 2));
                    }
                    console.log('---');
                });
            } else {
                console.log('❌ No system logs found for this transaction.');
            }
        }

        // 3. Check recent errors
        console.log('\n🚨 RECENT ERROR LOGS (Last 10):');
        const errors = await SystemLog.find({ level: 'ERROR' })
            .sort({ createdAt: -1 })
            .limit(10);

        errors.forEach(log => {
            console.log(`[${log.timestamp.toISOString()}] ${log.message}`);
        });

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
    }
};

const id = process.argv[2];
if (id) checkFailure(id);
else console.log('Please provide order ID');
