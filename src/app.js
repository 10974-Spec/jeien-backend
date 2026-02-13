const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const config = require('./config/env');

// Route imports
const authRoutes = require('./modules/auth/auth.routes');
const userRoutes = require('./modules/users/user.routes');
const vendorRoutes = require('./modules/vendors/vendor.routes');
const categoryRoutes = require('./modules/categories/category.routes');
const productRoutes = require('./modules/products/product.routes');
const orderRoutes = require('./modules/orders/order.routes');
const paymentRoutes = require('./modules/payments/payment.routes');
const adRoutes = require('./modules/ads/ad.routes');
const reviewRoutes = require('./modules/reviews/review.routes');
const settingsRoutes = require('./modules/settings/settings.routes');
const messageRoutes = require('./modules/messages/message.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const notificationRoutes = require('./modules/notifications/notification.routes');
const analyticsRoutes = require('./modules/analytics/analytics.routes');
const errorMiddleware = require('./middlewares/error.middleware');

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration - FIXED VERSION
const allowedOrigins = [
  'http://localhost:5173', // Vite dev server
  'http://localhost:3000', // Create React App dev server
  'https://jeien.com',
  'https://www.jeien.com',
  'https://jeien-backend.onrender.com',
  'http://localhost:5000' // Backend itself
];

// IMPORTANT: Create a custom CORS middleware to handle preflight properly
app.use((req, res, next) => {
  const origin = req.headers.origin;

  // Check if origin is allowed
  if (!origin || allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Expose-Headers', [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'X-Request-ID',
      'X-Request-Id'  // Add lowercase version too
    ].join(', '));

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.header('Access-Control-Allow-Headers', [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-API-Key',
        'X-Request-ID',
        'X-Request-Id',  // Add lowercase version
        'x-request-id',  // Add lowercase version explicitly
        'x-client',      // Add lowercase versions
        'x-client-version',
        'X-Client',
        'X-Client-Version'
      ].join(', '));
      res.header('Access-Control-Max-Age', '86400'); // 24 hours
      return res.status(200).end();
    }
  } else if (process.env.NODE_ENV === 'production') {
    console.error('CORS blocked origin:', origin);
    return res.status(403).json({
      success: false,
      message: 'Not allowed by CORS'
    });
  }

  next();
});

// Rate limiting - reduced for development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Increased limit
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks and preflight
    return req.path === '/api/health' || req.method === 'OPTIONS';
  }
});

app.use('/api', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  // Generate request ID if not present
  const requestId = req.headers['x-request-id'] ||
    req.headers['X-Request-ID'] ||
    req.headers['X-Request-Id'] ||
    Date.now() + '-' + Math.random().toString(36).substr(2, 9);

  req.requestId = requestId;

  // Add request ID to response headers (both cases for compatibility)
  res.header('X-Request-ID', requestId);
  res.header('X-Request-Id', requestId);
  res.header('x-request-id', requestId);

  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl} [${requestId}]`);
  console.log(`  Origin: ${req.headers.origin || 'none'}`);
  console.log(`  User-Agent: ${req.headers['user-agent']?.substring(0, 50)}...`);

  if (req.method === 'POST' || req.method === 'PUT') {
    console.log('  Body:', JSON.stringify(req.body).substring(0, 200));
  }

  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/ads', adRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    nodeVersion: process.version,
    requestId: req.requestId,
    cors: {
      allowedOrigins: allowedOrigins,
      clientOrigin: req.headers.origin || 'none',
      method: req.method,
      headers: {
        'x-request-id': req.headers['x-request-id'],
        'X-Request-ID': req.headers['X-Request-ID']
      }
    }
  });
});

// CORS test endpoint - VERY IMPORTANT!
app.get('/api/cors-test', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'CORS test successful!',
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
    clientInfo: {
      origin: req.headers.origin,
      userAgent: req.headers['user-agent'],
      requestHeaders: {
        'x-request-id': req.headers['x-request-id'],
        'X-Request-ID': req.headers['X-Request-ID'],
        'x-client': req.headers['x-client'],
        'x-client-version': req.headers['x-client-version']
      }
    },
    serverInfo: {
      allowedOrigins: allowedOrigins,
      environment: config.NODE_ENV,
      serverTime: new Date().toISOString()
    }
  });
});

// API root endpoint
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'E-commerce API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
    endpoints: [
      '/api/auth',
      '/api/users',
      '/api/vendors',
      '/api/categories',
      '/api/products',
      '/api/orders',
      '/api/payments',
      '/api/ads',
      '/api/reviews',
      '/api/health',
      '/api/cors-test'
    ]
  });
});

// ========== REACT FRONTEND SERVING ==========
if (config.NODE_ENV === 'production') {
  const clientBuildPath = path.join(__dirname, '../client/build');
  const fs = require('fs');

  if (fs.existsSync(clientBuildPath)) {
    console.log('✅ Serving React app from:', clientBuildPath);
    app.use(express.static(clientBuildPath));

    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(clientBuildPath, 'index.html'));
      }
    });
  }
} else {
  // Development mode - helpful root endpoint
  app.get('/', (req, res) => {
    res.json({
      success: true,
      message: 'Development Backend Server',
      note: 'React frontend should be running separately on port 5173',
      api: {
        root: '/api',
        health: '/api/health',
        corsTest: '/api/cors-test',
        auth: {
          login: 'POST /api/auth/login',
          register: 'POST /api/auth/register'
        }
      },
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
    });
  });

  // Test login endpoint (for debugging)
  app.post('/api/auth/test-login', (req, res) => {
    console.log('Test login attempt:', req.body);
    res.json({
      success: true,
      message: 'Test login endpoint working',
      data: req.body,
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
    });
  });
}

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint ${req.originalUrl} not found`,
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
    availableEndpoints: [
      '/api/auth/login',
      '/api/auth/register',
      '/api/health',
      '/api/cors-test'
    ]
  });
});

// Error middleware (should be last)
app.use(errorMiddleware);

module.exports = app;