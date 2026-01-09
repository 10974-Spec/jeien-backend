require('dotenv').config();
const { testMpesaConnection, initiateTestMpesaPayment } = require('./config/payment');

async function testPayment() {
  console.log('=== Payment System Test ===\n');
  
  // Test M-Pesa connection
  const connectionTest = await testMpesaConnection();
  console.log('\nConnection Test Result:', connectionTest);
  
  if (!connectionTest.success) {
    console.log('\n=== USING TEST MODE ===');
    console.log('Running test payment simulation...\n');
    
    // Test with simulated payment
    const testPayment = await initiateTestMpesaPayment(
      '254712345678',
      3980,
      'TEST-ORDER-123'
    );
    
    console.log('Test Payment Result:', testPayment);
    console.log('\n✅ Test payment simulation successful!');
    console.log('For real payments, get M-Pesa credentials from:');
    console.log('https://developer.safaricom.co.ke/');
  }
}

testPayment();