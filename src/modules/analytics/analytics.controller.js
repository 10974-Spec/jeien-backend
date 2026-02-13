const Analytics = require('./analytics.model');
const Product = require('../products/product.model');

// Track event
const trackEvent = async (req, res) => {
    try {
        const { sessionId, type, data = {}, userId = null } = req.body;

        if (!sessionId || !type) {
            return res.status(400).json({
                success: false,
                message: 'Session ID and event type are required'
            });
        }

        // Get session info from request
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'] || 'Unknown';
        const referrer = req.headers.referer || req.headers.referrer || '';

        // Detect device and browser
        const device = detectDevice(userAgent);
        const browser = detectBrowser(userAgent);

        // Find or create analytics session
        let session = await Analytics.findOne({ sessionId });

        if (!session) {
            // Create new session
            session = new Analytics({
                sessionId,
                userId,
                ipAddress,
                userAgent,
                referrer,
                landingPage: data.page || '/',
                device,
                browser,
                events: []
            });
        }

        // Add event
        await session.addEvent(type, data);

        res.json({
            success: true,
            message: 'Event tracked successfully'
        });
    } catch (error) {
        console.error('Track event error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to track event',
            error: error.message
        });
    }
};

// Get analytics overview
const getOverview = async (req, res) => {
    try {
        const { period = '7d' } = req.query;
        const startDate = getStartDate(period);

        // Total visits
        const totalVisits = await Analytics.countDocuments({
            createdAt: { $gte: startDate }
        });

        // Total page views
        const pageViews = await Analytics.aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            { $unwind: '$events' },
            { $match: { 'events.type': 'PAGE_VIEW' } },
            { $count: 'total' }
        ]);

        // Total product views
        const productViews = await Analytics.aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            { $unwind: '$events' },
            { $match: { 'events.type': 'PRODUCT_VIEW' } },
            { $count: 'total' }
        ]);

        // Total purchases
        const purchases = await Analytics.aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            { $unwind: '$events' },
            { $match: { 'events.type': 'PURCHASE' } },
            { $count: 'total' }
        ]);

        // Conversion rate
        const conversionRate = totalVisits > 0
            ? ((purchases[0]?.total || 0) / totalVisits * 100).toFixed(2)
            : 0;

        // Average session duration
        const avgDuration = await Analytics.aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            { $group: { _id: null, avgDuration: { $avg: '$duration' } } }
        ]);

        // Active visitors (last 5 minutes)
        const activeVisitors = await Analytics.getActiveSessions();

        res.json({
            success: true,
            data: {
                totalVisits,
                pageViews: pageViews[0]?.total || 0,
                productViews: productViews[0]?.total || 0,
                purchases: purchases[0]?.total || 0,
                conversionRate: parseFloat(conversionRate),
                avgDuration: Math.round(avgDuration[0]?.avgDuration || 0),
                activeVisitors
            }
        });
    } catch (error) {
        console.error('Get overview error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get overview',
            error: error.message
        });
    }
};

// Get visit statistics
const getVisitStats = async (req, res) => {
    try {
        const { period = '7d' } = req.query;
        const startDate = getStartDate(period);

        const stats = await Analytics.aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
                    },
                    visits: { $sum: 1 },
                    uniqueUsers: { $addToSet: '$userId' }
                }
            },
            { $sort: { _id: 1 } },
            {
                $project: {
                    date: '$_id',
                    visits: 1,
                    uniqueUsers: { $size: '$uniqueUsers' },
                    _id: 0
                }
            }
        ]);

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Get visit stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get visit stats',
            error: error.message
        });
    }
};

// Get top viewed products
const getProductViews = async (req, res) => {
    try {
        const { period = '7d', limit = 10 } = req.query;
        const startDate = getStartDate(period);

        const topProducts = await Analytics.aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            { $unwind: '$events' },
            { $match: { 'events.type': 'PRODUCT_VIEW' } },
            {
                $group: {
                    _id: '$events.data.productId',
                    views: { $sum: 1 },
                    title: { $first: '$events.data.title' }
                }
            },
            { $sort: { views: -1 } },
            { $limit: parseInt(limit) }
        ]);

        // Populate product details
        const productIds = topProducts.map(p => p._id).filter(id => id);
        const products = await Product.find({ _id: { $in: productIds } })
            .select('title price images');

        const enrichedProducts = topProducts.map(p => {
            const product = products.find(prod => prod._id.toString() === p._id);
            return {
                productId: p._id,
                views: p.views,
                title: product?.title || p.title || 'Unknown Product',
                price: product?.price || 0,
                image: product?.images?.[0] || null
            };
        });

        res.json({
            success: true,
            data: enrichedProducts
        });
    } catch (error) {
        console.error('Get product views error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get product views',
            error: error.message
        });
    }
};

