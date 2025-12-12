/**
 * Configuration Error Classes
 *
 * 설정 관련 에러들
 */

import { BaseError, ErrorOptions } from './base.js';

/**
 * ConfigError - 일반 설정 에러
 */
export class ConfigError extends BaseError {
  constructor(message: string, options: ErrorOptions = {}) {
    super(
      message,
      'CONFIG_ERROR',
      {
        ...options,
        isRecoverable: options.isRecoverable ?? false,
        userMessage: options.userMessage ?? '설정 파일에 문제가 있습니다.',
      }
    );
  }
}

/**
 * InitializationError - 초기화 실패 에러
 */
export class InitializationError extends BaseError {
  constructor(message: string, options: ErrorOptions = {}) {
    super(
      message,
      'INITIALIZATION_ERROR',
      {
        ...options,
        isRecoverable: false,
        userMessage: options.userMessage ?? 'LOCAL-CLI 초기화에 실패했습니다. "open config init" 명령어를 실행해주세요.',
      }
    );
  }
}

/**
 * ConfigNotFoundError - 설정 파일 없음 에러
 */
export class ConfigNotFoundError extends BaseError {
  constructor(options: ErrorOptions = {}) {
    super(
      'Configuration file not found',
      'CONFIG_NOT_FOUND',
      {
        ...options,
        isRecoverable: false,
        userMessage: options.userMessage ?? 'LOCAL-CLI가 초기화되지 않았습니다. "open config init" 명령어를 실행해주세요.',
      }
    );
  }
}

/**
 * InvalidConfigError - 잘못된 설정 에러
 */
export class InvalidConfigError extends BaseError {
  public readonly field?: string;

  constructor(message: string, field?: string, options: ErrorOptions = {}) {
    super(
      message,
      'INVALID_CONFIG',
      {
        ...options,
        details: {
          ...options.details,
          field,
        },
        isRecoverable: false,
        userMessage: options.userMessage ?? `설정 파일이 유효하지 않습니다${field ? ` (필드: ${field})` : ''}.`,
      }
    );
    this.field = field;
  }
}

/**
 * EndpointNotFoundError - 엔드포인트 없음 에러
 */
export class EndpointNotFoundError extends BaseError {
  public readonly endpointId?: string;

  constructor(endpointId?: string, options: ErrorOptions = {}) {
    super(
      `Endpoint not found${endpointId ? `: ${endpointId}` : ''}`,
      'ENDPOINT_NOT_FOUND',
      {
        ...options,
        details: {
          ...options.details,
          endpointId,
        },
        isRecoverable: false,
        userMessage: options.userMessage ?? `엔드포인트를 찾을 수 없습니다${endpointId ? ` (ID: ${endpointId})` : ''}. "open config endpoints" 명령어로 확인해주세요.`,
      }
    );
    this.endpointId = endpointId;
  }
}
