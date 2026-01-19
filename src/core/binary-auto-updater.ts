/**
 * Binary Detection Utilities
 *
 * Checks if running as a compiled binary (pkg or Bun)
 */

import path from 'path';

/**
 * Check if running as a compiled binary (pkg or Bun)
 */
export function isRunningAsBinary(): boolean {
  // pkg sets process.pkg when running as binary
  if ((process as NodeJS.Process & { pkg?: unknown }).pkg) {
    return true;
  }

  // Bun compiled binary: execPath contains the binary name, not 'node' or 'bun'
  const execName = path.basename(process.execPath);
  if (execName === 'nexus' || execName.startsWith('nexus-')) {
    return true;
  }

  return false;
}
