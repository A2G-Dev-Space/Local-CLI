/**
 * Tool Definitions for Electron Agent
 * JSON Schema definitions for tools that LLM can call
 *
 * NOTE: This is Windows/PowerShell based (NOT bash/WSL)
 */

import { ToolDefinition } from '../llm-client';

// =============================================================================
// File Tools
// =============================================================================

/**
 * read_file - Read file contents
 */
export const READ_FILE_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'read_file',
    description: `Read the contents of a file. Only text files are supported.
By default, reads up to 2000 lines. Use offset/limit for large files.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: `A natural, conversational explanation for the user about what you're doing.
Write as if you're talking to the user directly. Use the same language as the user.
Examples:
- "Checking how the current authentication logic is implemented"
- "Opening the file where the error occurred to find the problem"
- "Checking package.json to understand the project setup"`,
        },
        file_path: {
          type: 'string',
          description: 'Absolute or relative path of the file to read',
        },
        offset: {
          type: 'number',
          description: 'Starting line number (1-based, default: 1)',
        },
        limit: {
          type: 'number',
          description: 'Number of lines to read (default: 2000, max: 10000)',
        },
      },
      required: ['reason', 'file_path'],
    },
  },
};

/**
 * create_file - Create a new file
 */
export const CREATE_FILE_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'create_file',
    description: `Create a NEW file with the given content.
IMPORTANT: Only use this for files that do NOT exist yet.
For modifying existing files, use edit_file instead.
If the file already exists, this tool will fail.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: `A natural, conversational explanation for the user about what you're doing.
Write as if you're talking to the user directly. Use the same language as the user.
Examples:
- "Creating a new file for the authentication service"
- "Creating a new test config file since one doesn't exist"
- "Adding a new component file"`,
        },
        file_path: {
          type: 'string',
          description: 'Absolute or relative path of the new file to create',
        },
        content: {
          type: 'string',
          description: 'Content to write to the new file',
        },
      },
      required: ['reason', 'file_path', 'content'],
    },
  },
};

/**
 * edit_file - Edit an existing file
 */
export const EDIT_FILE_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'edit_file',
    description: `Edit an EXISTING file by replacing a specific text block.
IMPORTANT: Only use this for files that already exist. For new files, use create_file.

HOW TO USE:
1. First use read_file to see the current content
2. Copy the EXACT text block you want to change (can be multiple lines)
3. Provide old_string (text to find) and new_string (replacement)

RULES:
- old_string must match EXACTLY (including whitespace and indentation)
- old_string must be UNIQUE in the file (if it appears multiple times, use replace_all: true)
- Both old_string and new_string can be multi-line
- To delete text, use empty string "" for new_string

EXAMPLES:
1. Change a single line:
   old_string: "const x = 1;"
   new_string: "const x = 2;"

2. Replace all occurrences:
   old_string: "oldName"
   new_string: "newName"
   replace_all: true`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: `A natural, conversational explanation for the user about what you're doing.
Write as if you're talking to the user directly. Use the same language as the user.
Examples:
- "Fixing the buggy section"
- "Changing the function name as requested"
- "Adding the import statement"`,
        },
        file_path: {
          type: 'string',
          description: 'Path of the existing file to edit',
        },
        old_string: {
          type: 'string',
          description: 'The exact text to find and replace (can be multi-line)',
        },
        new_string: {
          type: 'string',
          description: 'The new text to replace with (can be multi-line, use "" to delete)',
        },
        replace_all: {
          type: 'boolean',
          description: 'If true, replace ALL occurrences of old_string. Default is false.',
        },
      },
      required: ['reason', 'file_path', 'old_string', 'new_string'],
    },
  },
};

/**
 * list_files - List files in a directory
 */
export const LIST_FILES_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'list_files',
    description: 'List files and folders in a directory.',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: `A natural, conversational explanation for the user about what you're doing.
Examples:
- "Looking at the folder structure to understand the project"
- "Checking what files are available"
- "Seeing what's inside the src folder"`,
        },
        directory_path: {
          type: 'string',
          description: 'Directory path to list (default: current directory)',
        },
        recursive: {
          type: 'boolean',
          description: 'Whether to list subdirectories recursively (default: false)',
        },
      },
      required: ['reason'],
    },
  },
};

