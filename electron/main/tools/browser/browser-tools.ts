/**
 * Browser Tool Definitions for Electron (Windows Native)
 *
 * CDP-based browser automation tools
 * Total: 18 tools
 */

import { ToolDefinition } from '../../core';
import { LLMSimpleTool, ToolResult, BROWSER_CATEGORIES } from '../types';
import { browserClient } from './browser-client';
import { logger } from '../../utils/logger';

/**
 * Delay execution for specified milliseconds
 * @param ms - Milliseconds to wait
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Standard delay for browser launch/navigate operations (3 seconds)
 */
const BROWSER_LAUNCH_DELAY_MS = 3000;

// =============================================================================
// Browser Launch
// =============================================================================

const BROWSER_LAUNCH_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'browser_launch',
    description: `Launch Chrome or Edge browser for web automation.
Uses Chrome DevTools Protocol (CDP) for control.
If browser is already running, returns existing session.

IMPORTANT: For visual testing or when user needs to see the browser, use headless: false (default).
Only use headless: true when explicitly requested by the user.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are launching browser' },
        browser: {
          type: 'string',
          enum: ['chrome', 'edge'],
          description: 'Browser to launch (default: chrome, falls back to edge if not available)',
        },
        headless: { type: 'boolean', description: 'Run in headless mode WITHOUT visible window (default: false). Set to false to see the browser window.' },
      },
      required: ['reason'],
    },
  },
};

async function executeBrowserLaunch(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('browser_launch', args);
  try {
    const response = await browserClient.launch({
      browser: args['browser'] as 'chrome' | 'edge' | undefined,
      headless: args['headless'] as boolean | undefined,
    });
    if (response.success) {
      // Wait for browser to fully load before LLM proceeds
      await delay(BROWSER_LAUNCH_DELAY_MS);
      logger.toolSuccess('browser_launch', args, { message: response.message }, Date.now() - startTime);
      return { success: true, result: response.message || 'Browser launched' };
    }
    logger.toolError('browser_launch', args, new Error(response.error || 'Failed to launch browser'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to launch browser' };
  } catch (error) {
    logger.toolError('browser_launch', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to launch browser: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const browserLaunchTool: LLMSimpleTool = {
  definition: BROWSER_LAUNCH_DEFINITION,
  execute: executeBrowserLaunch,
  categories: BROWSER_CATEGORIES,
  description: 'Launch Chrome/Edge browser',
};

// =============================================================================
// Browser Close
// =============================================================================

const BROWSER_CLOSE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'browser_close',
    description: `Close the browser and end the automation session.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are closing browser' },
      },
      required: ['reason'],
    },
  },
};

