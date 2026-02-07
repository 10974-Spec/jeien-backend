const Order = require('../orders/order.model');
const Vendor = require('../vendors/vendor.model');
const mpesaService = require('../../utils/mpesa.service');

const processMpesaPayment = async (req, res) => {
  try {
    const { orderId, phone, amount } = req.body;
    const userId = req.user.id;

    console.log('M-Pesa payment request:', { orderId, phone, amount, userId });

    // Validate required fields
    if (!orderId || !phone || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
        required: ['orderId', 'phone', 'amount']
      });
    }

    const order = await Order.findOne({
      _id: orderId,
      buyer: userId,
      paymentStatus: { $in: ['PENDING', 'PROCESSING'] }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or already processed',
        details: 'Check order ID and ensure payment is still pending'
      });
    }

    // Convert amounts to numbers with 2 decimal places for comparison
    const requestAmount = parseFloat(amount);
    const orderAmount = parseFloat(order.totalAmount);

    console.log('Amount comparison:', {
      requestAmount,
      orderAmount,
      difference: Math.abs(orderAmount - requestAmount)
    });

    // Validate amount - M-Pesa has limits
    if (orderAmount > 150000) {
      return res.status(400).json({
        success: false,
        message: 'Order amount exceeds M-Pesa limit',
        orderAmount: orderAmount,
        maxAmount: 150000,
        suggestion: 'Please split your order or use another payment method'
      });
    }

    // Use a more flexible comparison for floating point numbers
    if (Math.abs(orderAmount - requestAmount) > 1) { // Changed from 0.01 to 1 for KES
      return res.status(400).json({
        success: false,
        message: 'Amount does not match order total',
        orderAmount: orderAmount,
        requestAmount: requestAmount,
        difference: Math.abs(orderAmount - requestAmount)
      });
    }

    if (!phone || phone.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Valid phone number is required',
        phoneProvided: phone
      });
    }

    // Format phone number for M-Pesa
    let mpesaPhone;
    if (phone.startsWith('0')) {
      mpesaPhone = `254${phone.substring(1)}`;
    } else if (phone.startsWith('+254')) {
      mpesaPhone = phone.substring(1);
    } else if (phone.startsWith('254')) {
      mpesaPhone = phone;
    } else {
      mpesaPhone = `254${phone}`;
    }

    // Ensure phone is numeric and has correct length
    mpesaPhone = mpesaPhone.replace(/\D/g, '');
    if (mpesaPhone.length !== 12) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format',
        formattedPhone: mpesaPhone
      });
    }

    console.log('Initiating M-Pesa payment:', {
      phone: mpesaPhone,
      amount: orderAmount,
      orderId: order.orderId
    });

    // Use Math.round for M-Pesa (requires integer amounts)
    const mpesaAmount = Math.round(orderAmount);

    // Initiate STK push using M-Pesa service
    const paymentResult = await mpesaService.initiateSTKPush({
      phoneNumber: mpesaPhone,
      amount: mpesaAmount,
      accountReference: order.orderId,
      transactionDesc: `Payment for order ${order.orderId}`,
      callbackUrl: `${process.env.API_URL}/api/payments/mpesa/callback`
    });

    console.log('M-Pesa payment result:', paymentResult);

    // Check if the payment initiation was successful
    if (!paymentResult || !paymentResult.success) {
      return res.status(400).json({
        success: false,
        message: 'M-Pesa payment initiation failed',
        details: paymentResult?.message || 'No response from payment gateway',
        errorDescription: paymentResult?.error || 'Unknown error'
      });
    }

    // Check M-Pesa specific response
    if (paymentResult.data && paymentResult.data.ResponseCode && paymentResult.data.ResponseCode !== '0') {
      return res.status(400).json({
        success: false,
        message: 'M-Pesa payment initiation failed',
        details: paymentResult.data,
        errorDescription: paymentResult.data.ResponseDescription || 'M-Pesa error'
      });
    }

    order.paymentStatus = 'PROCESSING';
    order.paymentDetails = {
      transactionId: paymentResult.data?.CheckoutRequestID || paymentResult.checkoutRequestId,
      reference: paymentResult.data?.MerchantRequestID || paymentResult.merchantRequestId,
      provider: 'MPESA',
      currency: 'KES',
      phoneNumber: mpesaPhone,
      initiatedAt: new Date(),
      amountRequested: orderAmount,
      amountSent: mpesaAmount,
      isTestMode: !(process.env.MPESA_CONSUMER_KEY && process.env.MPESA_CONSUMER_SECRET)
    };
    await order.save();

    const response = {
      success: true,
      message: 'M-Pesa payment initiated successfully',
      checkoutRequestId: paymentResult.data?.CheckoutRequestID || paymentResult.checkoutRequestId,
      merchantRequestId: paymentResult.data?.MerchantRequestID || paymentResult.merchantRequestId,
      responseDescription: paymentResult.data?.ResponseDescription || paymentResult.responseDescription,
      order: {
        id: order._id,
        orderId: order.orderId,
        amount: order.totalAmount,
        status: order.status,
        paymentStatus: order.paymentStatus
      },
      instruction: 'Check your phone for STK Push notification',
      note: 'Enter your M-Pesa PIN when prompted on your phone'
    };

    // Add test mode indicator if using test mode
    if (!process.env.MPESA_CONSUMER_KEY || !process.env.MPESA_CONSUMER_SECRET) {
      response.testMode = true;
      response.testNote = 'Using test mode. No actual payment will be processed.';
    }

    res.status(200).json(response);

  } catch (error) {
    console.error('M-Pesa payment error details:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data
    });

    res.status(500).json({
      success: false,
      message: 'M-Pesa payment failed',
      error: error.message,
      details: error.response?.data || error.data || 'No additional details'
    });
  }
};

