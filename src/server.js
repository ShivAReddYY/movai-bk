require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const passport = require('passport');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Import configs
const { corsOptions } = require('./config/app.config');
const { redisClient } = require('./config/redis.config');

// Import middleware
const { errorHandler } = require('./shared/middleware/error.middleware');

// Import routes
const authRoutes = require('./modules/auth/auth.routes');
const scriptsRoutes = require('./modules/scripts/script.routes');
const aiRoutes = require('./modules/ai/ai.routes'); // ✅ CORRECT PATH
const scenesRoutes = require('./modules/scenes/scenes.routes');
const charactersRoutes = require('./modules/characters/characters.routes');
const analyzerRoutes = require('./modules/analyzer/analyzer.routes');
const collaborationRoutes = require('./modules/collaboration/collaboration.routes');
const commentsRoutes = require('./modules/comments/comments.routes');
const tasksRoutes = require('./modules/tasks/tasks.routes');
const exportRoutes = require('./modules/export/export.routes');

// Import Socket.IO gateway
//const { initializeSocketIO } = require('./modules/collaboration/socket.gateway');

// Initialize Express
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling']
});

// Initialize Socket handlers
//initializeSocketIO(io);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(limiter);
app.use(passport.initialize());

// Serve static files (uploaded files)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Passport strategies
require('./modules/auth/strategies/jwt.strategy');
require('./modules/auth/strategies/google.strategy');

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes (Modular)
app.use('/api/auth', authRoutes);
app.use('/api/scripts', scriptsRoutes);
app.use('/api/ai', aiRoutes); // ✅ CORRECT - Using imported variable
// app.use('/api/scenes', scenesRoutes);
// app.use('/api/characters', charactersRoutes);
// app.use('/api/analyzer', analyzerRoutes);
// app.use('/api/collaboration', collaborationRoutes);
// app.use('/api/comments', commentsRoutes);
// app.use('/api/tasks', tasksRoutes);
// app.use('/api/export', exportRoutes);

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;

server.listen(PORT, async () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 MovAI Backend Server');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 API URL: ${process.env.API_URL || 'http://localhost:5000'}`);
  console.log(`📁 Upload directory: ${process.env.UPLOAD_DIR || './uploads'}`);
  console.log('');
  console.log('📋 Available Routes:');
  console.log('   - POST   /api/auth/register');
  console.log('   - POST   /api/auth/login');
  console.log('   - POST   /api/scripts/upload');
  console.log('   - GET    /api/scripts');
  console.log('   - POST   /api/ai/generate/video');
  console.log('   - POST   /api/ai/generate/image');
  console.log('   - GET    /api/ai/test');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Test Redis connection (optional)
  try {
    await redisClient.ping();
    console.log('✅ Redis connected');
  } catch (error) {
    console.log('⚠️  Redis not available (using in-memory fallback)');
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(async () => {
    try {
      await redisClient.quit();
    } catch {}
    process.exit(0);
  });
});

module.exports = { app, server, io };