/**
 * find_files - Search for files by pattern
 */
export const FIND_FILES_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'find_files',
    description: 'Search for files by filename pattern.',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: `A natural, conversational explanation for what you're searching for.
Examples:
- "Looking for where the config files are located"
- "Searching for test files"
- "Checking where TypeScript files are"`,
        },
        pattern: {
          type: 'string',
          description: 'Filename pattern to search for (e.g., *.ts, package.json)',
        },
        directory_path: {
          type: 'string',
          description: 'Directory to start search from (default: current directory)',
        },
      },
      required: ['reason', 'pattern'],
    },
  },
};

/**
 * search_content - Search for text in files
 */
export const SEARCH_CONTENT_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'search_content',
    description: 'Search for text patterns in files within a directory. Uses regex pattern matching.',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: `A natural, conversational explanation of what you're searching for.
Examples:
- "Finding where the login function is defined"
- "Looking for all usages of this API endpoint"
- "Searching for error handling patterns"`,
        },
        pattern: {
          type: 'string',
          description: 'Text pattern to search for (supports regex)',
        },
        directory_path: {
          type: 'string',
          description: 'Directory to search in (default: current directory)',
        },
        file_pattern: {
          type: 'string',
          description: 'File pattern to filter (e.g., *.ts, *.js)',
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of results to return (default: 50)',
        },
      },
      required: ['reason', 'pattern'],
    },
  },
};

// =============================================================================
// Shell Tools (PowerShell - Windows Native)
// =============================================================================

/**
 * powershell - Execute PowerShell command (Windows Native)
 * NOTE: This is for Windows, NOT bash/WSL
 */
export const POWERSHELL_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powershell',
    description: `Execute a PowerShell command on Windows. Use this to run terminal commands like git, npm, docker, python, etc.

IMPORTANT:
- Do NOT use for file reading/writing - use read_file, create_file, edit_file instead
- Commands have a 30 second timeout by default
- Dangerous commands (Remove-Item -Recurse -Force C:\\, Stop-Computer, Format-Volume, etc.) are blocked
- Output is truncated if too long
- Use PowerShell syntax, not bash syntax (e.g., "ls" works but "rm -rf" does not)

COMMON POWERSHELL EQUIVALENTS:
- List files: Get-ChildItem (or ls)
- Change directory: Set-Location (or cd)
- Copy file: Copy-Item (or cp)
- Move file: Move-Item (or mv)
- Delete file: Remove-Item (or rm)
- Cat file: Get-Content (or cat)
- Echo: Write-Output (or echo)
- Grep: Select-String`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: `A natural, conversational explanation for the user about what you're doing.
Examples:
- "Installing project dependencies"
- "Running tests to check the results"
- "Checking git status"
- "Running the build"`,
        },
        command: {
          type: 'string',
          description: 'The PowerShell command to execute',
        },
        cwd: {
          type: 'string',
          description: 'Working directory for the command (optional)',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds (optional, default: 30000)',
        },
      },
      required: ['reason', 'command'],
    },
  },
};

// =============================================================================
// TODO Management Tools
// =============================================================================

/**
 * write_todos - Update the entire TODO list
 */
export const WRITE_TODOS_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'write_todos',
    description: `Replace the entire TODO list with a new list.

Use this to:
- Update TODO statuses (change status field)
- Add new TODOs (include in the array)
- Remove TODOs (omit from the array)
- Reorder TODOs (change array order)

IMPORTANT: You must include ALL TODOs you want to keep. Any TODO not in the array will be removed.

**CRITICAL: Keep TODO status in sync with your actual progress!**
- When starting a task → mark it "in_progress" IMMEDIATELY
- When finishing a task → mark it "completed" IMMEDIATELY
- Call this tool FREQUENTLY, not just at the end

Example:
{
  "todos": [
    { "id": "1", "title": "Setup project", "status": "completed" },
    { "id": "2", "title": "Implement feature", "status": "in_progress" },
    { "id": "3", "title": "Write tests", "status": "pending" }
  ]
}`,
    parameters: {
      type: 'object',
      properties: {
        todos: {
          type: 'array',
          description: 'The complete TODO list (replaces existing list)',
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Unique ID for the TODO',
              },
              title: {
                type: 'string',
                description: 'Short title describing the task',
              },
              status: {
                type: 'string',
                enum: ['pending', 'in_progress', 'completed', 'failed'],
                description: 'Current status of the TODO',
              },
            },
            required: ['id', 'title', 'status'],
          },
        },
      },
      required: ['todos'],
    },
  },
};

