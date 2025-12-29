/**
 * My Usage Routes
 *
 * Endpoints for viewing personal usage statistics
 * - 일반 사용자가 본인의 사용량 통계를 조회
 */

import { Router } from 'express';
import { prisma } from '../index.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';

export const myUsageRoutes = Router();

// 인증 필수
myUsageRoutes.use(authenticateToken);

/**
 * GET /my-usage/summary
 * 내 사용량 요약 (오늘, 이번 주, 이번 달)
 */
myUsageRoutes.get('/summary', async (req: AuthenticatedRequest, res) => {
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

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // 오늘 사용량
    const todayUsage = await prisma.usageLog.aggregate({
      where: {
        userId: user.id,
        timestamp: { gte: todayStart },
      },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
      },
      _count: true,
    });

    // 이번 주 사용량
    const weekUsage = await prisma.usageLog.aggregate({
      where: {
        userId: user.id,
        timestamp: { gte: weekStart },
      },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
      },
      _count: true,
    });

    // 이번 달 사용량
    const monthUsage = await prisma.usageLog.aggregate({
      where: {
        userId: user.id,
        timestamp: { gte: monthStart },
      },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
      },
      _count: true,
    });

    res.json({
      today: {
        requests: todayUsage._count,
        inputTokens: todayUsage._sum?.inputTokens ?? 0,
        outputTokens: todayUsage._sum?.outputTokens ?? 0,
        totalTokens: todayUsage._sum?.totalTokens ?? 0,
      },
      week: {
        requests: weekUsage._count,
        inputTokens: weekUsage._sum?.inputTokens ?? 0,
        outputTokens: weekUsage._sum?.outputTokens ?? 0,
        totalTokens: weekUsage._sum?.totalTokens ?? 0,
      },
      month: {
        requests: monthUsage._count,
        inputTokens: monthUsage._sum?.inputTokens ?? 0,
        outputTokens: monthUsage._sum?.outputTokens ?? 0,
        totalTokens: monthUsage._sum?.totalTokens ?? 0,
      },
    });
  } catch (error) {
    console.error('Get my usage summary error:', error);
    res.status(500).json({ error: 'Failed to get usage summary' });
  }
});

/**
 * GET /my-usage/daily
 * 내 일별 사용량 (최근 N일)
 */
myUsageRoutes.get('/daily', async (req: AuthenticatedRequest, res) => {
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

    const days = parseInt(req.query['days'] as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // 일별 집계
    const dailyStats = await prisma.$queryRaw<Array<{
      date: Date;
      requests: bigint;
      input_tokens: bigint;
      output_tokens: bigint;
      total_tokens: bigint;
    }>>`
      SELECT
        DATE(timestamp) as date,
        COUNT(*) as requests,
        COALESCE(SUM("inputTokens"), 0) as input_tokens,
        COALESCE(SUM("outputTokens"), 0) as output_tokens,
        COALESCE(SUM("totalTokens"), 0) as total_tokens
      FROM usage_logs
      WHERE user_id = ${user.id}
        AND timestamp >= ${startDate}
      GROUP BY DATE(timestamp)
      ORDER BY date ASC
    `;

    // BigInt를 Number로 변환하고 날짜 포맷팅
    const stats = dailyStats.map(row => ({
      date: row.date instanceof Date
        ? row.date.toISOString().split('T')[0]
        : String(row.date).split('T')[0],
      requests: Number(row.requests),
      inputTokens: Number(row.input_tokens),
      outputTokens: Number(row.output_tokens),
      totalTokens: Number(row.total_tokens),
    }));

    res.json({ stats });
  } catch (error) {
    console.error('Get my daily usage error:', error);
    res.status(500).json({ error: 'Failed to get daily usage' });
  }
});

/**
 * GET /my-usage/by-model
 * 내 모델별 사용량
 */
myUsageRoutes.get('/by-model', async (req: AuthenticatedRequest, res) => {
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

    const days = parseInt(req.query['days'] as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const usage = await prisma.usageLog.groupBy({
      by: ['modelId'],
      where: {
        userId: user.id,
        timestamp: { gte: startDate },
      },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
      },
      _count: true,
    });

    // 모델 이름 조회
    const modelIds = usage.map(u => u.modelId);
    const models = await prisma.model.findMany({
      where: { id: { in: modelIds } },
      select: { id: true, displayName: true },
    });

    const modelMap = new Map(models.map(m => [m.id, m.displayName]));

    const result = usage.map(u => ({
      modelId: u.modelId,
      modelName: modelMap.get(u.modelId) || u.modelId,
      requests: u._count,
      inputTokens: u._sum?.inputTokens ?? 0,
      outputTokens: u._sum?.outputTokens ?? 0,
      totalTokens: u._sum?.totalTokens ?? 0,
    }));

    res.json({ usage: result });
  } catch (error) {
    console.error('Get my usage by model error:', error);
    res.status(500).json({ error: 'Failed to get usage by model' });
  }
});

/**
 * GET /my-usage/recent
 * 내 최근 사용 로그
 */
myUsageRoutes.get('/recent', async (req: AuthenticatedRequest, res) => {
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

    const limit = Math.min(parseInt(req.query['limit'] as string) || 50, 100);
    const offset = parseInt(req.query['offset'] as string) || 0;

    const [logs, total] = await Promise.all([
      prisma.usageLog.findMany({
        where: { userId: user.id },
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
        include: {
          model: {
            select: { displayName: true },
          },
        },
      }),
      prisma.usageLog.count({ where: { userId: user.id } }),
    ]);

    res.json({
      logs: logs.map(log => ({
        id: log.id,
        modelName: log.model.displayName,
        inputTokens: log.inputTokens,
        outputTokens: log.outputTokens,
        totalTokens: log.totalTokens,
        timestamp: log.timestamp,
      })),
      pagination: {
        total,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Get my recent usage error:', error);
    res.status(500).json({ error: 'Failed to get recent usage' });
  }
});
