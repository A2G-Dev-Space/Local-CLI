/**
 * Chrome DevTools Protocol (CDP) Client
 *
 * WebSocket-based client for Chrome browser automation
 * No external dependencies - pure TypeScript implementation
 */

import { spawn, ChildProcess } from 'child_process';
import { WebSocket } from 'ws';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

export interface CDPSession {
  ws: WebSocket;
  browser: ChildProcess | null;
  debuggingPort: number;
  targetId: string;
  userDataDir?: string;
}

interface CDPResponse {
  id: number;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
}

interface CDPTarget {
  id: string;
  type: string;
  title: string;
  url: string;
  webSocketDebuggerUrl: string;
}

/**
 * Find Chrome executable path based on OS
 */
function findChromePath(): string | null {
  const platform = os.platform();

  // Check environment variable first
  if (process.env['CHROME_PATH'] && fs.existsSync(process.env['CHROME_PATH'])) {
    return process.env['CHROME_PATH'];
  }

  const paths: Record<string, string[]> = {
    linux: [
      // Native Linux
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium',
      // WSL - Windows Chrome paths
      '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe',
      '/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe',
      // WSL - Edge as fallback (Chromium-based)
      '/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      '/mnt/c/Program Files/Microsoft/Edge/Application/msedge.exe',
    ],
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ],
    win32: [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      process.env['LOCALAPPDATA'] + '\\Google\\Chrome\\Application\\chrome.exe',
    ],
  };

  const platformPaths = paths[platform] || [];

  for (const chromePath of platformPaths) {
    if (chromePath && fs.existsSync(chromePath)) {
      return chromePath;
    }
  }

  return null;
}

/**
 * Get list of available debugging targets
 */
async function getTargets(port: number): Promise<CDPTarget[]> {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://127.0.0.1:${port}/json`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Failed to parse targets'));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Timeout getting targets'));
    });
  });
}

/**
 * Wait for Chrome to be ready
 */
async function waitForChrome(port: number, maxRetries = 30): Promise<CDPTarget[]> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const targets = await getTargets(port);
      return targets;
    } catch {
      await new Promise(r => setTimeout(r, 200));
    }
  }
  throw new Error('Chrome failed to start within timeout');
}

export class CDPClient {
  private session: CDPSession | null = null;
  private messageId = 0;
  private pendingMessages: Map<number, {
    resolve: (value: CDPResponse) => void;
    reject: (error: Error) => void;
  }> = new Map();

