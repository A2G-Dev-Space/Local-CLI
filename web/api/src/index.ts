/**
 * Hanseol Web API Server
 *
 * Express server for managing Docker sessions, auth, agents, and WebSocket relay
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import Docker from 'dockerode';

import { authRoutes } from './routes/auth.routes.js';
import { sessionRoutes } from './routes/session.routes.js';
import { agentRoutes } from './routes/agent.routes.js';
import { toolRoutes } from './routes/tool.routes.js';
import { adminRoutes } from './routes/admin.routes.js';
import { healthRoutes } from './routes/health.routes.js';
import { llmSettingsRoutes } from './routes/llm-settings.routes.js';
import { handleWebSocketUpgrade } from './services/ws-relay.js';
import { startSessionCleanup } from './services/session-cleanup.js';

// --- Shared instances ---

export const prisma = new PrismaClient();

export const redis = new Redis(process.env['REDIS_URL'] || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

export const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// --- Express app ---

const app = express();
const PORT = parseInt(process.env['PORT'] || '3000', 10);

app.set('trust proxy', 1);

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env['CORS_ORIGIN'] || '*',
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined'));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'Too many requests, please try again later.' },
});
app.use(limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/agents', toolRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/llm-settings', llmSettingsRoutes);
app.use('/api/health', healthRoutes);

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('[API Error]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
);

// --- HTTP + WebSocket server ---

const server = createServer(app);

server.on('upgrade', (req, socket, head) => {
  if (req.url?.startsWith('/ws')) {
    handleWebSocketUpgrade(req, socket, head);
  } else {
    socket.destroy();
  }
});

// --- Startup ---

async function start() {
  try {
    await prisma.$connect();
    console.log('[DB] PostgreSQL connected');

    await redis.connect();
    console.log('[Redis] Connected');

    await docker.ping();
    console.log('[Docker] Connected');

    startSessionCleanup();
    console.log('[Cleanup] Session cleanup scheduler started');

    server.listen(PORT, () => {
      console.log(`[API] Hanseol Web API listening on :${PORT}`);
    });
  } catch (err) {
    console.error('[Startup] Failed to initialize:', err);
    process.exit(1);
  }
}

// --- Graceful shutdown ---

async function shutdown(signal: string) {
  console.log(`[Shutdown] ${signal} received, shutting down gracefully...`);
  server.close();
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();
