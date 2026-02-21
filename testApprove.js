const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('./src/models/Product');
const User = require('./src/models/User');

dotenv.config();

mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        console.log('Connected to MongoDB');

        // Find a pending product
        const product = await Product.findOne({ isApproved: false });
        if (!product) {
            console.log('No pending products found.');
            process.exit();
        }

        console.log('Found product:', product.name, product._id);

        product.isApproved = true;
        product.isActive = true;

        try {
            const saved = await product.save();
            console.log('Product approved successfully:', saved.isApproved);
        } catch (e) {
            console.error('Error saving product:', e);
        }

        process.exit();
    })
    .catch((e) => {
        console.error('Connection error:', e);
        process.exit(1);
    });