  /**
   * Launch Chrome and connect via CDP
   */
  async launch(options: { headless?: boolean; port?: number } = {}): Promise<void> {
    const { headless = true, port = 9222 } = options;

    const chromePath = findChromePath();
    if (!chromePath) {
      throw new Error('Chrome not found. Please install Google Chrome or Chromium.');
    }

    // Create temp user data dir
    const userDataDir = path.join(os.tmpdir(), `chrome-cdp-${Date.now()}`);
    fs.mkdirSync(userDataDir, { recursive: true });

    const args = [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-client-side-phishing-detection',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-hang-monitor',
      '--disable-popup-blocking',
      '--disable-prompt-on-repost',
      '--disable-sync',
      '--disable-translate',
      '--metrics-recording-only',
      '--safebrowsing-disable-auto-update',
    ];

    if (headless) {
      args.push('--headless=new');
    }

    // Launch Chrome
    const browser = spawn(chromePath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    browser.on('error', (err) => {
      console.error('Chrome process error:', err);
    });

    // Wait for Chrome to be ready
    const targets = await waitForChrome(port);

    // Find a page target
    let pageTarget = targets.find(t => t.type === 'page');

    if (!pageTarget) {
      // Create a new page
      await new Promise<void>((resolve, reject) => {
        const req = http.get(`http://127.0.0.1:${port}/json/new`, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            try {
              pageTarget = JSON.parse(data);
              resolve();
            } catch (e) {
              reject(new Error('Failed to create new page'));
            }
          });
        });
        req.on('error', reject);
      });
    }

    if (!pageTarget || !pageTarget.webSocketDebuggerUrl) {
      throw new Error('No page target available');
    }

    // Connect WebSocket
    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => resolve());
      ws.on('error', reject);
      setTimeout(() => reject(new Error('WebSocket connection timeout')), 10000);
    });

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as CDPResponse;
        const pending = this.pendingMessages.get(message.id);
        if (pending) {
          this.pendingMessages.delete(message.id);
          if (message.error) {
            pending.reject(new Error(message.error.message));
          } else {
            pending.resolve(message);
          }
        }
      } catch {
        // Ignore parse errors for events
      }
    });

    this.session = {
      ws,
      browser,
      debuggingPort: port,
      targetId: pageTarget.id,
      userDataDir,
    };

    // Enable required domains
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('DOM.enable');
  }

  /**
   * Connect to existing Chrome instance
   */
  async connect(port: number = 9222): Promise<void> {
    const targets = await getTargets(port);
    const pageTarget = targets.find(t => t.type === 'page');

    if (!pageTarget || !pageTarget.webSocketDebuggerUrl) {
      throw new Error('No page target available. Is Chrome running with --remote-debugging-port?');
    }

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => resolve());
      ws.on('error', reject);
      setTimeout(() => reject(new Error('WebSocket connection timeout')), 10000);
    });

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as CDPResponse;
        const pending = this.pendingMessages.get(message.id);
        if (pending) {
          this.pendingMessages.delete(message.id);
          if (message.error) {
            pending.reject(new Error(message.error.message));
          } else {
            pending.resolve(message);
          }
        }
      } catch {
        // Ignore parse errors for events
      }
    });

    this.session = {
      ws,
      browser: null,
      debuggingPort: port,
      targetId: pageTarget.id,
    };

    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('DOM.enable');
  }

  /**
   * Send CDP command
   */
  async send(method: string, params: Record<string, unknown> = {}): Promise<CDPResponse> {
    if (!this.session) {
      throw new Error('Not connected to Chrome');
    }

    const id = ++this.messageId;
    const message = JSON.stringify({ id, method, params });

    return new Promise((resolve, reject) => {
      this.pendingMessages.set(id, { resolve, reject });
      this.session!.ws.send(message);

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingMessages.has(id)) {
          this.pendingMessages.delete(id);
          reject(new Error(`CDP command timeout: ${method}`));
        }
      }, 30000);
    });
  }

  /**
   * Navigate to URL
   */
  async navigate(url: string): Promise<void> {
    const response = await this.send('Page.navigate', { url });

    // Check for navigation error
    const errorText = response.result?.['errorText'] as string | undefined;
    if (errorText) {
      throw new Error(`Navigation failed: ${errorText}`);
    }

    // Wait for page to load (simple delay approach - more reliable than event waiting)
    // This gives time for initial render before taking screenshots or interacting
    await new Promise(r => setTimeout(r, 1500));
  }

  /**
   * Take screenshot (returns base64)
   */
  async screenshot(options: { fullPage?: boolean } = {}): Promise<string> {
    const { fullPage = false } = options;

    let clip: Record<string, number> | undefined;

    if (fullPage) {
      // Get full page dimensions
      const layoutMetrics = await this.send('Page.getLayoutMetrics');
      const contentSize = layoutMetrics.result?.['contentSize'] as { width: number; height: number } | undefined;
      if (contentSize) {
        clip = {
          x: 0,
          y: 0,
          width: contentSize.width,
          height: contentSize.height,
          scale: 1,
        };
      }
    }

    const response = await this.send('Page.captureScreenshot', {
      format: 'png',
      clip,
    });

    return response.result?.['data'] as string;
  }

  /**
   * Click element by selector
   */
  async click(selector: string): Promise<void> {
    // Get document
    const docResponse = await this.send('DOM.getDocument');
    const rootNodeId = (docResponse.result?.['root'] as { nodeId: number })?.nodeId;

    // Query selector
    const nodeResponse = await this.send('DOM.querySelector', {
      nodeId: rootNodeId,
      selector,
    });

    const nodeId = nodeResponse.result?.['nodeId'] as number;
    if (!nodeId) {
      throw new Error(`Element not found: ${selector}`);
    }

    // Get box model for coordinates
    const boxResponse = await this.send('DOM.getBoxModel', { nodeId });
    const content = (boxResponse.result?.['model'] as { content: number[] })?.content;

    if (!content || content.length < 4) {
      throw new Error(`Cannot get element position: ${selector}`);
    }

    // Calculate center point
    const x = (content[0]! + content[2]!) / 2;
    const y = (content[1]! + content[5]!) / 2;

    // Click
    await this.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x,
      y,
      button: 'left',
      clickCount: 1,
    });

    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x,
      y,
      button: 'left',
      clickCount: 1,
    });
  }

  /**
   * Fill input field
   */
  async fill(selector: string, value: string): Promise<void> {
    // Focus the element first
    await this.click(selector);

    // Clear existing content (Cmd+A on macOS, Ctrl+A on others)
    const isMac = os.platform() === 'darwin';
    const modifiers = isMac ? 4 : 2; // 4 for Cmd on Mac, 2 for Ctrl on others
    await this.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'a',
      modifiers,
    });
    await this.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'a',
      modifiers,
    });

    // Type new content
    for (const char of value) {
      await this.send('Input.dispatchKeyEvent', {
        type: 'keyDown',
        text: char,
      });
      await this.send('Input.dispatchKeyEvent', {
        type: 'keyUp',
        text: char,
      });
    }
  }

  /**
   * Get text content of element
   */
  async getText(selector: string): Promise<string> {
    const result = await this.send('Runtime.evaluate', {
      expression: `document.querySelector('${selector.replace(/'/g, "\\'")}')?.textContent || ''`,
      returnByValue: true,
    });

    return (result.result?.['result'] as { value: string })?.value || '';
  }

  /**
   * Get page title
   */
  async getTitle(): Promise<string> {
    const result = await this.send('Runtime.evaluate', {
      expression: 'document.title',
      returnByValue: true,
    });

    return (result.result?.['result'] as { value: string })?.value || '';
  }

  /**
   * Get current URL
   */
  async getUrl(): Promise<string> {
    const result = await this.send('Runtime.evaluate', {
      expression: 'window.location.href',
      returnByValue: true,
    });

    return (result.result?.['result'] as { value: string })?.value || '';
  }

  /**
   * Evaluate JavaScript
   */
  async evaluate(expression: string): Promise<unknown> {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });

    return (result.result?.['result'] as { value: unknown })?.value;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.session !== null && this.session.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Close browser and cleanup
   */
  async close(): Promise<void> {
    if (this.session) {
      const userDataDir = this.session.userDataDir;

      try {
        this.session.ws.close();
      } catch {
        // Ignore close errors
      }

      if (this.session.browser) {
        this.session.browser.kill();
      }

      // Clean up temp user data directory
      if (userDataDir) {
        try {
          fs.rmSync(userDataDir, { recursive: true, force: true });
        } catch {
          // Ignore cleanup errors
        }
      }

      this.session = null;
    }

    this.pendingMessages.clear();
  }
}

// Singleton instance
export const cdpClient = new CDPClient();
