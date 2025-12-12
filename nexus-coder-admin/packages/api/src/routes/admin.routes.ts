/**
 * Admin Routes
 *
 * Protected endpoints for admin dashboard
 */

import { Router } from 'express';
import { prisma } from '../index.js';
import { redis } from '../index.js';
import { authenticateToken, requireAdmin, requireSuperAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { getActiveUserCount, getTodayUsage } from '../services/redis.service.js';
import { z } from 'zod';

export const adminRoutes = Router();

// Apply authentication and admin check to all routes
adminRoutes.use(authenticateToken);
adminRoutes.use(requireAdmin as Router['use'] extends (handler: infer H) => unknown ? H : never);

// ==================== Models Management ====================

const modelSchema = z.object({
  name: z.string().min(1).max(100),
  displayName: z.string().min(1).max(200),
  endpointUrl: z.string().url(),
  apiKey: z.string().optional(),
  maxTokens: z.number().int().min(1).max(1000000).default(128000),
  enabled: z.boolean().default(true),
});

/**
 * GET /admin/models
 * Get all models (including disabled)
 */
adminRoutes.get('/models', async (_req: AuthenticatedRequest, res) => {
  try {
    const models = await prisma.model.findMany({
      include: {
        creator: {
          select: { loginid: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Mask API keys
    const maskedModels = models.map((m) => ({
      ...m,
      apiKey: m.apiKey ? '***' + m.apiKey.slice(-4) : null,
    }));

    res.json({ models: maskedModels });
  } catch (error) {
    console.error('Get admin models error:', error);
    res.status(500).json({ error: 'Failed to get models' });
  }
});

/**
 * POST /admin/models
 * Create a new model
 */
adminRoutes.post('/models', async (req: AuthenticatedRequest, res) => {
  try {
    if (req.adminRole === 'VIEWER') {
      res.status(403).json({ error: 'Viewers cannot create models' });
      return;
    }

    const validation = modelSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Invalid request', details: validation.error.issues });
      return;
    }

    const admin = await prisma.admin.findUnique({
      where: { loginid: req.user!.loginid },
    });

    const model = await prisma.model.create({
      data: {
        ...validation.data,
        createdBy: admin?.id,
      },
    });

    res.status(201).json({ model });
  } catch (error) {
    console.error('Create model error:', error);
    res.status(500).json({ error: 'Failed to create model' });
  }
});

/**
 * PUT /admin/models/:id
 * Update a model
 */
adminRoutes.put('/models/:id', async (req: AuthenticatedRequest, res) => {
  try {
    if (req.adminRole === 'VIEWER') {
      res.status(403).json({ error: 'Viewers cannot update models' });
      return;
    }

    const { id } = req.params;
    const validation = modelSchema.partial().safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Invalid request', details: validation.error.issues });
      return;
    }

    const model = await prisma.model.update({
      where: { id },
      data: validation.data,
    });

    res.json({ model });
  } catch (error) {
    console.error('Update model error:', error);
    res.status(500).json({ error: 'Failed to update model' });
  }
});

/**
 * DELETE /admin/models/:id
 * Delete a model
 */
adminRoutes.delete('/models/:id', async (req: AuthenticatedRequest, res) => {
  try {
    if (req.adminRole !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Only super admins can delete models' });
      return;
    }

    const { id } = req.params;

    await prisma.model.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete model error:', error);
    res.status(500).json({ error: 'Failed to delete model' });
  }
});

// ==================== Users Management ====================

/**
 * GET /admin/users
 * Get all users with usage stats
 */
adminRoutes.get('/users', async (req: AuthenticatedRequest, res) => {
  try {
    const page = parseInt(req.query['page'] as string) || 1;
    const limit = parseInt(req.query['limit'] as string) || 50;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { lastActive: 'desc' },
        include: {
          _count: {
            select: { usageLogs: true },
          },
        },
      }),
      prisma.user.count(),
    ]);

    res.json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

/**
 * GET /admin/users/:id
 * Get user details with usage history
 */
adminRoutes.get('/users/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        usageLogs: {
          orderBy: { timestamp: 'desc' },
          take: 100,
          include: {
            model: {
              select: { name: true, displayName: true },
            },
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// ==================== Admin Management ====================

/**
 * GET /admin/admins
 * Get all admins (super admin only)
 */
adminRoutes.get('/admins', requireSuperAdmin as Router['use'] extends (handler: infer H) => unknown ? H : never, async (_req: AuthenticatedRequest, res) => {
  try {
    const admins = await prisma.admin.findMany({
      orderBy: { createdAt: 'desc' },
    });

    res.json({ admins });
  } catch (error) {
    console.error('Get admins error:', error);
    res.status(500).json({ error: 'Failed to get admins' });
  }
});

/**
 * POST /admin/admins
 * Add new admin (super admin only)
 */
adminRoutes.post('/admins', requireSuperAdmin as Router['use'] extends (handler: infer H) => unknown ? H : never, async (req: AuthenticatedRequest, res) => {
  try {
    const { loginid, role } = req.body;

    if (!loginid || !['ADMIN', 'VIEWER'].includes(role)) {
      res.status(400).json({ error: 'Invalid request' });
      return;
    }

    const admin = await prisma.admin.create({
      data: { loginid, role },
    });

    res.status(201).json({ admin });
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ error: 'Failed to create admin' });
  }
});

/**
 * DELETE /admin/admins/:id
 * Remove admin (super admin only)
 */
adminRoutes.delete('/admins/:id', requireSuperAdmin as Router['use'] extends (handler: infer H) => unknown ? H : never, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    // Can't delete super admins
    const admin = await prisma.admin.findUnique({ where: { id } });
    if (admin?.role === 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Cannot delete super admin' });
      return;
    }

    await prisma.admin.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete admin error:', error);
    res.status(500).json({ error: 'Failed to delete admin' });
  }
});

// ==================== Statistics ====================

/**
 * GET /admin/stats/overview
 * Get dashboard overview statistics
 */
adminRoutes.get('/stats/overview', async (_req: AuthenticatedRequest, res) => {
  try {
    const [activeUsers, todayUsage, totalUsers, totalModels] = await Promise.all([
      getActiveUserCount(redis),
      getTodayUsage(redis),
      prisma.user.count({ where: { isActive: true } }),
      prisma.model.count({ where: { enabled: true } }),
    ]);

    res.json({
      activeUsers,
      todayUsage,
      totalUsers,
      totalModels,
    });
  } catch (error) {
    console.error('Get overview stats error:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

/**
 * GET /admin/stats/daily
 * Get daily usage for charts
 */
adminRoutes.get('/stats/daily', async (req: AuthenticatedRequest, res) => {
  try {
    const days = parseInt(req.query['days'] as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const dailyStats = await prisma.dailyUsageStat.groupBy({
      by: ['date'],
      where: {
        date: { gte: startDate },
      },
      _sum: {
        totalInputTokens: true,
        totalOutputTokens: true,
        requestCount: true,
      },
      orderBy: { date: 'asc' },
    });

    res.json({ dailyStats });
  } catch (error) {
    console.error('Get daily stats error:', error);
    res.status(500).json({ error: 'Failed to get daily statistics' });
  }
});

/**
 * GET /admin/stats/by-user
 * Get usage grouped by user
 */
adminRoutes.get('/stats/by-user', async (req: AuthenticatedRequest, res) => {
  try {
    const days = parseInt(req.query['days'] as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const userStats = await prisma.usageLog.groupBy({
      by: ['userId'],
      where: {
        timestamp: { gte: startDate },
      },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
      },
      _count: true,
      orderBy: {
        _sum: {
          totalTokens: 'desc',
        },
      },
      take: 20,
    });

    // Get user details
    const userIds = userStats.map((s) => s.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, loginid: true, username: true, deptname: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));
    const statsWithUsers = userStats.map((s) => ({
      ...s,
      user: userMap.get(s.userId),
    }));

    res.json({ userStats: statsWithUsers });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ error: 'Failed to get user statistics' });
  }
});

/**
 * GET /admin/stats/by-model
 * Get usage grouped by model
 */
adminRoutes.get('/stats/by-model', async (req: AuthenticatedRequest, res) => {
  try {
    const days = parseInt(req.query['days'] as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const modelStats = await prisma.usageLog.groupBy({
      by: ['modelId'],
      where: {
        timestamp: { gte: startDate },
      },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
      },
      _count: true,
      orderBy: {
        _sum: {
          totalTokens: 'desc',
        },
      },
    });

    // Get model details
    const modelIds = modelStats.map((s) => s.modelId);
    const models = await prisma.model.findMany({
      where: { id: { in: modelIds } },
      select: { id: true, name: true, displayName: true },
    });

    const modelMap = new Map(models.map((m) => [m.id, m]));
    const statsWithModels = modelStats.map((s) => ({
      ...s,
      model: modelMap.get(s.modelId),
    }));

    res.json({ modelStats: statsWithModels });
  } catch (error) {
    console.error('Get model stats error:', error);
    res.status(500).json({ error: 'Failed to get model statistics' });
  }
});

/**
 * GET /admin/stats/by-dept
 * Get usage grouped by department
 */
adminRoutes.get('/stats/by-dept', async (req: AuthenticatedRequest, res) => {
  try {
    const days = parseInt(req.query['days'] as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const deptStats = await prisma.dailyUsageStat.groupBy({
      by: ['deptname'],
      where: {
        date: { gte: startDate },
      },
      _sum: {
        totalInputTokens: true,
        totalOutputTokens: true,
        requestCount: true,
      },
      orderBy: {
        _sum: {
          totalInputTokens: 'desc',
        },
      },
    });

    res.json({ deptStats });
  } catch (error) {
    console.error('Get dept stats error:', error);
    res.status(500).json({ error: 'Failed to get department statistics' });
  }
});
