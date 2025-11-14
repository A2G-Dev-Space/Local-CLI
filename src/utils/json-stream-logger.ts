/**
 * JSON Stream Logger
 *
 * Logs all terminal interactions and events to a JSON file for analysis
 */

import { createWriteStream, WriteStream } from 'fs';
import { mkdir, access, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import chalk from 'chalk';
import { PROJECTS_DIR } from '../constants.js';

// Flush interval for periodic buffer writes (in milliseconds)
const FLUSH_INTERVAL_MS = 1000;

export interface StreamLogEntry {
  timestamp: string;
  type: 'user_input' | 'assistant_response' | 'system_message' | 'error' | 'tool_call' | 'todo_update' | 'debug' | 'info';
  content: string;
  metadata?: Record<string, unknown>;
}

export class JsonStreamLogger {
  private writeStream: WriteStream | null = null;
  private errorWriteStream: WriteStream | null = null;
  private filePath: string;
  private errorFilePath: string;
  private isFirstEntry = true;
  private isFirstErrorEntry = true;
  private buffer: StreamLogEntry[] = [];
  private errorBuffer: StreamLogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private isEnabled = false;
  private errorStreamInitialized = false;
  private appendMode = false;

  constructor(filePath: string, errorFilePath: string) {
    this.filePath = filePath;
    this.errorFilePath = errorFilePath;
  }

  /**
   * Initialize the JSON stream logger
   */
  async initialize(append = false): Promise<void> {
    try {
      // Store append mode for error stream initialization
      this.appendMode = append;

      // Create directory if it doesn't exist
      await mkdir(dirname(this.filePath), { recursive: true });

      // Check if file exists and we're in append mode
      let fileExists = false;
      try {
        await access(this.filePath);
        fileExists = true;
      } catch {
        fileExists = false;
      }

      if (append && fileExists) {
        // Append mode: remove closing bracket and continue
        await this.prepareFileForAppend(this.filePath);
        this.writeStream = createWriteStream(this.filePath, { flags: 'a' });
        this.isFirstEntry = false; // Not first entry since file has content
        console.log(chalk.dim(`📝 JSON stream logging resumed (append mode)`));
      } else {
        // New file mode: create fresh file
        this.writeStream = createWriteStream(this.filePath, { flags: 'w' });
        this.writeStream.write('[\n');
        this.isFirstEntry = true;
        console.log(chalk.dim(`📝 JSON stream logging enabled`));
      }

      this.isEnabled = true;

      // Set up periodic flush
      this.flushInterval = setInterval(() => {
        this.flush();
        this.flushErrors();
      }, FLUSH_INTERVAL_MS);

      console.log(chalk.dim(`   Log: ${this.filePath}`));
    } catch (error) {
      console.error(chalk.red('Failed to initialize JSON stream logger:'), error);
      this.isEnabled = false;
    }
  }

  /**
   * Prepare file for append by removing closing bracket
   */
  private async prepareFileForAppend(filePath: string): Promise<void> {
    try {
      const content = await readFile(filePath, 'utf-8');
      // Remove the closing bracket and trailing whitespace
      const trimmed = content.trimEnd();
      if (trimmed.endsWith(']')) {
        const withoutClosing = trimmed.slice(0, -1);
        await writeFile(filePath, withoutClosing, 'utf-8');
      }
    } catch (error) {
      console.error(chalk.yellow('Warning: Could not prepare file for append:'), error);
      // Continue anyway - will create new file
    }
  }

  /**
   * Log an entry to the JSON stream
   */
  log(entry: StreamLogEntry): void {
    if (!this.isEnabled || !this.writeStream) {
      return;
    }

    // Add to appropriate buffer
    if (entry.type === 'error') {
      // Initialize error stream on first error (lazy initialization)
      if (!this.errorStreamInitialized) {
        this.initializeErrorStream().catch(err => {
          console.error(chalk.red('Failed to initialize error stream:'), err);
        });
      }
      this.errorBuffer.push(entry);
    }
    this.buffer.push(entry);
  }

  /**
   * Flush buffered entries to file
   */
  private flush(): void {
    if (!this.writeStream || this.buffer.length === 0) {
      return;
    }

    try {
      for (const entry of this.buffer) {
        // Add comma if not first entry
        if (!this.isFirstEntry) {
          this.writeStream.write(',\n');
        }
        this.isFirstEntry = false;

        // Write the entry as formatted JSON
        const json = JSON.stringify(entry, null, 2);
        // Indent each line by 2 spaces for array formatting
        const indentedJson = json.split('\n').map(line => '  ' + line).join('\n');
        this.writeStream.write(indentedJson);
      }

      // Clear buffer
      this.buffer = [];
    } catch (error) {
      console.error(chalk.red('Failed to write to JSON stream:'), error);
    }
  }

  /**
   * Initialize error stream (lazy initialization)
   */
  private async initializeErrorStream(): Promise<void> {
    if (this.errorStreamInitialized) {
      return;
    }

    try {
      // Create directory if it doesn't exist
      await mkdir(dirname(this.errorFilePath), { recursive: true });

      // Check if file exists and we're in append mode
      let fileExists = false;
      try {
        await access(this.errorFilePath);
        fileExists = true;
      } catch {
        fileExists = false;
      }

      if (this.appendMode && fileExists) {
        // Append mode: remove closing bracket and continue
        await this.prepareFileForAppend(this.errorFilePath);
        this.errorWriteStream = createWriteStream(this.errorFilePath, { flags: 'a' });
        this.isFirstErrorEntry = false;
      } else {
        // New file mode: create fresh file
        this.errorWriteStream = createWriteStream(this.errorFilePath, { flags: 'w' });
        this.errorWriteStream.write('[\n');
        this.isFirstErrorEntry = true;
      }

      this.errorStreamInitialized = true;
      console.log(chalk.dim(`   Error log: ${this.errorFilePath}`));
    } catch (error) {
      console.error(chalk.red('Failed to initialize error stream:'), error);
    }
  }

  /**
   * Flush buffered error entries to error file
   */
  private flushErrors(): void {
    if (!this.errorWriteStream || this.errorBuffer.length === 0) {
      return;
    }

    try {
      for (const entry of this.errorBuffer) {
        // Add comma if not first entry
        if (!this.isFirstErrorEntry) {
          this.errorWriteStream.write(',\n');
        }
        this.isFirstErrorEntry = false;

        // Write the entry as formatted JSON
        const json = JSON.stringify(entry, null, 2);
        // Indent each line by 2 spaces for array formatting
        const indentedJson = json.split('\n').map(line => '  ' + line).join('\n');
        this.errorWriteStream.write(indentedJson);
      }

      // Clear error buffer
      this.errorBuffer = [];
    } catch (error) {
      console.error(chalk.red('Failed to write to error JSON stream:'), error);
    }
  }

  /**
   * Log user input
   */
  logUserInput(input: string): void {
    this.log({
      timestamp: new Date().toISOString(),
      type: 'user_input',
      content: input,
      metadata: {
        length: input.length,
      },
    });
  }

  /**
   * Log assistant response
   */
  logAssistantResponse(response: string, streaming = false): void {
    this.log({
      timestamp: new Date().toISOString(),
      type: 'assistant_response',
      content: response,
      metadata: {
        length: response.length,
        streaming,
      },
    });
  }

  /**
   * Log system message
   */
  logSystemMessage(message: string): void {
    this.log({
      timestamp: new Date().toISOString(),
      type: 'system_message',
      content: message,
    });
  }

  /**
   * Log error
   */
  logError(error: Error | unknown, context?: string): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    this.log({
      timestamp: new Date().toISOString(),
      type: 'error',
      content: errorMessage,
      metadata: {
        context,
        stack: errorStack,
        name: error instanceof Error ? error.constructor.name : 'Unknown',
      },
    });
  }

  /**
   * Log tool call
   */
  logToolCall(toolName: string, args: unknown, result?: unknown, error?: Error): void {
    this.log({
      timestamp: new Date().toISOString(),
      type: 'tool_call',
      content: `Tool: ${toolName}`,
      metadata: {
        toolName,
        args,
        result: result ? (typeof result === 'string' ? result.substring(0, 500) : result) : undefined,
        error: error ? error.message : undefined,
        success: !error,
      },
    });
  }

  /**
   * Log TODO update
   */
  logTodoUpdate(todos: unknown[]): void {
    this.log({
      timestamp: new Date().toISOString(),
      type: 'todo_update',
      content: `TODO list updated (${todos.length} items)`,
      metadata: {
        todos,
        count: todos.length,
      },
    });
  }

  /**
   * Log debug information
   */
  logDebug(message: string, data?: unknown): void {
    this.log({
      timestamp: new Date().toISOString(),
      type: 'debug',
      content: message,
      metadata: data ? { data } : undefined,
    });
  }

  /**
   * Log info message
   */
  logInfo(message: string, data?: unknown): void {
    this.log({
      timestamp: new Date().toISOString(),
      type: 'info',
      content: message,
      metadata: data ? { data } : undefined,
    });
  }

  /**
   * Close the JSON stream logger
   */
  async close(): Promise<void> {
    // Already closed, skip
    if (!this.isEnabled || !this.writeStream) {
      return;
    }

    // Mark as disabled immediately to prevent duplicate close attempts
    this.isEnabled = false;

    // Clear flush interval
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // Flush any remaining buffers
    this.flush();

    // Only flush errors if error stream was initialized
    if (this.errorStreamInitialized) {
      this.flushErrors();
    }

    // Close both streams
    const promises: Promise<void>[] = [];

    // Close main stream if not already destroyed
    if (!this.writeStream.destroyed) {
      // Write closing bracket for JSON array
      if (this.writeStream.writable) {
        this.writeStream.write('\n]\n');
      }

      promises.push(new Promise<void>((resolve, reject) => {
        this.writeStream!.end((error?: Error) => {
          if (error) {
            console.error(chalk.red('Failed to close JSON stream:'), error);
            reject(error);
          } else {
            console.log(chalk.dim(`✅ Log saved: ${this.filePath}`));
            resolve();
          }
        });
      }));
    } else {
      console.log(chalk.dim(`⚠️  Log stream already closed: ${this.filePath}`));
    }

    // Only close error stream if it was initialized and not destroyed
    if (this.errorStreamInitialized && this.errorWriteStream && !this.errorWriteStream.destroyed) {
      if (this.errorWriteStream.writable) {
        this.errorWriteStream.write('\n]\n');
      }

      promises.push(new Promise<void>((resolve, reject) => {
        this.errorWriteStream!.end((error?: Error) => {
          if (error) {
            console.error(chalk.red('Failed to close error JSON stream:'), error);
            reject(error);
          } else {
            console.log(chalk.dim(`✅ Error log saved: ${this.errorFilePath}`));
            resolve();
          }
        });
      }));
    }

    await Promise.all(promises);
    
    // Clear references
    this.writeStream = null;
    this.errorWriteStream = null;
  }

  /**
   * Check if logging is enabled
   */
  isActive(): boolean {
    return this.isEnabled;
  }

  /**
   * Get the log file path
   */
  getFilePath(): string {
    return this.filePath;
  }
}