// =============================================================================
// Background Shell Tools
// =============================================================================

/**
 * powershell_background_start - Start a background PowerShell command
 */
export const POWERSHELL_BACKGROUND_START_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powershell_background_start',
    description: `Start a long-running PowerShell command in the background.
Use this for commands that may take a long time (e.g., npm install, builds, tests).

Returns a task ID that you can use with powershell_background_read to check output.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation for the user about what you\'re doing',
        },
        command: {
          type: 'string',
          description: 'The PowerShell command to run in background',
        },
        cwd: {
          type: 'string',
          description: 'Working directory (optional)',
        },
      },
      required: ['reason', 'command'],
    },
  },
};

/**
 * powershell_background_read - Read output from a background task
 */
export const POWERSHELL_BACKGROUND_READ_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powershell_background_read',
    description: `Read the current output from a background PowerShell task.
Use the task_id returned from powershell_background_start.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation for the user about what you\'re doing',
        },
        task_id: {
          type: 'string',
          description: 'The task ID returned from powershell_background_start',
        },
      },
      required: ['reason', 'task_id'],
    },
  },
};

/**
 * powershell_background_stop - Stop a background task
 */
export const POWERSHELL_BACKGROUND_STOP_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powershell_background_stop',
    description: `Stop a running background PowerShell task.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation for the user about what you\'re doing',
        },
        task_id: {
          type: 'string',
          description: 'The task ID to stop',
        },
      },
      required: ['reason', 'task_id'],
    },
  },
};

// =============================================================================
// Docs Search Tool
// =============================================================================

/**
 * call_docs_search_agent - Search local documentation
 */
export const CALL_DOCS_SEARCH_AGENT_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'call_docs_search_agent',
    description: `Search the local documentation (ADK, Agno framework docs).
Use this when you need to find information about:
- Agent frameworks (ADK, Agno)
- Tools, memory, sessions, knowledge management
- MCP, workflows, models

This searches downloaded documentation and returns relevant excerpts.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation for the user about what you\'re searching for',
        },
        query: {
          type: 'string',
          description: 'Search query (keywords or question)',
        },
        source: {
          type: 'string',
          enum: ['all', 'adk', 'agno'],
          description: 'Which documentation to search (default: all)',
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of results (default: 5)',
        },
      },
      required: ['reason', 'query'],
    },
  },
};

// =============================================================================
// User Interaction Tools
// =============================================================================

/**
 * tell_to_user - Send a message to the user
 */
export const TELL_TO_USER_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'tell_to_user',
    description: `Send a message directly to the user to explain what you're doing or provide status updates.
Use this tool to communicate with the user during task execution.
The message will be displayed immediately in the UI.`,
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: `A natural, conversational message for the user (in user's language).
Examples:
- "Analyzing the files, please wait a moment"
- "Found the config file! Let me modify it now"
- "Ran the tests and 2 failed. Let me find the cause"
- "Almost done, wrapping up the work"`,
        },
      },
      required: ['message'],
    },
  },
};

/**
 * ask_to_user - Ask user a question with options
 */
export const ASK_TO_USER_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'ask_to_user',
    description: `Ask the user a question with multiple choice options.

Use this tool when you need to:
- Clarify ambiguous requirements
- Get user preferences or decisions
- Confirm important actions before proceeding
- Offer multiple implementation approaches

The user will always have an "Other (custom input)" option to provide custom input,
so you only need to provide the main choices.

RULES:
- Provide 2-4 clear, distinct options
- Each option should be a viable choice
- Keep the question concise and specific
- "Other" option is automatically added for custom input`,
    parameters: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'The question to ask the user. Should be clear and specific.',
        },
        options: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of main options for the user to choose from. Provide 2-4 options.',
          minItems: 2,
          maxItems: 4,
        },
      },
      required: ['question', 'options'],
    },
  },
};

