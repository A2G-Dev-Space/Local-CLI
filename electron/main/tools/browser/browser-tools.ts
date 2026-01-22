/**
 * Browser Tool Definitions for Electron (Windows Native)
 *
 * CDP-based browser automation tools
 * Total: 18 tools
 */

import { ToolDefinition } from '../../core';
import { LLMSimpleTool, ToolResult, BROWSER_CATEGORIES } from '../types';
import { browserClient } from './browser-client';

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
  try {
    const response = await browserClient.launch({
      browser: args['browser'] as 'chrome' | 'edge' | undefined,
      headless: args['headless'] as boolean | undefined,
    });
    if (response.success) {
      return { success: true, result: response.message || 'Browser launched' };
    }
    return { success: false, error: response.error || 'Failed to launch browser' };
  } catch (error) {
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
  try {
    const response = await browserClient.close();
    if (response.success) {
      return { success: true, result: response.message || 'Browser closed' };
    }
    return { success: false, error: response.error || 'Failed to close browser' };
  } catch (error) {
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
  try {
    const response = await browserClient.navigate(args['url'] as string);
    if (response.success) {
      return { success: true, result: `Navigated to: ${response['url']} - ${response['title']}` };
    }
    return { success: false, error: response.error || 'Failed to navigate' };
  } catch (error) {
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
  try {
    const response = await browserClient.click(args['selector'] as string);
    if (response.success) {
      return { success: true, result: `Clicked element: ${args['selector']}` };
    }
    return { success: false, error: response.error || 'Failed to click element' };
  } catch (error) {
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
  try {
    const response = await browserClient.type(
      args['selector'] as string,
      args['text'] as string,
      args['clear'] !== false
    );
    if (response.success) {
      return { success: true, result: `Typed text into: ${args['selector']}` };
    }
    return { success: false, error: response.error || 'Failed to type text' };
  } catch (error) {
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
    description: `Take a screenshot of the current page.
Returns base64 encoded PNG image and saves to file.`,
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
  try {
    const response = await browserClient.screenshot(args['full_page'] === true);
    if (response.success) {
      return {
        success: true,
        result: `Screenshot saved to: ${response['filepath']}`,
        metadata: { filepath: response['filepath'] as string },
      };
    }
    return { success: false, error: response.error || 'Failed to take screenshot' };
  } catch (error) {
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
  try {
    const response = await browserClient.getHtml(args['selector'] as string | undefined);
    if (response.success) {
      const html = response['html'] as string;
      const truncated = html.length > 10000 ? html.slice(0, 10000) + '\n... (truncated)' : html;
      return { success: true, result: truncated };
    }
    return { success: false, error: response.error || 'Failed to get HTML' };
  } catch (error) {
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
  try {
    const response = await browserClient.waitFor(
      args['selector'] as string | undefined,
      args['timeout'] as number | undefined
    );
    if (response.success) {
      return { success: true, result: response.message || 'Wait completed' };
    }
    return { success: false, error: response.error || 'Wait failed' };
  } catch (error) {
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
  try {
    const response = await browserClient.connect(args['port'] as number | undefined);
    if (response.success) {
      return { success: true, result: `Connected to browser at ${response['url']}` };
    }
    return { success: false, error: response.error || 'Failed to connect' };
  } catch (error) {
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
    description: `Execute JavaScript code in the browser context.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are executing script' },
        script: { type: 'string', description: 'JavaScript code to execute' },
      },
      required: ['reason', 'script'],
    },
  },
};

async function executeBrowserExecuteScript(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await browserClient.executeScript(args['script'] as string);
    if (response.success) {
      return { success: true, result: JSON.stringify(response['result'], null, 2) };
    }
    return { success: false, error: response.error || 'Script execution failed' };
  } catch (error) {
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
  try {
    const response = await browserClient.fill(args['selector'] as string, args['value'] as string);
    if (response.success) {
      return { success: true, result: `Filled field: ${args['selector']}` };
    }
    return { success: false, error: response.error || 'Failed to fill field' };
  } catch (error) {
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
  try {
    const response = await browserClient.focus(args['selector'] as string);
    if (response.success) {
      return { success: true, result: `Focused element: ${args['selector']}` };
    }
    return { success: false, error: response.error || 'Failed to focus element' };
  } catch (error) {
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
  try {
    const response = await browserClient.getConsole();
    if (response.success) {
      return { success: true, result: response.message || 'Console logging enabled' };
    }
    return { success: false, error: response.error || 'Failed to enable console' };
  } catch (error) {
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
  try {
    const response = await browserClient.getHealth();
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
  try {
    const response = await browserClient.getNetwork();
    if (response.success) {
      const resources = response['resources'] as Array<unknown>;
      return {
        success: true,
        result: `Found ${response['count']} network resources:\n${JSON.stringify(resources.slice(0, 20), null, 2)}${resources.length > 20 ? '\n... (truncated)' : ''}`,
      };
    }
    return { success: false, error: response.error || 'Failed to get network info' };
  } catch (error) {
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
  try {
    const response = await browserClient.getPageInfo();
    if (response.success) {
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
    return { success: false, error: response.error || 'Failed to get page info' };
  } catch (error) {
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
  try {
    const response = await browserClient.getText(args['selector'] as string | undefined);
    if (response.success) {
      const text = response['text'] as string;
      const truncated = text.length > 5000 ? text.slice(0, 5000) + '\n... (truncated)' : text;
      return { success: true, result: truncated };
    }
    return { success: false, error: response.error || 'Failed to get text' };
  } catch (error) {
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
  try {
    const response = await browserClient.pressKey(args['key'] as string);
    if (response.success) {
      return { success: true, result: `Pressed key: ${args['key']}` };
    }
    return { success: false, error: response.error || 'Failed to press key' };
  } catch (error) {
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
  try {
    const response = await browserClient.send(
      args['method'] as string,
      args['params'] as Record<string, unknown> | undefined
    );
    if (response.success) {
      return { success: true, result: JSON.stringify(response['result'], null, 2) };
    }
    return { success: false, error: response.error || 'Failed to send CDP command' };
  } catch (error) {
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
