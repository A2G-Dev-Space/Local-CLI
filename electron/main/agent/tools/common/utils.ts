/**
 * Tool Utilities for Electron Agent
 *
 * Common utility functions for tool modules
 * Windows Native - No WSL path conversion needed
 */

import * as fs from 'fs';
import * as path from 'path';
import { getScreenshotDir } from './constants';

/**
 * Save screenshot to file
 * @param base64Image Base64 encoded image data
 * @param prefix Filename prefix (e.g., 'word', 'excel', 'powerpoint')
 * @returns Full path to saved file
 */
export async function saveScreenshot(base64Image: string, prefix: string): Promise<string> {
  const screenshotDir = getScreenshotDir();

  // Ensure directory exists
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${prefix}_${timestamp}.png`;
  const filePath = path.join(screenshotDir, filename);

  // Write file
  const buffer = Buffer.from(base64Image, 'base64');
  fs.writeFileSync(filePath, buffer);

  return filePath;
}

/**
 * Format error message
 */
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