// =============================================================================
// Tool Groups
// =============================================================================

export const FILE_TOOLS = [
  READ_FILE_TOOL,
  CREATE_FILE_TOOL,
  EDIT_FILE_TOOL,
  LIST_FILES_TOOL,
  FIND_FILES_TOOL,
  SEARCH_CONTENT_TOOL,
];

export const SHELL_TOOLS = [POWERSHELL_TOOL];

export const BACKGROUND_SHELL_TOOLS = [
  POWERSHELL_BACKGROUND_START_TOOL,
  POWERSHELL_BACKGROUND_READ_TOOL,
  POWERSHELL_BACKGROUND_STOP_TOOL,
];

export const TODO_TOOLS = [WRITE_TODOS_TOOL];

export const DOCS_TOOLS = [CALL_DOCS_SEARCH_AGENT_TOOL];

export const USER_TOOLS = [TELL_TO_USER_TOOL, ASK_TO_USER_TOOL];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get all available tools
 */
export function getAllTools(): ToolDefinition[] {
  return [
    ...FILE_TOOLS,
    ...SHELL_TOOLS,
    ...BACKGROUND_SHELL_TOOLS,
    ...TODO_TOOLS,
    ...DOCS_TOOLS,
    ...USER_TOOLS,
  ];
}

/**
 * Get tool by name
 */
export function getToolByName(name: string): ToolDefinition | undefined {
  return getAllTools().find((t) => t.function.name === name);
}

/**
 * Get tool names as array
 */
export function getToolNames(): string[] {
  return getAllTools().map((t) => t.function.name);
}

/**
 * Get tool summary for system prompt
 */
export function getToolSummary(): string {
  return `## Available Tools

**File Operations:**
- **read_file**: Read file contents to understand existing code
- **create_file**: Create a NEW file (fails if file exists)
- **edit_file**: Edit an EXISTING file by replacing specific text
- **list_files**: List directory contents
- **find_files**: Search for files by pattern
- **search_content**: Search for text patterns in files

**Shell (PowerShell):**
- **powershell**: Execute PowerShell commands (git, npm, etc.)
- **powershell_background_start**: Start long-running command in background
- **powershell_background_read**: Read background task output
- **powershell_background_stop**: Stop a background task

**TODO Management:**
- **write_todos**: Update entire TODO list (replaces current list)

**Documentation Search:**
- **call_docs_search_agent**: Search local ADK/Agno documentation

**User Interaction:**
- **tell_to_user**: Send status updates to the user
- **ask_to_user**: Ask user a question with multiple choice options`;
}

// =============================================================================
// Browser Automation Tools (Windows Native CDP)
// =============================================================================

/**
 * browser_launch - Launch Chrome/Edge browser
 */
export const BROWSER_LAUNCH_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'browser_launch',
    description: `Launch Chrome or Edge browser for automation.
Uses Chrome DevTools Protocol (CDP) for control.
If browser is already running, returns existing session.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation for the user about what you\'re doing',
        },
        browser: {
          type: 'string',
          enum: ['chrome', 'edge'],
          description: 'Browser to launch (default: chrome, falls back to edge if not available)',
        },
        headless: {
          type: 'boolean',
          description: 'Run in headless mode (default: false)',
        },
      },
      required: ['reason'],
    },
  },
};

/**
 * browser_navigate - Navigate to URL
 */
export const BROWSER_NAVIGATE_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'browser_navigate',
    description: `Navigate to a URL in the browser. Waits for page load to complete.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation for the user about what you\'re doing',
        },
        url: {
          type: 'string',
          description: 'URL to navigate to (must include http:// or https://)',
        },
      },
      required: ['reason', 'url'],
    },
  },
};

/**
 * browser_click - Click an element
 */
