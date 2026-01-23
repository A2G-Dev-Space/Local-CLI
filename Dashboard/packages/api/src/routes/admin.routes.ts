/**
 * Admin Routes
 *
 * Protected endpoints for admin dashboard
 * - DEVELOPERS 환경변수의 사용자는 SUPER_ADMIN으로 표시
 * - DB admins 테이블의 사용자는 해당 역할로 표시
 * - 모든 통계 API는 ?serviceId= 쿼리 파라미터로 서비스별 필터링 지원
 */

import { Router, RequestHandler } from 'express';
import { prisma } from '../index.js';
import { redis } from '../index.js';
import { authenticateToken, requireAdmin, requireSuperAdmin, requireServiceAccess, requireWriteAccess, getAccessibleServiceIds, AuthenticatedRequest, isDeveloper } from '../middleware/auth.js';
import { getActiveUserCount, getTodayUsage } from '../services/redis.service.js';
import { z } from 'zod';

/**
 * Helper: PostgreSQL DATE() 결과를 YYYY-MM-DD 문자열로 변환
 */
function formatDateToString(date: Date | string): string {
  if (typeof date === 'string') {
    return date.split('T')[0] || date;
  }
  return date.toISOString().split('T')[0]!;
}

/**
 * Helper: serviceId 필터 조건 생성
 */
function getServiceFilter(serviceId: string | undefined) {
  return serviceId ? { serviceId } : {};
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
  serviceId: z.string().uuid().optional(),
});

/**
 * GET /admin/models
 * Get all models (including disabled)
 * Query: ?serviceId= (optional)
 * - SUPER_ADMIN/VIEWER: all models or filtered by serviceId
 * - SERVICE_ADMIN/SERVICE_VIEWER: only models from assigned services
 */
