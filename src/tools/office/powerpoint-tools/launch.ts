/**
 * PowerPoint Launch Tools
 *
 * Tools for launching, creating, opening, closing, quitting PowerPoint
 * and taking screenshots.
 */

import { ToolDefinition } from '../../../types/index.js';
import { LLMSimpleTool, ToolResult } from '../../types.js';
import { powerpointClient } from '../powerpoint-client.js';
import { saveScreenshot } from '../common/utils.js';
import { OFFICE_SCREENSHOT_PATH_DESC, OFFICE_CATEGORIES } from '../common/constants.js';

// =============================================================================
// PowerPoint Create (auto-launches PowerPoint if not running)
// =============================================================================

const POWERPOINT_CREATE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_create',
    description: `Create a new PowerPoint presentation. Automatically launches PowerPoint if it is not already running.
Use this tool to start working with a new presentation.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are creating a presentation' },
      },
      required: ['reason'],
    },
  },
};

async function executePowerPointCreate(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointCreate();
    if (response.success) {
      return { success: true, result: response.message || 'New presentation created' };
    }
    return { success: false, error: response.error || 'Failed to create presentation' };
  } catch (error) {
    return { success: false, error: `Failed to create presentation: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointCreateTool: LLMSimpleTool = {
  definition: POWERPOINT_CREATE_DEFINITION,
  execute: executePowerPointCreate,
  categories: OFFICE_CATEGORIES,
  description: 'Create new PowerPoint presentation',
};

// =============================================================================
// PowerPoint Open
// =============================================================================

const POWERPOINT_OPEN_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_open',
    description: `Open an existing PowerPoint presentation. WSL paths are automatically converted to Windows paths.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are opening this presentation' },
        path: { type: 'string', description: 'File path to open. Can use Linux/WSL paths or Windows paths.' },
      },
      required: ['reason', 'path'],
    },
  },
};

async function executePowerPointOpen(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointOpen(args['path'] as string);
    if (response.success) {
      return { success: true, result: `Presentation opened: ${response['presentation_name'] || args['path']}` };
    }
    return { success: false, error: response.error || 'Failed to open presentation' };
  } catch (error) {
    return { success: false, error: `Failed to open presentation: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointOpenTool: LLMSimpleTool = {
  definition: POWERPOINT_OPEN_DEFINITION,
  execute: executePowerPointOpen,
  categories: OFFICE_CATEGORIES,
  description: 'Open existing PowerPoint presentation',
};

// =============================================================================
// PowerPoint Screenshot
// =============================================================================

const POWERPOINT_SCREENSHOT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_screenshot',
    description: `Take a screenshot of the current slide.
Saves to ${OFFICE_SCREENSHOT_PATH_DESC}.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are taking a screenshot' },
      },
      required: ['reason'],
    },
  },
};

async function executePowerPointScreenshot(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointScreenshot();
    if (response.success && response.image) {
      const filePath = await saveScreenshot(response.image, 'powerpoint');
      return {
        success: true,
        result: `PowerPoint screenshot saved to: ${filePath}`,
      };
    }
    return { success: false, error: response.error || 'Failed to capture screenshot' };
  } catch (error) {
    return { success: false, error: `Failed to capture screenshot: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointScreenshotTool: LLMSimpleTool = {
  definition: POWERPOINT_SCREENSHOT_DEFINITION,
  execute: executePowerPointScreenshot,
  categories: OFFICE_CATEGORIES,
  description: 'Take PowerPoint slide screenshot',
};

// =============================================================================
// PowerPoint Close
// =============================================================================

const POWERPOINT_CLOSE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_close',
    description: `Close the active presentation.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are closing' },
        save: { type: 'boolean', description: 'Whether to save before closing (default: false)' },
      },
      required: ['reason'],
    },
  },
};

async function executePowerPointClose(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointClose(args['save'] === true);
    if (response.success) {
      return { success: true, result: `Presentation closed${args['save'] ? ' (saved)' : ''}` };
    }
    return { success: false, error: response.error || 'Failed to close presentation' };
  } catch (error) {
    return { success: false, error: `Failed to close presentation: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointCloseTool: LLMSimpleTool = {
  definition: POWERPOINT_CLOSE_DEFINITION,
  execute: executePowerPointClose,
  categories: OFFICE_CATEGORIES,
  description: 'Close PowerPoint presentation',
};

// =============================================================================
// PowerPoint Quit
// =============================================================================

const POWERPOINT_QUIT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_quit',
    description: `Quit Microsoft PowerPoint application entirely.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are quitting PowerPoint' },
        save: { type: 'boolean', description: 'Whether to save all presentations before quitting (default: false)' },
      },
      required: ['reason'],
    },
  },
};

async function executePowerPointQuit(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointQuit(args['save'] === true);
    if (response.success) {
      return { success: true, result: `PowerPoint closed${args['save'] ? ' (all presentations saved)' : ''}` };
    }
    return { success: false, error: response.error || 'Failed to quit PowerPoint' };
  } catch (error) {
    return { success: false, error: `Failed to quit PowerPoint: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointQuitTool: LLMSimpleTool = {
  definition: POWERPOINT_QUIT_DEFINITION,
  execute: executePowerPointQuit,
  categories: OFFICE_CATEGORIES,
  description: 'Quit Microsoft PowerPoint',
};

// =============================================================================
// Export
// =============================================================================

export const launchTools: LLMSimpleTool[] = [
  powerpointCreateTool,
  powerpointOpenTool,
  powerpointScreenshotTool,
  powerpointCloseTool,
  powerpointQuitTool,
];