const processPayPalPayment = async (req, res) => {
  try {
    const { orderId, paymentId } = req.body;
    const userId = req.user.id;

    if (!orderId || !paymentId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
        required: ['orderId', 'paymentId']
      });
    }

    const order = await Order.findOne({
      _id: orderId,
      buyer: userId,
      paymentStatus: { $in: ['PENDING', 'PROCESSING'] }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or already processed'
      });
    }

    console.log('Verifying PayPal payment:', { paymentId, orderId: order.orderId });

    const paymentResult = await verifyPayPalPayment(paymentId);

    if (!paymentResult || paymentResult.status !== 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: 'PayPal payment verification failed',
        details: paymentResult
      });
    }

    const amount = parseFloat(paymentResult.purchase_units[0]?.amount?.value || 0);
    const orderAmount = parseFloat(order.totalAmount);

    if (Math.abs(orderAmount - amount) > 1) {
      return res.status(400).json({
        success: false,
        message: 'Amount does not match order total',
        orderAmount: orderAmount,
        paymentAmount: amount
      });
    }

    order.paymentStatus = 'COMPLETED';
    order.status = 'PROCESSING';
    order.paymentDetails = {
      transactionId: paymentResult.id,
      reference: paymentResult.purchase_units[0]?.reference_id || order.orderId,
      provider: 'PAYPAL',
      paidAt: new Date(),
      currency: paymentResult.purchase_units[0]?.amount?.currency_code || 'USD',
      receiptUrl: paymentResult.links?.find(link => link.rel === 'approve')?.href,
      payerEmail: paymentResult.payer?.email_address
    };
    await order.save();

    // Process vendor payout (simulated for now)
    await simulateVendorPayout(order);

    res.status(200).json({
      success: true,
      message: 'PayPal payment completed successfully',
      order: {
        id: order._id,
        orderId: order.orderId,
        amount: order.totalAmount,
        status: order.status,
        paymentStatus: order.paymentStatus
      },
      payment: {
        id: paymentResult.id,
        status: paymentResult.status,
        email: paymentResult.payer?.email_address
      }
    });

  } catch (error) {
    console.error('PayPal payment error:', error);
    res.status(500).json({
      success: false,
      message: 'PayPal payment failed',
      error: error.message,
      details: error.response?.data || error.data
    });
  }
};

