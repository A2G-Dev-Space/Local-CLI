/**
 * Retry Utility
 *
 * 재시도 로직 및 지수 백오프 구현
 */

import { BaseError, isRecoverableError } from '../errors/index.js';

export interface RetryOptions {
  /**
   * 최대 재시도 횟수
   * @default 3
   */
  maxRetries?: number;

  /**
   * 초기 지연 시간 (ms)
   * @default 1000
   */
  initialDelay?: number;

  /**
   * 최대 지연 시간 (ms)
   * @default 30000
   */
  maxDelay?: number;

  /**
   * 지수 백오프 배수
   * @default 2
   */
  backoffMultiplier?: number;

  /**
   * 재시도 여부를 결정하는 함수
   * @returns true면 재시도, false면 중단
   */
  shouldRetry?: (error: unknown, attempt: number) => boolean;

  /**
   * 재시도 전 호출되는 콜백
   */
  onRetry?: (error: unknown, attempt: number, delay: number) => void;
}

/**
 * 기본 재시도 옵션
 */
const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, 'shouldRetry' | 'onRetry'>> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
};

/**
 * 지연 시간 계산 (Exponential Backoff with Jitter)
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  backoffMultiplier: number
): number {
  const exponentialDelay = initialDelay * Math.pow(backoffMultiplier, attempt);
  const cappedDelay = Math.min(exponentialDelay, maxDelay);

  // Jitter 추가 (±25% 랜덤)
  const jitter = cappedDelay * 0.25 * (Math.random() * 2 - 1);

  return Math.floor(cappedDelay + jitter);
}

/**
 * 기본 재시도 조건 판단
 */
function defaultShouldRetry(error: unknown): boolean {
  // BaseError의 isRecoverable 체크
  if (error instanceof BaseError) {
    return error.canRecover();
  }

  // 일반 Error는 재시도 가능한 것으로 간주
  if (error instanceof Error) {
    // 특정 에러 메시지 패턴은 재시도하지 않음
    const nonRetryablePatterns = [
      /unauthorized/i,
      /forbidden/i,
      /not found/i,
      /invalid.*key/i,
      /invalid.*token/i,
    ];

    return !nonRetryablePatterns.some(pattern => pattern.test(error.message));
  }

  return true;
}

/**
 * 비동기 함수를 재시도와 함께 실행
 *
 * @param fn 실행할 비동기 함수
 * @param options 재시도 옵션
 * @returns 함수 실행 결과
 * @throws 최대 재시도 횟수 초과 시 마지막 에러
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries,
    initialDelay,
    maxDelay,
    backoffMultiplier,
  } = {
    ...DEFAULT_RETRY_OPTIONS,
    ...options,
  };

  const shouldRetry = options.shouldRetry ?? defaultShouldRetry;
  const onRetry = options.onRetry;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // 마지막 시도이거나 재시도 불가능한 에러면 throw
      if (attempt >= maxRetries || !shouldRetry(error, attempt)) {
        throw error;
      }

      // 재시도 지연 시간 계산
      const delay = calculateDelay(
        attempt,
        initialDelay,
        maxDelay,
        backoffMultiplier
      );

      // onRetry 콜백 호출
      if (onRetry) {
        onRetry(error, attempt + 1, delay);
      }

      // 지연
      await sleep(delay);
    }
  }

  // 여기까지 오면 모든 재시도 실패
  throw lastError;
}

/**
 * Promise sleep 유틸리티
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 재시도 가능한 에러인지 확인
 */
export { isRecoverableError };

/**
 * 재시도 옵션 프리셋
 */
export const RetryPresets = {
  /**
   * 네트워크 요청용 재시도 (빠른 재시도)
   */
  network: {
    maxRetries: 3,
    initialDelay: 500,
    maxDelay: 5000,
    backoffMultiplier: 2,
  } as RetryOptions,

  /**
   * API 호출용 재시도 (일반)
   */
  api: {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
  } as RetryOptions,

  /**
   * 파일 작업용 재시도 (느린 재시도)
   */
  file: {
    maxRetries: 2,
    initialDelay: 2000,
    maxDelay: 5000,
    backoffMultiplier: 1.5,
  } as RetryOptions,

  /**
   * LLM 스트리밍용 재시도
   */
  streaming: {
    maxRetries: 2,
    initialDelay: 1500,
    maxDelay: 8000,
    backoffMultiplier: 2,
  } as RetryOptions,

  /**
   * 재시도 없음
   */
  none: {
    maxRetries: 0,
  } as RetryOptions,
};
