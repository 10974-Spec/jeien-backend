const User = require('../users/user.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../../config/env');

const register = async (req, res) => {
  try {
    const { name, email, password, role = 'BUYER' } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists'                                                                    
      });
    }

    // Create user
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      name,
      email,
      password: hashedPassword,
      role
    });

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
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
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
  googleAuth,
  facebookAuth,
  me,
  updateProfile,
  updateProfileImage
};