// Get top pages
const getTopPages = async (req, res) => {
    try {
        const { period = '7d', limit = 10 } = req.query;
        const startDate = getStartDate(period);

        const topPages = await Analytics.aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            { $unwind: '$events' },
            { $match: { 'events.type': 'PAGE_VIEW' } },
            {
                $group: {
                    _id: '$events.data.page',
                    views: { $sum: 1 },
                    title: { $first: '$events.data.title' }
                }
            },
            { $sort: { views: -1 } },
            { $limit: parseInt(limit) },
            {
                $project: {
                    page: '$_id',
                    views: 1,
                    title: 1,
                    _id: 0
                }
            }
        ]);

        res.json({
            success: true,
            data: topPages
        });
    } catch (error) {
        console.error('Get top pages error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get top pages',
            error: error.message
        });
    }
};

// Get device breakdown
const getDeviceBreakdown = async (req, res) => {
    try {
        const { period = '7d' } = req.query;
        const startDate = getStartDate(period);

        const breakdown = await Analytics.aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            {
                $group: {
                    _id: '$device',
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    device: '$_id',
                    count: 1,
                    _id: 0
                }
            }
        ]);

        res.json({
            success: true,
            data: breakdown
        });
    } catch (error) {
        console.error('Get device breakdown error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get device breakdown',
            error: error.message
        });
    }
};

// Get realtime visitors
const getRealtimeVisitors = async (req, res) => {
    try {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

        const visitors = await Analytics.find({
            lastActivity: { $gte: fiveMinutesAgo }
        })
            .select('sessionId userId device browser lastActivity events')
            .populate('userId', 'name email')
            .sort({ lastActivity: -1 })
            .limit(50);

        const formatted = visitors.map(v => ({
            sessionId: v.sessionId,
            user: v.userId ? {
                name: v.userId.name,
                email: v.userId.email
            } : { name: 'Guest', email: null },
            device: v.device,
            browser: v.browser,
            lastActivity: v.lastActivity,
            currentPage: v.events[v.events.length - 1]?.data?.page || '/'
        }));

        res.json({
            success: true,
            data: {
                count: formatted.length,
                visitors: formatted
            }
        });
    } catch (error) {
        console.error('Get realtime visitors error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get realtime visitors',
            error: error.message
        });
    }
};

// Helper functions
const getStartDate = (period) => {
    const now = new Date();
    switch (period) {
        case '24h':
            return new Date(now - 24 * 60 * 60 * 1000);
        case '7d':
            return new Date(now - 7 * 24 * 60 * 60 * 1000);
        case '30d':
            return new Date(now - 30 * 24 * 60 * 60 * 1000);
        case '90d':
            return new Date(now - 90 * 24 * 60 * 60 * 1000);
        default:
            return new Date(now - 7 * 24 * 60 * 60 * 1000);
    }
};

const detectDevice = (userAgent) => {
    if (/mobile/i.test(userAgent)) return 'Mobile';
    if (/tablet|ipad/i.test(userAgent)) return 'Tablet';
    return 'Desktop';
};

const detectBrowser = (userAgent) => {
    if (/chrome/i.test(userAgent)) return 'Chrome';
    if (/firefox/i.test(userAgent)) return 'Firefox';
    if (/safari/i.test(userAgent)) return 'Safari';
    if (/edge/i.test(userAgent)) return 'Edge';
    if (/opera/i.test(userAgent)) return 'Opera';
    return 'Unknown';
};

module.exports = {
    trackEvent,
    getOverview,
    getVisitStats,
    getProductViews,
    getTopPages,
    getDeviceBreakdown,
    getRealtimeVisitors
};
