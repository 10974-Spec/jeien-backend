const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const mpesaService = require('../src/utils/mpesa.service');

// Mock format for phone number
const TEST_PHONE = '254117041805'; // User's phone from logs
const TEST_AMOUNT = 1;

async function testMpesaLive() {
    console.log('🚀 Starting M-Pesa Live Connectivity Test...');

    try {
        console.log('1. Checking Environment Variables...');
        const requiredVars = ['MPESA_CONSUMER_KEY', 'MPESA_CONSUMER_SECRET', 'MPESA_PASSKEY', 'API_URL'];
        const missing = requiredVars.filter(v => !process.env[v]);
        if (missing.length > 0) {
            console.error('❌ Missing environment variables:', missing);
            process.exit(1);
        }
        console.log('✅ Environment variables present.');

        console.log('2. Testing Access Token Generation...');
        const token = await mpesaService.getAccessToken();
        console.log('✅ Access Token obtained:', token.substring(0, 10) + '...');

        console.log('3. Initiating STK Push...');
        const orderId = `TEST-${Date.now()}`;
        const result = await mpesaService.initiateSTKPush({
            phoneNumber: TEST_PHONE,
            amount: TEST_AMOUNT,
            accountReference: orderId,
            transactionDesc: 'System Test',
            callbackUrl: `${process.env.API_URL}/api/payments/mpesa/callback`
        });

        console.log('STK Push Result:', JSON.stringify(result, null, 2));

        if (result.success) {
            console.log('✅ STK Push Initiated Successfully!');
            const checkoutReqId = result.data.CheckoutRequestID;

            console.log('4. Waiting 10 seconds before querying status...');
            await new Promise(resolve => setTimeout(resolve, 10000));

            console.log('5. Querying Transaction Status...');
            try {
                const status = await mpesaService.querySTKPushStatus(checkoutReqId);
                console.log('Query Result:', JSON.stringify(status, null, 2));
            } catch (err) {
                console.error('❌ Status Query Failed:', err.message);
            }
        } else {
            console.error('❌ STK Push Failed:', result.message);
        }

    } catch (error) {
        console.error('❌ Test Failed:', error);
    }
}

testMpesaLive();
