/**
 * Admin Routes
 *
 * Protected endpoints for admin dashboard
 */

import { Router, RequestHandler } from 'express';
import { prisma } from '../index.js';
import { redis } from '../index.js';
import { authenticateToken, requireAdmin, requireSuperAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { getActiveUserCount, getTodayUsage } from '../services/redis.service.js';
import { z } from 'zod';

/**
 * Helper: PostgreSQL DATE() 결과를 YYYY-MM-DD 문자열로 변환
 * Prisma raw query에서 DATE 타입은 Date 객체 또는 string으로 올 수 있음
 */
function formatDateToString(date: Date | string): string {
  if (typeof date === 'string') {
    // 이미 문자열이면 YYYY-MM-DD 형식으로 정규화
    return date.split('T')[0] || date;
  }
  return date.toISOString().split('T')[0]!;
}

export const adminRoutes = Router();

// Apply authentication and admin check to all routes
adminRoutes.use(authenticateToken);
adminRoutes.use(requireAdmin as RequestHandler);

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
adminRoutes.get('/admins', requireSuperAdmin as RequestHandler, async (_req: AuthenticatedRequest, res) => {
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
adminRoutes.post('/admins', requireSuperAdmin as RequestHandler, async (req: AuthenticatedRequest, res) => {
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
adminRoutes.delete('/admins/:id', requireSuperAdmin as RequestHandler, async (req: AuthenticatedRequest, res) => {
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

/**
 * GET /admin/stats/daily-active-users
 * Get daily active user count for charts
 * Query params: days (14-365), default 30
 */
adminRoutes.get('/stats/daily-active-users', async (req: AuthenticatedRequest, res) => {
  try {
    const days = Math.min(365, Math.max(14, parseInt(req.query['days'] as string) || 30));
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Get distinct users per day from usage logs (일별 활성 사용자)
    const dailyUsers = await prisma.$queryRaw<Array<{ date: Date | string; user_count: bigint }>>`
      SELECT DATE(timestamp) as date, COUNT(DISTINCT user_id) as user_count
      FROM usage_logs
      WHERE timestamp >= ${startDate}
      GROUP BY DATE(timestamp)
      ORDER BY date ASC
    `;

    // Convert to chart format
    const chartData = dailyUsers.map((item) => ({
      date: formatDateToString(item.date),
      userCount: Number(item.user_count),
    }));

    // Get total unique users in period
    const totalUsers = await prisma.usageLog.groupBy({
      by: ['userId'],
      where: {
        timestamp: { gte: startDate },
      },
    });

    res.json({
      chartData,
      totalUniqueUsers: totalUsers.length,
    });
  } catch (error) {
    console.error('Get daily active users error:', error);
    res.status(500).json({ error: 'Failed to get daily active users' });
  }
});

/**
 * GET /admin/stats/cumulative-users
 * Get cumulative unique user count by date (누적 사용자 수)
 * Shows total unique users who have used the service at least once up to each date
 * Query params: days (14-365), default 30
 */
adminRoutes.get('/stats/cumulative-users', async (req: AuthenticatedRequest, res) => {
  try {
    const days = Math.min(365, Math.max(14, parseInt(req.query['days'] as string) || 30));
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Get the first usage date for each user
    const userFirstUsage = await prisma.$queryRaw<Array<{ first_date: Date | string; new_users: bigint }>>`
      SELECT DATE(first_usage) as first_date, COUNT(*) as new_users
      FROM (
        SELECT user_id, MIN(timestamp) as first_usage
        FROM usage_logs
        GROUP BY user_id
      ) as user_first
      WHERE first_usage >= ${startDate}
      GROUP BY DATE(first_usage)
      ORDER BY first_date ASC
    `;

    // Get users who joined before the start date (for initial count)
    const existingUsers = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT user_id) as count
      FROM usage_logs
      WHERE timestamp < ${startDate}
    `;

    let cumulativeCount = Number(existingUsers[0]?.count || 0);

    // Build cumulative chart data
    const newUsersMap = new Map(
      userFirstUsage.map((item) => [
        formatDateToString(item.first_date),
        Number(item.new_users),
      ])
    );

    const chartData: Array<{ date: string; cumulativeUsers: number; newUsers: number }> = [];

    // Generate all dates in range
    for (let d = new Date(startDate); d <= new Date(); d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]!;
      const newUsers = newUsersMap.get(dateStr) || 0;
      cumulativeCount += newUsers;
      chartData.push({
        date: dateStr,
        cumulativeUsers: cumulativeCount,
        newUsers,
      });
    }

    res.json({
      chartData,
      totalUsers: cumulativeCount,
    });
  } catch (error) {
    console.error('Get cumulative users error:', error);
    res.status(500).json({ error: 'Failed to get cumulative users' });
  }
});

/**
 * GET /admin/stats/model-daily-trend
 * Get daily usage trend per model (for line chart)
 * Query params: days (14-365), default 30
 */
adminRoutes.get('/stats/model-daily-trend', async (req: AuthenticatedRequest, res) => {
  try {
    const days = Math.min(365, Math.max(14, parseInt(req.query['days'] as string) || 30));
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Get all models
    const models = await prisma.model.findMany({
      select: { id: true, name: true, displayName: true },
    });

    // Get daily stats grouped by model and date using raw SQL
    const dailyStats = await prisma.$queryRaw<Array<{ date: Date | string; model_id: string; total_tokens: bigint }>>`
      SELECT DATE(timestamp) as date, model_id, SUM(total_tokens) as total_tokens
      FROM usage_logs
      WHERE timestamp >= ${startDate}
      GROUP BY DATE(timestamp), model_id
      ORDER BY date ASC
    `;

    // Debug logging
    console.log(`[model-daily-trend] Models: ${models.length}, DailyStats rows: ${dailyStats.length}`);
    if (dailyStats.length > 0) {
      const sample = dailyStats[0]!;
      console.log(`[model-daily-trend] Sample: date=${sample.date}, model_id=${sample.model_id}, tokens=${sample.total_tokens}`);
    }

    // Process into date-keyed structure with model usage
    const dateMap = new Map<string, Record<string, number>>();

    // Initialize all dates in range with 0 for all models
    const modelIds = models.map((m) => m.id);
    for (let d = new Date(startDate); d <= new Date(); d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]!;
      // Initialize with 0 for all models
      const initialData: Record<string, number> = {};
      for (const modelId of modelIds) {
        initialData[modelId] = 0;
      }
      dateMap.set(dateStr, initialData);
    }

    // Populate with actual data (overwrite 0s)
    for (const stat of dailyStats) {
      const dateStr = formatDateToString(stat.date);
      const existing = dateMap.get(dateStr);
      if (existing) {
        existing[stat.model_id] = Number(stat.total_tokens);
      }
    }

    // Convert to array format for chart
    const chartData = Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, modelUsage]) => ({
        date,
        ...modelUsage,
      }));

    res.json({
      models: models.map((m) => ({ id: m.id, name: m.name, displayName: m.displayName })),
      chartData,
    });
  } catch (error) {
    console.error('Get model daily trend error:', error);
    res.status(500).json({ error: 'Failed to get model daily trend' });
  }
});

/**
 * GET /admin/stats/model-user-trend
 * Get daily usage trend per user for a specific model
 * Query params: modelId (required), days (14-365), topN (10-100)
 */
adminRoutes.get('/stats/model-user-trend', async (req: AuthenticatedRequest, res) => {
  try {
    const modelId = req.query['modelId'] as string;
    if (!modelId) {
      res.status(400).json({ error: 'modelId is required' });
      return;
    }

    const days = Math.min(365, Math.max(14, parseInt(req.query['days'] as string) || 30));
    const topN = Math.min(100, Math.max(10, parseInt(req.query['topN'] as string) || 10));

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Get top N users by total usage for this model in the period
    const topUsers = await prisma.usageLog.groupBy({
      by: ['userId'],
      where: {
        modelId,
        timestamp: { gte: startDate },
      },
      _sum: {
        totalTokens: true,
      },
      orderBy: {
        _sum: {
          totalTokens: 'desc',
        },
      },
      take: topN,
    });

    const topUserIds = topUsers.map((u) => u.userId);

    // Get user details
    const users = await prisma.user.findMany({
      where: { id: { in: topUserIds } },
      select: { id: true, loginid: true, username: true, deptname: true },
    });

    // Get daily stats for these users using raw SQL
    const dailyStats = await prisma.$queryRaw<Array<{ date: Date | string; user_id: string; total_tokens: bigint }>>`
      SELECT DATE(timestamp) as date, user_id, SUM(total_tokens) as total_tokens
      FROM usage_logs
      WHERE model_id = ${modelId}
        AND user_id = ANY(${topUserIds})
        AND timestamp >= ${startDate}
      GROUP BY DATE(timestamp), user_id
      ORDER BY date ASC
    `;

    // Process into date-keyed structure
    const dateMap = new Map<string, Record<string, number>>();

    // Initialize all dates in range with 0 for all top users
    for (let d = new Date(startDate); d <= new Date(); d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]!;
      const initialData: Record<string, number> = {};
      for (const userId of topUserIds) {
        initialData[userId] = 0;
      }
      dateMap.set(dateStr, initialData);
    }

    // Populate with actual data (overwrite 0s)
    for (const stat of dailyStats) {
      const dateStr = formatDateToString(stat.date);
      const existing = dateMap.get(dateStr);
      if (existing) {
        existing[stat.user_id] = Number(stat.total_tokens);
      }
    }

    // Convert to array format
    const chartData = Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, userUsage]) => ({
        date,
        ...userUsage,
      }));

    // Include total usage for ranking info
    const usersWithTotal = users.map((u) => {
      const total = topUsers.find((t) => t.userId === u.id)?._sum.totalTokens || 0;
      return { ...u, totalTokens: total };
    }).sort((a, b) => (b.totalTokens || 0) - (a.totalTokens || 0));

    res.json({
      users: usersWithTotal,
      chartData,
    });
  } catch (error) {
    console.error('Get model user trend error:', error);
    res.status(500).json({ error: 'Failed to get model user trend' });
  }
});
