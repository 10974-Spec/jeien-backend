const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { initiateStkPush } = require('./src/controllers/paymentController');

dotenv.config();

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
        console.log('Connected to MongoDB');

        // Create a mock user request and response objects
        const req = {
            body: {
                amount: 1,
                phoneNumber: process.argv[2] || '254746917511', // Use provided arg or dummy
                orderId: new mongoose.Types.ObjectId()
            },
            user: {
                _id: new mongoose.Types.ObjectId()
            }
        };

        const res = {
            status: function (code) {
                this.statusCode = code;
                return this;
            },
            json: function (data) {
                console.log(`Response Status: ${this.statusCode || 200}`);
                console.log('Response Data:', JSON.stringify(data, null, 2));
                process.exit(this.statusCode && this.statusCode >= 400 ? 1 : 0);
            },
            send: function (msg) {
                console.log(`Response Status: ${this.statusCode || 200}`);
                console.log('Response Message:', msg);
                process.exit(this.statusCode && this.statusCode >= 400 ? 1 : 0);
            }
        };

        console.log(`Initiating STK Push for ${req.body.phoneNumber} with amount ${req.body.amount}...`);
        initiateStkPush(req, res);
    })
    .catch(err => {
        console.error('DB Connection Error:', err);
        process.exit(1);
    });
