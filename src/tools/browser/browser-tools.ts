/**
 * Browser Automation Tools (LLM Simple)
 *
 * LLM이 브라우저를 제어할 수 있는 도구들
 * Category: LLM Simple Tools - LLM이 tool_call로 호출, Sub-LLM 없음
 *
 * Uses CDP (Chrome DevTools Protocol) via Playwright
 * PowerShell로 브라우저를 시작하고 Playwright로 제어합니다.
 */

import { ToolDefinition } from '../../types/index.js';
import { LLMSimpleTool, ToolResult, ToolCategory } from '../types.js';
import { browserClient } from './browser-client.js';
import { logger } from '../../utils/logger.js';

const BROWSER_CATEGORIES: ToolCategory[] = ['llm-simple'];

/**
 * browser_launch Tool Definition
 */
const BROWSER_LAUNCH_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'browser_launch',
    description: `Launch Chrome/Edge browser for web testing and automation.
Use this tool to start a browser session before navigating to pages.
The browser runs on Windows via CDP (Chrome DevTools Protocol).`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation of why you are launching the browser',
        },
        headless: {
          type: 'boolean',
          description: 'Run browser in headless mode (default: false). Set to true to hide the browser window.',
        },
        browser: {
          type: 'string',
          enum: ['chrome', 'edge'],
          description: 'Browser to use (default: chrome). Falls back to edge if chrome is not available.',
        },
      },
      required: ['reason'],
    },
  },
};

