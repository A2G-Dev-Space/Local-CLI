/**
 * Service Routes
 *
 * 멀티 서비스 관리를 위한 API 엔드포인트
 * - GET /services: 모든 서비스 목록
 * - GET /services/:id: 서비스 상세
 * - POST /services: 서비스 생성 (SUPER_ADMIN)
 * - PUT /services/:id: 서비스 수정 (SUPER_ADMIN)
 * - DELETE /services/:id: 서비스 삭제 (SUPER_ADMIN)
 */

import { Router, RequestHandler } from 'express';
import { prisma } from '../index.js';
import { authenticateToken, requireAdmin, requireSuperAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { z } from 'zod';

export const serviceRoutes = Router();

// Validation schemas
const createServiceSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Name must be lowercase alphanumeric with hyphens'),
  displayName: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  iconUrl: z.string().url().optional().nullable(),
  enabled: z.boolean().default(true),
});

const updateServiceSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  iconUrl: z.string().url().optional().nullable(),
  enabled: z.boolean().optional(),
});

/**
 * GET /services
 * 모든 서비스 목록 조회 (인증된 사용자)
 */
serviceRoutes.get('/', authenticateToken, async (_req: AuthenticatedRequest, res) => {
  try {
    const services = await prisma.service.findMany({
      where: { enabled: true },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        displayName: true,
        description: true,
        iconUrl: true,
        enabled: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            models: true,
            usageLogs: true,
          },
        },
      },
    });

    res.json({ services });
  } catch (error) {
    console.error('Get services error:', error);
    res.status(500).json({ error: 'Failed to get services' });
  }
});

/**
 * GET /services/all
 * 모든 서비스 목록 (비활성 포함, Admin 전용)
 */
serviceRoutes.get(
  '/all',
  authenticateToken,
  requireAdmin as RequestHandler,
  async (_req: AuthenticatedRequest, res) => {
    try {
      const services = await prisma.service.findMany({
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          name: true,
          displayName: true,
          description: true,
          iconUrl: true,
          enabled: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              models: true,
              usageLogs: true,
              feedbacks: true,
              adminServices: true,
            },
          },
        },
      });

      res.json({ services });
    } catch (error) {
      console.error('Get all services error:', error);
      res.status(500).json({ error: 'Failed to get services' });
    }
  }
);

/**
 * GET /services/:id
 * 서비스 상세 조회
 */
serviceRoutes.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const id = req.params.id as string;

    const service = await prisma.service.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            models: true,
            usageLogs: true,
            feedbacks: true,
            adminServices: true,
          },
        },
      },
    });

    if (!service) {
      res.status(404).json({ error: 'Service not found' });
      return;
    }

    res.json({ service });
  } catch (error) {
    console.error('Get service error:', error);
    res.status(500).json({ error: 'Failed to get service' });
  }
});

/**
 * POST /services
 * 서비스 생성 (SUPER_ADMIN 전용)
 */
serviceRoutes.post(
  '/',
  authenticateToken,
  requireSuperAdmin as RequestHandler,
  async (req: AuthenticatedRequest, res) => {
    try {
      const validation = createServiceSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ error: 'Invalid request', details: validation.error.issues });
        return;
      }

      // Check duplicate name
      const existing = await prisma.service.findUnique({
        where: { name: validation.data.name },
      });
      if (existing) {
        res.status(409).json({ error: 'Service with this name already exists' });
        return;
      }

      const service = await prisma.service.create({
        data: validation.data,
      });

      res.status(201).json({ service });
    } catch (error) {
      console.error('Create service error:', error);
      res.status(500).json({ error: 'Failed to create service' });
    }
  }
);

/**
 * PUT /services/:id
 * 서비스 수정 (SUPER_ADMIN 전용)
 */
serviceRoutes.put(
  '/:id',
  authenticateToken,
  requireSuperAdmin as RequestHandler,
  async (req: AuthenticatedRequest, res) => {
    try {
      const id = req.params.id as string;

      const validation = updateServiceSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ error: 'Invalid request', details: validation.error.issues });
        return;
      }

      const existing = await prisma.service.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ error: 'Service not found' });
        return;
      }

      const service = await prisma.service.update({
        where: { id },
        data: validation.data,
      });

      res.json({ service });
    } catch (error) {
      console.error('Update service error:', error);
      res.status(500).json({ error: 'Failed to update service' });
    }
  }
);

/**
 * DELETE /services/:id
 * 서비스 삭제 (SUPER_ADMIN 전용)
 * 주의: 연결된 데이터가 있으면 삭제 불가
 */
serviceRoutes.delete(
  '/:id',
  authenticateToken,
  requireSuperAdmin as RequestHandler,
  async (req: AuthenticatedRequest, res) => {
    try {
      const id = req.params.id as string;

      const existing = await prisma.service.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              models: true,
              usageLogs: true,
              feedbacks: true,
            },
          },
        },
      }) as { _count: { models: number; usageLogs: number; feedbacks: number } } | null;

      if (!existing) {
        res.status(404).json({ error: 'Service not found' });
        return;
      }

      // Check for dependent data
      const hasData =
        existing._count.models > 0 || existing._count.usageLogs > 0 || existing._count.feedbacks > 0;

      if (hasData) {
        res.status(409).json({
          error: 'Cannot delete service with existing data',
          details: {
            models: existing._count.models,
            usageLogs: existing._count.usageLogs,
            feedbacks: existing._count.feedbacks,
          },
        });
        return;
      }

      // Delete AdminService entries first
      await prisma.adminService.deleteMany({ where: { serviceId: id } });

      // Delete service
      await prisma.service.delete({ where: { id } });

      res.json({ message: 'Service deleted successfully' });
    } catch (error) {
      console.error('Delete service error:', error);
      res.status(500).json({ error: 'Failed to delete service' });
    }
  }
);

/**
 * GET /services/:id/stats
 * 서비스별 통계 요약
 */
serviceRoutes.get(
  '/:id/stats',
  authenticateToken,
  requireAdmin as RequestHandler,
  async (req: AuthenticatedRequest, res) => {
    try {
      const id = req.params.id as string;

      // Verify service exists
      const service = await prisma.service.findUnique({ where: { id } });
      if (!service) {
        res.status(404).json({ error: 'Service not found' });
        return;
      }

      // Get statistics
      const [totalUsers, totalModels, totalRequests, todayRequests] = await Promise.all([
        // Unique users who have used this service
        prisma.usageLog.groupBy({
          by: ['userId'],
          where: { serviceId: id },
        }).then((r) => r.length),

        // Models in this service
        prisma.model.count({ where: { serviceId: id } }),

        // Total requests
        prisma.usageLog.count({ where: { serviceId: id } }),

        // Today's requests
        prisma.usageLog.count({
          where: {
            serviceId: id,
            timestamp: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
        }),
      ]);

      // Token usage
      const tokenUsage = await prisma.usageLog.aggregate({
        where: { serviceId: id },
        _sum: {
          inputTokens: true,
          outputTokens: true,
          totalTokens: true,
        },
      });

      res.json({
        serviceId: id,
        stats: {
          totalUsers,
          totalModels,
          totalRequests,
          todayRequests,
          totalInputTokens: tokenUsage._sum?.inputTokens || 0,
          totalOutputTokens: tokenUsage._sum?.outputTokens || 0,
          totalTokens: tokenUsage._sum?.totalTokens || 0,
        },
      });
    } catch (error) {
      console.error('Get service stats error:', error);
      res.status(500).json({ error: 'Failed to get service stats' });
    }
  }
);
