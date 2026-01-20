/**
 * Logger System for Electron Main Process
 * - 날짜별 로그 파일 저장
 * - 로그 레벨 설정
 * - 로그 파일 열기/다운로드 기능
 */

import fs from 'fs';
import path from 'path';
import { app, shell } from 'electron';

// 로그 레벨 정의
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

// 로그 레벨 이름 매핑
const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.FATAL]: 'FATAL',
};

// 로그 엔트리 타입
export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  data?: unknown;
}

// 로거 설정 타입
export interface LoggerConfig {
  logLevel: LogLevel;
  logDir: string;
  maxLogFiles: number;
  maxLogSize: number; // bytes
  consoleOutput: boolean;
}

// 기본 설정
const DEFAULT_CONFIG: LoggerConfig = {
  logLevel: LogLevel.INFO,
  logDir: '',
  maxLogFiles: 7, // 7일치 보관
  maxLogSize: 10 * 1024 * 1024, // 10MB
  consoleOutput: true,
};

class Logger {
  private config: LoggerConfig;
  private currentLogFile: string = '';
  private writeStream: fs.WriteStream | null = null;
  private initialized: boolean = false;

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
  }

  /**
   * 로거 초기화
   */
  async initialize(customConfig?: Partial<LoggerConfig>): Promise<void> {
    if (this.initialized) return;

    // 설정 병합
    this.config = { ...this.config, ...customConfig };

    // 로그 디렉토리 설정
    if (!this.config.logDir) {
      this.config.logDir = path.join(app.getPath('userData'), 'logs');
    }

    // 로그 디렉토리 생성
    await this.ensureLogDirectory();

    // 오래된 로그 파일 정리
    await this.cleanOldLogs();

    // 현재 로그 파일 설정
    this.updateLogFile();

    this.initialized = true;
    this.info('Logger initialized', { logDir: this.config.logDir });
  }

  /**
   * 로그 디렉토리 생성
   */
  private async ensureLogDirectory(): Promise<void> {
    try {
      await fs.promises.mkdir(this.config.logDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  /**
   * 오래된 로그 파일 정리
   */
  private async cleanOldLogs(): Promise<void> {
    try {
      const files = await fs.promises.readdir(this.config.logDir);
      const logFiles = files
        .filter((f) => f.endsWith('.log'))
        .map((f) => ({
          name: f,
          path: path.join(this.config.logDir, f),
          date: this.extractDateFromFilename(f),
        }))
        .filter((f) => f.date !== null)
        .sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));

      // 최대 파일 수 초과 시 삭제
      const filesToDelete = logFiles.slice(this.config.maxLogFiles);
      for (const file of filesToDelete) {
        await fs.promises.unlink(file.path).catch(() => {});
      }
    } catch (error) {
      console.error('Failed to clean old logs:', error);
    }
  }

  /**
   * 파일명에서 날짜 추출
   */
  private extractDateFromFilename(filename: string): Date | null {
    const match = filename.match(/(\d{4}-\d{2}-\d{2})/);
    if (match) {
      return new Date(match[1]);
    }
    return null;
  }

  /**
   * 현재 로그 파일 업데이트
   */
  private updateLogFile(): void {
    const today = new Date().toISOString().split('T')[0];
    const newLogFile = path.join(this.config.logDir, `app-${today}.log`);

    if (this.currentLogFile !== newLogFile) {
      // 기존 스트림 닫기
      if (this.writeStream) {
        this.writeStream.end();
        this.writeStream = null;
      }

      this.currentLogFile = newLogFile;
      this.writeStream = fs.createWriteStream(newLogFile, { flags: 'a' });
    }
  }

  /**
   * 로그 레벨 설정
   */
  setLogLevel(level: LogLevel): void {
    this.config.logLevel = level;
  }

  /**
   * 로그 레벨 가져오기
   */
  getLogLevel(): LogLevel {
    return this.config.logLevel;
  }

  /**
   * 로그 기록
   */
  private log(level: LogLevel, message: string, data?: unknown): void {
    // 로그 레벨 필터링
    if (level < this.config.logLevel) return;

    const timestamp = new Date().toISOString();
    const levelName = LOG_LEVEL_NAMES[level];

    const entry: LogEntry = {
      timestamp,
      level: levelName,
      message,
      ...(data !== undefined && { data }),
    };

    const logLine = JSON.stringify(entry) + '\n';

    // 파일에 기록
    if (this.initialized) {
      this.updateLogFile(); // 날짜 변경 확인
      this.writeStream?.write(logLine);
    }

    // 실시간 콜백 알림
    this.notifyLogCallbacks(entry);

    // 콘솔 출력
    if (this.config.consoleOutput) {
      const consoleMessage = `[${timestamp}] [${levelName}] ${message}`;
      switch (level) {
        case LogLevel.DEBUG:
          console.debug(consoleMessage, data !== undefined ? data : '');
          break;
        case LogLevel.INFO:
          console.info(consoleMessage, data !== undefined ? data : '');
          break;
        case LogLevel.WARN:
          console.warn(consoleMessage, data !== undefined ? data : '');
          break;
        case LogLevel.ERROR:
        case LogLevel.FATAL:
          console.error(consoleMessage, data !== undefined ? data : '');
          break;
      }
    }
  }

  /**
   * 로그 메서드들
   */
  debug(message: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: unknown): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, data?: unknown): void {
    this.log(LogLevel.ERROR, message, data);
  }

  fatal(message: string, data?: unknown): void {
    this.log(LogLevel.FATAL, message, data);
  }

  // Flow control logging methods (for agent/planning)
  flow(message: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, `[FLOW] ${message}`, data);
  }

  enter(message: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, `[ENTER] ${message}`, data);
  }

  exit(message: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, `[EXIT] ${message}`, data);
  }

  /**
   * 로그 파일 경로 가져오기
   */
  getLogFilePath(): string {
    return this.currentLogFile;
  }

  /**
   * 로그 디렉토리 경로 가져오기
   */
  getLogDirectory(): string {
    return this.config.logDir;
  }

  /**
   * 로그 파일 목록 가져오기
   */
  async getLogFiles(): Promise<{ name: string; path: string; size: number; date: string }[]> {
    try {
      const files = await fs.promises.readdir(this.config.logDir);
      const logFiles = await Promise.all(
        files
          .filter((f) => f.endsWith('.log'))
          .map(async (name) => {
            const filePath = path.join(this.config.logDir, name);
            const stats = await fs.promises.stat(filePath);
            const dateMatch = name.match(/(\d{4}-\d{2}-\d{2})/);
            return {
              name,
              path: filePath,
              size: stats.size,
              date: dateMatch ? dateMatch[1] : 'unknown',
            };
          })
      );

      return logFiles.sort((a, b) => b.date.localeCompare(a.date));
    } catch (error) {
      this.error('Failed to get log files', error);
      return [];
    }
  }

  /**
   * 로그 파일 내용 읽기
   */
  async readLogFile(filePath: string): Promise<string> {
    try {
      return await fs.promises.readFile(filePath, 'utf-8');
    } catch (error) {
      this.error('Failed to read log file', { filePath, error });
      throw error;
    }
  }

  /**
   * 로그 파일 탐색기에서 열기
   */
  async openLogFileInExplorer(filePath?: string): Promise<void> {
    const targetPath = filePath || this.currentLogFile;
    if (targetPath) {
      shell.showItemInFolder(targetPath);
    }
  }

  /**
   * 로그 디렉토리 탐색기에서 열기
   */
  async openLogDirectory(): Promise<void> {
    shell.openPath(this.config.logDir);
  }

  /**
   * 특정 날짜의 로그 파일 경로 가져오기
   */
  getLogFilePathForDate(date: Date): string {
    const dateStr = date.toISOString().split('T')[0];
    return path.join(this.config.logDir, `app-${dateStr}.log`);
  }

  /**
   * 로거 종료
   */
  async shutdown(): Promise<void> {
    if (this.writeStream) {
      return new Promise((resolve) => {
        this.writeStream?.end(() => {
          this.writeStream = null;
          resolve();
        });
      });
    }
  }

  /**
   * 로그 파일 삭제
   */
  async deleteLogFile(filePath: string): Promise<void> {
    try {
      // 현재 로그 파일은 삭제 불가
      if (filePath === this.currentLogFile) {
        throw new Error('Cannot delete current log file');
      }
      await fs.promises.unlink(filePath);
      this.info('Log file deleted', { filePath });
    } catch (error) {
      this.error('Failed to delete log file', { filePath, error });
      throw error;
    }
  }

  /**
   * 모든 로그 파일 삭제 (현재 로그 파일 제외)
   */
  async clearAllLogs(): Promise<number> {
    try {
      const files = await this.getLogFiles();
      let deletedCount = 0;

      for (const file of files) {
        if (file.path !== this.currentLogFile) {
          await fs.promises.unlink(file.path).catch(() => {});
          deletedCount++;
        }
      }

      this.info('Logs cleared', { deletedCount });
      return deletedCount;
    } catch (error) {
      this.error('Failed to clear logs', error);
      throw error;
    }
  }

  /**
   * 로그 엔트리 파싱 (JSON Lines 형식)
   */
  parseLogEntries(content: string): LogEntry[] {
    const entries: LogEntry[] = [];
    const lines = content.split('\n').filter(line => line.trim());

    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as LogEntry;
        entries.push(entry);
      } catch {
        // 파싱 실패 시 원본 텍스트로 처리
        entries.push({
          timestamp: new Date().toISOString(),
          level: 'INFO',
          message: line,
        });
      }
    }

    return entries;
  }

  /**
   * 로그 파일 내용을 파싱된 엔트리로 읽기
   */
  async readLogEntries(filePath: string): Promise<LogEntry[]> {
    const content = await this.readLogFile(filePath);
    return this.parseLogEntries(content);
  }

  /**
   * 실시간 로그 스트리밍을 위한 콜백 등록
   */
  private logCallbacks: Set<(entry: LogEntry) => void> = new Set();

  onLogEntry(callback: (entry: LogEntry) => void): () => void {
    this.logCallbacks.add(callback);
    return () => this.logCallbacks.delete(callback);
  }

  /**
   * 로그 콜백 알림
   */
  private notifyLogCallbacks(entry: LogEntry): void {
    for (const callback of this.logCallbacks) {
      try {
        callback(entry);
      } catch {
        // 콜백 에러 무시
      }
    }
  }
}

// 싱글톤 인스턴스
export const logger = new Logger();

// 편의를 위한 함수 내보내기
export const debug = logger.debug.bind(logger);
export const info = logger.info.bind(logger);
export const warn = logger.warn.bind(logger);
export const error = logger.error.bind(logger);
export const fatal = logger.fatal.bind(logger);
