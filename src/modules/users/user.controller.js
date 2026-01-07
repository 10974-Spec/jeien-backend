const User = require('./user.model');
const Vendor = require('../vendors/vendor.model');
const Order = require('../orders/order.model');
const { uploadSingleImage } = require('../../utils/upload.util');
const bcrypt = require('bcryptjs');

const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password')
      .populate({
        path: 'addresses',
        options: { sort: { isDefault: -1 } }
      });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let vendorProfile = null;
    if (user.role === 'VENDOR' || user.role === 'ADMIN') {
      vendorProfile = await Vendor.findOne({ user: user._id });
    }

    const orderStats = await Order.aggregate([
      { $match: { buyer: user._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);

    const stats = {
      totalOrders: orderStats.reduce((sum, stat) => sum + stat.count, 0),
      totalSpent: orderStats.reduce((sum, stat) => sum + (stat.totalAmount || 0), 0),
      byStatus: orderStats.reduce((acc, stat) => {
        acc[stat._id] = { count: stat.count, totalAmount: stat.totalAmount || 0 };
        return acc;
      }, {})
    };

    res.json({
      user,
      vendorProfile,
      stats
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ message: 'Failed to get profile', error: error.message });
  }
};

const updateUserProfile = async (req, res) => {
  try {
    const { name, phone, preferences } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (name) user.name = name;
    if (phone) user.phone = phone;
    
    if (preferences) {
      user.preferences = {
        ...user.preferences,
        ...preferences
      };
    }

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

const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.json({
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ message: 'Failed to update password', error: error.message });
  }
};

const manageAddresses = async (req, res) => {
  try {
    const { action, address, addressId } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    switch (action) {
      case 'add':
        if (!address || !address.fullName || !address.phone || !address.country || !address.city || !address.street) {
          return res.status(400).json({ message: 'All address fields are required' });
        }

        if (address.isDefault) {
          user.addresses.forEach(addr => {
            addr.isDefault = false;
          });
        }

        user.addresses.push(address);
        break;

      case 'update':
        const addressIndex = user.addresses.findIndex(addr => addr._id.toString() === addressId);
        if (addressIndex === -1) {
          return res.status(404).json({ message: 'Address not found' });
        }

        if (address.isDefault) {
          user.addresses.forEach(addr => {
            addr.isDefault = false;
          });
        }

        user.addresses[addressIndex] = {
          ...user.addresses[addressIndex].toObject(),
          ...address,
          _id: user.addresses[addressIndex]._id
        };
        break;

      case 'delete':
        const filteredAddresses = user.addresses.filter(addr => addr._id.toString() !== addressId);
        if (filteredAddresses.length === user.addresses.length) {
          return res.status(404).json({ message: 'Address not found' });
        }
        user.addresses = filteredAddresses;
        break;

      case 'set-default':
        user.addresses.forEach(addr => {
          addr.isDefault = addr._id.toString() === addressId;
        });
        break;

      default:
        return res.status(400).json({ message: 'Invalid action' });
    }

    await user.save();

    res.json({
      message: 'Address updated successfully',
      addresses: user.addresses
    });
  } catch (error) {
    console.error('Manage addresses error:', error);
    res.status(500).json({ message: 'Failed to manage addresses', error: error.message });
  }
};

const getAllUsers = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { page = 1, limit = 20, role, search } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};
    if (role) filter.role = role;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(filter);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ message: 'Failed to get users', error: error.message });
  }
};

const updateUserRole = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { userId } = req.params;
    const { role } = req.body;

    if (!['BUYER', 'VENDOR', 'ADMIN'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const oldRole = user.role;
    user.role = role;
    await user.save();

    if (oldRole !== 'VENDOR' && role === 'VENDOR') {
      const existingVendor = await Vendor.findOne({ user: userId });
      if (!existingVendor) {
        const vendor = new Vendor({
          user: userId,
          storeName: `${user.name}'s Store`,
          active: true
        });
        await vendor.save();
      }
    }

    if (oldRole === 'VENDOR' && role !== 'VENDOR') {
      await Vendor.deleteOne({ user: userId });
    }

    res.json({
      message: 'User role updated successfully',
      user: user.toObject()
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ message: 'Failed to update user role', error: error.message });
  }
};

module.exports = {
  getUserProfile,
  updateUserProfile,
  updateProfileImage,
  updatePassword,
  manageAddresses,
  getAllUsers,
  updateUserRole
};