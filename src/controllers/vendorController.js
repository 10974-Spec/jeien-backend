const User = require('../models/User');
const Product = require('../models/Product');
const Follow = require('../models/Follow');

// @desc    Get top vendors with stats
// @route   GET /api/vendors/top
// @access  Public
const getTopVendors = async (req, res) => {
    try {
        const vendors = await User.find({ role: 'vendor', vendorStatus: 'approved' });

        const vendorsWithStats = await Promise.all(vendors.slice(0, 20).map(async (vendor) => {
            const productsCount = await Product.countDocuments({ vendor: vendor._id, isActive: true });
            return {
                id: vendor._id,
                name: vendor.storeName || vendor.name,
                image: vendor.storeLogo || vendor.profileImage || 'https://via.placeholder.com/150',
                bannerImage: vendor.storeBanner || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=1200&h=400',
                followersCount: vendor.followersCount,
                productsCount,
                description: vendor.storeDescription
            };
        }));

        res.status(200).json(vendorsWithStats);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single vendor profile
// @route   GET /api/vendors/:id
// @access  Public
const getVendorProfile = async (req, res) => {
    try {
        const vendor = await User.findById(req.params.id);

        if (!vendor || vendor.role !== 'vendor') {
            return res.status(404).json({ message: 'Vendor not found' });
        }

        const products = await Product.find({ vendor: vendor._id, isActive: true });

        let isFollowing = false;
        if (req.user) {
            const follow = await Follow.findOne({ follower: req.user._id, vendor: vendor._id });
            if (follow) isFollowing = true;
        }

        res.status(200).json({
            vendor: {
                id: vendor._id,
                name: vendor.storeName || vendor.name,
                image: vendor.storeLogo || vendor.profileImage || `https://ui-avatars.com/api/?name=${vendor.name}`,
                coverImage: vendor.storeBanner || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=1200&h=400',
                followersCount: vendor.followersCount,
                location: "Global",
                joined: new Date(vendor.createdAt).toDateString(),
                description: vendor.storeDescription,
                isVerified: true,
                rating: 4.8,
                reviews: 124
            },
            products,
            isFollowing
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Toggle Follow a vendor
// @route   POST /api/vendors/:id/follow
// @access  Private
const toggleFollowVendor = async (req, res) => {
    try {
        const vendorId = req.params.id;
        const followerId = req.user._id;

        if (vendorId === followerId.toString()) {
            return res.status(400).json({ message: "You cannot follow yourself" });
        }

        const existingFollow = await Follow.findOne({ follower: followerId, vendor: vendorId });

        let vendor = await User.findById(vendorId);
        if (!vendor || vendor.role !== 'vendor') {
            return res.status(404).json({ message: "Vendor not found" });
        }

        if (existingFollow) {
            await Follow.findByIdAndDelete(existingFollow._id);
            vendor.followersCount = Math.max(0, vendor.followersCount - 1);
            await User.save(vendor);
            res.status(200).json({ message: "Unfollowed vendor", isFollowing: false, followersCount: vendor.followersCount });
        } else {
            await Follow.create({ follower: followerId, vendor: vendorId });
            vendor.followersCount += 1;
            await User.save(vendor);
            res.status(200).json({ message: "Followed vendor", isFollowing: true, followersCount: vendor.followersCount });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get followers for current vendor
// @route   GET /api/vendors/followers
// @access  Private (Vendor only)
const getMyFollowers = async (req, res) => {
    try {
        const follows = await Follow.find({ vendor: req.user._id });
        res.status(200).json(follows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getTopVendors,
    getVendorProfile,
    toggleFollowVendor,
    getMyFollowers
};
