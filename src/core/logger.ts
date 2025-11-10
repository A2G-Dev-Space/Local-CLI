/**
 * Logger - 로깅 시스템
 *
 * 파일 및 콘솔 로깅, 로그 로테이션 지원
 */

import * as fs from 'fs';
import * as path from 'path';
import * as chalk from 'chalk';
import { PROJECTS_DIR } from '../constants.js';
import { ensureDirectory } from '../utils/file-system.js';

/**
 * 로그 레벨
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

/**
 * 로그 엔트리
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Logger 옵션
 */
export interface LoggerOptions {
  /**
   * 콘솔 로깅 활성화
   * @default true
   */
  consoleEnabled?: boolean;

  /**
   * 파일 로깅 활성화
   * @default true
   */
  fileEnabled?: boolean;

  /**
   * 최소 로그 레벨 (이 레벨 이상만 로깅)
   * @default LogLevel.INFO
   */
  minLevel?: LogLevel;

  /**
   * 로그 파일 최대 크기 (bytes)
   * @default 10MB
   */
  maxFileSize?: number;

  /**
   * 로그 파일 최대 개수
   * @default 7
   */
  maxFiles?: number;
}

/**
 * Logger 클래스 (싱글톤)
 */
export class Logger {
  private static instance: Logger;
  private options: Required<LoggerOptions>;
  private logFilePath: string;
  private errorLogFilePath: string;

  private constructor(options: LoggerOptions = {}) {
    this.options = {
      consoleEnabled: options.consoleEnabled ?? true,
      fileEnabled: options.fileEnabled ?? true,
      minLevel: options.minLevel ?? LogLevel.INFO,
      maxFileSize: options.maxFileSize ?? 10 * 1024 * 1024, // 10MB
      maxFiles: options.maxFiles ?? 7,
    };

    // Note: This logger is deprecated in favor of json-stream-logger
    // Keeping minimal functionality for backwards compatibility
    this.logFilePath = path.join(PROJECTS_DIR, 'deprecated.log');
    this.errorLogFilePath = path.join(PROJECTS_DIR, 'deprecated-error.log');

    // 로그 디렉토리 생성
    this.initializeLogsDirectory();
  }

