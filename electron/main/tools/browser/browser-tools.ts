/**
 * Browser Tool Definitions for Electron (Windows Native)
 *
 * CDP-based browser automation tools
 * Total: 20 tools
 */

import { ToolDefinition } from '../../core';
import { LLMSimpleTool, ToolResult, BROWSER_CATEGORIES } from '../types';
import { browserClient } from './browser-client';
import { logger } from '../../utils/logger';

// =============================================================================
// Browser Launch
// =============================================================================

const BROWSER_LAUNCH_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'browser_launch',
    description: `Launch Chrome/Edge browser for web testing and automation.
Uses Chrome DevTools Protocol (CDP) for browser control.
If browser is already running, returns existing session.

IMPORTANT: For visual testing or when user needs to see the browser, use headless: false (default).
Only use headless: true when explicitly requested by the user.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation of why you are launching the browser',
        },
        browser: {
          type: 'string',
          enum: ['chrome', 'edge'],
          description: 'Browser to use (default: chrome). Falls back to edge if chrome is not available.',
        },
        headless: {
          type: 'boolean',
          description: 'Run browser in headless mode (default: false). Set to true to hide the browser window.',
        },
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
    description: `Close the browser and end the automation session.
Use this when you are done testing.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation of why you are closing the browser',
        },
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
    description: `Navigate browser to a URL. Waits for page load to complete.

Common URLs:
- http://localhost:3000 - Local development server
- http://localhost:8080 - Alternative local server
- https://example.com - External website`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation of why you are navigating to this URL',
        },
        url: {
          type: 'string',
          description: 'The URL to navigate to (e.g., http://localhost:3000)',
        },
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
    description: `Click an element on the page by CSS selector.

Examples:
- button[type="submit"] - Submit button
- #login-btn - Element with id "login-btn"
- .nav-link - Element with class "nav-link"
- a[href="/about"] - Link to /about`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation of why you are clicking this element',
        },
        selector: {
          type: 'string',
          description: 'CSS selector of the element to click',
        },
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
    description: `Type text character by character (triggers key events).
Unlike browser_fill which sets value directly, this simulates actual typing.
Useful for inputs that have keystroke handlers or autocomplete.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation of why you are typing this text',
        },
        text: {
          type: 'string',
          description: 'Text to type',
        },
        selector: {
          type: 'string',
          description: 'Optional CSS selector of element to type into',
        },
      },
      required: ['reason', 'text'],
    },
  },
};

async function executeBrowserType(args: Record<string, unknown>): Promise<ToolResult> {
  const text = args['text'] as string;
  const selector = args['selector'] as string | undefined;
  const startTime = Date.now();

  logger.toolStart('browser_type', { textLength: text?.length, selector });
  try {
    const response = await browserClient.type(text, selector);
    if (response.success) {
      logger.toolSuccess('browser_type', { textLength: text.length, selector }, { typed: true }, Date.now() - startTime);
      return { success: true, result: `Typed ${text.length} characters${selector ? ` into ${selector}` : ''}` };
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
  description: 'Type text character by character',
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
Screenshots are saved to the screenshots directory.
Use this to verify that pages loaded correctly or to check UI elements.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation of why you are taking a screenshot',
        },
        full_page: {
          type: 'boolean',
          description: 'Capture the full scrollable page (default: false, captures viewport only)',
        },
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
      logger.toolSuccess('browser_screenshot', args, { filepath: response['filepath'] }, Date.now() - startTime);
      return {
        success: true,
        result: `Screenshot saved to: ${response['filepath']}`,
        metadata: { filepath: response['filepath'] as string },
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
Use this only when other browser tools don't cover your use case.

Examples:
- "return document.title;" - returns page title
- "return document.querySelectorAll('a').length;" - count all links
- "return await fetch('/api/data').then(r => r.json());" - async fetch`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation of why you need to execute this script',
        },
        script: {
          type: 'string',
          description: 'JavaScript code to execute (can use return and await)',
        },
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
    description: `Fill an input field with text. The existing content will be cleared before typing.

Examples:
- input[name="email"] - Email input field
- #password - Password field by id
- textarea.comment - Comment textarea`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation of why you are filling this field',
        },
        selector: {
          type: 'string',
          description: 'CSS selector of the input field',
        },
        value: {
          type: 'string',
          description: 'Text to type into the field',
        },
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
    description: `Focus on a DOM element by CSS selector.
Use this to focus input fields or other focusable elements.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation of why you are focusing this element',
        },
        selector: {
          type: 'string',
          description: 'CSS selector of element to focus',
        },
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
// Browser Bring To Front (Window focus)
// =============================================================================

const BROWSER_BRING_TO_FRONT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'browser_bring_to_front',
    description: `Bring the browser window to the foreground.
Use this to make the browser window visible and focused when needed.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you need to bring the browser window to front' },
      },
      required: ['reason'],
    },
  },
};

