const winston = require('winston');
const morgan = require('morgan');

// Create Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'jeien-api' },
  transports: [
    // Write all logs with level 'error' and below to error.log
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Write all logs with level 'info' and below to combined.log
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880,
      maxFiles: 10
    })
  ]
});

// If we're not in production, also log to console
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Custom Morgan token for request ID
morgan.token('request-id', (req) => {
  return req.id || '-';
});

// Custom Morgan token for response time in ms
morgan.token('response-time-ms', (req, res) => {
  if (!req._startAt || !res._startAt) return '0';
  const ms = (res._startAt[0] - req._startAt[0]) * 1e3 +
    (res._startAt[1] - req._startAt[1]) * 1e-6;
  return ms.toFixed(3);
});

// Create Morgan formats
const morganFormat = process.env.NODE_ENV === 'production' 
  ? ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" - :response-time-ms ms'
  : ':method :url :status :res[content-length] - :response-time-ms ms';

const morganLogger = morgan(morganFormat, {
  stream: {
    write: (message) => {
      logger.info(message.trim());
    }
  },
  skip: (req, res) => {
    // Skip logging for health checks and OPTIONS requests
    return req.path === '/health' || req.method === 'OPTIONS';
  }
});

// Enhanced request logger middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Generate request ID if not present
  if (!req.id) {
    req.id = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }
  
  // Log request details
  const requestLog = {
    requestId: req.id,
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    path: req.path,
    query: req.query,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    referer: req.get('Referer'),
    contentType: req.get('Content-Type'),
    authorization: req.get('Authorization') ? 'present' : 'missing',
    xForwardedFor: req.get('X-Forwarded-For'),
    xRealIp: req.get('X-Real-Ip')
  };

  // Remove sensitive data in production
  if (process.env.NODE_ENV === 'production') {
    delete requestLog.query;
    delete requestLog.userAgent;
  }

  logger.debug('Incoming request', requestLog);

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    const responseLog = {
      requestId: req.id,
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length') || '0',
      contentType: res.get('Content-Type'),
      rateLimitRemaining: res.get('X-RateLimit-Remaining'),
      cacheStatus: res.get('X-Cache') || 'MISS'
    };

    // Categorize logs by status code
    if (res.statusCode >= 500) {
      logger.error('Server error', responseLog);
    } else if (res.statusCode >= 400) {
      logger.warn('Client error', responseLog);
    } else if (res.statusCode >= 300) {
      logger.info('Redirection', responseLog);
    } else if (res.statusCode >= 200) {
      // Only log successful API calls at debug level to reduce noise
      if (req.path.startsWith('/api/')) {
        logger.debug('API response', responseLog);
      }
    }

    // Log slow requests
    if (duration > 1000) {
      logger.warn('Slow request detected', {
        ...responseLog,
        threshold: '1s',
        actualDuration: duration
      });
    }

    // Log 429 responses
    if (res.statusCode === 429) {
      logger.warn('Rate limit exceeded', {
        ...responseLog,
        rateLimitReset: res.get('X-RateLimit-Reset'),
        retryAfter: res.get('Retry-After')
      });
    }
  });

  // Log request errors
  res.on('error', (err) => {
    logger.error('Response error', {
      requestId: req.id,
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  });

  next();
};

// Request body logger (optional, for debugging)
const requestBodyLogger = (req, res, next) => {
  if (process.env.LOG_REQUEST_BODY === 'true' && req.body) {
    const safeBody = { ...req.body };
    
    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'refreshToken', 'creditCard', 'cvv', 'ssn'];
    sensitiveFields.forEach(field => {
      if (safeBody[field]) {
        safeBody[field] = '***REDACTED***';
      }
    });

    logger.debug('Request body', {
      requestId: req.id,
      body: JSON.stringify(safeBody).substring(0, 1000) // Limit size
    });
  }
  next();
};

// Performance monitoring middleware
const performanceMonitor = (req, res, next) => {
  if (process.env.PERFORMANCE_MONITORING === 'true') {
    const start = process.hrtime();
    const startMemory = process.memoryUsage();
    
    res.on('finish', () => {
      const end = process.hrtime(start);
      const endMemory = process.memoryUsage();
      const duration = end[0] * 1000 + end[1] / 1e6; // Convert to ms
      
      const memoryDiff = {
        rss: endMemory.rss - startMemory.rss,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        external: endMemory.external - startMemory.external
      };

      if (duration > 500) { // Log slow operations
        logger.warn('Performance issue', {
          requestId: req.id,
          url: req.url,
          method: req.method,
          duration: `${duration.toFixed(2)}ms`,
          memoryUsage: memoryDiff,
          startMemory,
          endMemory
        });
      }
    });
  }
  next();
};

// Export multiple loggers
module.exports = {
  logger,
  morganLogger,
  requestLogger,
  requestBodyLogger,
  performanceMonitor,
  
  // Helper functions
  logError: (error, context = {}) => {
    logger.error(error.message, {
      ...context,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
  },
  
  logInfo: (message, meta = {}) => {
    logger.info(message, meta);
  },
  
  logWarning: (message, meta = {}) => {
    logger.warn(message, meta);
  },
  
  logDebug: (message, meta = {}) => {
    logger.debug(message, meta);
  },
  
  // Metrics logging
  logMetrics: (metrics) => {
    logger.info('Metrics', metrics);
  },
  
  // Request tracing
  createRequestContext: (req) => {
    return {
      requestId: req.id,
      userId: req.user?._id,
      userEmail: req.user?.email,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      method: req.method,
      url: req.url
    };
  }
};