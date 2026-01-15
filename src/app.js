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
const errorMiddleware = require('./middlewares/error.middleware');

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration - COMPLETELY FIXED!
const allowedOrigins = [
  'http://localhost:5173', // Vite dev server
  'http://localhost:3000', // Create React App dev server
  'https://jeien.com',
  'https://www.jeien.com',
  'https://jeien-backend.onrender.com',
  'http://localhost:5000' // Backend itself
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      console.error('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  exposedHeaders: [
    'X-RateLimit-Limit', 
    'X-RateLimit-Remaining', 
    'X-RateLimit-Reset',
    'X-Request-ID'
  ],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-API-Key',
    'X-Request-ID',
    'X-Client',          // ADDED THIS
    'X-Client-Version'   // ADDED THIS
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
};

// Apply CORS globally
app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

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
    // Skip rate limiting for health checks
    return req.path === '/api/health' || req.method === 'OPTIONS';
  }
});

app.use('/api', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] || Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  req.requestId = requestId;
  
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  console.log(`  Origin: ${req.headers.origin || 'none'}`);
  console.log(`  Headers:`, req.headers);
  
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
    cors: {
      allowedOrigins: allowedOrigins,
      clientOrigin: req.headers.origin || 'none',
      headers: req.headers
    }
  });
});

// CORS test endpoint - VERY IMPORTANT!
app.get('/api/cors-test', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'CORS test successful!',
    timestamp: new Date().toISOString(),
    clientInfo: {
      origin: req.headers.origin,
      userAgent: req.headers['user-agent'],
      requestId: req.requestId,
      headers: req.headers
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
    });
  });
  
  // Test login endpoint (for debugging)
  app.post('/api/auth/test-login', (req, res) => {
    console.log('Test login attempt:', req.body);
    res.json({
      success: true,
      message: 'Test login endpoint working',
      data: req.body,
      timestamp: new Date().toISOString()
    });
  });
}

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint ${req.originalUrl} not found`,
    timestamp: new Date().toISOString(),
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