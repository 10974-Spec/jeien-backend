const User = require('../users/user.model');
const PasswordReset = require('./passwordReset.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../../config/env');
const { sendPasswordResetEmail, sendWelcomeEmail } = require('../../utils/email.service');
const { notifyUserRegistered } = require('../../utils/notification.service');

const register = async (req, res) => {
  try {
    const { name, email, password, phone, role = 'BUYER' } = req.body;

    // Validate phone (required)
    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    // Validate name (required)
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Name is required'
      });
    }

    // Check if user exists by phone
    const existingUserByPhone = await User.findOne({ phone });
    if (existingUserByPhone) {
      return res.status(400).json({
        success: false,
        message: 'User with this phone number already exists'
      });
    }

    // Check if user exists by email (if provided)
    let normalizedEmail = null;
    if (email) {
      normalizedEmail = email.toLowerCase();
      const existingUserByEmail = await User.findOne({ email: normalizedEmail });
      if (existingUserByEmail) {
        return res.status(400).json({
          success: false,
          message: 'User with this email already exists'
        });
      }
    }

    // Create user - password is optional
    const userData = {
      name,
      phone,
      role,
      authProvider: 'phone' // Default to phone/name auth
    };

    if (normalizedEmail) {
      userData.email = normalizedEmail;
    }

    if (password) {
      userData.password = await bcrypt.hash(password, 10);
      userData.authProvider = 'local'; // If password provided, use local strategy
    }

    const user = new User(userData);
    await user.save();

    // Create notification for admin (non-blocking)
    notifyUserRegistered(user).catch(err =>
      console.error('Failed to create user registration notification:', err)
    );

    // Send welcome email (only if email is provided)
    if (normalizedEmail) {
      try {
        await sendWelcomeEmail(normalizedEmail, user.name);
      } catch (emailError) {
        console.error('Welcome email error:', emailError);
        // Don't fail registration if email fails
      }
    }

    // Generate token
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRE }
    );

    // Return user without password
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: userResponse
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, phone, password, name } = req.body;

    let user;

    if (phone) {
      // Phone based login
      user = await User.findOne({ phone });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found with this phone number'
        });
      }

      // 1. Password Check (if provided by user AND user has password set)
      if (password && user.password) {
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
          return res.status(401).json({
            success: false,
            message: 'Invalid password'
          });
        }
      }
      // 2. Name Check (if password NOT provided OR user has NO password)
      // This is the "Passwordless" flow requested: Phone + Name
      else {
        if (!name) {
          return res.status(401).json({
            success: false,
            message: 'Name is required for login without password'
          });
        }

        // Simple case-insensitive match
        if (user.name.toLowerCase() !== name.toLowerCase()) {
          return res.status(401).json({
            success: false,
            message: 'Name does not match our records'
          });
        }
      }

    } else if (email) {
      // Email based login (Legacy/Standard)
      const normalizedEmail = email.toLowerCase();
      user = await User.findOne({ email: normalizedEmail });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      if (!password) {
        return res.status(401).json({
          success: false,
          message: 'Password required for email login'
        });
      }

      if (!user.password) {
        return res.status(401).json({
          success: false,
          message: 'This account was created without a password. Please use Phone & Name to login.'
        });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Please provide Email or Phone number'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRE }
    );

    // Return user without password
    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: userResponse
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
};

// Request password reset
const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const normalizedEmail = email.toLowerCase();

    // Find user
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      // Don't reveal if user exists or not
      return res.json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent'
      });
    }

    // Generate reset token
    const resetToken = await PasswordReset.createResetToken(user._id);

    // Send reset email
    try {
      await sendPasswordResetEmail(email, resetToken, user.name);
    } catch (emailError) {
      console.error('Password reset email error:', emailError);
      return res.status(500).json({
        success: false,
        message: 'Failed to send password reset email'
      });
    }

    res.json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent'
    });

  } catch (error) {
    console.error('Request password reset error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process password reset request',
      error: error.message
    });
  }
};

// Verify reset token
const verifyResetToken = async (req, res) => {
  try {
    const { token } = req.params;

    const resetToken = await PasswordReset.verifyToken(token);

    if (!resetToken) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    res.json({
      success: true,
      message: 'Token is valid',
      email: resetToken.user.email
    });

  } catch (error) {
    console.error('Verify reset token error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify reset token',
      error: error.message
    });
  }
};

// Reset password
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Token and new password are required'
      });
    }

    // Verify token
    const resetToken = await PasswordReset.verifyToken(token);

    if (!resetToken) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Update user password
    const user = resetToken.user;
    user.password = await bcrypt.hash(newPassword, 10);
    user.authProvider = 'local'; // Update auth provider
    await user.save();

    // Mark token as used
    resetToken.used = true;
    await resetToken.save();

    res.json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password',
      error: error.message
    });
  }
};

const googleAuth = async (req, res) => {
  try {
    res.status(501).json({
      success: false,
      message: 'Google auth not implemented yet'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Google auth failed',
      error: error.message
    });
  }
};

const facebookAuth = async (req, res) => {
  try {
    res.status(501).json({
      success: false,
      message: 'Facebook auth not implemented yet'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Facebook auth failed',
      error: error.message
    });
  }
};

const me = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile',
      error: error.message
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, phone } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (name) user.name = name;
    if (phone) user.phone = phone;

    await user.save();

    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: userResponse
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message
    });
  }
};

const updateProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image provided'
      });
    }

    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // For now, just save the file path
    const imageUrl = `/uploads/profiles/${req.file.filename}`;
    user.profileImage = imageUrl;

    await user.save();

    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      success: true,
      message: 'Profile image updated successfully',
      user: userResponse
    });

  } catch (error) {
    console.error('Update profile image error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile image',
      error: error.message
    });
  }
};

module.exports = {
  register,
  login,
  requestPasswordReset,
  verifyResetToken,
  resetPassword,
  googleAuth,
  facebookAuth,
  me,
  updateProfile,
  updateProfileImage
};