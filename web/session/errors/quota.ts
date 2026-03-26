/**
 * Quota Error Classes
 *
 * 서버 사용량 한도 관련 에러
 */

export interface QuotaPeriodInfo {
  percentage: number;
  resetsIn: number;
  timeDisplay: string;
  totalTimeDisplay: string;
}

export interface QuotaInfo {
  period: QuotaPeriodInfo;
  weekly: QuotaPeriodInfo;
}

export class QuotaExceededError extends Error {
  public quota: QuotaInfo;

  constructor(quota: QuotaInfo) {
    const msg = `사용 한도 초과. 주기별: ${quota.period.timeDisplay} 남음, 주간: ${quota.weekly.timeDisplay} 남음`;
    super(msg);
    this.name = 'QuotaExceededError';
    this.quota = quota;
  }
}