const processCardPayment = async (req, res) => {
  try {
    const { orderId, token, amount, currency = 'KES' } = req.body;
    const userId = req.user.id;

    if (!orderId || !token || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
        required: ['orderId', 'token', 'amount']
      });
    }

    const order = await Order.findOne({
      _id: orderId,
      buyer: userId,
      paymentStatus: { $in: ['PENDING', 'PROCESSING'] }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or already processed'
      });
    }

    const requestAmount = parseFloat(amount);
    const orderAmount = parseFloat(order.totalAmount);

    if (Math.abs(orderAmount - requestAmount) > 1) {
      return res.status(400).json({
        success: false,
        message: 'Amount does not match order total',
        orderAmount: orderAmount,
        requestAmount: requestAmount
      });
    }

    const transactionId = `CARD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    order.paymentStatus = 'COMPLETED';
    order.status = 'PROCESSING';
    order.paymentDetails = {
      transactionId,
      reference: order.orderId,
      provider: 'CARD',
      paidAt: new Date(),
      currency,
      token: token.substring(0, 10) + '...',
      notes: 'Card payment processed successfully',
      isTestMode: true // Card payments are in test mode
    };
    await order.save();

    // Process vendor payout (simulated for now)
    await simulateVendorPayout(order);

    res.status(200).json({
      success: true,
      message: 'Card payment completed successfully',
      order: {
        id: order._id,
        orderId: order.orderId,
        amount: order.totalAmount,
        status: order.status,
        paymentStatus: order.paymentStatus
      },
      payment: {
        transactionId,
        status: 'COMPLETED',
        provider: 'CARD',
        currency
      }
    });

  } catch (error) {
    console.error('Card payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Card payment failed',
      error: error.message
    });
  }
};

const simulateVendorPayout = async (order) => {
  try {
    console.log(`[SIMULATED] Processing vendor payout for order ${order.orderId}`);

    // Simulate vendor payout for development
    const payoutData = {
      orderId: order.orderId,
      amount: order.totalAmount,
      timestamp: new Date().toISOString(),
      status: 'SIMULATED',
      transactionId: `SIM-PAYOUT-${Date.now()}`,
      note: 'Vendor payout simulated for development'
    };

    console.log('Simulated vendor payout:', payoutData);

    return { success: true, data: payoutData };

  } catch (error) {
    console.error('Vendor payout simulation error:', error);
    // Don't throw error for simulation
    return { success: false, error: error.message };
  }
};

const processMpesaPayout = async (phone, amount, reference) => {
  try {
    console.log(`Initiating M-Pesa payout: ${phone} - ${amount} KES - Ref: ${reference}`);

    const mpesaPhone = phone.startsWith('0') ? `254${phone.substring(1)}` :
      phone.startsWith('+254') ? phone.substring(1) :
        phone.startsWith('254') ? phone : `254${phone}`;

    const payoutData = {
      phone: mpesaPhone,
      amount: Math.round(amount),
      reference: reference,
      timestamp: new Date().toISOString(),
      status: 'COMPLETED',
      transactionId: `PAYOUT-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
    };

    console.log('M-Pesa payout initiated:', payoutData);

    return { success: true, data: payoutData };
  } catch (error) {
    console.error('M-Pesa payout error:', error);
    throw error;
  }
};

const processBankTransfer = async (bankDetails, amount, reference) => {
  try {
    console.log(`Initiating bank transfer: ${bankDetails.bankName} - ${amount} KES - Ref: ${reference}`);

    const transferData = {
      bankName: bankDetails.bankName,
      accountName: bankDetails.accountName,
      accountNumber: bankDetails.accountNumber,
      branch: bankDetails.branch,
      swiftCode: bankDetails.swiftCode,
      amount: amount,
      reference: reference,
      timestamp: new Date().toISOString(),
      status: 'PROCESSING',
      estimatedCompletion: new Date(Date.now() + 24 * 60 * 60 * 1000)
    };

    console.log('Bank transfer initiated:', transferData);

    return { success: true, data: transferData };
  } catch (error) {
    console.error('Bank transfer error:', error);
    throw error;
  }
};

