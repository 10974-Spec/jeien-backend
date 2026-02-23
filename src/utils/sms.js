const sendSMS = async (to, message) => {
    try {
        if (!process.env.AFRICASTALKING_API_KEY || !process.env.AFRICASTALKING_USERNAME) {
            console.log(`[SMS SIMULATION] To: ${to} | Message: ${message}`);
            return;
        }

        const credentials = {
            apiKey: process.env.AFRICASTALKING_API_KEY,
            username: process.env.AFRICASTALKING_USERNAME,
        };
        const AfricasTalking = require('africastalking')(credentials);
        const sms = AfricasTalking.SMS;

        const options = {
            to: [to],
            message: message,
            from: process.env.AFRICASTALKING_SENDER_ID || undefined
        };

        await sms.send(options);
        console.log(`SMS sent to ${to}`);
    } catch (error) {
        console.error('SMS Error:', error);
        // Don't throw, just log, so process flow isn't interrupted
    }
};

module.exports = sendSMS;
