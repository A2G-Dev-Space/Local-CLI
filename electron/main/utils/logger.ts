/**
 * Logger System for Electron Main Process
 * - 날짜별 로그 파일 저장
 * - 로그 레벨 설정
 * - 로그 파일 열기/다운로드 기능
 */

import fs from 'fs';
import path from 'path';
import { app, shell } from 'electron';

// 로그 레벨 정의 (CLI parity: ERROR=0 가장 높은 우선순위, VERBOSE=4 가장 낮은 우선순위)
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  VERBOSE = 4,
}

// 로그 레벨 이름 매핑
const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.VERBOSE]: 'VERBOSE',
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
  logLevel: LogLevel.INFO, // CLI parity: INFO=2 shows ERROR(0), WARN(1), INFO(2)
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

  // Session-specific logging
  private currentSessionId: string | null = null;
  private sessionLogFile: string = '';
  private sessionWriteStream: fs.WriteStream | null = null;
  private sessionLogDir: string = '';

  // Current Run logging (exe 시작부터 종료까지)
  private currentRunLogFile: string = '';
  private currentRunWriteStream: fs.WriteStream | null = null;
  private currentRunId: string = '';
  private runLogDir: string = '';

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

    // Session 로그 디렉토리 설정
    this.sessionLogDir = path.join(this.config.logDir, 'sessions');
    await fs.promises.mkdir(this.sessionLogDir, { recursive: true });

    // Current Run 로그 디렉토리 설정
    this.runLogDir = path.join(this.config.logDir, 'runs');
    await fs.promises.mkdir(this.runLogDir, { recursive: true });

    // 오래된 로그 파일 정리
    await this.cleanOldLogs();
    await this.cleanOldRunLogs();

    // 현재 로그 파일 설정
    this.updateLogFile();

    // Current Run 로그 파일 설정 (exe 시작 시 한 번만)
    this.initializeCurrentRunLog();

    this.initialized = true;
    this.info('Logger initialized', { logDir: this.config.logDir, runId: this.currentRunId });
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
   * 오래된 Run 로그 파일 정리 (최근 10개만 유지)
   */
  private async cleanOldRunLogs(): Promise<void> {
    try {
      const files = await fs.promises.readdir(this.runLogDir);
      const runFiles = await Promise.all(
        files
          .filter((f) => f.startsWith('run-') && f.endsWith('.log'))
          .map(async (name) => {
            const filePath = path.join(this.runLogDir, name);
            const stats = await fs.promises.stat(filePath);
            return { name, path: filePath, mtime: stats.mtimeMs };
          })
      );

      // 최신순 정렬 후 10개 초과분 삭제
      const sorted = runFiles.sort((a, b) => b.mtime - a.mtime);
      const filesToDelete = sorted.slice(10);
      for (const file of filesToDelete) {
        await fs.promises.unlink(file.path).catch(() => {});
      }
    } catch (error) {
      console.error('Failed to clean old run logs:', error);
    }
  }

  /**
   * Current Run 로그 파일 초기화 (exe 시작 시 한 번)
   */
  private initializeCurrentRunLog(): void {
    // 고유 Run ID 생성 (타임스탬프 기반)
    const now = new Date();
    this.currentRunId = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    this.currentRunLogFile = path.join(this.runLogDir, `run-${this.currentRunId}.log`);
    this.currentRunWriteStream = fs.createWriteStream(this.currentRunLogFile, { flags: 'a' });
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
    // 로그 레벨 필터링 (CLI parity: level <= config.logLevel만 출력)
    // ERROR=0 항상 출력, VERBOSE=4는 config가 VERBOSE일 때만
    if (level > this.config.logLevel) return;

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

      // Current Run 로그에도 기록
      if (this.currentRunWriteStream) {
        this.currentRunWriteStream.write(logLine);
      }

      // Session 로그에도 기록
      if (this.sessionWriteStream) {
        this.sessionWriteStream.write(logLine);
      }
    }

    // 실시간 콜백 알림
    this.notifyLogCallbacks(entry);

    // 콘솔 출력
    if (this.config.consoleOutput) {
      const consoleMessage = `[${timestamp}] [${levelName}] ${message}`;
      switch (level) {
        case LogLevel.ERROR:
          console.error(consoleMessage, data !== undefined ? data : '');
          break;
        case LogLevel.WARN:
          console.warn(consoleMessage, data !== undefined ? data : '');
          break;
        case LogLevel.INFO:
          console.info(consoleMessage, data !== undefined ? data : '');
          break;
        case LogLevel.DEBUG:
        case LogLevel.VERBOSE:
          console.debug(consoleMessage, data !== undefined ? data : '');
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

  /**
   * Fatal level logging - maps to ERROR (CLI parity: no separate FATAL level)
   */
  fatal(message: string, data?: unknown): void {
    this.log(LogLevel.ERROR, `[FATAL] ${message}`, data);
  }

  // Flow control logging methods (for agent/planning) - CLI parity

  /**
   * Log flow - 실행 흐름 추적 (함수 호출, 분기 등)
   */
  flow(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, `[FLOW] ${message}`, context);
  }

  /**
   * Log function enter (CLI parity)
   */
  enter(functionName: string, args?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, `[ENTER] ${functionName}`, args);
  }

  /**
   * Log function exit (CLI parity)
   */
  exit(functionName: string, result?: unknown): void {
    this.log(LogLevel.DEBUG, `[EXIT] ${functionName}`, result !== undefined ? { result } : undefined);
  }

  /**
   * Log variables - 변수 값 추적 (CLI parity)
   */
  vars(variables: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, '[VARS]', variables);
  }

  /**
   * Log state change (CLI parity)
   */
  state(description: string, before: unknown, after: unknown): void {
    this.log(LogLevel.DEBUG, `[STATE] ${description}`, { before, after });
  }

  /**
   * Log tool execution (CLI parity)
   */
  toolExecution(toolName: string, args: unknown, result?: unknown, error?: Error): void {
    if (error) {
      this.log(LogLevel.DEBUG, `[TOOL FAILED] ${toolName}`, { args, error: error.message });
    } else {
      this.log(LogLevel.DEBUG, `[TOOL SUCCESS] ${toolName}`, { args, result });
    }
  }

  // Performance timer (CLI parity)
  private timers: Map<string, number> = new Map();

  /**
   * Start performance timer (CLI parity)
   */
  startTimer(label: string): void {
    this.timers.set(label, Date.now());
    this.log(LogLevel.DEBUG, `[TIMER START] ${label}`);
  }

  /**
   * End performance timer (CLI parity)
   */
  endTimer(label: string): number {
    const startTime = this.timers.get(label);
    if (!startTime) {
      this.warn(`Timer "${label}" was not started`);
      return 0;
    }

    const elapsed = Date.now() - startTime;
    this.timers.delete(label);
    this.log(LogLevel.DEBUG, `[TIMER END] ${label}`, { elapsed: `${elapsed}ms` });
    return elapsed;
  }

  // ============ Session-specific logging ============

  /**
   * Set current session for logging
   */
  setSessionId(sessionId: string | null): void {
    // Close previous session stream
    if (this.sessionWriteStream) {
      this.sessionWriteStream.end();
      this.sessionWriteStream = null;
    }

    this.currentSessionId = sessionId;

    if (sessionId) {
      this.sessionLogFile = path.join(this.sessionLogDir, `session-${sessionId}.log`);
      this.sessionWriteStream = fs.createWriteStream(this.sessionLogFile, { flags: 'a' });
      this.info('Session logging started', { sessionId });
    } else {
      this.sessionLogFile = '';
    }
  }

  /**
   * Get current session ID
   */
  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Get session log file path
   */
  getSessionLogFilePath(): string {
    return this.sessionLogFile;
  }

  /**
   * Get all session log files
   */
  async getSessionLogFiles(): Promise<{ sessionId: string; path: string; size: number; modifiedAt: number }[]> {
    try {
      const files = await fs.promises.readdir(this.sessionLogDir);
      const sessionFiles = await Promise.all(
        files
          .filter((f) => f.startsWith('session-') && f.endsWith('.log'))
          .map(async (name) => {
            const filePath = path.join(this.sessionLogDir, name);
            const stats = await fs.promises.stat(filePath);
            const sessionId = name.replace('session-', '').replace('.log', '');
            return {
              sessionId,
              path: filePath,
              size: stats.size,
              modifiedAt: stats.mtimeMs,
            };
          })
      );

      return sessionFiles.sort((a, b) => b.modifiedAt - a.modifiedAt);
    } catch (error) {
      this.error('Failed to get session log files', error);
      return [];
    }
  }

  /**
   * Read session log file
   */
  async readSessionLog(sessionId: string): Promise<LogEntry[]> {
    const filePath = path.join(this.sessionLogDir, `session-${sessionId}.log`);
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return this.parseLogEntries(content);
    } catch (error) {
      // File might not exist yet
      return [];
    }
  }

  /**
   * Delete session log file
   */
  async deleteSessionLog(sessionId: string): Promise<void> {
    const filePath = path.join(this.sessionLogDir, `session-${sessionId}.log`);
    try {
      await fs.promises.unlink(filePath);
      this.info('Session log deleted', { sessionId });
    } catch (error) {
      this.error('Failed to delete session log', { sessionId, error });
    }
  }

  // ============================================================================
  // Current Run Log Methods (이번 실행 로그)
  // ============================================================================

  /**
   * Get current run ID
   */
  getCurrentRunId(): string {
    return this.currentRunId;
  }

  /**
   * Get current run log file path
   */
  getCurrentRunLogFilePath(): string {
    return this.currentRunLogFile;
  }

  /**
   * Get all run log files
   */
  async getRunLogFiles(): Promise<{ runId: string; path: string; size: number; modifiedAt: number }[]> {
    try {
      const files = await fs.promises.readdir(this.runLogDir);
      const runFiles = await Promise.all(
        files
          .filter((f) => f.startsWith('run-') && f.endsWith('.log'))
          .map(async (name) => {
            const filePath = path.join(this.runLogDir, name);
            const stats = await fs.promises.stat(filePath);
            const runId = name.replace('run-', '').replace('.log', '');
            return {
              runId,
              path: filePath,
              size: stats.size,
              modifiedAt: stats.mtimeMs,
            };
          })
      );

      return runFiles.sort((a, b) => b.modifiedAt - a.modifiedAt);
    } catch (error) {
      this.error('Failed to get run log files', error);
      return [];
    }
  }

  /**
   * Read current run log (이번 실행 로그 읽기)
   */
  async readCurrentRunLog(): Promise<LogEntry[]> {
    if (!this.currentRunLogFile) {
      return [];
    }
    try {
      const content = await fs.promises.readFile(this.currentRunLogFile, 'utf-8');
      return this.parseLogEntries(content);
    } catch (error) {
      return [];
    }
  }

  /**
   * Read specific run log by runId
   */
  async readRunLog(runId: string): Promise<LogEntry[]> {
    const filePath = path.join(this.runLogDir, `run-${runId}.log`);
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return this.parseLogEntries(content);
    } catch (error) {
      return [];
    }
  }

  /**
   * Delete run log file
   */
  async deleteRunLog(runId: string): Promise<void> {
    const filePath = path.join(this.runLogDir, `run-${runId}.log`);
    try {
      await fs.promises.unlink(filePath);
      this.info('Run log deleted', { runId });
    } catch (error) {
      this.error('Failed to delete run log', { runId, error });
    }
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
    // shutdown 이후 log() 호출 시 write 방지
    this.initialized = false;

    const closeStream = (stream: fs.WriteStream | null): Promise<void> =>
      new Promise((resolve) => {
        if (stream && !stream.destroyed) {
          stream.end(() => resolve());
        } else {
          resolve();
        }
      });

    await Promise.all([
      closeStream(this.writeStream),
      closeStream(this.currentRunWriteStream),
      closeStream(this.sessionWriteStream),
    ]);

    this.writeStream = null;
    this.currentRunWriteStream = null;
    this.sessionWriteStream = null;
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

  // ============================================================================
  // HTTP Methods (CLI parity)
  // ============================================================================

  /**
   * Log HTTP request (CLI parity)
   */
  httpRequest(method: string, url: string, body?: unknown): void {
    this.log(LogLevel.DEBUG, `[HTTP REQUEST] ${method} ${url}`, body ? { body } : undefined);
  }

  /**
   * Log HTTP response (CLI parity)
   */
  httpResponse(status: number, statusText: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, `[HTTP RESPONSE] ${status} ${statusText}`, data ? { data } : undefined);
  }

  /**
   * Log HTTP error (CLI parity)
   */
  httpError(url: string, error: Error | unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.log(LogLevel.ERROR, `[HTTP ERROR] ${url}`, { error: errorMessage });
  }

  /**
   * Log HTTP stream start (CLI parity)
   */
  httpStreamStart(method: string, url: string): void {
    this.log(LogLevel.DEBUG, `[HTTP STREAM START] ${method} ${url}`);
  }

  /**
   * Log HTTP stream end (CLI parity)
   */
  httpStreamEnd(totalBytes: number, duration: number): void {
    this.log(LogLevel.DEBUG, `[HTTP STREAM END]`, { totalBytes, duration });
  }

  // ============================================================================
  // Tool Methods (CLI parity)
  // ============================================================================

  /**
   * Log tool start (CLI parity)
   */
  toolStart(name: string, args: unknown, reason?: string): void {
    this.log(LogLevel.DEBUG, `[TOOL START] ${name}`, { args, reason });
  }

  /**
   * Log tool success (CLI parity)
   */
  toolSuccess(name: string, args: unknown, result: unknown, duration: number): void {
    this.log(LogLevel.DEBUG, `[TOOL SUCCESS] ${name}`, { args, result, duration });
  }

  /**
   * Log tool error (CLI parity)
   */
  toolError(name: string, args: unknown, error: Error, duration: number): void {
    this.log(LogLevel.ERROR, `[TOOL ERROR] ${name}`, { args, error: error.message, duration });
  }

  // ============================================================================
  // IPC Communication Methods
  // ============================================================================

  /**
   * Log IPC send
   */
  ipcSend(channel: string, context: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, `[IPC SEND] ${channel}`, context);
  }

  /**
   * Log IPC receive
   */
  ipcReceive(channel: string, context: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, `[IPC RECEIVE] ${channel}`, context);
  }

  /**
   * Log IPC invoke
   */
  ipcInvoke(channel: string, context: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, `[IPC INVOKE] ${channel}`, context);
  }

  /**
   * Log IPC handle
   */
  ipcHandle(channel: string, context: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, `[IPC HANDLE] ${channel}`, context);
  }

  /**
   * Log IPC error
   */
  ipcError(channel: string, context: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, `[IPC ERROR] ${channel}`, context);
  }

  // ============================================================================
  // Window Methods
  // ============================================================================

  /**
   * Log window create
   */
  windowCreate(context: Record<string, unknown>): void {
    this.log(LogLevel.INFO, `[WINDOW CREATE]`, context);
  }

  /**
   * Log window close
   */
  windowClose(context: Record<string, unknown>): void {
    this.log(LogLevel.INFO, `[WINDOW CLOSE]`, context);
  }

  /**
   * Log window state change
   */
  windowStateChange(context: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, `[WINDOW STATE]`, context);
  }

  /**
   * Log window focus
   */
  windowFocus(context: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, `[WINDOW FOCUS]`, context);
  }

  /**
   * Log window blur
   */
  windowBlur(context: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, `[WINDOW BLUR]`, context);
  }

  // ============================================================================
  // System/App Methods
  // ============================================================================

  /**
   * Log app ready
   */
  appReady(context: Record<string, unknown>): void {
    this.log(LogLevel.INFO, `[APP READY]`, context);
  }

  /**
   * Log app activate
   */
  appActivate(context: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, `[APP ACTIVATE]`, context);
  }

  /**
   * Log app before quit
   */
  appBeforeQuit(context: Record<string, unknown>): void {
    this.log(LogLevel.INFO, `[APP BEFORE QUIT]`, context);
  }

  /**
   * Log app quit
   */
  appQuit(context: Record<string, unknown>): void {
    this.log(LogLevel.INFO, `[APP QUIT]`, context);
  }

  /**
   * Log system suspend
   */
  systemSuspend(): void {
    this.log(LogLevel.INFO, `[SYSTEM SUSPEND]`);
  }

  /**
   * Log system resume
   */
  systemResume(context: Record<string, unknown>): void {
    this.log(LogLevel.INFO, `[SYSTEM RESUME]`, context);
  }

  /**
   * Log network change
   */
  networkChange(context: Record<string, unknown>): void {
    this.log(LogLevel.INFO, `[NETWORK CHANGE]`, context);
  }

  /**
   * Log system theme change
   */
  systemThemeChange(context: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, `[THEME CHANGE]`, context);
  }

  // ============================================================================
  // Auto Update Methods
  // ============================================================================

  /**
   * Log update check start
   */
  updateCheckStart(): void {
    this.log(LogLevel.INFO, `[UPDATE] Check started`);
  }

  /**
   * Log update available
   */
  updateAvailable(context: Record<string, unknown>): void {
    this.log(LogLevel.INFO, `[UPDATE] Available`, context);
  }

  /**
   * Log update download start
   */
  updateDownloadStart(context: Record<string, unknown>): void {
    this.log(LogLevel.INFO, `[UPDATE] Download started`, context);
  }

  /**
   * Log update download progress
   */
  updateDownloadProgress(context: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, `[UPDATE] Download progress`, context);
  }

  /**
   * Log update download complete
   */
  updateDownloadComplete(context: Record<string, unknown>): void {
    this.log(LogLevel.INFO, `[UPDATE] Download complete`, context);
  }

  /**
   * Log update installing
   */
  updateInstalling(): void {
    this.log(LogLevel.INFO, `[UPDATE] Installing`);
  }

  /**
   * Log update installed
   */
  updateInstalled(context: Record<string, unknown>): void {
    this.log(LogLevel.INFO, `[UPDATE] Installed`, context);
  }

  /**
   * Log update error
   */
  updateError(context: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, `[UPDATE] Error`, context);
  }

  // ============================================================================
  // UI/Component Methods (CLI parity)
  // ============================================================================

  /**
   * Log user click (CLI parity)
   */
  userClick(element: string, context: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, `[UI CLICK] ${element}`, context);
  }

  /**
   * Log user keyboard (CLI parity)
   */
  userKeyboard(type: string, context: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, `[UI KEYBOARD] ${type}`, context);
  }

  /**
   * Log component mount (CLI parity)
   */
  componentMount(name: string, context: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, `[COMPONENT MOUNT] ${name}`, context);
  }

  /**
   * Log component unmount (CLI parity)
   */
  componentUnmount(name: string, context: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, `[COMPONENT UNMOUNT] ${name}`, context);
  }

  /**
   * Log component state change (CLI parity)
   */
  componentStateChange(name: string, field: string, context: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, `[COMPONENT STATE] ${name}.${field}`, context);
  }

  /**
   * Log screen change (CLI parity)
   */
  screenChange(to: string, context: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, `[SCREEN CHANGE] ${to}`, context);
  }

  /**
   * Log modal open (CLI parity)
   */
  modalOpen(id: string, context: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, `[MODAL OPEN] ${id}`, context);
  }

  /**
   * Log modal close (CLI parity)
   */
  modalClose(id: string, context: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, `[MODAL CLOSE] ${id}`, context);
  }

  /**
   * Log form submit (CLI parity)
   */
  formSubmit(formId: string, context: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, `[FORM SUBMIT] ${formId}`, context);
  }

  /**
   * Log loading start (CLI parity)
   */
  loadingStart(id: string, context: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, `[LOADING START] ${id}`, context);
  }

  /**
   * Log loading end (CLI parity)
   */
  loadingEnd(id: string, context: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, `[LOADING END] ${id}`, context);
  }

  /**
   * Log session start (CLI parity)
   */
  sessionStart(context: Record<string, unknown>): void {
    this.log(LogLevel.INFO, `[SESSION START]`, context);
  }

  /**
   * Log session end (CLI parity)
   */
  sessionEnd(context: Record<string, unknown>): void {
    this.log(LogLevel.INFO, `[SESSION END]`, context);
  }

  /**
   * Log error boundary (CLI parity)
   */
  errorBoundary(context: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, `[ERROR BOUNDARY]`, context);
  }

  /**
   * Log global error (CLI parity)
   */
  globalError(context: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, `[GLOBAL ERROR]`, context);
  }

  /**
   * Log feature usage (CLI parity)
   */
  featureUsage(name: string, context: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, `[FEATURE USAGE] ${name}`, context);
  }

  // ============================================================================
  // LLM Methods (CLI parity)
  // ============================================================================

  /**
   * Log LLM request (CLI parity)
   */
  llmRequest(messages: unknown[], model: string, tools?: unknown[]): void {
    this.log(LogLevel.DEBUG, `[LLM REQUEST]`, {
      model,
      messagesCount: Array.isArray(messages) ? messages.length : 0,
      toolsCount: Array.isArray(tools) ? tools.length : 0,
    });
  }

  /**
   * Log LLM response (CLI parity)
   */
  llmResponse(response: string, toolCalls?: unknown[]): void {
    this.log(LogLevel.DEBUG, `[LLM RESPONSE]`, {
      responseLength: response.length,
      toolCallsCount: Array.isArray(toolCalls) ? toolCalls.length : 0,
    });
  }

  /**
   * Log LLM tool result (CLI parity)
   */
  llmToolResult(toolName: string, result: string, success: boolean): void {
    this.log(LogLevel.DEBUG, `[LLM TOOL RESULT] ${toolName}`, {
      success,
      resultLength: result.length,
    });
  }

  /**
   * Log bash/powershell execution (CLI parity)
   */
  bashExecution(formattedDisplay: string): void {
    this.log(LogLevel.DEBUG, `[BASH EXECUTION]`, { display: formattedDisplay });
  }

  /**
   * Verbose level logging (CLI parity)
   */
  verbose(message: string, data?: unknown): void {
    this.log(LogLevel.VERBOSE, message, data);
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
export const verbose = logger.verbose.bind(logger);
