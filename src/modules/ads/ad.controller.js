const Ad = require('./ad.model');
const Vendor = require('../vendors/vendor.model');
const Product = require('../products/product.model');
const Category = require('../categories/category.model');
const { uploadSingleImage } = require('../../utils/upload.util');

const createAd = async (req, res) => {
  try {
    const { title, description, link, linkType, targetId, position, type, startDate, endDate, priority, budget, targeting, settings } = req.body;
    const userId = req.user.id;

    let owner = 'ADMIN';
    let ownerId = userId;

    if (req.user.role === 'VENDOR') {
      const vendor = await Vendor.findOne({ user: userId });
      if (!vendor) {
        return res.status(404).json({ message: 'Vendor not found' });
      }
      
      if (!vendor.active) {
        return res.status(403).json({ message: 'Vendor account is not active' });
      }

      owner = 'VENDOR';
      ownerId = vendor._id;
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Ad image is required' });
    }

    if (linkType === 'PRODUCT' && targetId) {
      const product = await Product.findById(targetId);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      
      if (owner === 'VENDOR' && product.vendor.toString() !== ownerId.toString()) {
        return res.status(403).json({ message: 'Not authorized to create ad for this product' });
      }
    } else if (linkType === 'CATEGORY' && targetId) {
      const category = await Category.findById(targetId);
      if (!category) {
        return res.status(404).json({ message: 'Category not found' });
      }
    } else if (linkType === 'VENDOR' && targetId) {
      const targetVendor = await Vendor.findById(targetId);
      if (!targetVendor) {
        return res.status(404).json({ message: 'Vendor not found' });
      }
    }

    // UPLOAD TO CLOUDINARY
    let imageUrl = null;
    try {
      console.log('Uploading image to Cloudinary...');
      imageUrl = await uploadSingleImage(req.file, 'ads');
      console.log('Image uploaded to Cloudinary:', imageUrl);
    } catch (uploadError) {
      console.error('Cloudinary upload failed:', uploadError);
      return res.status(500).json({ 
        message: 'Failed to upload image', 
        error: uploadError.message 
      });
    }

    const adData = {
      title: title.trim(),
      description: description || '',
      image: imageUrl, // Cloudinary URL
      link: link.trim(),
      linkType: linkType || 'URL',
      targetId: targetId || null,
      owner,
      ownerId,
      position,
      type: type || 'BANNER',
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: new Date(endDate),
      priority: priority || 0,
      budget: budget ? JSON.parse(budget) : {
        total: 0,
        spent: 0,
        dailyLimit: 0,
        costPerClick: 0,
        costPerView: 0
      },
      targeting: targeting ? JSON.parse(targeting) : {},
      settings: settings ? JSON.parse(settings) : {
        frequency: 1,
        rotation: true,
        closeable: true,
        backgroundColor: '#FFFFFF',
        textColor: '#000000'
      },
      metadata: {
        createdBy: userId,
        approvedBy: owner === 'ADMIN' ? userId : null,
        approvedAt: owner === 'ADMIN' ? new Date() : null
      }
    };

    const ad = new Ad(adData);
    await ad.save();

    res.status(201).json({
      message: owner === 'ADMIN' ? 'Ad created successfully' : 'Ad created. Waiting for admin approval.',
      ad
    });
  } catch (error) {
    console.error('Create ad error:', error);
    res.status(500).json({ message: 'Failed to create ad', error: error.message });
  }
};

