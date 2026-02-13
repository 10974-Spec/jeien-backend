const nodemailer = require('nodemailer');

// Create email transporter
const createTransporter = () => {
    // For development, use ethereal email or your SMTP
    if (process.env.NODE_ENV === 'development' && !process.env.EMAIL_HOST) {
        console.log('[Email] Using console logging for development');
        return null;
    }

    return nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: process.env.EMAIL_PORT || 587,
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        }
    });
};

// Send password reset email
const sendPasswordResetEmail = async (email, resetToken, userName) => {
    const transporter = createTransporter();

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    const mailOptions = {
        from: process.env.EMAIL_FROM || 'JEIEN <noreply@jeien.com>',
        to: email,
        subject: 'Password Reset Request - JEIEN',
        html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%); color: white; padding: 30px; text-align: center; }
          .content { background: #f9fafb; padding: 30px; }
          .button { display: inline-block; padding: 12px 30px; background: #1e40af; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <p>Hello ${userName || 'User'},</p>
            <p>We received a request to reset your password for your JEIEN account.</p>
            <p>Click the button below to reset your password:</p>
            <a href="${resetUrl}" class="button">Reset Password</a>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #1e40af;">${resetUrl}</p>
            <p><strong>This link will expire in 1 hour.</strong></p>
            <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
          </div>
          <div class="footer">
            <p>© 2024 JEIEN. All rights reserved.</p>
            <p>This is an automated email, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `
    };

    if (!transporter) {
        // Development mode - log to console
        console.log('\n=== PASSWORD RESET EMAIL ===');
        console.log('To:', email);
        console.log('Reset URL:', resetUrl);
        console.log('===========================\n');
        return { success: true, message: 'Email logged to console (development mode)' };
    }

    try {
        await transporter.sendMail(mailOptions);
        return { success: true, message: 'Password reset email sent successfully' };
    } catch (error) {
        console.error('Email send error:', error);
        throw new Error('Failed to send password reset email');
    }
};

// Send welcome email
const sendWelcomeEmail = async (email, userName) => {
    const transporter = createTransporter();

    const mailOptions = {
        from: process.env.EMAIL_FROM || 'JEIEN <noreply@jeien.com>',
        to: email,
        subject: 'Welcome to JEIEN!',
        html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%); color: white; padding: 30px; text-align: center; }
          .content { background: #f9fafb; padding: 30px; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to JEIEN!</h1>
          </div>
          <div class="content">
            <p>Hello ${userName || 'User'},</p>
            <p>Thank you for joining JEIEN - your premium marketplace!</p>
            <p>We're excited to have you on board. Start exploring our wide range of products and enjoy a seamless shopping experience.</p>
            <p>If you have any questions, feel free to reach out to our support team.</p>
          </div>
          <div class="footer">
            <p>© 2024 JEIEN. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
    };

    if (!transporter) {
        console.log('\n=== WELCOME EMAIL ===');
        console.log('To:', email);
        console.log('User:', userName);
        console.log('====================\n');
        return { success: true };
    }

    try {
        await transporter.sendMail(mailOptions);
        return { success: true };
    } catch (error) {
        console.error('Welcome email error:', error);
        // Don't throw error for welcome email
        return { success: false };
    }
};

module.exports = {
    sendPasswordResetEmail,
    sendWelcomeEmail
};