// Global JSON stream logger instance (null if not enabled)
let globalJsonStreamLogger: JsonStreamLogger | null = null;

/**
 * Initialize global JSON stream logger
 * Automatically generates log paths based on current working directory and session ID
 */
export async function initializeJsonStreamLogger(sessionId: string, append = false): Promise<JsonStreamLogger> {
  if (globalJsonStreamLogger) {
    await globalJsonStreamLogger.close();
  }

  // Get current working directory and sanitize it for use in path
  // Replace '/' with '-' and remove leading '-' if present (for absolute paths)
  const cwd = process.cwd().replace(/\//g, '-').replace(/^-/, '');

  // Create log directory path
  const projectLogDir = join(PROJECTS_DIR, cwd);

  // Create log file paths
  const logFile = join(projectLogDir, `${sessionId}_log.json`);
  const errorLogFile = join(projectLogDir, `${sessionId}_error.json`);

  globalJsonStreamLogger = new JsonStreamLogger(logFile, errorLogFile);
  await globalJsonStreamLogger.initialize(append);

  return globalJsonStreamLogger;
}

/**
 * Get global JSON stream logger instance
 */
export function getJsonStreamLogger(): JsonStreamLogger | null {
  return globalJsonStreamLogger;
}

/**
 * Close global JSON stream logger
 */
export async function closeJsonStreamLogger(): Promise<void> {
  if (globalJsonStreamLogger && globalJsonStreamLogger.isActive()) {
    await globalJsonStreamLogger.close();
    globalJsonStreamLogger = null;
  }
}
