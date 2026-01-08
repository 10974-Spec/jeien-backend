const axios = require('axios');

const getMpesaAccessToken = async () => {
  try {
    console.log('Getting M-Pesa access token...');
    
    if (!process.env.MPESA_CONSUMER_KEY || !process.env.MPESA_CONSUMER_SECRET) {
      throw new Error('M-Pesa credentials not configured');
    }
    
    const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString('base64');
    
    const response = await axios.get('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
      headers: {
        'Authorization': `Basic ${auth}`
      }
    });
    
    console.log('Access token received successfully');
    return response.data.access_token;
  } catch (error) {
    console.error('Failed to get M-Pesa access token:', error.response?.data || error.message);
    throw error;
  }
};

const initiateMpesaPayment = async (phone, amount, reference) => {
  try {
    console.log(`Initiating M-Pesa payment: Phone=${phone}, Amount=${amount}, Ref=${reference}`);
    
    if (!phone || phone.length < 10) {
      throw new Error('Invalid phone number');
    }
    
    if (!amount || amount <= 0) {
      throw new Error('Invalid amount');
    }
    
    const accessToken = await getMpesaAccessToken();
    
    // Format phone number for M-Pesa (2547XXXXXXXX)
    const formattedPhone = phone.startsWith('0') ? `254${phone.substring(1)}` : 
                          phone.startsWith('+254') ? phone.substring(1) : 
                          phone.startsWith('254') ? phone : `254${phone}`;
    
    console.log(`Formatted phone: ${formattedPhone}`);
    
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const password = Buffer.from(`174379${process.env.MPESA_PASSKEY}${timestamp}`).toString('base64');
    
    const payload = {
      BusinessShortCode: 174379, // Lipa Na M-Pesa Online Shortcode
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(amount), // Must be integer
      PartyA: formattedPhone,
      PartyB: 174379,
      PhoneNumber: formattedPhone,
      CallBackURL: `${process.env.API_URL}/api/payments/webhook`, // Make sure this is correct
      AccountReference: reference.substring(0, 12), // Max 12 characters
      TransactionDesc: 'Ecommerce Purchase'
    };
    
    console.log('M-Pesa STK Push payload:', JSON.stringify(payload, null, 2));

    const response = await axios.post('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', payload, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 seconds timeout
    });
    
    console.log('M-Pesa STK Push response:', JSON.stringify(response.data, null, 2));
    
    if (!response.data || !response.data.ResponseCode) {
      throw new Error('Invalid response from M-Pesa');
    }
    
    if (response.data.ResponseCode !== '0') {
      throw new Error(`M-Pesa Error: ${response.data.ResponseDescription}`);
    }
    
    return {
      success: true,
      data: response.data,
      checkoutRequestId: response.data.CheckoutRequestID,
      merchantRequestId: response.data.MerchantRequestID,
      responseDescription: response.data.ResponseDescription
    };
    
  } catch (error) {
    console.error('M-Pesa STK Push failed:', {
      error: error.message,
      response: error.response?.data,
      status: error.response?.status,
      phone,
      amount,
      reference
    });
    
    // Common error messages and solutions
    let errorMessage = error.message;
    if (error.response?.data?.errorMessage) {
      errorMessage = error.response.data.errorMessage;
    } else if (error.response?.data?.ResponseDescription) {
      errorMessage = error.response.data.ResponseDescription;
    }
    
    // Check for specific M-Pesa errors
    if (errorMessage.includes('Invalid Access Token')) {
      errorMessage = 'M-Pesa authentication failed. Check your API credentials.';
    } else if (errorMessage.includes('The initiator information is invalid')) {
      errorMessage = 'Invalid business shortcode or credentials.';
    } else if (errorMessage.includes('Request cancelled by user')) {
      errorMessage = 'Payment cancelled by user on their phone.';
    } else if (errorMessage.includes('DS timeout')) {
      errorMessage = 'M-Pesa system timeout. Please try again.';
    } else if (errorMessage.includes('Insufficient balance')) {
      errorMessage = 'Insufficient balance in M-Pesa account.';
    }
    
    return {
      success: false,
      error: errorMessage,
      details: error.response?.data
    };
  }
};

const verifyPayPalPayment = async (paymentId) => {
  try {
    console.log(`Verifying PayPal payment: ${paymentId}`);
    
    if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
      throw new Error('PayPal credentials not configured');
    }
    
    const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
    
    const response = await axios.post(`https://api-m.sandbox.paypal.com/v2/checkout/orders/${paymentId}/capture`, {}, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('PayPal verification failed:', error.response?.data || error.message);
    throw error;
  }
};

// Test function to validate M-Pesa setup
const testMpesaConnection = async () => {
  try {
    console.log('Testing M-Pesa connection...');
    
    // Check if credentials exist
    if (!process.env.MPESA_CONSUMER_KEY || !process.env.MPESA_CONSUMER_SECRET || !process.env.MPESA_PASSKEY) {
      console.error('M-Pesa environment variables missing:');
      console.error('MPESA_CONSUMER_KEY:', process.env.MPESA_CONSUMER_KEY ? 'Set' : 'Missing');
      console.error('MPESA_CONSUMER_SECRET:', process.env.MPESA_CONSUMER_SECRET ? 'Set' : 'Missing');
      console.error('MPESA_PASSKEY:', process.env.MPESA_PASSKEY ? 'Set' : 'Missing');
      return { success: false, error: 'M-Pesa credentials not configured' };
    }
    
    // Test access token retrieval
    const accessToken = await getMpesaAccessToken();
    console.log('Access token test: SUCCESS');
    
    return { 
      success: true, 
      message: 'M-Pesa connection successful',
      credentials: {
        consumerKey: process.env.MPESA_CONSUMER_KEY ? 'Set' : 'Missing',
        consumerSecret: process.env.MPESA_CONSUMER_SECRET ? 'Set' : 'Missing',
        passkey: process.env.MPESA_PASSKEY ? 'Set' : 'Missing'
      }
    };
    
  } catch (error) {
    console.error('M-Pesa connection test failed:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { 
  initiateMpesaPayment, 
  verifyPayPalPayment,
  testMpesaConnection
};