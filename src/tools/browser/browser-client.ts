/**
 * Browser Automation Client (순수 CDP 방식)
 *
 * PowerShell을 통해 Chrome을 CDP 포트와 함께 시작하고,
 * WebSocket으로 CDP (Chrome DevTools Protocol)에 직접 연결하여 브라우저를 제어합니다.
 *
 * 외부 의존성 없이 (playwright 없이) 동작합니다.
 */

import { spawn, ChildProcess, execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import WebSocket from 'ws';
import { logger } from '../../utils/logger.js';
import { LOCAL_HOME_DIR } from '../../constants.js';
import {
  getPlatform,
  getPowerShellPath,
  Platform,
} from '../../utils/platform-utils.js';

// ===========================================================================
// Types
// ===========================================================================

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

// CDP Protocol types
interface CDPTarget {
  id: string;
  type: string;
  title: string;
  url: string;
  webSocketDebuggerUrl: string;
}

interface CDPMessage {
  id: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
}

// ===========================================================================
// CDP Client (WebSocket 기반)
// ===========================================================================

class CDPConnection {
  private ws: WebSocket | null = null;
  private messageId: number = 0;
  private pendingMessages: Map<number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }> = new Map();
  private eventHandlers: Map<string, ((params: unknown) => void)[]> = new Map();

  async connect(wsUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        logger.debug('[CDP] WebSocket connected');
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message: CDPMessage = JSON.parse(data.toString());

          if (message.id !== undefined) {
            // Response to a command
            const pending = this.pendingMessages.get(message.id);
            if (pending) {
              this.pendingMessages.delete(message.id);
              if (message.error) {
                pending.reject(new Error(message.error.message));
              } else {
                pending.resolve(message.result);
              }
            }
          } else if (message.method) {
            // Event from browser
            const handlers = this.eventHandlers.get(message.method) || [];
            for (const handler of handlers) {
              handler(message.params);
            }
          }
        } catch (e) {
          logger.debug('[CDP] Failed to parse message: ' + e);
        }
      });

      this.ws.on('error', (error) => {
        logger.debug('[CDP] WebSocket error: ' + error.message);
        reject(error);
      });

      this.ws.on('close', () => {
        logger.debug('[CDP] WebSocket closed');
        // Reject all pending messages
        for (const [, pending] of this.pendingMessages) {
          pending.reject(new Error('WebSocket closed'));
        }
        this.pendingMessages.clear();
      });
    });
  }

  async send(method: string, params?: Record<string, unknown>): Promise<unknown> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const id = ++this.messageId;
    const message: CDPMessage = { id, method, params };

    return new Promise((resolve, reject) => {
      this.pendingMessages.set(id, { resolve, reject });
      this.ws!.send(JSON.stringify(message));

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingMessages.has(id)) {
          this.pendingMessages.delete(id);
          reject(new Error(`CDP command timeout: ${method}`));
        }
      }, 30000);
    });
  }

  on(event: string, handler: (params: unknown) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  off(event: string): void {
    this.eventHandlers.delete(event);
  }

  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.pendingMessages.clear();
    this.eventHandlers.clear();
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// ===========================================================================
// Browser Client
// ===========================================================================

class BrowserClient {
  private cdp: CDPConnection | null = null;
  private browserProcess: ChildProcess | null = null;
  private platform: Platform;
  private cdpPort: number = 9222;
  private browserType: 'chrome' | 'edge' = 'chrome';
  private screenshotDir: string;

  // Console/Network 로그 수집
  private consoleLogs: ConsoleLogEntry[] = [];
  private networkLogs: NetworkLogEntry[] = [];

  constructor() {
    this.platform = getPlatform();
    logger.debug('[BrowserClient] constructor: platform = ' + this.platform);

    // Create screenshot directory
    this.screenshotDir = path.join(LOCAL_HOME_DIR, 'screenshots', 'browser');
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true });
    }

    logger.debug('[BrowserClient] constructor: CDP URL = ' + this.getCDPUrl());
  }

  /**
   * Get CDP endpoint URL
   */
  private getCDPUrl(): string {
    return `http://localhost:${this.cdpPort}`;
  }

  /**
   * Get screenshot directory path
   */
  getScreenshotDir(): string {
    return this.screenshotDir;
  }

  /**
   * Find browser executable path based on platform
   */
  private findBrowserPath(windowsPaths: string[], linuxPaths?: string[]): string | null {
    // Native Windows - direct file system check
    if (this.platform === 'native-windows') {
      for (const p of windowsPaths) {
        if (fs.existsSync(p)) return p;
      }
      return null;
    }

    // WSL - use PowerShell to check Windows paths
    if (this.platform === 'wsl') {
      try {
        const powerShellPath = getPowerShellPath();
        const conditions = windowsPaths.map(p => `if (Test-Path '${p}') { Write-Output '${p}' }`).join(' elseif ');
        const result = execSync(
          `${powerShellPath} -Command "${conditions}"`,
          { encoding: 'utf-8', timeout: 5000 }
        ).trim();
        if (result) return result;
      } catch (error) {
        logger.debug(
          `[BrowserClient] findBrowserPath: PowerShell check failed (${error instanceof Error ? error.message : String(error)})`
        );
      }
      return null;
    }

    // Native Linux - check Linux paths
    if (linuxPaths) {
      for (const p of linuxPaths) {
        if (fs.existsSync(p)) return p;
      }
    }
    return null;
  }

  private findChromePath(): string | null {
    return this.findBrowserPath(
      // Windows paths
      [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      ],
      // Linux paths
      [
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/snap/bin/chromium',
      ]
    );
  }

  private findEdgePath(): string | null {
    return this.findBrowserPath(
      // Windows paths
      [
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      ],
      // Linux paths (Edge for Linux)
      [
        '/usr/bin/microsoft-edge',
        '/usr/bin/microsoft-edge-stable',
      ]
    );
  }

  /**
   * Kill existing browser processes with CDP port
   */
  private killExistingBrowser(): void {
    logger.debug('[BrowserClient] killExistingBrowser: killing processes on port ' + this.cdpPort);
    try {
      if (this.platform === 'native-windows' || this.platform === 'wsl') {
        // Use PowerShell to kill processes on Windows
        const powerShellPath = getPowerShellPath();
        execSync(
          `${powerShellPath} -Command "Get-NetTCPConnection -LocalPort ${this.cdpPort} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`,
          { stdio: 'ignore', timeout: 5000 }
        );
      } else {
        // Native Linux - use fuser or lsof
        try {
          execSync(`fuser -k ${this.cdpPort}/tcp 2>/dev/null || true`, { stdio: 'ignore', timeout: 5000 });
        } catch {
          // Try lsof as fallback
          try {
            execSync(`lsof -ti:${this.cdpPort} | xargs -r kill -9 2>/dev/null || true`, { stdio: 'ignore', timeout: 5000 });
          } catch {
            // Ignore
          }
        }
      }
    } catch {
      // Ignore errors
    }
  }

  /**
   * Check if CDP endpoint is available
   */
  private async isCDPAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.getCDPUrl()}/json/version`, {
        signal: AbortSignal.timeout(2000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get list of available targets (tabs)
   */
  private async getTargets(): Promise<CDPTarget[]> {
    const response = await fetch(`${this.getCDPUrl()}/json`);
    return await response.json() as CDPTarget[];
  }

  /**
   * Check if browser is running
   */
  async isRunning(): Promise<boolean> {
    return this.cdp !== null && this.cdp.isConnected();
  }

  /**
   * Get server health status
   */
  async getHealth(): Promise<HealthResponse | null> {
    const chromePath = this.findChromePath();
    const edgePath = this.findEdgePath();

    return {
      success: true,
      status: 'running',
      version: '2.0.0-pure-cdp',
      browser: {
        active: this.cdp !== null && this.cdp.isConnected(),
        type: this.browserType,
        chrome_available: chromePath !== null,
        edge_available: edgePath !== null,
      },
    };
  }

  /**
   * Start the browser server (for compatibility)
   */
  async startServer(): Promise<boolean> {
    return true;
  }

  /**
   * Stop the browser server (for compatibility)
   */
  async stopServer(): Promise<boolean> {
    return this.close().then(() => true).catch(() => true);
  }

  /**
   * Setup console and network logging via CDP
   */
  private setupLogging(): void {
    if (!this.cdp) return;

    // Enable Console domain
    this.cdp.send('Console.enable').catch(err => logger.debug('[CDP] Failed to enable Console domain: ' + err));
    this.cdp.on('Console.messageAdded', (params: unknown) => {
      const p = params as { message: { level: string; text: string } };
      this.consoleLogs.push({
        level: p.message.level.toUpperCase(),
        message: p.message.text,
        timestamp: Date.now(),
      });
    });

    // Enable Runtime for console.log
    this.cdp.send('Runtime.enable').catch(err => logger.debug('[CDP] Failed to enable Runtime domain: ' + err));
    this.cdp.on('Runtime.consoleAPICalled', (params: unknown) => {
      const p = params as { type: string; args: { value?: string; description?: string }[] };
      const message = p.args.map(a => a.value || a.description || '').join(' ');
      this.consoleLogs.push({
        level: p.type.toUpperCase(),
        message,
        timestamp: Date.now(),
      });
    });

    // Enable Network domain
    this.cdp.send('Network.enable').catch(err => logger.debug('[CDP] Failed to enable Network domain: ' + err));
    this.cdp.on('Network.requestWillBeSent', (params: unknown) => {
      const p = params as { requestId: string; request: { url: string; method: string } };
      this.networkLogs.push({
        type: 'request',
        url: p.request.url,
        method: p.request.method,
        timestamp: Date.now(),
        requestId: p.requestId,
      });
    });

    this.cdp.on('Network.responseReceived', (params: unknown) => {
      const p = params as { requestId: string; response: { url: string; status: number; statusText: string; mimeType: string } };
      this.networkLogs.push({
        type: 'response',
        url: p.response.url,
        status: p.response.status,
        statusText: p.response.statusText,
        mimeType: p.response.mimeType,
        timestamp: Date.now(),
        requestId: p.requestId,
      });
    });
  }

  /**
   * Get current page info (URL and title) - helper to reduce code duplication
   */
  private async getCurrentPageInfo(): Promise<{ url: string; title: string }> {
    if (!this.cdp || !this.cdp.isConnected()) {
      return { url: '', title: '' };
    }

    const evalResult = await this.cdp.send('Runtime.evaluate', {
      expression: 'JSON.stringify({ url: window.location.href, title: document.title })',
      returnByValue: true,
    }) as { result: { value: string } };

    return JSON.parse(evalResult.result.value);
  }

  // ===========================================================================
  // Browser Operations
  // ===========================================================================

  /**
   * Launch browser with CDP
   */
  async launch(options?: { headless?: boolean; browser?: 'chrome' | 'edge' }): Promise<BrowserResponse> {
    const headless = options?.headless ?? false;
    const preferredBrowser = options?.browser ?? 'chrome';

    logger.debug(`[BrowserClient] launch: starting browser (preferred=${preferredBrowser}, headless=${headless})`);

    try {
      // 기존 연결 정리
      if (this.cdp) {
        this.cdp.close();
        this.cdp = null;
      }

      // 기존 CDP 프로세스 종료
      this.killExistingBrowser();
      await new Promise(resolve => setTimeout(resolve, 500));

      // 브라우저 경로 찾기
      let browserPath: string | null = null;
      if (preferredBrowser === 'chrome') {
        browserPath = this.findChromePath();
        if (!browserPath) {
          browserPath = this.findEdgePath();
          this.browserType = 'edge';
        } else {
          this.browserType = 'chrome';
        }
      } else {
        browserPath = this.findEdgePath();
        if (!browserPath) {
          browserPath = this.findChromePath();
          this.browserType = 'chrome';
        } else {
          this.browserType = 'edge';
        }
      }

      if (!browserPath) {
        return {
          success: false,
          error: 'No browser found',
          details: 'Neither Chrome nor Edge is installed',
        };
      }

      logger.debug(`[BrowserClient] launch: using ${this.browserType} at ${browserPath}`);

      // Common browser arguments (without user-data-dir)
      const baseArgs = [
        `--remote-debugging-port=${this.cdpPort}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-popup-blocking',
        '--start-maximized',
      ];

      if (headless) {
        baseArgs.push('--headless=new');
      }

      // Launch browser based on platform
      if (this.platform === 'native-windows') {
        // Native Windows - spawn directly with user data dir
        const userDataDir = `${process.env['LOCALAPPDATA']}\\local-cli-browser-profile`;
        const args = [...baseArgs, `--user-data-dir=${userDataDir}`];

        logger.debug(`[BrowserClient] launch: spawning browser directly on Windows`);
        this.browserProcess = spawn(browserPath, args, {
          detached: true,
          stdio: 'ignore',
        });
      } else if (this.platform === 'wsl') {
        // WSL - use PowerShell to launch Windows browser
        // We need to use a PowerShell variable ($dir) for user-data-dir
        const argsForPowerShell = ['--user-data-dir=$dir', ...baseArgs];
        const argsString = argsForPowerShell.map(arg => `"${arg}"`).join(',');
        const psCommand = `$dir = "$env:LOCALAPPDATA\\local-cli-browser-profile"; Start-Process -FilePath '${browserPath}' -ArgumentList ${argsString}`;

        logger.debug(`[BrowserClient] launch: executing PowerShell command from WSL`);

        const powershellPath = getPowerShellPath();
        this.browserProcess = spawn(powershellPath, ['-Command', psCommand], {
          detached: true,
          stdio: 'ignore',
        });
      } else {
        // Native Linux - spawn directly
        const userDataDir = `${process.env['HOME']}/.local-cli-browser-profile`;
        const args = [...baseArgs, `--user-data-dir=${userDataDir}`];

        logger.debug(`[BrowserClient] launch: spawning browser directly on Linux`);
        this.browserProcess = spawn(browserPath, args, {
          detached: true,
          stdio: 'ignore',
        });
      }

      this.browserProcess.unref();

      // CDP 연결 대기
      logger.debug('[BrowserClient] launch: waiting for CDP endpoint...');
      const maxWait = 15000;
      const startTime = Date.now();

      while (Date.now() - startTime < maxWait) {
        if (await this.isCDPAvailable()) {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (!(await this.isCDPAvailable())) {
        return {
          success: false,
          error: 'CDP endpoint not available',
          details: `Timeout waiting for browser to start on port ${this.cdpPort}`,
        };
      }

      // 타겟 (페이지) 가져오기
      const targets = await this.getTargets();
      const pageTarget = targets.find(t => t.type === 'page');

      if (!pageTarget) {
        return {
          success: false,
          error: 'No page target found',
          details: 'Browser started but no page available',
        };
      }

      // WebSocket으로 CDP 연결
      logger.debug('[BrowserClient] launch: connecting to page via WebSocket...');
      this.cdp = new CDPConnection();
      await this.cdp.connect(pageTarget.webSocketDebuggerUrl);
      // Target connected

      // 로깅 설정
      this.consoleLogs = [];
      this.networkLogs = [];
      this.setupLogging();

      // Page 도메인 활성화
      await this.cdp.send('Page.enable');

      logger.debug('[BrowserClient] launch: browser connected successfully');

      return {
        success: true,
        message: `${this.browserType} launched successfully`,
        browser: this.browserType,
        headless,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.debug('[BrowserClient] launch: error - ' + errorMsg);
      return {
        success: false,
        error: 'Failed to launch browser',
        details: errorMsg,
      };
    }
  }

  /**
   * Close browser
   */
  async close(): Promise<BrowserResponse> {
    try {
      // 1. CDP 연결 해제
      if (this.cdp) {
        this.cdp.close();
      }
      this.cdp = null;
      // Target disconnected
      this.consoleLogs = [];
      this.networkLogs = [];

      // 2. 브라우저 프로세스 종료 (platform-specific)
      try {
        if (this.platform === 'native-windows' || this.platform === 'wsl') {
          const processName = this.browserType === 'chrome' ? 'chrome.exe' : 'msedge.exe';
          execSync(
            `powershell.exe -Command "Get-WmiObject Win32_Process -Filter \\"name='${processName}'\\" | Where-Object { \\$_.CommandLine -like '*local-cli*' } | ForEach-Object { Stop-Process -Id \\$_.ProcessId -Force -ErrorAction SilentlyContinue }"`,
            { stdio: 'ignore', timeout: 10000 }
          );
        } else {
          // Native Linux - kill browser processes with our profile
          const processName = this.browserType === 'chrome' ? 'chrome' : 'msedge';
          execSync(
            `pkill -f "${processName}.*local-cli-browser-profile" 2>/dev/null || true`,
            { stdio: 'ignore', timeout: 10000 }
          );
        }
      } catch {
        // 프로세스가 없거나 이미 종료된 경우
      }

      // 3. CDP 포트 사용 프로세스도 종료 (백업)
      this.killExistingBrowser();

      return { success: true, message: 'Browser closed' };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to close browser',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Navigate to URL
   */
  async navigate(url: string): Promise<NavigateResponse> {
    try {
      if (!this.cdp || !this.cdp.isConnected()) {
        return { success: false, error: 'Browser not running. Use launch first.' };
      }

      await this.cdp.send('Page.navigate', { url });

      // Page.loadEventFired 이벤트를 기다려 안정적으로 페이지 로드 완료 확인
      await new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          this.cdp?.off('Page.loadEventFired');
          reject(new Error(`Navigation to ${url} timed out after 30 seconds`));
        }, 30000);

        const handler = () => {
          clearTimeout(timeoutId);
          this.cdp?.off('Page.loadEventFired');
          resolve();
        };

        this.cdp?.on('Page.loadEventFired', handler);
      });

      // 현재 URL과 타이틀 가져오기
      const pageInfo = await this.getCurrentPageInfo();

      return {
        success: true,
        message: 'Navigated successfully',
        url: pageInfo.url,
        title: pageInfo.title,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to navigate',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Take screenshot
   */
  async screenshot(fullPage: boolean = false): Promise<ScreenshotResponse> {
    try {
      if (!this.cdp || !this.cdp.isConnected()) {
        return { success: false, error: 'Browser not running. Use launch first.' };
      }

      // 스크린샷 옵션
      const params: Record<string, unknown> = { format: 'png' };

      if (fullPage) {
        // 전체 페이지 크기 가져오기
        const layoutMetrics = await this.cdp.send('Page.getLayoutMetrics') as {
          contentSize: { width: number; height: number };
        };

        params['clip'] = {
          x: 0,
          y: 0,
          width: layoutMetrics.contentSize.width,
          height: layoutMetrics.contentSize.height,
          scale: 1,
        };
        params['captureBeyondViewport'] = true;
      }

      const result = await this.cdp.send('Page.captureScreenshot', params) as { data: string };

      // 현재 페이지 정보
      const pageInfo = await this.getCurrentPageInfo();

      return {
        success: true,
        message: 'Screenshot captured',
        image: result.data,
        format: 'png',
        encoding: 'base64',
        url: pageInfo.url,
        title: pageInfo.title,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to take screenshot',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Click element by selector
   */
  async click(selector: string): Promise<BrowserResponse> {
    try {
      if (!this.cdp || !this.cdp.isConnected()) {
        return { success: false, error: 'Browser not running. Use launch first.' };
      }

      // JavaScript로 요소 클릭
      const result = await this.cdp.send('Runtime.evaluate', {
        expression: `
          (function() {
            const el = document.querySelector(${JSON.stringify(selector)});
            if (!el) return { success: false, error: 'Element not found' };
            el.click();
            return { success: true };
          })()
        `,
        returnByValue: true,
      }) as { result: { value: { success: boolean; error?: string } } };

      if (!result.result.value.success) {
        return {
          success: false,
          error: result.result.value.error || 'Click failed',
        };
      }

      // 현재 URL 가져오기
      const urlResult = await this.cdp.send('Runtime.evaluate', {
        expression: 'window.location.href',
        returnByValue: true,
      }) as { result: { value: string } };

      return {
        success: true,
        message: 'Element clicked',
        selector,
        current_url: urlResult.result.value,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to click element',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Fill input field
   */
  async fill(selector: string, value: string): Promise<BrowserResponse> {
    try {
      if (!this.cdp || !this.cdp.isConnected()) {
        return { success: false, error: 'Browser not running. Use launch first.' };
      }

      // JavaScript로 요소에 값 입력
      const result = await this.cdp.send('Runtime.evaluate', {
        expression: `
          (function() {
            const el = document.querySelector(${JSON.stringify(selector)});
            if (!el) return { success: false, error: 'Element not found' };
            el.focus();
            el.value = ${JSON.stringify(value)};
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return { success: true };
          })()
        `,
        returnByValue: true,
      }) as { result: { value: { success: boolean; error?: string } } };

      if (!result.result.value.success) {
        return {
          success: false,
          error: result.result.value.error || 'Fill failed',
        };
      }

      return {
        success: true,
        message: 'Field filled',
        selector,
        length: value.length,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to fill field',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get element text
   */
  async getText(selector: string): Promise<BrowserResponse> {
    try {
      if (!this.cdp || !this.cdp.isConnected()) {
        return { success: false, error: 'Browser not running. Use launch first.' };
      }

      const result = await this.cdp.send('Runtime.evaluate', {
        expression: `
          (function() {
            const el = document.querySelector(${JSON.stringify(selector)});
            if (!el) return { success: false, error: 'Element not found' };
            return { success: true, text: el.textContent || '' };
          })()
        `,
        returnByValue: true,
      }) as { result: { value: { success: boolean; text?: string; error?: string } } };

      if (!result.result.value.success) {
        return {
          success: false,
          error: result.result.value.error || 'Get text failed',
        };
      }

      return {
        success: true,
        message: 'Text retrieved',
        selector,
        text: result.result.value.text || '',
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to get text',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get page info
   */
  async getPageInfo(): Promise<PageInfoResponse> {
    try {
      if (!this.cdp || !this.cdp.isConnected()) {
        return { success: false, error: 'Browser not running. Use launch first.' };
      }

      const pageInfo = await this.getCurrentPageInfo();

      return {
        success: true,
        message: 'Page info retrieved',
        url: pageInfo.url,
        title: pageInfo.title,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to get page info',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get page HTML
   */
  async getHtml(): Promise<PageInfoResponse> {
    try {
      if (!this.cdp || !this.cdp.isConnected()) {
        return { success: false, error: 'Browser not running. Use launch first.' };
      }

      const result = await this.cdp.send('Runtime.evaluate', {
        expression: 'JSON.stringify({ url: window.location.href, title: document.title, html: document.documentElement.outerHTML })',
        returnByValue: true,
      }) as { result: { value: string } };

      const pageInfo = JSON.parse(result.result.value);

      return {
        success: true,
        message: 'HTML retrieved',
        url: pageInfo.url,
        title: pageInfo.title,
        html: pageInfo.html,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to get HTML',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Execute JavaScript
   */
  async executeScript(script: string): Promise<BrowserResponse> {
    try {
      if (!this.cdp || !this.cdp.isConnected()) {
        return { success: false, error: 'Browser not running. Use launch first.' };
      }

      const result = await this.cdp.send('Runtime.evaluate', {
        expression: script,
        returnByValue: true,
      }) as { result: { value: unknown } };

      return {
        success: true,
        message: 'Script executed',
        result: result.result.value,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to execute script',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get console logs
   */
  async getConsole(): Promise<ConsoleResponse> {
    return {
      success: true,
      message: 'Console logs retrieved',
      logs: [...this.consoleLogs],
      count: this.consoleLogs.length,
    };
  }

  /**
   * Wait for element
   */
  async waitFor(selector: string, timeout: number = 10): Promise<BrowserResponse> {
    try {
      if (!this.cdp || !this.cdp.isConnected()) {
        return { success: false, error: 'Browser not running. Use launch first.' };
      }

      const startTime = Date.now();
      const timeoutMs = timeout * 1000;

      while (Date.now() - startTime < timeoutMs) {
        const result = await this.cdp.send('Runtime.evaluate', {
          expression: `document.querySelector(${JSON.stringify(selector)}) !== null`,
          returnByValue: true,
        }) as { result: { value: boolean } };

        if (result.result.value) {
          return {
            success: true,
            message: 'Element found',
            selector,
          };
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return {
        success: false,
        error: 'Timeout waiting for element',
        selector,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Timeout waiting for element',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get network logs
   */
  async getNetwork(): Promise<NetworkResponse> {
    return {
      success: true,
      message: 'Network logs retrieved',
      logs: [...this.networkLogs],
      count: this.networkLogs.length,
    };
  }

  /**
   * Focus browser window
   */
  async focus(): Promise<BrowserResponse> {
    try {
      if (!this.cdp || !this.cdp.isConnected()) {
        return { success: false, error: 'Browser not running. Use launch first.' };
      }

      await this.cdp.send('Page.bringToFront');

      return {
        success: true,
        message: 'Browser window focused',
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to focus browser',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Press a keyboard key
   * Supports: Enter, Tab, Escape, ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
   *           Backspace, Delete, Home, End, PageUp, PageDown, F1-F12,
   *           Control, Alt, Shift, Meta, and combinations like Control+A
   */
  async pressKey(key: string, selector?: string): Promise<BrowserResponse> {
    try {
      if (!this.cdp || !this.cdp.isConnected()) {
        return { success: false, error: 'Browser not running. Use launch first.' };
      }

      // 특수 키 매핑 (확장된 버전)
      const keyMap: Record<string, { key: string; code: string; keyCode: number }> = {
        // 네비게이션 키
        'Enter': { key: 'Enter', code: 'Enter', keyCode: 13 },
        'Tab': { key: 'Tab', code: 'Tab', keyCode: 9 },
        'Escape': { key: 'Escape', code: 'Escape', keyCode: 27 },
        'Backspace': { key: 'Backspace', code: 'Backspace', keyCode: 8 },
        'Delete': { key: 'Delete', code: 'Delete', keyCode: 46 },
        'Space': { key: ' ', code: 'Space', keyCode: 32 },
        // 화살표 키
        'ArrowUp': { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
        'ArrowDown': { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
        'ArrowLeft': { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
        'ArrowRight': { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
        // 페이지 네비게이션
        'Home': { key: 'Home', code: 'Home', keyCode: 36 },
        'End': { key: 'End', code: 'End', keyCode: 35 },
        'PageUp': { key: 'PageUp', code: 'PageUp', keyCode: 33 },
        'PageDown': { key: 'PageDown', code: 'PageDown', keyCode: 34 },
        'Insert': { key: 'Insert', code: 'Insert', keyCode: 45 },
        // 수정 키
        'Control': { key: 'Control', code: 'ControlLeft', keyCode: 17 },
        'Alt': { key: 'Alt', code: 'AltLeft', keyCode: 18 },
        'Shift': { key: 'Shift', code: 'ShiftLeft', keyCode: 16 },
        'Meta': { key: 'Meta', code: 'MetaLeft', keyCode: 91 },
        // Function 키
        'F1': { key: 'F1', code: 'F1', keyCode: 112 },
        'F2': { key: 'F2', code: 'F2', keyCode: 113 },
        'F3': { key: 'F3', code: 'F3', keyCode: 114 },
        'F4': { key: 'F4', code: 'F4', keyCode: 115 },
        'F5': { key: 'F5', code: 'F5', keyCode: 116 },
        'F6': { key: 'F6', code: 'F6', keyCode: 117 },
        'F7': { key: 'F7', code: 'F7', keyCode: 118 },
        'F8': { key: 'F8', code: 'F8', keyCode: 119 },
        'F9': { key: 'F9', code: 'F9', keyCode: 120 },
        'F10': { key: 'F10', code: 'F10', keyCode: 121 },
        'F11': { key: 'F11', code: 'F11', keyCode: 122 },
        'F12': { key: 'F12', code: 'F12', keyCode: 123 },
      };

      if (selector) {
        // 특정 요소에 포커스
        await this.cdp.send('Runtime.evaluate', {
          expression: `document.querySelector(${JSON.stringify(selector)})?.focus()`,
        });
      }

      // 조합 키 처리 (예: Control+A, Shift+Tab)
      const parts = key.split('+');
      const modifiers: { ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean } = {};
      let mainKey = key;

      if (parts.length > 1) {
        for (let i = 0; i < parts.length - 1; i++) {
          const mod = parts[i]?.toLowerCase();
          if (mod === 'control' || mod === 'ctrl') modifiers.ctrl = true;
          else if (mod === 'alt') modifiers.alt = true;
          else if (mod === 'shift') modifiers.shift = true;
          else if (mod === 'meta' || mod === 'cmd') modifiers.meta = true;
        }
        mainKey = parts[parts.length - 1] || key;
      }

      // 단일 문자의 경우 대문자/소문자 처리
      let keyInfo = keyMap[mainKey];
      if (!keyInfo) {
        if (mainKey.length === 1) {
          const charCode = mainKey.charCodeAt(0);
          const isUpper = mainKey >= 'A' && mainKey <= 'Z';
          keyInfo = {
            key: mainKey,
            code: `Key${mainKey.toUpperCase()}`,
            keyCode: isUpper ? charCode : charCode - 32,
          };
        } else {
          keyInfo = { key: mainKey, code: mainKey, keyCode: 0 };
        }
      }

      // 수정자 플래그 계산 (CDP용)
      let modifierFlags = 0;
      if (modifiers.alt) modifierFlags |= 1;
      if (modifiers.ctrl) modifierFlags |= 2;
      if (modifiers.meta) modifierFlags |= 4;
      if (modifiers.shift) modifierFlags |= 8;

      // keyDown
      await this.cdp.send('Input.dispatchKeyEvent', {
        type: 'keyDown',
        key: keyInfo.key,
        code: keyInfo.code,
        windowsVirtualKeyCode: keyInfo.keyCode,
        nativeVirtualKeyCode: keyInfo.keyCode,
        modifiers: modifierFlags,
      });

      // keyUp
      await this.cdp.send('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key: keyInfo.key,
        code: keyInfo.code,
        windowsVirtualKeyCode: keyInfo.keyCode,
        nativeVirtualKeyCode: keyInfo.keyCode,
        modifiers: modifierFlags,
      });

      return {
        success: true,
        message: `Key "${key}" pressed successfully`,
        key,
        selector: selector || '(focused element)',
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to press key',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Type text character by character
   */
  async type(text: string, selector?: string): Promise<BrowserResponse> {
    try {
      if (!this.cdp || !this.cdp.isConnected()) {
        return { success: false, error: 'Browser not running. Use launch first.' };
      }

      if (selector) {
        // 특정 요소에 포커스
        await this.cdp.send('Runtime.evaluate', {
          expression: `document.querySelector(${JSON.stringify(selector)})?.focus()`,
        });
      }

      // 한 글자씩 입력
      for (const char of text) {
        await this.cdp.send('Input.dispatchKeyEvent', {
          type: 'char',
          text: char,
        });
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      return {
        success: true,
        message: `Typed ${text.length} characters`,
        length: text.length,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to type text',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check if browser is currently active
   */
  async isBrowserActive(): Promise<boolean> {
    return this.cdp !== null && this.cdp.isConnected();
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

  /**
   * For compatibility: getServerExePath
   */
  getServerExePath(): string | null {
    return null;
  }

  /**
   * For compatibility: getServerUrl
   */
  getServerUrl(): string {
    return this.getCDPUrl();
  }
}

// Export singleton instance
export const browserClient = new BrowserClient();
export type { BrowserResponse, HealthResponse, ScreenshotResponse, NavigateResponse, PageInfoResponse, ConsoleResponse, NetworkResponse };
