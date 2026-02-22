const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./src/models/User');
const Product = require('./src/models/Product');
const Order = require('./src/models/Order');
const Payment = require('./src/models/Payment');
const Setting = require('./src/models/Setting');
const bcrypt = require('bcryptjs');

dotenv.config();

const wipeAndReseed = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('--- Connected to MongoDB ---');

        console.log('Wiping all users, products, orders, payments, and settings...');
        await User.deleteMany({});
        await Product.deleteMany({});
        await Order.deleteMany({});
        await Payment.deleteMany({});
        await Setting.deleteMany({});

        console.log('Old schemas and data completely purged!');

        console.log('Reseeding fresh Admin account...');
        const adminPassword = await bcrypt.hash('jeien@2026MAIN@', 10);
        await User.create({
            name: 'System Admin',
            email: 'caprufru@gmail.com',
            password: adminPassword,
            role: 'admin',
            isAdmin: true,
            phone: '+254746917511',
            storeName: 'Jeien Agencies'
        });

        console.log('System successfully reset. You can now log in with caprufru@gmail.com.');
        process.exit(0);
    } catch (error) {
        console.error('Database reset failed:', error);
        process.exit(1);
    }
}

wipeAndReseed();
