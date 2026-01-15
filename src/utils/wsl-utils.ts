/**
 * WSL Utilities
 *
 * Common utilities for WSL (Windows Subsystem for Linux) environment
 */

import { execSync } from 'child_process';
import * as fs from 'fs';

/**
 * Find powershell.exe path for WSL
 * Tries multiple locations since PATH may not include Windows System32
 */
export function findPowerShellPath(): string {
  const possiblePaths = [
    'powershell.exe', // Try PATH first
    '/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',
    '/mnt/c/WINDOWS/System32/WindowsPowerShell/v1.0/powershell.exe',
    '/mnt/c/windows/system32/WindowsPowerShell/v1.0/powershell.exe',
  ];

  for (const psPath of possiblePaths) {
    try {
      if (psPath === 'powershell.exe') {
        // Check if powershell.exe is accessible by running a simple command
        execSync('powershell.exe -Command "1" 2>/dev/null', { encoding: 'utf-8', timeout: 5000 });
        return psPath;
      } else if (fs.existsSync(psPath)) {
        return psPath;
      }
    } catch {
      // Continue to next path
    }
  }

  // Fallback to powershell.exe and let the spawn error provide details
  return 'powershell.exe';
}
