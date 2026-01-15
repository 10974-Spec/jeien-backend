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
  path.resolve(__dirname, envFile)
];

let envLoaded = false;
for (const envPath of envPaths) {
  try {
    dotenv.config({ path: envPath });
    if (process.env.MONGODB_URI) {
      console.log(`✅ Environment loaded from: ${envPath}`);
      envLoaded = true;
      break;
    }
  } catch (error) {
    // Continue to next path
  }
}

// If no env file found, try to load from root
if (!envLoaded) {
  try {
    dotenv.config({ path: path.resolve(process.cwd(), '.env') });
    if (process.env.MONGODB_URI) {
      console.log('✅ Environment loaded from root .env file');
      envLoaded = true;
    }
  } catch (error) {
    // Continue
  }
}

// Configuration object
const config = {
  // Server
  NODE_ENV: NODE_ENV,
  PORT: parseInt(process.env.PORT) || 5000,
  
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
  
  // Frontend URL - FIXED THE TYPO
  FRONTEND_URL: process.env.FRONTEND_URL || (NODE_ENV === 'production' ? 'https://www.jeien.com' : 'http://localhost:3000'),
  
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
  
  // Rate limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 200,
  
  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || (NODE_ENV === 'production' ? 'info' : 'debug'),
  LOG_REQUEST_BODY: process.env.LOG_REQUEST_BODY === 'true',
  PERFORMANCE_MONITORING: process.env.PERFORMANCE_MONITORING === 'true',
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
  console.error('❌ Missing required environment variables:', missingVars);
  console.error(`ℹ️  Please check your environment configuration`);
  console.error(`ℹ️  NODE_ENV: ${NODE_ENV}`);
  console.error(`ℹ️  Current working directory: ${process.cwd()}`);
  
  // Try to help with common issues
  if (!process.env.MONGODB_URI) {
    console.error('\n💡 MONGODB_URI is required. Example:');
    console.error('MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/jeien?retryWrites=true&w=majority');
  }
  
  if (!process.env.JWT_SECRET) {
    console.error('\n💡 JWT_SECRET is required. Generate one with:');
    console.error('node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  }
  
  process.exit(1);
}

// Log loaded environment (except secrets)
console.log('✅ Configuration loaded:', {
  NODE_ENV: config.NODE_ENV,
  PORT: config.PORT,
  FRONTEND_URL: config.FRONTEND_URL,
  DB_CONNECTED: !!config.MONGODB_URI,
  CLOUDINARY_CONNECTED: !!config.CLOUDINARY_CLOUD_NAME,
  NODE_ENV_FILE: envFile
});

module.exports = config;