/**
 * Logger Utility
 *
 * Verbose logging for debugging with full flow tracking
 */

import chalk from 'chalk';
import { getJsonStreamLogger } from './json-stream-logger.js';
import * as path from 'path';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  VERBOSE = 4,
}

// LLM 로깅 전용 플래그 (--llm-log 모드)
let llmLogEnabled = false;

export function enableLLMLog(): void {
  llmLogEnabled = true;
}

export function disableLLMLog(): void {
  llmLogEnabled = false;
}

export function isLLMLogEnabled(): boolean {
  return llmLogEnabled;
}

export interface LoggerOptions {
  level?: LogLevel;
  prefix?: string;
  timestamp?: boolean;
  showLocation?: boolean; // 파일명, 함수명, 라인 표시
  showPid?: boolean; // 프로세스 ID 표시
}

export interface CallLocation {
  file: string;
  line: number;
  column: number;
  function: string;
}

export interface VariableLog {
  name: string;
  value: unknown;
  type?: string;
}

/**
 * Logger class for structured logging with flow tracking
 */
export class Logger {
  private level: LogLevel;
  private prefix: string;
  private showTimestamp: boolean;
  private showLocation: boolean;
  private showPid: boolean;
  private traceId: string | null = null;
  private timers: Map<string, number> = new Map();

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? LogLevel.INFO;
    this.prefix = options.prefix ?? '';
    this.showTimestamp = options.timestamp ?? true;
    this.showLocation = options.showLocation ?? true;
    this.showPid = options.showPid ?? false;
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Set trace ID for flow tracking
   */
  setTraceId(traceId: string): void {
    this.traceId = traceId;
  }

  /**
   * Clear trace ID
   */
  clearTraceId(): void {
    this.traceId = null;
  }

  /**
   * Get current trace ID
   */
  getTraceId(): string | null {
    return this.traceId;
  }

