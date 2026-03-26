import { Router, Request, Response } from 'express';
import { prisma } from '../index.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { stopContainer, removeContainer } from '../services/docker.service.js';
import { getSystemResources } from '../services/resource-monitor.js';

export const adminRoutes = Router();

adminRoutes.use(requireAuth, requireAdmin);

/**
 * GET /api/admin/dashboard — Overview stats
 */
adminRoutes.get('/dashboard', async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [totalUsers, activeUsers, activeSessions, totalSessions, recentErrors] =
      await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { lastActiveAt: { gte: oneDayAgo } } }),
        prisma.session.count({ where: { status: 'RUNNING' } }),
        prisma.session.count(),
        prisma.errorLog.count({
          where: { createdAt: { gte: oneDayAgo }, level: { in: ['ERROR', 'CRITICAL'] } },
        }),
      ]);

    res.json({
      totalUsers,
      activeUsers24h: activeUsers,
      activeSessions,
      totalSessions,
      recentErrors24h: recentErrors,
    });
  } catch (err) {
    console.error('[Admin] Dashboard error:', err);
    res.status(500).json({ error: 'Failed to get dashboard stats' });
  }
});

/**
 * GET /api/admin/users — List users with usage
 */
adminRoutes.get('/users', async (req: Request, res: Response) => {
  try {
    const { search, page = '1', limit = '50' } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};
    if (search) {
      where['OR'] = [
        { displayName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          _count: { select: { sessions: true, agents: true, usageLogs: true } },
        },
        orderBy: { lastActiveAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    console.error('[Admin] Users error:', err);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

/**
 * PUT /api/admin/users/:id — Update user (role, maxSessions)
 */
adminRoutes.put('/users/:id', async (req: Request, res: Response) => {
  try {
    const { role, maxSessions } = req.body as { role?: string; maxSessions?: number };

    const user = await prisma.user.findUnique({ where: { id: req.params['id'] } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Prevent admin self-demotion
    if (req.params['id'] === req.user!.id && role === 'USER') {
      res.status(400).json({ error: 'Cannot demote yourself' });
      return;
    }

    // Validate maxSessions range
    if (maxSessions !== undefined && (maxSessions < 1 || maxSessions > 100)) {
      res.status(400).json({ error: 'maxSessions must be between 1 and 100' });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(role !== undefined && { role: role as 'USER' | 'ADMIN' }),
        ...(maxSessions !== undefined && { maxSessions }),
      },
    });

    res.json(updated);
  } catch (err) {
    console.error('[Admin] Update user error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

/**
 * GET /api/admin/sessions — List all sessions with filters
 */
adminRoutes.get('/sessions', async (req: Request, res: Response) => {
  try {
    const { status, userId, page = '1', limit = '50' } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};
    if (status) where['status'] = status;
    if (userId) where['userId'] = userId;

    const [sessions, total] = await Promise.all([
      prisma.session.findMany({
        where,
        include: {
          user: { select: { displayName: true, email: true } },
          agent: { select: { name: true } },
        },
        orderBy: { lastActiveAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.session.count({ where }),
    ]);

    res.json({
      sessions,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    console.error('[Admin] Sessions error:', err);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

/**
 * GET /api/admin/sessions/:id/events — View session events
 */
adminRoutes.get('/sessions/:id/events', async (req: Request, res: Response) => {
  try {
    const { after } = req.query as { after?: string };
    const where: Record<string, unknown> = { sessionId: req.params['id'] };
    if (after) {
      where['sequence'] = { gt: parseInt(after, 10) };
    }

    const events = await prisma.sessionEvent.findMany({
      where,
      orderBy: { sequence: 'asc' },
      take: 500,
    });

    res.json(events);
  } catch (err) {
    console.error('[Admin] Session events error:', err);
    res.status(500).json({ error: 'Failed to get session events' });
  }
});

/**
 * DELETE /api/admin/sessions/:id — Force delete session
 */
adminRoutes.delete('/sessions/:id', async (req: Request, res: Response) => {
  try {
    const session = await prisma.session.findUnique({ where: { id: req.params['id'] } });
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    if (session.containerId) {
      try {
        await stopContainer(session.containerId);
      } catch {
        // ignore
      }
      try {
        await removeContainer(session.containerId);
      } catch {
        // ignore
      }
    }

    await prisma.session.update({
      where: { id: session.id },
      data: { status: 'DELETED', containerId: null, containerPort: null },
    });

    res.json({ message: 'Session force deleted' });
  } catch (err) {
    console.error('[Admin] Delete session error:', err);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

/**
 * GET /api/admin/resources — Server resource stats
 */
adminRoutes.get('/resources', async (_req: Request, res: Response) => {
  try {
    const resources = await getSystemResources();
    res.json(resources);
  } catch (err) {
    console.error('[Admin] Resources error:', err);
    res.status(500).json({ error: 'Failed to get resource stats' });
  }
});

/**
 * GET /api/admin/errors — Error logs with filters
 */
adminRoutes.get('/errors', async (req: Request, res: Response) => {
  try {
    const { level, source, resolved, page = '1', limit = '50' } = req.query as Record<
      string,
      string
    >;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};
    if (level) where['level'] = level;
    if (source) where['source'] = source;
    if (resolved === 'true') where['resolvedAt'] = { not: null };
    if (resolved === 'false') where['resolvedAt'] = null;

    const [errors, total] = await Promise.all([
      prisma.errorLog.findMany({
        where,
        include: { user: { select: { displayName: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.errorLog.count({ where }),
    ]);

    res.json({
      errors,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    console.error('[Admin] Errors error:', err);
    res.status(500).json({ error: 'Failed to list errors' });
  }
});

/**
 * GET /api/admin/settings — System settings
 */
adminRoutes.get('/settings', async (_req: Request, res: Response) => {
  try {
    const settings = await prisma.systemSetting.findMany();
    const result: Record<string, unknown> = {};
    for (const s of settings) {
      result[s.key] = s.value;
    }
    res.json(result);
  } catch (err) {
    console.error('[Admin] Settings error:', err);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

/**
 * PUT /api/admin/settings — Update system settings
 */
adminRoutes.put('/settings', async (req: Request, res: Response) => {
  try {
    const entries = req.body as Record<string, unknown>;
    if (!entries || typeof entries !== 'object') {
      res.status(400).json({ error: 'Request body must be an object of key-value pairs' });
      return;
    }

    const ALLOWED_SETTINGS = [
      'maxSessionsPerUser',
      'sessionTTLHours',
      'containerCpuLimit',
      'containerMemoryLimit',
      'cleanupIntervalMinutes',
    ];

    const invalidKeys = Object.keys(entries).filter((k) => !ALLOWED_SETTINGS.includes(k));
    if (invalidKeys.length > 0) {
      res.status(400).json({ error: `Invalid setting keys: ${invalidKeys.join(', ')}` });
      return;
    }

    const results: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(entries)) {
      const setting = await prisma.systemSetting.upsert({
        where: { key },
        update: { value: value as object },
        create: { key, value: value as object },
      });
      results[setting.key] = setting.value;
    }

    res.json(results);
  } catch (err) {
    console.error('[Admin] Update settings error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

/**
 * GET /api/admin/tools-usage — Tool usage statistics
 */
adminRoutes.get('/tools-usage', async (req: Request, res: Response) => {
  try {
    const { days = '7' } = req.query as { days?: string };
    const since = new Date(Date.now() - parseInt(days, 10) * 24 * 60 * 60 * 1000);

    const [agentUsage, modelUsage, totalTokens] = await Promise.all([
      // Usage by agent
      prisma.usageLog.groupBy({
        by: ['agentId'],
        where: { createdAt: { gte: since }, agentId: { not: null } },
        _sum: { totalTokens: true },
        _count: true,
        orderBy: { _count: { agentId: 'desc' } },
        take: 20,
      }),
      // Usage by model
      prisma.usageLog.groupBy({
        by: ['modelName'],
        where: { createdAt: { gte: since } },
        _sum: { totalTokens: true, inputTokens: true, outputTokens: true },
        _count: true,
        _avg: { latencyMs: true },
        orderBy: { _count: { modelName: 'desc' } },
      }),
      // Total tokens
      prisma.usageLog.aggregate({
        where: { createdAt: { gte: since } },
        _sum: { totalTokens: true, inputTokens: true, outputTokens: true },
        _count: true,
      }),
    ]);

    // Enrich agent usage with names
    const agentIds = agentUsage
      .map((a) => a.agentId)
      .filter((id): id is string => id !== null);
    const agents = await prisma.agent.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, name: true },
    });
    const agentMap = new Map(agents.map((a) => [a.id, a.name]));

    res.json({
      period: { days: parseInt(days, 10), since: since.toISOString() },
      byAgent: agentUsage.map((a) => ({
        agentId: a.agentId,
        agentName: agentMap.get(a.agentId!) || 'Unknown',
        totalTokens: a._sum.totalTokens,
        requestCount: a._count,
      })),
      byModel: modelUsage.map((m) => ({
        modelName: m.modelName,
        totalTokens: m._sum.totalTokens,
        inputTokens: m._sum.inputTokens,
        outputTokens: m._sum.outputTokens,
        requestCount: m._count,
        avgLatencyMs: Math.round(m._avg.latencyMs || 0),
      })),
      totals: {
        totalTokens: totalTokens._sum.totalTokens,
        inputTokens: totalTokens._sum.inputTokens,
        outputTokens: totalTokens._sum.outputTokens,
        requestCount: totalTokens._count,
      },
    });
  } catch (err) {
    console.error('[Admin] Tools usage error:', err);
    res.status(500).json({ error: 'Failed to get tool usage stats' });
  }
});
