/**
 * Browser Automation Tools (LLM Simple)
 *
 * LLM이 브라우저를 제어할 수 있는 도구들
 * Category: LLM Simple Tools - LLM이 tool_call로 호출, Sub-LLM 없음
 *
 * 이 도구들은 /tool 명령어로 활성화/비활성화 가능
 */

import { ToolDefinition } from '../../types/index.js';
import { LLMSimpleTool, ToolResult, ToolCategory } from '../types.js';
import { cdpClient, ConsoleMessage } from './cdp-client.js';

const BROWSER_CATEGORIES: ToolCategory[] = ['llm-simple'];

/**
 * browser_launch Tool Definition
 */
const BROWSER_LAUNCH_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'browser_launch',
    description: `Launch Chrome browser for web testing and automation.
Use this tool to start a browser session before navigating to pages.
The browser will run in visible mode by default so you can see what's happening.`,
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
      },
      required: ['reason'],
    },
  },
};

async function executeBrowserLaunch(args: Record<string, unknown>): Promise<ToolResult> {
  const headless = args['headless'] === true; // default false (visible)

  try {
    if (cdpClient.isConnected()) {
      return {
        success: true,
        result: 'Browser is already running.',
      };
    }

    await cdpClient.launch({ headless });

    return {
      success: true,
      result: `Browser launched successfully (headless: ${headless})`,
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
  description: 'Launch Chrome browser',
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
    if (!cdpClient.isConnected()) {
      // Auto-launch if not connected
      await cdpClient.launch({ headless: false });
    }

    await cdpClient.navigate(url);
    const title = await cdpClient.getTitle();

    return {
      success: true,
      result: `Navigated to ${url}\nPage title: ${title}`,
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
Use this to verify that pages loaded correctly or to check UI elements.
If your model returns an error about not supporting images, use browser_get_content instead.`,
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
    if (!cdpClient.isConnected()) {
      return {
        success: false,
        error: 'Browser is not running. Use browser_launch first.',
      };
    }

    const base64Image = await cdpClient.screenshot({ fullPage });
    const currentUrl = await cdpClient.getUrl();
    const title = await cdpClient.getTitle();

    return {
      success: true,
      result: `Screenshot captured of "${title}" (${currentUrl})`,
      metadata: {
        image: base64Image,
        imageType: 'image/png',
        encoding: 'base64',
        url: currentUrl,
        title: title,
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
    if (!cdpClient.isConnected()) {
      return {
        success: false,
        error: 'Browser is not running. Use browser_launch first.',
      };
    }

    await cdpClient.click(selector);

    // Small delay to allow page to react
    await new Promise(r => setTimeout(r, 500));

    const currentUrl = await cdpClient.getUrl();

    return {
      success: true,
      result: `Clicked element: ${selector}\nCurrent URL: ${currentUrl}`,
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
    if (!cdpClient.isConnected()) {
      return {
        success: false,
        error: 'Browser is not running. Use browser_launch first.',
      };
    }

    await cdpClient.fill(selector, value);

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
    if (!cdpClient.isConnected()) {
      return {
        success: false,
        error: 'Browser is not running. Use browser_launch first.',
      };
    }

    const text = await cdpClient.getText(selector);

    return {
      success: true,
      result: text || '(empty)',
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
    await cdpClient.close();

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
 * Returns accessibility tree - more efficient than raw HTML for understanding page structure
 */
const BROWSER_GET_CONTENT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'browser_get_content',
    description: `Get the accessibility tree of the current page.
This returns a structured view of all interactive elements (buttons, links, inputs, etc.)
with their roles and names. Much more efficient than HTML for understanding what actions are available.

Use this tool when you need to:
- Find clickable elements and their selectors
- Understand the page structure
- Check form fields and their current values
- Verify UI state (checkboxes, expanded menus, etc.)`,
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
    if (!cdpClient.isConnected()) {
      return {
        success: false,
        error: 'Browser is not running. Use browser_launch first.',
      };
    }

    const accessibilityTree = await cdpClient.getAccessibilityTree();
    const url = await cdpClient.getUrl();
    const title = await cdpClient.getTitle();

    return {
      success: true,
      result: `Page: ${title} (${url})\n\nAccessibility Tree:\n${accessibilityTree}`,
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
  description: 'Get page accessibility tree',
};

/**
 * browser_get_console Tool Definition
 * Returns console logs captured during the session
 */
const BROWSER_GET_CONSOLE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'browser_get_console',
    description: `Get console logs from the browser.
Returns all console.log, console.error, console.warn messages captured during the session.

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
        filter: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['log', 'info', 'warn', 'error', 'debug'],
          },
          description: 'Filter by log type (default: all types). Example: ["error", "warn"] to see only errors and warnings.',
        },
        clear: {
          type: 'boolean',
          description: 'Clear the console log buffer after reading (default: false)',
        },
      },
      required: ['reason'],
    },
  },
};

async function executeBrowserGetConsole(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    if (!cdpClient.isConnected()) {
      return {
        success: false,
        error: 'Browser is not running. Use browser_launch first.',
      };
    }

    const filter = args['filter'] as ConsoleMessage['type'][] | undefined;
    const clear = args['clear'] === true;

    const messages = cdpClient.getConsoleMessages({ filter, clear });

    if (messages.length === 0) {
      return {
        success: true,
        result: 'No console messages captured.',
      };
    }

    // Format messages
    const formatted = messages.map(m => {
      const timestamp = new Date(m.timestamp).toISOString().split('T')[1]?.slice(0, 8) || '';
      const location = m.url ? ` (${m.url}:${m.lineNumber})` : '';
      const typeIcon = {
        log: '📝',
        info: 'ℹ️',
        warn: '⚠️',
        error: '❌',
        debug: '🔍',
      }[m.type] || '•';

      return `[${timestamp}] ${typeIcon} ${m.type.toUpperCase()}: ${m.text}${location}`;
    }).join('\n');

    return {
      success: true,
      result: `Console logs (${messages.length} messages):\n\n${formatted}`,
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
  browserCloseTool,
];