const processPayPalPayout = async (paypalEmail, amount, reference) => {
  try {
    console.log(`Initiating PayPal payout: ${paypalEmail} - ${amount} USD - Ref: ${reference}`);

    const payoutData = {
      email: paypalEmail,
      amount: amount,
      currency: 'USD',
      reference: reference,
      timestamp: new Date().toISOString(),
      status: 'COMPLETED',
      transactionId: `PAYPAL-PAYOUT-${Date.now()}`
    };

    console.log('PayPal payout initiated:', payoutData);

    return { success: true, data: payoutData };
  } catch (error) {
    console.error('PayPal payout error:', error);
    throw error;
  }
};

const handlePaymentWebhook = async (req, res) => {
  try {
    const { provider, data } = req.body;

    console.log(`Payment webhook received from ${provider}:`, JSON.stringify(data, null, 2));

    switch (provider) {
      case 'MPESA':
        await handleMpesaWebhook(data);
        break;
      case 'PAYPAL':
        await handlePayPalWebhook(data);
        break;
      case 'STRIPE':
        await handleStripeWebhook(data);
        break;
      default:
        console.warn(`Unknown payment provider webhook: ${provider}`);
    }

    res.status(200).json({
      success: true,
      message: 'Webhook received successfully'
    });
  } catch (error) {
    console.error('Payment webhook processing error:', error);
    res.status(500).json({
      success: false,
      error: 'Webhook processing failed',
      details: error.message
    });
  }
};

const handleMpesaWebhook = async (data) => {
  try {
    console.log('Handling M-Pesa webhook (simulated):', data);

    // For development, simulate successful payment
    if (process.env.NODE_ENV === 'development') {
      console.log('[DEV] Simulating M-Pesa payment completion');

      // Try to find order by reference in AccountReference
      const reference = data?.Body?.stkCallback?.CheckoutRequestID ||
        data?.AccountReference ||
        `ORD-${Date.now()}`;

      const order = await Order.findOne({
        $or: [
          { 'paymentDetails.transactionId': reference },
          { orderId: { $regex: reference, $options: 'i' } }
        ]
      });

      if (order) {
        order.paymentStatus = 'COMPLETED';
        order.status = 'PROCESSING';
        order.paymentDetails.paidAt = new Date();
        order.paymentDetails.notes = 'M-Pesa payment completed via webhook (simulated)';
        order.paymentDetails.mpesaReceiptNumber = `MPESA${Date.now()}`;
        order.paymentDetails.amountPaid = order.totalAmount;

        await order.save();

        console.log(`Order ${order.orderId} marked as COMPLETED via simulated webhook`);

        // Simulate vendor payout
        await simulateVendorPayout(order);
      }

      return;
    }

    // Real M-Pesa webhook handling (for production)
    const { Body } = data;
    const stkCallback = Body?.stkCallback;

    if (!stkCallback) {
      console.error('Invalid M-Pesa webhook data structure:', data);
      return;
    }

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;

    console.log(`M-Pesa webhook processing:`, {
      CheckoutRequestID,
      ResultCode,
      ResultDesc
    });

    if (ResultCode !== 0) {
      console.error(`M-Pesa payment failed: ${ResultDesc}`, {
        CheckoutRequestID,
        ResultCode,
        ResultDesc
      });

      const order = await Order.findOne({
        'paymentDetails.transactionId': CheckoutRequestID
      });

      if (order) {
        order.paymentStatus = 'FAILED';
        order.paymentDetails.notes = `M-Pesa payment failed: ${ResultDesc}`;
        order.paymentDetails.errorCode = ResultCode;
        order.paymentDetails.errorDescription = ResultDesc;
        await order.save();

        console.log(`Order ${order.orderId} marked as FAILED`);
      }

      return;
    }

    const metadata = {};
    if (CallbackMetadata?.Item) {
      CallbackMetadata.Item.forEach(item => {
        metadata[item.Name] = item.Value;
      });
    }

    const order = await Order.findOne({
      'paymentDetails.transactionId': CheckoutRequestID
    });

    if (!order) {
      console.error(`Order not found for M-Pesa transaction: ${CheckoutRequestID}`);
      return;
    }

    order.paymentStatus = 'COMPLETED';
    order.status = 'PROCESSING';
    order.paymentDetails.paidAt = new Date();
    order.paymentDetails.receiptUrl = `https://api.safaricom.co.ke/mpesa/transaction/${CheckoutRequestID}/receipt`;
    order.paymentDetails.mpesaReceiptNumber = metadata.MpesaReceiptNumber;
    order.paymentDetails.phoneNumber = metadata.PhoneNumber;
    order.paymentDetails.amountPaid = metadata.Amount;
    order.paymentDetails.notes = `M-Pesa payment completed successfully`;

    await order.save();

    await simulateVendorPayout(order);

    console.log(`M-Pesa payment completed for order ${order.orderId}:`, {
      receipt: metadata.MpesaReceiptNumber,
      amount: metadata.Amount,
      phone: metadata.PhoneNumber
    });

  } catch (error) {
    console.error('M-Pesa webhook processing error:', error);
    // Don't throw error to prevent webhook retries
  }
};

