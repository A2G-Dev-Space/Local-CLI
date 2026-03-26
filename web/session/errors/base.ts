/**
 * Base Error Class
 *
 * 모든 커스텀 에러의 기본 클래스
 */

export interface ErrorDetails {
  [key: string]: unknown;
}

export interface ErrorOptions {
  cause?: Error;
  details?: ErrorDetails;
  isRecoverable?: boolean;
  userMessage?: string;
}

/**
 * BaseError - 모든 커스텀 에러의 기본 클래스
 */
export class BaseError extends Error {
  public readonly code: string;
  public override readonly cause?: Error;
  public readonly details?: ErrorDetails;
  public readonly isRecoverable: boolean;
  public readonly userMessage: string;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: string,
    options: ErrorOptions = {}
  ) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
    this.code = code;
    this.cause = options.cause;
    this.details = options.details;
    this.isRecoverable = options.isRecoverable ?? false;
    this.userMessage = options.userMessage ?? message;
    this.timestamp = new Date();

    // 스택 트레이스 설정
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * 에러 정보를 JSON으로 변환
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      isRecoverable: this.isRecoverable,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack,
      cause: this.cause ? {
        name: this.cause.name,
        message: this.cause.message,
      } : undefined,
    };
  }

  /**
   * 사용자에게 표시할 메시지 반환
   */
  getUserMessage(): string {
    return this.userMessage;
  }

  /**
   * 에러가 복구 가능한지 확인
   */
  canRecover(): boolean {
    return this.isRecoverable;
  }
}
