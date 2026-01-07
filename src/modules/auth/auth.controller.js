const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../users/user.model');
const Vendor = require('../vendors/vendor.model');
const { uploadSingleImage } = require('../../utils/upload.util');

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
      name: user.name
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

const register = async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email,
      password: hashedPassword,
      phone,
      role: role || 'BUYER'
    });

    await user.save();

    if (user.role === 'VENDOR' || user.role === 'ADMIN') {
      const vendor = new Vendor({
        user: user._id,
        storeName: `${user.name}'s Store`,
        active: user.role === 'ADMIN'
      });
      await vendor.save();
    }

    const token = generateToken(user);
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: userResponse
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Registration failed', error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user);
    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      message: 'Login successful',
      token,
      user: userResponse
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
};

const googleAuth = async (req, res) => {
  try {
    const { tokenId, email, name, imageUrl } = req.body;

    let user = await User.findOne({ email });

    if (!user) {
      user = new User({
        name,
        email,
        password: await bcrypt.hash(tokenId, 10),
        profileImage: imageUrl,
        role: 'BUYER'
      });
      await user.save();
    }

    const token = generateToken(user);
    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      message: 'Google authentication successful',
      token,
      user: userResponse
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ message: 'Google authentication failed', error: error.message });
  }
};

const facebookAuth = async (req, res) => {
  try {
    const { accessToken, email, name, picture } = req.body;

    let user = await User.findOne({ email });

    if (!user) {
      user = new User({
        name,
        email,
        password: await bcrypt.hash(accessToken, 10),
        profileImage: picture?.data?.url,
        role: 'BUYER'
      });
      await user.save();
    }

    const token = generateToken(user);
    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      message: 'Facebook authentication successful',
      token,
      user: userResponse
    });
  } catch (error) {
    console.error('Facebook auth error:', error);
    res.status(500).json({ message: 'Facebook authentication failed', error: error.message });
  }
};

const me = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let vendorProfile = null;
    if (user.role === 'VENDOR' || user.role === 'ADMIN') {
      vendorProfile = await Vendor.findOne({ user: user._id });
    }

    res.json({
      user,
      vendorProfile
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Failed to get profile', error: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, phone } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (name) user.name = name;
    if (phone) user.phone = phone;

    await user.save();

    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      message: 'Profile updated successfully',
      user: userResponse
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Failed to update profile', error: error.message });
  }
};

const updateProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image provided' });
    }

    const userId = req.user.id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const oldImageUrl = user.profileImage;
    const newImageUrl = await uploadSingleImage(req.file, 'profiles');

    user.profileImage = newImageUrl;
    await user.save();

    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      message: 'Profile image updated successfully',
      user: userResponse
    });
  } catch (error) {
    console.error('Update profile image error:', error);
    res.status(500).json({ message: 'Failed to update profile image', error: error.message });
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