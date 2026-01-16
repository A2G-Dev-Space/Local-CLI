/**
 * Browser Automation Tools (LLM Simple)
 *
 * LLM이 브라우저를 제어할 수 있는 도구들
 * Category: LLM Simple Tools - LLM이 tool_call로 호출, Sub-LLM 없음
 *
 * Uses browser-server.exe via HTTP API (similar to office tools)
 */

import { ToolDefinition } from '../../types/index.js';
import { LLMSimpleTool, ToolResult, ToolCategory } from '../types.js';
import { browserClient } from './browser-client.js';

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
The browser runs on Windows via browser-server.exe for better stability.`,
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

  try {
    // Check if browser is already active
    if (await browserClient.isBrowserActive()) {
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
      return {
        success: false,
        error: response.error || 'Failed to launch browser',
      };
    }

    return {
      success: true,
      result: `${response['browser'] || browser} launched successfully (headless: ${headless})`,
    };
  } catch (error) {
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

  try {
    // Auto-launch if not running
    if (!(await browserClient.isBrowserActive())) {
      await browserClient.startServer();
      await browserClient.launch({ headless: false });
    }

    const response = await browserClient.navigate(url);

    if (!response.success) {
      return {
        success: false,
        error: response.error || 'Failed to navigate',
      };
    }

    return {
      success: true,
      result: `Navigated to ${response.url}\nPage title: ${response.title}`,
    };
  } catch (error) {
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
Screenshots are also saved to ~/.nexus-coder/screenshots/browser/
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

  try {
    if (!(await browserClient.isBrowserActive())) {
      return {
        success: false,
        error: 'Browser is not running. Use browser_launch first.',
      };
    }

    const response = await browserClient.screenshot(fullPage);

    if (!response.success || !response.image) {
      return {
        success: false,
        error: response.error || 'Failed to take screenshot',
      };
    }

    // Save screenshot to file
    const savedPath = browserClient.saveScreenshot(response.image, 'browser');

    return {
      success: true,
      result: `Screenshot captured of "${response.title}" (${response.url})\nSaved to: ${savedPath}`,
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

  try {
    if (!(await browserClient.isBrowserActive())) {
      return {
        success: false,
        error: 'Browser is not running. Use browser_launch first.',
      };
    }

    const response = await browserClient.click(selector);

    if (!response.success) {
      return {
        success: false,
        error: response.error || `Failed to click: ${selector}`,
      };
    }

    return {
      success: true,
      result: `Clicked element: ${selector}\nCurrent URL: ${response['current_url'] || 'unknown'}`,
    };
  } catch (error) {
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

  try {
    if (!(await browserClient.isBrowserActive())) {
      return {
        success: false,
        error: 'Browser is not running. Use browser_launch first.',
      };
    }

    const response = await browserClient.fill(selector, value);

    if (!response.success) {
      return {
        success: false,
        error: response.error || `Failed to fill: ${selector}`,
      };
    }

    return {
      success: true,
      result: `Filled "${selector}" with text (${value.length} characters)`,
    };
  } catch (error) {
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

  try {
    if (!(await browserClient.isBrowserActive())) {
      return {
        success: false,
        error: 'Browser is not running. Use browser_launch first.',
      };
    }

    const response = await browserClient.getText(selector);

    if (!response.success) {
      return {
        success: false,
        error: response.error || `Failed to get text: ${selector}`,
      };
    }

    return {
      success: true,
      result: (response['text'] as string) || '(empty)',
    };
  } catch (error) {
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

async function executeBrowserClose(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    await browserClient.close();

    return {
      success: true,
      result: 'Browser closed successfully',
    };
  } catch (error) {
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

async function executeBrowserGetContent(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    if (!(await browserClient.isBrowserActive())) {
      return {
        success: false,
        error: 'Browser is not running. Use browser_launch first.',
      };
    }

    const response = await browserClient.getHtml();

    if (!response.success) {
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

    return {
      success: true,
      result: `Page: ${response.title} (${response.url})\n\nHTML:\n${truncatedHtml}`,
    };
  } catch (error) {
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

async function executeBrowserGetConsole(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    if (!(await browserClient.isBrowserActive())) {
      return {
        success: false,
        error: 'Browser is not running. Use browser_launch first.',
      };
    }

    const response = await browserClient.getConsole();

    if (!response.success) {
      return {
        success: false,
        error: response.error || 'Failed to get console logs',
      };
    }

    const logs = response.logs || [];
    if (logs.length === 0) {
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

    return {
      success: true,
      result: `Console logs (${logs.length} messages):\n\n${formatted}`,
    };
  } catch (error) {
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

async function executeBrowserGetNetwork(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    if (!(await browserClient.isBrowserActive())) {
      return {
        success: false,
        error: 'Browser is not running. Use browser_launch first.',
      };
    }

    const response = await browserClient.getNetwork();

    if (!response.success) {
      return {
        success: false,
        error: response.error || 'Failed to get network logs',
      };
    }

    const logs = response.logs || [];
    if (logs.length === 0) {
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

    return {
      success: true,
      result: `Network logs (${logs.length} entries):\n\n${formatted}`,
    };
  } catch (error) {
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

async function executeBrowserFocus(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    if (!(await browserClient.isBrowserActive())) {
      return {
        success: false,
        error: 'Browser is not running. Use browser_launch first.',
      };
    }

    const response = await browserClient.focus();

    if (!response.success) {
      return {
        success: false,
        error: response.error || 'Failed to focus browser window',
      };
    }

    return {
      success: true,
      result: 'Browser window brought to foreground.',
    };
  } catch (error) {
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
  browserCloseTool,
];
