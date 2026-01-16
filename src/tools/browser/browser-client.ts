/**
 * Browser Automation Client (CDP 방식)
 *
 * PowerShell을 통해 Chrome을 CDP 포트와 함께 시작하고,
 * Playwright의 connectOverCDP로 연결하여 브라우저를 제어합니다.
 *
 * server.exe 없이 직접 브라우저를 제어합니다.
 */

import { spawn, ChildProcess, execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { logger } from '../../utils/logger.js';
import { LOCAL_HOME_DIR } from '../../constants.js';
import { findPowerShellPath, getWindowsHostIP } from '../../utils/wsl-utils.js';

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
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private browserProcess: ChildProcess | null = null;
  private isWSL: boolean = false;
  private cdpPort: number = 9222;
  private browserType: 'chrome' | 'edge' = 'chrome';
  private screenshotDir: string;
  private windowsHostIP: string = 'localhost';

  // Console/Network 로그 수집
  private consoleLogs: ConsoleLogEntry[] = [];
  private networkLogs: NetworkLogEntry[] = [];
  private requestCounter: number = 0;

  constructor() {
    this.isWSL = this.detectWSL();
    logger.debug('[BrowserClient] constructor: isWSL = ' + this.isWSL);

    if (this.isWSL) {
      this.windowsHostIP = getWindowsHostIP();
      logger.debug('[BrowserClient] constructor: Windows host IP = ' + this.windowsHostIP);
    }

    // Create screenshot directory
    this.screenshotDir = path.join(LOCAL_HOME_DIR, 'screenshots', 'browser');
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true });
    }

    logger.debug('[BrowserClient] constructor: CDP URL = ' + this.getCDPUrl());
  }

  private detectWSL(): boolean {
    try {
      const release = os.release().toLowerCase();
      return release.includes('wsl') || release.includes('microsoft');
    } catch {
      return false;
    }
  }

  /**
   * Get CDP endpoint URL
   * WSL2에서는 localhost forwarding이 기본 활성화되어 있으므로 localhost 사용
   */
  private getCDPUrl(): string {
    // WSL2의 localhost forwarding 덕분에 localhost로 Windows에 접근 가능
    // mirrored networking이 아니어도 작동함
    return `http://localhost:${this.cdpPort}`;
  }

  /**
   * Get screenshot directory path
   */
  getScreenshotDir(): string {
    return this.screenshotDir;
  }

  /**
   * Find browser executable path on Windows
   * @param paths - Array of possible paths to check
   */
  private findBrowserPath(paths: string[]): string | null {
    if (this.isWSL) {
      // WSL에서는 PowerShell로 확인
      try {
        const conditions = paths.map(p => `if (Test-Path '${p}') { Write-Output '${p}' }`).join(' else');
        const result = execSync(
          `powershell.exe -Command "${conditions}"`,
          { encoding: 'utf-8', timeout: 5000 }
        ).trim();
        if (result) return result;
      } catch {
        // Ignore
      }
    } else {
      for (const p of paths) {
        if (fs.existsSync(p)) return p;
      }
    }
    return null;
  }

  /**
   * Find Chrome executable path on Windows
   */
  private findChromePath(): string | null {
    return this.findBrowserPath([
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ]);
  }

  /**
   * Find Edge executable path on Windows
   */
  private findEdgePath(): string | null {
    return this.findBrowserPath([
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    ]);
  }

  /**
   * Kill existing browser processes with CDP port
   */
  private killExistingBrowser(): void {
    logger.debug('[BrowserClient] killExistingBrowser: killing processes on port ' + this.cdpPort);
    try {
      // WSL과 Windows 모두 동일한 명령 사용
      execSync(
        `powershell.exe -Command "Get-NetTCPConnection -LocalPort ${this.cdpPort} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`,
        { stdio: 'ignore', timeout: 5000 }
      );
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
   * Check if server/browser is running
   */
  async isRunning(): Promise<boolean> {
    return this.browser !== null && this.page !== null;
  }

  /**
   * Get server health status (for compatibility)
   */
  async getHealth(): Promise<HealthResponse | null> {
    const chromePath = this.findChromePath();
    const edgePath = this.findEdgePath();

    return {
      success: true,
      status: 'running',
      version: '2.0.0-cdp',
      browser: {
        active: this.browser !== null,
        type: this.browserType,
        chrome_available: chromePath !== null,
        edge_available: edgePath !== null,
      },
    };
  }

  /**
   * Start the browser server (for compatibility - now just ensures browser is ready)
   */
  async startServer(): Promise<boolean> {
    // CDP 방식에서는 별도 서버가 필요 없음
    // launch()가 호출될 때 브라우저가 시작됨
    return true;
  }

  /**
   * Stop the browser server (for compatibility)
   */
  async stopServer(): Promise<boolean> {
    return this.close().then(() => true).catch(() => true);
  }

  /**
   * Setup console and network logging
   */
  private setupLogging(): void {
    if (!this.page) return;

    // Console 로그 수집
    this.page.on('console', (msg) => {
      this.consoleLogs.push({
        level: msg.type().toUpperCase(),
        message: msg.text(),
        timestamp: Date.now(),
      });
    });

    // Network 로그 수집
    // requestId는 URL + timestamp + counter로 구성하여 고유성 보장
    this.page.on('request', (request) => {
      const timestamp = Date.now();
      const requestId = `${++this.requestCounter}-${timestamp}-${request.url().substring(0, 50)}`;
      this.networkLogs.push({
        type: 'request',
        url: request.url(),
        method: request.method(),
        timestamp,
        requestId,
      });
    });

    this.page.on('response', (response) => {
      const timestamp = Date.now();
      const requestId = `${++this.requestCounter}-${timestamp}-${response.url().substring(0, 50)}`;
      this.networkLogs.push({
        type: 'response',
        url: response.url(),
        status: response.status(),
        statusText: response.statusText(),
        mimeType: response.headers()['content-type'] || '',
        timestamp,
        requestId,
      });
    });
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
      if (this.browser) {
        try {
          await this.browser.close();
        } catch {
          // Ignore
        }
        this.browser = null;
        this.context = null;
        this.page = null;
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

      // PowerShell로 브라우저 시작 (CDP 포트 활성화)
      // 중요: 별도의 user-data-dir을 사용해야 기존 Chrome과 충돌하지 않음
      // %LOCALAPPDATA%는 PowerShell에서 자동으로 확장됨
      const userDataDir = '$env:LOCALAPPDATA\\local-cli-browser-profile';
      const args = [
        `--remote-debugging-port=${this.cdpPort}`,
        `--user-data-dir=${userDataDir}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-popup-blocking',
        '--start-maximized',
      ];

      if (headless) {
        args.push('--headless=new');
      }

      // ArgumentList를 올바르게 구성
      const argsString = args.map(arg => `'${arg}'`).join(',');
      const psCommand = `Start-Process -FilePath '${browserPath}' -ArgumentList ${argsString}`;

      logger.debug(`[BrowserClient] launch: executing PowerShell command`);

      // WSL과 Windows 모두 동일한 방식 사용 (shell: true 제거로 보안 강화)
      const powershellPath = this.isWSL ? findPowerShellPath() : 'powershell.exe';
      this.browserProcess = spawn(powershellPath, ['-Command', psCommand], {
        detached: true,
        stdio: 'ignore',
      });

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

      // Playwright로 CDP 연결
      logger.debug('[BrowserClient] launch: connecting via CDP...');
      this.browser = await chromium.connectOverCDP(this.getCDPUrl());

      // 기존 컨텍스트와 페이지 가져오기 또는 새로 생성
      const contexts = this.browser.contexts();
      if (contexts.length > 0) {
        const existingContext = contexts[0];
        if (existingContext) {
          this.context = existingContext;
          const pages = this.context.pages();
          const existingPage = pages[0];
          this.page = existingPage ? existingPage : await this.context.newPage();
        } else {
          this.context = await this.browser.newContext();
          this.page = await this.context.newPage();
        }
      } else {
        this.context = await this.browser.newContext();
        this.page = await this.context.newPage();
      }

      // 로깅 설정
      this.consoleLogs = [];
      this.networkLogs = [];
      this.setupLogging();

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
      // 1. Playwright 연결 해제
      if (this.browser) {
        try {
          await this.browser.close();
        } catch {
          // CDP 연결이 이미 끊어진 경우 무시
        }
      }
      this.browser = null;
      this.context = null;
      this.page = null;
      this.consoleLogs = [];
      this.networkLogs = [];

      // 2. 실제 브라우저 프로세스 종료 (Get-WmiObject로 CommandLine 검색)
      try {
        // browserType에 따라 프로세스 이름 결정 (Chrome 또는 Edge)
        const processName = this.browserType === 'chrome' ? 'chrome.exe' : 'msedge.exe';
        // user-data-dir로 시작된 브라우저 프로세스 찾아서 종료
        execSync(
          `powershell.exe -Command "Get-WmiObject Win32_Process -Filter \\"name='${processName}'\\" | Where-Object { \\$_.CommandLine -like '*local-cli*' } | ForEach-Object { Stop-Process -Id \\$_.ProcessId -Force -ErrorAction SilentlyContinue }"`,
          { stdio: 'ignore', timeout: 10000 }
        );
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
      if (!this.page) {
        return { success: false, error: 'Browser not running. Use launch first.' };
      }

      await this.page.goto(url, { waitUntil: 'domcontentloaded' });

      return {
        success: true,
        message: 'Navigated successfully',
        url: this.page.url(),
        title: await this.page.title(),
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
      if (!this.page) {
        return { success: false, error: 'Browser not running. Use launch first.' };
      }

      const buffer = await this.page.screenshot({ fullPage });
      const base64 = buffer.toString('base64');

      return {
        success: true,
        message: 'Screenshot captured',
        image: base64,
        format: 'png',
        encoding: 'base64',
        url: this.page.url(),
        title: await this.page.title(),
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
   * Click element
   */
  async click(selector: string): Promise<BrowserResponse> {
    try {
      if (!this.page) {
        return { success: false, error: 'Browser not running. Use launch first.' };
      }

      await this.page.click(selector, { timeout: 10000 });

      return {
        success: true,
        message: 'Element clicked',
        selector,
        current_url: this.page.url(),
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
      if (!this.page) {
        return { success: false, error: 'Browser not running. Use launch first.' };
      }

      await this.page.fill(selector, value, { timeout: 10000 });

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
      if (!this.page) {
        return { success: false, error: 'Browser not running. Use launch first.' };
      }

      const text = await this.page.textContent(selector, { timeout: 10000 });

      return {
        success: true,
        message: 'Text retrieved',
        selector,
        text: text || '',
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
      if (!this.page) {
        return { success: false, error: 'Browser not running. Use launch first.' };
      }

      return {
        success: true,
        message: 'Page info retrieved',
        url: this.page.url(),
        title: await this.page.title(),
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
      if (!this.page) {
        return { success: false, error: 'Browser not running. Use launch first.' };
      }

      const html = await this.page.content();

      return {
        success: true,
        message: 'HTML retrieved',
        url: this.page.url(),
        title: await this.page.title(),
        html,
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
      if (!this.page) {
        return { success: false, error: 'Browser not running. Use launch first.' };
      }

      const result = await this.page.evaluate(script);

      return {
        success: true,
        message: 'Script executed',
        result,
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
      if (!this.page) {
        return { success: false, error: 'Browser not running. Use launch first.' };
      }

      await this.page.waitForSelector(selector, { timeout: timeout * 1000 });

      return {
        success: true,
        message: 'Element found',
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
      if (!this.page) {
        return { success: false, error: 'Browser not running. Use launch first.' };
      }

      // Playwright에서는 직접적인 윈도우 포커스가 제한적
      // bringToFront를 사용
      await this.page.bringToFront();

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
      if (!this.page) {
        return { success: false, error: 'Browser not running. Use launch first.' };
      }

      if (selector) {
        // Press key on specific element
        await this.page.locator(selector).press(key);
      } else {
        // Press key on the page (focused element)
        await this.page.keyboard.press(key);
      }

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
   * Type text (character by character, triggers key events)
   */
  async type(text: string, selector?: string): Promise<BrowserResponse> {
    try {
      if (!this.page) {
        return { success: false, error: 'Browser not running. Use launch first.' };
      }

      if (selector) {
        await this.page.locator(selector).type(text);
      } else {
        await this.page.keyboard.type(text);
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
    return this.browser !== null && this.page !== null;
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
   * For compatibility: getServerExePath (no longer needed)
   */
  getServerExePath(): string | null {
    return null; // CDP 방식에서는 server.exe 불필요
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