const handlePayPalWebhook = async (data) => {
  try {
    const { event_type, resource } = data;

    console.log(`PayPal webhook received: ${event_type}`);

    if (event_type !== 'PAYMENT.CAPTURE.COMPLETED') {
      console.log(`PayPal webhook event ignored: ${event_type}`);
      return;
    }

    const { id, status, purchase_units } = resource;

    const order = await Order.findOne({
      'paymentDetails.transactionId': id
    });

    if (!order) {
      console.error(`Order not found for PayPal transaction: ${id}`);
      return;
    }

    if (status === 'COMPLETED') {
      order.paymentStatus = 'COMPLETED';
      order.status = 'PROCESSING';
      order.paymentDetails.paidAt = new Date();
      order.paymentDetails.receiptUrl = purchase_units[0]?.payments?.captures?.[0]?.links?.find(l => l.rel === 'self')?.href;
      order.paymentDetails.paypalCaptureId = purchase_units[0]?.payments?.captures?.[0]?.id;

      await order.save();

      await simulateVendorPayout(order);

      console.log(`PayPal payment completed for order ${order.orderId}`);
    }
  } catch (error) {
    console.error('PayPal webhook processing error:', error);
    // Don't throw error to prevent webhook retries
  }
};

const handleStripeWebhook = async (data) => {
  try {
    const { type, data: eventData } = data;

    console.log(`Stripe webhook received: ${type}`);

    if (type !== 'charge.succeeded') {
      console.log(`Stripe webhook event ignored: ${type}`);
      return;
    }

    const charge = eventData.object;
    const { id, amount, currency, receipt_url, metadata } = charge;

    const orderId = metadata?.orderId;
    if (!orderId) {
      console.error('No orderId in Stripe charge metadata:', metadata);
      return;
    }

    const order = await Order.findById(orderId);
    if (!order) {
      console.error(`Order not found for Stripe charge: ${orderId}`);
      return;
    }

    const amountInCurrency = amount / 100;

    order.paymentStatus = 'COMPLETED';
    order.status = 'PROCESSING';
    order.paymentDetails = {
      transactionId: id,
      reference: order.orderId,
      provider: 'CARD',
      paidAt: new Date(),
      currency,
      amountPaid: amountInCurrency,
      receiptUrl: receipt_url,
      stripeChargeId: id
    };
    await order.save();

    await simulateVendorPayout(order);

    console.log(`Stripe payment completed for order ${order.orderId}`);
  } catch (error) {
    console.error('Stripe webhook processing error:', error);
    // Don't throw error to prevent webhook retries
  }
};