export const BROWSER_CLICK_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'browser_click',
    description: `Click an element on the page using CSS selector.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation for the user about what you\'re doing',
        },
        selector: {
          type: 'string',
          description: 'CSS selector of the element to click (e.g., "#submit-btn", ".login-button")',
        },
      },
      required: ['reason', 'selector'],
    },
  },
};

/**
 * browser_type - Type text into an element
 */
export const BROWSER_TYPE_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'browser_type',
    description: `Type text into an input field or textarea.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation for the user about what you\'re doing',
        },
        selector: {
          type: 'string',
          description: 'CSS selector of the input element',
        },
        text: {
          type: 'string',
          description: 'Text to type into the element',
        },
        clear: {
          type: 'boolean',
          description: 'Clear existing text before typing (default: true)',
        },
      },
      required: ['reason', 'selector', 'text'],
    },
  },
};

/**
 * browser_screenshot - Take a screenshot
 */
export const BROWSER_SCREENSHOT_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'browser_screenshot',
    description: `Take a screenshot of the current page.
Returns base64 encoded PNG image and saves to file.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation for the user about what you\'re doing',
        },
        full_page: {
          type: 'boolean',
          description: 'Capture full scrollable page (default: false, captures visible area only)',
        },
      },
      required: ['reason'],
    },
  },
};

/**
 * browser_get_html - Get page HTML content
 */
export const BROWSER_GET_HTML_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'browser_get_html',
    description: `Get the HTML content of the current page or a specific element.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation for the user about what you\'re doing',
        },
        selector: {
          type: 'string',
          description: 'CSS selector to get HTML of specific element (optional, gets full page if not provided)',
        },
      },
      required: ['reason'],
    },
  },
};

/**
 * browser_wait - Wait for element or time
 */
export const BROWSER_WAIT_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'browser_wait',
    description: `Wait for an element to appear or for a specified time.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation for the user about what you\'re doing',
        },
        selector: {
          type: 'string',
          description: 'CSS selector to wait for (optional)',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in seconds (default: 10)',
        },
      },
      required: ['reason'],
    },
  },
};

/**
 * browser_close - Close the browser
 */
export const BROWSER_CLOSE_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'browser_close',
    description: `Close the browser and end the automation session.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation for the user about what you\'re doing',
        },
      },
      required: ['reason'],
    },
  },
};

// Browser tools array
export const BROWSER_TOOLS = [
  BROWSER_LAUNCH_TOOL,
  BROWSER_NAVIGATE_TOOL,
  BROWSER_CLICK_TOOL,
  BROWSER_TYPE_TOOL,
  BROWSER_SCREENSHOT_TOOL,
  BROWSER_GET_HTML_TOOL,
  BROWSER_WAIT_TOOL,
  BROWSER_CLOSE_TOOL,
];

// =============================================================================
// Microsoft Word Tools (Windows Native PowerShell COM)
// =============================================================================

/**
 * word_launch - Launch Microsoft Word
 */
export const WORD_LAUNCH_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_launch',
    description: `Launch Microsoft Word application.
If Word is already running, returns existing instance.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation for the user about what you\'re doing',
        },
      },
      required: ['reason'],
    },
  },
};

/**
 * word_create - Create new document
 */
export const WORD_CREATE_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_create',
    description: `Create a new Word document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation for the user about what you\'re doing',
        },
      },
      required: ['reason'],
    },
  },
};

/**
 * word_open - Open existing document
 */
export const WORD_OPEN_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_open',
    description: `Open an existing Word document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation for the user about what you\'re doing',
        },
        file_path: {
          type: 'string',
          description: 'Path to the Word document to open',
        },
      },
      required: ['reason', 'file_path'],
    },
  },
};

/**
 * word_write - Write content to document
 */
export const WORD_WRITE_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_write',
    description: `Write text content to the active Word document.
Text is appended at the current cursor position.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation for the user about what you\'re doing',
        },
        text: {
          type: 'string',
          description: 'Text content to write',
        },
        style: {
          type: 'string',
          enum: ['Normal', 'Heading 1', 'Heading 2', 'Heading 3', 'Title'],
          description: 'Style to apply (optional)',
        },
      },
      required: ['reason', 'text'],
    },
  },
};

/**
 * word_read - Read document content
 */
