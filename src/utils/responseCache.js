const NodeCache = require('node-cache');

class ResponseCache {
  constructor(ttlSeconds = 300) { // 5 minutes default
    this.cache = new NodeCache({
      stdTTL: ttlSeconds,
      checkperiod: ttlSeconds * 0.2,
      useClones: false
    });
  }

  get(key) {
    return this.cache.get(key);
  }

  set(key, value, ttl = null) {
    if (ttl) {
      this.cache.set(key, value, ttl);
    } else {
      this.cache.set(key, value);
    }
  }

  del(keys) {
    this.cache.del(keys);
  }

  flush() {
    this.cache.flushAll();
  }

  getStats() {
    return this.cache.getStats();
  }

  // Generate cache key from request
  generateKey(req) {
    const { originalUrl, query, body, user } = req;
    const userId = user ? user.id : 'anonymous';
    const key = `${userId}:${originalUrl}:${JSON.stringify(query)}:${JSON.stringify(body)}`;
    return Buffer.from(key).toString('base64');
  }

  // Middleware for caching responses
  middleware(ttl = 300) {
    return (req, res, next) => {
      // Skip caching for non-GET requests
      if (req.method !== 'GET') {
        return next();
      }

      // Skip caching for authenticated endpoints
      if (req.headers.authorization || req.path.includes('/auth/')) {
        return next();
      }

      const key = this.generateKey(req);
      const cachedResponse = this.get(key);

      if (cachedResponse) {
        console.log(`Cache hit: ${req.path}`);
        return res.json(cachedResponse);
      }

      // Store original send function
      const originalSend = res.json;
      
      res.json = function(data) {
        // Cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          this.cache.set(key, data, ttl);
          console.log(`Cache set: ${req.path} (TTL: ${ttl}s)`);
        }
        
        originalSend.call(this, data);
      }.bind(this);

      next();
    };
  }
}

module.exports = new ResponseCache();