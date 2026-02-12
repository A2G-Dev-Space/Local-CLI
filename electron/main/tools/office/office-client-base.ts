/**
 * Office Client Base for Electron (Windows Native)
 *
 * Direct PowerShell COM automation base class.
 * This is simpler than CLI since we run natively on Windows - no WSL/COM bridge needed.
 *
 * CLI parity: src/tools/office/office-client-base.ts (structure only, implementation differs for Windows native)
 */

import { spawn } from 'child_process';
import * as path from 'path';
import { logger } from '../../utils/logger';

// =============================================================================
// Types
// =============================================================================

export interface OfficeResponse {
  success: boolean;
  message?: string;
  error?: string;
  details?: string;
  [key: string]: unknown;
}

export interface ScreenshotResponse extends OfficeResponse {
  path?: string;
  image?: string;
  format?: string;
  encoding?: string;
}

// =============================================================================
// Base Office Client
// =============================================================================

export class OfficeClientBase {
  protected commandTimeout = 30000;
  /** COM ProgID for DisplayAlerts auto-suppression (set by subclass) */
  protected comProgId: string = '';

  constructor() {
    // No initialization needed — screenshots saved to getWorkingDirectory() via common/utils.ts
  }

  /**
   * Encode text to Base64 for safe PowerShell transfer (handles Korean characters)
   * PowerShell will decode using: [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($base64))
   */
  protected encodeTextForPowerShell(text: string): string {
    return Buffer.from(text, 'utf8').toString('base64');
  }

  /**
   * Generate PowerShell code to decode Base64 text
   * Use this to safely handle Korean/Unicode text in PowerShell scripts
   */
  protected getPowerShellDecodeExpr(base64Text: string): string {
    return `[System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${base64Text}'))`;
  }

  /**
   * Execute PowerShell script and return JSON result
   * Windows native - direct execution without WSL bridge
   */
  protected async executePowerShell(script: string): Promise<OfficeResponse> {
    return new Promise((resolve) => {
      // Auto-suppress DisplayAlerts if comProgId is set (prevents blocking dialogs)
      // Uses try/finally so DisplayAlerts is restored even when script errors
      let actualScript = script;
      if (this.comProgId) {
        actualScript = `$__comApp = $null
try { $__comApp = [Runtime.InteropServices.Marshal]::GetActiveObject("${this.comProgId}"); $__savedDA = $__comApp.DisplayAlerts; $__comApp.DisplayAlerts = $false } catch {}
try {
${script}
} finally {
  if ($__comApp) { try { $__comApp.DisplayAlerts = $__savedDA } catch {} }
}`;
      }

      const wrappedScript = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"
try {
${actualScript}
} catch {
  @{
    success = $false
    error = $_.Exception.Message
    details = $_.Exception.ToString()
  } | ConvertTo-Json -Compress
}
`;

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

      const timeoutId = setTimeout(() => {
        child.kill();
        resolve({ success: false, error: 'PowerShell execution timed out' });
      }, this.commandTimeout);

      child.on('close', (code) => {
        clearTimeout(timeoutId);

        if (code !== 0 && !stdout.trim()) {
          logger.debug('[OfficeClient] PowerShell error: ' + stderr);
          resolve({ success: false, error: stderr || `PowerShell exited with code ${code}` });
          return;
        }

        const trimmed = stdout.trim();
        if (trimmed) {
          try {
            const parsed = JSON.parse(trimmed);
            resolve(parsed);
          } catch {
            resolve({ success: true, message: trimmed });
          }
        } else {
          resolve({ success: true });
        }
      });

      child.on('error', (error) => {
        clearTimeout(timeoutId);
        logger.debug('[OfficeClient] PowerShell error: ' + error.message);
        resolve({ success: false, error: error.message });
      });
    });
  }

  /**
   * Check if Office is available (Windows native only)
   */
  async isAvailable(): Promise<boolean> {
    if (process.platform !== 'win32') {
      return false;
    }

    const result = await this.executePowerShell(`
@{
  success = $true
  message = "PowerShell available"
} | ConvertTo-Json -Compress
`);
    return result.success;
  }

  /**
   * Convert path (no-op on Windows native, just absolute path)
   */
  protected toWindowsPath(filePath: string): string {
    return path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
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
