/**
 * File System Error Classes
 *
 * 파일 시스템 관련 에러들
 */

import { BaseError, ErrorOptions } from './base';

/**
 * FileSystemError - 일반 파일 시스템 에러
 */
export class FileSystemError extends BaseError {
  public readonly path?: string;

  constructor(message: string, path?: string, options: ErrorOptions = {}) {
    super(
      message,
      'FILE_SYSTEM_ERROR',
      {
        ...options,
        details: {
          ...options.details,
          path,
        },
        isRecoverable: options.isRecoverable ?? false,
        userMessage: options.userMessage ?? `파일 시스템 오류가 발생했습니다${path ? ` (경로: ${path})` : ''}.`,
      }
    );
    this.path = path;
  }
}

/**
 * FileNotFoundError - 파일 없음 에러
 */
export class FileNotFoundError extends BaseError {
  public readonly path: string;

  constructor(path: string, options: ErrorOptions = {}) {
    super(
      `File not found: ${path}`,
      'FILE_NOT_FOUND',
      {
        ...options,
        details: {
          ...options.details,
          path,
        },
        isRecoverable: false,
        userMessage: options.userMessage ?? `파일을 찾을 수 없습니다: ${path}`,
      }
    );
    this.path = path;
  }
}

/**
 * DirectoryNotFoundError - 디렉토리 없음 에러
 */
export class DirectoryNotFoundError extends BaseError {
  public readonly path: string;

  constructor(path: string, options: ErrorOptions = {}) {
    super(
      `Directory not found: ${path}`,
      'DIRECTORY_NOT_FOUND',
      {
        ...options,
        details: {
          ...options.details,
          path,
        },
        isRecoverable: false,
        userMessage: options.userMessage ?? `디렉토리를 찾을 수 없습니다: ${path}`,
      }
    );
    this.path = path;
  }
}

/**
 * PermissionError - 권한 오류
 */
export class PermissionError extends BaseError {
  public readonly path?: string;
  public readonly operation?: string;

  constructor(
    message: string,
    path?: string,
    operation?: string,
    options: ErrorOptions = {}
  ) {
    super(
      message,
      'PERMISSION_ERROR',
      {
        ...options,
        details: {
          ...options.details,
          path,
          operation,
        },
        isRecoverable: false,
        userMessage: options.userMessage ?? `권한이 없습니다${path ? `: ${path}` : ''}${operation ? ` (작업: ${operation})` : ''}.`,
      }
    );
    this.path = path;
    this.operation = operation;
  }
}

/**
 * FileReadError - 파일 읽기 에러
 */
export class FileReadError extends BaseError {
  public readonly path: string;

  constructor(path: string, options: ErrorOptions = {}) {
    super(
      `Failed to read file: ${path}`,
      'FILE_READ_ERROR',
      {
        ...options,
        details: {
          ...options.details,
          path,
        },
        isRecoverable: false,
        userMessage: options.userMessage ?? `파일을 읽을 수 없습니다: ${path}`,
      }
    );
    this.path = path;
  }
}

/**
 * FileWriteError - 파일 쓰기 에러
 */
export class FileWriteError extends BaseError {
  public readonly path: string;

  constructor(path: string, options: ErrorOptions = {}) {
    super(
      `Failed to write file: ${path}`,
      'FILE_WRITE_ERROR',
      {
        ...options,
        details: {
          ...options.details,
          path,
        },
        isRecoverable: true,
        userMessage: options.userMessage ?? `파일을 쓸 수 없습니다: ${path}. 디스크 공간을 확인해주세요.`,
      }
    );
    this.path = path;
  }
}

/**
 * InvalidPathError - 잘못된 경로 에러
 */
export class InvalidPathError extends BaseError {
  public readonly path: string;

  constructor(path: string, options: ErrorOptions = {}) {
    super(
      `Invalid path: ${path}`,
      'INVALID_PATH_ERROR',
      {
        ...options,
        details: {
          ...options.details,
          path,
        },
        isRecoverable: true,
        userMessage: options.userMessage ?? `잘못된 경로입니다: ${path}`,
      }
    );
    this.path = path;
  }
}
