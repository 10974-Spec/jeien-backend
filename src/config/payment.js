const axios = require('axios');

const getMpesaAccessToken = async () => {
  const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString('base64');
  
  const response = await axios.get('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
    headers: {
      Authorization: `Basic ${auth}`
    }
  });
  
  return response.data.access_token;
};

const initiateMpesaPayment = async (phone, amount, reference) => {
  const accessToken = await getMpesaAccessToken();
  
  const payload = {
    BusinessShortCode: 174379,
    Password: Buffer.from(`174379${process.env.MPESA_PASSKEY}${new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)}`).toString('base64'),
    Timestamp: new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14),
    TransactionType: 'CustomerPayBillOnline',
    Amount: amount,
    PartyA: phone,
    PartyB: 174379,
    PhoneNumber: phone,
    CallBackURL: `${process.env.API_URL}/payments/mpesa-webhook`,
    AccountReference: reference,
    TransactionDesc: 'Ecommerce Purchase'
  };

  const response = await axios.post('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', payload, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  return response.data;
};

const verifyPayPalPayment = async (paymentId) => {
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  
  const response = await axios.post('https://api-m.sandbox.paypal.com/v2/checkout/orders/${paymentId}/capture', {}, {
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json'
    }
  });
  
  return response.data;
};

module.exports = { initiateMpesaPayment, verifyPayPalPayment };