// const Redis = require('ioredis');

// let redisClient = null;

// if (process.env.REDIS_URL) {
//   redisClient = new Redis(process.env.REDIS_URL, {
//     retryStrategy: (times) => {
//       const delay = Math.min(times * 50, 2000);
//       return delay;
//     },
//     maxRetriesPerRequest: 3,
//     enableReadyCheck: true,
//     lazyConnect: true
//   });

//   redisClient.on('connect', () => {
//     console.log('✅ Connected to Redis');
//   });

//   redisClient.on('error', (err) => {
//     console.error('❌ Redis connection error:', err.message);
//   });

//   redisClient.on('ready', () => {
//     console.log('✅ Redis is ready');
//   });

//   redisClient.on('end', () => {
//     console.log('❌ Redis connection closed');
//   });

//   // Graceful shutdown
//   process.on('SIGTERM', () => {
//     redisClient.quit();
//   });
// } else {
//   console.log('⚠️  Redis not configured, using in-memory rate limiting');
// }

// module.exports = redisClient;