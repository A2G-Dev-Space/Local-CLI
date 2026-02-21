/**
 * LLM Error Classes
 *
 * LLM 관련 에러들
 */

import { BaseError, ErrorOptions } from './base';

/**
 * LLMError - 일반 LLM 에러
 */
export class LLMError extends BaseError {
  constructor(message: string, options: ErrorOptions = {}) {
    super(
      message,
      'LLM_ERROR',
      {
        ...options,
        isRecoverable: options.isRecoverable ?? true,
        userMessage: options.userMessage ?? 'LLM 요청 중 오류가 발생했습니다.',
      }
    );
  }
}

/**
 * StreamingError - 스트리밍 에러
 */
export class StreamingError extends BaseError {
  constructor(message: string, options: ErrorOptions = {}) {
    super(
      message,
      'STREAMING_ERROR',
      {
        ...options,
        isRecoverable: true,
        userMessage: options.userMessage ?? '스트리밍 응답 중 오류가 발생했습니다.',
      }
    );
  }
}

/**
 * ModelError - 모델 관련 에러
 */
export class ModelError extends BaseError {
  public readonly modelId?: string;

  constructor(message: string, modelId?: string, options: ErrorOptions = {}) {
    super(
      message,
      'MODEL_ERROR',
      {
        ...options,
        details: {
          ...options.details,
          modelId,
        },
        isRecoverable: false,
        userMessage: options.userMessage ?? `모델에 문제가 있습니다${modelId ? ` (모델: ${modelId})` : ''}.`,
      }
    );
    this.modelId = modelId;
  }
}

/**
 * TokenLimitError - 토큰 제한 초과 에러
 */
export class TokenLimitError extends BaseError {
  public readonly limit: number;
  public readonly actual?: number;

  constructor(
    limit: number,
    actual?: number,
    options: ErrorOptions = {}
  ) {
    super(
      `Token limit exceeded. Limit: ${limit}${actual ? `, Actual: ${actual}` : ''}`,
      'TOKEN_LIMIT_ERROR',
      {
        ...options,
        details: {
          ...options.details,
          limit,
          actual,
        },
        isRecoverable: true,
        userMessage: options.userMessage ?? `토큰 한도를 초과했습니다 (최대: ${limit}${actual ? `, 현재: ${actual}` : ''}). 메시지를 줄여주세요.`,
      }
    );
    this.limit = limit;
    this.actual = actual;
  }
}

/**
 * RateLimitError - API 속도 제한 에러
 */
export class RateLimitError extends BaseError {
  public readonly retryAfter?: number;

  constructor(retryAfter?: number, options: ErrorOptions = {}) {
    super(
      `Rate limit exceeded${retryAfter ? `. Retry after ${retryAfter}s` : ''}`,
      'RATE_LIMIT_ERROR',
      {
        ...options,
        details: {
          ...options.details,
          retryAfter,
        },
        isRecoverable: true,
        userMessage: options.userMessage ?? `API 요청 한도를 초과했습니다${retryAfter ? `. ${retryAfter}초 후 다시 시도해주세요` : '. 잠시 후 다시 시도해주세요'}.`,
      }
    );
    this.retryAfter = retryAfter;
  }
}

/**
 * LLMRetryExhaustedError - 확장 retry 전부 실패한 에러
 * chatCompletion()에서 Phase 1 (3회) + Phase 2 (2분 대기) + Phase 3 (3회) 모두 실패 시 throw
 * UI 레이어에서 이 에러를 감지해 사용자에게 재시도 옵션을 제공
 */
export class LLMRetryExhaustedError extends BaseError {
  public readonly originalError: Error;

  constructor(originalError: Error, options: ErrorOptions = {}) {
    super(
      `LLM 서버 응답 실패 (6회 재시도 + 2분 대기 후 최종 실패): ${originalError.message}`,
      'LLM_RETRY_EXHAUSTED',
      {
        ...options,
        isRecoverable: true,
        userMessage: options.userMessage ?? `LLM 서버가 응답하지 않습니다. 재시도 버튼을 눌러주세요.`,
      }
    );
    this.originalError = originalError;
  }
}

/**
 * QuotaExceededError - 서버 사용량 한도 초과 에러
 */
export interface QuotaPeriodInfo {
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
  resetsIn: number;
  resetsAt: string;
  timeDisplay: string;
  totalTimeDisplay: string;
}

export interface QuotaInfo {
  hourly: QuotaPeriodInfo;
  weekly: QuotaPeriodInfo;
}

export class QuotaExceededError extends BaseError {
  public readonly quota: QuotaInfo;

  constructor(quota: Partial<QuotaInfo> | undefined, options: ErrorOptions = {}) {
    // 방어적 코딩: quota가 불완전하게 전달될 수 있음
    const defaultPeriod: QuotaPeriodInfo = {
      used: 0,
      limit: 0,
      remaining: 0,
      percentage: 100,
      resetsIn: 0,
      resetsAt: '',
      timeDisplay: '알 수 없음',
      totalTimeDisplay: '알 수 없음',
    };

    const safeQuota: QuotaInfo = {
      hourly: quota?.hourly ?? defaultPeriod,
      weekly: quota?.weekly ?? defaultPeriod,
    };

    const hourlyDisplay = safeQuota.hourly.timeDisplay || '알 수 없음';
    const weeklyDisplay = safeQuota.weekly.timeDisplay || '알 수 없음';

    super(
      `사용 한도 초과. 시간당: ${hourlyDisplay} 남음, 주간: ${weeklyDisplay} 남음`,
      'QUOTA_EXCEEDED_ERROR',
      {
        ...options,
        details: {
          ...options.details,
          quota: safeQuota,
        },
        isRecoverable: false,
        userMessage: options.userMessage ?? `사용 한도를 초과했습니다. 시간당: ${hourlyDisplay} 남음, 주간: ${weeklyDisplay} 남음`,
      }
    );
    this.quota = safeQuota;
  }
}

/**
 * ContextLengthError - 컨텍스트 길이 초과 에러
 */
export class ContextLengthError extends BaseError {
  public readonly maxLength: number;
  public readonly actualLength?: number;

  constructor(
    maxLength: number,
    actualLength?: number,
    options: ErrorOptions = {}
  ) {
    super(
      `Context length exceeded. Max: ${maxLength}${actualLength ? `, Actual: ${actualLength}` : ''}`,
      'CONTEXT_LENGTH_ERROR',
      {
        ...options,
        details: {
          ...options.details,
          maxLength,
          actualLength,
        },
        isRecoverable: true,
        userMessage: options.userMessage ?? `대화 컨텍스트가 너무 깁니다 (최대: ${maxLength}${actualLength ? `, 현재: ${actualLength}` : ''}). /clear 명령어로 대화를 초기화해주세요.`,
      }
    );
    this.maxLength = maxLength;
    this.actualLength = actualLength;
  }
}
