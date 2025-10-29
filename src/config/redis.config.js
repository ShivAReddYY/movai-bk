const Redis = require('ioredis');

let redisClient;

try {
  redisClient = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    retryStrategy: (times) => {
      if (times > 3) {
        console.log('⚠️  Redis connection failed, using in-memory fallback');
        return null;
      }
      return Math.min(times * 50, 2000);
    },
    maxRetriesPerRequest: 3,
    lazyConnect: true
  });

  redisClient.on('error', (err) => {
    console.error('❌ Redis Client Error:', err.message);
  });

  redisClient.on('connect', () => {
    console.log('✅ Redis Client Connected');
  });

  // Try to connect
  redisClient.connect().catch(() => {
    console.log('⚠️  Redis not available, some features may be limited');
  });

} catch (error) {
  console.log('⚠️  Redis not configured, using in-memory fallback');
  // Create a mock redis client for development
  redisClient = {
    ping: async () => { throw new Error('Redis not available'); },
    set: async () => {},
    get: async () => null,
    del: async () => {},
    quit: async () => {}
  };
}

module.exports = { redisClient };