  /**
   * Get call location from stack trace
   */
  private getCallLocation(depth: number = 3): CallLocation | null {
    try {
      const stack = new Error().stack;
      if (!stack) return null;

      const lines = stack.split('\n');
      if (lines.length <= depth) return null;

      // Extract file, line, column from stack trace
      // Format: "    at functionName (file:line:column)" or "    at file:line:column"
      const line = lines[depth];
      if (!line) return null;

      const match = line.match(/at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?/);

      if (!match) return null;

      const [, functionName, file, lineNum, column] = match;

      if (!file || !lineNum || !column) return null;

      return {
        file: path.basename(file),
        line: parseInt(lineNum),
        column: parseInt(column),
        function: functionName?.trim() || '<anonymous>',
      };
    } catch {
      return null;
    }
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
   * Get formatted process ID
   */
  private getPid(): string {
    if (!this.showPid) return '';
    return chalk.dim(`[PID:${process.pid}]`);
  }

  /**
   * Get formatted trace ID
   */
  private getTraceIdStr(): string {
    if (!this.traceId) return '';
    return chalk.magenta(`[Trace:${this.traceId.slice(0, 8)}]`);
  }

  /**
   * Get formatted location
   */
  private getLocation(location: CallLocation | null): string {
    if (!this.showLocation || !location) return '';
    return chalk.dim(`[${location.file}:${location.line}:${location.function}]`);
  }

  /**
   * Format variable for logging
   */
  private formatVariable(variable: VariableLog): string {
    const type = variable.type || typeof variable.value;
    const valueStr = this.formatValue(variable.value);
    return chalk.yellow(variable.name) + chalk.gray('=') + chalk.white(valueStr) + chalk.dim(` (${type})`);
  }

  /**
   * Format value for display
   */
  private formatValue(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (typeof value === 'function') return '[Function]';
    if (Array.isArray(value)) return `Array(${value.length})`;
    if (value instanceof Error) return `Error: ${value.message}`;
    try {
      const json = JSON.stringify(value);
      return json.length > 100 ? json.slice(0, 100) + '...' : json;
    } catch {
      return '[Object]';
    }
  }

  /**
   * Log error
   */
  error(message: string, error?: Error | unknown): void {
    if (this.level < LogLevel.ERROR) return;

    const location = this.getCallLocation();
    const timestamp = this.getTimestamp();
    const prefix = this.getPrefix();
    const pid = this.getPid();
    const traceId = this.getTraceIdStr();
    const loc = this.getLocation(location);

    console.error(
      timestamp,
      prefix,
      pid,
      traceId,
      loc,
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

    const location = this.getCallLocation();
    const timestamp = this.getTimestamp();
    const prefix = this.getPrefix();
    const pid = this.getPid();
    const traceId = this.getTraceIdStr();
    const loc = this.getLocation(location);

    console.warn(
      timestamp,
      prefix,
      pid,
      traceId,
      loc,
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

    const location = this.getCallLocation();
    const timestamp = this.getTimestamp();
    const prefix = this.getPrefix();
    const pid = this.getPid();
    const traceId = this.getTraceIdStr();
    const loc = this.getLocation(location);

    console.log(
      timestamp,
      prefix,
      pid,
      traceId,
      loc,
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

    const location = this.getCallLocation();
    const timestamp = this.getTimestamp();
    const prefix = this.getPrefix();
    const pid = this.getPid();
    const traceId = this.getTraceIdStr();
    const loc = this.getLocation(location);

    console.log(
      timestamp,
      prefix,
      pid,
      traceId,
      loc,
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

    const location = this.getCallLocation();
    const timestamp = this.getTimestamp();
    const prefix = this.getPrefix();
    const pid = this.getPid();
    const traceId = this.getTraceIdStr();
    const loc = this.getLocation(location);

    console.log(
      timestamp,
      prefix,
      pid,
      traceId,
      loc,
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
   * Log flow - 실행 흐름 추적 (함수 호출, 분기 등)
   */
  flow(message: string, context?: Record<string, unknown>): void {
    if (this.level < LogLevel.DEBUG) return;

    const location = this.getCallLocation();
    const timestamp = this.getTimestamp();
    const prefix = this.getPrefix();
    const pid = this.getPid();
    const traceId = this.getTraceIdStr();
    const loc = this.getLocation(location);

    console.log(
      timestamp,
      prefix,
      pid,
      traceId,
      loc,
      chalk.green('➜ FLOW:'),
      message
    );

    if (context) {
      console.log(chalk.green('  Context:'), JSON.stringify(context, null, 2));
    }

    // Log to JSON stream if enabled
    const jsonLogger = getJsonStreamLogger();
    if (jsonLogger?.isActive()) {
      jsonLogger.logDebug(`[FLOW] ${message}`, context);
    }
  }

  /**
   * Log variables - 변수 값 추적
   */
  vars(...variables: VariableLog[]): void {
    if (this.level < LogLevel.DEBUG) return;

    const location = this.getCallLocation();
    const timestamp = this.getTimestamp();
    const prefix = this.getPrefix();
    const pid = this.getPid();
    const traceId = this.getTraceIdStr();
    const loc = this.getLocation(location);

    console.log(
      timestamp,
      prefix,
      pid,
      traceId,
      loc,
      chalk.cyan('📦 VARS:')
    );

    variables.forEach(variable => {
      console.log('  ', this.formatVariable(variable));
    });

    // Log to JSON stream if enabled
    const jsonLogger = getJsonStreamLogger();
    if (jsonLogger?.isActive()) {
      const varsData = variables.reduce((acc, v) => {
        acc[v.name] = v.value;
        return acc;
      }, {} as Record<string, unknown>);
      jsonLogger.logDebug('[VARS]', varsData);
    }
  }

  /**
   * Log function enter
   */
  enter(functionName: string, args?: Record<string, unknown>): void {
    if (this.level < LogLevel.DEBUG) return;

    const location = this.getCallLocation();
    const timestamp = this.getTimestamp();
    const prefix = this.getPrefix();
    const pid = this.getPid();
    const traceId = this.getTraceIdStr();
    const loc = this.getLocation(location);

    console.log(
      timestamp,
      prefix,
      pid,
      traceId,
      loc,
      chalk.green('↓ ENTER:'),
      chalk.bold(functionName)
    );

    if (args) {
      console.log(chalk.green('  Args:'), JSON.stringify(args, null, 2));
    }

    // Log to JSON stream if enabled
    const jsonLogger = getJsonStreamLogger();
    if (jsonLogger?.isActive()) {
      jsonLogger.logDebug(`[ENTER] ${functionName}`, args);
    }
  }

  /**
   * Log function exit
   */
  exit(functionName: string, result?: unknown): void {
    if (this.level < LogLevel.DEBUG) return;

    const location = this.getCallLocation();
    const timestamp = this.getTimestamp();
    const prefix = this.getPrefix();
    const pid = this.getPid();
    const traceId = this.getTraceIdStr();
    const loc = this.getLocation(location);

    console.log(
      timestamp,
      prefix,
      pid,
      traceId,
      loc,
      chalk.green('↑ EXIT:'),
      chalk.bold(functionName)
    );

    if (result !== undefined) {
      console.log(chalk.green('  Result:'), this.formatValue(result));
    }

    // Log to JSON stream if enabled
    const jsonLogger = getJsonStreamLogger();
    if (jsonLogger?.isActive()) {
      jsonLogger.logDebug(`[EXIT] ${functionName}`, { result });
    }
  }

  /**
   * Log state change
   */
  state(description: string, before: unknown, after: unknown): void {
    if (this.level < LogLevel.DEBUG) return;

    const location = this.getCallLocation();
    const timestamp = this.getTimestamp();
    const prefix = this.getPrefix();
    const pid = this.getPid();
    const traceId = this.getTraceIdStr();
    const loc = this.getLocation(location);

    console.log(
      timestamp,
      prefix,
      pid,
      traceId,
      loc,
      chalk.yellow('🔄 STATE:'),
      description
    );

    console.log(chalk.red('  Before:'), this.formatValue(before));
    console.log(chalk.green('  After:'), this.formatValue(after));

    // Log to JSON stream if enabled
    const jsonLogger = getJsonStreamLogger();
    if (jsonLogger?.isActive()) {
      jsonLogger.logDebug(`[STATE] ${description}`, { before, after });
    }
  }

  /**
   * Start performance timer
   */
  startTimer(label: string): void {
    this.timers.set(label, Date.now());

    if (this.level >= LogLevel.DEBUG) {
      const location = this.getCallLocation();
      const timestamp = this.getTimestamp();
      const prefix = this.getPrefix();
      const pid = this.getPid();
      const traceId = this.getTraceIdStr();
      const loc = this.getLocation(location);

      console.log(
        timestamp,
        prefix,
        pid,
        traceId,
        loc,
        chalk.blue('⏱️  TIMER START:'),
        label
      );
    }
  }

  /**
   * End performance timer
   */
  endTimer(label: string): number {
    const startTime = this.timers.get(label);
    if (!startTime) {
      this.warn(`Timer "${label}" was not started`);
      return 0;
    }

    const elapsed = Date.now() - startTime;
    this.timers.delete(label);

    if (this.level >= LogLevel.DEBUG) {
      const location = this.getCallLocation();
      const timestamp = this.getTimestamp();
      const prefix = this.getPrefix();
      const pid = this.getPid();
      const traceId = this.getTraceIdStr();
      const loc = this.getLocation(location);

      console.log(
        timestamp,
        prefix,
        pid,
        traceId,
        loc,
        chalk.blue('⏱️  TIMER END:'),
        label,
        chalk.bold(`${elapsed}ms`)
      );
    }

    return elapsed;
  }

  /**
   * Log HTTP request
   */
  httpRequest(method: string, url: string, body?: unknown): void {
    if (this.level < LogLevel.DEBUG) return;

    const location = this.getCallLocation();
    const timestamp = this.getTimestamp();
    const prefix = this.getPrefix();
    const pid = this.getPid();
    const traceId = this.getTraceIdStr();
    const loc = this.getLocation(location);

    console.log(
      timestamp,
      prefix,
      pid,
      traceId,
      loc,
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

    const location = this.getCallLocation();
    const timestamp = this.getTimestamp();
    const prefix = this.getPrefix();
    const pid = this.getPid();
    const traceId = this.getTraceIdStr();
    const loc = this.getLocation(location);
    const statusColor = status >= 400 ? chalk.red : status >= 300 ? chalk.yellow : chalk.green;

    console.log(
      timestamp,
      prefix,
      pid,
      traceId,
      loc,
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

    const location = this.getCallLocation();
    const timestamp = this.getTimestamp();
    const prefix = this.getPrefix();
    const pid = this.getPid();
    const traceId = this.getTraceIdStr();
    const loc = this.getLocation(location);

    if (error) {
      console.log(
        timestamp,
        prefix,
        pid,
        traceId,
        loc,
        chalk.red('🔧 TOOL FAILED:'),
        chalk.bold(toolName)
      );
      console.log(chalk.red('  Args:'), JSON.stringify(args, null, 2));
      console.log(chalk.red('  Error:'), error.message);
    } else {
      console.log(
        timestamp,
        prefix,
        pid,
        traceId,
        loc,
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

  /**
   * Log bash command execution with formatted display
   */
  bashExecution(formattedDisplay: string): void {
    if (this.level < LogLevel.INFO) return;

    // Split formatted display into lines and colorize
    const lines = formattedDisplay.split('\n');
    lines.forEach((line) => {
      if (line.startsWith('●')) {
        // Command header in cyan
        console.log(chalk.cyan(line));
      } else if (line.includes('Error:')) {
        // Error lines in red
        console.log(chalk.red(line));
      } else {
        // Output lines in default color
        console.log(line);
      }
    });

    // Add blank line after output for better readability
    console.log();
  }

  /**
   * Log LLM request (--llm-log mode only)
   */
  llmRequest(messages: unknown[], model: string, tools?: unknown[]): void {
    if (!llmLogEnabled) return;

    const timestamp = this.getTimestamp();
    console.log();
    console.log(chalk.cyan('─'.repeat(80)));
    console.log(chalk.cyan.bold(`[${timestamp}] 📤 LLM REQUEST`));
    console.log(chalk.gray(`Model: ${model}`));
    if (tools && Array.isArray(tools) && tools.length > 0) {
      console.log(chalk.gray(`Tools: ${tools.length} available`));
    }
    console.log(chalk.cyan('─'.repeat(40)));

    // Show messages
    if (Array.isArray(messages)) {
      messages.forEach((msg: any, idx) => {
        const role = msg.role || 'unknown';
        const content = msg.content || '';
        const roleColor = role === 'user' ? chalk.green : role === 'assistant' ? chalk.blue : chalk.yellow;

        console.log(roleColor.bold(`[${role.toUpperCase()}]`));
        if (content) {
          // Truncate very long content
          const displayContent = content.length > 2000
            ? content.substring(0, 2000) + chalk.gray(`\n... (${content.length - 2000} more chars)`)
            : content;
          console.log(displayContent);
        }
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          console.log(chalk.yellow(`  Tool calls: ${msg.tool_calls.map((tc: any) => tc.function?.name).join(', ')}`));
        }
        if (idx < messages.length - 1) console.log();
      });
    }
    console.log(chalk.cyan('─'.repeat(80)));
  }

  /**
   * Log LLM response (--llm-log mode only)
   */
  llmResponse(response: string, toolCalls?: unknown[]): void {
    if (!llmLogEnabled) return;

    const timestamp = this.getTimestamp();
    console.log();
    console.log(chalk.green('─'.repeat(80)));
    console.log(chalk.green.bold(`[${timestamp}] 📥 LLM RESPONSE`));
    console.log(chalk.green('─'.repeat(40)));

    // Truncate very long response
    const displayResponse = response.length > 3000
      ? response.substring(0, 3000) + chalk.gray(`\n... (${response.length - 3000} more chars)`)
      : response;
    console.log(displayResponse);

    if (toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0) {
      console.log();
      console.log(chalk.yellow.bold('Tool Calls:'));
      toolCalls.forEach((tc: any) => {
        console.log(chalk.yellow(`  - ${tc.function?.name}: ${tc.function?.arguments?.substring(0, 100)}...`));
      });
    }
    console.log(chalk.green('─'.repeat(80)));
  }

  /**
   * Log tool execution result (--llm-log mode only)
   */
  llmToolResult(toolName: string, result: string, success: boolean): void {
    if (!llmLogEnabled) return;

    const timestamp = this.getTimestamp();
    const color = success ? chalk.cyan : chalk.red;
    console.log();
    console.log(color('─'.repeat(80)));
    console.log(color.bold(`[${timestamp}] 🔧 TOOL: ${toolName} ${success ? '✓' : '✗'}`));
    console.log(color('─'.repeat(40)));

    // Truncate very long result
    const displayResult = result.length > 1000
      ? result.substring(0, 1000) + chalk.gray(`\n... (${result.length - 1000} more chars)`)
      : result;
    console.log(displayResult);
    console.log(color('─'.repeat(80)));
  }
}

/**
 * Global logger instance
 *
 * 기본값은 ERROR 레벨 (Normal 모드에서 로그 출력 없음)
 * CLI argument로 레벨 조정:
 * - Normal mode (open): ERROR (로그 출력 없음, UI로만 피드백)
 * - Verbose mode (open --verbose): WARN
 * - Debug mode (open --debug): VERBOSE
 */
export const logger = new Logger({
  level: LogLevel.ERROR, // Normal 모드: 로그 출력 없음 (ERROR만 표시)
  prefix: 'LOCAL-CLI',
  timestamp: true,
  showLocation: false, // setLogLevel()에서 동적으로 변경
  showPid: false, // 필요시 환경 변수로 활성화
});

/**
 * Set global log level from CLI or config
 * DEBUG 이상일 때 자동으로 위치 정보 표시
 */
export function setLogLevel(level: LogLevel): void {
  logger.setLevel(level);

  // DEBUG 이상이면 위치 정보 자동 표시
  if (level >= LogLevel.DEBUG) {
    logger['showLocation'] = true;
  }
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

/**
 * Enable debug logging
 */
export function enableDebug(): void {
  logger.setLevel(LogLevel.DEBUG);
}

/**
 * Create a child logger with a specific prefix
 */
export function createLogger(prefix: string, options?: Partial<LoggerOptions>): Logger {
  return new Logger({
    level: logger['level'],
    prefix,
    timestamp: true,
    showLocation: logger['showLocation'],
    showPid: logger['showPid'],
    ...options,
  });
}

/**
 * Generate a unique trace ID
 */
export function generateTraceId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Setup logging configuration based on CLI options
 * - Configures log level (verbose/debug)
 * - Initializes JSON stream logger
 * - Sets up process exit handlers for cleanup
 * 
 * @param options - CLI options containing verbose and debug flags
 * @returns Object containing cleanup function and JSON logger instance
 */
export async function setupLogging(options: {
  verbose?: boolean;
  debug?: boolean;
  llmLog?: boolean;
  sessionId?: string;
}): Promise<{
  cleanup: () => Promise<void>;
  jsonLogger: Awaited<ReturnType<typeof import('./json-stream-logger.js').initializeJsonStreamLogger>>;
}> {
  const { initializeJsonStreamLogger, closeJsonStreamLogger } = await import('./json-stream-logger.js');
  const { sessionManager } = await import('../core/session/session-manager.js');

  // Determine if verbose/debug mode is enabled
  const isVerboseMode = options.verbose || options.debug;

  // Initialize JSON stream logger (always enabled, but only show messages in verbose/debug mode)
  const sessionId = options.sessionId || (sessionManager.getCurrentSessionId() as string);
  const jsonLogger = await initializeJsonStreamLogger(sessionId, false, isVerboseMode);

  // Enable LLM logging if --llm-log flag is set
  if (options.llmLog) {
    enableLLMLog();
  }

  // Set log level based on CLI options
  // Normal mode (no flags): ERROR
  // --verbose: DEBUG (상세 로깅)
  // --debug: VERBOSE (최대 디버그 로깅 + 위치 정보)
  // --llm-log: ERROR (LLM 요청/응답만 표시)
  if (options.debug) {
    setLogLevel(LogLevel.VERBOSE);
    logger.debug('🔍 Debug mode enabled - maximum logging with location tracking');
  } else if (options.verbose) {
    setLogLevel(LogLevel.DEBUG);
    logger.debug('📝 Verbose mode enabled - detailed logging');
  } else if (options.llmLog) {
    // llm-log mode: keep ERROR level, just enable LLM logging
    console.log(chalk.cyan('📡 LLM Log mode enabled - showing LLM requests/responses only'));
  }
  // Normal mode: no startup message

  // Track cleanup state to prevent duplicate calls
  let cleanupCalled = false;

  // Cleanup function to close logger (idempotent - safe to call multiple times)
  const cleanup = async () => {
    if (cleanupCalled) {
      return; // Already cleaned up, skip
    }
    cleanupCalled = true;
    await closeJsonStreamLogger();
  };

  // Ensure cleanup on exit (prevent duplicate handlers with once flag)
  const exitHandler = async (signal: string) => {
    logger.debug(`Received ${signal}, cleaning up...`);
    await cleanup();
    process.exit(0);
  };

  process.once('SIGINT', () => exitHandler('SIGINT'));
  process.once('SIGTERM', () => exitHandler('SIGTERM'));

  return { cleanup, jsonLogger };
}