const getPaymentMethods = async (req, res) => {
  try {
    const methods = [
      {
        id: 'MPESA',
        name: 'M-Pesa',
        description: 'Mobile money payment via Safaricom',
        icon: '/images/payments/mpesa.png',
        countries: ['KE', 'TZ', 'UG'],
        currencies: ['KES'],
        fees: { percentage: 0, fixed: 0 },
        minAmount: 10,
        maxAmount: 150000,
        supported: true,
        requiresPhone: true,
        instructions: 'Enter your Safaricom phone number to receive STK Push'
      },
      {
        id: 'PAYPAL',
        name: 'PayPal',
        description: 'International payments via PayPal',
        icon: '/images/payments/paypal.png',
        countries: ['ALL'],
        currencies: ['USD', 'EUR', 'GBP'],
        fees: { percentage: 3.4, fixed: 0.35 },
        minAmount: 1,
        maxAmount: 10000,
        supported: true,
        requiresAccount: true,
        instructions: 'You will be redirected to PayPal to complete payment'
      },
      {
        id: 'CARD',
        name: 'Credit/Debit Card',
        description: 'Visa, Mastercard, American Express',
        icon: '/images/payments/card.png',
        countries: ['ALL'],
        currencies: ['USD', 'EUR', 'GBP', 'KES'],
        fees: { percentage: 2.9, fixed: 0.30 },
        minAmount: 1,
        maxAmount: 100000,
        supported: true,
        requiresCard: true,
        instructions: 'Enter your card details securely'
      },
      {
        id: 'CASH_ON_DELIVERY',
        name: 'Cash on Delivery',
        description: 'Pay when you receive your order',
        icon: '/images/payments/cod.png',
        countries: ['KE', 'TZ', 'UG'],
        currencies: ['KES'],
        fees: { percentage: 0, fixed: 100 },
        minAmount: 0,
        maxAmount: 50000,
        supported: true,
        requiresNothing: true,
        instructions: 'Pay cash to delivery agent upon receipt'
      }
    ];

    const userCountry = req.headers['x-country'] || req.user?.country || 'KE';
    const userCurrency = userCountry === 'KE' ? 'KES' : 'USD';

    const filteredMethods = methods.filter(method =>
      (method.countries.includes('ALL') || method.countries.includes(userCountry)) &&
      method.supported === true
    );

    res.status(200).json({
      success: true,
      methods: filteredMethods,
      defaultCurrency: userCurrency,
      userCountry: userCountry,
      testMode: !process.env.MPESA_CONSUMER_KEY || !process.env.MPESA_CONSUMER_SECRET
    });

  } catch (error) {
    console.error('Get payment methods error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get payment methods',
      error: error.message
    });
  }
};

const getPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required'
      });
    }

    const order = await Order.findOne({
      $or: [{ _id: orderId }, { orderId: orderId }]
    })
      .select('orderId paymentStatus status paymentDetails totalAmount createdAt buyer vendorIds');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const isAuthorized = userRole === 'ADMIN' ||
      order.buyer.toString() === userId ||
      (order.vendorIds && order.vendorIds.some(vendorId => vendorId.toString() === userId));

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view payment status'
      });
    }

    const response = {
      success: true,
      orderId: order.orderId,
      paymentStatus: order.paymentStatus,
      orderStatus: order.status,
      amount: order.totalAmount,
      currency: order.paymentDetails?.currency || 'KES',
      transactionId: order.paymentDetails?.transactionId,
      paidAt: order.paymentDetails?.paidAt,
      receiptUrl: order.paymentDetails?.receiptUrl,
      provider: order.paymentDetails?.provider,
      createdAt: order.createdAt,
      isTestMode: order.paymentDetails?.isTestMode || false
    };

    if (userRole === 'ADMIN' || (order.vendorIds && order.vendorIds.some(vendorId => vendorId.toString() === userId))) {
      response.paymentDetails = order.paymentDetails;
      response.buyer = order.buyer;
    }

    res.status(200).json(response);

  } catch (error) {
    console.error('Get payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get payment status',
      error: error.message
    });
  }
};