const getAllAds = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20,
      owner,
      position,
      type,
      active,
      approved,
      search,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const filter = {};

    if (req.user.role === 'VENDOR') {
      const vendor = await Vendor.findOne({ user: req.user.id });
      if (!vendor) {
        return res.status(404).json({ message: 'Vendor not found' });
      }
      filter.owner = 'VENDOR';
      filter.ownerId = vendor._id;
    }

    if (owner && req.user.role === 'ADMIN') filter.owner = owner;
    if (position) filter.position = position;
    if (type) filter.type = type;
    
    if (active !== undefined) {
      const now = new Date();
      if (active === 'true') {
        filter.active = true;
        filter.startDate = { $lte: now };
        filter.endDate = { $gte: now };
      } else {
        filter.$or = [
          { active: false },
          { startDate: { $gt: now } },
          { endDate: { $lt: now } }
        ];
      }
    }

    if (approved !== undefined && req.user.role === 'ADMIN') {
      if (approved === 'true') {
        filter['metadata.approvedBy'] = { $ne: null };
      } else {
        filter['metadata.approvedBy'] = null;
      }
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { link: { $regex: search, $options: 'i' } }
      ];
    }

    if (startDate) filter.startDate = { $gte: new Date(startDate) };
    if (endDate) filter.endDate = { $lte: new Date(endDate) };

    const sortOptions = {};
    sortOptions[sortBy] = sortDirection;

    const ads = await Ad.find(filter)
      .populate('metadata.createdBy', 'name email')
      .populate('metadata.approvedBy', 'name email')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Ad.countDocuments(filter);

    const stats = await Ad.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalAds: { $sum: 1 },
          activeAds: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$active', true] },
                    { $lte: ['$startDate', new Date()] },
                    { $gte: ['$endDate', new Date()] }
                  ]
                },
                1,
                0
              ]
            }
          },
          totalViews: { $sum: '$stats.views' },
          totalClicks: { $sum: '$stats.clicks' },
          totalBudget: { $sum: '$budget.total' },
          totalSpent: { $sum: '$budget.spent' }
        }
      }
    ]);

    res.json({
      ads,
      stats: stats[0] || {
        totalAds: 0,
        activeAds: 0,
        totalViews: 0,
        totalClicks: 0,
        totalBudget: 0,
        totalSpent: 0
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get all ads error:', error);
    res.status(500).json({ message: 'Failed to get ads', error: error.message });
  }
};

const getAdById = async (req, res) => {
  try {
    const { id } = req.params;

    const ad = await Ad.findById(id)
      .populate('metadata.createdBy', 'name email')
      .populate('metadata.approvedBy', 'name email')
      .populate('targetId', 'title name storeName slug');

    if (!ad) {
      return res.status(404).json({ message: 'Ad not found' });
    }

    if (req.user.role === 'VENDOR') {
      const vendor = await Vendor.findOne({ user: req.user.id });
      if (!vendor || (ad.owner === 'VENDOR' && ad.ownerId.toString() !== vendor._id.toString())) {
        return res.status(403).json({ message: 'Not authorized to view this ad' });
      }
    }

    if (!ad.isActive && req.user.role !== 'ADMIN' && (!req.user || req.user.id !== ad.metadata.createdBy.toString())) {
      return res.status(403).json({ message: 'Ad is not active' });
    }

    res.json(ad);
  } catch (error) {
    console.error('Get ad error:', error);
    res.status(500).json({ message: 'Failed to get ad', error: error.message });
  }
};

const updateAd = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const ad = await Ad.findById(id);
    if (!ad) {
      return res.status(404).json({ message: 'Ad not found' });
    }

    if (req.user.role === 'VENDOR') {
      const vendor = await Vendor.findOne({ user: req.user.id });
      if (!vendor || ad.owner !== 'VENDOR' || ad.ownerId.toString() !== vendor._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to update this ad' });
      }
    }

    const allowedUpdates = [
      'title',
      'description',
      'link',
      'linkType',
      'targetId',
      'position',
      'type',
      'active',
      'startDate',
      'endDate',
      'priority',
      'budget',
      'targeting',
      'settings'
    ];

    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        if (field === 'title') {
          ad[field] = updates[field].trim();
        } else if (field === 'budget' || field === 'targeting' || field === 'settings') {
          ad[field] = JSON.parse(updates[field]);
        } else if (field === 'startDate' || field === 'endDate') {
          ad[field] = new Date(updates[field]);
        } else {
          ad[field] = updates[field];
        }
      }
    });

    if (req.file) {
      // UPLOAD NEW IMAGE TO CLOUDINARY
      try {
        console.log('Uploading new image to Cloudinary...');
        const imageUrl = await uploadSingleImage(req.file, 'ads');
        console.log('New image uploaded to Cloudinary:', imageUrl);
        ad.image = imageUrl;
      } catch (uploadError) {
        console.error('Cloudinary upload failed:', uploadError);
        return res.status(500).json({ 
          message: 'Failed to upload new image', 
          error: uploadError.message 
        });
      }
    } else if (updates.removeImage === 'true') {
      ad.image = null;
    }

    if (updates.approved !== undefined && req.user.role === 'ADMIN') {
      if (updates.approved === 'true') {
        ad.metadata.approvedBy = req.user.id;
        ad.metadata.approvedAt = new Date();
        ad.metadata.rejectionReason = null;
      } else {
        ad.metadata.approvedBy = null;
        ad.metadata.approvedAt = null;
        ad.metadata.rejectionReason = updates.rejectionReason || 'Rejected by admin';
      }
    }

    await ad.save();

    res.json({
      message: 'Ad updated successfully',
      ad
    });
  } catch (error) {
    console.error('Update ad error:', error);
    res.status(500).json({ message: 'Failed to update ad', error: error.message });
  }
};

