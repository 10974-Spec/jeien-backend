/**
 * Jeien Marketplace - Admin Seeder
 * Creates admin user and seeds test data for endpoint testing.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('./models/User');

async function seed() {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('✅ Connected to DB');

    // Create or update admin
    const adminEmail = 'admin@jeien.com';
    const adminPass = await bcrypt.hash('admin123', 10);

    let admin = await User.findOne({ email: adminEmail });
    if (!admin) {
        admin = await User.create({
            name: 'Main Admin',
            email: adminEmail,
            password: adminPass,
            phone: '0700000000',
            role: 'admin',
            isVerified: true,
        });
        console.log('✅ Admin user created:', adminEmail);
    } else {
        admin.password = adminPass;
        admin.role = 'admin';
        admin.isVerified = true;
        await admin.save();
        console.log('✅ Admin user updated:', adminEmail);
    }

    console.log('Admin ID:', admin._id.toString());
    await mongoose.disconnect();
    console.log('Done!');
}

seed().catch(e => { console.error('Seed error:', e.message); process.exit(1); });
