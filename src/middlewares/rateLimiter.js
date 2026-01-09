// middlewares/rateLimiter.js
const rateLimit = require('express-rate-limit');

// Use built-in memory store (no external dependencies needed)
const MemoryStore = rateLimit.MemoryStore;

// Common rate limit options
const createLimiter = (options) => {
  return rateLimit({
    store: new MemoryStore(),
    windowMs: options.windowMs,
    max: options.max,
    message: {
      success: false,
      message: options.message || 'Too many requests, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    skip: (req) => {
      // Skip rate limiting for health checks and OPTIONS requests
      return req.path === '/health' || req.method === 'OPTIONS';
    },
    keyGenerator: (req) => {
      // Use API key if present, otherwise use IP
      return req.headers['x-api-key'] || req.ip;
    },
    ...options
  });
};

// General API rate limiter - Very strict for free tier
const apiLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes per IP/API key
  message: 'Too many requests from this IP, please try again after 15 minutes'
});

// Stricter limiter for auth routes
const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 minutes
  message: 'Too many login attempts, please try again after 15 minutes'
});

// More lenient limiter for public endpoints
const publicLimiter = createLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: 'Too many requests, please slow down'
});

// Very strict limiter for expensive operations
const strictLimiter = createLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: 'Too many requests to this endpoint'
});

// Special limiter for product listings
const productListLimiter = createLimiter({
  windowMs: 30 * 1000, // 30 seconds
  max: 15, // 15 requests per 30 seconds
  message: 'Too many product requests, please slow down'
});

// Upload limiter
const uploadLimiter = createLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // 5 uploads per 5 minutes
  message: 'Too many uploads, please try again later'
});

// Search limiter
const searchLimiter = createLimiter({
  windowMs: 10 * 1000, // 10 seconds
  max: 10, // 10 searches per 10 seconds
  message: 'Too many search requests'
});

module.exports = {
  apiLimiter,
  authLimiter,
  publicLimiter,
  strictLimiter,
  productListLimiter,
  uploadLimiter,
  searchLimiter,
  createLimiter
};