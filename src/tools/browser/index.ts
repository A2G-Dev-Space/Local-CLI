/**
 * Browser Tools Module
 *
 * CDP-based browser automation tools for web testing
 */

export { CDPClient, cdpClient } from './cdp-client.js';
export {
  BROWSER_TOOLS,
  browserLaunchTool,
  browserNavigateTool,
  browserScreenshotTool,
  browserClickTool,
  browserFillTool,
  browserGetTextTool,
  browserCloseTool,
} from './browser-tools.js';