  /**
   * Logger 인스턴스 가져오기
   */
  public static getInstance(options?: LoggerOptions): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(options);
    }
    return Logger.instance;
  }

  /**
   * 로그 디렉토리 초기화
   */
  private initializeLogsDirectory(): void {
    try {
      ensureDirectory(PROJECTS_DIR);
    } catch (error) {
      console.error('Failed to create logs directory:', error);
    }
  }

  /**
   * 로그 레벨 우선순위 비교
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const minLevelIndex = levels.indexOf(this.options.minLevel);
    const currentLevelIndex = levels.indexOf(level);
    return currentLevelIndex >= minLevelIndex;
  }

  /**
   * 로그 엔트리 생성
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
    };
  }

  /**
   * 콘솔에 로그 출력
   */
  private logToConsole(entry: LogEntry): void {
    if (!this.options.consoleEnabled) {
      return;
    }

    const timestamp = chalk.dim(new Date(entry.timestamp).toLocaleTimeString());
    const level = this.formatLogLevel(entry.level);
    const message = entry.message;

    let output = `${timestamp} ${level} ${message}`;

    if (entry.context) {
      output += chalk.dim(` ${JSON.stringify(entry.context)}`);
    }

    if (entry.error) {
      output += `\n${chalk.red(entry.error.stack || entry.error.message)}`;
    }

    console.log(output);
  }

  /**
   * 로그 레벨을 컬러로 포맷팅
   */
  private formatLogLevel(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return chalk.gray('[DEBUG]');
      case LogLevel.INFO:
        return chalk.blue('[INFO] ');
      case LogLevel.WARN:
        return chalk.yellow('[WARN] ');
      case LogLevel.ERROR:
        return chalk.red('[ERROR]');
      default:
        return `[${level}]`;
    }
  }

  /**
   * 파일에 로그 작성
   */
  private async logToFile(entry: LogEntry): Promise<void> {
    if (!this.options.fileEnabled) {
      return;
    }

    try {
      // 로그 파일 크기 확인 및 로테이션
      await this.rotateLogFileIfNeeded(this.logFilePath);

      // 로그 작성
      const logLine = JSON.stringify(entry) + '\n';
      await fs.promises.appendFile(this.logFilePath, logLine, 'utf8');

      // 에러 레벨인 경우 error.log에도 작성
      if (entry.level === LogLevel.ERROR) {
        await this.rotateLogFileIfNeeded(this.errorLogFilePath);
        await fs.promises.appendFile(this.errorLogFilePath, logLine, 'utf8');
      }
    } catch (error) {
      // 파일 로깅 실패는 콘솔에만 출력
      console.error('Failed to write log to file:', error);
    }
  }

  /**
   * 로그 파일 로테이션
   */
  private async rotateLogFileIfNeeded(filePath: string): Promise<void> {
    try {
      // 파일이 없으면 로테이션 불필요
      if (!fs.existsSync(filePath)) {
        return;
      }

      // 파일 크기 확인
      const stats = await fs.promises.stat(filePath);

      if (stats.size >= this.options.maxFileSize) {
        // 현재 날짜로 파일명 생성
        const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const ext = path.extname(filePath);
        const base = path.basename(filePath, ext);
        const dir = path.dirname(filePath);
        const newFilePath = path.join(dir, `${base}-${date}${ext}`);

        // 기존 파일을 새 이름으로 이동
        await fs.promises.rename(filePath, newFilePath);

        // 오래된 로그 파일 정리
        await this.cleanOldLogFiles(dir, base, ext);
      }
    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }
  }

  /**
   * 오래된 로그 파일 정리
   */
  private async cleanOldLogFiles(dir: string, base: string, ext: string): Promise<void> {
    try {
      const files = await fs.promises.readdir(dir);
      const logFiles = files
        .filter(file => file.startsWith(base) && file.endsWith(ext) && file !== `${base}${ext}`)
        .map(file => ({
          name: file,
          path: path.join(dir, file),
        }));

      // 파일 개수가 maxFiles를 초과하면 오래된 것부터 삭제
      if (logFiles.length > this.options.maxFiles) {
        // 파일을 생성 시간 기준으로 정렬
        const filesWithStats = await Promise.all(
          logFiles.map(async file => ({
            ...file,
            mtime: (await fs.promises.stat(file.path)).mtime,
          }))
        );

        filesWithStats.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());

        // 가장 오래된 파일들 삭제
        const filesToDelete = filesWithStats.slice(0, logFiles.length - this.options.maxFiles);
        await Promise.all(filesToDelete.map(file => fs.promises.unlink(file.path)));
      }
    } catch (error) {
      console.error('Failed to clean old log files:', error);
    }
  }

  /**
   * 로그 작성 (내부)
   */
  private async log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error
  ): Promise<void> {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry = this.createLogEntry(level, message, context, error);

    // 콘솔 로깅
    this.logToConsole(entry);

    // 파일 로깅 (비동기, fire-and-forget)
    this.logToFile(entry).catch(err => {
      console.error('Failed to log to file:', err);
    });
  }

  /**
   * DEBUG 레벨 로그
   */
  public debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * INFO 레벨 로그
   */
  public info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * WARN 레벨 로그
   */
  public warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * ERROR 레벨 로그
   */
  public error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  /**
   * 로거 옵션 업데이트
   */
  public updateOptions(options: Partial<LoggerOptions>): void {
    this.options = {
      ...this.options,
      ...options,
    };
  }

  /**
   * 로그 레벨 설정
   */
  public setMinLevel(level: LogLevel): void {
    this.options.minLevel = level;
  }
}

/**
 * 전역 Logger 인스턴스
 */
export const logger = Logger.getInstance();
