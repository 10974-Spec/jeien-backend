const dotenv = require('dotenv');
const path = require('path');

// Determine environment
const NODE_ENV = process.env.NODE_ENV || 'development';

// Load environment variables based on NODE_ENV
let envFile = '.env';
if (NODE_ENV === 'production') {
  envFile = '.env.production';
} else if (NODE_ENV === 'test') {
  envFile = '.env.test';
}

// Try to load from different locations
const envPaths = [
  path.resolve(__dirname, '../../', envFile),
  path.resolve(__dirname, '../', envFile),
  path.resolve(__dirname, envFile),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '.env.production'),
  path.resolve(process.cwd(), '.env.development')
];

let envLoaded = false;
let loadedFrom = '';
for (const envPath of envPaths) {
  try {
    if (require('fs').existsSync(envPath)) {
      dotenv.config({ path: envPath });
      if (process.env.MONGODB_URI) {
        console.log(`✅ Environment loaded from: ${envPath}`);
        envLoaded = true;
        loadedFrom = envPath;
        break;
      }
    }
  } catch (error) {
    // Continue to next path
  }
}

// Configuration object
const config = {
  // Server
  NODE_ENV: NODE_ENV,
  PORT: parseInt(process.env.PORT) || 10000,

  // Database
  MONGODB_URI: process.env.MONGODB_URI,

  // JWT
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRE: process.env.JWT_EXPIRE || '7d',
  JWT_COOKIE_EXPIRE: parseInt(process.env.JWT_COOKIE_EXPIRE) || 7,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + '_REFRESH',
  JWT_REFRESH_EXPIRE: process.env.JWT_REFRESH_EXPIRE || '30d',

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,

  // CORS Configuration - CRITICAL FIX
  FRONTEND_URL: process.env.FRONTEND_URL ||
    (NODE_ENV === 'production' ? 'https://www.jeien.com' : 'http://localhost:5173'),

  // Allowed Origins for CORS - This is what fixes your issue!
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ?
    process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()) :
    [
      'http://localhost:5173',     // Vite development server
      'http://localhost:5174',     // Vite development server (fallback port)
      'http://localhost:3000',     // Create React App development server
      'http://localhost:5000',     // Backend itself
      'https://jeien.com',
      'https://www.jeien.com',
      'https://jeien-backend.onrender.com',
      'https://jeien-frontend.onrender.com',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5000'
    ],

  // Optional services
  REDIS_URL: process.env.REDIS_URL,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,

  // Email (optional)
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: parseInt(process.env.SMTP_PORT) || 587,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  EMAIL_FROM: process.env.EMAIL_FROM || 'noreply@jeien.com',

  // Session
  SESSION_SECRET: process.env.SESSION_SECRET || process.env.JWT_SECRET,

  // Rate limiting - More generous for development
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || (NODE_ENV === 'production' ? 900000 : 60000), // 15 min prod, 1 min dev
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || (NODE_ENV === 'production' ? 200 : 1000),

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || (NODE_ENV === 'production' ? 'info' : 'debug'),
  LOG_REQUEST_BODY: process.env.LOG_REQUEST_BODY === 'true',
  PERFORMANCE_MONITORING: process.env.PERFORMANCE_MONITORING === 'true',

  // API
  API_VERSION: process.env.API_VERSION || 'v1',
  API_PREFIX: process.env.API_PREFIX || '/api',

  // File uploads
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
  MAX_FILES: parseInt(process.env.MAX_FILES) || 10,

  // Security
  PASSWORD_SALT_ROUNDS: parseInt(process.env.PASSWORD_SALT_ROUNDS) || 10,
  SESSION_TIMEOUT: parseInt(process.env.SESSION_TIMEOUT) || 24 * 60 * 60 * 1000, // 24 hours
};

// Required environment variables check
const requiredEnvVars = [
  'MONGODB_URI',
  'JWT_SECRET',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET'
];

const missingVars = requiredEnvVars.filter(envVar => !config[envVar]);

