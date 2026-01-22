/**
 * Browser Client for Electron (Windows Native)
 *
 * Simple CDP (Chrome DevTools Protocol) based browser automation.
 * Uses Chrome or Edge directly via CDP - no Playwright/Puppeteer dependency.
 *
 * This is much simpler than the CLI version since we're running natively on Windows.
 */

import { spawn, ChildProcess, execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import WebSocket from 'ws';
import { logger } from '../../utils/logger';

// =============================================================================
// Types
// =============================================================================

export interface BrowserResponse {
  success: boolean;
  message?: string;
  error?: string;
  details?: string;
  [key: string]: unknown;
}

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

// =============================================================================
// CDP Connection
// =============================================================================

class CDPConnection {
  private ws: WebSocket | null = null;
  private messageId = 0;
  private pendingMessages = new Map<number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }>();
  private eventHandlers = new Map<string, ((params: unknown) => void)[]>();

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

// =============================================================================
// Browser Client
// =============================================================================

class BrowserClient {
  private cdp: CDPConnection | null = null;
  private browserProcess: ChildProcess | null = null;
  private cdpPort = 9222;
  private browserType: 'chrome' | 'edge' = 'chrome';
  private screenshotDir: string;

  constructor() {
    // Create screenshot directory
    const appDataDir = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    this.screenshotDir = path.join(appDataDir, 'LOCAL-CLI-UI', 'screenshots', 'browser');
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true });
    }
  }

  // ===========================================================================
  // Browser Path Detection (Windows Native)
  // ===========================================================================

  private findChromePath(): string | null {
    const paths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  private findEdgePath(): string | null {
    const paths = [
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  private killExistingBrowser(): void {
    try {
      // Kill any process using the CDP port
      execSync(
        `powershell.exe -Command "Get-NetTCPConnection -LocalPort ${this.cdpPort} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`,
        { stdio: 'ignore', timeout: 5000 }
      );
      // Also kill any Chrome/Edge with our user-data-dir profile (might be running without CDP)
      execSync(
        `powershell.exe -Command "Get-Process chrome, msedge -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*LOCAL-CLI-UI*' } | Stop-Process -Force -ErrorAction SilentlyContinue"`,
        { stdio: 'ignore', timeout: 5000 }
      );
    } catch {
      // Ignore
    }
  }

  private async isCDPAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`http://localhost:${this.cdpPort}/json/version`, {
        signal: AbortSignal.timeout(2000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async getTargets(): Promise<CDPTarget[]> {
    const response = await fetch(`http://localhost:${this.cdpPort}/json`);
    return await response.json() as CDPTarget[];
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  async isRunning(): Promise<boolean> {
    return this.cdp !== null && this.cdp.isConnected();
  }

  /**
   * Launch browser
   */
  async launch(options?: { headless?: boolean; browser?: 'chrome' | 'edge' }): Promise<BrowserResponse> {
    const headless = options?.headless ?? false;
    const preferredBrowser = options?.browser ?? 'chrome';

    logger.info('[BrowserClient] Launching browser', { preferredBrowser, headless });

    try {
      // Clean up existing connection
      if (this.cdp) {
        this.cdp.close();
        this.cdp = null;
      }

      this.killExistingBrowser();
      await new Promise(resolve => setTimeout(resolve, 500));

      // Find browser path
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

      // Browser arguments
      const userDataDir = path.join(process.env.LOCALAPPDATA || '', 'LOCAL-CLI-UI', 'browser-profile');
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

      // Launch browser - use execSync to run PowerShell Start-Process for reliable Windows GUI launch
      logger.debug('[BrowserClient] Launching with args', { browserPath, args });

      // Build PowerShell command for reliable GUI app launch
      const argsString = args.map(a => `'${a}'`).join(',');
      const psCommand = `Start-Process -FilePath '${browserPath}' -ArgumentList ${argsString}`;

      try {
        execSync(`powershell.exe -Command "${psCommand}"`, {
          stdio: 'ignore',
          timeout: 10000,
          windowsHide: true,
        });
        logger.debug('[BrowserClient] PowerShell Start-Process completed');
      } catch (spawnError) {
        logger.error('[BrowserClient] Failed to spawn browser', { error: spawnError });
        return {
          success: false,
          error: 'Failed to start browser process',
          details: spawnError instanceof Error ? spawnError.message : String(spawnError),
        };
      }

      // Wait for CDP
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
          details: `Timeout waiting for browser on port ${this.cdpPort}`,
        };
      }

      // Get page target
      const targets = await this.getTargets();
      const pageTarget = targets.find(t => t.type === 'page');

      if (!pageTarget) {
        return {
          success: false,
          error: 'No page target found',
        };
      }

      // Connect via WebSocket
      this.cdp = new CDPConnection();
      await this.cdp.connect(pageTarget.webSocketDebuggerUrl);
      await this.cdp.send('Page.enable');

      return {
        success: true,
        message: `${this.browserType} launched successfully`,
        browser: this.browserType,
        headless,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('[BrowserClient] Launch failed', { error: errorMsg });
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
      if (this.cdp) {
        this.cdp.close();
        this.cdp = null;
      }

      // Kill browser processes with our profile
      try {
        const processName = this.browserType === 'chrome' ? 'chrome.exe' : 'msedge.exe';
        execSync(
          `powershell.exe -Command "Get-Process -Name '${processName.replace('.exe', '')}' -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*LOCAL-CLI-UI*' } | Stop-Process -Force -ErrorAction SilentlyContinue"`,
          { stdio: 'ignore', timeout: 10000 }
        );
      } catch {
        // Process might already be closed
      }

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
  async navigate(url: string): Promise<BrowserResponse> {
    try {
      if (!this.cdp || !this.cdp.isConnected()) {
        return { success: false, error: 'Browser not running. Use launch first.' };
      }

      await this.cdp.send('Page.navigate', { url });

      // Wait for load
      await new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          this.cdp?.off('Page.loadEventFired');
          reject(new Error('Navigation timeout'));
        }, 30000);

        this.cdp?.on('Page.loadEventFired', () => {
          clearTimeout(timeoutId);
          this.cdp?.off('Page.loadEventFired');
          resolve();
        });
      });

      // Get page info
      const evalResult = await this.cdp.send('Runtime.evaluate', {
        expression: 'JSON.stringify({ url: window.location.href, title: document.title })',
        returnByValue: true,
      }) as { result: { value: string } };

      const pageInfo = JSON.parse(evalResult.result.value);

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
   * Click element
   */
  async click(selector: string): Promise<BrowserResponse> {
    try {
      if (!this.cdp || !this.cdp.isConnected()) {
        return { success: false, error: 'Browser not running. Use launch first.' };
      }

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
        return { success: false, error: result.result.value.error || 'Click failed' };
      }

      return { success: true, message: 'Element clicked', selector };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to click element',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Type text into element
   */
  async type(selector: string, text: string, clear = true): Promise<BrowserResponse> {
    try {
      if (!this.cdp || !this.cdp.isConnected()) {
        return { success: false, error: 'Browser not running. Use launch first.' };
      }

      const result = await this.cdp.send('Runtime.evaluate', {
        expression: `
          (function() {
            const el = document.querySelector(${JSON.stringify(selector)});
            if (!el) return { success: false, error: 'Element not found' };
            el.focus();
            ${clear ? 'el.value = "";' : ''}
            el.value = ${JSON.stringify(text)};
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return { success: true };
          })()
        `,
        returnByValue: true,
      }) as { result: { value: { success: boolean; error?: string } } };

      if (!result.result.value.success) {
        return { success: false, error: result.result.value.error || 'Type failed' };
      }

      return { success: true, message: 'Text typed', selector, length: text.length };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to type text',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Take screenshot
   */
  async screenshot(fullPage = false): Promise<BrowserResponse> {
    try {
      if (!this.cdp || !this.cdp.isConnected()) {
        return { success: false, error: 'Browser not running. Use launch first.' };
      }

      const params: Record<string, unknown> = { format: 'png' };

      if (fullPage) {
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

      // Save to file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `browser_${timestamp}.png`;
      const filepath = path.join(this.screenshotDir, filename);
      fs.writeFileSync(filepath, Buffer.from(result.data, 'base64'));

      return {
        success: true,
        message: 'Screenshot captured',
        image: result.data,
        filepath,
        format: 'png',
        encoding: 'base64',
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
   * Get page HTML
   */
  async getHtml(selector?: string): Promise<BrowserResponse> {
    try {
      if (!this.cdp || !this.cdp.isConnected()) {
        return { success: false, error: 'Browser not running. Use launch first.' };
      }

      const expression = selector
        ? `document.querySelector(${JSON.stringify(selector)})?.outerHTML || ''`
        : 'document.documentElement.outerHTML';

      const result = await this.cdp.send('Runtime.evaluate', {
        expression: `JSON.stringify({ html: ${expression}, url: window.location.href, title: document.title })`,
        returnByValue: true,
      }) as { result: { value: string } };

      const pageInfo = JSON.parse(result.result.value);

      return {
        success: true,
        message: 'HTML retrieved',
        html: pageInfo.html,
        url: pageInfo.url,
        title: pageInfo.title,
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
   * Wait for element
   */
  async waitFor(selector?: string, timeout = 10): Promise<BrowserResponse> {
    try {
      if (!this.cdp || !this.cdp.isConnected()) {
        return { success: false, error: 'Browser not running. Use launch first.' };
      }

      if (!selector) {
        // Just wait for specified time
        await new Promise(resolve => setTimeout(resolve, timeout * 1000));
        return { success: true, message: `Waited ${timeout} seconds` };
      }

      const startTime = Date.now();
      const timeoutMs = timeout * 1000;

      while (Date.now() - startTime < timeoutMs) {
        const result = await this.cdp.send('Runtime.evaluate', {
          expression: `document.querySelector(${JSON.stringify(selector)}) !== null`,
          returnByValue: true,
        }) as { result: { value: boolean } };

        if (result.result.value) {
          return { success: true, message: 'Element found', selector };
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return { success: false, error: 'Timeout waiting for element', selector };
    } catch (error) {
      return {
        success: false,
        error: 'Wait failed',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Connect to existing browser
   */
  async connect(port?: number): Promise<BrowserResponse> {
    try {
      if (port) this.cdpPort = port;

      if (!(await this.isCDPAvailable())) {
        return { success: false, error: `No browser found on port ${this.cdpPort}` };
      }

      const targets = await this.getTargets();
      const pageTarget = targets.find(t => t.type === 'page');

      if (!pageTarget) {
        return { success: false, error: 'No page target found' };
      }

      if (this.cdp) {
        this.cdp.close();
      }

      this.cdp = new CDPConnection();
      await this.cdp.connect(pageTarget.webSocketDebuggerUrl);
      await this.cdp.send('Page.enable');

      return {
        success: true,
        message: 'Connected to existing browser',
        url: pageTarget.url,
        title: pageTarget.title,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to connect to browser',
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
        awaitPromise: true,
      }) as { result: { value: unknown }; exceptionDetails?: { text: string } };

      if (result.exceptionDetails) {
        return { success: false, error: result.exceptionDetails.text };
      }

      return { success: true, message: 'Script executed', result: result.result.value };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to execute script',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Fill form field (alias for type)
   */
  async fill(selector: string, value: string): Promise<BrowserResponse> {
    return this.type(selector, value, true);
  }

  /**
   * Focus element
   */
  async focus(selector: string): Promise<BrowserResponse> {
    try {
      if (!this.cdp || !this.cdp.isConnected()) {
        return { success: false, error: 'Browser not running. Use launch first.' };
      }

      const result = await this.cdp.send('Runtime.evaluate', {
        expression: `
          (function() {
            const el = document.querySelector(${JSON.stringify(selector)});
            if (!el) return { success: false, error: 'Element not found' };
            el.focus();
            return { success: true };
          })()
        `,
        returnByValue: true,
      }) as { result: { value: { success: boolean; error?: string } } };

      if (!result.result.value.success) {
        return { success: false, error: result.result.value.error || 'Focus failed' };
      }

      return { success: true, message: 'Element focused', selector };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to focus element',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get console logs
   */
  async getConsole(): Promise<BrowserResponse> {
    try {
      if (!this.cdp || !this.cdp.isConnected()) {
        return { success: false, error: 'Browser not running. Use launch first.' };
      }

      // Enable console logging if not already enabled
      await this.cdp.send('Log.enable');
      await this.cdp.send('Runtime.enable');

      return {
        success: true,
        message: 'Console logging enabled. Use executeScript to check console.log output.',
        logs: [],
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to get console logs',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get browser health
   */
  async getHealth(): Promise<BrowserResponse> {
    try {
      const cdpAvailable = await this.isCDPAvailable();
      const connected = this.cdp?.isConnected() ?? false;

      return {
        success: true,
        cdp_available: cdpAvailable,
        connected,
        port: this.cdpPort,
        browser_type: this.browserType,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to get health',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get network requests (basic info)
   */
  async getNetwork(): Promise<BrowserResponse> {
    try {
      if (!this.cdp || !this.cdp.isConnected()) {
        return { success: false, error: 'Browser not running. Use launch first.' };
      }

      // Enable network if not already
      await this.cdp.send('Network.enable');

      const result = await this.cdp.send('Runtime.evaluate', {
        expression: `JSON.stringify(performance.getEntriesByType('resource').map(r => ({
          name: r.name,
          type: r.initiatorType,
          duration: r.duration,
          size: r.transferSize
        })))`,
        returnByValue: true,
      }) as { result: { value: string } };

      const resources = JSON.parse(result.result.value);

      return {
        success: true,
        message: 'Network resources retrieved',
        resources,
        count: resources.length,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to get network info',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get page info
   */
  async getPageInfo(): Promise<BrowserResponse> {
    try {
      if (!this.cdp || !this.cdp.isConnected()) {
        return { success: false, error: 'Browser not running. Use launch first.' };
      }

      const result = await this.cdp.send('Runtime.evaluate', {
        expression: `JSON.stringify({
          url: window.location.href,
          title: document.title,
          domain: window.location.hostname,
          protocol: window.location.protocol,
          pathname: window.location.pathname,
          readyState: document.readyState,
          bodyLength: document.body?.innerHTML.length || 0,
          linkCount: document.querySelectorAll('a').length,
          imageCount: document.querySelectorAll('img').length,
          formCount: document.querySelectorAll('form').length,
          inputCount: document.querySelectorAll('input').length,
        })`,
        returnByValue: true,
      }) as { result: { value: string } };

      const pageInfo = JSON.parse(result.result.value);

      return {
        success: true,
        message: 'Page info retrieved',
        ...pageInfo,
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
   * Get text content from element or page
   */
  async getText(selector?: string): Promise<BrowserResponse> {
    try {
      if (!this.cdp || !this.cdp.isConnected()) {
        return { success: false, error: 'Browser not running. Use launch first.' };
      }

      const expression = selector
        ? `document.querySelector(${JSON.stringify(selector)})?.textContent || ''`
        : 'document.body?.innerText || ""';

      const result = await this.cdp.send('Runtime.evaluate', {
        expression: `JSON.stringify({ text: ${expression}, url: window.location.href })`,
        returnByValue: true,
      }) as { result: { value: string } };

      const pageInfo = JSON.parse(result.result.value);

      return {
        success: true,
        message: 'Text content retrieved',
        text: pageInfo.text,
        url: pageInfo.url,
        selector: selector || 'body',
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to get text content',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check if browser is active
   */
  async isBrowserActive(): Promise<boolean> {
    try {
      if (!this.cdp || !this.cdp.isConnected()) {
        return false;
      }

      await this.cdp.send('Runtime.evaluate', {
        expression: 'true',
        returnByValue: true,
      });

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Press keyboard key
   */
  async pressKey(key: string): Promise<BrowserResponse> {
    try {
      if (!this.cdp || !this.cdp.isConnected()) {
        return { success: false, error: 'Browser not running. Use launch first.' };
      }

      // Key code mapping for common keys
      const keyCodeMap: Record<string, { keyCode: number; code: string; key: string }> = {
        'Enter': { keyCode: 13, code: 'Enter', key: 'Enter' },
        'Tab': { keyCode: 9, code: 'Tab', key: 'Tab' },
        'Escape': { keyCode: 27, code: 'Escape', key: 'Escape' },
        'Backspace': { keyCode: 8, code: 'Backspace', key: 'Backspace' },
        'Delete': { keyCode: 46, code: 'Delete', key: 'Delete' },
        'ArrowUp': { keyCode: 38, code: 'ArrowUp', key: 'ArrowUp' },
        'ArrowDown': { keyCode: 40, code: 'ArrowDown', key: 'ArrowDown' },
        'ArrowLeft': { keyCode: 37, code: 'ArrowLeft', key: 'ArrowLeft' },
        'ArrowRight': { keyCode: 39, code: 'ArrowRight', key: 'ArrowRight' },
        'Space': { keyCode: 32, code: 'Space', key: ' ' },
        'Home': { keyCode: 36, code: 'Home', key: 'Home' },
        'End': { keyCode: 35, code: 'End', key: 'End' },
        'PageUp': { keyCode: 33, code: 'PageUp', key: 'PageUp' },
        'PageDown': { keyCode: 34, code: 'PageDown', key: 'PageDown' },
      };

      const keyInfo = keyCodeMap[key] || {
        keyCode: key.charCodeAt(0),
        code: `Key${key.toUpperCase()}`,
        key: key,
      };

      // Key down
      await this.cdp.send('Input.dispatchKeyEvent', {
        type: 'keyDown',
        windowsVirtualKeyCode: keyInfo.keyCode,
        code: keyInfo.code,
        key: keyInfo.key,
      });

      // Key up
      await this.cdp.send('Input.dispatchKeyEvent', {
        type: 'keyUp',
        windowsVirtualKeyCode: keyInfo.keyCode,
        code: keyInfo.code,
        key: keyInfo.key,
      });

      return { success: true, message: 'Key pressed', key };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to press key',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Send CDP command (low-level)
   */
  async send(method: string, params?: Record<string, unknown>): Promise<BrowserResponse> {
    try {
      if (!this.cdp || !this.cdp.isConnected()) {
        return { success: false, error: 'Browser not running. Use launch first.' };
      }

      const result = await this.cdp.send(method, params);
      return { success: true, message: 'Command sent', result };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to send CDP command',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

// Export singleton
export const browserClient = new BrowserClient();
export default browserClient;