export const WORD_READ_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_read',
    description: `Read the text content from the active Word document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation for the user about what you\'re doing',
        },
      },
      required: ['reason'],
    },
  },
};

/**
 * word_save - Save document
 */
export const WORD_SAVE_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_save',
    description: `Save the active Word document.
If file_path is provided, saves as new file (SaveAs).`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation for the user about what you\'re doing',
        },
        file_path: {
          type: 'string',
          description: 'Path to save as (optional, uses existing path if not provided)',
        },
      },
      required: ['reason'],
    },
  },
};

/**
 * word_export_pdf - Export to PDF
 */
export const WORD_EXPORT_PDF_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_export_pdf',
    description: `Export the active Word document to PDF format.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation for the user about what you\'re doing',
        },
        output_path: {
          type: 'string',
          description: 'Path for the PDF output file',
        },
      },
      required: ['reason', 'output_path'],
    },
  },
};

/**
 * word_close - Close document
 */
export const WORD_CLOSE_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_close',
    description: `Close the active Word document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation for the user about what you\'re doing',
        },
        save: {
          type: 'boolean',
          description: 'Save before closing (default: true)',
        },
      },
      required: ['reason'],
    },
  },
};

// Word tools array
export const WORD_TOOLS = [
  WORD_LAUNCH_TOOL,
  WORD_CREATE_TOOL,
  WORD_OPEN_TOOL,
  WORD_WRITE_TOOL,
  WORD_READ_TOOL,
  WORD_SAVE_TOOL,
  WORD_EXPORT_PDF_TOOL,
  WORD_CLOSE_TOOL,
];

// =============================================================================
// Microsoft Excel Tools (Windows Native PowerShell COM)
// =============================================================================

/**
 * excel_launch - Launch Microsoft Excel
 */
export const EXCEL_LAUNCH_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_launch',
    description: `Launch Microsoft Excel application.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation for the user about what you\'re doing',
        },
      },
      required: ['reason'],
    },
  },
};

/**
 * excel_create - Create new workbook
 */
export const EXCEL_CREATE_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_create',
    description: `Create a new Excel workbook.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation for the user about what you\'re doing',
        },
      },
      required: ['reason'],
    },
  },
};

/**
 * excel_open - Open existing workbook
 */
export const EXCEL_OPEN_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_open',
    description: `Open an existing Excel workbook.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation for the user about what you\'re doing',
        },
        file_path: {
          type: 'string',
          description: 'Path to the Excel file to open',
        },
      },
      required: ['reason', 'file_path'],
    },
  },
};

/**
 * excel_write_cell - Write to a cell
 */
export const EXCEL_WRITE_CELL_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_write_cell',
    description: `Write a value to a specific cell in Excel.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation for the user about what you\'re doing',
        },
        cell: {
          type: 'string',
          description: 'Cell reference (e.g., "A1", "B2", "C10")',
        },
        value: {
          type: 'string',
          description: 'Value to write to the cell',
        },
        sheet: {
          type: 'string',
          description: 'Sheet name (optional, uses active sheet if not provided)',
        },
      },
      required: ['reason', 'cell', 'value'],
    },
  },
};

/**
 * excel_write_range - Write to a range
 */
export const EXCEL_WRITE_RANGE_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_write_range',
    description: `Write multiple values to a range of cells.
Provide values as a 2D array (rows of columns).`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation for the user about what you\'re doing',
        },
        start_cell: {
          type: 'string',
          description: 'Starting cell reference (e.g., "A1")',
        },
        values: {
          type: 'array',
          items: {
            type: 'array',
            items: { type: 'string' },
          },
          description: '2D array of values: [[row1_col1, row1_col2], [row2_col1, row2_col2]]',
        },
        sheet: {
          type: 'string',
          description: 'Sheet name (optional)',
        },
      },
      required: ['reason', 'start_cell', 'values'],
    },
  },
};

/**
 * excel_read_range - Read a range of cells
 */
export const EXCEL_READ_RANGE_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_read_range',
    description: `Read values from a range of cells.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation for the user about what you\'re doing',
        },
        range: {
          type: 'string',
          description: 'Range to read (e.g., "A1:C10", "A1:A100")',
        },
        sheet: {
          type: 'string',
          description: 'Sheet name (optional)',
        },
      },
      required: ['reason', 'range'],
    },
  },
};

