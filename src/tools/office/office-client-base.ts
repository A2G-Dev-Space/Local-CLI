/**
 * Office Client Base Class
 *
 * Common functionality for all Office automation clients.
 * Provides PowerShell execution and WSL path conversion.
 */

import { execSync, spawn } from 'child_process';
import * as os from 'os';
import { logger } from '../../utils/logger.js';
import { findPowerShellPath } from '../../utils/wsl-utils.js';

export interface OfficeResponse {
  success: boolean;
  message?: string;
  error?: string;
  details?: string;
  [key: string]: unknown;
}

export interface ScreenshotResponse extends OfficeResponse {
  image?: string;
  format?: string;
  encoding?: string;
}

export class OfficeClientBase {
  protected isWSL: boolean = false;
  protected powerShellPath: string = '';
  protected commandTimeout: number = 30000; // 30 seconds

  constructor() {
    this.isWSL = this.detectWSL();
    this.powerShellPath = findPowerShellPath();
    logger.debug('[OfficeClientBase] constructor: isWSL = ' + this.isWSL);
    logger.debug('[OfficeClientBase] constructor: PowerShell path = ' + this.powerShellPath);
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
   * Resolve relative path to absolute path
   */
  protected resolvePath(inputPath: string): string {
    // If already absolute, return as-is
    if (inputPath.startsWith('/') || /^[A-Za-z]:/.test(inputPath)) {
      return inputPath;
    }
    // Resolve relative path from current working directory
    const cwd = process.cwd();
    return `${cwd}/${inputPath}`;
  }

  /**
   * Convert WSL path to Windows path
   */
  protected toWindowsPath(linuxPath: string): string {
    // First resolve relative paths
    const resolvedPath = this.resolvePath(linuxPath);

    if (!this.isWSL || !resolvedPath.startsWith('/')) {
      return resolvedPath;
    }

    // /mnt/c/... -> C:\...
    const match = resolvedPath.match(/^\/mnt\/([a-z])\/(.*)$/i);
    if (match && match[1] && match[2]) {
      const drive = match[1].toUpperCase();
      const rest = match[2].replace(/\//g, '\\');
      return `${drive}:\\${rest}`;
    }

    // WSL internal paths (/home/..., /usr/..., etc) -> \\wsl$\<distro>\...
    try {
      const windowsPath = execSync(`wslpath -w "${resolvedPath}"`, { encoding: 'utf-8' }).trim();
      return windowsPath;
    } catch {
      return resolvedPath;
    }
  }

  /**
   * Execute PowerShell script and return JSON result (async, non-blocking)
   */
  protected async executePowerShell(script: string): Promise<OfficeResponse> {
    return new Promise((resolve) => {
      // Wrap script with JSON error handling and UTF-8 output encoding
      const wrappedScript = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"
try {
${script}
} catch {
  @{
    success = $false
    error = $_.Exception.Message
    details = $_.Exception.ToString()
  } | ConvertTo-Json -Compress
}
`;

      logger.debug('[OfficeClientBase] executePowerShell: executing script');

      // Use -EncodedCommand for Unicode support
      const encodedCommand = Buffer.from(wrappedScript, 'utf16le').toString('base64');

      // Use spawn instead of execSync for non-blocking execution
      const child = spawn(this.powerShellPath, [
        '-NoProfile',
        '-NonInteractive',
        '-EncodedCommand',
        encodedCommand,
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString('utf-8');
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString('utf-8');
      });

      // Timeout handling
      const timeoutId = setTimeout(() => {
        child.kill();
        resolve({ success: false, error: 'PowerShell execution timed out' });
      }, this.commandTimeout);

      child.on('close', (code) => {
        clearTimeout(timeoutId);

        if (code !== 0 && !stdout.trim()) {
          logger.debug('[OfficeClientBase] executePowerShell: error - ' + stderr);
          resolve({ success: false, error: stderr || `PowerShell exited with code ${code}` });
          return;
        }

        // Parse JSON output
        const trimmed = stdout.trim();
        if (trimmed) {
          try {
            const parsed = JSON.parse(trimmed);
            resolve(parsed);
          } catch {
            // If not JSON, treat as success message
            resolve({ success: true, message: trimmed });
          }
        } else {
          resolve({ success: true });
        }
      });

      child.on('error', (error) => {
        clearTimeout(timeoutId);
        logger.debug('[OfficeClientBase] executePowerShell: error - ' + error.message);
        resolve({ success: false, error: error.message });
      });
    });
  }

  /**
   * Check if Office COM is available (PowerShell can run)
   */
  async isAvailable(): Promise<boolean> {
    try {
      const result = await this.executePowerShell(`
@{
  success = $true
  message = "PowerShell COM available"
} | ConvertTo-Json -Compress
`);
      return result.success;
    } catch {
      return false;
    }
  }

  /**
   * Convert hex color to RGB
   */
  protected hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result || !result[1] || !result[2] || !result[3]) return null;
    return {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    };
  }
}
