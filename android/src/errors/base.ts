/**
 * Base Error Class (Android)
 *
 * CLI/Electron과 동일한 에러 기본 클래스 (코드 패리티 유지)
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
    this.code = code;
    this.cause = options.cause;
    this.details = options.details;
    this.isRecoverable = options.isRecoverable ?? false;
    this.userMessage = options.userMessage ?? message;
    this.timestamp = new Date();
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      isRecoverable: this.isRecoverable,
      details: this.details,
      timestamp: this.timestamp,
    };
  }

  getUserMessage(): string {
    return this.userMessage;
  }

  canRecover(): boolean {
    return this.isRecoverable;
  }
}
