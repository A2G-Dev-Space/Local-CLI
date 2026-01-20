/**
 * Office Client Base Class for Electron (Windows Native)
 *
 * Optimized for Windows Native environment - no WSL path conversion needed.
 * Uses PowerShell COM automation directly.
 */

import { spawn } from 'child_process';
import * as path from 'path';
import { logger } from '../../logger';

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
  protected commandTimeout = 30000; // 30 seconds default

  /**
   * Resolve path to absolute Windows path
   * Windows Native - simpler than CLI (no WSL conversion needed)
   */
  protected toWindowsPath(inputPath: string): string {
    // Already absolute Windows path
    if (/^[A-Za-z]:/.test(inputPath)) {
      return inputPath;
    }
    // Relative path - resolve from cwd
    return path.resolve(inputPath);
  }

  /**
   * Escape string for PowerShell single-quoted string
   */
  protected escapePsString(str: string): string {
    return str.replace(/'/g, "''");
  }

  /**
   * Convert hex color to RGB object
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

  /**
   * Convert hex color to BGR integer (for Office COM)
   */
  protected hexToBgr(hex: string): number {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return 0;
    return rgb.r + rgb.g * 256 + rgb.b * 65536;
  }

  /**
   * Check if text contains Korean characters
   */
  protected hasKorean(text: string): boolean {
    return /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(text);
  }

  /**
   * Execute PowerShell script and return JSON result
   * Uses spawn for non-blocking execution with UTF-16LE encoding
   */
  protected async executePowerShell(script: string, timeout?: number): Promise<OfficeResponse> {
    return new Promise((resolve) => {
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

      // Use -EncodedCommand for Unicode support (Korean, etc.)
      const encodedCommand = Buffer.from(wrappedScript, 'utf16le').toString('base64');

      const child = spawn('powershell.exe', [
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

      const timeoutMs = timeout || this.commandTimeout;
      const timeoutId = setTimeout(() => {
        child.kill();
        resolve({ success: false, error: `PowerShell execution timed out after ${timeoutMs}ms` });
      }, timeoutMs);

      child.on('close', (code) => {
        clearTimeout(timeoutId);

        if (code !== 0 && !stdout.trim()) {
          logger.debug('[OfficeClientBase] PowerShell error: ' + stderr);
          resolve({ success: false, error: stderr || `PowerShell exited with code ${code}` });
          return;
        }

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
        logger.debug('[OfficeClientBase] PowerShell spawn error: ' + error.message);
        resolve({ success: false, error: error.message });
      });
    });
  }

  /**
   * Check if PowerShell COM automation is available
   */
  async isAvailable(): Promise<boolean> {
    if (process.platform !== 'win32') {
      return false;
    }

    const result = await this.executePowerShell(`
@{
  success = $true
  message = "PowerShell COM available"
} | ConvertTo-Json -Compress
`);
    return result.success;
  }
}