async function executeBrowserBringToFront(_args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('browser_bring_to_front', _args);
  try {
    if (!(await browserClient.isBrowserActive())) {
      logger.toolError('browser_bring_to_front', _args, new Error('Browser not running'), Date.now() - startTime);
      return { success: false, error: 'Browser is not running. Use browser_launch first.' };
    }

    const response = await browserClient.send('Page.bringToFront', {});
    if (!response.success) {
      logger.toolError('browser_bring_to_front', _args, new Error(response.error || 'Failed to bring to front'), Date.now() - startTime);
      return { success: false, error: response.error || 'Failed to bring browser to front' };
    }

    logger.toolSuccess('browser_bring_to_front', _args, { focused: true }, Date.now() - startTime);
    return { success: true, result: 'Browser window brought to foreground.' };
  } catch (error) {
    logger.toolError('browser_bring_to_front', _args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to bring browser to front: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const browserBringToFrontTool: LLMSimpleTool = {
  definition: BROWSER_BRING_TO_FRONT_DEFINITION,
  execute: executeBrowserBringToFront,
  categories: BROWSER_CATEGORIES,
  description: 'Bring browser window to foreground',
};

// =============================================================================
// Browser Get Console
// =============================================================================

const BROWSER_GET_CONSOLE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'browser_get_console',
    description: `Get console logs from the browser.
Returns console.log, console.error, console.warn messages.

Use this tool to:
- Debug JavaScript errors on the page
- Check API response logs
- Verify application behavior
- Find error messages that might explain UI issues`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation of why you need the console logs',
        },
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
      const logs = (response['logs'] as Array<{ level: string; message: string; timestamp: number }>) || [];
      if (logs.length === 0) {
        logger.toolSuccess('browser_get_console', _args, { logCount: 0 }, Date.now() - startTime);
        return { success: true, result: 'No console messages captured.' };
      }

      const formatted = logs.map(log => {
        const timestamp = new Date(log.timestamp).toLocaleTimeString('en-GB');
        const icon = log.level === 'ERROR' ? '❌' : log.level === 'WARNING' ? '⚠️' : '📝';
        return `[${timestamp}] ${icon} ${log.level}: ${log.message}`;
      }).join('\n');

      logger.toolSuccess('browser_get_console', _args, { logCount: logs.length }, Date.now() - startTime);
      return { success: true, result: `Console logs (${logs.length} messages):\n\n${formatted}` };
    }
    logger.toolError('browser_get_console', _args, new Error(response.error || 'Failed to get console logs'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to get console logs' };
  } catch (error) {
    logger.toolError('browser_get_console', _args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to get console logs: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const browserGetConsoleTool: LLMSimpleTool = {
  definition: BROWSER_GET_CONSOLE_DEFINITION,
  execute: executeBrowserGetConsole,
  categories: BROWSER_CATEGORIES,
  description: 'Get browser console logs',
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
    description: `Get network request logs from the browser.
Returns HTTP requests and responses captured during page interactions.

Use this tool to:
- Debug API calls and responses
- Check request/response status codes
- Verify network requests are being made correctly
- Analyze API endpoints being called
- Check for failed network requests`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation of why you need the network logs',
        },
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
      const logs = (response['logs'] as Array<{ type: string; url: string; method?: string; status?: number; statusText?: string; mimeType?: string }>) || [];
      if (logs.length === 0) {
        logger.toolSuccess('browser_get_network', _args, { logCount: 0 }, Date.now() - startTime);
        return { success: true, result: 'No network requests captured.' };
      }

      const formatted = logs.map(log => {
        if (log.type === 'request') {
          return `➡️ ${log.method} ${log.url}`;
        } else {
          const statusIcon = log.status && log.status >= 400 ? '❌' : '✅';
          return `${statusIcon} ${log.status} ${log.statusText} - ${log.url} (${log.mimeType || 'unknown'})`;
        }
      }).join('\n');

      logger.toolSuccess('browser_get_network', _args, { logCount: logs.length }, Date.now() - startTime);
      return { success: true, result: `Network logs (${logs.length} entries):\n\n${formatted}` };
    }
    logger.toolError('browser_get_network', _args, new Error(response.error || 'Failed to get network logs'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to get network logs' };
  } catch (error) {
    logger.toolError('browser_get_network', _args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to get network logs: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const browserGetNetworkTool: LLMSimpleTool = {
  definition: BROWSER_GET_NETWORK_DEFINITION,
  execute: executeBrowserGetNetwork,
  categories: BROWSER_CATEGORIES,
  description: 'Get browser network logs',
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
    description: `Get text content from an element or the entire page.
Use this to read content from the page, like error messages or confirmation text.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation of why you need the text',
        },
        selector: {
          type: 'string',
          description: 'CSS selector of element (optional, gets full page text if not provided)',
        },
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
    description: `Press a keyboard key in the browser.

Supports special keys:
- Enter, Tab, Escape, Space
- ArrowUp, ArrowDown, ArrowLeft, ArrowRight
- Backspace, Delete, Home, End, PageUp, PageDown
- F1-F12
- Control, Alt, Shift, Meta

Key combinations (use + to combine):
- Control+A (select all)
- Control+C (copy)
- Control+V (paste)
- Shift+Tab (reverse tab)

Use this for form submission (Enter), navigation, or keyboard shortcuts.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation of why you are pressing this key',
        },
        key: {
          type: 'string',
          description: 'Key to press (e.g., "Enter", "Tab", "Escape", "Control+A")',
        },
        selector: {
          type: 'string',
          description: 'Optional CSS selector of element to focus before pressing key',
        },
      },
      required: ['reason', 'key'],
    },
  },
};

async function executeBrowserPressKey(args: Record<string, unknown>): Promise<ToolResult> {
  const key = args['key'] as string;
  const selector = args['selector'] as string | undefined;
  const startTime = Date.now();

  logger.toolStart('browser_press_key', { key, selector });
  try {
    const response = await browserClient.pressKey(key, selector);
    if (response.success) {
      logger.toolSuccess('browser_press_key', { key, selector }, { key }, Date.now() - startTime);
      return { success: true, result: `Key "${key}" pressed${selector ? ` on ${selector}` : ''}` };
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
  browserBringToFrontTool,
  browserGetConsoleTool,
  browserGetHealthTool,
  browserGetNetworkTool,
  browserGetPageInfoTool,
  browserGetTextTool,
  browserPressKeyTool,
  browserSendTool,
];
