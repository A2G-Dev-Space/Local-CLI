import { Router, Request, Response } from 'express';
import { readFileSync } from 'fs';
import { prisma, redis, docker } from '../index.js';

export const healthRoutes = Router();

const startTime = Date.now();

let APP_VERSION = '1.0.0';
try {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf-8'));
  APP_VERSION = pkg.version || APP_VERSION;
} catch {
  // Fallback to default version
}

/**
 * GET /api/health — Basic health check
 */
healthRoutes.get('/', async (_req: Request, res: Response) => {
  const checks = {
    db: false,
    redis: false,
    docker: false,
  };

  // Check PostgreSQL
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = true;
  } catch {
    // DB not connected
  }

  // Check Redis
  try {
    await redis.ping();
    checks.redis = true;
  } catch {
    // Redis not connected
  }

  // Check Docker
  try {
    await docker.ping();
    checks.docker = true;
  } catch {
    // Docker not connected
  }

  const allHealthy = checks.db && checks.redis && checks.docker;

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ok' : 'degraded',
    version: APP_VERSION,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    db: checks.db ? 'connected' : 'disconnected',
    redis: checks.redis ? 'connected' : 'disconnected',
    docker: checks.docker ? 'connected' : 'disconnected',
  });
});
