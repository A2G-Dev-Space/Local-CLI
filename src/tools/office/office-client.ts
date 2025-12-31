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
import { logger } from '../../utils/logger.js';

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
    logger.debug('[OfficeClient] constructor: isWSL = ' + this.isWSL);
    this.findServerExe();

    // Use Windows host IP when running from WSL
    if (this.isWSL) {
      this.host = getWindowsHostIP();
      logger.debug('[OfficeClient] constructor: Windows host IP = ' + this.host);
    }
    logger.debug('[OfficeClient] constructor: server URL = ' + this.getServerUrl());
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

    logger.debug('[OfficeClient] findServerExe: checking paths', possiblePaths);
    for (const p of possiblePaths) {
      if (p && fs.existsSync(p)) {
        this.serverExePath = p;
        logger.debug('[OfficeClient] findServerExe: found at ' + p);
        return;
      }
    }
    logger.debug('[OfficeClient] findServerExe: not found in any location');
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

    // WSL internal paths (/home/..., /usr/..., etc) -> \\wsl$\<distro>\...
    // Use wslpath command to convert
    try {
      const windowsPath = execSync(`wslpath -w "${linuxPath}"`, { encoding: 'utf-8' }).trim();
      logger.debug('[OfficeClient] toWindowsPath: converted ' + linuxPath + ' -> ' + windowsPath);
      return windowsPath;
    } catch (error) {
      logger.debug('[OfficeClient] toWindowsPath: wslpath failed, returning original path');
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
    logger.debug('[OfficeClient] isRunning: checking server at ' + this.getServerUrl());
    try {
      const response = await this.request<HealthResponse>('GET', '/health');
      logger.debug('[OfficeClient] isRunning: response', response);
      return response.success;
    } catch (error) {
      logger.debug('[OfficeClient] isRunning: failed - ' + (error instanceof Error ? error.message : String(error)));
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
   * Kill existing office-server processes (cleanup zombie processes)
   */
  private killExistingServer(): void {
    logger.debug('[OfficeClient] killExistingServer: isWSL = ' + this.isWSL);
    if (this.isWSL) {
      try {
        logger.debug('[OfficeClient] killExistingServer: executing powershell kill command');
        execSync('powershell.exe -Command "Get-Process office-server -ErrorAction SilentlyContinue | Stop-Process -Force"', {
          stdio: 'ignore',
          timeout: 5000,
        });
        logger.debug('[OfficeClient] killExistingServer: kill command completed');
      } catch (error) {
        logger.debug('[OfficeClient] killExistingServer: kill failed (may not exist) - ' + (error instanceof Error ? error.message : String(error)));
      }
    }
  }

  /**
   * Start the Office server (Windows .exe)
   */
  async startServer(): Promise<boolean> {
    logger.debug('[OfficeClient] startServer: beginning startup sequence');

    // Check if already running and responsive
    logger.debug('[OfficeClient] startServer: checking if already running');
    if (await this.isRunning()) {
      logger.debug('[OfficeClient] startServer: server already running');
      return true;
    }

    // Kill any zombie processes that might be holding the port
    logger.debug('[OfficeClient] startServer: killing zombie processes');
    this.killExistingServer();

    // Wait a bit for port to be released
    logger.debug('[OfficeClient] startServer: waiting 1s for port release');
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (!this.serverExePath) {
      logger.debug('[OfficeClient] startServer: exe not found');
      throw new Error(
        'Office server executable not found. ' +
        'Please place office-server.exe in the bin/ folder or set OFFICE_SERVER_PATH environment variable.'
      );
    }

    const windowsExePath = this.toWindowsPath(this.serverExePath);
    logger.debug('[OfficeClient] startServer: exe path = ' + windowsExePath);

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

        logger.debug('[OfficeClient] startServer: spawning ' + command + ' ' + args.join(' '));
        this.serverProcess = spawn(command, args, {
          detached: true,
          stdio: 'ignore',
          windowsHide: false, // Show the console window for visibility
        });

        this.serverProcess.unref();
        logger.debug('[OfficeClient] startServer: process spawned, waiting for ready');

        // Wait for server to be ready
        const startTime = Date.now();
        const checkInterval = setInterval(async () => {
          const elapsed = Date.now() - startTime;
          logger.debug('[OfficeClient] startServer: checking ready, elapsed = ' + elapsed + ' ms');
          if (await this.isRunning()) {
            clearInterval(checkInterval);
            logger.debug('[OfficeClient] startServer: server ready');
            resolve(true);
          } else if (elapsed > this.startupTimeout) {
            clearInterval(checkInterval);
            logger.debug('[OfficeClient] startServer: timeout after ' + elapsed + ' ms');
            reject(new Error('Office server startup timeout'));
          }
        }, 500);

        this.serverProcess.on('error', (err) => {
          logger.debug('[OfficeClient] startServer: process error - ' + err.message);
          clearInterval(checkInterval);
          reject(new Error(`Failed to start Office server: ${err.message}`));
        });
      } catch (error) {
        logger.debug('[OfficeClient] startServer: caught error - ' + (error instanceof Error ? error.message : String(error)));
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
   * Make HTTP request to server with timeout
   */
  private async request<T extends OfficeResponse>(
    method: 'GET' | 'POST',
    endpoint: string,
    data?: Record<string, unknown>,
    timeoutMs: number = 5000
  ): Promise<T> {
    const url = `${this.getServerUrl()}${endpoint}`;
    logger.debug(`[OfficeClient] request: ${method} ${url} timeout = ${timeoutMs} ms`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      logger.debug('[OfficeClient] request: timeout triggered for ' + url);
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
      logger.debug('[OfficeClient] request: body', options.body);
    }

    try {
      logger.debug('[OfficeClient] request: fetching...');
      const response = await fetch(url, options);
      clearTimeout(timeoutId);
      logger.debug('[OfficeClient] request: response status = ' + response.status);
      const result = await response.json() as T;
      logger.debug('[OfficeClient] request: result', JSON.stringify(result).substring(0, 200));
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.debug('[OfficeClient] request: error - ' + errorMsg);
      throw error;
    }
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

  async wordSetFont(
    options: {
      fontName?: string;
      fontSize?: number;
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
      color?: string;
      highlightColor?: string;
    }
  ): Promise<OfficeResponse> {
    return this.request('POST', '/word/set_font', {
      font_name: options.fontName,
      font_size: options.fontSize,
      bold: options.bold,
      italic: options.italic,
      underline: options.underline,
      color: options.color,
      highlight_color: options.highlightColor,
    });
  }

  async wordSetParagraph(
    options: {
      alignment?: 'left' | 'center' | 'right' | 'justify';
      lineSpacing?: number;
      spaceBefore?: number;
      spaceAfter?: number;
      firstLineIndent?: number;
    }
  ): Promise<OfficeResponse> {
    return this.request('POST', '/word/set_paragraph', {
      alignment: options.alignment,
      line_spacing: options.lineSpacing,
      space_before: options.spaceBefore,
      space_after: options.spaceAfter,
      first_line_indent: options.firstLineIndent,
    });
  }

  async wordAddHyperlink(text: string, url: string): Promise<OfficeResponse> {
    return this.request('POST', '/word/add_hyperlink', { text, url });
  }

  async wordAddTable(rows: number, cols: number, data?: string[][]): Promise<OfficeResponse> {
    return this.request('POST', '/word/add_table', { rows, cols, values: data });
  }

  async wordAddImage(imagePath: string, width?: number, height?: number): Promise<OfficeResponse> {
    const windowsPath = this.toWindowsPath(imagePath);
    return this.request('POST', '/word/add_image', { path: windowsPath, width, height });
  }

  async wordDeleteText(start: number, end: number): Promise<OfficeResponse> {
    return this.request('POST', '/word/delete_text', { start, end });
  }

  async wordFindReplace(find: string, replace: string, replaceAll: boolean = true): Promise<OfficeResponse> {
    return this.request('POST', '/word/find_replace', { find, replace, replace_all: replaceAll });
  }

  async wordSetStyle(styleName: string): Promise<OfficeResponse> {
    return this.request('POST', '/word/set_style', { style: styleName });
  }

  async wordInsertBreak(breakType: 'page' | 'line' | 'section' = 'page'): Promise<OfficeResponse> {
    return this.request('POST', '/word/insert_break', { break_type: breakType });
  }

  async wordGetSelection(): Promise<OfficeResponse> {
    return this.request('GET', '/word/get_selection');
  }

  async wordSelectAll(): Promise<OfficeResponse> {
    return this.request('POST', '/word/select_all');
  }

  async wordGoto(what: 'page' | 'line' | 'bookmark', target: number | string): Promise<OfficeResponse> {
    return this.request('POST', '/word/goto', { what, target });
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

  async excelWriteCell(
    cell: string,
    value: unknown,
    sheet?: string,
    options?: { fontName?: string; fontSize?: number; bold?: boolean }
  ): Promise<OfficeResponse> {
    const body: Record<string, unknown> = { cell, value, sheet };
    if (options?.fontName) body['font_name'] = options.fontName;
    if (options?.fontSize) body['font_size'] = options.fontSize;
    if (options?.bold !== undefined) body['bold'] = options.bold;
    return this.request('POST', '/excel/write_cell', body);
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

  async excelSetFormula(cell: string, formula: string, sheet?: string): Promise<OfficeResponse> {
    return this.request('POST', '/excel/set_formula', { cell, formula, sheet });
  }

  async excelSetFont(
    range: string,
    options: {
      fontName?: string;
      fontSize?: number;
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
      color?: string;
    },
    sheet?: string
  ): Promise<OfficeResponse> {
    return this.request('POST', '/excel/set_font', {
      range,
      font_name: options.fontName,
      font_size: options.fontSize,
      bold: options.bold,
      italic: options.italic,
      underline: options.underline,
      color: options.color,
      sheet,
    });
  }

  async excelSetAlignment(
    range: string,
    options: {
      horizontal?: 'left' | 'center' | 'right';
      vertical?: 'top' | 'center' | 'bottom';
      wrapText?: boolean;
      orientation?: number;
    },
    sheet?: string
  ): Promise<OfficeResponse> {
    return this.request('POST', '/excel/set_alignment', {
      range,
      horizontal: options.horizontal,
      vertical: options.vertical,
      wrap_text: options.wrapText,
      orientation: options.orientation,
      sheet,
    });
  }

  async excelSetColumnWidth(column: string, width?: number, autoFit?: boolean, sheet?: string): Promise<OfficeResponse> {
    return this.request('POST', '/excel/set_column_width', { column, width, auto_fit: autoFit, sheet });
  }

  async excelSetRowHeight(row: number, height?: number, autoFit?: boolean, sheet?: string): Promise<OfficeResponse> {
    return this.request('POST', '/excel/set_row_height', { row, height, auto_fit: autoFit, sheet });
  }

  async excelMergeCells(range: string, sheet?: string): Promise<OfficeResponse> {
    return this.request('POST', '/excel/merge_cells', { range, sheet });
  }

  async excelSetBorder(
    range: string,
    options: {
      style?: 'thin' | 'medium' | 'thick' | 'double' | 'dotted' | 'dashed';
      color?: string;
      edges?: ('left' | 'right' | 'top' | 'bottom' | 'all')[];
    },
    sheet?: string
  ): Promise<OfficeResponse> {
    return this.request('POST', '/excel/set_border', {
      range,
      style: options.style,
      color: options.color,
      edges: options.edges,
      sheet,
    });
  }

  async excelSetFill(range: string, color: string, sheet?: string): Promise<OfficeResponse> {
    return this.request('POST', '/excel/set_fill', { range, color, sheet });
  }

  async excelSetNumberFormat(range: string, format: string, sheet?: string): Promise<OfficeResponse> {
    return this.request('POST', '/excel/set_number_format', { range, format, sheet });
  }

  async excelAddSheet(name?: string, position?: 'start' | 'end' | string): Promise<OfficeResponse> {
    return this.request('POST', '/excel/add_sheet', { name, position });
  }

  async excelDeleteSheet(name: string): Promise<OfficeResponse> {
    return this.request('POST', '/excel/delete_sheet', { name });
  }

  async excelRenameSheet(oldName: string, newName: string): Promise<OfficeResponse> {
    return this.request('POST', '/excel/rename_sheet', { old_name: oldName, new_name: newName });
  }

  async excelGetSheets(): Promise<OfficeResponse> {
    return this.request('GET', '/excel/get_sheets');
  }

  async excelSortRange(
    range: string,
    sortColumn: string,
    ascending: boolean = true,
    hasHeader: boolean = true,
    sheet?: string
  ): Promise<OfficeResponse> {
    return this.request('POST', '/excel/sort_range', {
      range,
      sort_column: sortColumn,
      ascending,
      has_header: hasHeader,
      sheet,
    });
  }

  async excelInsertRow(row: number, count: number = 1, sheet?: string): Promise<OfficeResponse> {
    return this.request('POST', '/excel/insert_row', { row, count, sheet });
  }

  async excelDeleteRow(row: number, count: number = 1, sheet?: string): Promise<OfficeResponse> {
    return this.request('POST', '/excel/delete_row', { row, count, sheet });
  }

  async excelInsertColumn(column: string, count: number = 1, sheet?: string): Promise<OfficeResponse> {
    return this.request('POST', '/excel/insert_column', { column, count, sheet });
  }

  async excelDeleteColumn(column: string, count: number = 1, sheet?: string): Promise<OfficeResponse> {
    return this.request('POST', '/excel/delete_column', { column, count, sheet });
  }

  async excelFreezePanes(row?: number, column?: string, sheet?: string): Promise<OfficeResponse> {
    return this.request('POST', '/excel/freeze_panes', { row, column, sheet });
  }

  async excelAutoFilter(range: string, sheet?: string): Promise<OfficeResponse> {
    return this.request('POST', '/excel/auto_filter', { range, sheet });
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

  async powerpointWriteText(
    slideNumber: number,
    shapeIndex: number,
    text: string,
    options?: { fontName?: string; fontSize?: number; bold?: boolean }
  ): Promise<OfficeResponse> {
    const body: Record<string, unknown> = {
      slide: slideNumber,
      shape: shapeIndex,
      text,
    };
    if (options?.fontName) body['font_name'] = options.fontName;
    if (options?.fontSize) body['font_size'] = options.fontSize;
    if (options?.bold !== undefined) body['bold'] = options.bold;
    return this.request('POST', '/powerpoint/write_text', body);
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
