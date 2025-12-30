/**
 * Office Automation Client
 *
 * HTTP client for communicating with the Office Automation Server (Windows .exe)
 * Includes auto-start/stop functionality for the server executable.
 */

import { spawn, ChildProcess, execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

/**
 * Check if WSL2 mirrored networking is enabled
 * With mirrored networking, localhost works directly
 */
function isMirroredNetworking(): boolean {
  try {
    // Check if .wslconfig has mirrored networking
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
 * Same approach as browser/cdp-client.ts
 */
function getWindowsHostIP(): string {
  try {
    // If mirrored networking is enabled, use localhost
    if (isMirroredNetworking()) {
      return '127.0.0.1';
    }

    // Method 1: Read from /etc/resolv.conf (for traditional WSL2 NAT networking)
    if (fs.existsSync('/etc/resolv.conf')) {
      const content = fs.readFileSync('/etc/resolv.conf', 'utf-8');
      const match = content.match(/nameserver\s+(\d+\.\d+\.\d+\.\d+)/);
      if (match && match[1]) {
        return match[1];
      }
    }

    // Method 2: Use WSL_HOST_IP environment variable if set
    if (process.env['WSL_HOST_IP']) {
      return process.env['WSL_HOST_IP'];
    }

    // Method 3: Try to get from ip route
    const routeOutput = execSync('ip route show default 2>/dev/null', { encoding: 'utf-8' });
    const routeMatch = routeOutput.match(/via\s+(\d+\.\d+\.\d+\.\d+)/);
    if (routeMatch && routeMatch[1]) {
      return routeMatch[1];
    }
  } catch {
    // Ignore errors
  }

  // Fallback to localhost
  return '127.0.0.1';
}

interface OfficeResponse {
  success: boolean;
  message?: string;
  error?: string;
  details?: string;
  [key: string]: unknown;
}

interface HealthResponse extends OfficeResponse {
  status: string;
  version: string;
  apps: {
    word: boolean;
    excel: boolean;
    powerpoint: boolean;
  };
}

interface ScreenshotResponse extends OfficeResponse {
  image?: string;
  format?: string;
  encoding?: string;
}

class OfficeClient {
  private serverProcess: ChildProcess | null = null;
  private host: string = 'localhost';
  private port: number = 8765;
  private serverExePath: string | null = null;
  private isWSL: boolean = false;
  private startupTimeout: number = 10000; // 10 seconds

  constructor() {
    this.isWSL = this.detectWSL();
    this.findServerExe();

    // Use Windows host IP when running from WSL
    if (this.isWSL) {
      this.host = getWindowsHostIP();
    }
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
    // Look for office-server.exe in common locations
    const possiblePaths = [
      // Environment variable (highest priority - user override)
      process.env['OFFICE_SERVER_PATH'] || '',
      // In bin folder (relative to project)
      path.resolve(process.cwd(), 'bin', 'office-server.exe'),
      // In dist folder (build output for development)
      path.resolve(process.cwd(), 'office-server', 'dist', 'office-server.exe'),
    ];

    for (const p of possiblePaths) {
      if (p && fs.existsSync(p)) {
        this.serverExePath = p;
        return;
      }
    }
  }

  /**
   * Get the path to office-server.exe (for display/debugging)
   */
  getServerExePath(): string | null {
    return this.serverExePath;
  }

  /**
   * Convert WSL path to Windows path
   */
  private toWindowsPath(linuxPath: string): string {
    if (!this.isWSL || !linuxPath.startsWith('/')) {
      return linuxPath;
    }

    // /mnt/c/... -> C:\...
    const match = linuxPath.match(/^\/mnt\/([a-z])\/(.*)$/i);
    if (match && match[1] && match[2]) {
      const drive = match[1].toUpperCase();
      const rest = match[2].replace(/\//g, '\\');
      return `${drive}:\\${rest}`;
    }

    return linuxPath;
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
    try {
      const response = await this.request<HealthResponse>('GET', '/health');
      return response.success;
    } catch {
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
   * Start the Office server (Windows .exe)
   */
  async startServer(): Promise<boolean> {
    // Check if already running
    if (await this.isRunning()) {
      return true;
    }

    if (!this.serverExePath) {
      throw new Error(
        'Office server executable not found. ' +
        'Please place office-server.exe in the bin/ folder or set OFFICE_SERVER_PATH environment variable.'
      );
    }

    const windowsExePath = this.toWindowsPath(this.serverExePath);

    return new Promise((resolve, reject) => {
      try {
        let command: string;
        let args: string[];

        if (this.isWSL) {
          // Use cmd.exe to launch the Windows executable from WSL
          command = 'cmd.exe';
          args = ['/C', windowsExePath, '--port', String(this.port)];
        } else {
          // Direct Windows execution
          command = windowsExePath;
          args = ['--port', String(this.port)];
        }

        this.serverProcess = spawn(command, args, {
          detached: true,
          stdio: 'ignore',
          windowsHide: false, // Show the console window for visibility
        });

        this.serverProcess.unref();

        // Wait for server to be ready
        const startTime = Date.now();
        const checkInterval = setInterval(async () => {
          if (await this.isRunning()) {
            clearInterval(checkInterval);
            resolve(true);
          } else if (Date.now() - startTime > this.startupTimeout) {
            clearInterval(checkInterval);
            reject(new Error('Office server startup timeout'));
          }
        }, 500);

        this.serverProcess.on('error', (err) => {
          clearInterval(checkInterval);
          reject(new Error(`Failed to start Office server: ${err.message}`));
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the Office server
   */
  async stopServer(): Promise<boolean> {
    try {
      await this.request('POST', '/shutdown');
      this.serverProcess = null;
      return true;
    } catch {
      // Force kill if graceful shutdown fails
      if (this.serverProcess) {
        this.serverProcess.kill();
        this.serverProcess = null;
      }
      return true;
    }
  }

  /**
   * Make HTTP request to server
   */
  private async request<T extends OfficeResponse>(
    method: 'GET' | 'POST',
    endpoint: string,
    data?: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.getServerUrl()}${endpoint}`;

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (data && method === 'POST') {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    const result = await response.json() as T;

    return result;
  }

  // ===========================================================================
  // Microsoft Word Operations
  // ===========================================================================

  async wordLaunch(): Promise<OfficeResponse> {
    return this.request('POST', '/word/launch');
  }

  async wordCreate(): Promise<OfficeResponse> {
    return this.request('POST', '/word/create');
  }

  async wordWrite(
    text: string,
    options?: { fontName?: string; fontSize?: number; bold?: boolean; italic?: boolean }
  ): Promise<OfficeResponse> {
    const body: Record<string, unknown> = { text };
    if (options?.fontName) body['font_name'] = options.fontName;
    if (options?.fontSize) body['font_size'] = options.fontSize;
    if (options?.bold !== undefined) body['bold'] = options.bold;
    if (options?.italic !== undefined) body['italic'] = options.italic;
    return this.request('POST', '/word/write', body);
  }

  async wordRead(): Promise<OfficeResponse> {
    return this.request('GET', '/word/read');
  }

  async wordSave(filePath?: string): Promise<OfficeResponse> {
    const windowsPath = filePath ? this.toWindowsPath(filePath) : undefined;
    return this.request('POST', '/word/save', windowsPath ? { path: windowsPath } : {});
  }

  async wordScreenshot(): Promise<ScreenshotResponse> {
    return this.request('GET', '/word/screenshot');
  }

  async wordClose(save: boolean = false): Promise<OfficeResponse> {
    return this.request('POST', '/word/close', { save });
  }

  // ===========================================================================
  // Microsoft Excel Operations
  // ===========================================================================

  async excelLaunch(): Promise<OfficeResponse> {
    return this.request('POST', '/excel/launch');
  }

  async excelCreate(): Promise<OfficeResponse> {
    return this.request('POST', '/excel/create');
  }

  async excelWriteCell(cell: string, value: unknown, sheet?: string): Promise<OfficeResponse> {
    return this.request('POST', '/excel/write_cell', { cell, value, sheet });
  }

  async excelReadCell(cell: string, sheet?: string): Promise<OfficeResponse> {
    return this.request('POST', '/excel/read_cell', { cell, sheet });
  }

  async excelWriteRange(startCell: string, values: unknown[][], sheet?: string): Promise<OfficeResponse> {
    return this.request('POST', '/excel/write_range', { start_cell: startCell, values, sheet });
  }

  async excelReadRange(range: string, sheet?: string): Promise<OfficeResponse> {
    return this.request('POST', '/excel/read_range', { range, sheet });
  }

  async excelSave(filePath?: string): Promise<OfficeResponse> {
    const windowsPath = filePath ? this.toWindowsPath(filePath) : undefined;
    return this.request('POST', '/excel/save', windowsPath ? { path: windowsPath } : {});
  }

  async excelScreenshot(): Promise<ScreenshotResponse> {
    return this.request('GET', '/excel/screenshot');
  }

  async excelClose(save: boolean = false): Promise<OfficeResponse> {
    return this.request('POST', '/excel/close', { save });
  }

  // ===========================================================================
  // Microsoft PowerPoint Operations
  // ===========================================================================

  async powerpointLaunch(): Promise<OfficeResponse> {
    return this.request('POST', '/powerpoint/launch');
  }

  async powerpointCreate(): Promise<OfficeResponse> {
    return this.request('POST', '/powerpoint/create');
  }

  async powerpointAddSlide(layout: number = 1): Promise<OfficeResponse> {
    return this.request('POST', '/powerpoint/add_slide', { layout });
  }

  async powerpointWriteText(slideNumber: number, shapeIndex: number, text: string): Promise<OfficeResponse> {
    return this.request('POST', '/powerpoint/write_text', {
      slide: slideNumber,
      shape: shapeIndex,
      text,
    });
  }

  async powerpointReadSlide(slideNumber: number): Promise<OfficeResponse> {
    return this.request('POST', '/powerpoint/read_slide', { slide: slideNumber });
  }

  async powerpointAddTextbox(
    slideNumber: number,
    text: string,
    left: number = 100,
    top: number = 100,
    width: number = 300,
    height: number = 50
  ): Promise<OfficeResponse> {
    return this.request('POST', '/powerpoint/add_textbox', {
      slide: slideNumber,
      left,
      top,
      width,
      height,
      text,
    });
  }

  async powerpointSetFont(
    slideNumber: number,
    shapeIndex: number,
    options: {
      fontName?: string;
      fontSize?: number;
      bold?: boolean;
      italic?: boolean;
      color?: string;
    }
  ): Promise<OfficeResponse> {
    return this.request('POST', '/powerpoint/set_font', {
      slide: slideNumber,
      shape: shapeIndex,
      font_name: options.fontName,
      font_size: options.fontSize,
      bold: options.bold,
      italic: options.italic,
      color: options.color,
    });
  }

  async powerpointAddImage(
    slideNumber: number,
    imagePath: string,
    left: number = 100,
    top: number = 100,
    width?: number,
    height?: number
  ): Promise<OfficeResponse> {
    const windowsPath = this.toWindowsPath(imagePath);
    return this.request('POST', '/powerpoint/add_image', {
      slide: slideNumber,
      path: windowsPath,
      left,
      top,
      width,
      height,
    });
  }

  async powerpointAddAnimation(
    slideNumber: number,
    shapeIndex: number,
    effect: string = 'fade',
    trigger: string = 'on_click'
  ): Promise<OfficeResponse> {
    return this.request('POST', '/powerpoint/add_animation', {
      slide: slideNumber,
      shape: shapeIndex,
      effect,
      trigger,
    });
  }

  async powerpointSetBackground(
    slideNumber: number,
    options: { color?: string; imagePath?: string }
  ): Promise<OfficeResponse> {
    const data: Record<string, unknown> = { slide: slideNumber };
    if (options.color) {
      data['color'] = options.color;
    }
    if (options.imagePath) {
      data['image'] = this.toWindowsPath(options.imagePath);
    }
    return this.request('POST', '/powerpoint/set_background', data);
  }

  async powerpointGetSlideCount(): Promise<OfficeResponse> {
    return this.request('GET', '/powerpoint/get_slide_count');
  }

  async powerpointSave(filePath?: string): Promise<OfficeResponse> {
    const windowsPath = filePath ? this.toWindowsPath(filePath) : undefined;
    return this.request('POST', '/powerpoint/save', windowsPath ? { path: windowsPath } : {});
  }

  async powerpointScreenshot(): Promise<ScreenshotResponse> {
    return this.request('GET', '/powerpoint/screenshot');
  }

  async powerpointClose(save: boolean = false): Promise<OfficeResponse> {
    return this.request('POST', '/powerpoint/close', { save });
  }
}

// Export singleton instance
export const officeClient = new OfficeClient();
export type { OfficeResponse, HealthResponse, ScreenshotResponse };
