const mongoose = require('mongoose');
const User = require('../modules/users/user.model');
const bcrypt = require('bcryptjs');
const path = require('path');
const dotenv = require('dotenv');

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

const verifyAdmin = async () => {
    await connectDB();

    const email = 'admin@jeien.org';
    const password = 'Jeien@254.ke'; // The password user expects

    try {
        let user = await User.findOne({ email });

        if (user) {
            console.log('Admin user found.');
            // Update password just in case it's different
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(password, salt);
            user.role = 'ADMIN'; // Ensure role is ADMIN
            await user.save();
            console.log('Admin password updated to: Jeien@254.ke');
        } else {
            console.log('Admin user not found. Creating...');
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            user = await User.create({
                name: 'Admin User',
                email,
                password: hashedPassword,
                role: 'ADMIN',
                phone: '0000000000'
            });
            console.log('Admin user created with password: Jeien@254.ke');
        }

        process.exit();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

verifyAdmin();
