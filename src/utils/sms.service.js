const AfricasTalking = require('africastalking');

// Initialize Africa's Talking
const credentials = {
    apiKey: process.env.AFRICASTALKING_API_KEY || 'sandbox_api_key',
    username: process.env.AFRICASTALKING_USERNAME || 'sandbox'
};

const africasTalking = AfricasTalking(credentials);
const sms = africasTalking.SMS;

/**
 * Send SMS notification
 * @param {string} phoneNumber - Recipient phone number (format: +254XXXXXXXXX)
 * @param {string} message - SMS message content
 * @returns {Promise<Object>} SMS delivery result
 */
const sendSMS = async (phoneNumber, message) => {
    try {
        // Format phone number for Africa's Talking
        let formattedPhone = phoneNumber;

        if (phoneNumber.startsWith('0')) {
            formattedPhone = `+254${phoneNumber.substring(1)}`;
        } else if (phoneNumber.startsWith('254')) {
            formattedPhone = `+${phoneNumber}`;
        } else if (!phoneNumber.startsWith('+')) {
            formattedPhone = `+${phoneNumber}`;
        }

        console.log(`Sending SMS to ${formattedPhone}: ${message.substring(0, 50)}...`);

        const options = {
            to: [formattedPhone],
            message: message,
            from: process.env.AFRICASTALKING_SENDER_ID || 'JEIEN'
        };

        const result = await sms.send(options);

        console.log('SMS sent successfully:', result);

        return {
            success: true,
            data: result,
            phoneNumber: formattedPhone
        };

    } catch (error) {
        console.error('SMS sending error:', error);
        return {
            success: false,
            error: error.message,
            phoneNumber: phoneNumber
        };
    }
};

/**
 * Send order confirmation SMS to customer
 * @param {Object} order - Order object
 * @param {Object} buyer - Buyer/customer object
 * @returns {Promise<Object>} SMS delivery result
 */
const sendOrderConfirmationSMS = async (order, buyer) => {
    try {
        // Get phone number from order or buyer
        const phoneNumber = order.shippingAddress?.phone ||
            order.deliveryAddress?.phone ||
            buyer?.phone;

        if (!phoneNumber) {
            console.warn('No phone number found for order:', order.orderId);
            return {
                success: false,
                error: 'No phone number available'
            };
        }

        // Create items summary (max 2 items to keep SMS short)
        const itemsSummary = order.items
            .slice(0, 2)
            .map(item => item.product?.name || item.name || 'Product')
            .join(', ');

        const moreItems = order.items.length > 2 ? ` +${order.items.length - 2} more` : '';

        // Format message (keep under 160 characters for single SMS)
        const message = `JEIEN: Your order #${order.orderId} for ${itemsSummary}${moreItems} (KES ${order.totalAmount.toLocaleString()}) is being processed and will be delivered soon. Thank you!`;

        return await sendSMS(phoneNumber, message);

    } catch (error) {
        console.error('Order confirmation SMS error:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Send payment confirmation SMS
 * @param {Object} order - Order object
 * @param {Object} buyer - Buyer/customer object
 * @returns {Promise<Object>} SMS delivery result
 */
const sendPaymentConfirmationSMS = async (order, buyer) => {
    try {
        const phoneNumber = order.shippingAddress?.phone ||
            order.deliveryAddress?.phone ||
            buyer?.phone;

        if (!phoneNumber) {
            return {
                success: false,
                error: 'No phone number available'
            };
        }

        const message = `JEIEN: Payment of KES ${order.totalAmount.toLocaleString()} for order #${order.orderId} received successfully. Your order is now being processed. Thank you!`;

        return await sendSMS(phoneNumber, message);

    } catch (error) {
        console.error('Payment confirmation SMS error:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Send order status update SMS
 * @param {Object} order - Order object
 * @param {string} status - New order status
 * @returns {Promise<Object>} SMS delivery result
 */
const sendOrderStatusUpdateSMS = async (order, status) => {
    try {
        const phoneNumber = order.shippingAddress?.phone ||
            order.deliveryAddress?.phone ||
            order.buyer?.phone;

        if (!phoneNumber) {
            return {
                success: false,
                error: 'No phone number available'
            };
        }

        let statusMessage = '';
        switch (status.toUpperCase()) {
            case 'PROCESSING':
                statusMessage = 'is being processed';
                break;
            case 'SHIPPED':
                statusMessage = 'has been shipped and is on the way';
                break;
            case 'DELIVERED':
                statusMessage = 'has been delivered. Thank you for shopping with us';
                break;
            case 'CANCELLED':
                statusMessage = 'has been cancelled';
                break;
            default:
                statusMessage = `status updated to ${status}`;
        }

        const message = `JEIEN: Your order #${order.orderId} ${statusMessage}. For support, call +254746917511`;

        return await sendSMS(phoneNumber, message);

    } catch (error) {
        console.error('Order status update SMS error:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

module.exports = {
    sendSMS,
    sendOrderConfirmationSMS,
    sendPaymentConfirmationSMS,
    sendOrderStatusUpdateSMS
};
