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

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for React, configure properly in production
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
const corsOptions = {
  origin: config.FRONTEND_URL,
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
    uptime: process.uptime(),
  });
});

// API root endpoint
app.get('/api', (req, res) => {
  res.json({
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
      '/api/health'
    ]
  });
});

// ========== REACT FRONTEND SERVING ==========
if (config.NODE_ENV === 'production') {
  // Serve static files from React build directory
  const clientBuildPath = path.join(__dirname, '../client/build');
  
  // Check if client build exists
  const fs = require('fs');
  if (fs.existsSync(clientBuildPath)) {
    console.log('✅ Serving React app from:', clientBuildPath);
    app.use(express.static(clientBuildPath));
    
    // Handle React routing - return index.html for all non-API routes
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(clientBuildPath, 'index.html'));
      }
    });
  } else {
    console.warn('⚠️  React build not found at:', clientBuildPath);
    console.warn('⚠️  Run: cd client && npm run build');
    
    // Fallback message for missing React build
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api')) {
        res.status(200).send(`
          <html>
            <head><title>E-commerce Platform</title></head>
            <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
              <h1>E-commerce Platform Backend</h1>
              <p>React frontend is not built yet.</p>
              <p>To build the frontend, run: <code>cd client && npm run build</code></p>
              <p>API is available at: <a href="/api">/api</a></p>
              <p>Health check: <a href="/api/health">/api/health</a></p>
            </body>
          </html>
        `);
      }
    });
  }
} else {
  // Development mode - provide info message
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.status(200).json({
        message: 'Development Server',
        note: 'React app should be running separately on port 3000',
        api: 'Available at /api',
        frontend: 'Run: cd client && npm start',
        timestamp: new Date().toISOString(),
      });
    }
  });
}

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint ${req.originalUrl} not found`,
    timestamp: new Date().toISOString(),
  });
});

// Error middleware (should be last)
app.use(errorMiddleware);

module.exports = app;