const deleteAd = async (req, res) => {
  try {
    const { id } = req.params;

    const ad = await Ad.findById(id);
    if (!ad) {
      return res.status(404).json({ message: 'Ad not found' });
    }

    if (req.user.role === 'VENDOR') {
      const vendor = await Vendor.findOne({ user: req.user.id });
      if (!vendor || ad.owner !== 'VENDOR' || ad.ownerId.toString() !== vendor._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to delete this ad' });
      }
    }

    await Ad.findByIdAndDelete(id);

    res.json({
      message: 'Ad deleted successfully'
    });
  } catch (error) {
    console.error('Delete ad error:', error);
    res.status(500).json({ message: 'Failed to delete ad', error: error.message });
  }
};

const getActiveAds = async (req, res) => {
  try {
    const role = req.user?.role || 'GUEST';
    const { position, type, country, city, category, device, userRole } = req.query;
    const now = new Date();

    const filter = {
      active: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
      $or: [
        { 'budget.total': 0 },
        { $expr: { $lt: ['$budget.spent', '$budget.total'] } }
      ]
    };

    if (position) filter.position = position;
    if (type) filter.type = type;

    if (country || city || category || device || userRole) {
      filter.targeting = {};

      if (country) {
        filter.$or = [
          { 'targeting.countries': { $size: 0 } },
          { 'targeting.countries': country.toUpperCase() }
        ];
      }

      if (city) {
        filter.$or = [
          { 'targeting.cities': { $size: 0 } },
          { 'targeting.cities': { $regex: city, $options: 'i' } }
        ];
      }

      if (category) {
        filter.$or = [
          { 'targeting.categories': { $size: 0 } },
          { 'targeting.categories': category }
        ];
      }

      if (device) {
        filter.$or = [
          { 'targeting.devices': { $size: 0 } },
          { 'targeting.devices': device.toUpperCase() }
        ];
      }

      if (userRole) {
        filter.$or = [
          { 'targeting.userRoles': { $size: 0 } },
          { 'targeting.userRoles': userRole.toUpperCase() }
        ];
      }
    }

    if (role === 'ADMIN') {
      filter['metadata.approvedBy'] = { $ne: null };
    }

    const ads = await Ad.find(filter)
      .sort({ priority: -1, createdAt: -1 })
      .limit(20)
      .select('title description image link linkType targetId position type settings stats');

    const adsWithTargets = await Promise.all(ads.map(async (ad) => {
      let targetData = null;
      
      if (ad.linkType === 'PRODUCT' && ad.targetId) {
        targetData = await Product.findById(ad.targetId).select('title price images slug');
      } else if (ad.linkType === 'CATEGORY' && ad.targetId) {
        targetData = await Category.findById(ad.targetId).select('name slug image');
      } else if (ad.linkType === 'VENDOR' && ad.targetId) {
        targetData = await Vendor.findById(ad.targetId).select('storeName storeLogo');
      }

      return {
        ...ad.toObject(),
        target: targetData
      };
    }));

    res.json(adsWithTargets);
  } catch (error) {
    console.error('Get active ads error:', error);
    res.status(500).json({ message: 'Failed to get active ads', error: error.message });
  }
};

const trackAdView = async (req, res) => {
  try {
    const { id } = req.params;

    const ad = await Ad.findById(id);
    if (!ad || !ad.isActive) {
      return res.status(404).json({ message: 'Ad not found or inactive' });
    }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    ad.stats.views += 1;
    ad.stats.lastViewed = now;

    if (ad.budget.costPerView > 0) {
      const dailySpent = ad.getDailySpent();
      const viewCost = ad.budget.costPerView;

      if ((ad.budget.dailyLimit === 0 || dailySpent + viewCost <= ad.budget.dailyLimit) &&
          (ad.budget.total === 0 || ad.budget.spent + viewCost <= ad.budget.total)) {
        ad.budget.spent += viewCost;
      }
    }

    await ad.save();

    res.json({
      message: 'Ad view tracked',
      ad: {
        id: ad._id,
        title: ad.title,
        views: ad.stats.views,
        budgetSpent: ad.budget.spent
      }
    });
  } catch (error) {
    console.error('Track ad view error:', error);
    res.status(500).json({ message: 'Failed to track ad view', error: error.message });
  }
};

const trackAdClick = async (req, res) => {
  try {
    const { id } = req.params;

    const ad = await Ad.findById(id);
    if (!ad || !ad.isActive) {
      return res.status(404).json({ message: 'Ad not found or inactive' });
    }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    ad.stats.clicks += 1;
    ad.stats.lastClicked = now;

    if (ad.stats.views > 0) {
      ad.stats.ctr = (ad.stats.clicks / ad.stats.views) * 100;
    }

    if (ad.budget.costPerClick > 0) {
      const dailySpent = ad.getDailySpent();
      const clickCost = ad.budget.costPerClick;

      if ((ad.budget.dailyLimit === 0 || dailySpent + clickCost <= ad.budget.dailyLimit) &&
          (ad.budget.total === 0 || ad.budget.spent + clickCost <= ad.budget.total)) {
        ad.budget.spent += clickCost;
      }
    }

    await ad.save();

    res.json({
      message: 'Ad click tracked',
      ad: {
        id: ad._id,
        title: ad.title,
        clicks: ad.stats.clicks,
        ctr: ad.stats.ctr,
        budgetSpent: ad.budget.spent
      }
    });
  } catch (error) {
    console.error('Track ad click error:', error);
    res.status(500).json({ message: 'Failed to track ad click', error: error.message });
  }
};

