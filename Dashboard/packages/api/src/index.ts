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
import { proxyRoutes } from './routes/proxy.routes.js';
import { feedbackRoutes } from './routes/feedback.routes.js';
import { myUsageRoutes } from './routes/my-usage.routes.js';
import { ratingRoutes } from './routes/rating.routes.js';
import { serviceRoutes } from './routes/service.routes.js';

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
app.use('/services', serviceRoutes);
app.use('/models', modelsRoutes);
app.use('/usage', usageRoutes);
app.use('/admin', adminRoutes);
app.use('/feedback', feedbackRoutes);
app.use('/my-usage', myUsageRoutes);
app.use('/rating', ratingRoutes);

// LLM Proxy Routes (OpenAI-compatible)
app.use('/v1', proxyRoutes);

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

// Ensure default service exists (without auto-migration)
async function ensureDefaultService() {
  const DEFAULT_SERVICE_NAME = process.env['DEFAULT_SERVICE_NAME'] || 'nexus-coder';
  const DEFAULT_SERVICE_DISPLAY_NAME = process.env['DEFAULT_SERVICE_DISPLAY_NAME'] || 'Nexus Coder';

  const existing = await prisma.service.findUnique({
    where: { name: DEFAULT_SERVICE_NAME },
  });

  if (!existing) {
    await prisma.service.create({
      data: {
        name: DEFAULT_SERVICE_NAME,
        displayName: DEFAULT_SERVICE_DISPLAY_NAME,
        description: 'Default service (auto-created)',
        enabled: true,
      },
    });
    console.log(`[Service] Default service '${DEFAULT_SERVICE_NAME}' created`);
  } else {
    console.log(`[Service] Default service '${DEFAULT_SERVICE_NAME}' exists (id: ${existing.id})`);
  }
}

// Start server
async function main() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('Database connected');

    // Test Redis connection
    await redis.ping();
    console.log('Redis connected');

    // Ensure default service exists
    await ensureDefaultService();

    app.listen(PORT, () => {
      console.log(`AX Portal API server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