adminRoutes.get('/models', async (req: AuthenticatedRequest, res) => {
  try {
    const serviceId = req.query['serviceId'] as string | undefined;

    // Get accessible service IDs for non-global admins
    const accessibleServiceIds = await getAccessibleServiceIds(req);

    // Build where clause
    let whereClause: { serviceId?: string | { in: string[] } } = {};

    if (serviceId) {
      // If specific serviceId requested, check access
      if (accessibleServiceIds !== null && !accessibleServiceIds.includes(serviceId)) {
        res.status(403).json({ error: 'No access to this service' });
        return;
      }
      whereClause = { serviceId };
    } else if (accessibleServiceIds !== null) {
      // Filter to accessible services only
      whereClause = { serviceId: { in: accessibleServiceIds } };
    }

    const models = await prisma.model.findMany({
      where: whereClause,
      include: {
        creator: {
          select: { loginid: true },
        },
        service: {
          select: { id: true, name: true, displayName: true },
        },
      },
      orderBy: [
        { sortOrder: 'asc' },
        { displayName: 'asc' },
      ],
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
 * - VIEWER/SERVICE_VIEWER cannot create
 * - SERVICE_ADMIN can only create for assigned services
 */
adminRoutes.post('/models', async (req: AuthenticatedRequest, res) => {
  try {
    // Check write access
    if (['VIEWER', 'SERVICE_VIEWER'].includes(req.adminRole || '')) {
      res.status(403).json({ error: 'Read-only access. Cannot create models.' });
      return;
    }

    const validation = modelSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Invalid request', details: validation.error.issues });
      return;
    }

    // Check service access for SERVICE_ADMIN
    const { serviceId } = validation.data;
    if (serviceId && req.adminRole === 'SERVICE_ADMIN') {
      const accessibleServiceIds = await getAccessibleServiceIds(req);
      if (accessibleServiceIds !== null && !accessibleServiceIds.includes(serviceId)) {
        res.status(403).json({ error: 'No access to create models for this service' });
        return;
      }
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
 * PUT /admin/models/reorder
 * Reorder models (must be before :id route)
 * Body: { modelIds: string[] } - 순서대로 정렬된 모델 ID 배열
 */
adminRoutes.put('/models/reorder', async (req: AuthenticatedRequest, res) => {
  try {
    // Check write access
    if (['VIEWER', 'SERVICE_VIEWER'].includes(req.adminRole || '')) {
      res.status(403).json({ error: 'Read-only access. Cannot reorder models.' });
      return;
    }

    const { modelIds } = req.body;

    if (!Array.isArray(modelIds) || modelIds.length === 0) {
      res.status(400).json({ error: 'modelIds must be a non-empty array' });
      return;
    }

    // Verify all model IDs exist first
    const existingModels = await prisma.model.findMany({
      where: { id: { in: modelIds } },
      select: { id: true },
    });

    const existingIds = new Set(existingModels.map(m => m.id));
    const validModelIds = modelIds.filter((id: string) => existingIds.has(id));

    if (validModelIds.length === 0) {
      res.status(400).json({ error: 'No valid model IDs provided' });
      return;
    }

    // Update sort order for each valid model
    const updates = validModelIds.map((id: string, index: number) =>
      prisma.model.update({
        where: { id },
        data: { sortOrder: index },
      })
    );

    await prisma.$transaction(updates);

    res.json({ success: true, count: validModelIds.length });
  } catch (error) {
    console.error('Reorder models error:', error);
    res.status(500).json({ error: 'Failed to reorder models' });
  }
});

/**
 * PUT /admin/models/:id
 * Update a model
 * - VIEWER/SERVICE_VIEWER cannot update
 * - SERVICE_ADMIN can only update models in assigned services
 */
adminRoutes.put('/models/:id', async (req: AuthenticatedRequest, res) => {
  try {
    // Check write access
    if (['VIEWER', 'SERVICE_VIEWER'].includes(req.adminRole || '')) {
      res.status(403).json({ error: 'Read-only access. Cannot update models.' });
      return;
    }

    const { id } = req.params;

    // Check service access for SERVICE_ADMIN
    if (req.adminRole === 'SERVICE_ADMIN') {
      const existingModel = await prisma.model.findUnique({
        where: { id },
        select: { serviceId: true },
      });
      if (existingModel?.serviceId) {
        const accessibleServiceIds = await getAccessibleServiceIds(req);
        if (accessibleServiceIds !== null && !accessibleServiceIds.includes(existingModel.serviceId)) {
          res.status(403).json({ error: 'No access to update this model' });
          return;
        }
      }
    }

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
 * Query: ?force=true - 사용 기록이 있어도 강제 삭제 (usage_logs도 함께 삭제)
 */
adminRoutes.delete('/models/:id', async (req: AuthenticatedRequest, res) => {
  try {
    if (req.adminRole !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Only super admins can delete models' });
      return;
    }

    const { id } = req.params;
    const force = req.query['force'] === 'true';

    // Check if model has usage logs
    const usageCount = await prisma.usageLog.count({
      where: { modelId: id },
    });

    if (usageCount > 0 && !force) {
      res.status(400).json({
        error: `이 모델에 ${usageCount.toLocaleString()}개의 사용 기록이 있습니다. 삭제하려면 force=true 옵션을 사용하세요.`,
        usageCount,
        hint: 'Add ?force=true to delete model and all its usage logs',
      });
      return;
    }

    // If force delete, delete usage logs first
    if (force && usageCount > 0) {
      await prisma.usageLog.deleteMany({
        where: { modelId: id },
      });
      console.log(`Force deleted ${usageCount} usage logs for model ${id}`);
    }

    // Also delete daily_usage_stats
    await prisma.dailyUsageStat.deleteMany({
      where: { modelId: id },
    });

    await prisma.model.delete({
      where: { id },
    });

    res.json({
      success: true,
      deletedUsageLogs: force ? usageCount : 0,
    });
  } catch (error) {
    console.error('Delete model error:', error);
    res.status(500).json({ error: 'Failed to delete model' });
  }
});

// ==================== Users Management ====================

/**
 * GET /admin/users
 * Get all users with usage stats (excluding anonymous and users with 0 calls)
 * Query: ?serviceId= (optional), ?page=, ?limit=
 */
adminRoutes.get('/users', async (req: AuthenticatedRequest, res) => {
  try {
    const page = parseInt(req.query['page'] as string) || 1;
    const limit = parseInt(req.query['limit'] as string) || 50;
    const skip = (page - 1) * limit;
    const serviceId = req.query['serviceId'] as string | undefined;

    // Filter: exclude anonymous AND only users with at least 1 usage log (optionally for specific service)
    const whereClause = {
      loginid: { not: 'anonymous' },
      usageLogs: {
        some: getServiceFilter(serviceId),
      },
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { lastActive: 'desc' },
        include: {
          _count: {
            select: { usageLogs: serviceId ? { where: { serviceId } } : true },
          },
        },
      }),
      prisma.user.count({
        where: whereClause,
      }),
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
 * Query: ?serviceId= (optional)
 */
adminRoutes.get('/users/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const serviceId = req.query['serviceId'] as string | undefined;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        usageLogs: {
          where: getServiceFilter(serviceId),
          orderBy: { timestamp: 'desc' },
          take: 100,
          include: {
            model: {
              select: { name: true, displayName: true },
            },
            service: {
              select: { id: true, name: true, displayName: true },
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
      include: {
        adminServices: {
          include: {
            service: {
              select: { id: true, name: true, displayName: true },
            },
          },
        },
      },
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
 * Body: { loginid, role, serviceId? }
 * role: 'SUPER_ADMIN' | 'SERVICE_ADMIN' | 'VIEWER' | 'SERVICE_VIEWER'
 */
adminRoutes.post('/admins', requireSuperAdmin as RequestHandler, async (req: AuthenticatedRequest, res) => {
  try {
    const { loginid, role, serviceId } = req.body;
    const validRoles = ['SUPER_ADMIN', 'SERVICE_ADMIN', 'VIEWER', 'SERVICE_VIEWER'];

    if (!loginid || !validRoles.includes(role)) {
      res.status(400).json({
        error: 'Invalid request',
        validRoles,
      });
      return;
    }

    // SERVICE_ADMIN and SERVICE_VIEWER require serviceId
    if (['SERVICE_ADMIN', 'SERVICE_VIEWER'].includes(role) && !serviceId) {
      res.status(400).json({ error: 'serviceId is required for SERVICE_ADMIN and SERVICE_VIEWER roles' });
      return;
    }

    // Create or update admin
    const admin = await prisma.admin.upsert({
      where: { loginid },
      update: { role },
      create: { loginid, role },
    });

    // If serviceId provided, add to AdminService
    if (serviceId) {
      await prisma.adminService.upsert({
        where: {
          adminId_serviceId: { adminId: admin.id, serviceId },
        },
        update: { role },
        create: { adminId: admin.id, serviceId, role },
      });
    }

    // Return admin with services
    const adminWithServices = await prisma.admin.findUnique({
      where: { id: admin.id },
      include: {
        adminServices: {
          include: {
            service: {
              select: { id: true, name: true, displayName: true },
            },
          },
        },
      },
    });

    res.status(201).json({ admin: adminWithServices });
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

    // Also delete AdminService entries
    await prisma.adminService.deleteMany({ where: { adminId: id } });
    await prisma.admin.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete admin error:', error);
    res.status(500).json({ error: 'Failed to delete admin' });
  }
});

/**
 * PUT /admin/admins/:id
 * Update admin role (super admin only)
 */
adminRoutes.put('/admins/:id', requireSuperAdmin as RequestHandler, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const validRoles = ['SUPER_ADMIN', 'SERVICE_ADMIN', 'VIEWER', 'SERVICE_VIEWER'];

    if (!validRoles.includes(role)) {
      res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
      return;
    }

    const admin = await prisma.admin.update({
      where: { id },
      data: { role },
      include: {
        adminServices: {
          include: {
            service: {
              select: { id: true, name: true, displayName: true },
            },
          },
        },
      },
    });

    res.json({ admin });
  } catch (error) {
    console.error('Update admin error:', error);
    res.status(500).json({ error: 'Failed to update admin' });
  }
});

/**
 * POST /admin/admins/:id/services
 * Add service to admin (super admin only)
 * Body: { serviceId, role? }
 */
adminRoutes.post('/admins/:id/services', requireSuperAdmin as RequestHandler, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { serviceId, role } = req.body;

    if (!serviceId) {
      res.status(400).json({ error: 'serviceId is required' });
      return;
    }

    // Get admin's current role
    const admin = await prisma.admin.findUnique({ where: { id } });
    if (!admin) {
      res.status(404).json({ error: 'Admin not found' });
      return;
    }

    // Use provided role or default to admin's global role
    const serviceRole = role || admin.role;

    await prisma.adminService.upsert({
      where: {
        adminId_serviceId: { adminId: id, serviceId },
      },
      update: { role: serviceRole },
      create: { adminId: id, serviceId, role: serviceRole },
    });

    // Return updated admin
    const updatedAdmin = await prisma.admin.findUnique({
      where: { id },
      include: {
        adminServices: {
          include: {
            service: {
              select: { id: true, name: true, displayName: true },
            },
          },
        },
      },
    });

    res.json({ admin: updatedAdmin });
  } catch (error) {
    console.error('Add service to admin error:', error);
    res.status(500).json({ error: 'Failed to add service to admin' });
  }
});

/**
 * DELETE /admin/admins/:id/services/:serviceId
 * Remove service from admin (super admin only)
 */
adminRoutes.delete('/admins/:id/services/:serviceId', requireSuperAdmin as RequestHandler, async (req: AuthenticatedRequest, res) => {
  try {
    const { id, serviceId } = req.params;

    await prisma.adminService.delete({
      where: {
        adminId_serviceId: { adminId: id, serviceId },
      },
    });

    // Return updated admin
    const updatedAdmin = await prisma.admin.findUnique({
      where: { id },
      include: {
        adminServices: {
          include: {
            service: {
              select: { id: true, name: true, displayName: true },
            },
          },
        },
      },
    });

    res.json({ admin: updatedAdmin });
  } catch (error) {
    console.error('Remove service from admin error:', error);
    res.status(500).json({ error: 'Failed to remove service from admin' });
  }
});

// ==================== Statistics (서비스별 필터링 지원) ====================

/**
 * GET /admin/stats/overview
 * Get dashboard overview statistics
 * Query: ?serviceId= (optional)
 */
adminRoutes.get('/stats/overview', async (req: AuthenticatedRequest, res) => {
  try {
    const serviceId = req.query['serviceId'] as string | undefined;
    const serviceFilter = getServiceFilter(serviceId);

    // Calculate active users differently based on whether serviceId is provided
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const [activeUsers, todayUsage, totalUsers, totalModels] = await Promise.all([
      // Active users: service-specific from DB or global from Redis
      serviceId
        ? prisma.usageLog.groupBy({
            by: ['userId'],
            where: {
              serviceId,
              timestamp: { gte: thirtyMinutesAgo },
              user: { loginid: { not: 'anonymous' } },
            },
          }).then((r) => r.length)
        : getActiveUserCount(redis),
      // Redis today usage (전체 시스템)
      getTodayUsage(redis),
      // DB에서 서비스별 사용자 수
      prisma.user.count({
        where: {
          isActive: true,
          loginid: { not: 'anonymous' },
          usageLogs: { some: serviceFilter },
        },
      }),
      // 서비스별 모델 수
      prisma.model.count({
        where: { enabled: true, ...serviceFilter },
      }),
    ]);

    // 서비스별 today's usage (DB에서 계산)
    let serviceTodayUsage = todayUsage;
    if (serviceId) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todayStats = await prisma.usageLog.aggregate({
        where: {
          serviceId,
          timestamp: { gte: todayStart },
        },
        _sum: {
          inputTokens: true,
          outputTokens: true,
          totalTokens: true,
        },
        _count: true,
      });

      serviceTodayUsage = {
        requests: todayStats._count,
        inputTokens: todayStats._sum.inputTokens || 0,
        outputTokens: todayStats._sum.outputTokens || 0,
      };
    }

    res.json({
      activeUsers,
      todayUsage: serviceTodayUsage,
      totalUsers,
      totalModels,
      serviceId: serviceId || null,
    });
  } catch (error) {
    console.error('Get overview stats error:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

/**
 * GET /admin/stats/daily
 * Get daily usage for charts
 * Query: ?serviceId= (optional), ?days=
 */
adminRoutes.get('/stats/daily', async (req: AuthenticatedRequest, res) => {
  try {
    const days = parseInt(req.query['days'] as string) || 30;
    const serviceId = req.query['serviceId'] as string | undefined;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const dailyStats = await prisma.dailyUsageStat.groupBy({
      by: ['date'],
      where: {
        date: { gte: startDate },
        ...getServiceFilter(serviceId),
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
 * Get usage grouped by user (excluding anonymous)
 * Query: ?serviceId= (optional), ?days=
 */
adminRoutes.get('/stats/by-user', async (req: AuthenticatedRequest, res) => {
  try {
    const days = parseInt(req.query['days'] as string) || 30;
    const serviceId = req.query['serviceId'] as string | undefined;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const userStats = await prisma.usageLog.groupBy({
      by: ['userId'],
      where: {
        timestamp: { gte: startDate },
        user: {
          loginid: { not: 'anonymous' },
        },
        ...getServiceFilter(serviceId),
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
 * Query: ?serviceId= (optional), ?days=
 */
adminRoutes.get('/stats/by-model', async (req: AuthenticatedRequest, res) => {
  try {
    const days = parseInt(req.query['days'] as string) || 30;
    const serviceId = req.query['serviceId'] as string | undefined;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const modelStats = await prisma.usageLog.groupBy({
      by: ['modelId'],
      where: {
        timestamp: { gte: startDate },
        ...getServiceFilter(serviceId),
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
 * Query: ?serviceId= (optional), ?days=
 */
adminRoutes.get('/stats/by-dept', async (req: AuthenticatedRequest, res) => {
  try {
    const days = parseInt(req.query['days'] as string) || 30;
    const serviceId = req.query['serviceId'] as string | undefined;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const deptStats = await prisma.dailyUsageStat.groupBy({
      by: ['deptname'],
      where: {
        date: { gte: startDate },
        ...getServiceFilter(serviceId),
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
 * Query: ?serviceId= (optional), ?days= (14-365)
 */
adminRoutes.get('/stats/daily-active-users', async (req: AuthenticatedRequest, res) => {
  try {
    const days = Math.min(365, Math.max(14, parseInt(req.query['days'] as string) || 30));
    const serviceId = req.query['serviceId'] as string | undefined;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Get distinct users per day from usage logs (excluding anonymous)
    let dailyUsers: Array<{ date: Date | string; user_count: bigint }>;

    if (serviceId) {
      dailyUsers = await prisma.$queryRaw`
        SELECT DATE(ul.timestamp) as date, COUNT(DISTINCT ul.user_id) as user_count
        FROM usage_logs ul
        INNER JOIN users u ON ul.user_id = u.id
        WHERE ul.timestamp >= ${startDate}
          AND u.loginid != 'anonymous'
          AND ul.service_id::text = ${serviceId}
        GROUP BY DATE(ul.timestamp)
        ORDER BY date ASC
      `;
    } else {
      dailyUsers = await prisma.$queryRaw`
        SELECT DATE(ul.timestamp) as date, COUNT(DISTINCT ul.user_id) as user_count
        FROM usage_logs ul
        INNER JOIN users u ON ul.user_id = u.id
        WHERE ul.timestamp >= ${startDate}
          AND u.loginid != 'anonymous'
        GROUP BY DATE(ul.timestamp)
        ORDER BY date ASC
      `;
    }

    const chartData = dailyUsers.map((item) => ({
      date: formatDateToString(item.date),
      userCount: Number(item.user_count),
    }));

    // Get total unique users in period
    let totalUsers: Array<{ count: bigint }>;

    if (serviceId) {
      totalUsers = await prisma.$queryRaw`
        SELECT COUNT(DISTINCT ul.user_id) as count
        FROM usage_logs ul
        INNER JOIN users u ON ul.user_id = u.id
        WHERE ul.timestamp >= ${startDate}
          AND u.loginid != 'anonymous'
          AND ul.service_id::text = ${serviceId}
      `;
    } else {
      totalUsers = await prisma.$queryRaw`
        SELECT COUNT(DISTINCT ul.user_id) as count
        FROM usage_logs ul
        INNER JOIN users u ON ul.user_id = u.id
        WHERE ul.timestamp >= ${startDate}
          AND u.loginid != 'anonymous'
      `;
    }

    res.json({
      chartData,
      totalUniqueUsers: Number(totalUsers[0]?.count || 0),
    });
  } catch (error) {
    console.error('Get daily active users error:', error);
    res.status(500).json({ error: 'Failed to get daily active users' });
  }
});

/**
 * GET /admin/stats/cumulative-users
 * Get cumulative unique user count by date
 * Query: ?serviceId= (optional), ?days= (14-365)
 */
adminRoutes.get('/stats/cumulative-users', async (req: AuthenticatedRequest, res) => {
  try {
    const days = Math.min(365, Math.max(14, parseInt(req.query['days'] as string) || 30));
    const serviceId = req.query['serviceId'] as string | undefined;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Get the first usage date for each user
    let userFirstUsage: Array<{ first_date: Date | string; new_users: bigint }>;
    let existingUsers: Array<{ count: bigint }>;

    if (serviceId) {
      userFirstUsage = await prisma.$queryRaw`
        SELECT DATE(first_usage) as first_date, COUNT(*) as new_users
        FROM (
          SELECT ul.user_id, MIN(ul.timestamp) as first_usage
          FROM usage_logs ul
          INNER JOIN users u ON ul.user_id = u.id
          WHERE u.loginid != 'anonymous'
            AND ul.service_id::text = ${serviceId}
          GROUP BY ul.user_id
        ) as user_first
        WHERE first_usage >= ${startDate}
        GROUP BY DATE(first_usage)
        ORDER BY first_date ASC
      `;

      existingUsers = await prisma.$queryRaw`
        SELECT COUNT(DISTINCT ul.user_id) as count
        FROM usage_logs ul
        INNER JOIN users u ON ul.user_id = u.id
        WHERE ul.timestamp < ${startDate}
          AND u.loginid != 'anonymous'
          AND ul.service_id::text = ${serviceId}
      `;
    } else {
      userFirstUsage = await prisma.$queryRaw`
        SELECT DATE(first_usage) as first_date, COUNT(*) as new_users
        FROM (
          SELECT ul.user_id, MIN(ul.timestamp) as first_usage
          FROM usage_logs ul
          INNER JOIN users u ON ul.user_id = u.id
          WHERE u.loginid != 'anonymous'
          GROUP BY ul.user_id
        ) as user_first
        WHERE first_usage >= ${startDate}
        GROUP BY DATE(first_usage)
        ORDER BY first_date ASC
      `;

      existingUsers = await prisma.$queryRaw`
        SELECT COUNT(DISTINCT ul.user_id) as count
        FROM usage_logs ul
        INNER JOIN users u ON ul.user_id = u.id
        WHERE ul.timestamp < ${startDate}
          AND u.loginid != 'anonymous'
      `;
    }

    let cumulativeCount = Number(existingUsers[0]?.count || 0);

    const newUsersMap = new Map(
      userFirstUsage.map((item) => [
        formatDateToString(item.first_date),
        Number(item.new_users),
      ])
    );

    const chartData: Array<{ date: string; cumulativeUsers: number; newUsers: number }> = [];

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
 * Query: ?serviceId= (optional), ?days= (14-365)
 */
adminRoutes.get('/stats/model-daily-trend', async (req: AuthenticatedRequest, res) => {
  try {
    const days = Math.min(365, Math.max(14, parseInt(req.query['days'] as string) || 30));
    const serviceId = req.query['serviceId'] as string | undefined;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Get all models (optionally filtered by service)
    const models = await prisma.model.findMany({
      where: getServiceFilter(serviceId),
      select: { id: true, name: true, displayName: true },
    });

    // Get daily stats grouped by model and date
    let dailyStats: Array<{ date: Date | string; model_id: string; total_tokens: bigint }>;

    if (serviceId) {
      dailyStats = await prisma.$queryRaw`
        SELECT DATE(timestamp) as date, model_id, SUM("totalTokens") as total_tokens
        FROM usage_logs
        WHERE timestamp >= ${startDate}
          AND service_id::text = ${serviceId}
        GROUP BY DATE(timestamp), model_id
        ORDER BY date ASC
      `;
    } else {
      dailyStats = await prisma.$queryRaw`
        SELECT DATE(timestamp) as date, model_id, SUM("totalTokens") as total_tokens
        FROM usage_logs
        WHERE timestamp >= ${startDate}
        GROUP BY DATE(timestamp), model_id
        ORDER BY date ASC
      `;
    }

    // Process into date-keyed structure
    const dateMap = new Map<string, Record<string, number>>();
    const modelIds = models.map((m) => m.id);

    for (let d = new Date(startDate); d <= new Date(); d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]!;
      const initialData: Record<string, number> = {};
      for (const modelId of modelIds) {
        initialData[modelId] = 0;
      }
      dateMap.set(dateStr, initialData);
    }

    for (const stat of dailyStats) {
      const dateStr = formatDateToString(stat.date);
      const existing = dateMap.get(dateStr);
      if (existing) {
        existing[stat.model_id] = Number(stat.total_tokens);
      }
    }

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
 * Query: modelId (required), ?serviceId=, ?days= (14-365), ?topN= (10-100)
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
    const serviceId = req.query['serviceId'] as string | undefined;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Get top N users by total usage for this model
    const topUsers = await prisma.usageLog.groupBy({
      by: ['userId'],
      where: {
        modelId,
        timestamp: { gte: startDate },
        user: {
          loginid: { not: 'anonymous' },
        },
        ...getServiceFilter(serviceId),
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

    // Get daily stats for these users
    let dailyStats: Array<{ date: Date | string; user_id: string; total_tokens: bigint }>;

    if (serviceId) {
      dailyStats = await prisma.$queryRaw`
        SELECT DATE(timestamp) as date, user_id, SUM("totalTokens") as total_tokens
        FROM usage_logs
        WHERE model_id::text = ${modelId}
          AND user_id::text = ANY(${topUserIds})
          AND timestamp >= ${startDate}
          AND service_id::text = ${serviceId}
        GROUP BY DATE(timestamp), user_id
        ORDER BY date ASC
      `;
    } else {
      dailyStats = await prisma.$queryRaw`
        SELECT DATE(timestamp) as date, user_id, SUM("totalTokens") as total_tokens
        FROM usage_logs
        WHERE model_id::text = ${modelId}
          AND user_id::text = ANY(${topUserIds})
          AND timestamp >= ${startDate}
        GROUP BY DATE(timestamp), user_id
        ORDER BY date ASC
      `;
    }

    // Process into date-keyed structure
    const dateMap = new Map<string, Record<string, number>>();

    for (let d = new Date(startDate); d <= new Date(); d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]!;
      const initialData: Record<string, number> = {};
      for (const userId of topUserIds) {
        initialData[userId] = 0;
      }
      dateMap.set(dateStr, initialData);
    }

    for (const stat of dailyStats) {
      const dateStr = formatDateToString(stat.date);
      const existing = dateMap.get(dateStr);
      if (existing) {
        existing[stat.user_id] = Number(stat.total_tokens);
      }
    }

    const chartData = Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, userUsage]) => ({
        date,
        ...userUsage,
      }));

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

// ==================== Global Statistics (전체 서비스 통합) ====================

/**
 * GET /admin/stats/global/overview
 * 전체 서비스 통합 통계 (Main Dashboard용)
 */
adminRoutes.get('/stats/global/overview', async (_req: AuthenticatedRequest, res) => {
  try {
    // Get all services with stats
    const services = await prisma.service.findMany({
      where: { enabled: true },
      select: {
        id: true,
        name: true,
        displayName: true,
        _count: {
          select: {
            models: true,
            usageLogs: true,
          },
        },
      },
    });

    // Get per-service statistics
    const serviceStats = await Promise.all(
      services.map(async (service) => {
        const [totalUsers, todayRequests, avgDailyUsers, totalTokens] = await Promise.all([
          // Total unique users for this service
          prisma.usageLog.groupBy({
            by: ['userId'],
            where: {
              serviceId: service.id,
              user: { loginid: { not: 'anonymous' } },
            },
          }).then((r) => r.length),

          // Today's requests
          prisma.usageLog.count({
            where: {
              serviceId: service.id,
              timestamp: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
            },
          }),

          // Average daily active users (last 30 days, excluding anonymous)
          prisma.$queryRaw<Array<{ avg_users: number }>>`
            SELECT COALESCE(AVG(user_count), 0)::float as avg_users
            FROM (
              SELECT DATE(ul.timestamp), COUNT(DISTINCT ul.user_id) as user_count
              FROM usage_logs ul
              INNER JOIN users u ON ul.user_id = u.id
              WHERE ul.service_id::text = ${service.id}
                AND ul.timestamp >= NOW() - INTERVAL '30 days'
                AND u.loginid != 'anonymous'
              GROUP BY DATE(ul.timestamp)
            ) daily_counts
          `.then((r) => Math.round(r[0]?.avg_users || 0)),

          // Total tokens
          prisma.usageLog.aggregate({
            where: { serviceId: service.id },
            _sum: { totalTokens: true },
          }).then((r) => r._sum.totalTokens || 0),
        ]);

        return {
          serviceId: service.id,
          serviceName: service.name,
          serviceDisplayName: service.displayName,
          totalUsers,
          todayRequests,
          avgDailyActiveUsers: avgDailyUsers,  // Fixed: renamed to match frontend
          totalTokens,
          totalModels: service._count.models,
        };
      })
    );

    // Overall totals - deduplicate users across services
    const [uniqueUsersResult, avgDailyActiveResult] = await Promise.all([
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT user_id) as count
        FROM usage_logs ul
        INNER JOIN users u ON ul.user_id = u.id
        WHERE u.loginid != 'anonymous'
      `,
      // Average daily active users (deduplicated across all services)
      prisma.$queryRaw<Array<{ avg_users: number }>>`
        SELECT COALESCE(AVG(user_count), 0)::float as avg_users
        FROM (
          SELECT DATE(ul.timestamp), COUNT(DISTINCT ul.user_id) as user_count
          FROM usage_logs ul
          INNER JOIN users u ON ul.user_id = u.id
          WHERE u.loginid != 'anonymous'
            AND ul.timestamp >= NOW() - INTERVAL '30 days'
          GROUP BY DATE(ul.timestamp)
        ) daily_counts
      `,
    ]);
    const uniqueTotalUsers = Number(uniqueUsersResult[0]?.count || 0);
    const avgDailyActive = Math.round(avgDailyActiveResult[0]?.avg_users || 0);

    const totals = {
      totalServices: services.length,
      totalUsers: uniqueTotalUsers,  // Deduplicated across all services
      avgDailyActiveUsers: avgDailyActive,  // Deduplicated daily active users
      totalRequests: serviceStats.reduce((sum, s) => sum + s.todayRequests, 0),
      totalTokens: serviceStats.reduce((sum, s) => sum + Number(s.totalTokens), 0),
    };

    res.json({
      services: serviceStats,
      totals,
    });
  } catch (error) {
    console.error('Get global overview error:', error);
    res.status(500).json({ error: 'Failed to get global overview' });
  }
});

/**
 * GET /admin/stats/global/by-service
 * 서비스별 누적 사용량 (시계열)
 * Query: ?days= (14-365)
 */
adminRoutes.get('/stats/global/by-service', async (req: AuthenticatedRequest, res) => {
  try {
    const days = Math.min(365, Math.max(14, parseInt(req.query['days'] as string) || 30));
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Get all services
    const services = await prisma.service.findMany({
      where: { enabled: true },
      select: { id: true, name: true, displayName: true },
    });

    // Get daily stats per service
    const dailyStats = await prisma.$queryRaw<
      Array<{ date: Date | string; service_id: string; total_tokens: bigint }>
    >`
      SELECT DATE(timestamp) as date, service_id, SUM("totalTokens") as total_tokens
      FROM usage_logs
      WHERE timestamp >= ${startDate}
        AND service_id IS NOT NULL
      GROUP BY DATE(timestamp), service_id
      ORDER BY date ASC
    `;

    // Process into chart data
    const dateMap = new Map<string, Record<string, number>>();
    const serviceIds = services.map((s) => s.id);

    for (let d = new Date(startDate); d <= new Date(); d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]!;
      const initialData: Record<string, number> = {};
      for (const serviceId of serviceIds) {
        initialData[serviceId] = 0;
      }
      dateMap.set(dateStr, initialData);
    }

    for (const stat of dailyStats) {
      const dateStr = formatDateToString(stat.date);
      const existing = dateMap.get(dateStr);
      if (existing && stat.service_id) {
        existing[stat.service_id] = Number(stat.total_tokens);
      }
    }

    const chartData = Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, serviceUsage]) => ({
        date,
        ...serviceUsage,
      }));

    res.json({
      services: services.map((s) => ({ id: s.id, name: s.name, displayName: s.displayName })),
      chartData,
    });
  } catch (error) {
    console.error('Get global by-service stats error:', error);
    res.status(500).json({ error: 'Failed to get service statistics' });
  }
});

/**
 * GET /admin/stats/global/by-dept
 * 사업부별 통합 통계 (Main Dashboard용)
 * Query: ?days= (30), ?serviceId= (optional)
 *
 * 집계 기준: business_unit (deptname에서 추출된 사업부명)
 * 예: "AI플랫폼팀(DS)" → business_unit = "DS"
 */
adminRoutes.get('/stats/global/by-dept', async (req: AuthenticatedRequest, res) => {
  try {
    const days = parseInt(req.query['days'] as string) || 30;
    const serviceId = req.query['serviceId'] as string | undefined;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Get business unit statistics (using business_unit field)
    let buUsers: Array<{ business_unit: string; user_count: bigint }>;
    let buDailyAvg: Array<{ business_unit: string; avg_daily_users: number }>;
    let buModelTokens: Array<{ business_unit: string; model_name: string; total_tokens: bigint }>;

    // 1. 사업부별 누적 사용자 (중복 제거)
    if (serviceId) {
      buUsers = await prisma.$queryRaw`
        SELECT u.business_unit, COUNT(DISTINCT ul.user_id) as user_count
        FROM usage_logs ul
        INNER JOIN users u ON ul.user_id = u.id
        WHERE u.loginid != 'anonymous'
          AND u.business_unit IS NOT NULL
          AND u.business_unit != ''
          AND ul.service_id::text = ${serviceId}
        GROUP BY u.business_unit
        ORDER BY user_count DESC
      `;
    } else {
      buUsers = await prisma.$queryRaw`
        SELECT u.business_unit, COUNT(DISTINCT ul.user_id) as user_count
        FROM usage_logs ul
        INNER JOIN users u ON ul.user_id = u.id
        WHERE u.loginid != 'anonymous'
          AND u.business_unit IS NOT NULL
          AND u.business_unit != ''
        GROUP BY u.business_unit
        ORDER BY user_count DESC
      `;
    }

    // 2. 사업부별 평균 일별 활성 사용자
    if (serviceId) {
      buDailyAvg = await prisma.$queryRaw`
        SELECT business_unit, COALESCE(AVG(daily_count), 0)::float as avg_daily_users
        FROM (
          SELECT u.business_unit, DATE(ul.timestamp), COUNT(DISTINCT ul.user_id) as daily_count
          FROM usage_logs ul
          INNER JOIN users u ON ul.user_id = u.id
          WHERE u.loginid != 'anonymous'
            AND u.business_unit IS NOT NULL
            AND u.business_unit != ''
            AND ul.timestamp >= ${startDate}
            AND ul.service_id::text = ${serviceId}
          GROUP BY u.business_unit, DATE(ul.timestamp)
        ) daily_stats
        GROUP BY business_unit
      `;
    } else {
      buDailyAvg = await prisma.$queryRaw`
        SELECT business_unit, COALESCE(AVG(daily_count), 0)::float as avg_daily_users
        FROM (
          SELECT u.business_unit, DATE(ul.timestamp), COUNT(DISTINCT ul.user_id) as daily_count
          FROM usage_logs ul
          INNER JOIN users u ON ul.user_id = u.id
          WHERE u.loginid != 'anonymous'
            AND u.business_unit IS NOT NULL
            AND u.business_unit != ''
            AND ul.timestamp >= ${startDate}
          GROUP BY u.business_unit, DATE(ul.timestamp)
        ) daily_stats
        GROUP BY business_unit
      `;
    }

    // 3. 사업부별 모델별 토큰 사용량
    if (serviceId) {
      buModelTokens = await prisma.$queryRaw`
        SELECT u.business_unit, m.name as model_name, SUM(ul."totalTokens") as total_tokens
        FROM usage_logs ul
        INNER JOIN users u ON ul.user_id = u.id
        INNER JOIN models m ON ul.model_id = m.id
        WHERE u.loginid != 'anonymous'
          AND u.business_unit IS NOT NULL
          AND u.business_unit != ''
          AND ul.service_id::text = ${serviceId}
        GROUP BY u.business_unit, m.name
        ORDER BY u.business_unit, total_tokens DESC
      `;
    } else {
      buModelTokens = await prisma.$queryRaw`
        SELECT u.business_unit, m.name as model_name, SUM(ul."totalTokens") as total_tokens
        FROM usage_logs ul
        INNER JOIN users u ON ul.user_id = u.id
        INNER JOIN models m ON ul.model_id = m.id
        WHERE u.loginid != 'anonymous'
          AND u.business_unit IS NOT NULL
          AND u.business_unit != ''
        GROUP BY u.business_unit, m.name
        ORDER BY u.business_unit, total_tokens DESC
      `;
    }

    // Combine into single response
    const buUserMap = new Map(buUsers.map((d) => [d.business_unit, Number(d.user_count)]));
    const buAvgMap = new Map(buDailyAvg.map((d) => [d.business_unit, Math.round(d.avg_daily_users || 0)]));

    // Group model tokens by business unit
    const buTokensMap = new Map<string, Record<string, number>>();
    for (const row of buModelTokens) {
      if (!buTokensMap.has(row.business_unit)) {
        buTokensMap.set(row.business_unit, {});
      }
      buTokensMap.get(row.business_unit)![row.model_name] = Number(row.total_tokens);
    }

    // Build final result
    const allBUs = [...new Set([...buUserMap.keys(), ...buAvgMap.keys(), ...buTokensMap.keys()])];

    const deptStats = allBUs
      .map((businessUnit) => {
        const tokensObj = buTokensMap.get(businessUnit) || {};
        const tokensByModel = Object.entries(tokensObj)
          .map(([modelName, tokens]) => ({ modelName, tokens }))
          .sort((a, b) => b.tokens - a.tokens);
        return {
          deptname: businessUnit,  // Keep field name for frontend compatibility
          cumulativeUsers: buUserMap.get(businessUnit) || 0,
          avgDailyActiveUsers: buAvgMap.get(businessUnit) || 0,
          tokensByModel,
          totalTokens: tokensByModel.reduce((sum, t) => sum + t.tokens, 0),
        };
      })
      .sort((a, b) => b.totalTokens - a.totalTokens);

    res.json({
      deptStats,
      totalDepts: deptStats.length,
      periodDays: days,
      serviceId: serviceId || null,
    });
  } catch (error) {
    console.error('Get global by-dept stats error:', error);
    res.status(500).json({ error: 'Failed to get department statistics' });
  }
});

/**
 * GET /admin/stats/global/by-dept-daily
 * 사업부별 일별 토큰 사용량 (시계열 - Line Chart용)
 * Query: ?days= (30), ?serviceId= (optional), ?topN= (5)
 */
adminRoutes.get('/stats/global/by-dept-daily', async (req: AuthenticatedRequest, res) => {
  try {
    const days = parseInt(req.query['days'] as string) || 30;
    const serviceId = req.query['serviceId'] as string | undefined;
    const topN = Math.min(10, Math.max(3, parseInt(req.query['topN'] as string) || 5));

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // 1. Get top N business units by total tokens
    let topBUs: Array<{ business_unit: string; total_tokens: bigint }>;

    if (serviceId) {
      topBUs = await prisma.$queryRaw`
        SELECT u.business_unit, SUM(ul."totalTokens") as total_tokens
        FROM usage_logs ul
        INNER JOIN users u ON ul.user_id = u.id
        WHERE u.loginid != 'anonymous'
          AND u.business_unit IS NOT NULL
          AND u.business_unit != ''
          AND ul.timestamp >= ${startDate}
          AND ul.service_id::text = ${serviceId}
        GROUP BY u.business_unit
        ORDER BY total_tokens DESC
        LIMIT ${topN}
      `;
    } else {
      topBUs = await prisma.$queryRaw`
        SELECT u.business_unit, SUM(ul."totalTokens") as total_tokens
        FROM usage_logs ul
        INNER JOIN users u ON ul.user_id = u.id
        WHERE u.loginid != 'anonymous'
          AND u.business_unit IS NOT NULL
          AND u.business_unit != ''
          AND ul.timestamp >= ${startDate}
        GROUP BY u.business_unit
        ORDER BY total_tokens DESC
        LIMIT ${topN}
      `;
    }

    const topBUNames = topBUs.map(b => b.business_unit);

    // 2. Get daily stats for top business units
    let dailyStats: Array<{ date: Date; business_unit: string; total_tokens: bigint }>;

    if (serviceId) {
      dailyStats = await prisma.$queryRaw`
        SELECT DATE(ul.timestamp) as date, u.business_unit, SUM(ul."totalTokens") as total_tokens
        FROM usage_logs ul
        INNER JOIN users u ON ul.user_id = u.id
        WHERE u.loginid != 'anonymous'
          AND u.business_unit = ANY(${topBUNames})
          AND ul.timestamp >= ${startDate}
          AND ul.service_id::text = ${serviceId}
        GROUP BY DATE(ul.timestamp), u.business_unit
        ORDER BY date ASC
      `;
    } else {
      dailyStats = await prisma.$queryRaw`
        SELECT DATE(ul.timestamp) as date, u.business_unit, SUM(ul."totalTokens") as total_tokens
        FROM usage_logs ul
        INNER JOIN users u ON ul.user_id = u.id
        WHERE u.loginid != 'anonymous'
          AND u.business_unit = ANY(${topBUNames})
          AND ul.timestamp >= ${startDate}
        GROUP BY DATE(ul.timestamp), u.business_unit
        ORDER BY date ASC
      `;
    }

    // 3. Build response with CUMULATIVE data
    const dailyMap = new Map<string, Record<string, number>>();

    // Initialize all dates with 0 for all BUs
    for (let d = new Date(startDate); d <= new Date(); d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]!;
      const initialData: Record<string, number> = {};
      for (const bu of topBUNames) {
        initialData[bu] = 0;
      }
      dailyMap.set(dateStr, initialData);
    }

    // Fill in daily data first
    for (const stat of dailyStats) {
      const dateStr = formatDateToString(stat.date);
      const existing = dailyMap.get(dateStr);
      if (existing) {
        existing[stat.business_unit] = Number(stat.total_tokens);
      }
    }

    // Convert to cumulative
    const sortedDates = Array.from(dailyMap.keys()).sort();
    const cumulativeSum: Record<string, number> = {};
    for (const bu of topBUNames) {
      cumulativeSum[bu] = 0;
    }

    const chartData = sortedDates.map((date) => {
      const dailyData = dailyMap.get(date)!;
      const result: Record<string, string | number> = { date };
      for (const bu of topBUNames) {
        cumulativeSum[bu] += dailyData[bu] || 0;
        result[bu] = cumulativeSum[bu];
      }
      return result;
    });

    res.json({
      businessUnits: topBUNames,
      chartData,
      periodDays: days,
      serviceId: serviceId || null,
    });
  } catch (error) {
    console.error('Get dept daily stats error:', error);
    res.status(500).json({ error: 'Failed to get department daily statistics' });
  }
});

/**
 * GET /admin/stats/global/by-dept-users-daily
 * 사업부별 일별 사용자 수 (누적/활성 - Line Chart용)
 * Query: ?days= (30), ?topN= (5)
 */
adminRoutes.get('/stats/global/by-dept-users-daily', async (req: AuthenticatedRequest, res) => {
  try {
    const days = parseInt(req.query['days'] as string) || 30;
    const topN = Math.min(10, Math.max(3, parseInt(req.query['topN'] as string) || 5));

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // 1. Get top N business units by total users
    const topBUs = await prisma.$queryRaw<Array<{ business_unit: string; user_count: bigint }>>`
      SELECT u.business_unit, COUNT(DISTINCT ul.user_id) as user_count
      FROM usage_logs ul
      INNER JOIN users u ON ul.user_id = u.id
      WHERE u.loginid != 'anonymous'
        AND u.business_unit IS NOT NULL
        AND u.business_unit != ''
        AND ul.timestamp >= ${startDate}
      GROUP BY u.business_unit
      ORDER BY user_count DESC
      LIMIT ${topN}
    `;

    const topBUNames = topBUs.map(b => b.business_unit);

    // 2. Get daily active users for top business units
    const dailyStats = await prisma.$queryRaw<Array<{ date: Date; business_unit: string; active_users: bigint }>>`
      SELECT DATE(ul.timestamp) as date, u.business_unit, COUNT(DISTINCT ul.user_id) as active_users
      FROM usage_logs ul
      INNER JOIN users u ON ul.user_id = u.id
      WHERE u.loginid != 'anonymous'
        AND u.business_unit = ANY(${topBUNames})
        AND ul.timestamp >= ${startDate}
      GROUP BY DATE(ul.timestamp), u.business_unit
      ORDER BY date ASC
    `;

    // 3. Build response with cumulative users
    const cumulativeUsers = new Map<string, Set<string>>(); // Track unique users per BU

    // Initialize
    for (const bu of topBUNames) {
      cumulativeUsers.set(bu, new Set());
    }

    // Get all user_ids per day per BU for cumulative calculation
    const usersByDayBU = await prisma.$queryRaw<Array<{ date: Date; business_unit: string; user_id: string }>>`
      SELECT DISTINCT DATE(ul.timestamp) as date, u.business_unit, ul.user_id::text
      FROM usage_logs ul
      INNER JOIN users u ON ul.user_id = u.id
      WHERE u.loginid != 'anonymous'
        AND u.business_unit = ANY(${topBUNames})
        AND ul.timestamp >= ${startDate}
      ORDER BY date ASC
    `;

    // Group users by date and BU
    const usersByDateBU = new Map<string, Map<string, string[]>>();
    for (const row of usersByDayBU) {
      const dateStr = formatDateToString(row.date);
      if (!usersByDateBU.has(dateStr)) {
        usersByDateBU.set(dateStr, new Map());
      }
      const buMap = usersByDateBU.get(dateStr)!;
      if (!buMap.has(row.business_unit)) {
        buMap.set(row.business_unit, []);
      }
      buMap.get(row.business_unit)!.push(row.user_id);
    }

    // Build chart data with proper cumulative calculation
    const chartData: Array<Record<string, string | number>> = [];

    for (let d = new Date(startDate); d <= new Date(); d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]!;
      const dayData = usersByDateBU.get(dateStr);

      // Add users from this day to cumulative sets
      if (dayData) {
        for (const [bu, userIds] of dayData.entries()) {
          const buSet = cumulativeUsers.get(bu);
          if (buSet) {
            for (const userId of userIds) {
              buSet.add(userId);
            }
          }
        }
      }

      // Create data point with current cumulative values
      const item: Record<string, string | number> = { date: dateStr };
      for (const bu of topBUNames) {
        item[`${bu}_cumulative`] = cumulativeUsers.get(bu)?.size || 0;
        item[`${bu}_active`] = 0; // Will be filled below
      }
      chartData.push(item);
    }

    // Fill in active users
    for (const stat of dailyStats) {
      const dateStr = formatDateToString(stat.date);
      const dataPoint = chartData.find(d => d.date === dateStr);
      if (dataPoint) {
        dataPoint[`${stat.business_unit}_active`] = Number(stat.active_users);
      }
    }

    res.json({
      businessUnits: topBUNames,
      chartData,
      periodDays: days,
    });
  } catch (error) {
    console.error('Get dept users daily stats error:', error);
    res.status(500).json({ error: 'Failed to get department users daily statistics' });
  }
});

/**
 * GET /admin/stats/global/by-dept-service-requests-daily
 * 사업부+서비스별 일별 API 요청수 (Line Chart용)
 * Query: ?days= (30), ?topN= (5)
 */
adminRoutes.get('/stats/global/by-dept-service-requests-daily', async (req: AuthenticatedRequest, res) => {
  try {
    const days = parseInt(req.query['days'] as string) || 30;
    const topN = Math.min(10, Math.max(3, parseInt(req.query['topN'] as string) || 5));

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // 1. Get top N dept+service combinations by request count
    const topCombos = await prisma.$queryRaw<Array<{ business_unit: string; service_name: string; request_count: bigint }>>`
      SELECT u.business_unit, s.name as service_name, COUNT(*) as request_count
      FROM usage_logs ul
      INNER JOIN users u ON ul.user_id = u.id
      INNER JOIN services s ON ul.service_id = s.id
      WHERE u.loginid != 'anonymous'
        AND u.business_unit IS NOT NULL
        AND u.business_unit != ''
        AND ul.timestamp >= ${startDate}
      GROUP BY u.business_unit, s.name
      ORDER BY request_count DESC
      LIMIT ${topN}
    `;

    const comboNames = topCombos.map(c => `${c.business_unit}/${c.service_name}`);
    const topBUs = [...new Set(topCombos.map(c => c.business_unit))];
    const topServices = [...new Set(topCombos.map(c => c.service_name))];

    // 2. Get daily requests for top business units and services
    const dailyStats = await prisma.$queryRaw<Array<{ date: Date; business_unit: string; service_name: string; requests: bigint }>>`
      SELECT DATE(ul.timestamp) as date, u.business_unit, s.name as service_name, COUNT(*) as requests
      FROM usage_logs ul
      INNER JOIN users u ON ul.user_id = u.id
      INNER JOIN services s ON ul.service_id = s.id
      WHERE u.loginid != 'anonymous'
        AND ul.timestamp >= ${startDate}
        AND u.business_unit = ANY(${topBUs})
        AND s.name = ANY(${topServices})
      GROUP BY DATE(ul.timestamp), u.business_unit, s.name
      ORDER BY date ASC
    `;

    // 3. Build response with CUMULATIVE data
    const dailyMap = new Map<string, Record<string, number>>();

    for (let d = new Date(startDate); d <= new Date(); d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]!;
      const initialData: Record<string, number> = {};
      for (const combo of comboNames) {
        initialData[combo] = 0;
      }
      dailyMap.set(dateStr, initialData);
    }

    for (const stat of dailyStats) {
      const dateStr = formatDateToString(stat.date);
      const comboKey = `${stat.business_unit}/${stat.service_name}`;
      const existing = dailyMap.get(dateStr);
      if (existing && comboNames.includes(comboKey)) {
        existing[comboKey] = Number(stat.requests);
      }
    }

    // Convert to cumulative
    const sortedDates = Array.from(dailyMap.keys()).sort();
    const cumulativeSum: Record<string, number> = {};
    for (const combo of comboNames) {
      cumulativeSum[combo] = 0;
    }

    const chartData = sortedDates.map((date) => {
      const dailyData = dailyMap.get(date)!;
      const result: Record<string, string | number> = { date };
      for (const combo of comboNames) {
        cumulativeSum[combo] += dailyData[combo] || 0;
        result[combo] = cumulativeSum[combo];
      }
      return result;
    });

    res.json({
      combinations: comboNames,
      chartData,
      periodDays: days,
    });
  } catch (error) {
    console.error('Get dept-service requests daily stats error:', error);
    res.status(500).json({ error: 'Failed to get department-service requests daily statistics' });
  }
});

// ==================== User Promotion ====================

/**
 * GET /admin/users/:id/admin-status
 * 사용자의 admin 상태 조회
 */
adminRoutes.get('/users/:id/admin-status', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: { loginid: true, username: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // 환경변수 개발자 체크
    const isEnvDeveloper = isDeveloper(user.loginid);
    if (isEnvDeveloper) {
      res.json({
        isAdmin: true,
        adminRole: 'SUPER_ADMIN',
        isDeveloper: true,
        canModify: false,
      });
      return;
    }

    // DB admin 체크
    const admin = await prisma.admin.findUnique({
      where: { loginid: user.loginid },
      include: {
        adminServices: {
          include: {
            service: {
              select: { id: true, name: true, displayName: true },
            },
          },
        },
      },
    });

    res.json({
      isAdmin: !!admin,
      adminRole: admin?.role || null,
      isDeveloper: false,
      canModify: true,
      adminServices: admin?.adminServices || [],
    });
  } catch (error) {
    console.error('Get user admin status error:', error);
    res.status(500).json({ error: 'Failed to get admin status' });
  }
});

/**
 * POST /admin/users/:id/promote
 * 사용자를 Admin으로 승격 (SUPER_ADMIN만)
 * Body: { role: 'ADMIN' | 'VIEWER', serviceId?: string }
 */
adminRoutes.post('/users/:id/promote', requireSuperAdmin as RequestHandler, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { role, serviceId } = req.body;

    if (!role || !['ADMIN', 'VIEWER'].includes(role)) {
      res.status(400).json({ error: 'role must be ADMIN or VIEWER' });
      return;
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id },
      select: { loginid: true, username: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // 환경변수 개발자는 승격 불가
    if (isDeveloper(user.loginid)) {
      res.status(400).json({ error: 'Environment developers are already SUPER_ADMIN' });
      return;
    }

    // Upsert admin record
    const admin = await prisma.admin.upsert({
      where: { loginid: user.loginid },
      update: { role },
      create: {
        loginid: user.loginid,
        role,
      },
    });

    // If serviceId provided, add service-specific permission
    if (serviceId) {
      await prisma.adminService.upsert({
        where: {
          adminId_serviceId: { adminId: admin.id, serviceId },
        },
        update: { role },
        create: { adminId: admin.id, serviceId, role },
      });
    }

    res.json({
      success: true,
      admin,
      message: `${user.username} promoted to ${role}${serviceId ? ' for service' : ''}`,
    });
  } catch (error) {
    console.error('Promote user error:', error);
    res.status(500).json({ error: 'Failed to promote user' });
  }
});

/**
 * DELETE /admin/users/:id/demote
 * Admin 권한 해제 (SUPER_ADMIN만)
 * Query: ?serviceId= (optional - 특정 서비스만 해제)
 */
adminRoutes.delete('/users/:id/demote', requireSuperAdmin as RequestHandler, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const serviceId = req.query['serviceId'] as string | undefined;

    // Get user
    const user = await prisma.user.findUnique({
      where: { id },
      select: { loginid: true, username: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // 환경변수 개발자는 해제 불가
    if (isDeveloper(user.loginid)) {
      res.status(400).json({ error: 'Cannot demote environment developers' });
      return;
    }

    const admin = await prisma.admin.findUnique({
      where: { loginid: user.loginid },
    });

    if (!admin) {
      res.status(400).json({ error: 'User is not an admin' });
      return;
    }

    if (serviceId) {
      // Remove only service-specific permission
      await prisma.adminService.deleteMany({
        where: { adminId: admin.id, serviceId },
      });

      res.json({
        success: true,
        message: `${user.username} removed from service admin`,
      });
    } else {
      // Remove entire admin record (and all service permissions)
      await prisma.admin.delete({
        where: { loginid: user.loginid },
      });

      res.json({
        success: true,
        message: `${user.username} demoted from admin`,
      });
    }
  } catch (error) {
    console.error('Demote user error:', error);
    res.status(500).json({ error: 'Failed to demote user' });
  }
});

// ==================== Unified Users Management ====================

/**
 * GET /admin/unified-users
 * 통합 사용자 관리 목록 (SUPER_ADMIN만)
 * Query: ?page=, ?limit=, ?serviceId=, ?businessUnit=, ?deptname=, ?role=, ?search=
 */
adminRoutes.get('/unified-users', requireSuperAdmin as RequestHandler, async (req: AuthenticatedRequest, res) => {
  try {
    const page = parseInt(req.query['page'] as string) || 1;
    const limit = parseInt(req.query['limit'] as string) || 50;
    const skip = (page - 1) * limit;
    const serviceId = req.query['serviceId'] as string | undefined;
    const businessUnit = req.query['businessUnit'] as string | undefined;
    const deptname = req.query['deptname'] as string | undefined;
    const role = req.query['role'] as string | undefined;
    const search = req.query['search'] as string | undefined;

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {
      loginid: { not: 'anonymous' },
    };

    if (businessUnit) {
      whereClause['businessUnit'] = businessUnit;
    }

    if (deptname) {
      whereClause['deptname'] = { contains: deptname, mode: 'insensitive' };
    }

    if (search) {
      whereClause['OR'] = [
        { loginid: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
        { deptname: { contains: search, mode: 'insensitive' } },
      ];
    }

    // If serviceId filter, only users with activity in that service
    if (serviceId) {
      whereClause['userServices'] = {
        some: { serviceId },
      };
    }

    // Get users with pagination
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { lastActive: 'desc' },
        include: {
          userServices: {
            include: {
              service: {
                select: { id: true, name: true, displayName: true },
              },
            },
          },
        },
      }),
      prisma.user.count({ where: whereClause }),
    ]);

    // Get admin info for all users
    const loginids = users.map((u) => u.loginid);
    const admins = await prisma.admin.findMany({
      where: { loginid: { in: loginids } },
      include: {
        adminServices: {
          include: {
            service: {
              select: { id: true, name: true, displayName: true },
            },
          },
        },
      },
    });
    const adminMap = new Map(admins.map((a) => [a.loginid, a]));

    // Get developers from env
    const developers = (process.env['DEVELOPERS'] || '').split(',').map((d) => d.trim()).filter(Boolean);

    // Map users with role info
    const usersWithRoles = users.map((user) => {
      const admin = adminMap.get(user.loginid);
      const isEnvDeveloper = developers.includes(user.loginid);

      let globalRole: string | null = null;
      let servicePermissions: Array<{ serviceId: string; serviceName: string; role: string }> = [];

      if (isEnvDeveloper) {
        globalRole = 'SUPER_ADMIN';
      } else if (admin) {
        globalRole = admin.role;
        servicePermissions = admin.adminServices.map((as) => ({
          serviceId: as.serviceId,
          serviceName: as.service.displayName,
          role: as.role,
        }));
      }

      // Service stats from userServices
      const serviceStats = user.userServices.map((us) => ({
        serviceId: us.serviceId,
        serviceName: us.service.displayName,
        firstSeen: us.firstSeen,
        lastActive: us.lastActive,
        requestCount: us.requestCount,
      }));

      const totalRequests = serviceStats.reduce((sum, s) => sum + s.requestCount, 0);

      return {
        id: user.id,
        loginid: user.loginid,
        username: user.username,
        deptname: user.deptname,
        businessUnit: user.businessUnit,
        globalRole,
        isEnvDeveloper,
        servicePermissions,
        serviceStats,
        totalRequests,
        firstSeen: user.firstSeen,
        lastActive: user.lastActive,
      };
    });

    // Filter by role if specified
    let filteredUsers = usersWithRoles;
    if (role) {
      if (role === 'USER') {
        filteredUsers = usersWithRoles.filter((u) => !u.globalRole);
      } else {
        filteredUsers = usersWithRoles.filter((u) => u.globalRole === role);
      }
    }

    // Get filter options
    const [services, businessUnits, deptnames] = await Promise.all([
      prisma.service.findMany({
        where: { enabled: true },
        select: { id: true, name: true, displayName: true },
      }),
      prisma.user.groupBy({
        by: ['businessUnit'],
        where: {
          businessUnit: { not: null },
          loginid: { not: 'anonymous' },
        },
        _count: true,
      }),
      prisma.user.groupBy({
        by: ['deptname'],
        where: {
          deptname: { not: '' },
          loginid: { not: 'anonymous' },
        },
        _count: true,
        orderBy: { _count: { deptname: 'desc' } },
        take: 50,
      }),
    ]);

    res.json({
      users: filteredUsers,
      pagination: {
        page,
        limit,
        total: role ? filteredUsers.length : total,
        totalPages: Math.ceil((role ? filteredUsers.length : total) / limit),
      },
      filterOptions: {
        services: services.map((s) => ({ id: s.id, name: s.name, displayName: s.displayName })),
        businessUnits: businessUnits
          .filter((b) => b.businessUnit)
          .map((b) => b.businessUnit!)
          .sort(),
        deptnames: deptnames.map((d) => d.deptname).sort(),
        roles: ['SUPER_ADMIN', 'SERVICE_ADMIN', 'VIEWER', 'SERVICE_VIEWER', 'USER'],
      },
    });
  } catch (error) {
    console.error('Get unified users error:', error);
    res.status(500).json({ error: 'Failed to get unified users' });
  }
});

/**
 * PUT /admin/unified-users/:id/permissions
 * 사용자 권한 변경 (SUPER_ADMIN만)
 * Body: { globalRole?: string, servicePermissions?: [{ serviceId, role }] }
 */
adminRoutes.put('/unified-users/:id/permissions', requireSuperAdmin as RequestHandler, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { globalRole, servicePermissions } = req.body;

    // Get user
    const user = await prisma.user.findUnique({
      where: { id },
      select: { loginid: true, username: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Check if env developer
    if (isDeveloper(user.loginid)) {
      res.status(400).json({ error: 'Cannot modify environment developer permissions' });
      return;
    }

    // Validate role
    const validRoles = ['SUPER_ADMIN', 'SERVICE_ADMIN', 'VIEWER', 'SERVICE_VIEWER'];
    if (globalRole && !validRoles.includes(globalRole)) {
      res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
      return;
    }

    // Get or create admin record
    let admin = await prisma.admin.findUnique({
      where: { loginid: user.loginid },
    });

    if (globalRole) {
      // Update or create admin with global role
      admin = await prisma.admin.upsert({
        where: { loginid: user.loginid },
        update: { role: globalRole },
        create: {
          loginid: user.loginid,
          role: globalRole,
        },
      });
    } else if (admin && !servicePermissions?.length) {
      // Remove admin entirely if no role and no service permissions
      await prisma.admin.delete({
        where: { loginid: user.loginid },
      });
      admin = null;
    }

    // Update service permissions
    if (admin && servicePermissions && Array.isArray(servicePermissions)) {
      // Remove existing service permissions
      await prisma.adminService.deleteMany({
        where: { adminId: admin.id },
      });

      // Add new service permissions
      for (const sp of servicePermissions) {
        if (sp.serviceId && sp.role) {
          await prisma.adminService.create({
            data: {
              adminId: admin.id,
              serviceId: sp.serviceId,
              role: sp.role,
            },
          });
        }
      }
    }

    // Get updated admin with services
    const updatedAdmin = admin
      ? await prisma.admin.findUnique({
          where: { id: admin.id },
          include: {
            adminServices: {
              include: {
                service: {
                  select: { id: true, name: true, displayName: true },
                },
              },
            },
          },
        })
      : null;

    res.json({
      success: true,
      user: {
        id: user.loginid,
        username: user.username,
        globalRole: updatedAdmin?.role || null,
        servicePermissions: updatedAdmin?.adminServices.map((as) => ({
          serviceId: as.serviceId,
          serviceName: as.service.displayName,
          role: as.role,
        })) || [],
      },
    });
  } catch (error) {
    console.error('Update user permissions error:', error);
    res.status(500).json({ error: 'Failed to update permissions' });
  }
});

// ==================== LLM Latency Statistics ====================

/**
 * GET /admin/stats/latency
 * LLM 응답 지연시간 통계 (서비스+모델별)
 * - 10분/30분/1시간/일평균
 */
adminRoutes.get('/stats/latency', async (req: AuthenticatedRequest, res) => {
  try {
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // 서비스+모델별 latency 집계 쿼리
    const latencyStats = await prisma.$queryRaw<Array<{
      service_id: string;
      service_name: string;
      model_id: string;
      model_name: string;
      avg_10m: number | null;
      avg_30m: number | null;
      avg_1h: number | null;
      avg_24h: number | null;
      count_10m: bigint;
      count_30m: bigint;
      count_1h: bigint;
      count_24h: bigint;
    }>>`
      SELECT
        s.id as service_id,
        s."displayName" as service_name,
        m.id as model_id,
        m."displayName" as model_name,
        AVG(CASE WHEN ul.timestamp >= ${tenMinutesAgo} THEN ul.latency_ms END) as avg_10m,
        AVG(CASE WHEN ul.timestamp >= ${thirtyMinutesAgo} THEN ul.latency_ms END) as avg_30m,
        AVG(CASE WHEN ul.timestamp >= ${oneHourAgo} THEN ul.latency_ms END) as avg_1h,
        AVG(CASE WHEN ul.timestamp >= ${oneDayAgo} THEN ul.latency_ms END) as avg_24h,
        COUNT(CASE WHEN ul.timestamp >= ${tenMinutesAgo} AND ul.latency_ms IS NOT NULL THEN 1 END) as count_10m,
        COUNT(CASE WHEN ul.timestamp >= ${thirtyMinutesAgo} AND ul.latency_ms IS NOT NULL THEN 1 END) as count_30m,
        COUNT(CASE WHEN ul.timestamp >= ${oneHourAgo} AND ul.latency_ms IS NOT NULL THEN 1 END) as count_1h,
        COUNT(CASE WHEN ul.timestamp >= ${oneDayAgo} AND ul.latency_ms IS NOT NULL THEN 1 END) as count_24h
      FROM usage_logs ul
      INNER JOIN services s ON ul.service_id = s.id
      INNER JOIN models m ON ul.model_id = m.id
      WHERE ul.latency_ms IS NOT NULL
        AND ul.timestamp >= ${oneDayAgo}
      GROUP BY s.id, s."displayName", m.id, m."displayName"
      ORDER BY s."displayName", m."displayName"
    `;

    // 결과 포맷팅
    const stats = latencyStats.map(row => ({
      serviceId: row.service_id,
      serviceName: row.service_name,
      modelId: row.model_id,
      modelName: row.model_name,
      avg10m: row.avg_10m ? Math.round(row.avg_10m) : null,
      avg30m: row.avg_30m ? Math.round(row.avg_30m) : null,
      avg1h: row.avg_1h ? Math.round(row.avg_1h) : null,
      avg24h: row.avg_24h ? Math.round(row.avg_24h) : null,
      count10m: Number(row.count_10m),
      count30m: Number(row.count_30m),
      count1h: Number(row.count_1h),
      count24h: Number(row.count_24h),
    }));

    res.json({ stats, timestamp: now.toISOString() });
  } catch (error) {
    console.error('Get latency stats error:', error);
    res.status(500).json({ error: 'Failed to get latency statistics' });
  }
});

/**
 * GET /admin/stats/latency/history
 * LLM 응답 지연시간 시계열 데이터 (차트용)
 * Query: ?hours=24 (기본 24시간), ?interval=10 (분 단위, 기본 10분)
 */
adminRoutes.get('/stats/latency/history', async (req: AuthenticatedRequest, res) => {
  try {
    const hours = Math.min(72, Math.max(1, parseInt(req.query['hours'] as string) || 24));
    const interval = Math.min(60, Math.max(5, parseInt(req.query['interval'] as string) || 10));

    const now = new Date();
    const startTime = new Date();
    startTime.setHours(startTime.getHours() - hours);

    // Generate all time buckets for the range
    const allBuckets: Date[] = [];
    const bucketStart = new Date(startTime);
    // Align to interval boundary
    bucketStart.setMinutes(Math.floor(bucketStart.getMinutes() / interval) * interval, 0, 0);
    while (bucketStart <= now) {
      allBuckets.push(new Date(bucketStart));
      bucketStart.setMinutes(bucketStart.getMinutes() + interval);
    }

    // interval 분 단위로 집계
    const historyData = await prisma.$queryRaw<Array<{
      time_bucket: Date;
      service_id: string;
      service_name: string;
      model_id: string;
      model_name: string;
      avg_latency: number;
      request_count: bigint;
    }>>`
      SELECT
        date_trunc('hour', ul.timestamp) +
          (EXTRACT(minute FROM ul.timestamp)::int / ${interval}) * interval '${interval} minutes' as time_bucket,
        s.id as service_id,
        s."displayName" as service_name,
        m.id as model_id,
        m."displayName" as model_name,
        AVG(ul.latency_ms) as avg_latency,
        COUNT(*) as request_count
      FROM usage_logs ul
      INNER JOIN services s ON ul.service_id = s.id
      INNER JOIN models m ON ul.model_id = m.id
      WHERE ul.latency_ms IS NOT NULL
        AND ul.timestamp >= ${startTime}
      GROUP BY time_bucket, s.id, s."displayName", m.id, m."displayName"
      ORDER BY time_bucket ASC, s."displayName", m."displayName"
    `;

    // Get unique service/model combinations that have any data in the period
    const uniqueKeys = new Set<string>();
    const dataMap = new Map<string, Map<string, { avgLatency: number; count: number }>>();

    for (const row of historyData) {
      const key = `${row.service_name} / ${row.model_name}`;
      uniqueKeys.add(key);

      if (!dataMap.has(key)) {
        dataMap.set(key, new Map());
      }
      dataMap.get(key)!.set(row.time_bucket.toISOString(), {
        avgLatency: Math.round(row.avg_latency),
        count: Number(row.request_count),
      });
    }

    // Build complete history with 0 for missing time buckets
    const groupedData: Record<string, Array<{ time: string; avgLatency: number; count: number }>> = {};

    for (const key of uniqueKeys) {
      const keyDataMap = dataMap.get(key)!;
      groupedData[key] = allBuckets.map(bucket => {
        const bucketTime = bucket.toISOString();
        const data = keyDataMap.get(bucketTime);
        return {
          time: bucketTime,
          avgLatency: data?.avgLatency ?? 0,
          count: data?.count ?? 0,
        };
      });
    }

    res.json({
      history: groupedData,
      startTime: startTime.toISOString(),
      endTime: now.toISOString(),
      intervalMinutes: interval,
    });
  } catch (error) {
    console.error('Get latency history error:', error);
    res.status(500).json({ error: 'Failed to get latency history' });
  }
});