const getAdAnalytics = async (req, res) => {
  try {
    const { id } = req.params;

    const ad = await Ad.findById(id);
    if (!ad) {
      return res.status(404).json({ message: 'Ad not found' });
    }

    if (req.user.role === 'VENDOR') {
      const vendor = await Vendor.findOne({ user: req.user.id });
      if (!vendor || ad.owner !== 'VENDOR' || ad.ownerId.toString() !== vendor._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to view analytics' });
      }
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyStats = await Ad.aggregate([
      { $match: { _id: ad._id } },
      {
        $project: {
          dailyViews: { $ifNull: ['$stats.dailyViews', []] },
          dailyClicks: { $ifNull: ['$stats.dailyClicks', []] }
        }
      }
    ]);

    const performance = {
      views: ad.stats.views,
      clicks: ad.stats.clicks,
      conversions: ad.stats.conversions,
      ctr: ad.stats.ctr,
      budgetSpent: ad.budget.spent,
      budgetRemaining: ad.budget.total - ad.budget.spent,
      daysRemaining: ad.daysRemaining,
      isActive: ad.isActive
    };

    const hourlyStats = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      views: Math.floor(Math.random() * 100),
      clicks: Math.floor(Math.random() * 20)
    }));

    res.json({
      ad: {
        id: ad._id,
        title: ad.title,
        position: ad.position,
        type: ad.type
      },
      performance,
      dailyStats: dailyStats[0] || { dailyViews: [], dailyClicks: [] },
      hourlyStats,
      recommendations: getAdRecommendations(ad)
    });
  } catch (error) {
    console.error('Get ad analytics error:', error);
    res.status(500).json({ message: 'Failed to get ad analytics', error: error.message });
  }
};

const getAdRecommendations = (ad) => {
  const recommendations = [];

  if (ad.stats.ctr < 1) {
    recommendations.push({
      type: 'CTR_LOW',
      message: 'Click-through rate is below average. Consider updating the ad image or title.',
      priority: 'HIGH'
    });
  }

  if (ad.budget.spent > ad.budget.total * 0.8 && ad.budget.total > 0) {
    recommendations.push({
      type: 'BUDGET_LOW',
      message: 'Budget is running low. Consider increasing budget to maintain ad visibility.',
      priority: 'MEDIUM'
    });
  }

  if (ad.daysRemaining < 7) {
    recommendations.push({
      type: 'EXPIRING_SOON',
      message: 'Ad is expiring soon. Consider extending the end date.',
      priority: 'MEDIUM'
    });
  }

  if (ad.stats.views > 1000 && ad.stats.clicks === 0) {
    recommendations.push({
      type: 'NO_CLICKS',
      message: 'High views but no clicks. The ad may not be relevant to the target audience.',
      priority: 'HIGH'
    });
  }

  return recommendations;
};

const approveAd = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { id } = req.params;
    const { approved, rejectionReason } = req.body;

    const ad = await Ad.findById(id);
    if (!ad) {
      return res.status(404).json({ message: 'Ad not found' });
    }

    if (ad.owner === 'ADMIN') {
      return res.status(400).json({ message: 'Admin ads are auto-approved' });
    }

    if (approved) {
      ad.metadata.approvedBy = req.user.id;
      ad.metadata.approvedAt = new Date();
      ad.metadata.rejectionReason = null;
      ad.active = true;
    } else {
      ad.metadata.approvedBy = null;
      ad.metadata.approvedAt = null;
      ad.metadata.rejectionReason = rejectionReason || 'Rejected by admin';
      ad.active = false;
    }

    await ad.save();

    res.json({
      message: `Ad ${approved ? 'approved' : 'rejected'} successfully`,
      ad: {
        id: ad._id,
        title: ad.title,
        approved: approved,
        approvedBy: ad.metadata.approvedBy,
        approvedAt: ad.metadata.approvedAt,
        rejectionReason: ad.metadata.rejectionReason
      }
    });
  } catch (error) {
    console.error('Approve ad error:', error);
    res.status(500).json({ message: 'Failed to approve ad', error: error.message });
  }
};

module.exports = {
  createAd,
  getAllAds,
  getAdById,
  updateAd,
  deleteAd,
  getActiveAds,
  trackAdView,
  trackAdClick,
  getAdAnalytics,
  approveAd
};