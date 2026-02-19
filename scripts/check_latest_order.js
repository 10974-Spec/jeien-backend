const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Order = require('../src/modules/orders/order.model');

async function check() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const order = await Order.findOne({}).sort({ createdAt: -1 });
        console.log(JSON.stringify(order, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}
check();
