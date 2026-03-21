/**
 * LLM Error Classes (Android)
 *
 * CLI/Electron과 동일한 LLM 에러 (코드 패리티 유지)
 */

import { BaseError, ErrorOptions } from './base';

export class LLMError extends BaseError {
  constructor(message: string, options: ErrorOptions = {}) {
    super(message, 'LLM_ERROR', {
      ...options,
      isRecoverable: options.isRecoverable ?? true,
      userMessage: options.userMessage ?? 'LLM 요청 중 오류가 발생했습니다.',
    });
  }
}

export class TokenLimitError extends BaseError {
  public readonly limit: number;
  public readonly actual?: number;

  constructor(limit: number, actual?: number, options: ErrorOptions = {}) {
    super(
      `Token limit exceeded. Limit: ${limit}${actual ? `, Actual: ${actual}` : ''}`,
      'TOKEN_LIMIT_ERROR',
      {
        ...options,
        details: { ...options.details, limit, actual },
        isRecoverable: true,
        userMessage: options.userMessage ?? `토큰 한도를 초과했습니다 (최대: ${limit}).`,
      }
    );
    this.limit = limit;
    this.actual = actual;
  }
}

export class RateLimitError extends BaseError {
  public readonly retryAfter?: number;

  constructor(retryAfter?: number, options: ErrorOptions = {}) {
    super(
      `Rate limit exceeded${retryAfter ? `. Retry after ${retryAfter}s` : ''}`,
      'RATE_LIMIT_ERROR',
      {
        ...options,
        details: { ...options.details, retryAfter },
        isRecoverable: true,
        userMessage: options.userMessage ?? `API 요청 한도를 초과했습니다.`,
      }
    );
    this.retryAfter = retryAfter;
  }
}

export class ContextLengthError extends BaseError {
  public readonly maxLength: number;
  public readonly actualLength?: number;

  constructor(maxLength: number, actualLength?: number, options: ErrorOptions = {}) {
    super(
      `Context length exceeded. Max: ${maxLength}${actualLength ? `, Actual: ${actualLength}` : ''}`,
      'CONTEXT_LENGTH_ERROR',
      {
        ...options,
        details: { ...options.details, maxLength, actualLength },
        isRecoverable: true,
        userMessage: options.userMessage ?? `대화 컨텍스트가 너무 깁니다.`,
      }
    );
    this.maxLength = maxLength;
    this.actualLength = actualLength;
  }
}

export class LLMRetryExhaustedError extends BaseError {
  public readonly originalError: Error;

  constructor(originalError: Error, options: ErrorOptions = {}) {
    super(
      `LLM 서버 응답 실패 (재시도 후 최종 실패): ${originalError.message}`,
      'LLM_RETRY_EXHAUSTED',
      {
        ...options,
        isRecoverable: true,
        userMessage: options.userMessage ?? `LLM 서버가 응답하지 않습니다. 다시 시도해주세요.`,
      }
    );
    this.originalError = originalError;
  }
}
