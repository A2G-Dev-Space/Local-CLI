/**
 * Tool Constants for Electron Agent
 *
 * Common constants used across all tool modules
 * Windows Native PowerShell based - NO WSL path conversion needed
 */

import { ToolCategory } from './types';
import * as path from 'path';
import { app } from 'electron';

/**
 * Core tool categories (file, powershell, todo, user, docs)
 */
export const CORE_CATEGORIES: ToolCategory[] = ['llm-simple'];

/**
 * Office tool categories
 */
export const OFFICE_CATEGORIES: ToolCategory[] = ['llm-simple'];

/**
 * Browser tool categories
 */
export const BROWSER_CATEGORIES: ToolCategory[] = ['llm-simple'];

/**
 * Screenshot save directory
 */
export function getScreenshotDir(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'screenshots');
}

/**
 * Screenshot path description for tool definitions
 */
export const OFFICE_SCREENSHOT_PATH_DESC = 'AppData/Local-CLI/screenshots/';
