const Order = require('../orders/order.model');
const Vendor = require('../vendors/vendor.model');
const { initiateMpesaPayment, verifyPayPalPayment } = require('../../config/payment');
const { processOrderCommission } = require('../../utils/commission.util');

const processMpesaPayment = async (req, res) => {
  try {
    const { orderId, phone, amount } = req.body;
    const userId = req.user.id;

    const order = await Order.findOne({ 
      _id: orderId, 
      buyer: userId,
      paymentStatus: { $in: ['PENDING', 'PROCESSING'] }
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found or already processed' });
    }

    if (Math.abs(order.totalAmount - amount) > 0.01) {
      return res.status(400).json({ message: 'Amount does not match order total' });
    }

    if (!phone || phone.length < 10) {
      return res.status(400).json({ message: 'Valid phone number is required' });
    }

    const mpesaPhone = phone.startsWith('0') ? `254${phone.substring(1)}` : 
                      phone.startsWith('+254') ? phone.substring(1) : 
                      phone.startsWith('254') ? phone : `254${phone}`;

    const paymentResult = await initiateMpesaPayment(
      mpesaPhone,
      amount,
      order.orderId
    );

    if (!paymentResult.ResponseCode || paymentResult.ResponseCode !== '0') {
      return res.status(400).json({ 
        message: 'MPesa payment initiation failed',
        details: paymentResult 
      });
    }

    order.paymentStatus = 'PROCESSING';
    order.paymentDetails = {
      transactionId: paymentResult.CheckoutRequestID,
      reference: paymentResult.MerchantRequestID,
      provider: 'MPESA',
      currency: 'KES'
    };
    await order.save();

    res.json({
      message: 'MPesa payment initiated successfully',
      checkoutRequestId: paymentResult.CheckoutRequestID,
      merchantRequestId: paymentResult.MerchantRequestID,
      responseDescription: paymentResult.ResponseDescription,
      order: {
        id: order._id,
        orderId: order.orderId,
        amount: order.totalAmount,
        status: order.status,
        paymentStatus: order.paymentStatus
      }
    });
  } catch (error) {
    console.error('MPesa payment error:', error);
    res.status(500).json({ 
      message: 'MPesa payment failed', 
      error: error.message,
      details: error.response?.data || error 
    });
  }
};

const processPayPalPayment = async (req, res) => {
  try {
    const { orderId, paymentId } = req.body;
    const userId = req.user.id;

    const order = await Order.findOne({ 
      _id: orderId, 
      buyer: userId,
      paymentStatus: { $in: ['PENDING', 'PROCESSING'] }
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found or already processed' });
    }

    const paymentResult = await verifyPayPalPayment(paymentId);

    if (!paymentResult || paymentResult.status !== 'COMPLETED') {
      return res.status(400).json({ 
        message: 'PayPal payment verification failed',
        details: paymentResult 
      });
    }

    const amount = parseFloat(paymentResult.purchase_units[0]?.amount?.value);
    if (Math.abs(order.totalAmount - amount) > 0.01) {
      return res.status(400).json({ message: 'Amount does not match order total' });
    }

    order.paymentStatus = 'COMPLETED';
    order.status = 'PROCESSING';
    order.paymentDetails = {
      transactionId: paymentResult.id,
      reference: paymentResult.purchase_units[0]?.reference_id,
      provider: 'PAYPAL',
      paidAt: new Date(),
      currency: paymentResult.purchase_units[0]?.amount?.currency_code || 'USD',
      receiptUrl: paymentResult.links?.find(link => link.rel === 'approve')?.href
    };
    await order.save();

    await processVendorPayout(order);

    res.json({
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
      message: 'PayPal payment failed', 
      error: error.message,
      details: error.response?.data || error 
    });
  }
};

const processCardPayment = async (req, res) => {
  try {
    const { orderId, token, amount, currency = 'KES' } = req.body;
    const userId = req.user.id;

    const order = await Order.findOne({ 
      _id: orderId, 
      buyer: userId,
      paymentStatus: { $in: ['PENDING', 'PROCESSING'] }
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found or already processed' });
    }

    if (Math.abs(order.totalAmount - amount) > 0.01) {
      return res.status(400).json({ message: 'Amount does not match order total' });
    }

    if (!token) {
      return res.status(400).json({ message: 'Payment token is required' });
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
      notes: 'Card payment processed'
    };
    await order.save();

    await processVendorPayout(order);

    res.json({
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
        provider: 'CARD'
      }
    });
  } catch (error) {
    console.error('Card payment error:', error);
    res.status(500).json({ 
      message: 'Card payment failed', 
      error: error.message 
    });
  }
};

const processVendorPayout = async (order) => {
  try {
    const vendor = await Vendor.findById(order.vendor);
    if (!vendor || !vendor.bankDetails) {
      console.error('Vendor not found or no bank details:', order.vendor);
      return;
    }

    const { bankDetails } = vendor;
    const payoutAmount = order.vendorAmount;

    console.log(`Processing payout for vendor ${vendor._id}:`, {
      amount: payoutAmount,
      bankDetails,
      orderId: order.orderId
    });

    if (bankDetails.provider === 'MPESA' && bankDetails.phoneNumber) {
      await processMpesaPayout(bankDetails.phoneNumber, payoutAmount, order.orderId);
    } else if (bankDetails.provider === 'BANK' && bankDetails.accountNumber) {
      await processBankTransfer(bankDetails, payoutAmount, order.orderId);
    } else if (bankDetails.provider === 'PAYPAL' && bankDetails.accountNumber) {
      await processPayPalPayout(bankDetails.accountNumber, payoutAmount, order.orderId);
    }

    await Vendor.findByIdAndUpdate(vendor._id, {
      $inc: { 
        'stats.totalRevenue': order.totalAmount,
        'performance.lastMonthSales': 1 
      }
    });

    console.log(`Payout processed successfully for order ${order.orderId}`);
  } catch (error) {
    console.error('Vendor payout error:', error);
  }
};

const processMpesaPayout = async (phone, amount, reference) => {
  try {
    console.log(`Simulating MPesa payout: ${phone} - ${amount} KES - Ref: ${reference}`);
    
    const mpesaPhone = phone.startsWith('0') ? `254${phone.substring(1)}` : 
                      phone.startsWith('+254') ? phone.substring(1) : 
                      phone.startsWith('254') ? phone : `254${phone}`;

    const payoutData = {
      phone: mpesaPhone,
      amount: amount,
      reference: reference,
      timestamp: new Date().toISOString(),
      status: 'COMPLETED'
    };

    console.log('MPesa payout simulation:', payoutData);
    
    return { success: true, data: payoutData };
  } catch (error) {
    console.error('MPesa payout simulation error:', error);
    throw error;
  }
};

const processBankTransfer = async (bankDetails, amount, reference) => {
  try {
    console.log(`Simulating bank transfer: ${bankDetails.bankName} - ${amount} KES - Ref: ${reference}`);
    
    const transferData = {
      bankName: bankDetails.bankName,
      accountName: bankDetails.accountName,
      accountNumber: bankDetails.accountNumber,
      branch: bankDetails.branch,
      amount: amount,
      reference: reference,
      timestamp: new Date().toISOString(),
      status: 'PROCESSING'
    };

    console.log('Bank transfer simulation:', transferData);
    
    return { success: true, data: transferData };
  } catch (error) {
    console.error('Bank transfer simulation error:', error);
    throw error;
  }
};

const processPayPalPayout = async (paypalEmail, amount, reference) => {
  try {
    console.log(`Simulating PayPal payout: ${paypalEmail} - ${amount} USD - Ref: ${reference}`);
    
    const payoutData = {
      email: paypalEmail,
      amount: amount,
      currency: 'USD',
      reference: reference,
      timestamp: new Date().toISOString(),
      status: 'COMPLETED'
    };

    console.log('PayPal payout simulation:', payoutData);
    
    return { success: true, data: payoutData };
  } catch (error) {
    console.error('PayPal payout simulation error:', error);
    throw error;
  }
};

const handlePaymentWebhook = async (req, res) => {
  try {
    const { provider, data } = req.body;

    console.log(`Payment webhook received from ${provider}:`, data);

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
        console.warn(`Unknown payment provider: ${provider}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Payment webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

const handleMpesaWebhook = async (data) => {
  try {
    const { Body } = data;
    const stkCallback = Body?.stkCallback;

    if (!stkCallback) {
      console.error('Invalid MPesa webhook data:', data);
      return;
    }

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;
    
    if (ResultCode !== 0) {
      console.error(`MPesa payment failed: ${ResultDesc}`, { CheckoutRequestID, ResultCode });
      
      const order = await Order.findOne({ 
        'paymentDetails.transactionId': CheckoutRequestID 
      });
      
      if (order) {
        order.paymentStatus = 'FAILED';
        order.paymentDetails.notes = `MPesa failed: ${ResultDesc}`;
        await order.save();
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
      console.error(`Order not found for MPesa transaction: ${CheckoutRequestID}`);
      return;
    }

    order.paymentStatus = 'COMPLETED';
    order.status = 'PROCESSING';
    order.paymentDetails.paidAt = new Date();
    order.paymentDetails.receiptUrl = `https://api.safaricom.co.ke/mpesa/transaction/${CheckoutRequestID}/receipt`;
    order.paymentDetails.notes = `MPesa completed: ${metadata.PhoneNumber} - ${metadata.Amount}`;

    await order.save();

    await processVendorPayout(order);

    console.log(`MPesa payment completed for order ${order.orderId}`);
  } catch (error) {
    console.error('MPesa webhook processing error:', error);
  }
};

const handlePayPalWebhook = async (data) => {
  try {
    const { event_type, resource } = data;

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

      await order.save();

      await processVendorPayout(order);

      console.log(`PayPal payment completed for order ${order.orderId}`);
    }
  } catch (error) {
    console.error('PayPal webhook processing error:', error);
  }
};

const handleStripeWebhook = async (data) => {
  try {
    const { type, data: eventData } = data;

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
      receiptUrl: receipt_url
    };
    await order.save();

    await processVendorPayout(order);

    console.log(`Stripe payment completed for order ${order.orderId}`);
  } catch (error) {
    console.error('Stripe webhook processing error:', error);
  }
};

const getPaymentMethods = async (req, res) => {
  try {
    const methods = [
      {
        id: 'MPESA',
        name: 'M-Pesa',
        description: 'Mobile money payment',
        icon: 'https://example.com/mpesa-icon.png',
        countries: ['KE', 'TZ', 'UG'],
        currencies: ['KES'],
        fees: { percentage: 0, fixed: 0 },
        minAmount: 10,
        maxAmount: 150000,
        supported: true
      },
      {
        id: 'PAYPAL',
        name: 'PayPal',
        description: 'International payments',
        icon: 'https://example.com/paypal-icon.png',
        countries: ['ALL'],
        currencies: ['USD', 'EUR', 'GBP'],
        fees: { percentage: 3.4, fixed: 0.35 },
        minAmount: 1,
        maxAmount: 10000,
        supported: true
      },
      {
        id: 'CARD',
        name: 'Credit/Debit Card',
        description: 'Visa, Mastercard, American Express',
        icon: 'https://example.com/card-icon.png',
        countries: ['ALL'],
        currencies: ['USD', 'EUR', 'GBP', 'KES'],
        fees: { percentage: 2.9, fixed: 0.30 },
        minAmount: 1,
        maxAmount: 100000,
        supported: true
      },
      {
        id: 'CASH_ON_DELIVERY',
        name: 'Cash on Delivery',
        description: 'Pay when you receive',
        icon: 'https://example.com/cod-icon.png',
        countries: ['KE', 'TZ', 'UG'],
        currencies: ['KES'],
        fees: { percentage: 0, fixed: 100 },
        minAmount: 0,
        maxAmount: 50000,
        supported: true
      }
    ];

    const userCountry = req.headers['x-country'] || 'KE';
    const filteredMethods = methods.filter(method => 
      method.countries.includes('ALL') || method.countries.includes(userCountry)
    );

    res.json({
      methods: filteredMethods,
      defaultCurrency: userCountry === 'KE' ? 'KES' : 'USD'
    });
  } catch (error) {
    console.error('Get payment methods error:', error);
    res.status(500).json({ message: 'Failed to get payment methods', error: error.message });
  }
};

const getPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId })
      .select('orderId paymentStatus status paymentDetails totalAmount createdAt');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const allowed = req.user && (
      req.user.role === 'ADMIN' || 
      order.buyer.toString() === req.user.id
    );

    if (!allowed) {
      return res.status(403).json({ message: 'Not authorized to view payment status' });
    }

    res.json({
      orderId: order.orderId,
      paymentStatus: order.paymentStatus,
      orderStatus: order.status,
      amount: order.totalAmount,
      currency: order.paymentDetails?.currency || 'KES',
      transactionId: order.paymentDetails?.transactionId,
      paidAt: order.paymentDetails?.paidAt,
      receiptUrl: order.paymentDetails?.receiptUrl
    });
  } catch (error) {
    console.error('Get payment status error:', error);
    res.status(500).json({ message: 'Failed to get payment status', error: error.message });
  }
};

module.exports = {
  processMpesaPayment,
  processPayPalPayment,
  processCardPayment,
  handlePaymentWebhook,
  getPaymentMethods,
  getPaymentStatus
};