/**
 * Notification Manager
 *
 * 주기적 알림 관리:
 * - 20 요청마다: 모델 평점 (1-5) 요청
 * - 15 요청마다: GitHub Star 요청
 */

import { logger } from '../utils/logger.js';
import { usageTracker } from './usage-tracker.js';
import { configManager } from './config/config-manager.js';
import { ADMIN_SERVER_URL } from '../constants.js';

const RATING_INTERVAL = 20;  // 20 요청마다 평점 요청
const STAR_INTERVAL = 15;    // 15 요청마다 Star 요청

/**
 * 알림 타입
 */
export type NotificationType = 'rating';

export interface RatingNotification {
  type: 'rating';
  modelName: string;
}

export type Notification = RatingNotification;

/**
 * 알림 콜백 타입
 */
type RatingCallback = (notification: RatingNotification) => void;
type StarMessageCallback = (message: string) => void;

/**
 * Notification Manager Class
 */
class NotificationManager {
  private ratingCallback: RatingCallback | null = null;
  private starMessageCallback: StarMessageCallback | null = null;
  private lastRatingCount: number = 0;
  private lastStarCount: number = 0;

  /**
   * 평점 알림 콜백 설정
   */
  setRatingCallback(callback: RatingCallback | null): void {
    this.ratingCallback = callback;
  }

  /**
   * Star 메시지 콜백 설정 (로그로 추가됨)
   */
  setStarMessageCallback(callback: StarMessageCallback | null): void {
    this.starMessageCallback = callback;
  }

  /**
   * 요청 수 체크 및 알림 트리거
   * LLM 요청 완료 후 호출
   */
  checkNotifications(): void {
    const summary = usageTracker.getSummary();
    const totalRequests = summary.allTime.totalRequests;

    // Star 메시지 체크 (15 요청마다) - 먼저 체크 (로그로 추가되어 자연스럽게 밀려올라감)
    if (totalRequests > 0 &&
        totalRequests % STAR_INTERVAL === 0 &&
        totalRequests !== this.lastStarCount) {
      this.lastStarCount = totalRequests;
      this.triggerStarMessage();
    }

    // 평점 알림 체크 (20 요청마다) - 다이얼로그로 표시
    if (totalRequests > 0 &&
        totalRequests % RATING_INTERVAL === 0 &&
        totalRequests !== this.lastRatingCount) {
      this.lastRatingCount = totalRequests;
      this.triggerRatingNotification();
    }
  }

  /**
   * 평점 알림 트리거
   */
  private triggerRatingNotification(): void {
    if (!this.ratingCallback) return;

    const model = configManager.getCurrentModel();
    const modelName = model?.name || 'unknown';

    logger.debug('Triggering rating notification', { modelName });

    this.ratingCallback({
      type: 'rating',
      modelName,
    });
  }

  /**
   * Star 메시지 트리거 (로그 엔트리로 추가)
   */
  private triggerStarMessage(): void {
    if (!this.starMessageCallback) return;

    logger.debug('Triggering star message');

    const message = '★ Enjoying Nexus Coder? Give us a star! → https://github.com/A2G-Dev-Space/Local-CLI';
    this.starMessageCallback(message);
  }

  /**
   * 평점 서버에 제출
   */
  async submitRating(modelName: string, rating: number): Promise<boolean> {
    try {
      const response = await fetch(`${ADMIN_SERVER_URL}/rating`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ modelName, rating }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      logger.debug('Rating submitted', { modelName, rating });
      return true;
    } catch (error) {
      logger.error('Failed to submit rating', error as Error);
      return false;
    }
  }
}

export const notificationManager = new NotificationManager();
