/**
 * Feedback Routes
 *
 * 피드백 관리 API
 * - 일반 사용자: 본인 피드백 CRUD
 * - Admin: 모든 피드백 조회 + 답변
 * - ?serviceId= 쿼리 파라미터로 서비스별 필터링 지원
 */

import { Router } from 'express';
import { prisma } from '../index.js';
import { authenticateToken, requireAdmin, AuthenticatedRequest, isDeveloper } from '../middleware/auth.js';
import { FeedbackCategory, FeedbackStatus } from '@prisma/client';

export const feedbackRoutes = Router();

/**
 * Helper: serviceId 필터 조건 생성
 */
function getServiceFilter(serviceId: string | undefined) {
  return serviceId ? { serviceId } : {};
}

/**
 * URL 인코딩된 텍스트 디코딩 (한글 등)
 */
function safeDecodeURIComponent(text: string): string {
  if (!text) return text;
  try {
    if (!text.includes('%')) return text;
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/**
 * deptname에서 businessUnit 추출
 */
function extractBusinessUnit(deptname: string): string {
  if (!deptname) return '';
  const match = deptname.match(/\(([^)]+)\)/);
  if (match) return match[1];
  const parts = deptname.split('/');
  return parts[0]?.trim() || '';
}

/**
 * GET /feedback
 * 피드백 목록 조회
 * - Admin: 모든 피드백
 * - 일반 사용자: 본인 피드백만
 * Query: ?serviceId= (optional), ?status=, ?category=, ?page=, ?limit=
 */
feedbackRoutes.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { status, category, page = '1', limit = '20', serviceId } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // 권한 체크
    const isAdmin = isDeveloper(req.user.loginid) || await checkIsAdmin(req.user.loginid);

    // Get user from DB
    const user = await prisma.user.findUnique({
      where: { loginid: req.user.loginid },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Build where clause
    const where: any = {
      ...getServiceFilter(serviceId as string | undefined),
    };

    // 일반 사용자는 본인 피드백만
    if (!isAdmin) {
      where.userId = user.id;
    }

    if (status) {
      where.status = status as FeedbackStatus;
    }
    if (category) {
      where.category = category as FeedbackCategory;
    }

    const [feedbacks, total] = await Promise.all([
      prisma.feedback.findMany({
        where,
        include: {
          user: {
            select: { loginid: true, username: true, deptname: true },
          },
          responder: {
            select: { loginid: true },
          },
          service: {
            select: { id: true, name: true, displayName: true },
          },
          comments: {
            include: {
              admin: {
                select: { loginid: true },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.feedback.count({ where }),
    ]);

    res.json({
      data: feedbacks,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
      serviceId: (serviceId as string) || null,
    });
  } catch (error) {
    console.error('Get feedbacks error:', error);
    res.status(500).json({ error: 'Failed to get feedbacks' });
  }
});

/**
 * GET /feedback/by-service
 * 서비스별 피드백 요약
 */
feedbackRoutes.get('/by-service', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const isAdmin = isDeveloper(req.user.loginid) || await checkIsAdmin(req.user.loginid);

    // Get user from DB
    const user = await prisma.user.findUnique({
      where: { loginid: req.user.loginid },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Build where clause (본인 피드백만 또는 Admin은 전체)
    const where: any = {};
    if (!isAdmin) {
      where.userId = user.id;
    }

    // 서비스별 집계
    const feedbackByService = await prisma.feedback.groupBy({
      by: ['serviceId'],
      where: {
        ...where,
        serviceId: { not: null },
      },
      _count: true,
    });

    // 서비스 정보 조회
    const serviceIds = feedbackByService.map(f => f.serviceId).filter(Boolean) as string[];
    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true, name: true, displayName: true },
    });

    const serviceMap = new Map(services.map(s => [s.id, s]));

    const result = feedbackByService.map(f => ({
      serviceId: f.serviceId,
      serviceName: serviceMap.get(f.serviceId!)?.name || 'Unknown',
      serviceDisplayName: serviceMap.get(f.serviceId!)?.displayName || 'Unknown',
      count: f._count,
    }));

    res.json({ feedbackByService: result });
  } catch (error) {
    console.error('Get feedback by service error:', error);
    res.status(500).json({ error: 'Failed to get feedback by service' });
  }
});

/**
 * GET /feedback/:id
 * 피드백 상세 조회
 */
feedbackRoutes.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;

    const feedback = await prisma.feedback.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, loginid: true, username: true, deptname: true },
        },
        responder: {
          select: { loginid: true },
        },
        service: {
          select: { id: true, name: true, displayName: true },
        },
        comments: {
          include: {
            admin: {
              select: { loginid: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!feedback) {
      res.status(404).json({ error: 'Feedback not found' });
      return;
    }

    // 권한 체크: 본인 피드백이거나 admin인 경우만
    const isAdmin = isDeveloper(req.user.loginid) || await checkIsAdmin(req.user.loginid);
    const user = await prisma.user.findUnique({ where: { loginid: req.user.loginid } });

    if (!isAdmin && feedback.userId !== user?.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json(feedback);
  } catch (error) {
    console.error('Get feedback error:', error);
    res.status(500).json({ error: 'Failed to get feedback' });
  }
});

/**
 * POST /feedback
 * 새 피드백 작성
 * Body: { category, title, content, images?, serviceId? }
 */
feedbackRoutes.post('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { category, title, content, images, serviceId } = req.body;

    if (!category || !title || !content) {
      res.status(400).json({ error: 'category, title, and content are required' });
      return;
    }

    // Validate category
    const validCategories = ['ISSUE', 'FEATURE', 'QUESTION', 'DOCS', 'PERFORMANCE', 'OTHER'];
    if (!validCategories.includes(category)) {
      res.status(400).json({ error: `Invalid category. Must be one of: ${validCategories.join(', ')}` });
      return;
    }

    // Validate serviceId if provided
    if (serviceId) {
      const service = await prisma.service.findUnique({ where: { id: serviceId } });
      if (!service) {
        res.status(400).json({ error: 'Invalid serviceId' });
        return;
      }
    }

    // Get or create user - URL 인코딩된 한글 디코딩
    const username = safeDecodeURIComponent(req.user.username || '');
    const deptname = safeDecodeURIComponent(req.user.deptname || '');
    const businessUnit = extractBusinessUnit(deptname);

    const user = await prisma.user.upsert({
      where: { loginid: req.user.loginid },
      update: {
        lastActive: new Date(),
        username,
        deptname,
        businessUnit,
      },
      create: {
        loginid: req.user.loginid,
        username,
        deptname,
        businessUnit,
      },
    });

    const feedback = await prisma.feedback.create({
      data: {
        userId: user.id,
        category: category as FeedbackCategory,
        title,
        content,
        images: images || [],
        serviceId: serviceId || null,
      },
      include: {
        user: {
          select: { loginid: true, username: true, deptname: true },
        },
        service: {
          select: { id: true, name: true, displayName: true },
        },
      },
    });

    res.status(201).json(feedback);
  } catch (error) {
    console.error('Create feedback error:', error);
    res.status(500).json({ error: 'Failed to create feedback' });
  }
});

