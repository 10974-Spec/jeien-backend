const NodeCache = require('node-cache');

// Create cache instance with default TTL of 5 minutes
const cache = new NodeCache({
    stdTTL: 300, // 5 minutes default
    checkperiod: 60, // Check for expired keys every 60 seconds
    useClones: false, // Don't clone objects (better performance)
    deleteOnExpire: true
});

// Cache keys constants
const CACHE_KEYS = {
    PRODUCTS_ALL: 'products:all',
    PRODUCTS_FEATURED: 'products:featured',
    PRODUCTS_VENDOR: (vendorId) => `products:vendor:${vendorId}`,
    PRODUCT: (productId) => `product:${productId}`,
    CATEGORIES_ALL: 'categories:all',
    CATEGORY: (categoryId) => `category:${categoryId}`,
    VENDOR: (vendorId) => `vendor:${vendorId}`,
    VENDOR_STORE: (vendorId) => `vendor:store:${vendorId}`,
    ADMIN_STATS: 'admin:stats',
    ORDERS_USER: (userId) => `orders:user:${userId}`,
    SETTINGS_PLATFORM: 'settings:platform',
    SETTINGS_VENDOR: (vendorId) => `settings:vendor:${vendorId}`
};

// TTL configurations (in seconds)
const TTL = {
    SHORT: 120, // 2 minutes
    MEDIUM: 300, // 5 minutes
    LONG: 600, // 10 minutes
    VERY_LONG: 1800 // 30 minutes
};

/**
 * Get value from cache
 * @param {string} key - Cache key
 * @returns {any|null} Cached value or null if not found
 */
const get = (key) => {
    try {
        const value = cache.get(key);
        if (value !== undefined) {
            console.log(`[Cache HIT] ${key}`);
            return value;
        }
        console.log(`[Cache MISS] ${key}`);
        return null;
    } catch (error) {
        console.error(`[Cache ERROR] Failed to get ${key}:`, error.message);
        return null;
    }
};

/**
 * Set value in cache
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttl - Time to live in seconds (optional)
 * @returns {boolean} Success status
 */
const set = (key, value, ttl = null) => {
    try {
        const success = ttl ? cache.set(key, value, ttl) : cache.set(key, value);
        if (success) {
            console.log(`[Cache SET] ${key} (TTL: ${ttl || 'default'}s)`);
        }
        return success;
    } catch (error) {
        console.error(`[Cache ERROR] Failed to set ${key}:`, error.message);
        return false;
    }
};

/**
 * Delete value from cache
 * @param {string} key - Cache key or pattern
 * @returns {number} Number of deleted entries
 */
const del = (key) => {
    try {
        // If key contains wildcard, delete all matching keys
        if (key.includes('*')) {
            const pattern = key.replace(/\*/g, '.*');
            const regex = new RegExp(`^${pattern}$`);
            const keys = cache.keys().filter(k => regex.test(k));
            const count = cache.del(keys);
            console.log(`[Cache DEL] ${count} keys matching ${key}`);
            return count;
        }

        const count = cache.del(key);
        if (count > 0) {
            console.log(`[Cache DEL] ${key}`);
        }
        return count;
    } catch (error) {
        console.error(`[Cache ERROR] Failed to delete ${key}:`, error.message);
        return 0;
    }
};

/**
 * Clear all cache
 * @returns {void}
 */
const flush = () => {
    try {
        cache.flushAll();
        console.log('[Cache FLUSH] All cache cleared');
    } catch (error) {
        console.error('[Cache ERROR] Failed to flush cache:', error.message);
    }
};

/**
 * Get cache statistics
 * @returns {object} Cache stats
 */
const stats = () => {
    try {
        const cacheStats = cache.getStats();
        return {
            keys: cache.keys().length,
            hits: cacheStats.hits,
            misses: cacheStats.misses,
            hitRate: cacheStats.hits / (cacheStats.hits + cacheStats.misses) || 0,
            ksize: cacheStats.ksize,
            vsize: cacheStats.vsize
        };
    } catch (error) {
        console.error('[Cache ERROR] Failed to get stats:', error.message);
        return null;
    }
};

/**
 * Middleware to cache GET requests
 * @param {number} ttl - Time to live in seconds
 * @returns {Function} Express middleware
 */
const cacheMiddleware = (ttl = TTL.MEDIUM) => {
    return (req, res, next) => {
        // Only cache GET requests
        if (req.method !== 'GET') {
            return next();
        }

        const key = `route:${req.originalUrl}`;
        const cachedResponse = get(key);

        if (cachedResponse) {
            return res.json(cachedResponse);
        }

        // Store original json method
        const originalJson = res.json.bind(res);

        // Override json method to cache response
        res.json = (body) => {
            if (res.statusCode === 200) {
                set(key, body, ttl);
            }
            return originalJson(body);
        };

        next();
    };
};

/**
 * Invalidate product-related cache
 */
const invalidateProductCache = () => {
    del('products:*');
    del('product:*');
    console.log('[Cache] Product cache invalidated');
};

/**
 * Invalidate category-related cache
 */
const invalidateCategoryCache = () => {
    del('categories:*');
    del('category:*');
    console.log('[Cache] Category cache invalidated');
};

/**
 * Invalidate vendor-related cache
 */
const invalidateVendorCache = (vendorId = null) => {
    if (vendorId) {
        del(`vendor:${vendorId}`);
        del(`vendor:store:${vendorId}`);
        del(`products:vendor:${vendorId}`);
    } else {
        del('vendor:*');
    }
    console.log('[Cache] Vendor cache invalidated');
};

/**
 * Invalidate order-related cache
 */
const invalidateOrderCache = (userId = null) => {
    if (userId) {
        del(`orders:user:${userId}`);
    } else {
        del('orders:*');
    }
    console.log('[Cache] Order cache invalidated');
};

module.exports = {
    get,
    set,
    del,
    flush,
    stats,
    cacheMiddleware,
    CACHE_KEYS,
    TTL,
    invalidateProductCache,
    invalidateCategoryCache,
    invalidateVendorCache,
    invalidateOrderCache
};