async function executeBrowserClose(_args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('browser_close', _args);
  try {
    const response = await browserClient.close();
    if (response.success) {
      logger.toolSuccess('browser_close', _args, { message: response.message }, Date.now() - startTime);
      return { success: true, result: response.message || 'Browser closed' };
    }
    logger.toolError('browser_close', _args, new Error(response.error || 'Failed to close browser'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to close browser' };
  } catch (error) {
    logger.toolError('browser_close', _args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to close browser: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const browserCloseTool: LLMSimpleTool = {
  definition: BROWSER_CLOSE_DEFINITION,
  execute: executeBrowserClose,
  categories: BROWSER_CATEGORIES,
  description: 'Close browser',
};

// =============================================================================
// Browser Navigate
// =============================================================================

const BROWSER_NAVIGATE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'browser_navigate',
    description: `Navigate to a URL in the browser. Waits for page load to complete.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are navigating' },
        url: { type: 'string', description: 'URL to navigate to (must include http:// or https://)' },
      },
      required: ['reason', 'url'],
    },
  },
};

async function executeBrowserNavigate(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('browser_navigate', args);
  try {
    const response = await browserClient.navigate(args['url'] as string);
    if (response.success) {
      // Wait for page to fully load before LLM proceeds
      await delay(BROWSER_LAUNCH_DELAY_MS);
      logger.toolSuccess('browser_navigate', args, { url: response['url'], title: response['title'] }, Date.now() - startTime);
      return { success: true, result: `Navigated to: ${response['url']} - ${response['title']}` };
    }
    logger.toolError('browser_navigate', args, new Error(response.error || 'Failed to navigate'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to navigate' };
  } catch (error) {
    logger.toolError('browser_navigate', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to navigate: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const browserNavigateTool: LLMSimpleTool = {
  definition: BROWSER_NAVIGATE_DEFINITION,
  execute: executeBrowserNavigate,
  categories: BROWSER_CATEGORIES,
  description: 'Navigate to URL',
};

// =============================================================================
// Browser Click
// =============================================================================

const BROWSER_CLICK_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'browser_click',
    description: `Click an element on the page using CSS selector.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are clicking' },
        selector: { type: 'string', description: 'CSS selector of element to click (e.g., "#submit-btn", ".login-button")' },
      },
      required: ['reason', 'selector'],
    },
  },
};

async function executeBrowserClick(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('browser_click', args);
  try {
    const response = await browserClient.click(args['selector'] as string);
    if (response.success) {
      logger.toolSuccess('browser_click', args, { selector: args['selector'] }, Date.now() - startTime);
      return { success: true, result: `Clicked element: ${args['selector']}` };
    }
    logger.toolError('browser_click', args, new Error(response.error || 'Failed to click element'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to click element' };
  } catch (error) {
    logger.toolError('browser_click', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to click: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const browserClickTool: LLMSimpleTool = {
  definition: BROWSER_CLICK_DEFINITION,
  execute: executeBrowserClick,
  categories: BROWSER_CATEGORIES,
  description: 'Click element',
};

// =============================================================================
// Browser Type
// =============================================================================

const BROWSER_TYPE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'browser_type',
    description: `Type text into an input field or textarea.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are typing' },
        selector: { type: 'string', description: 'CSS selector of input element' },
        text: { type: 'string', description: 'Text to type into the element' },
        clear: { type: 'boolean', description: 'Clear existing text before typing (default: true)' },
      },
      required: ['reason', 'selector', 'text'],
    },
  },
};

async function executeBrowserType(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('browser_type', { selector: args['selector'], textLength: (args['text'] as string)?.length });
  try {
    const response = await browserClient.type(
      args['selector'] as string,
      args['text'] as string,
      args['clear'] !== false
    );
    if (response.success) {
      logger.toolSuccess('browser_type', { selector: args['selector'] }, { typed: true }, Date.now() - startTime);
      return { success: true, result: `Typed text into: ${args['selector']}` };
    }
    logger.toolError('browser_type', args, new Error(response.error || 'Failed to type text'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to type text' };
  } catch (error) {
    logger.toolError('browser_type', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to type: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const browserTypeTool: LLMSimpleTool = {
  definition: BROWSER_TYPE_DEFINITION,
  execute: executeBrowserType,
  categories: BROWSER_CATEGORIES,
  description: 'Type text into element',
};

// =============================================================================
// Browser Screenshot
// =============================================================================

const BROWSER_SCREENSHOT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'browser_screenshot',
    description: `Take a screenshot of the current browser page.
Returns a base64-encoded PNG image that you can analyze to understand the page state.
Screenshots are saved to the current working directory.
Use this to verify that pages loaded correctly or to check UI elements.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are taking screenshot' },
        full_page: { type: 'boolean', description: 'Capture full scrollable page (default: false)' },
      },
      required: ['reason'],
    },
  },
};

async function executeBrowserScreenshot(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('browser_screenshot', args);
  try {
    const response = await browserClient.screenshot(args['full_page'] === true);
    if (response.success) {
      const filepath = response['filepath'] as string;
      logger.toolSuccess('browser_screenshot', args, { filepath }, Date.now() - startTime);
      return {
        success: true,
        result: `Screenshot captured${response['title'] ? ` of "${response['title']}"` : ''}${response['url'] ? ` (${response['url']})` : ''}\nSaved to: ${filepath}\n\nTo verify this screenshot, call read_image with file_path="${filepath}"`,
        metadata: {
          image: response['image'] as string,
          imageType: 'image/png',
          encoding: 'base64',
          url: response['url'] as string,
          title: response['title'] as string,
          savedPath: filepath,
        },
      };
    }
    logger.toolError('browser_screenshot', args, new Error(response.error || 'Failed to take screenshot'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to take screenshot' };
  } catch (error) {
    logger.toolError('browser_screenshot', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to screenshot: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const browserScreenshotTool: LLMSimpleTool = {
  definition: BROWSER_SCREENSHOT_DEFINITION,
  execute: executeBrowserScreenshot,
  categories: BROWSER_CATEGORIES,
  description: 'Take page screenshot',
};

// =============================================================================
// Browser Get HTML
// =============================================================================

const BROWSER_GET_HTML_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'browser_get_html',
    description: `Get the HTML content of the current page or a specific element.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you need the HTML' },
        selector: { type: 'string', description: 'CSS selector to get HTML of specific element (optional, gets full page if not provided)' },
      },
      required: ['reason'],
    },
  },
};

async function executeBrowserGetHtml(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('browser_get_html', args);
  try {
    const response = await browserClient.getHtml(args['selector'] as string | undefined);
    if (response.success) {
      const html = response['html'] as string;
      const truncated = html.length > 10000 ? html.slice(0, 10000) + '\n... (truncated)' : html;
      logger.toolSuccess('browser_get_html', args, { htmlLength: html.length }, Date.now() - startTime);
      return { success: true, result: truncated };
    }
    logger.toolError('browser_get_html', args, new Error(response.error || 'Failed to get HTML'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to get HTML' };
  } catch (error) {
    logger.toolError('browser_get_html', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to get HTML: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const browserGetHtmlTool: LLMSimpleTool = {
  definition: BROWSER_GET_HTML_DEFINITION,
  execute: executeBrowserGetHtml,
  categories: BROWSER_CATEGORIES,
  description: 'Get page HTML',
};

// =============================================================================
// Browser Wait
// =============================================================================

const BROWSER_WAIT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'browser_wait',
    description: `Wait for an element to appear or for a specified time.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are waiting' },
        selector: { type: 'string', description: 'CSS selector to wait for (optional)' },
        timeout: { type: 'number', description: 'Timeout in seconds (default: 10)' },
      },
      required: ['reason'],
    },
  },
};

async function executeBrowserWait(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('browser_wait', args);
  try {
    const response = await browserClient.waitFor(
      args['selector'] as string | undefined,
      args['timeout'] as number | undefined
    );
    if (response.success) {
      logger.toolSuccess('browser_wait', args, { message: response.message }, Date.now() - startTime);
      return { success: true, result: response.message || 'Wait completed' };
    }
    logger.toolError('browser_wait', args, new Error(response.error || 'Wait failed'), Date.now() - startTime);
    return { success: false, error: response.error || 'Wait failed' };
  } catch (error) {
    logger.toolError('browser_wait', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Wait failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const browserWaitTool: LLMSimpleTool = {
  definition: BROWSER_WAIT_DEFINITION,
  execute: executeBrowserWait,
  categories: BROWSER_CATEGORIES,
  description: 'Wait for element or time',
};

// =============================================================================
// Browser Connect
// =============================================================================

const BROWSER_CONNECT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'browser_connect',
    description: `Connect to an existing browser that has remote debugging enabled.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are connecting' },
        port: { type: 'number', description: 'CDP port to connect to (default: 9222)' },
      },
      required: ['reason'],
    },
  },
};

async function executeBrowserConnect(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('browser_connect', args);
  try {
    const response = await browserClient.connect(args['port'] as number | undefined);
    if (response.success) {
      logger.toolSuccess('browser_connect', args, { url: response['url'] }, Date.now() - startTime);
      return { success: true, result: `Connected to browser at ${response['url']}` };
    }
    logger.toolError('browser_connect', args, new Error(response.error || 'Failed to connect'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to connect' };
  } catch (error) {
    logger.toolError('browser_connect', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to connect: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const browserConnectTool: LLMSimpleTool = {
  definition: BROWSER_CONNECT_DEFINITION,
  execute: executeBrowserConnect,
  categories: BROWSER_CATEGORIES,
  description: 'Connect to existing browser',
};

// =============================================================================
// Browser Execute Script
// =============================================================================

const BROWSER_EXECUTE_SCRIPT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'browser_execute_script',
    description: `Execute JavaScript code in the browser context.
The script is automatically wrapped in an async function, so you can use 'return' statements and 'await'.
Examples:
- "return document.title;" - returns page title
- "return 1 + 1;" - returns 2
- "document.body.style.background = 'red';" - changes background (returns undefined)
- "return await fetch('/api').then(r => r.json());" - async fetch`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are executing script' },
        script: { type: 'string', description: 'JavaScript code to execute (can use return and await)' },
      },
      required: ['reason', 'script'],
    },
  },
};

async function executeBrowserExecuteScript(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('browser_execute_script', { scriptLength: (args['script'] as string)?.length });
  try {
    const response = await browserClient.executeScript(args['script'] as string);
    if (response.success) {
      logger.toolSuccess('browser_execute_script', { scriptLength: (args['script'] as string)?.length }, { hasResult: !!response['result'] }, Date.now() - startTime);
      return { success: true, result: JSON.stringify(response['result'], null, 2) };
    }
    logger.toolError('browser_execute_script', args, new Error(response.error || 'Script execution failed'), Date.now() - startTime);
    return { success: false, error: response.error || 'Script execution failed' };
  } catch (error) {
    logger.toolError('browser_execute_script', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Script failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const browserExecuteScriptTool: LLMSimpleTool = {
  definition: BROWSER_EXECUTE_SCRIPT_DEFINITION,
  execute: executeBrowserExecuteScript,
  categories: BROWSER_CATEGORIES,
  description: 'Execute JavaScript',
};

// =============================================================================
// Browser Fill (alias for type with clear=true)
// =============================================================================

const BROWSER_FILL_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'browser_fill',
    description: `Fill a form field with text (clears existing content first).`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are filling the field' },
        selector: { type: 'string', description: 'CSS selector of input element' },
        value: { type: 'string', description: 'Value to fill in the field' },
      },
      required: ['reason', 'selector', 'value'],
    },
  },
};

async function executeBrowserFill(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('browser_fill', { selector: args['selector'], valueLength: (args['value'] as string)?.length });
  try {
    const response = await browserClient.fill(args['selector'] as string, args['value'] as string);
    if (response.success) {
      logger.toolSuccess('browser_fill', { selector: args['selector'] }, { filled: true }, Date.now() - startTime);
      return { success: true, result: `Filled field: ${args['selector']}` };
    }
    logger.toolError('browser_fill', args, new Error(response.error || 'Failed to fill field'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to fill field' };
  } catch (error) {
    logger.toolError('browser_fill', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to fill: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const browserFillTool: LLMSimpleTool = {
  definition: BROWSER_FILL_DEFINITION,
  execute: executeBrowserFill,
  categories: BROWSER_CATEGORIES,
  description: 'Fill form field',
};

// =============================================================================
// Browser Focus
// =============================================================================

const BROWSER_FOCUS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'browser_focus',
    description: `Focus on an element.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are focusing' },
        selector: { type: 'string', description: 'CSS selector of element to focus' },
      },
      required: ['reason', 'selector'],
    },
  },
};

async function executeBrowserFocus(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('browser_focus', args);
  try {
    const response = await browserClient.focus(args['selector'] as string);
    if (response.success) {
      logger.toolSuccess('browser_focus', args, { selector: args['selector'] }, Date.now() - startTime);
      return { success: true, result: `Focused element: ${args['selector']}` };
    }
    logger.toolError('browser_focus', args, new Error(response.error || 'Failed to focus element'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to focus element' };
  } catch (error) {
    logger.toolError('browser_focus', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to focus: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const browserFocusTool: LLMSimpleTool = {
  definition: BROWSER_FOCUS_DEFINITION,
  execute: executeBrowserFocus,
  categories: BROWSER_CATEGORIES,
  description: 'Focus element',
};

// =============================================================================
// Browser Get Console
// =============================================================================

const BROWSER_GET_CONSOLE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'browser_get_console',
    description: `Enable console logging. Use executeScript to check console output.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you need console logs' },
      },
      required: ['reason'],
    },
  },
};

async function executeBrowserGetConsole(_args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('browser_get_console', _args);
  try {
    const response = await browserClient.getConsole();
    if (response.success) {
      logger.toolSuccess('browser_get_console', _args, { message: response.message }, Date.now() - startTime);
      return { success: true, result: response.message || 'Console logging enabled' };
    }
    logger.toolError('browser_get_console', _args, new Error(response.error || 'Failed to enable console'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to enable console' };
  } catch (error) {
    logger.toolError('browser_get_console', _args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const browserGetConsoleTool: LLMSimpleTool = {
  definition: BROWSER_GET_CONSOLE_DEFINITION,
  execute: executeBrowserGetConsole,
  categories: BROWSER_CATEGORIES,
  description: 'Enable console logging',
};

// =============================================================================
// Browser Get Health
// =============================================================================

const BROWSER_GET_HEALTH_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'browser_get_health',
    description: `Check browser connection health and status.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are checking health' },
      },
      required: ['reason'],
    },
  },
};

async function executeBrowserGetHealth(_args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('browser_get_health', _args);
  try {
    const response = await browserClient.getHealth();
    logger.toolSuccess('browser_get_health', _args, { connected: response['connected'], port: response['port'] }, Date.now() - startTime);
    return {
      success: true,
      result: JSON.stringify({
        cdp_available: response['cdp_available'],
        connected: response['connected'],
        port: response['port'],
        browser_type: response['browser_type'],
      }, null, 2),
    };
  } catch (error) {
    logger.toolError('browser_get_health', _args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const browserGetHealthTool: LLMSimpleTool = {
  definition: BROWSER_GET_HEALTH_DEFINITION,
  execute: executeBrowserGetHealth,
  categories: BROWSER_CATEGORIES,
  description: 'Check browser health',
};

// =============================================================================
// Browser Get Network
// =============================================================================

const BROWSER_GET_NETWORK_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'browser_get_network',
    description: `Get network resource requests from the current page.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you need network info' },
      },
      required: ['reason'],
    },
  },
};

async function executeBrowserGetNetwork(_args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('browser_get_network', _args);
  try {
    const response = await browserClient.getNetwork();
    if (response.success) {
      const resources = response['resources'] as Array<unknown>;
      logger.toolSuccess('browser_get_network', _args, { resourceCount: response['count'] }, Date.now() - startTime);
      return {
        success: true,
        result: `Found ${response['count']} network resources:\n${JSON.stringify(resources.slice(0, 20), null, 2)}${resources.length > 20 ? '\n... (truncated)' : ''}`,
      };
    }
    logger.toolError('browser_get_network', _args, new Error(response.error || 'Failed to get network info'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to get network info' };
  } catch (error) {
    logger.toolError('browser_get_network', _args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const browserGetNetworkTool: LLMSimpleTool = {
  definition: BROWSER_GET_NETWORK_DEFINITION,
  execute: executeBrowserGetNetwork,
  categories: BROWSER_CATEGORIES,
  description: 'Get network requests',
};

// =============================================================================
// Browser Get Page Info
// =============================================================================

const BROWSER_GET_PAGE_INFO_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'browser_get_page_info',
    description: `Get information about the current page (URL, title, element counts, etc.).`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you need page info' },
      },
      required: ['reason'],
    },
  },
};

async function executeBrowserGetPageInfo(_args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('browser_get_page_info', _args);
  try {
    const response = await browserClient.getPageInfo();
    if (response.success) {
      logger.toolSuccess('browser_get_page_info', _args, { url: response['url'], title: response['title'] }, Date.now() - startTime);
      return {
        success: true,
        result: JSON.stringify({
          url: response['url'],
          title: response['title'],
          domain: response['domain'],
          readyState: response['readyState'],
          linkCount: response['linkCount'],
          imageCount: response['imageCount'],
          formCount: response['formCount'],
          inputCount: response['inputCount'],
        }, null, 2),
      };
    }
    logger.toolError('browser_get_page_info', _args, new Error(response.error || 'Failed to get page info'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to get page info' };
  } catch (error) {
    logger.toolError('browser_get_page_info', _args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const browserGetPageInfoTool: LLMSimpleTool = {
  definition: BROWSER_GET_PAGE_INFO_DEFINITION,
  execute: executeBrowserGetPageInfo,
  categories: BROWSER_CATEGORIES,
  description: 'Get page information',
};

// =============================================================================
// Browser Get Text
// =============================================================================

const BROWSER_GET_TEXT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'browser_get_text',
    description: `Get text content from an element or the entire page.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you need the text' },
        selector: { type: 'string', description: 'CSS selector of element (optional, gets full page if not provided)' },
      },
      required: ['reason'],
    },
  },
};

async function executeBrowserGetText(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('browser_get_text', args);
  try {
    const response = await browserClient.getText(args['selector'] as string | undefined);
    if (response.success) {
      const text = response['text'] as string;
      const truncated = text.length > 5000 ? text.slice(0, 5000) + '\n... (truncated)' : text;
      logger.toolSuccess('browser_get_text', args, { textLength: text.length }, Date.now() - startTime);
      return { success: true, result: truncated };
    }
    logger.toolError('browser_get_text', args, new Error(response.error || 'Failed to get text'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to get text' };
  } catch (error) {
    logger.toolError('browser_get_text', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const browserGetTextTool: LLMSimpleTool = {
  definition: BROWSER_GET_TEXT_DEFINITION,
  execute: executeBrowserGetText,
  categories: BROWSER_CATEGORIES,
  description: 'Get text content',
};

// =============================================================================
// Browser Press Key
// =============================================================================

const BROWSER_PRESS_KEY_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'browser_press_key',
    description: `Press a keyboard key.
Supports special keys: Enter, Tab, Escape, Backspace, Delete, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Space, Home, End, PageUp, PageDown.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are pressing the key' },
        key: { type: 'string', description: 'Key to press (e.g., "Enter", "Tab", "a", "1")' },
      },
      required: ['reason', 'key'],
    },
  },
};

async function executeBrowserPressKey(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('browser_press_key', args);
  try {
    const response = await browserClient.pressKey(args['key'] as string);
    if (response.success) {
      logger.toolSuccess('browser_press_key', args, { key: args['key'] }, Date.now() - startTime);
      return { success: true, result: `Pressed key: ${args['key']}` };
    }
    logger.toolError('browser_press_key', args, new Error(response.error || 'Failed to press key'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to press key' };
  } catch (error) {
    logger.toolError('browser_press_key', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const browserPressKeyTool: LLMSimpleTool = {
  definition: BROWSER_PRESS_KEY_DEFINITION,
  execute: executeBrowserPressKey,
  categories: BROWSER_CATEGORIES,
  description: 'Press keyboard key',
};

// =============================================================================
// Browser Send CDP Command
// =============================================================================

const BROWSER_SEND_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'browser_send',
    description: `Send a low-level CDP (Chrome DevTools Protocol) command.
Use this for advanced operations not covered by other tools.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are sending this command' },
        method: { type: 'string', description: 'CDP method name (e.g., "Page.navigate", "DOM.getDocument")' },
        params: { type: 'object', description: 'Parameters for the CDP method' },
      },
      required: ['reason', 'method'],
    },
  },
};

async function executeBrowserSend(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('browser_send', { method: args['method'] });
  try {
    const response = await browserClient.send(
      args['method'] as string,
      args['params'] as Record<string, unknown> | undefined
    );
    if (response.success) {
      logger.toolSuccess('browser_send', { method: args['method'] }, { hasResult: !!response['result'] }, Date.now() - startTime);
      return { success: true, result: JSON.stringify(response['result'], null, 2) };
    }
    logger.toolError('browser_send', args, new Error(response.error || 'Failed to send CDP command'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to send CDP command' };
  } catch (error) {
    logger.toolError('browser_send', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const browserSendTool: LLMSimpleTool = {
  definition: BROWSER_SEND_DEFINITION,
  execute: executeBrowserSend,
  categories: BROWSER_CATEGORIES,
  description: 'Send CDP command',
};

// =============================================================================
// Export All Browser Tools
// =============================================================================

export const BROWSER_TOOLS: LLMSimpleTool[] = [
  browserLaunchTool,
  browserCloseTool,
  browserNavigateTool,
  browserClickTool,
  browserTypeTool,
  browserScreenshotTool,
  browserGetHtmlTool,
  browserWaitTool,
  browserConnectTool,
  browserExecuteScriptTool,
  browserFillTool,
  browserFocusTool,
  browserGetConsoleTool,
  browserGetHealthTool,
  browserGetNetworkTool,
  browserGetPageInfoTool,
  browserGetTextTool,
  browserPressKeyTool,
  browserSendTool,
];

/**
 * Sub-agent browser tools (lifecycle tools excluded — BrowserSubAgent manages lifecycle)
 * CLI parity: src/tools/browser/browser-tools.ts
 */
export const BROWSER_SUB_AGENT_TOOLS: LLMSimpleTool[] = [
  browserNavigateTool,
  browserScreenshotTool,
  browserClickTool,
  browserFillTool,
  browserGetTextTool,
  browserGetHtmlTool,
  browserGetPageInfoTool,
  browserFocusTool,
  browserPressKeyTool,
  browserTypeTool,
  browserExecuteScriptTool,
  browserWaitTool,
  browserSendTool,
];
