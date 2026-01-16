/**
 * Browser Tools Module
 *
 * Browser automation tools using CDP (Chrome DevTools Protocol)
 * PowerShell로 브라우저를 시작하고 Playwright로 제어합니다.
 * server.exe 없이 동작합니다.
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
 * Start browser server (for compatibility)
 * CDP 방식에서는 별도 서버가 필요 없음
 */
export async function startBrowserServer(): Promise<boolean> {
  // CDP 방식에서는 launch()가 호출될 때 브라우저가 시작됨
  return true;
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
 * Check if browser tools are available
 * CDP 방식에서는 항상 사용 가능 (Chrome/Edge가 설치되어 있으면)
 */
export function isBrowserServerAvailable(): boolean {
  // CDP 방식에서는 server.exe가 필요 없으므로 항상 true
  // 실제 브라우저 유무는 launch 시 확인됨
  return true;
}
