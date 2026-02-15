const Vendor = require('./vendor.model');
const User = require('../users/user.model');
const Product = require('../products/product.model');
const Order = require('../orders/order.model');
const { uploadSingleImage } = require('../../utils/upload.util');
const { notifyVendorRegistered } = require('../../utils/notification.service');

const registerVendor = async (req, res) => {
  try {
    const userId = req.user.id;
    const { storeName, description, contactInfo } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role !== 'BUYER') {
      return res.status(400).json({ message: 'Only buyers can register as vendors' });
    }

    const existingVendor = await Vendor.findOne({ user: userId });
    if (existingVendor) {
      return res.status(400).json({ message: 'Already registered as vendor' });
    }

    const existingStoreName = await Vendor.findOne({ storeName: storeName.trim() });
    if (existingStoreName) {
      return res.status(400).json({ message: 'Store name already taken' });
    }

    const vendor = new Vendor({
      user: userId,
      storeName: storeName.trim(),
      description: description || '',
      contactInfo: contactInfo || {},
      active: false,
      verified: false
    });

    await vendor.save();

    user.role = 'VENDOR';
    await user.save();

    // Create notification for admin (non-blocking)
    notifyVendorRegistered(vendor, user).catch(err =>
      console.error('Failed to create vendor registration notification:', err)
    );

    res.status(201).json({
      message: 'Vendor registration successful. Waiting for admin approval.',
      vendor
    });
  } catch (error) {
    console.error('Vendor registration error:', error);
    res.status(500).json({ message: 'Vendor registration failed', error: error.message });
  }
};

const getVendorStore = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user.id })
      .populate('user', 'name email profileImage phone')
      .populate({
        path: 'products',
        match: { approved: true },
        options: { limit: 10, sort: { createdAt: -1 } }
      });

    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const recentOrders = await Order.find({ vendor: vendor._id })
      .populate('buyer', 'name email')
      .sort({ createdAt: -1 })
      .limit(5);

    const productsCount = await Product.countDocuments({ vendor: vendor._id, approved: true });
    const pendingProductsCount = await Product.countDocuments({ vendor: vendor._id, approved: false });

    res.json({
      vendor,
      stats: {
        products: productsCount,
        pendingProducts: pendingProductsCount,
        recentOrders: recentOrders.length
      },
      recentOrders
    });
  } catch (error) {
    console.error('Get vendor store error:', error);
    res.status(500).json({ message: 'Failed to get vendor store', error: error.message });
  }
};

const updateVendorStore = async (req, res) => {
  try {
    const userId = req.user.id;
    const updates = req.body;

    const vendor = await Vendor.findOne({ user: userId });
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const allowedUpdates = [
      'storeName',
      'description',
      'contactInfo',
      'bankDetails',
      'settings',
      'socialLinks'
    ];

    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        if (field === 'storeName' && updates[field] !== vendor.storeName) {
          const trimmedName = updates[field].trim();
          if (trimmedName !== vendor.storeName) {
            vendor[field] = trimmedName;
          }
        } else if (field === 'contactInfo' || field === 'bankDetails' || field === 'settings' || field === 'socialLinks') {
          vendor[field] = { ...vendor[field], ...updates[field] };
        } else {
          vendor[field] = updates[field];
        }
      }
    });

    await vendor.save();

    res.json({
      message: 'Store updated successfully',
      vendor
    });
  } catch (error) {
    console.error('Update vendor store error:', error);
    res.status(500).json({ message: 'Failed to update store', error: error.message });
  }
};

const updateStoreImages = async (req, res) => {
  try {
    const userId = req.user.id;
    const { logo, banner } = req.files || {};
    const { removeLogo, removeBanner } = req.body;

    const vendor = await Vendor.findOne({ user: userId });
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    if (logo) {
      vendor.storeLogo = await uploadSingleImage(logo, 'store-logos');
    } else if (removeLogo === 'true') {
      vendor.storeLogo = null;
    }

    if (banner) {
      vendor.storeBanner = await uploadSingleImage(banner, 'store-banners');
    } else if (removeBanner === 'true') {
      vendor.storeBanner = null;
    }

    await vendor.save();

    res.json({
      message: 'Store images updated successfully',
      vendor: {
        storeLogo: vendor.storeLogo,
        storeBanner: vendor.storeBanner
      }
    });
  } catch (error) {
    console.error('Update store images error:', error);
    res.status(500).json({ message: 'Failed to update store images', error: error.message });
  }
};

const updateBankDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const { provider, accountName, accountNumber, phoneNumber, bankName, branch } = req.body;

    const vendor = await Vendor.findOne({ user: userId });
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    vendor.bankDetails = {
      provider: provider || vendor.bankDetails.provider,
      accountName: accountName || vendor.bankDetails.accountName,
      accountNumber: accountNumber || vendor.bankDetails.accountNumber,
      phoneNumber: phoneNumber || vendor.bankDetails.phoneNumber,
      bankName: bankName || vendor.bankDetails.bankName,
      branch: branch || vendor.bankDetails.branch
    };

    await vendor.save();

    res.json({
      message: 'Bank details updated successfully',
      bankDetails: vendor.bankDetails
    });
  } catch (error) {
    console.error('Update bank details error:', error);
    res.status(500).json({ message: 'Failed to update bank details', error: error.message });
  }
};

const getVendorStats = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ user: req.user.id });
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [ordersStats, productsStats, revenueStats] = await Promise.all([
      Order.aggregate([
        { $match: { vendor: vendor._id, createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalAmount: { $sum: '$totalAmount' },
            pendingOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
            },
            completedOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            }
          }
        }
      ]),
      Product.countDocuments({ vendor: vendor._id }),
      Order.aggregate([
        { $match: { vendor: vendor._id, status: 'completed' } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$totalAmount' },
            totalCommission: { $sum: '$commissionAmount' },
            netRevenue: { $sum: { $subtract: ['$totalAmount', '$commissionAmount'] } }
          }
        }
      ])
    ]);

    const dailySales = await Order.aggregate([
      { $match: { vendor: vendor._id, createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          sales: { $sum: 1 },
          revenue: { $sum: '$totalAmount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const topProducts = await Product.find({ vendor: vendor._id })
      .sort({ 'stats.sales': -1 })
      .limit(5)
      .select('title price images stats');

    const stats = {
      overview: {
        totalProducts: productsStats,
        totalOrders: ordersStats[0]?.totalOrders || 0,
        totalRevenue: ordersStats[0]?.totalAmount || 0,
        pendingOrders: ordersStats[0]?.pendingOrders || 0
      },
      financial: {
        totalRevenue: revenueStats[0]?.totalRevenue || 0,
        totalCommission: revenueStats[0]?.totalCommission || 0,
        netRevenue: revenueStats[0]?.netRevenue || 0,
        commissionRate: req.user.role === 'ADMIN' ? 0 : (vendor.commissionRate || process.env.DEFAULT_COMMISSION_RATE || 7)
      },
      performance: {
        dailySales,
        topProducts,
        conversionRate: vendor.performance.conversionRate,
        fulfillmentRate: vendor.performance.fulfillmentRate
      }
    };

    res.json(stats);
  } catch (error) {
    console.error('Get vendor stats error:', error);
    res.status(500).json({ message: 'Failed to get vendor stats', error: error.message });
  }
};

const getAllVendors = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, active, verified } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};
    if (search) {
      filter.$or = [
        { storeName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    if (active !== undefined) filter.active = active === 'true';
    if (verified !== undefined) filter.verified = verified === 'true';

    const vendors = await Vendor.find(filter)
      .populate('user', 'name email profileImage')
      .sort({ 'stats.totalSales': -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Vendor.countDocuments(filter);

    res.json({
      vendors,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get all vendors error:', error);
    res.status(500).json({ message: 'Failed to get vendors', error: error.message });
  }
};

const getVendorById = async (req, res) => {
  try {
    const { vendorId } = req.params;

    const vendor = await Vendor.findById(vendorId)
      .populate('user', 'name email profileImage phone');

    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    // Get vendor products count
    const productsCount = await Product.countDocuments({ vendor: vendor._id });
    const approvedProductsCount = await Product.countDocuments({ vendor: vendor._id, approved: true });

    // Get recent orders
    const recentOrders = await Order.find({ vendorIds: vendor._id })
      .populate('buyer', 'name email')
      .sort({ createdAt: -1 })
      .limit(10);

    // Get revenue stats
    const revenueStats = await Order.aggregate([
      { $match: { vendorIds: vendor._id, paymentStatus: 'COMPLETED' } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalOrders: { $sum: 1 }
        }
      }
    ]);

    res.json({
      vendor,
      stats: {
        totalProducts: productsCount,
        approvedProducts: approvedProductsCount,
        totalRevenue: revenueStats[0]?.totalRevenue || 0,
        totalOrders: revenueStats[0]?.totalOrders || 0
      },
      recentOrders
    });
  } catch (error) {
    console.error('Get vendor by ID error:', error);
    res.status(500).json({ message: 'Failed to get vendor details', error: error.message });
  }
};

const updateVendorStatus = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { active, verified, commissionRate } = req.body;

    const vendor = await Vendor.findById(vendorId).populate('user', 'role');
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    if (active !== undefined) {
      vendor.active = active;

      if (vendor.user) {
        const user = await User.findById(vendor.user._id);
        if (user) {
          if (!active && user.role === 'VENDOR') {
            user.role = 'BUYER';
            await user.save();
          } else if (active && user.role === 'BUYER') {
            user.role = 'VENDOR';
            await user.save();
          }
        }
      }
    }

    if (verified !== undefined) {
      vendor.verified = verified;
    }

    if (commissionRate !== undefined) {
      if (commissionRate < 0 || commissionRate > 50) {
        return res.status(400).json({ message: 'Commission rate must be between 0 and 50' });
      }
      vendor.commissionRate = commissionRate;
    }

    await vendor.save();

    res.json({
      message: 'Vendor status updated successfully',
      vendor
    });
  } catch (error) {
    console.error('Update vendor status error:', error);
    res.status(500).json({ message: 'Failed to update vendor status', error: error.message });
  }
};

const getPublicVendorProfile = async (req, res) => {
  try {
    const { vendorId } = req.params;

    const vendor = await Vendor.findById(vendorId)
      .populate('user', 'name profileImage')
      .select('-bankDetails -settings -performance');

    if (!vendor || !vendor.active) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const products = await Product.find({
      vendor: vendor._id,
      approved: true,
      stock: { $gt: 0 }
    })
      .sort({ createdAt: -1 })
      .limit(12)
      .select('title price images category');

    res.json({
      vendor,
      products,
      stats: {
        totalProducts: vendor.stats.totalProducts,
        totalSales: vendor.stats.totalSales,
        averageRating: vendor.stats.averageRating,
        totalReviews: vendor.stats.totalReviews
      }
    });
  } catch (error) {
    console.error('Get public vendor profile error:', error);
    res.status(500).json({ message: 'Failed to get vendor profile', error: error.message });
  }
};

const deleteVendor = async (req, res) => {
  try {
    const { vendorId } = req.params;

    const vendor = await Vendor.findById(vendorId).populate('user');
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    // Delete all products associated with this vendor
    await Product.deleteMany({ vendor: vendorId });

    // Update user role back to BUYER if user exists
    if (vendor.user) {
      const user = await User.findById(vendor.user._id);
      if (user && user.role === 'VENDOR') {
        user.role = 'BUYER';
        await user.save();
      }
    }

    // Delete the vendor
    await Vendor.findByIdAndDelete(vendorId);

    res.json({
      success: true,
      message: 'Vendor and associated products deleted successfully'
    });
  } catch (error) {
    console.error('Delete vendor error:', error);
    res.status(500).json({ message: 'Failed to delete vendor', error: error.message });
  }
};

module.exports = {
  registerVendor,
  getVendorStore,
  updateVendorStore,
  updateStoreImages,
  updateBankDetails,
  getVendorStats,
  getAllVendors,
  getVendorById,
  updateVendorStatus,
  getPublicVendorProfile,
  deleteVendor
};