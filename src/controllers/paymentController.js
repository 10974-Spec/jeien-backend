const axios = require('axios');
const getMpesaToken = require('../utils/mpesaToken');
const sendSMS = require('../utils/sms');
const Payment = require('../models/Payment');
const Order = require('../models/Order');

// @desc    Initiate STK Push
// @route   POST /api/payments/stkpush
// @access  Private
const initiateStkPush = async (req, res) => {
    const { amount, phoneNumber, orderId } = req.body;

    if (!amount || !phoneNumber || !orderId) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        const token = await getMpesaToken();
        const date = new Date();
        const timestamp =
            date.getFullYear() +
            ('0' + (date.getMonth() + 1)).slice(-2) +
            ('0' + date.getDate()).slice(-2) +
            ('0' + date.getHours()).slice(-2) +
            ('0' + date.getMinutes()).slice(-2) +
            ('0' + date.getSeconds()).slice(-2);

        const shortCode = process.env.MPESA_SHORTCODE;
        const passkey = process.env.MPESA_PASSKEY;
        const password = Buffer.from(shortCode + passkey + timestamp).toString('base64');

        const callbackUrl = `${process.env.API_URL}/api/payments/callback`;

        const stkUrl =
            process.env.MPESA_ENV === 'production'
                ? 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
                : 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';

        const data = {
            BusinessShortCode: shortCode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerPayBillOnline',
            Amount: Math.floor(amount), // Ensure integer
            PartyA: phoneNumber,
            PartyB: shortCode,
            PhoneNumber: phoneNumber,
            CallBackURL: callbackUrl,
            AccountReference: `Order ${orderId}`,
            TransactionDesc: 'Payment for Order',
        };

        const response = await axios.post(stkUrl, data, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        // Save partial payment info
        await Payment.create({
            order: orderId,
            user: req.user._id,
            amount: amount,
            phoneNumber: phoneNumber,
            checkoutRequestID: response.data.CheckoutRequestID,
            merchantRequestID: response.data.MerchantRequestID,
            status: 'pending'
        });

        res.json(response.data);
    } catch (error) {
        console.error('STK Push Error:', error.response?.data || error.message);
        res.status(500).json({ message: 'STK Push failed', error: error.response?.data || error.message });
    }
};

// @desc    M-Pesa Callback
// @route   POST /api/payments/callback
// @access  Public (Callback)
const mpesaCallback = async (req, res) => {
    try {
        const { Body } = req.body;

        if (!Body || !Body.stkCallback) {
            return res.status(400).send('Invalid callback');
        }

        const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = Body.stkCallback;

        const payment = await Payment.findOne({ checkoutRequestID: CheckoutRequestID });

        if (!payment) {
            console.error('Payment not found for callback', CheckoutRequestID);
            return res.status(404).send('Payment not found');
        }

        if (payment.status === 'completed') {
            return res.json({ result: 'already_processed' });
        }

        if (ResultCode === 0) {
            // Success
            const metadataItems = CallbackMetadata.Item;
            const amountItem = metadataItems.find(item => item.Name === 'Amount');
            const mpesaReceiptItem = metadataItems.find(item => item.Name === 'MpesaReceiptNumber');
            const phoneItem = metadataItems.find(item => item.Name === 'PhoneNumber');
            const dateItem = metadataItems.find(item => item.Name === 'TransactionDate');

            payment.status = 'completed';
            payment.mpesaReceiptNumber = mpesaReceiptItem?.Value;
            payment.transactionDate = dateItem?.Value; // Needs formatting likely
            payment.resultDesc = ResultDesc;
            await payment.save();

            // Update Order
            const order = await Order.findById(payment.order).populate('user', 'name phone');
            if (order) {
                order.isPaid = true;
                order.paidAt = Date.now();
                order.paymentResult = {
                    id: mpesaReceiptItem?.Value,
                    status: 'completed',
                    update_time: new Date().toISOString(),
                    email_address: order.user?.email || '', // simplified
                };
                order.status = 'paid';
                await order.save();

                // Format Phone Number for SMS (ensure starting with +)
                const rawPhone = payment.phoneNumber?.toString() || order.shippingAddress?.phone || (order.user && order.user.phone);
                if (rawPhone) {
                    let smsPhone = rawPhone.toString().trim();
                    if (smsPhone.startsWith('0')) smsPhone = '+254' + smsPhone.substring(1);
                    else if (smsPhone.startsWith('254')) smsPhone = '+' + smsPhone;
                    else if (!smsPhone.startsWith('+')) smsPhone = '+' + smsPhone;

                    const msg = `Dear customer, your Jeien order ${order._id.toString().slice(-8).toUpperCase()} of KSh ${payment.amount} has been paid successfully. We are now processing it. Thank you!`;
                    await sendSMS(smsPhone, msg);
                }
            }

        } else {
            // Failed
            payment.status = 'failed';
            payment.resultDesc = ResultDesc;
            await payment.save();
        }

        res.json({ result: 'queued' });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};

module.exports = { initiateStkPush, mpesaCallback };
