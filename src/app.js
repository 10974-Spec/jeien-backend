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

// Security middleware - Configure Helmet properly
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", config.FRONTEND_URL],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration - More permissive for development
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      config.FRONTEND_URL,
      'http://localhost:3000',
      'http://localhost:5000',
      'https://jeien.onrender.com',
      'https://www.jeien.com'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset']
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting - Moved after CORS and body parsing
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Increased from 100 to 200
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/api/health' || req.path === '/health';
  }
});

app.use('/api', limiter);

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
    nodeVersion: process.version
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
    app.use(express.static(clientBuildPath, {
      maxAge: '1d', // Cache static assets
      setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      }
    }));
    
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
            <head>
              <title>E-commerce Platform</title>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body {
                  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  color: white;
                  min-height: 100vh;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  padding: 20px;
                }
                .container {
                  background: rgba(255, 255, 255, 0.1);
                  backdrop-filter: blur(10px);
                  padding: 40px;
                  border-radius: 20px;
                  max-width: 600px;
                  text-align: center;
                  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                }
                h1 {
                  margin-bottom: 20px;
                  font-size: 2.5rem;
                }
                .card {
                  background: rgba(255, 255, 255, 0.15);
                  padding: 20px;
                  border-radius: 10px;
                  margin: 20px 0;
                }
                code {
                  background: rgba(0, 0, 0, 0.3);
                  padding: 10px 15px;
                  border-radius: 5px;
                  display: block;
                  margin: 10px 0;
                  font-family: 'Courier New', monospace;
                }
                a {
                  color: #ffdd40;
                  text-decoration: none;
                  font-weight: bold;
                }
                a:hover {
                  text-decoration: underline;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>🚀 E-commerce Platform Backend</h1>
                <div class="card">
                  <p><strong>React frontend is not built yet.</strong></p>
                  <p>To build the frontend, run:</p>
                  <code>cd client && npm run build</code>
                </div>
                <div class="card">
                  <p><strong>API Endpoints:</strong></p>
                  <p>📊 API Status: <a href="/api">/api</a></p>
                  <p>❤️ Health Check: <a href="/api/health">/api/health</a></p>
                </div>
              </div>
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
        success: true,
        message: 'Development Server',
        note: 'React app should be running separately on port 3000',
        api: {
          root: '/api',
          health: '/api/health'
        },
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