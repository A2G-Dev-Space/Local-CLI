/**
 * Rating Routes
 *
 * 모델 평점 API
 * - POST /rating: 평점 제출 (인증 불필요)
 * - GET /rating/stats: 모델별 평균 점수 조회
 */

import { Router } from 'express';
import { prisma } from '../index.js';

export const ratingRoutes = Router();

/**
 * POST /rating
 * 모델 평점 제출 (1-5)
 * 인증 불필요 - 익명으로 수집
 */
ratingRoutes.post('/', async (req, res) => {
  try {
    const { modelName, rating, serviceId } = req.body;

    // 유효성 검사
    if (!modelName || typeof modelName !== 'string') {
      res.status(400).json({ error: 'modelName is required' });
      return;
    }

    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      res.status(400).json({ error: 'rating must be a number between 1 and 5' });
      return;
    }

    // serviceId가 제공된 경우 UUID 또는 서비스명으로 조회
    let resolvedServiceId: string | null = null;
    if (serviceId) {
      const service = await prisma.service.findFirst({
        where: {
          OR: [
            { id: serviceId },
            { name: serviceId },
          ],
        },
        select: { id: true },
      });
      resolvedServiceId = service?.id || null;
    }

    // 평점 저장 (serviceId 포함)
    const feedback = await prisma.ratingFeedback.create({
      data: {
        modelName,
        rating: Math.round(rating),  // 정수로 저장
        serviceId: resolvedServiceId,
      },
    });

    res.status(201).json({ success: true, id: feedback.id });
  } catch (error) {
    console.error('Submit rating error:', error);
    res.status(500).json({ error: 'Failed to submit rating' });
  }
});

/**
 * GET /rating/stats
 * 모델별 평점 통계 조회
 * - daily: 날짜별/모델별 평균 점수
 * - byModel: 모델별 전체 평균
 * Query: ?days=30&serviceId=xxx (optional)
 */
ratingRoutes.get('/stats', async (req, res) => {
  try {
    const days = parseInt(req.query['days'] as string) || 30;
    const serviceIdParam = req.query['serviceId'] as string | undefined;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // serviceId가 제공된 경우 UUID 또는 서비스명으로 조회
    let resolvedServiceId: string | null = null;
    if (serviceIdParam) {
      const service = await prisma.service.findFirst({
        where: {
          OR: [
            { id: serviceIdParam },
            { name: serviceIdParam },
          ],
        },
        select: { id: true },
      });
      resolvedServiceId = service?.id || null;
    }

    // 날짜별/모델별/서비스별 평균 점수 (parameterized query to prevent SQL injection)
    const dailyStats = resolvedServiceId
      ? await prisma.$queryRaw<Array<{
          date: Date;
          modelName: string;
          serviceName: string | null;
          averageRating: number;
          ratingCount: bigint;
        }>>`
          SELECT
            DATE(r.timestamp) as date,
            r.model_name as "modelName",
            s.name as "serviceName",
            AVG(r.rating)::float as "averageRating",
            COUNT(*)::bigint as "ratingCount"
          FROM rating_feedbacks r
          LEFT JOIN services s ON r.service_id = s.id
          WHERE r.timestamp >= ${startDate} AND r.service_id::text = ${resolvedServiceId}
          GROUP BY DATE(r.timestamp), r.model_name, s.name
          ORDER BY DATE(r.timestamp) ASC, r.model_name ASC
        `
      : await prisma.$queryRaw<Array<{
          date: Date;
          modelName: string;
          serviceName: string | null;
          averageRating: number;
          ratingCount: bigint;
        }>>`
          SELECT
            DATE(r.timestamp) as date,
            r.model_name as "modelName",
            s.name as "serviceName",
            AVG(r.rating)::float as "averageRating",
            COUNT(*)::bigint as "ratingCount"
          FROM rating_feedbacks r
          LEFT JOIN services s ON r.service_id = s.id
          WHERE r.timestamp >= ${startDate}
          GROUP BY DATE(r.timestamp), r.model_name, s.name
          ORDER BY DATE(r.timestamp) ASC, r.model_name ASC
        `;

    // 모델별/서비스별 전체 평균
    const modelStats = resolvedServiceId
      ? await prisma.$queryRaw<Array<{
          modelName: string;
          serviceName: string | null;
          averageRating: number;
          totalRatings: bigint;
        }>>`
          SELECT
            r.model_name as "modelName",
            s.name as "serviceName",
            AVG(r.rating)::float as "averageRating",
            COUNT(*)::bigint as "totalRatings"
          FROM rating_feedbacks r
          LEFT JOIN services s ON r.service_id = s.id
          WHERE r.timestamp >= ${startDate} AND r.service_id::text = ${resolvedServiceId}
          GROUP BY r.model_name, s.name
          ORDER BY "averageRating" DESC
        `
      : await prisma.$queryRaw<Array<{
          modelName: string;
          serviceName: string | null;
          averageRating: number;
          totalRatings: bigint;
        }>>`
          SELECT
            r.model_name as "modelName",
            s.name as "serviceName",
            AVG(r.rating)::float as "averageRating",
            COUNT(*)::bigint as "totalRatings"
          FROM rating_feedbacks r
          LEFT JOIN services s ON r.service_id = s.id
          WHERE r.timestamp >= ${startDate}
          GROUP BY r.model_name, s.name
          ORDER BY "averageRating" DESC
        `;

    res.json({
      daily: dailyStats.map(row => ({
        date: row.date,
        modelName: row.modelName,
        serviceName: row.serviceName,
        averageRating: row.averageRating,
        ratingCount: Number(row.ratingCount),
      })),
      byModel: modelStats.map(m => ({
        modelName: m.modelName,
        serviceName: m.serviceName,
        averageRating: m.averageRating,
        totalRatings: Number(m.totalRatings),
      })),
    });
  } catch (error) {
    console.error('Get rating stats error:', error);
    res.status(500).json({ error: 'Failed to get rating stats' });
  }
});
