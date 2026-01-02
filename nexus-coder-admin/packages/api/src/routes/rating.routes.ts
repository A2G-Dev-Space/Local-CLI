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
    const { modelName, rating } = req.body;

    // 유효성 검사
    if (!modelName || typeof modelName !== 'string') {
      res.status(400).json({ error: 'modelName is required' });
      return;
    }

    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      res.status(400).json({ error: 'rating must be a number between 1 and 5' });
      return;
    }

    // 평점 저장
    const feedback = await prisma.ratingFeedback.create({
      data: {
        modelName,
        rating: Math.round(rating),  // 정수로 저장
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
 */
ratingRoutes.get('/stats', async (req, res) => {
  try {
    const days = parseInt(req.query['days'] as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // 날짜별/모델별 평균 점수
    const dailyStats = await prisma.$queryRaw<Array<{
      date: Date;
      modelName: string;
      averageRating: number;
      ratingCount: bigint;
    }>>`
      SELECT
        DATE(timestamp) as date,
        model_name as "modelName",
        AVG(rating)::float as "averageRating",
        COUNT(*)::bigint as "ratingCount"
      FROM rating_feedbacks
      WHERE timestamp >= ${startDate}
      GROUP BY DATE(timestamp), model_name
      ORDER BY DATE(timestamp) ASC, model_name ASC
    `;

    // 모델별 전체 평균
    const modelStats = await prisma.ratingFeedback.groupBy({
      by: ['modelName'],
      _avg: { rating: true },
      _count: { rating: true },
      where: { timestamp: { gte: startDate } },
    });

    res.json({
      daily: dailyStats.map(row => ({
        date: row.date,
        modelName: row.modelName,
        averageRating: row.averageRating,
        ratingCount: Number(row.ratingCount),
      })),
      byModel: modelStats.map(m => ({
        modelName: m.modelName,
        averageRating: m._avg.rating,
        totalRatings: m._count.rating,
      })),
    });
  } catch (error) {
    console.error('Get rating stats error:', error);
    res.status(500).json({ error: 'Failed to get rating stats' });
  }
});