if (missingVars.length > 0) {
  console.error('\n❌ MISSING REQUIRED ENVIRONMENT VARIABLES ❌');
  console.error('==========================================');
  console.error('Missing variables:', missingVars);
  console.error(`Environment: ${NODE_ENV}`);
  console.error(`Loaded from: ${loadedFrom || 'No .env file found'}`);
  console.error(`Current directory: ${process.cwd()}`);

  console.error('\n💡 TROUBLESHOOTING TIPS:');

  if (!process.env.MONGODB_URI) {
    console.error('\n1. MONGODB_URI is missing!');
    console.error('   For local development: mongodb://localhost:27017/jeien');
    console.error('   For MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/jeien?retryWrites=true&w=majority');
  }

  if (!process.env.JWT_SECRET) {
    console.error('\n2. JWT_SECRET is missing!');
    console.error('   Generate one with this command:');
    console.error('   node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  }

  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    console.error('\n3. Cloudinary credentials missing!');
    console.error('   Sign up at https://cloudinary.com and get your credentials');
  }

  console.error('\n📁 Expected .env file locations:');
  envPaths.forEach(path => console.error(`   - ${path}`));

  console.error('\n🔧 Quick fix for Render.com:');
  console.error('   Add these environment variables in Render dashboard:');
  console.error('   - MONGODB_URI');
  console.error('   - JWT_SECRET');
  console.error('   - CLOUDINARY_CLOUD_NAME');
  console.error('   - CLOUDINARY_API_KEY');
  console.error('   - CLOUDINARY_API_SECRET');
  console.error('   - FRONTEND_URL (optional)');
  console.error('   - ALLOWED_ORIGINS (optional)');

  console.error('\n🚀 Starting with defaults for development...');

  // For development, set some defaults
  if (NODE_ENV === 'development') {
    console.error('\n⚠️  Using development defaults (not for production!)');
    config.MONGODB_URI = config.MONGODB_URI || 'mongodb://localhost:27017/jeien_dev';
    config.JWT_SECRET = config.JWT_SECRET || 'dev_jwt_secret_change_in_production';
    config.CLOUDINARY_CLOUD_NAME = config.CLOUDINARY_CLOUD_NAME || 'dev_cloud';
    config.CLOUDINARY_API_KEY = config.CLOUDINARY_API_KEY || 'dev_key';
    config.CLOUDINARY_API_SECRET = config.CLOUDINARY_API_SECRET || 'dev_secret';

    missingVars.length = 0; // Clear missing vars since we set defaults
  } else {
    // In production, exit if required vars are missing
    process.exit(1);
  }
}

// Log loaded configuration (safely, without secrets)
console.log('\n✅ CONFIGURATION LOADED');
console.log('=====================');
console.log(`Environment: ${config.NODE_ENV}`);
console.log(`Port: ${config.PORT}`);
console.log(`Frontend URL: ${config.FRONTEND_URL}`);
console.log(`API Prefix: ${config.API_PREFIX}`);
console.log(`Database: ${config.MONGODB_URI ? 'Configured' : 'Missing'}`);
console.log(`Cloudinary: ${config.CLOUDINARY_CLOUD_NAME ? 'Configured' : 'Missing'}`);
console.log(`JWT: ${config.JWT_SECRET ? 'Configured' : 'Missing'}`);
console.log(`CORS Origins: ${config.ALLOWED_ORIGINS.length} origins configured`);
console.log(`Loaded from: ${loadedFrom || 'Environment variables'}`);

// Log CORS origins for debugging
if (config.NODE_ENV === 'development') {
  console.log('\n🔍 CORS Origins:');
  config.ALLOWED_ORIGINS.forEach(origin => {
    console.log(`   - ${origin}`);
  });
}

// Validate MongoDB URI format
if (config.MONGODB_URI) {
  const mongoRegex = /^mongodb(\+srv)?:\/\/.+/;
  if (!mongoRegex.test(config.MONGODB_URI)) {
    console.error('\n⚠️  WARNING: MongoDB URI format looks incorrect');
    console.error(`   URI: ${config.MONGODB_URI.substring(0, 50)}...`);
  }
}

// Validate JWT secret length
if (config.JWT_SECRET && config.JWT_SECRET.length < 32) {
  console.error('\n⚠️  WARNING: JWT_SECRET is too short (minimum 32 characters recommended)');
  console.error(`   Length: ${config.JWT_SECRET.length} characters`);
}

// Export configuration
module.exports = config;