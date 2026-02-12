/**
 * PowerPoint Launch Tools
 *
 * Tools for launching, creating, opening, closing, quitting PowerPoint
 * and taking screenshots.
 */

import { ToolDefinition } from '../../../types/index';
import { LLMSimpleTool, ToolResult } from '../../types';
import { powerpointClient } from '../powerpoint-client';
import { saveScreenshot, delay, APP_LAUNCH_DELAY_MS } from '../common/utils';
import { OFFICE_CATEGORIES } from '../common/constants';
import { logger } from '../../../utils/logger';

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
  const startTime = Date.now();
  logger.toolStart('powerpoint_create', _args);
  try {
    const response = await powerpointClient.powerpointCreate();
    if (response.success) {
      // Wait for presentation to fully load before LLM proceeds
      await delay(APP_LAUNCH_DELAY_MS);
      logger.toolSuccess('powerpoint_create', _args, { message: response.message }, Date.now() - startTime);
      return { success: true, result: response.message || 'New presentation created' };
    }
    logger.toolError('powerpoint_create', _args, new Error(response.error || 'Failed to create presentation'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to create presentation' };
  } catch (error) {
    logger.toolError('powerpoint_create', _args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
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
  const startTime = Date.now();
  logger.toolStart('powerpoint_open', args);
  try {
    const response = await powerpointClient.powerpointOpen(args['path'] as string);
    if (response.success) {
      // Wait for presentation to fully load before LLM proceeds
      await delay(APP_LAUNCH_DELAY_MS);
      logger.toolSuccess('powerpoint_open', args, { presentationName: response['presentation_name'], path: args['path'] }, Date.now() - startTime);
      return { success: true, result: `Presentation opened: ${response['presentation_name'] || args['path']}` };
    }
    logger.toolError('powerpoint_open', args, new Error(response.error || 'Failed to open presentation'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to open presentation' };
  } catch (error) {
    logger.toolError('powerpoint_open', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
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
Saves to the current working directory.`,
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
  const startTime = Date.now();
  logger.toolStart('powerpoint_screenshot', _args);
  try {
    const response = await powerpointClient.powerpointScreenshot();
    if (response.success && response.image) {
      const filePath = await saveScreenshot(response.image, 'powerpoint');
      logger.toolSuccess('powerpoint_screenshot', _args, { filePath }, Date.now() - startTime);
      return {
        success: true,
        result: `PowerPoint screenshot saved to: ${filePath}\n\nTo verify this screenshot, call read_image with file_path="${filePath}"`,
      };
    }
    logger.toolError('powerpoint_screenshot', _args, new Error(response.error || 'Failed to capture screenshot'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to capture screenshot' };
  } catch (error) {
    logger.toolError('powerpoint_screenshot', _args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
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
  const startTime = Date.now();
  logger.toolStart('powerpoint_close', args);
  try {
    const response = await powerpointClient.powerpointClose(args['save'] === true);
    if (response.success) {
      logger.toolSuccess('powerpoint_close', args, { saved: args['save'] === true }, Date.now() - startTime);
      return { success: true, result: `Presentation closed${args['save'] ? ' (saved)' : ''}` };
    }
    logger.toolError('powerpoint_close', args, new Error(response.error || 'Failed to close presentation'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to close presentation' };
  } catch (error) {
    logger.toolError('powerpoint_close', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
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
  const startTime = Date.now();
  logger.toolStart('powerpoint_quit', args);
  try {
    const response = await powerpointClient.powerpointQuit(args['save'] === true);
    if (response.success) {
      logger.toolSuccess('powerpoint_quit', args, { saved: args['save'] === true }, Date.now() - startTime);
      return { success: true, result: `PowerPoint closed${args['save'] ? ' (all presentations saved)' : ''}` };
    }
    logger.toolError('powerpoint_quit', args, new Error(response.error || 'Failed to quit PowerPoint'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to quit PowerPoint' };
  } catch (error) {
    logger.toolError('powerpoint_quit', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
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
