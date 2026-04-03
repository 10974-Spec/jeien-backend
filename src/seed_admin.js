/**
 * Jeien Marketplace - Admin Seeder
 * Creates admin user and seeds test data for endpoint testing.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const bcrypt = require('bcryptjs');
const { Pool } = require('@neondatabase/serverless');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const User = require('./models/User');

async function seed() {
    // Verify connection
    await pool.query('SELECT 1');
    console.log('✅ Connected to Neon PostgreSQL');

    const adminEmail = 'caprufru@gmail.com';
    const adminPass = await bcrypt.hash('jeien@2026MAIN@', 10);

    let admin = await User.findOne({ email: adminEmail });
    if (!admin) {
        admin = await User.create({
            name: 'Main Admin',
            email: adminEmail,
            password: adminPass,
            phone: '0746917511',
            role: 'admin',
            isVerified: true,
            vendorStatus: 'approved',
        });
        console.log('✅ Admin user created:', adminEmail);
    } else {
        admin.password = adminPass;
        admin.role = 'admin';
        admin.isVerified = true;
        const updated = await User.save(admin);
        console.log('✅ Admin user updated:', adminEmail);
    }

    console.log('Admin ID:', admin._id.toString());
    await pool.end();
    console.log('Done!');
}

seed().catch(e => { console.error('Seed error:', e.message); process.exit(1); });
