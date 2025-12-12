/**
 * Usage Routes
 *
 * Endpoints for reporting and querying usage
 */

import { Router } from 'express';
import { prisma } from '../index.js';
import { redis } from '../index.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { incrementUsage, trackActiveUser } from '../services/redis.service.js';
import { z } from 'zod';

export const usageRoutes = Router();

// Validation schema for usage report
const usageReportSchema = z.object({
  modelId: z.string().uuid(),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
});

/**
 * POST /usage
 * Report usage (called by CLI after each LLM request)
 */
usageRoutes.post('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const validation = usageReportSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Invalid request', details: validation.error.issues });
      return;
    }

    const { modelId, inputTokens, outputTokens } = validation.data;
    const totalTokens = inputTokens + outputTokens;

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { loginid: req.user.loginid },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Verify model exists
    const model = await prisma.model.findUnique({
      where: { id: modelId },
    });

    if (!model) {
      res.status(404).json({ error: 'Model not found' });
      return;
    }

    // Create usage log
    const usageLog = await prisma.usageLog.create({
      data: {
        userId: user.id,
        modelId,
        inputTokens,
        outputTokens,
        totalTokens,
      },
    });

    // Update Redis counters
    await incrementUsage(redis, user.id, modelId, inputTokens, outputTokens);

    // Track active user
    await trackActiveUser(redis, req.user.loginid);

    // Update user's last active
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActive: new Date() },
    });

    res.json({
      success: true,
      usageId: usageLog.id,
      recorded: {
        inputTokens,
        outputTokens,
        totalTokens,
      },
    });
  } catch (error) {
    console.error('Usage report error:', error);
    res.status(500).json({ error: 'Failed to record usage' });
  }
});

/**
 * GET /usage/my
 * Get current user's usage statistics
 */
usageRoutes.get('/my', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { loginid: req.user.loginid },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get this month's date range
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    // Query usage stats
    const [todayUsage, monthUsage, totalUsage] = await Promise.all([
      prisma.usageLog.aggregate({
        where: {
          userId: user.id,
          timestamp: { gte: today, lt: tomorrow },
        },
        _sum: {
          inputTokens: true,
          outputTokens: true,
          totalTokens: true,
        },
        _count: true,
      }),
      prisma.usageLog.aggregate({
        where: {
          userId: user.id,
          timestamp: { gte: monthStart, lt: monthEnd },
        },
        _sum: {
          inputTokens: true,
          outputTokens: true,
          totalTokens: true,
        },
        _count: true,
      }),
      prisma.usageLog.aggregate({
        where: { userId: user.id },
        _sum: {
          inputTokens: true,
          outputTokens: true,
          totalTokens: true,
        },
        _count: true,
      }),
    ]);

    res.json({
      today: {
        inputTokens: todayUsage._sum.inputTokens || 0,
        outputTokens: todayUsage._sum.outputTokens || 0,
        totalTokens: todayUsage._sum.totalTokens || 0,
        requestCount: todayUsage._count,
      },
      thisMonth: {
        inputTokens: monthUsage._sum.inputTokens || 0,
        outputTokens: monthUsage._sum.outputTokens || 0,
        totalTokens: monthUsage._sum.totalTokens || 0,
        requestCount: monthUsage._count,
      },
      total: {
        inputTokens: totalUsage._sum.inputTokens || 0,
        outputTokens: totalUsage._sum.outputTokens || 0,
        totalTokens: totalUsage._sum.totalTokens || 0,
        requestCount: totalUsage._count,
      },
    });
  } catch (error) {
    console.error('Get my usage error:', error);
    res.status(500).json({ error: 'Failed to get usage statistics' });
  }
});
