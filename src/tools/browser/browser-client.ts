/**
 * Browser Automation Client
 *
 * HTTP client for communicating with the Browser Automation Server (Windows .exe)
 * Includes auto-start/stop functionality for the server executable.
 * Similar pattern to office-client.ts
 */

import { spawn, ChildProcess, execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { logger } from '../../utils/logger.js';
import { LOCAL_HOME_DIR } from '../../constants.js';

/**
 * Check if WSL2 mirrored networking is enabled
 */
function isMirroredNetworking(): boolean {
  try {
    const winUser = execSync('whoami.exe 2>/dev/null', { encoding: 'utf-8' }).trim().split('\\').pop();
    const wslConfigPath = '/mnt/c/Users/' + winUser + '/.wslconfig';

    if (fs.existsSync(wslConfigPath)) {
      const content = fs.readFileSync(wslConfigPath, 'utf-8').toLowerCase();
      if (content.includes('networkingmode=mirrored')) {
        return true;
      }
    }
  } catch {
    // Ignore errors
  }
  return false;
}

/**
 * Get Windows host IP from WSL
 */
function getWindowsHostIP(): string {
  try {
    if (isMirroredNetworking()) {
      return '127.0.0.1';
    }

    if (fs.existsSync('/etc/resolv.conf')) {
      const content = fs.readFileSync('/etc/resolv.conf', 'utf-8');
      const match = content.match(/nameserver\s+(\d+\.\d+\.\d+\.\d+)/);
      if (match && match[1]) {
        return match[1];
      }
    }

    if (process.env['WSL_HOST_IP']) {
      return process.env['WSL_HOST_IP'];
    }

    const routeOutput = execSync('ip route show default 2>/dev/null', { encoding: 'utf-8' });
    const routeMatch = routeOutput.match(/via\s+(\d+\.\d+\.\d+\.\d+)/);
    if (routeMatch && routeMatch[1]) {
      return routeMatch[1];
    }
  } catch {
    // Ignore errors
  }

  return '127.0.0.1';
}

interface BrowserResponse {
  success: boolean;
  message?: string;
  error?: string;
  details?: string;
  [key: string]: unknown;
}

interface HealthResponse extends BrowserResponse {
  status: string;
  version: string;
  browser: {
    active: boolean;
    type: string | null;
    chrome_available: boolean;
    edge_available: boolean;
  };
}

interface ScreenshotResponse extends BrowserResponse {
  image?: string;
  format?: string;
  encoding?: string;
  url?: string;
  title?: string;
}

interface NavigateResponse extends BrowserResponse {
  url?: string;
  title?: string;
}

interface PageInfoResponse extends BrowserResponse {
  url?: string;
  title?: string;
  html?: string;
}

interface ConsoleLogEntry {
  level: string;
  message: string;
  timestamp: number;
}

interface ConsoleResponse extends BrowserResponse {
  logs?: ConsoleLogEntry[];
  count?: number;
}

interface NetworkLogEntry {
  type: 'request' | 'response';
  url: string;
  method?: string;
  status?: number;
  statusText?: string;
  mimeType?: string;
  timestamp: number;
  requestId: string;
}

interface NetworkResponse extends BrowserResponse {
  logs?: NetworkLogEntry[];
  count?: number;
}

class BrowserClient {
  private serverProcess: ChildProcess | null = null;
  private host: string = 'localhost';
  private port: number = 8766;
  private serverExePath: string | null = null;
  private isWSL: boolean = false;
  private startupTimeout: number = 30000; // 30 seconds (browser needs more time)
  private screenshotDir: string;

  constructor() {
    this.isWSL = this.detectWSL();
    logger.debug('[BrowserClient] constructor: isWSL = ' + this.isWSL);
    this.findServerExe();

    if (this.isWSL) {
      this.host = getWindowsHostIP();
      logger.debug('[BrowserClient] constructor: Windows host IP = ' + this.host);
    }

    // Create screenshot directory
    this.screenshotDir = path.join(LOCAL_HOME_DIR, 'screenshots', 'browser');
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true });
    }

    logger.debug('[BrowserClient] constructor: server URL = ' + this.getServerUrl());
  }

  private detectWSL(): boolean {
    try {
      const release = os.release().toLowerCase();
      return release.includes('wsl') || release.includes('microsoft');
    } catch {
      return false;
    }
  }

  private findServerExe(): void {
    const homeDir = process.env['HOME'] || process.env['USERPROFILE'] || '';
    const possiblePaths = [
      // Environment variable (highest priority)
      process.env['BROWSER_SERVER_PATH'] || '',
      // In ~/.local-cli/repo/bin/ (auto-update location)
      path.join(homeDir, '.local-cli', 'repo', 'bin', 'browser-server.exe'),
      // In ~/.local/bin/ (manual installation)
      path.join(homeDir, '.local', 'bin', 'browser-server.exe'),
      // In bin folder (development)
      path.resolve(process.cwd(), 'bin', 'browser-server.exe'),
      // In dist folder (build output)
      path.resolve(process.cwd(), 'browser-server', 'dist', 'browser-server.exe'),
    ];

    logger.debug('[BrowserClient] findServerExe: checking paths', possiblePaths);
    for (const p of possiblePaths) {
      if (p && fs.existsSync(p)) {
        this.serverExePath = p;
        logger.debug('[BrowserClient] findServerExe: found at ' + p);
        return;
      }
    }
    logger.debug('[BrowserClient] findServerExe: not found in any location');
  }

  /**
   * Get the path to browser-server.exe
   */
  getServerExePath(): string | null {
    return this.serverExePath;
  }

  /**
   * Get screenshot directory path
   */
  getScreenshotDir(): string {
    return this.screenshotDir;
  }

  /**
   * Convert WSL path to Windows path
   */
  private toWindowsPath(linuxPath: string): string {
    if (!this.isWSL || !linuxPath.startsWith('/')) {
      return linuxPath;
    }

    const match = linuxPath.match(/^\/mnt\/([a-z])\/(.*)$/i);
    if (match && match[1] && match[2]) {
      const drive = match[1].toUpperCase();
      const rest = match[2].replace(/\//g, '\\');
      return `${drive}:\\${rest}`;
    }

    try {
      const windowsPath = execSync(`wslpath -w "${linuxPath}"`, { encoding: 'utf-8' }).trim();
      logger.debug('[BrowserClient] toWindowsPath: converted ' + linuxPath + ' -> ' + windowsPath);
      return windowsPath;
    } catch {
      logger.debug('[BrowserClient] toWindowsPath: wslpath failed, returning original path');
      return linuxPath;
    }
  }

  /**
   * Get the server URL
   */
  getServerUrl(): string {
    return `http://${this.host}:${this.port}`;
  }

  /**
   * Check if server is running
   */
  async isRunning(): Promise<boolean> {
    logger.debug('[BrowserClient] isRunning: checking server at ' + this.getServerUrl());
    try {
      const response = await this.request<HealthResponse>('GET', '/health');
      logger.debug('[BrowserClient] isRunning: response', response);
      return response.success;
    } catch (error) {
      logger.debug('[BrowserClient] isRunning: failed - ' + (error instanceof Error ? error.message : String(error)));
      return false;
    }
  }

  /**
   * Get server health status
   */
  async getHealth(): Promise<HealthResponse | null> {
    try {
      return await this.request<HealthResponse>('GET', '/health');
    } catch {
      return null;
    }
  }

  /**
   * Kill existing browser-server processes
   */
  private killExistingServer(): void {
    logger.debug('[BrowserClient] killExistingServer: isWSL = ' + this.isWSL);
    if (this.isWSL) {
      try {
        logger.debug('[BrowserClient] killExistingServer: executing powershell kill command');
        execSync('powershell.exe -Command "Get-Process browser-server -ErrorAction SilentlyContinue | Stop-Process -Force"', {
          stdio: 'ignore',
          timeout: 5000,
        });
        logger.debug('[BrowserClient] killExistingServer: kill command completed');
      } catch (error) {
        logger.debug('[BrowserClient] killExistingServer: kill failed (may not exist) - ' + (error instanceof Error ? error.message : String(error)));
      }
    }
  }

  /**
   * Start the Browser server (Windows .exe)
   */
  async startServer(): Promise<boolean> {
    logger.debug('[BrowserClient] startServer: beginning startup sequence');

    if (await this.isRunning()) {
      logger.debug('[BrowserClient] startServer: server already running');
      return true;
    }

    logger.debug('[BrowserClient] startServer: killing zombie processes');
    this.killExistingServer();

    await new Promise(resolve => setTimeout(resolve, 1000));

    if (!this.serverExePath) {
      logger.debug('[BrowserClient] startServer: exe not found');
      throw new Error(
        'Browser server executable not found. ' +
        'Please place browser-server.exe in the bin/ folder or set BROWSER_SERVER_PATH environment variable.'
      );
    }

    const windowsExePath = this.toWindowsPath(this.serverExePath);
    logger.debug('[BrowserClient] startServer: exe path = ' + windowsExePath);

    return new Promise((resolve, reject) => {
      try {
        let command: string;
        let args: string[];

        if (this.isWSL) {
          command = 'cmd.exe';
          args = ['/C', windowsExePath, '--port', String(this.port)];
        } else {
          command = windowsExePath;
          args = ['--port', String(this.port)];
        }

        logger.debug('[BrowserClient] startServer: spawning ' + command + ' ' + args.join(' '));
        this.serverProcess = spawn(command, args, {
          detached: true,
          stdio: 'ignore',
          windowsHide: false,
        });

        this.serverProcess.unref();
        logger.debug('[BrowserClient] startServer: process spawned, waiting for ready');

        const startTime = Date.now();
        const checkInterval = setInterval(async () => {
          const elapsed = Date.now() - startTime;
          logger.debug('[BrowserClient] startServer: checking ready, elapsed = ' + elapsed + ' ms');
          if (await this.isRunning()) {
            clearInterval(checkInterval);
            logger.debug('[BrowserClient] startServer: server ready');
            resolve(true);
          } else if (elapsed > this.startupTimeout) {
            clearInterval(checkInterval);
            logger.debug('[BrowserClient] startServer: timeout after ' + elapsed + ' ms');
            reject(new Error('Browser server startup timeout'));
          }
        }, 500);

        this.serverProcess.on('error', (err) => {
          logger.debug('[BrowserClient] startServer: process error - ' + err.message);
          clearInterval(checkInterval);
          reject(new Error(`Failed to start Browser server: ${err.message}`));
        });
      } catch (error) {
        logger.debug('[BrowserClient] startServer: caught error - ' + (error instanceof Error ? error.message : String(error)));
        reject(error);
      }
    });
  }

  /**
   * Stop the Browser server
   */
  async stopServer(): Promise<boolean> {
    try {
      // First close the browser if open
      try {
        await this.request('POST', '/browser/close');
      } catch {
        // Ignore
      }

      await this.request('POST', '/shutdown');
      this.serverProcess = null;
      return true;
    } catch {
      if (this.serverProcess) {
        this.serverProcess.kill();
        this.serverProcess = null;
      }
      // Force kill via powershell
      this.killExistingServer();
      return true;
    }
  }

  /**
   * Make HTTP request to server
   */
  private async request<T extends BrowserResponse>(
    method: 'GET' | 'POST',
    endpoint: string,
    data?: Record<string, unknown>,
    timeoutMs: number = 30000
  ): Promise<T> {
    const url = `${this.getServerUrl()}${endpoint}`;
    logger.debug(`[BrowserClient] request: ${method} ${url} timeout = ${timeoutMs} ms`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      logger.debug('[BrowserClient] request: timeout triggered for ' + url);
      controller.abort();
    }, timeoutMs);

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    };

    if (data && method === 'POST') {
      options.body = JSON.stringify(data);
      logger.debug('[BrowserClient] request: body', options.body);
    }

    try {
      logger.debug('[BrowserClient] request: fetching...');
      const response = await fetch(url, options);
      clearTimeout(timeoutId);
      logger.debug('[BrowserClient] request: response status = ' + response.status);
      const result = await response.json() as T;
      logger.debug('[BrowserClient] request: result', JSON.stringify(result).substring(0, 200));
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.debug('[BrowserClient] request: error - ' + errorMsg);
      throw error;
    }
  }

  /**
   * Save screenshot to file and return path
   */
  saveScreenshot(base64Image: string, prefix: string = 'browser'): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${prefix}_${timestamp}.png`;
    const filepath = path.join(this.screenshotDir, filename);

    const imageBuffer = Buffer.from(base64Image, 'base64');
    fs.writeFileSync(filepath, imageBuffer);

    logger.debug('[BrowserClient] saveScreenshot: saved to ' + filepath);
    return filepath;
  }

  // ===========================================================================
  // Browser Operations
  // ===========================================================================

  async launch(options?: { headless?: boolean; browser?: 'chrome' | 'edge' }): Promise<BrowserResponse> {
    return this.request('POST', '/browser/launch', {
      headless: options?.headless ?? false,
      browser: options?.browser ?? 'chrome',
    });
  }

  async close(): Promise<BrowserResponse> {
    return this.request('POST', '/browser/close');
  }

  async navigate(url: string): Promise<NavigateResponse> {
    return this.request('POST', '/browser/navigate', { url });
  }

  async screenshot(fullPage: boolean = false): Promise<ScreenshotResponse> {
    const endpoint = fullPage ? '/browser/screenshot?full_page=true' : '/browser/screenshot';
    return this.request('GET', endpoint);
  }

  async click(selector: string): Promise<BrowserResponse> {
    return this.request('POST', '/browser/click', { selector });
  }

  async fill(selector: string, value: string): Promise<BrowserResponse> {
    return this.request('POST', '/browser/fill', { selector, value });
  }

  async getText(selector: string): Promise<BrowserResponse> {
    return this.request('POST', '/browser/get_text', { selector });
  }

  async getPageInfo(): Promise<PageInfoResponse> {
    return this.request('GET', '/browser/get_info');
  }

  async getHtml(): Promise<PageInfoResponse> {
    return this.request('GET', '/browser/get_html');
  }

  async executeScript(script: string): Promise<BrowserResponse> {
    return this.request('POST', '/browser/execute_script', { script });
  }

  async getConsole(): Promise<ConsoleResponse> {
    return this.request('GET', '/browser/get_console');
  }

  async waitFor(selector: string, timeout: number = 10): Promise<BrowserResponse> {
    return this.request('POST', '/browser/wait_for', { selector, timeout });
  }

  async getNetwork(): Promise<NetworkResponse> {
    return this.request('GET', '/browser/get_network');
  }

  async focus(): Promise<BrowserResponse> {
    return this.request('POST', '/browser/focus');
  }

  /**
   * Check if browser is currently active
   */
  async isBrowserActive(): Promise<boolean> {
    try {
      const health = await this.getHealth();
      return health?.browser?.active ?? false;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const browserClient = new BrowserClient();
export type { BrowserResponse, HealthResponse, ScreenshotResponse, NavigateResponse, PageInfoResponse, ConsoleResponse, NetworkResponse };