// Add this helper function
const simulateTestPaymentCompletion = async (orderId) => {
  try {
    const order = await Order.findById(orderId);
    if (!order) {
      console.error(`Order ${orderId} not found for test completion`);
      return false;
    }

    // Check if this is a test payment
    if (order.paymentDetails?.isTestMode ||
      !process.env.MPESA_CONSUMER_KEY ||
      !process.env.MPESA_CONSUMER_SECRET) {

      console.log(`Completing test payment for order ${order.orderId}`);

      order.paymentStatus = 'COMPLETED';
      order.status = 'PROCESSING';
      order.paymentDetails = order.paymentDetails || {};
      order.paymentDetails.paidAt = new Date();
      order.paymentDetails.isTestMode = true;
      order.paymentDetails.notes = 'Test payment completed automatically';
      order.paymentDetails.transactionId = order.paymentDetails.transactionId || `TEST-${Date.now()}`;
      order.paymentDetails.receiptUrl = `#test-receipt-${Date.now()}`;

      await order.save();

      console.log(`Test payment completed for order ${order.orderId}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error completing test payment:', error);
    return false;
  }
};

// Update the testMpesaPayment function:
const testMpesaPayment = async (req, res) => {
  try {
    const { orderId, phone, amount } = req.body;

    if (!orderId || !phone || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
        required: ['orderId', 'phone', 'amount']
      });
    }

    const testTransaction = {
      success: true,
      message: 'Test M-Pesa STK Push sent successfully',
      checkoutRequestId: `TEST-${Date.now()}`,
      merchantRequestId: `TEST-MERCHANT-${Date.now()}`,
      responseDescription: 'Success. Request accepted for processing',
      phone: phone,
      amount: amount,
      orderId: orderId,
      instruction: 'In test mode, simulate entering PIN 123456 on your phone',
      note: 'This is a test transaction. No actual money will be deducted.',
      testMode: true,
      // ADD THIS: Tell frontend to mark as completed immediately
      shouldCompleteImmediately: true,
      simulatedCompletion: true
    };

    // Update order payment status in test mode
    try {
      const order = await Order.findById(orderId);
      if (order) {
        order.paymentStatus = 'COMPLETED'; // Mark as COMPLETED immediately for test
        order.status = 'PROCESSING';
        order.paymentDetails = {
          transactionId: `TEST-${Date.now()}`,
          reference: order.orderId,
          provider: 'MPESA',
          initiatedAt: new Date(),
          paidAt: new Date(), // Add paidAt immediately
          currency: 'KES',
          phoneNumber: phone,
          amountRequested: amount,
          amountPaid: amount,
          isTestMode: true,
          notes: 'Test payment completed immediately',
          receiptUrl: `#test-receipt-${Date.now()}`
        };
        await order.save();

        console.log(`Test order ${order.orderId} marked as COMPLETED immediately`);
      }
    } catch (orderError) {
      console.error('Could not update order for test payment:', orderError);
    }

    res.status(200).json(testTransaction);
  } catch (error) {
    console.error('Test M-Pesa error:', error);
    res.status(500).json({
      success: false,
      message: 'Test payment failed',
      error: error.message
    });
  }
};

// const testMpesaPayment = async (req, res) => {
//   try {
//     const { orderId, phone, amount } = req.body;

//     if (!orderId || !phone || !amount) {
//       return res.status(400).json({ 
//         success: false,
//         message: 'Missing required fields',
//         required: ['orderId', 'phone', 'amount']
//       });
//     }

//     const testTransaction = {
//       success: true,
//       message: 'Test M-Pesa STK Push sent successfully',
//       checkoutRequestId: `TEST-${Date.now()}`,
//       merchantRequestId: `TEST-MERCHANT-${Date.now()}`,
//       responseDescription: 'Success. Request accepted for processing',
//       phone: phone,
//       amount: amount,
//       orderId: orderId,
//       instruction: 'In test mode, simulate entering PIN 123456 on your phone',
//       note: 'This is a test transaction. No actual money will be deducted.',
//       testMode: true
//     };

//     // Update order payment status in test mode
//     try {
//       const order = await Order.findById(orderId);
//       if (order) {
//         order.paymentStatus = 'PROCESSING';
//         order.paymentDetails = {
//           transactionId: `TEST-${Date.now()}`,
//           reference: order.orderId,
//           provider: 'MPESA',
//           initiatedAt: new Date(),
//           currency: 'KES',
//           phoneNumber: phone,
//           amountRequested: amount,
//           isTestMode: true,
//           notes: 'Test payment initiated'
//         };
//         await order.save();
//       }
//     } catch (orderError) {
//       console.error('Could not update order for test payment:', orderError);
//     }

//     res.status(200).json(testTransaction);
//   } catch (error) {
//     console.error('Test M-Pesa error:', error);
//     res.status(500).json({ 
//       success: false,
//       message: 'Test payment failed', 
//       error: error.message 
//     });
//   }
// };

module.exports = {
  processMpesaPayment,
  processPayPalPayment,
  processCardPayment,
  handlePaymentWebhook,
  getPaymentMethods,
  getPaymentStatus,
  testMpesaPayment
};