/**
 * PUT /feedback/:id
 * 피드백 수정 (본인만)
 */
feedbackRoutes.put('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const { category, title, content, images, serviceId } = req.body;

    // Get user
    const user = await prisma.user.findUnique({
      where: { loginid: req.user.loginid },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Get feedback
    const existing = await prisma.feedback.findUnique({
      where: { id },
    });

    if (!existing) {
      res.status(404).json({ error: 'Feedback not found' });
      return;
    }

    // 본인만 수정 가능
    if (existing.userId !== user.id) {
      res.status(403).json({ error: 'You can only edit your own feedback' });
      return;
    }

    // 답변이 달린 피드백은 수정 불가
    if (existing.response) {
      res.status(400).json({ error: 'Cannot edit feedback that has been responded to' });
      return;
    }

    const updateData: any = {};
    if (category) {
      const validCategories = ['ISSUE', 'FEATURE', 'QUESTION', 'DOCS', 'PERFORMANCE', 'OTHER'];
      if (!validCategories.includes(category)) {
        res.status(400).json({ error: 'Invalid category' });
        return;
      }
      updateData.category = category;
    }
    if (title) updateData.title = title;
    if (content) updateData.content = content;
    if (images !== undefined) updateData.images = images;
    if (serviceId !== undefined) {
      // Validate serviceId if provided
      if (serviceId) {
        const service = await prisma.service.findUnique({ where: { id: serviceId } });
        if (!service) {
          res.status(400).json({ error: 'Invalid serviceId' });
          return;
        }
      }
      updateData.serviceId = serviceId || null;
    }

    const feedback = await prisma.feedback.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: { loginid: true, username: true, deptname: true },
        },
        service: {
          select: { id: true, name: true, displayName: true },
        },
      },
    });

    res.json(feedback);
  } catch (error) {
    console.error('Update feedback error:', error);
    res.status(500).json({ error: 'Failed to update feedback' });
  }
});

