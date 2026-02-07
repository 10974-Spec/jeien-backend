const axios = require('axios');
const crypto = require('crypto');

class MpesaService {
    constructor() {
        this.consumerKey = process.env.MPESA_CONSUMER_KEY;
        this.consumerSecret = process.env.MPESA_CONSUMER_SECRET;
        this.passkey = process.env.MPESA_PASSKEY;
        this.shortcode = process.env.MPESA_SHORTCODE || '174379'; // Default to sandbox
        this.environment = process.env.MPESA_ENV || 'sandbox';

        // Set API URLs based on environment
        this.baseURL = this.environment === 'production'
            ? 'https://api.safaricom.co.ke'
            : 'https://sandbox.safaricom.co.ke';

        this.accessToken = null;
        this.tokenExpiry = null;
    }

    /**
     * Get OAuth access token from M-Pesa
     */
    async getAccessToken() {
        try {
            // Return cached token if still valid
            if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
                console.log('Using cached M-Pesa access token');
                return this.accessToken;
            }

            console.log('Fetching new M-Pesa access token...');
            const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');

            const response = await axios.get(`${this.baseURL}/oauth/v1/generate?grant_type=client_credentials`, {
                headers: {
                    Authorization: `Basic ${auth}`
                }
            });

            this.accessToken = response.data.access_token;
            // Token expires in 3599 seconds, cache for 3500 seconds to be safe
            this.tokenExpiry = Date.now() + (3500 * 1000);

            console.log('✅ M-Pesa access token obtained successfully');
            return this.accessToken;
        } catch (error) {
            console.error('❌ Failed to get M-Pesa access token:', error.response?.data || error.message);
            throw new Error('Failed to authenticate with M-Pesa');
        }
    }

    /**
     * Generate password for STK push
     */
    generatePassword(timestamp) {
        const data = `${this.shortcode}${this.passkey}${timestamp}`;
        return Buffer.from(data).toString('base64');
    }

    /**
     * Initiate STK Push (Lipa Na M-Pesa Online)
     * @param {string} phoneNumber - Customer phone number (format: 254XXXXXXXXX)
     * @param {number} amount - Amount to charge
     * @param {string} accountReference - Order ID or reference
     * @param {string} transactionDesc - Description of transaction
     * @param {string} callbackUrl - URL to receive payment callback
     */
    async initiateSTKPush({ phoneNumber, amount, accountReference, transactionDesc, callbackUrl }) {
        try {
            console.log('=== INITIATING M-PESA STK PUSH ===');
            console.log('Phone:', phoneNumber);
            console.log('Amount:', amount);
            console.log('Reference:', accountReference);

            // Validate inputs
            if (!phoneNumber || !amount || !accountReference) {
                throw new Error('Phone number, amount, and account reference are required');
            }

            // Format phone number (remove + and ensure it starts with 254)
            let formattedPhone = phoneNumber.replace(/\+/g, '').replace(/\s/g, '');
            if (formattedPhone.startsWith('0')) {
                formattedPhone = '254' + formattedPhone.substring(1);
            } else if (!formattedPhone.startsWith('254')) {
                formattedPhone = '254' + formattedPhone;
            }

            console.log('Formatted phone:', formattedPhone);

            // Validate phone number format
            if (!/^254[17]\d{8}$/.test(formattedPhone)) {
                throw new Error('Invalid phone number format. Must be a valid Kenyan number (254XXXXXXXXX)');
            }

            // Round amount to nearest integer (M-Pesa doesn't accept decimals)
            const roundedAmount = Math.round(amount);
            console.log('Rounded amount:', roundedAmount);

            if (roundedAmount < 1) {
                throw new Error('Amount must be at least KES 1');
            }

            // Get access token
            const accessToken = await this.getAccessToken();

            // Generate timestamp and password
            const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').substring(0, 14);
            const password = this.generatePassword(timestamp);

            // Set callback URL (use provided or default from env)
            // M-Pesa requires a valid URL. If we are on localhost, use a placeholder that passes format validation
            // In production, this MUST be a valid https URL reachable by Safaricom
            let finalCallbackUrl = callbackUrl || `${process.env.API_URL}/api/payments/mpesa/callback`;

            if (!finalCallbackUrl || finalCallbackUrl.includes('localhost') || finalCallbackUrl.includes('127.0.0.1')) {
                console.warn('⚠️ Warning: specific callback URL not set or is localhost. Using a placeholder for sandbox testing.');
                finalCallbackUrl = 'https://jeien-backend.onrender.com/api/payments/mpesa/callback'; // Use production/staging URL or a valid dummy
            }

            console.log('Callback URL:', finalCallbackUrl);
            console.log('Timestamp:', timestamp);

            // Prepare STK push request
            const requestData = {
                BusinessShortCode: this.shortcode,
                Password: password,
                Timestamp: timestamp,
                TransactionType: 'CustomerPayBillOnline',
                Amount: roundedAmount,
                PartyA: formattedPhone,
                PartyB: this.shortcode,
                PhoneNumber: formattedPhone,
                CallBackURL: finalCallbackUrl,
                AccountReference: accountReference.substring(0, 12), // Max 12 characters
                TransactionDesc: transactionDesc || `Payment for ${accountReference}`
            };

            console.log('STK Push request data:', JSON.stringify(requestData, null, 2));

            // Send STK push request
            try {
                const response = await axios.post(
                    `${this.baseURL}/mpesa/stkpush/v1/processrequest`,
                    requestData,
                    {
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );

                console.log('✅ STK Push initiated successfully');
                console.log('Response:', JSON.stringify(response.data, null, 2));

                return {
                    success: true,
                    message: 'STK push sent successfully',
                    data: {
                        MerchantRequestID: response.data.MerchantRequestID,
                        CheckoutRequestID: response.data.CheckoutRequestID,
                        ResponseCode: response.data.ResponseCode,
                        ResponseDescription: response.data.ResponseDescription,
                        CustomerMessage: response.data.CustomerMessage
                    }
                };
            } catch (error) {
                // Check if error is due to invalid token (401 or specific 404 code)
                const errorCode = error.response?.data?.errorCode;
                const isAuthError = error.response?.status === 401 ||
                    (error.response?.status === 404 && errorCode === '404.001.03'); // Invalid Access Token

                if (isAuthError) {
                    console.log('⚠️ Access token invalid or expired. Invalidating cache and retrying...');
                    this.accessToken = null;
                    this.tokenExpiry = null;

                    // Recursive call with new token (one retry only usually safer, but for now exact logic)
                    // Better to just fetch new token and retry here to avoid infinite recursion risk without counter

                    const newAccessToken = await this.getAccessToken();

                    const retryResponse = await axios.post(
                        `${this.baseURL}/mpesa/stkpush/v1/processrequest`,
                        requestData,
                        {
                            headers: {
                                Authorization: `Bearer ${newAccessToken}`,
                                'Content-Type': 'application/json'
                            }
                        }
                    );

                    console.log('✅ STK Push retry successful');

                    return {
                        success: true,
                        message: 'STK push sent successfully',
                        data: {
                            MerchantRequestID: retryResponse.data.MerchantRequestID,
                            CheckoutRequestID: retryResponse.data.CheckoutRequestID,
                            ResponseCode: retryResponse.data.ResponseCode,
                            ResponseDescription: retryResponse.data.ResponseDescription,
                            CustomerMessage: retryResponse.data.CustomerMessage
                        }
                    };
                }

                throw error; // Re-throw if not auth error or if retry failed
            }
        } catch (error) {
            console.error('❌ STK Push failed:', error.response?.data || error.message);

            // Return detailed error
            return {
                success: false,
                message: error.response?.data?.errorMessage || error.message || 'Failed to initiate payment',
                error: error.response?.data || { message: error.message },
                raw: error.toJSON ? error.toJSON() : error
            };
        }
    }

    /**
     * Query STK push transaction status
     * @param {string} checkoutRequestID - CheckoutRequestID from STK push response
     */
    async querySTKPushStatus(checkoutRequestID) {
        try {
            console.log('=== QUERYING STK PUSH STATUS ===');
            console.log('CheckoutRequestID:', checkoutRequestID);

            const accessToken = await this.getAccessToken();
            const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').substring(0, 14);
            const password = this.generatePassword(timestamp);

            const response = await axios.post(
                `${this.baseURL}/mpesa/stkpushquery/v1/query`,
                {
                    BusinessShortCode: this.shortcode,
                    Password: password,
                    Timestamp: timestamp,
                    CheckoutRequestID: checkoutRequestID
                },
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('Query response:', JSON.stringify(response.data, null, 2));
            return response.data;
        } catch (error) {
            console.error('Query STK push status failed:', error.response?.data || error.message);
            throw error;
        }
    }
}

// Export singleton instance
module.exports = new MpesaService();
