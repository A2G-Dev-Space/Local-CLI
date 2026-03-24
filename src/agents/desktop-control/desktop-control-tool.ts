/**
 * Desktop Control Tool — CLI Stub
 *
 * Desktop control is Electron-exclusive (requires Windows native access for
 * PowerShell-based screen capture and mouse/keyboard control).
 *
 * CLI always returns an error directing users to the Electron app.
 *
 * Electron parity: electron/main/agents/desktop-control/desktop-control-tool.ts
 */

import type { LLMSimpleTool } from '../../tools/types.js';

export function createDesktopControlTool(): LLMSimpleTool {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'desktop_control_agent',
        description: `Autonomous desktop control agent powered by Vision Language Model.
Takes a screenshot of the Windows desktop, analyzes it with a VLM, and executes mouse/keyboard actions to complete the task.
Use this for ANY Windows desktop automation: opening apps, clicking buttons, filling forms, navigating menus, file operations, etc.

IMPORTANT:
- Requires a Vision Language Model (VL model) to be configured in settings.
- Works on the ENTIRE Windows desktop, not just the browser.
- The agent sees the screen as a human would and controls mouse/keyboard.
- Best for tasks that require visual interaction with GUI applications.

Examples:
- "Open Notepad and type Hello World"
- "Navigate to Settings > Display and change resolution"
- "Open Chrome, go to google.com, and search for weather"
- "Right-click the desktop and create a new folder named Test"`,
        parameters: {
          type: 'object',
          properties: {
            task: {
              type: 'string',
              description: 'Detailed description of the desktop task to perform. Be specific about what to click, type, or interact with.',
            },
            max_steps: {
              type: 'number',
              description: 'Maximum number of screenshot-analyze-act cycles (default: 30). Increase for complex multi-step tasks.',
            },
          },
          required: ['task'],
        },
      },
    },
    categories: ['llm-simple'],
    async execute() {
      return {
        success: false,
        error: 'Desktop control is only available in the Electron app (LOCAL BOT). CLI does not support screen capture and mouse/keyboard control. Please use the Electron app for desktop automation.',
      };
    },
  };
}