/**
 * DELETE /feedback/:id
 * 피드백 삭제 (본인 또는 Admin)
 */
feedbackRoutes.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;

    // Get user
    const user = await prisma.user.findUnique({
      where: { loginid: req.user.loginid },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Get feedback
    const existing = await prisma.feedback.findUnique({
      where: { id },
    });

    if (!existing) {
      res.status(404).json({ error: 'Feedback not found' });
      return;
    }

    // 권한 체크: 본인 피드백이거나 Admin인 경우 삭제 가능
    const isAdmin = isDeveloper(req.user.loginid) || await checkIsAdmin(req.user.loginid);

    if (existing.userId !== user.id && !isAdmin) {
      res.status(403).json({ error: 'You can only delete your own feedback' });
      return;
    }

    await prisma.feedback.delete({
      where: { id },
    });

    res.json({ success: true, message: 'Feedback deleted' });
  } catch (error) {
    console.error('Delete feedback error:', error);
    res.status(500).json({ error: 'Failed to delete feedback' });
  }
});

/**
 * POST /feedback/:id/respond
 * 피드백에 답변 달기 (Admin만)
 */
feedbackRoutes.post('/:id/respond', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const { response, status } = req.body;

    if (!response) {
      res.status(400).json({ error: 'response is required' });
      return;
    }

    // Get feedback
    const existing = await prisma.feedback.findUnique({
      where: { id },
    });

    if (!existing) {
      res.status(404).json({ error: 'Feedback not found' });
      return;
    }

    // Get or create admin record
    let admin = await prisma.admin.findUnique({
      where: { loginid: req.user.loginid },
    });

    // 환경변수 개발자인 경우 admin 레코드 자동 생성
    if (!admin && isDeveloper(req.user.loginid)) {
      admin = await prisma.admin.create({
        data: {
          loginid: req.user.loginid,
          role: 'SUPER_ADMIN',
        },
      });
    }

    if (!admin) {
      res.status(403).json({ error: 'Admin record not found' });
      return;
    }

    const feedback = await prisma.feedback.update({
      where: { id },
      data: {
        response,
        respondedBy: admin.id,
        respondedAt: new Date(),
        status: (status as FeedbackStatus) || 'RESOLVED',
      },
      include: {
        user: {
          select: { loginid: true, username: true, deptname: true },
        },
        responder: {
          select: { loginid: true },
        },
        service: {
          select: { id: true, name: true, displayName: true },
        },
      },
    });

    res.json(feedback);
  } catch (error) {
    console.error('Respond to feedback error:', error);
    res.status(500).json({ error: 'Failed to respond to feedback' });
  }
});

/**
 * PATCH /feedback/:id/status
 * 피드백 상태 변경 (Admin만)
 */
feedbackRoutes.patch('/:id/status', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      res.status(400).json({ error: 'status is required' });
      return;
    }

    if (!['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }

    const feedback = await prisma.feedback.update({
      where: { id },
      data: { status: status as FeedbackStatus },
      include: {
        user: {
          select: { loginid: true, username: true, deptname: true },
        },
        responder: {
          select: { loginid: true },
        },
        service: {
          select: { id: true, name: true, displayName: true },
        },
      },
    });

    res.json(feedback);
  } catch (error) {
    console.error('Update feedback status error:', error);
    res.status(500).json({ error: 'Failed to update feedback status' });
  }
});