/**
 * excel_set_formula - Set a formula in a cell
 */
export const EXCEL_SET_FORMULA_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_set_formula',
    description: `Set a formula in a cell.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation for the user about what you\'re doing',
        },
        cell: {
          type: 'string',
          description: 'Cell reference',
        },
        formula: {
          type: 'string',
          description: 'Formula to set (e.g., "=SUM(A1:A10)", "=AVERAGE(B1:B5)")',
        },
        sheet: {
          type: 'string',
          description: 'Sheet name (optional)',
        },
      },
      required: ['reason', 'cell', 'formula'],
    },
  },
};

/**
 * excel_save - Save workbook
 */
export const EXCEL_SAVE_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_save',
    description: `Save the active Excel workbook.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation for the user about what you\'re doing',
        },
        file_path: {
          type: 'string',
          description: 'Path to save as (optional)',
        },
      },
      required: ['reason'],
    },
  },
};

/**
 * excel_close - Close workbook
 */
export const EXCEL_CLOSE_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_close',
    description: `Close the active Excel workbook.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation for the user about what you\'re doing',
        },
        save: {
          type: 'boolean',
          description: 'Save before closing (default: true)',
        },
      },
      required: ['reason'],
    },
  },
};

// Excel tools array
export const EXCEL_TOOLS = [
  EXCEL_LAUNCH_TOOL,
  EXCEL_CREATE_TOOL,
  EXCEL_OPEN_TOOL,
  EXCEL_WRITE_CELL_TOOL,
  EXCEL_WRITE_RANGE_TOOL,
  EXCEL_READ_RANGE_TOOL,
  EXCEL_SET_FORMULA_TOOL,
  EXCEL_SAVE_TOOL,
  EXCEL_CLOSE_TOOL,
];

// =============================================================================
// Microsoft PowerPoint Tools (Windows Native PowerShell COM)
// =============================================================================

/**
 * powerpoint_launch - Launch Microsoft PowerPoint
 */
export const POWERPOINT_LAUNCH_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_launch',
    description: `Launch Microsoft PowerPoint application.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation for the user about what you\'re doing',
        },
      },
      required: ['reason'],
    },
  },
};

/**
 * powerpoint_create - Create new presentation
 */
export const POWERPOINT_CREATE_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_create',
    description: `Create a new PowerPoint presentation.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation for the user about what you\'re doing',
        },
      },
      required: ['reason'],
    },
  },
};

/**
 * powerpoint_open - Open existing presentation
 */
export const POWERPOINT_OPEN_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_open',
    description: `Open an existing PowerPoint presentation.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation for the user about what you\'re doing',
        },
        file_path: {
          type: 'string',
          description: 'Path to the PowerPoint file to open',
        },
      },
      required: ['reason', 'file_path'],
    },
  },
};

/**
 * powerpoint_add_slide - Add a slide
 */
export const POWERPOINT_ADD_SLIDE_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_add_slide',
    description: `Add a new slide to the presentation.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation for the user about what you\'re doing',
        },
        layout: {
          type: 'string',
          enum: ['title', 'title_content', 'blank', 'two_content'],
          description: 'Slide layout (default: title_content)',
        },
        title: {
          type: 'string',
          description: 'Slide title text (optional)',
        },
        content: {
          type: 'string',
          description: 'Slide content text (optional)',
        },
      },
      required: ['reason'],
    },
  },
};

/**
 * powerpoint_write_text - Write text to a slide
 */
export const POWERPOINT_WRITE_TEXT_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_write_text',
    description: `Write text to a specific slide.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation for the user about what you\'re doing',
        },
        slide_number: {
          type: 'number',
          description: 'Slide number (1-based)',
        },
        text: {
          type: 'string',
          description: 'Text to write',
        },
        placeholder: {
          type: 'string',
          enum: ['title', 'content', 'subtitle'],
          description: 'Which placeholder to write to (default: content)',
        },
      },
      required: ['reason', 'slide_number', 'text'],
    },
  },
};