async function executeBrowserLaunch(args: Record<string, unknown>): Promise<ToolResult> {
  const headless = args['headless'] === true;
  const browser = (args['browser'] as 'chrome' | 'edge') || 'chrome';

  logger.toolStart('browser_launch', { headless, browser });

  try {
    // Check if browser is already active
    if (await browserClient.isBrowserActive()) {
      logger.toolSuccess('browser_launch', args, { alreadyRunning: true }, 0);
      return {
        success: true,
        result: 'Browser is already running.',
      };
    }

    // Ensure server is running
    await browserClient.startServer();

    // Launch browser
    const response = await browserClient.launch({ headless, browser });

    if (!response.success) {
      logger.toolError('browser_launch', args, new Error(response.error || 'Failed to launch browser'), 0);
      return {
        success: false,
        error: response.error || 'Failed to launch browser',
      };
    }

    logger.toolSuccess('browser_launch', args, { browser: response['browser'] || browser, headless }, 0);
    return {
      success: true,
      result: `${response['browser'] || browser} launched successfully (headless: ${headless})`,
    };
  } catch (error) {
    logger.toolError('browser_launch', args, error as Error, 0);
    return {
      success: false,
      error: `Failed to launch browser: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export const browserLaunchTool: LLMSimpleTool = {
  definition: BROWSER_LAUNCH_DEFINITION,
  execute: executeBrowserLaunch,
  categories: BROWSER_CATEGORIES,
  description: 'Launch Chrome/Edge browser',
};

/**
 * browser_navigate Tool Definition
 */
const BROWSER_NAVIGATE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'browser_navigate',
    description: `Navigate browser to a URL. Use this to open web pages for testing.
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
  const url = args['url'] as string;

  logger.toolStart('browser_navigate', { url });

  try {
    // Auto-launch if not running
    if (!(await browserClient.isBrowserActive())) {
      logger.flow('Browser not active, auto-launching');
      await browserClient.startServer();
      await browserClient.launch({ headless: false });
    }

    const response = await browserClient.navigate(url);

    if (!response.success) {
      logger.toolError('browser_navigate', args, new Error(response.error || 'Failed to navigate'), 0);
      return {
        success: false,
        error: response.error || 'Failed to navigate',
      };
    }

    logger.toolSuccess('browser_navigate', args, { url: response.url, title: response.title }, 0);
    return {
      success: true,
      result: `Navigated to ${response.url}\nPage title: ${response.title}`,
    };
  } catch (error) {
    logger.toolError('browser_navigate', args, error as Error, 0);
    return {
      success: false,
      error: `Failed to navigate: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export const browserNavigateTool: LLMSimpleTool = {
  definition: BROWSER_NAVIGATE_DEFINITION,
  execute: executeBrowserNavigate,
  categories: BROWSER_CATEGORIES,
  description: 'Navigate browser to URL',
};

/**
 * browser_screenshot Tool Definition
 */
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
  const fullPage = args['full_page'] === true;

  logger.toolStart('browser_screenshot', { fullPage });

  try {
    if (!(await browserClient.isBrowserActive())) {
      logger.toolError('browser_screenshot', args, new Error('Browser not running'), 0);
      return {
        success: false,
        error: 'Browser is not running. Use browser_launch first.',
      };
    }

    const response = await browserClient.screenshot(fullPage);

    if (!response.success || !response.image) {
      logger.toolError('browser_screenshot', args, new Error(response.error || 'Failed to take screenshot'), 0);
      return {
        success: false,
        error: response.error || 'Failed to take screenshot',
      };
    }

    // Save screenshot to file
    const savedPath = browserClient.saveScreenshot(response.image, 'browser');

    logger.toolSuccess('browser_screenshot', args, { savedPath, url: response.url, title: response.title }, 0);
    return {
      success: true,
      result: `Screenshot captured of "${response.title}" (${response.url})\nSaved to: ${savedPath}\n\nTo verify this screenshot, call read_image with file_path="${savedPath}"`,
      metadata: {
        image: response.image,
        imageType: 'image/png',
        encoding: 'base64',
        url: response.url,
        title: response.title,
        savedPath,
      },
    };
  } catch (error) {
    logger.toolError('browser_screenshot', args, error as Error, 0);
    return {
      success: false,
      error: `Failed to take screenshot: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export const browserScreenshotTool: LLMSimpleTool = {
  definition: BROWSER_SCREENSHOT_DEFINITION,
  execute: executeBrowserScreenshot,
  categories: BROWSER_CATEGORIES,
  description: 'Take screenshot of browser',
};

/**
 * browser_click Tool Definition
 */
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
  const selector = args['selector'] as string;
  const startTime = Date.now();

  logger.toolStart('browser_click', { selector });

  try {
    if (!(await browserClient.isBrowserActive())) {
      logger.toolError('browser_click', args, new Error('Browser not running'), Date.now() - startTime);
      return {
        success: false,
        error: 'Browser is not running. Use browser_launch first.',
      };
    }

    const response = await browserClient.click(selector);

    if (!response.success) {
      logger.toolError('browser_click', args, new Error(response.error || `Failed to click: ${selector}`), Date.now() - startTime);
      return {
        success: false,
        error: response.error || `Failed to click: ${selector}`,
      };
    }

    logger.toolSuccess('browser_click', args, { selector, currentUrl: response['current_url'] }, Date.now() - startTime);
    return {
      success: true,
      result: `Clicked element: ${selector}\nCurrent URL: ${response['current_url'] || 'unknown'}`,
    };
  } catch (error) {
    logger.toolError('browser_click', args, error as Error, Date.now() - startTime);
    return {
      success: false,
      error: `Failed to click: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export const browserClickTool: LLMSimpleTool = {
  definition: BROWSER_CLICK_DEFINITION,
  execute: executeBrowserClick,
  categories: BROWSER_CATEGORIES,
  description: 'Click element on page',
};

/**
 * browser_fill Tool Definition
 */
const BROWSER_FILL_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'browser_fill',
    description: `Fill an input field with text.
The existing content will be cleared before typing.
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
  const selector = args['selector'] as string;
  const value = args['value'] as string;
  const startTime = Date.now();

  logger.toolStart('browser_fill', { selector, valueLength: value?.length });

  try {
    if (!(await browserClient.isBrowserActive())) {
      logger.toolError('browser_fill', args, new Error('Browser not running'), Date.now() - startTime);
      return {
        success: false,
        error: 'Browser is not running. Use browser_launch first.',
      };
    }

    const response = await browserClient.fill(selector, value);

    if (!response.success) {
      logger.toolError('browser_fill', args, new Error(response.error || `Failed to fill: ${selector}`), Date.now() - startTime);
      return {
        success: false,
        error: response.error || `Failed to fill: ${selector}`,
      };
    }

    logger.toolSuccess('browser_fill', args, { selector, valueLength: value.length }, Date.now() - startTime);
    return {
      success: true,
      result: `Filled "${selector}" with text (${value.length} characters)`,
    };
  } catch (error) {
    logger.toolError('browser_fill', args, error as Error, Date.now() - startTime);
    return {
      success: false,
      error: `Failed to fill: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export const browserFillTool: LLMSimpleTool = {
  definition: BROWSER_FILL_DEFINITION,
  execute: executeBrowserFill,
  categories: BROWSER_CATEGORIES,
  description: 'Fill input field with text',
};

/**
 * browser_get_text Tool Definition
 */
const BROWSER_GET_TEXT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'browser_get_text',
    description: `Get the text content of an element.
Use this to read content from the page, like error messages or confirmation text.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation of why you are reading this element',
        },
        selector: {
          type: 'string',
          description: 'CSS selector of the element to read',
        },
      },
      required: ['reason', 'selector'],
    },
  },
};

async function executeBrowserGetText(args: Record<string, unknown>): Promise<ToolResult> {
  const selector = args['selector'] as string;
  const startTime = Date.now();

  logger.toolStart('browser_get_text', { selector });

  try {
    if (!(await browserClient.isBrowserActive())) {
      logger.toolError('browser_get_text', args, new Error('Browser not running'), Date.now() - startTime);
      return {
        success: false,
        error: 'Browser is not running. Use browser_launch first.',
      };
    }

    const response = await browserClient.getText(selector);

    if (!response.success) {
      logger.toolError('browser_get_text', args, new Error(response.error || `Failed to get text: ${selector}`), Date.now() - startTime);
      return {
        success: false,
        error: response.error || `Failed to get text: ${selector}`,
      };
    }

    const text = (response['text'] as string) || '(empty)';
    logger.toolSuccess('browser_get_text', args, { selector, textLength: text.length }, Date.now() - startTime);
    return {
      success: true,
      result: text,
    };
  } catch (error) {
    logger.toolError('browser_get_text', args, error as Error, Date.now() - startTime);
    return {
      success: false,
      error: `Failed to get text: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export const browserGetTextTool: LLMSimpleTool = {
  definition: BROWSER_GET_TEXT_DEFINITION,
  execute: executeBrowserGetText,
  categories: BROWSER_CATEGORIES,
  description: 'Get text content of element',
};

/**
 * browser_close Tool Definition
 */
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

async function executeBrowserClose(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();

  logger.toolStart('browser_close', {});

  try {
    await browserClient.close();

    logger.toolSuccess('browser_close', args, { closed: true }, Date.now() - startTime);
    return {
      success: true,
      result: 'Browser closed successfully',
    };
  } catch (error) {
    logger.toolError('browser_close', args, error as Error, Date.now() - startTime);
    return {
      success: false,
      error: `Failed to close browser: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export const browserCloseTool: LLMSimpleTool = {
  definition: BROWSER_CLOSE_DEFINITION,
  execute: executeBrowserClose,
  categories: BROWSER_CATEGORIES,
  description: 'Close browser',
};

/**
 * browser_get_content Tool Definition
 */
const BROWSER_GET_CONTENT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'browser_get_content',
    description: `Get the HTML content of the current page.
Returns page URL, title, and HTML source.

Use this tool when you need to:
- Find elements and their selectors
- Understand the page structure
- Check form fields
- Debug page issues`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation of why you need the page content',
        },
      },
      required: ['reason'],
    },
  },
};

async function executeBrowserGetContent(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();

  logger.toolStart('browser_get_content', {});

  try {
    if (!(await browserClient.isBrowserActive())) {
      logger.toolError('browser_get_content', args, new Error('Browser not running'), Date.now() - startTime);
      return {
        success: false,
        error: 'Browser is not running. Use browser_launch first.',
      };
    }

    const response = await browserClient.getHtml();

    if (!response.success) {
      logger.toolError('browser_get_content', args, new Error(response.error || 'Failed to get page content'), Date.now() - startTime);
      return {
        success: false,
        error: response.error || 'Failed to get page content',
      };
    }

    const html = response.html || '';
    // Truncate HTML if too long
    const maxLen = 10000;
    const truncatedHtml = html.length > maxLen
      ? html.substring(0, maxLen) + `\n...(truncated, ${html.length} total chars)`
      : html;

    logger.toolSuccess('browser_get_content', args, { url: response.url, title: response.title, htmlLength: html.length }, Date.now() - startTime);
    return {
      success: true,
      result: `Page: ${response.title} (${response.url})\n\nHTML:\n${truncatedHtml}`,
    };
  } catch (error) {
    logger.toolError('browser_get_content', args, error as Error, Date.now() - startTime);
    return {
      success: false,
      error: `Failed to get page content: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export const browserGetContentTool: LLMSimpleTool = {
  definition: BROWSER_GET_CONTENT_DEFINITION,
  execute: executeBrowserGetContent,
  categories: BROWSER_CATEGORIES,
  description: 'Get page HTML content',
};

/**
 * browser_get_console Tool Definition
 */
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

async function executeBrowserGetConsole(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();

  logger.toolStart('browser_get_console', {});

  try {
    if (!(await browserClient.isBrowserActive())) {
      logger.toolError('browser_get_console', args, new Error('Browser not running'), Date.now() - startTime);
      return {
        success: false,
        error: 'Browser is not running. Use browser_launch first.',
      };
    }

    const response = await browserClient.getConsole();

    if (!response.success) {
      logger.toolError('browser_get_console', args, new Error(response.error || 'Failed to get console logs'), Date.now() - startTime);
      return {
        success: false,
        error: response.error || 'Failed to get console logs',
      };
    }

    const logs = response.logs || [];
    if (logs.length === 0) {
      logger.toolSuccess('browser_get_console', args, { logCount: 0 }, Date.now() - startTime);
      return {
        success: true,
        result: 'No console messages captured.',
      };
    }

    const formatted = logs.map(log => {
      const timestamp = new Date(log.timestamp).toLocaleTimeString('en-GB');
      const icon = log.level === 'SEVERE' ? '❌' : log.level === 'WARNING' ? '⚠️' : '📝';
      return `[${timestamp}] ${icon} ${log.level}: ${log.message}`;
    }).join('\n');

    logger.toolSuccess('browser_get_console', args, { logCount: logs.length }, Date.now() - startTime);
    return {
      success: true,
      result: `Console logs (${logs.length} messages):\n\n${formatted}`,
    };
  } catch (error) {
    logger.toolError('browser_get_console', args, error as Error, Date.now() - startTime);
    return {
      success: false,
      error: `Failed to get console logs: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export const browserGetConsoleTool: LLMSimpleTool = {
  definition: BROWSER_GET_CONSOLE_DEFINITION,
  execute: executeBrowserGetConsole,
  categories: BROWSER_CATEGORIES,
  description: 'Get browser console logs',
};

/**
 * browser_get_network Tool Definition
 */
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

async function executeBrowserGetNetwork(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();

  logger.toolStart('browser_get_network', {});

  try {
    if (!(await browserClient.isBrowserActive())) {
      logger.toolError('browser_get_network', args, new Error('Browser not running'), Date.now() - startTime);
      return {
        success: false,
        error: 'Browser is not running. Use browser_launch first.',
      };
    }

    const response = await browserClient.getNetwork();

    if (!response.success) {
      logger.toolError('browser_get_network', args, new Error(response.error || 'Failed to get network logs'), Date.now() - startTime);
      return {
        success: false,
        error: response.error || 'Failed to get network logs',
      };
    }

    const logs = response.logs || [];
    if (logs.length === 0) {
      logger.toolSuccess('browser_get_network', args, { logCount: 0 }, Date.now() - startTime);
      return {
        success: true,
        result: 'No network requests captured.',
      };
    }

    const formatted = logs.map(log => {
      if (log.type === 'request') {
        return `➡️ ${log.method} ${log.url}`;
      } else {
        const statusIcon = log.status && log.status >= 400 ? '❌' : '✅';
        return `${statusIcon} ${log.status} ${log.statusText} - ${log.url} (${log.mimeType || 'unknown'})`;
      }
    }).join('\n');

    logger.toolSuccess('browser_get_network', args, { logCount: logs.length }, Date.now() - startTime);
    return {
      success: true,
      result: `Network logs (${logs.length} entries):\n\n${formatted}`,
    };
  } catch (error) {
    logger.toolError('browser_get_network', args, error as Error, Date.now() - startTime);
    return {
      success: false,
      error: `Failed to get network logs: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export const browserGetNetworkTool: LLMSimpleTool = {
  definition: BROWSER_GET_NETWORK_DEFINITION,
  execute: executeBrowserGetNetwork,
  categories: BROWSER_CATEGORIES,
  description: 'Get browser network logs',
};

/**
 * browser_focus Tool Definition
 */
const BROWSER_FOCUS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'browser_focus',
    description: `Bring the browser window to the foreground.
Use this to make the browser window visible and focused when needed.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation of why you need to focus the browser window',
        },
      },
      required: ['reason'],
    },
  },
};

async function executeBrowserFocus(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();

  logger.toolStart('browser_focus', {});

  try {
    if (!(await browserClient.isBrowserActive())) {
      logger.toolError('browser_focus', args, new Error('Browser not running'), Date.now() - startTime);
      return {
        success: false,
        error: 'Browser is not running. Use browser_launch first.',
      };
    }

    const response = await browserClient.focus();

    if (!response.success) {
      logger.toolError('browser_focus', args, new Error(response.error || 'Failed to focus browser window'), Date.now() - startTime);
      return {
        success: false,
        error: response.error || 'Failed to focus browser window',
      };
    }

    logger.toolSuccess('browser_focus', args, { focused: true }, Date.now() - startTime);
    return {
      success: true,
      result: 'Browser window brought to foreground.',
    };
  } catch (error) {
    logger.toolError('browser_focus', args, error as Error, Date.now() - startTime);
    return {
      success: false,
      error: `Failed to focus browser: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export const browserFocusTool: LLMSimpleTool = {
  definition: BROWSER_FOCUS_DEFINITION,
  execute: executeBrowserFocus,
  categories: BROWSER_CATEGORIES,
  description: 'Bring browser window to foreground',
};

/**
 * browser_press_key Tool Definition
 */
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
    if (!(await browserClient.isBrowserActive())) {
      logger.toolError('browser_press_key', args, new Error('Browser not running'), Date.now() - startTime);
      return {
        success: false,
        error: 'Browser is not running. Use browser_launch first.',
      };
    }

    const response = await browserClient.pressKey(key, selector);

    if (!response.success) {
      logger.toolError('browser_press_key', args, new Error(response.error || `Failed to press key: ${key}`), Date.now() - startTime);
      return {
        success: false,
        error: response.error || `Failed to press key: ${key}`,
      };
    }

    logger.toolSuccess('browser_press_key', args, { key, selector }, Date.now() - startTime);
    return {
      success: true,
      result: `Key "${key}" pressed${selector ? ` on ${selector}` : ''}`,
    };
  } catch (error) {
    logger.toolError('browser_press_key', args, error as Error, Date.now() - startTime);
    return {
      success: false,
      error: `Failed to press key: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export const browserPressKeyTool: LLMSimpleTool = {
  definition: BROWSER_PRESS_KEY_DEFINITION,
  execute: executeBrowserPressKey,
  categories: BROWSER_CATEGORIES,
  description: 'Press keyboard key',
};

/**
 * browser_type Tool Definition
 */
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
    if (!(await browserClient.isBrowserActive())) {
      logger.toolError('browser_type', args, new Error('Browser not running'), Date.now() - startTime);
      return {
        success: false,
        error: 'Browser is not running. Use browser_launch first.',
      };
    }

    const response = await browserClient.type(text, selector);

    if (!response.success) {
      logger.toolError('browser_type', args, new Error(response.error || 'Failed to type text'), Date.now() - startTime);
      return {
        success: false,
        error: response.error || 'Failed to type text',
      };
    }

    logger.toolSuccess('browser_type', args, { textLength: text.length, selector }, Date.now() - startTime);
    return {
      success: true,
      result: `Typed ${text.length} characters${selector ? ` into ${selector}` : ''}`,
    };
  } catch (error) {
    logger.toolError('browser_type', args, error as Error, Date.now() - startTime);
    return {
      success: false,
      error: `Failed to type: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export const browserTypeTool: LLMSimpleTool = {
  definition: BROWSER_TYPE_DEFINITION,
  execute: executeBrowserType,
  categories: BROWSER_CATEGORIES,
  description: 'Type text character by character',
};

/**
 * browser_execute_script Tool Definition
 */
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
  const script = args['script'] as string;
  const startTime = Date.now();

  logger.toolStart('browser_execute_script', { scriptLength: script?.length });

  if (!script) {
    logger.toolError('browser_execute_script', args, new Error('Script argument required'), Date.now() - startTime);
    return {
      success: false,
      error: "The 'script' argument is required.",
    };
  }

  try {
    if (!(await browserClient.isBrowserActive())) {
      logger.toolError('browser_execute_script', args, new Error('Browser not running'), Date.now() - startTime);
      return {
        success: false,
        error: 'Browser is not running. Use browser_launch first.',
      };
    }

    const response = await browserClient.executeScript(script);

    if (!response.success) {
      logger.toolError('browser_execute_script', args, new Error(response.error || 'Failed to execute script'), Date.now() - startTime);
      return {
        success: false,
        error: response.error || 'Failed to execute script',
        result: response['details'] as string,
      };
    }

    logger.toolSuccess('browser_execute_script', args, { scriptLength: script.length }, Date.now() - startTime);
    return {
      success: true,
      result: JSON.stringify(response['result'], null, 2),
    };
  } catch (error) {
    logger.toolError('browser_execute_script', args, error as Error, Date.now() - startTime);
    return {
      success: false,
      error: `Failed to execute script: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export const browserExecuteScriptTool: LLMSimpleTool = {
  definition: BROWSER_EXECUTE_SCRIPT_DEFINITION,
  execute: executeBrowserExecuteScript,
  categories: BROWSER_CATEGORIES,
  description: 'Execute JavaScript in browser',
};

/**
 * All browser tools
 */
export const BROWSER_TOOLS: LLMSimpleTool[] = [
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
  browserPressKeyTool,
  browserTypeTool,
  browserExecuteScriptTool,
  browserCloseTool,
];
