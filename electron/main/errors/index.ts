/**
 * Error Classes Export
 *
 * 모든 커스텀 에러 클래스를 export
 */

import { BaseError as BaseErrorClass } from './base';

// Base
export { BaseError } from './base';
export type { ErrorDetails, ErrorOptions } from './base';

// Network
export {
  NetworkError,
  APIError,
  TimeoutError,
  ConnectionError,
} from './network';

// Validation
export {
  ValidationError,
  InputError,
  RequiredFieldError,
  InvalidFormatError,
} from './validation';

// LLM
export {
  LLMError,
  StreamingError,
  ModelError,
  TokenLimitError,
  RateLimitError,
  LLMRetryExhaustedError,
  QuotaExceededError,
  ContextLengthError,
} from './llm';

// File System
export {
  FileSystemError,
  FileNotFoundError,
  DirectoryNotFoundError,
  PermissionError,
  FileReadError,
  FileWriteError,
  InvalidPathError,
} from './file';

/**
 * 에러 타입 체크 유틸리티
 */
export function isRecoverableError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'canRecover' in error) {
    const baseError = error as BaseErrorClass;
    return baseError.canRecover();
  }
  return false;
}

/**
 * 사용자 메시지 추출 유틸리티
 */
export function getUserMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    if ('getUserMessage' in error) {
      const baseError = error as BaseErrorClass;
      return baseError.getUserMessage();
    }
    if (error instanceof Error) {
      return error.message;
    }
  }
  return String(error);
}

/**
 * 에러를 JSON으로 변환
 */
export function errorToJSON(error: unknown): Record<string, unknown> {
  if (error && typeof error === 'object' && 'toJSON' in error) {
    const baseError = error as BaseErrorClass;
    return baseError.toJSON();
  }
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return {
    error: String(error),
  };
}