/**
 * powerpoint_save - Save presentation
 */
export const POWERPOINT_SAVE_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_save',
    description: `Save the active PowerPoint presentation.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation for the user about what you\'re doing',
        },
        file_path: {
          type: 'string',
          description: 'Path to save as (optional)',
        },
      },
      required: ['reason'],
    },
  },
};

/**
 * powerpoint_export_pdf - Export to PDF
 */
export const POWERPOINT_EXPORT_PDF_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_export_pdf',
    description: `Export the presentation to PDF format.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation for the user about what you\'re doing',
        },
        output_path: {
          type: 'string',
          description: 'Path for the PDF output file',
        },
      },
      required: ['reason', 'output_path'],
    },
  },
};

/**
 * powerpoint_close - Close presentation
 */
export const POWERPOINT_CLOSE_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_close',
    description: `Close the active PowerPoint presentation.`,
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Explanation for the user about what you\'re doing',
        },
        save: {
          type: 'boolean',
          description: 'Save before closing (default: true)',
        },
      },
      required: ['reason'],
    },
  },
};

// PowerPoint tools array
export const POWERPOINT_TOOLS = [
  POWERPOINT_LAUNCH_TOOL,
  POWERPOINT_CREATE_TOOL,
  POWERPOINT_OPEN_TOOL,
  POWERPOINT_ADD_SLIDE_TOOL,
  POWERPOINT_WRITE_TEXT_TOOL,
  POWERPOINT_SAVE_TOOL,
  POWERPOINT_EXPORT_PDF_TOOL,
  POWERPOINT_CLOSE_TOOL,
];

// =============================================================================
// Optional Tool Support
// =============================================================================

/**
 * Optional tool group ID type
 */
export type OptionalToolGroupId = 'browser' | 'word' | 'excel' | 'powerpoint';

/**
 * Optional tools mapping
 */
export const OPTIONAL_TOOLS: Record<OptionalToolGroupId, ToolDefinition[]> = {
  browser: BROWSER_TOOLS,
  word: WORD_TOOLS,
  excel: EXCEL_TOOLS,
  powerpoint: POWERPOINT_TOOLS,
};

/**
 * Get tools including enabled optional tools
 */
export function getToolsWithOptional(enabledGroups: OptionalToolGroupId[]): ToolDefinition[] {
  const baseTools = getAllTools();
  const optionalTools: ToolDefinition[] = [];

  for (const groupId of enabledGroups) {
    optionalTools.push(...(OPTIONAL_TOOLS[groupId] || []));
  }

  return [...baseTools, ...optionalTools];
}

/**
 * Get tool summary including enabled optional tools
 */
export function getToolSummaryWithOptional(enabledGroups: OptionalToolGroupId[]): string {
  let summary = getToolSummary();

  if (enabledGroups.includes('browser')) {
    summary += `

**Browser Automation:**
- **browser_launch**: Launch Chrome/Edge browser
- **browser_navigate**: Navigate to a URL
- **browser_click**: Click an element
- **browser_type**: Type text into an element
- **browser_screenshot**: Take a screenshot
- **browser_close**: Close the browser`;
  }

  if (enabledGroups.includes('word')) {
    summary += `

**Microsoft Word:**
- **word_launch**: Launch Microsoft Word
- **word_create**: Create a new document
- **word_write**: Write content to document
- **word_read**: Read document content
- **word_save**: Save the document
- **word_export_pdf**: Export to PDF`;
  }

  if (enabledGroups.includes('excel')) {
    summary += `

**Microsoft Excel:**
- **excel_launch**: Launch Microsoft Excel
- **excel_create**: Create a new workbook
- **excel_write_cell**: Write to a cell
- **excel_read_range**: Read a range of cells
- **excel_save**: Save the workbook`;
  }

  if (enabledGroups.includes('powerpoint')) {
    summary += `

**Microsoft PowerPoint:**
- **powerpoint_launch**: Launch Microsoft PowerPoint
- **powerpoint_create**: Create a new presentation
- **powerpoint_add_slide**: Add a slide
- **powerpoint_save**: Save the presentation`;
  }

  return summary;
}
