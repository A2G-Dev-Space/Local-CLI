/**
 * Logger Utility
 *
 * Verbose logging for debugging
 */

import chalk from 'chalk';
import { getJsonStreamLogger } from './json-stream-logger.js';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  VERBOSE = 4,
}

export interface LoggerOptions {
  level?: LogLevel;
  prefix?: string;
  timestamp?: boolean;
}

/**
 * Logger class for structured logging
 */
export class Logger {
  private level: LogLevel;
  private prefix: string;
  private showTimestamp: boolean;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? LogLevel.INFO;
    this.prefix = options.prefix ?? '';
    this.showTimestamp = options.timestamp ?? true;
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Get formatted timestamp
   */
  private getTimestamp(): string {
    if (!this.showTimestamp) return '';
    const now = new Date();
    return chalk.gray(`[${now.toISOString()}]`);
  }

  /**
   * Get formatted prefix
   */
  private getPrefix(): string {
    if (!this.prefix) return '';
    return chalk.cyan(`[${this.prefix}]`);
  }

  /**
   * Log error
   */
  error(message: string, error?: Error | unknown): void {
    if (this.level < LogLevel.ERROR) return;

    const timestamp = this.getTimestamp();
    const prefix = this.getPrefix();
    console.error(
      timestamp,
      prefix,
      chalk.red('❌ ERROR:'),
      message
    );

    if (error) {
      if (error instanceof Error) {
        console.error(chalk.red('  Message:'), error.message);
        if (error.stack) {
          console.error(chalk.gray('  Stack:'));
          console.error(chalk.gray(error.stack));
        }
        // Show cause if available
        if ((error as any).cause) {
          console.error(chalk.red('  Cause:'), (error as any).cause);
        }
        // Show details if available (custom errors)
        if ((error as any).details) {
          console.error(chalk.yellow('  Details:'), JSON.stringify((error as any).details, null, 2));
        }
      } else {
        console.error(chalk.red('  Error:'), error);
      }
    }

    // Log to JSON stream if enabled
    const jsonLogger = getJsonStreamLogger();
    if (jsonLogger?.isActive()) {
      jsonLogger.logError(error || new Error(message), this.prefix || 'logger');
    }
  }

  /**
   * Log warning
   */
  warn(message: string, data?: unknown): void {
    if (this.level < LogLevel.WARN) return;

    const timestamp = this.getTimestamp();
    const prefix = this.getPrefix();
    console.warn(
      timestamp,
      prefix,
      chalk.yellow('⚠️  WARN:'),
      message
    );

    if (data) {
      console.warn(chalk.yellow('  Data:'), JSON.stringify(data, null, 2));
    }

    // Log to JSON stream if enabled
    const jsonLogger = getJsonStreamLogger();
    if (jsonLogger?.isActive()) {
      jsonLogger.logInfo(`[WARN] ${message}`, data);
    }
  }

  /**
   * Log info
   */
  info(message: string, data?: unknown): void {
    if (this.level < LogLevel.INFO) return;

    const timestamp = this.getTimestamp();
    const prefix = this.getPrefix();
    console.log(
      timestamp,
      prefix,
      chalk.blue('ℹ️  INFO:'),
      message
    );

    if (data) {
      console.log(chalk.blue('  Data:'), JSON.stringify(data, null, 2));
    }

    // Log to JSON stream if enabled
    const jsonLogger = getJsonStreamLogger();
    if (jsonLogger?.isActive()) {
      jsonLogger.logInfo(message, data);
    }
  }

  /**
   * Log debug
   */
  debug(message: string, data?: unknown): void {
    if (this.level < LogLevel.DEBUG) return;

    const timestamp = this.getTimestamp();
    const prefix = this.getPrefix();
    console.log(
      timestamp,
      prefix,
      chalk.magenta('🐛 DEBUG:'),
      message
    );

    if (data) {
      console.log(chalk.magenta('  Data:'), JSON.stringify(data, null, 2));
    }

    // Log to JSON stream if enabled
    const jsonLogger = getJsonStreamLogger();
    if (jsonLogger?.isActive()) {
      jsonLogger.logDebug(message, data);
    }
  }

