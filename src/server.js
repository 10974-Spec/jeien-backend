const mongoose = require('mongoose');
const app = require('./app');
const config = require('./config/env');

const PORT = config.PORT || 5000;

console.log('🚀 Starting server...');
console.log(`📁 Environment: ${config.NODE_ENV}`);
console.log(`🌐 Frontend URL: ${config.FRONTEND_URL}`);
console.log(`🔧 Node version: ${process.version}`);

// Graceful shutdown function
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received, shutting down gracefully...`);

  try {
    // Close server first
    if (server) {
      await new Promise((resolve) => {
        server.close(() => {
          console.log('✅ HTTP server closed.');
          resolve();
        });
      });
    }

    // Then close MongoDB connection
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log('✅ MongoDB connection closed.');
    }

    console.log('✅ All connections closed. Exiting process.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

// MongoDB connection with retry logic
const connectDB = async (retries = 5) => {
  try {
    await mongoose.connect(config.MONGODB_URI);

    console.log('✅ Connected to MongoDB');

    // Connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected. Attempting to reconnect...');
      setTimeout(connectDB, 5000);
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });

  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);

    if (retries > 0) {
      console.log(`🔄 Retrying connection (${retries} attempts left)...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      return connectDB(retries - 1);
    } else {
      console.error('❌ Maximum retries reached. Exiting...');
      process.exit(1);
    }
  }
};

let server;

// Start server function
const startServer = async () => {
  try {
    // Connect to database first
    await connectDB();

    // Start the server
    server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`🔗 Local: http://localhost:${PORT}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🔗 CORS Test: http://localhost:${PORT}/api/cors-test`);
      console.log(`🔗 API: http://localhost:${PORT}/api`);

      if (config.NODE_ENV === 'production') {
        console.log('📱 Serving React frontend from build directory');
      } else {
        console.log('💻 React frontend should run separately on port 5173');
        console.log('\n⚠️  IMPORTANT CORS FIXES APPLIED:');
        console.log('   - Added lowercase "x-request-id" to allowed headers');
        console.log('   - Custom CORS middleware handles preflight properly');
        console.log('   - Both uppercase and lowercase request IDs supported');
      }
    })

    // Start keep-alive cron job (for Render deployment)
    if (config.NODE_ENV === 'production') {
      const keepAlive = require('./utils/keepalive.cron');
      keepAlive.startKeepAlive();
      console.log('✅ Keep-alive cron job started');
    }

    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
        process.exit(1);
      } else {
        console.error('❌ Server error:', error);
      }
    });

    // Server event handlers
    server.on('listening', () => {
      console.log('✅ Server is listening for connections');
    });

    server.on('close', () => {
      console.log('⚠️ Server is closing');
    });

    // Setup shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('💥 Uncaught Exception:', error);
      gracefulShutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('unhandledRejection');
    });

    // Handle exit signals
    process.on('exit', (code) => {
      console.log(`Process exiting with code: ${code}`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the application
startServer();

// Export for testing
module.exports = { app, server };