const nodemailer = require('nodemailer');

/**
 * Send an email using the configured SMTP credentials.
 * Falls back gracefully if credentials are missing.
 *
 * @param {object} options
 * @param {string} options.email   - Recipient address
 * @param {string} options.subject - Email subject
 * @param {string} options.message - Plain-text body
 * @param {string} [options.html]  - HTML body (optional)
 */
const sendEmail = async ({ email, subject, message, html }) => {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER || process.env.EMAIL_FROM;
    const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

    if (!user || !pass) {
        console.warn('[sendEmail] SMTP credentials not configured. Email not sent to:', email);
        // Log the message so it is not silently lost
        console.log('[sendEmail] Subject:', subject);
        console.log('[sendEmail] Body:', message);
        return;
    }

    const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
    });

    await transporter.sendMail({
        from: `"Jeien Support" <${user}>`,
        to: email,
        subject,
        text: message,
        html: html || message,
    });

    console.log(`[sendEmail] Email sent to ${email}: ${subject}`);
};

module.exports = { sendEmail };