  /**
   * Log verbose (most detailed)
   */
  verbose(message: string, data?: unknown): void {
    if (this.level < LogLevel.VERBOSE) return;

    const timestamp = this.getTimestamp();
    const prefix = this.getPrefix();
    console.log(
      timestamp,
      prefix,
      chalk.gray('🔍 VERBOSE:'),
      message
    );

    if (data) {
      console.log(chalk.gray('  Data:'), JSON.stringify(data, null, 2));
    }

    // Log to JSON stream if enabled
    const jsonLogger = getJsonStreamLogger();
    if (jsonLogger?.isActive()) {
      jsonLogger.logDebug(`[VERBOSE] ${message}`, data);
    }
  }

  /**
   * Log HTTP request
   */
  httpRequest(method: string, url: string, body?: unknown): void {
    if (this.level < LogLevel.DEBUG) return;

    const timestamp = this.getTimestamp();
    const prefix = this.getPrefix();
    console.log(
      timestamp,
      prefix,
      chalk.cyan('→ HTTP REQUEST:'),
      chalk.bold(method),
      url
    );

    if (body) {
      console.log(chalk.cyan('  Body:'), JSON.stringify(body, null, 2));
    }

    // Log to JSON stream if enabled
    const jsonLogger = getJsonStreamLogger();
    if (jsonLogger?.isActive()) {
      jsonLogger.logDebug(`HTTP ${method} ${url}`, { body });
    }
  }

  /**
   * Log HTTP response
   */
  httpResponse(status: number, statusText: string, data?: unknown): void {
    if (this.level < LogLevel.DEBUG) return;

    const timestamp = this.getTimestamp();
    const prefix = this.getPrefix();
    const statusColor = status >= 400 ? chalk.red : status >= 300 ? chalk.yellow : chalk.green;

    console.log(
      timestamp,
      prefix,
      chalk.cyan('← HTTP RESPONSE:'),
      statusColor(`${status} ${statusText}`)
    );

    if (data && this.level >= LogLevel.VERBOSE) {
      console.log(chalk.cyan('  Data:'), JSON.stringify(data, null, 2));
    }

    // Log to JSON stream if enabled
    const jsonLogger = getJsonStreamLogger();
    if (jsonLogger?.isActive()) {
      jsonLogger.logDebug(`HTTP Response ${status} ${statusText}`, { status, statusText, data: this.level >= LogLevel.VERBOSE ? data : undefined });
    }
  }

  /**
   * Log tool execution
   */
  toolExecution(toolName: string, args: unknown, result?: unknown, error?: Error): void {
    if (this.level < LogLevel.DEBUG) return;

    const timestamp = this.getTimestamp();
    const prefix = this.getPrefix();

    if (error) {
      console.log(
        timestamp,
        prefix,
        chalk.red('🔧 TOOL FAILED:'),
        chalk.bold(toolName)
      );
      console.log(chalk.red('  Args:'), JSON.stringify(args, null, 2));
      console.log(chalk.red('  Error:'), error.message);
    } else {
      console.log(
        timestamp,
        prefix,
        chalk.green('🔧 TOOL SUCCESS:'),
        chalk.bold(toolName)
      );
      console.log(chalk.green('  Args:'), JSON.stringify(args, null, 2));
      if (result && this.level >= LogLevel.VERBOSE) {
        console.log(chalk.green('  Result:'), JSON.stringify(result, null, 2));
      }
    }

    // Log to JSON stream if enabled
    const jsonLogger = getJsonStreamLogger();
    if (jsonLogger?.isActive()) {
      jsonLogger.logToolCall(toolName, args, result, error);
    }
  }
}

/**
 * Global logger instance
 */
export const logger = new Logger({
  level: process.env['LOG_LEVEL']
    ? parseInt(process.env['LOG_LEVEL'])
    : (process.env['VERBOSE'] === 'true' ? LogLevel.VERBOSE : LogLevel.INFO),
  prefix: 'OPEN-CLI',
  timestamp: true,
});

/**
 * Set global log level from environment or config
 */
export function setLogLevel(level: LogLevel): void {
  logger.setLevel(level);
}

/**
 * Enable verbose logging
 */
export function enableVerbose(): void {
  logger.setLevel(LogLevel.VERBOSE);
}

/**
 * Disable verbose logging
 */
export function disableVerbose(): void {
  logger.setLevel(LogLevel.INFO);
}
