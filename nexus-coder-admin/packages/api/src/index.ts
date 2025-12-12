/**
 * Nexus Coder Admin API Server
 *
 * Express server for managing models, users, and usage statistics
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import { createRedisClient } from './services/redis.service.js';
import { authRoutes } from './routes/auth.routes.js';
import { modelsRoutes } from './routes/models.routes.js';
import { usageRoutes } from './routes/usage.routes.js';
import { adminRoutes } from './routes/admin.routes.js';

// Load environment variables
import 'dotenv/config';

const app = express();
const PORT = process.env['PORT'] || 3000;

// Initialize Prisma
export const prisma = new PrismaClient();

// Initialize Redis
export const redis = createRedisClient();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env['CORS_ORIGIN'] || '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
});
app.use(limiter);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/auth', authRoutes);
app.use('/models', modelsRoutes);
app.use('/usage', usageRoutes);
app.use('/admin', adminRoutes);

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env['NODE_ENV'] === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Graceful shutdown
async function shutdown() {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  await redis.quit();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
async function main() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('Database connected');

    // Test Redis connection
    await redis.ping();
    console.log('Redis connected');

    app.listen(PORT, () => {
      console.log(`Nexus Coder API server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
