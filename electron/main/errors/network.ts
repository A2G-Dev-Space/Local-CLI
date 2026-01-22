/**
 * Network Error Classes
 *
 * 네트워크 관련 에러들
 */

import { BaseError, ErrorOptions } from './base';

/**
 * NetworkError - 일반 네트워크 에러
 */
export class NetworkError extends BaseError {
  constructor(message: string, options: ErrorOptions = {}) {
    super(
      message,
      'NETWORK_ERROR',
      {
        ...options,
        isRecoverable: options.isRecoverable ?? true,
        userMessage: options.userMessage ?? '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.',
      }
    );
  }
}

/**
 * APIError - API 호출 에러
 */
export class APIError extends BaseError {
  public readonly statusCode?: number;
  public readonly endpoint?: string;

  constructor(
    message: string,
    statusCode?: number,
    endpoint?: string,
    options: ErrorOptions = {}
  ) {
    super(
      message,
      'API_ERROR',
      {
        ...options,
        details: {
          ...options.details,
          statusCode,
          endpoint,
        },
        isRecoverable: options.isRecoverable ?? (statusCode ? statusCode >= 500 : true),
        userMessage: options.userMessage ?? APIError.getAPIErrorMessage(statusCode),
      }
    );
    this.statusCode = statusCode;
    this.endpoint = endpoint;
  }

  static getAPIErrorMessage(statusCode?: number): string {
    if (!statusCode) {
      return 'API 요청 중 오류가 발생했습니다.';
    }

    if (statusCode === 401) {
      return 'API 인증에 실패했습니다. API Key를 확인해주세요.';
    } else if (statusCode === 403) {
      return '접근 권한이 없습니다. API Key 권한을 확인해주세요.';
    } else if (statusCode === 404) {
      return '요청한 API 엔드포인트를 찾을 수 없습니다.';
    } else if (statusCode === 429) {
      return 'API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.';
    } else if (statusCode >= 500) {
      return 'API 서버에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
    } else {
      return `API 요청 중 오류가 발생했습니다 (상태 코드: ${statusCode}).`;
    }
  }
}

/**
 * TimeoutError - 요청 타임아웃 에러
 */
export class TimeoutError extends BaseError {
  public readonly timeout: number;

  constructor(timeout: number, options: ErrorOptions = {}) {
    super(
      `Request timed out after ${timeout}ms`,
      'TIMEOUT_ERROR',
      {
        ...options,
        details: {
          ...options.details,
          timeout,
        },
        isRecoverable: true,
        userMessage: options.userMessage ?? `요청 시간이 초과되었습니다 (${timeout}ms). 다시 시도해주세요.`,
      }
    );
    this.timeout = timeout;
  }
}

/**
 * ConnectionError - 연결 실패 에러
 */
export class ConnectionError extends BaseError {
  public readonly host?: string;

  constructor(host?: string, options: ErrorOptions = {}) {
    super(
      `Failed to connect${host ? ` to ${host}` : ''}`,
      'CONNECTION_ERROR',
      {
        ...options,
        details: {
          ...options.details,
          host,
        },
        isRecoverable: true,
        userMessage: options.userMessage ?? `서버에 연결할 수 없습니다${host ? ` (${host})` : ''}. 네트워크 연결을 확인해주세요.`,
      }
    );
    this.host = host;
  }
}
