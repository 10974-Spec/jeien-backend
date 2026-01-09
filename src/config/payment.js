const axios = require('axios');

const getMpesaAccessToken = async () => {
  try {
    console.log('Getting M-Pesa access token...');
    
    // Use default sandbox credentials if not provided
    const consumerKey = process.env.MPESA_CONSUMER_KEY || 'your_sandbox_consumer_key_here';
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET || 'your_sandbox_consumer_secret_here';
    
    if (!consumerKey || !consumerSecret) {
      throw new Error('M-Pesa credentials not configured');
    }
    
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    
    const response = await axios.get('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
      headers: {
        'Authorization': `Basic ${auth}`
      }
    });
    
    console.log('Access token received successfully');
    return response.data.access_token;
  } catch (error) {
    console.error('Failed to get M-Pesa access token:', error.response?.data || error.message);
    
    // Provide helpful error message
    if (error.response?.status === 401) {
      throw new Error('Invalid M-Pesa Consumer Key or Consumer Secret. Please check your credentials.');
    }
    
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
    
    // Validate amount - should be reasonable for e-commerce
    if (amount > 150000) { // Max 150,000 KES for M-Pesa
      throw new Error('Amount exceeds M-Pesa limit (KES 150,000)');
    }
    
    const accessToken = await getMpesaAccessToken();
    
    // Format phone number for M-Pesa (2547XXXXXXXX)
    const formattedPhone = phone.startsWith('0') ? `254${phone.substring(1)}` : 
                          phone.startsWith('+254') ? phone.substring(1) : 
                          phone.startsWith('254') ? phone : `254${phone}`;
    
    console.log(`Formatted phone: ${formattedPhone}`);
    
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    
    // Use default sandbox passkey if not provided
    const passkey = process.env.MPESA_PASSKEY || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
    const password = Buffer.from(`174379${passkey}${timestamp}`).toString('base64');
    
    console.log('Generated password (first 20 chars):', password.substring(0, 20) + '...');
    
    // For development/testing, use a test callback URL
    const testCallbackUrl = 'https://webhook.site/c0e8b7a4-1234-5678-90ab-cdef01234567';
    
    const payload = {
      BusinessShortCode: 174379, // Sandbox Lipa Na M-Pesa Online Shortcode
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(amount), // Must be integer
      PartyA: formattedPhone,
      PartyB: 174379,
      PhoneNumber: formattedPhone,
      CallBackURL: testCallbackUrl,
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
    if (errorMessage.includes('Wrong credentials') || errorMessage.includes('500.001.1001')) {
      errorMessage = 'Invalid M-Pesa API credentials. Please check your Consumer Key, Consumer Secret, and Passkey.';
    } else if (errorMessage.includes('Invalid Access Token')) {
      errorMessage = 'M-Pesa authentication failed. Check your API credentials.';
    } else if (errorMessage.includes('The initiator information is invalid')) {
      errorMessage = 'Invalid business shortcode or credentials.';
    } else if (errorMessage.includes('Request cancelled by user')) {
      errorMessage = 'Payment cancelled by user on their phone.';
    } else if (errorMessage.includes('DS timeout')) {
      errorMessage = 'M-Pesa system timeout. Please try again.';
    } else if (errorMessage.includes('Insufficient balance')) {
      errorMessage = 'Insufficient balance in M-Pesa account.';
    } else if (errorMessage.includes('Invalid CallBackURL')) {
      errorMessage = 'Invalid callback URL. Please configure a valid CallBackURL.';
    }
    
    return {
      success: false,
      error: errorMessage,
      details: error.response?.data
    };
  }
};

// ALTERNATIVE: Test payment function (for development without real credentials)
const initiateTestMpesaPayment = async (phone, amount, reference) => {
  console.log('=== TEST MODE: Simulating M-Pesa Payment ===');
  console.log(`Phone: ${phone}, Amount: KES ${amount}, Reference: ${reference}`);
  
  // Simulate a successful payment for testing
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        data: {
          MerchantRequestID: `TEST-${Date.now()}`,
          CheckoutRequestID: `ws_CO_${Date.now()}`,
          ResponseCode: '0',
          ResponseDescription: 'Success. Request accepted for processing',
          CustomerMessage: 'Success. Request accepted for processing'
        },
        checkoutRequestId: `ws_CO_${Date.now()}`,
        merchantRequestId: `TEST-${Date.now()}`,
        responseDescription: 'Test payment initiated successfully'
      });
    }, 1000);
  });
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
    console.log('=== Testing M-Pesa Connection ===');
    
    // Check if credentials exist
    if (!process.env.MPESA_CONSUMER_KEY || !process.env.MPESA_CONSUMER_SECRET || !process.env.MPESA_PASSKEY) {
      console.warn('M-Pesa environment variables missing. Using sandbox defaults for testing.');
    }
    
    console.log('Environment variables:');
    console.log('- MPESA_CONSUMER_KEY:', process.env.MPESA_CONSUMER_KEY ? '✓ Set' : '✗ Missing (using default)');
    console.log('- MPESA_CONSUMER_SECRET:', process.env.MPESA_CONSUMER_SECRET ? '✓ Set' : '✗ Missing (using default)');
    console.log('- MPESA_PASSKEY:', process.env.MPESA_PASSKEY ? '✓ Set' : '✗ Missing (using sandbox default)');
    
    // Test access token retrieval
    try {
      const accessToken = await getMpesaAccessToken();
      console.log('✓ Access token test: SUCCESS');
      console.log('  Access Token (first 20 chars):', accessToken.substring(0, 20) + '...');
      
      return { 
        success: true, 
        message: 'M-Pesa connection successful',
        hasCredentials: !!(process.env.MPESA_CONSUMER_KEY && process.env.MPESA_CONSUMER_SECRET)
      };
      
    } catch (tokenError) {
      console.error('✗ Access token test failed:', tokenError.message);
      
      if (tokenError.message.includes('Invalid M-Pesa Consumer Key')) {
        console.log('\n=== HOW TO GET M-PESA CREDENTIALS ===');
        console.log('1. Go to: https://developer.safaricom.co.ke/');
        console.log('2. Register for a developer account');
        console.log('3. Login and go to "My Applications"');
        console.log('4. Create a new application or use existing');
        console.log('5. Copy the Consumer Key and Consumer Secret');
        console.log('6. Add to your .env file:');
        console.log('   MPESA_CONSUMER_KEY=your_actual_key_here');
        console.log('   MPESA_CONSUMER_SECRET=your_actual_secret_here');
        console.log('   MPESA_PASSKEY=bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919');
      }
      
      return { 
        success: false, 
        error: tokenError.message,
        suggestion: 'Use test payment mode for development or get real credentials from Safaricom'
      };
    }
    
  } catch (error) {
    console.error('M-Pesa connection test failed:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { 
  initiateMpesaPayment, 
  initiateTestMpesaPayment,  // Export test function
  verifyPayPalPayment,
  testMpesaConnection
};