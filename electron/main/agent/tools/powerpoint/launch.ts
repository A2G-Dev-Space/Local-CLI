/**
 * PowerPoint Launch Tools
 *
 * Basic operations: launch, create, open, save, close, quit, screenshot
 * Total: 7 tools
 */

import { ToolDefinition } from '../../../llm-client';
import { LLMSimpleTool, ToolResult } from '../common/types';
import { OFFICE_CATEGORIES } from '../common/constants';
import { saveScreenshot } from '../common/utils';
import { powerpointClient } from '../../office';

// =============================================================================
// PowerPoint Launch
// =============================================================================

const PPT_LAUNCH_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_launch',
    description: `Launch Microsoft PowerPoint for presentation editing.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are launching PowerPoint' },
      },
      required: ['reason'],
    },
  },
};

async function executePPTLaunch(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointLaunch();
    if (response.success) {
      return { success: true, result: response.message || 'PowerPoint launched successfully' };
    }
    return { success: false, error: response.error || 'Failed to launch PowerPoint' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptLaunchTool: LLMSimpleTool = {
  definition: PPT_LAUNCH_DEFINITION, execute: executePPTLaunch, categories: OFFICE_CATEGORIES, description: 'Launch Microsoft PowerPoint',
};

// =============================================================================
// PowerPoint Create
// =============================================================================

const PPT_CREATE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_create',
    description: `Create a new PowerPoint presentation.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are creating a presentation' },
      },
      required: ['reason'],
    },
  },
};

async function executePPTCreate(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointCreate();
    if (response.success) {
      return { success: true, result: response.message || 'New presentation created' };
    }
    return { success: false, error: response.error || 'Failed to create presentation' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptCreateTool: LLMSimpleTool = {
  definition: PPT_CREATE_DEFINITION, execute: executePPTCreate, categories: OFFICE_CATEGORIES, description: 'Create new PowerPoint presentation',
};

// =============================================================================
// PowerPoint Open
// =============================================================================

const PPT_OPEN_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_open',
    description: `Open an existing PowerPoint presentation.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are opening this presentation' },
        path: { type: 'string', description: 'File path to open' },
      },
      required: ['reason', 'path'],
    },
  },
};

async function executePPTOpen(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointOpen(args['path'] as string);
    if (response.success) {
      return { success: true, result: `Presentation opened: ${response['presentation_name'] || args['path']}` };
    }
    return { success: false, error: response.error || 'Failed to open presentation' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptOpenTool: LLMSimpleTool = {
  definition: PPT_OPEN_DEFINITION, execute: executePPTOpen, categories: OFFICE_CATEGORIES, description: 'Open PowerPoint presentation',
};

// =============================================================================
// PowerPoint Save
// =============================================================================

const PPT_SAVE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_save',
    description: `Save the active PowerPoint presentation.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are saving' },
        path: { type: 'string', description: 'File path to save to (optional)' },
      },
      required: ['reason'],
    },
  },
};

async function executePPTSave(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointSave(args['path'] as string | undefined);
    if (response.success) {
      return { success: true, result: `Presentation saved: ${response['path'] || 'current location'}` };
    }
    return { success: false, error: response.error || 'Failed to save presentation' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptSaveTool: LLMSimpleTool = {
  definition: PPT_SAVE_DEFINITION, execute: executePPTSave, categories: OFFICE_CATEGORIES, description: 'Save PowerPoint presentation',
};

// =============================================================================
// PowerPoint Close
// =============================================================================

const PPT_CLOSE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_close',
    description: `Close the active PowerPoint presentation.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are closing' },
        save: { type: 'boolean', description: 'Whether to save before closing (default: false)' },
      },
      required: ['reason'],
    },
  },
};

async function executePPTClose(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const save = args['save'] === true;
    const response = await powerpointClient.powerpointClose(save);
    if (response.success) {
      return { success: true, result: `Presentation closed${save ? ' (saved)' : ''}` };
    }
    return { success: false, error: response.error || 'Failed to close presentation' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptCloseTool: LLMSimpleTool = {
  definition: PPT_CLOSE_DEFINITION, execute: executePPTClose, categories: OFFICE_CATEGORIES, description: 'Close PowerPoint presentation',
};

// =============================================================================
// PowerPoint Quit
// =============================================================================

const PPT_QUIT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_quit',
    description: `Quit Microsoft PowerPoint application entirely.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are quitting PowerPoint' },
        save: { type: 'boolean', description: 'Whether to save all presentations before quitting (default: false)' },
      },
      required: ['reason'],
    },
  },
};

async function executePPTQuit(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const save = args['save'] === true;
    const response = await powerpointClient.powerpointQuit(save);
    if (response.success) {
      return { success: true, result: `PowerPoint closed${save ? ' (all presentations saved)' : ''}` };
    }
    return { success: false, error: response.error || 'Failed to quit PowerPoint' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptQuitTool: LLMSimpleTool = {
  definition: PPT_QUIT_DEFINITION, execute: executePPTQuit, categories: OFFICE_CATEGORIES, description: 'Quit Microsoft PowerPoint',
};

// =============================================================================
// PowerPoint Screenshot
// =============================================================================

const PPT_SCREENSHOT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_screenshot',
    description: `Take a screenshot of the current slide.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are taking a screenshot' },
      },
      required: ['reason'],
    },
  },
};

async function executePPTScreenshot(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointScreenshot();
    if (response.success && response.image) {
      const filePath = await saveScreenshot(response.image, 'powerpoint');
      return { success: true, result: `PowerPoint screenshot saved to: ${filePath}` };
    }
    return { success: false, error: response.error || 'Failed to capture screenshot' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptScreenshotTool: LLMSimpleTool = {
  definition: PPT_SCREENSHOT_DEFINITION, execute: executePPTScreenshot, categories: OFFICE_CATEGORIES, description: 'Take PowerPoint slide screenshot',
};

// =============================================================================
// Export Launch Tools
// =============================================================================

export const launchTools: LLMSimpleTool[] = [
  pptLaunchTool,
  pptCreateTool,
  pptOpenTool,
  pptSaveTool,
  pptCloseTool,
  pptQuitTool,
  pptScreenshotTool,
];