/**
 * GET /feedback/stats/overview
 * 피드백 통계 (Admin만)
 * Query: ?serviceId= (optional)
 */
feedbackRoutes.get('/stats/overview', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const serviceId = req.query['serviceId'] as string | undefined;
    const serviceFilter = getServiceFilter(serviceId);

    const [total, byStatus, byCategory] = await Promise.all([
      prisma.feedback.count({ where: serviceFilter }),
      prisma.feedback.groupBy({
        by: ['status'],
        where: serviceFilter,
        _count: true,
      }),
      prisma.feedback.groupBy({
        by: ['category'],
        where: serviceFilter,
        _count: true,
      }),
    ]);

    res.json({
      total,
      byStatus: byStatus.reduce((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {} as Record<string, number>),
      byCategory: byCategory.reduce((acc, item) => {
        acc[item.category] = item._count;
        return acc;
      }, {} as Record<string, number>),
      serviceId: serviceId || null,
    });
  } catch (error) {
    console.error('Get feedback stats error:', error);
    res.status(500).json({ error: 'Failed to get feedback stats' });
  }
});

/**
 * POST /feedback/:id/comments
 * 피드백에 댓글 추가 (Admin만)
 */
feedbackRoutes.post('/:id/comments', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      res.status(400).json({ error: 'content is required' });
      return;
    }

    // Get feedback
    const feedback = await prisma.feedback.findUnique({
      where: { id },
    });

    if (!feedback) {
      res.status(404).json({ error: 'Feedback not found' });
      return;
    }

    // Get or create admin record
    let admin = await prisma.admin.findUnique({
      where: { loginid: req.user.loginid },
    });

    if (!admin && isDeveloper(req.user.loginid)) {
      admin = await prisma.admin.create({
        data: {
          loginid: req.user.loginid,
          role: 'SUPER_ADMIN',
        },
      });
    }

    if (!admin) {
      res.status(403).json({ error: 'Admin record not found' });
      return;
    }

    const comment = await prisma.feedbackComment.create({
      data: {
        feedbackId: id,
        adminId: admin.id,
        content: content.trim(),
      },
      include: {
        admin: {
          select: { loginid: true },
        },
      },
    });

    res.status(201).json(comment);
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

/**
 * PUT /feedback/:id/comments/:commentId
 * 댓글 수정 (본인 댓글만)
 */
feedbackRoutes.put('/:id/comments/:commentId', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id, commentId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      res.status(400).json({ error: 'content is required' });
      return;
    }

    // Get comment
    const comment = await prisma.feedbackComment.findUnique({
      where: { id: commentId },
      include: { admin: true },
    });

    if (!comment || comment.feedbackId !== id) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    // Check ownership
    if (comment.admin.loginid !== req.user.loginid) {
      res.status(403).json({ error: 'You can only edit your own comments' });
      return;
    }

    const updatedComment = await prisma.feedbackComment.update({
      where: { id: commentId },
      data: { content: content.trim() },
      include: {
        admin: {
          select: { loginid: true },
        },
      },
    });

    res.json(updatedComment);
  } catch (error) {
    console.error('Update comment error:', error);
    res.status(500).json({ error: 'Failed to update comment' });
  }
});

/**
 * DELETE /feedback/:id/comments/:commentId
 * 댓글 삭제 (본인 댓글만)
 */
feedbackRoutes.delete('/:id/comments/:commentId', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id, commentId } = req.params;

    // Get comment
    const comment = await prisma.feedbackComment.findUnique({
      where: { id: commentId },
      include: { admin: true },
    });

    if (!comment || comment.feedbackId !== id) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    // Check ownership
    if (comment.admin.loginid !== req.user.loginid) {
      res.status(403).json({ error: 'You can only delete your own comments' });
      return;
    }

    await prisma.feedbackComment.delete({
      where: { id: commentId },
    });

    res.json({ success: true, message: 'Comment deleted' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

/**
 * Helper: Check if user is admin in DB
 */
async function checkIsAdmin(loginid: string): Promise<boolean> {
  const admin = await prisma.admin.findUnique({
    where: { loginid },
  });
  return !!admin;
}
