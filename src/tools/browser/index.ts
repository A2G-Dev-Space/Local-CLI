/**
 * Browser Tools Module
 *
 * Browser automation tools using browser-server.exe (HTTP API)
 * Similar pattern to office tools
 */

import { browserClient } from './browser-client.js';

export { browserClient } from './browser-client.js';
export type {
  BrowserResponse,
  HealthResponse,
  ScreenshotResponse,
  NavigateResponse,
  PageInfoResponse,
  ConsoleResponse,
  NetworkResponse,
} from './browser-client.js';
export {
  BROWSER_TOOLS,
  browserLaunchTool,
  browserNavigateTool,
  browserScreenshotTool,
  browserClickTool,
  browserFillTool,
  browserGetTextTool,
  browserGetContentTool,
  browserGetConsoleTool,
  browserGetNetworkTool,
  browserFocusTool,
  browserCloseTool,
} from './browser-tools.js';

/**
 * Start browser server
 * Called when browser tool group is enabled
 */
export async function startBrowserServer(): Promise<boolean> {
  try {
    return await browserClient.startServer();
  } catch {
    return false;
  }
}

/**
 * Shutdown browser server
 * Called when browser tool group is disabled
 */
export async function shutdownBrowserServer(): Promise<void> {
  try {
    await browserClient.stopServer();
  } catch {
    // Ignore errors
  }
}

/**
 * Check if browser-server.exe is available
 */
export function isBrowserServerAvailable(): boolean {
  return browserClient.getServerExePath() !== null;
}
