/**
 * Word Launch Tools
 *
 * Basic Word operations: launch, create, open, save, close, quit, screenshot
 * Total: 7 tools
 */

import { ToolDefinition } from '../../../llm-client';
import { LLMSimpleTool, ToolResult } from '../common/types';
import { OFFICE_CATEGORIES } from '../common/constants';
import { saveScreenshot } from '../common/utils';
import { wordClient } from '../../office';

// =============================================================================
// Word Launch
// =============================================================================

const WORD_LAUNCH_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_launch',
    description: `Launch Microsoft Word for document editing.
Use this tool to start Word before creating or editing documents.
The Word window will be visible so you can see the changes in real-time.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are launching Word' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordLaunch(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await wordClient.wordLaunch();
    if (response.success) {
      return { success: true, result: response.message || 'Word launched successfully' };
    }
    return { success: false, error: response.error || 'Failed to launch Word' };
  } catch (error) {
    return { success: false, error: `Failed to launch Word: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordLaunchTool: LLMSimpleTool = {
  definition: WORD_LAUNCH_DEFINITION,
  execute: executeWordLaunch,
  categories: OFFICE_CATEGORIES,
  description: 'Launch Microsoft Word',
};

// =============================================================================
// Word Create
// =============================================================================

const WORD_CREATE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_create',
    description: `Create a new Word document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are creating a document' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordCreate(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await wordClient.wordCreate();
    if (response.success) {
      return { success: true, result: response.message || 'New document created' };
    }
    return { success: false, error: response.error || 'Failed to create document' };
  } catch (error) {
    return { success: false, error: `Failed to create document: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordCreateTool: LLMSimpleTool = {
  definition: WORD_CREATE_DEFINITION,
  execute: executeWordCreate,
  categories: OFFICE_CATEGORIES,
  description: 'Create new Word document',
};

// =============================================================================
// Word Open
// =============================================================================

const WORD_OPEN_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_open',
    description: `Open an existing Word document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are opening this document' },
        path: { type: 'string', description: 'File path to open (Windows path)' },
      },
      required: ['reason', 'path'],
    },
  },
};

async function executeWordOpen(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await wordClient.wordOpen(args['path'] as string);
    if (response.success) {
      return { success: true, result: `Document opened: ${response['document_name'] || args['path']}` };
    }
    return { success: false, error: response.error || 'Failed to open document' };
  } catch (error) {
    return { success: false, error: `Failed to open document: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordOpenTool: LLMSimpleTool = {
  definition: WORD_OPEN_DEFINITION,
  execute: executeWordOpen,
  categories: OFFICE_CATEGORIES,
  description: 'Open existing Word document',
};

// =============================================================================
// Word Save
// =============================================================================

const WORD_SAVE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_save',
    description: `Save the active Word document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are saving' },
        path: { type: 'string', description: 'File path to save to (optional, uses existing path if not provided)' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordSave(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await wordClient.wordSave(args['path'] as string | undefined);
    if (response.success) {
      const savedPath = response['path'] as string || args['path'] || 'current location';
      return { success: true, result: `Document saved to: ${savedPath}` };
    }
    return { success: false, error: response.error || 'Failed to save document' };
  } catch (error) {
    return { success: false, error: `Failed to save document: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordSaveTool: LLMSimpleTool = {
  definition: WORD_SAVE_DEFINITION,
  execute: executeWordSave,
  categories: OFFICE_CATEGORIES,
  description: 'Save Word document',
};

// =============================================================================
// Word Close
// =============================================================================

const WORD_CLOSE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_close',
    description: `Close the active Word document. Optionally save before closing.`,
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

async function executeWordClose(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const save = args['save'] === true;
    const response = await wordClient.wordClose(save);
    if (response.success) {
      return { success: true, result: `Document closed${save ? ' (saved)' : ''}` };
    }
    return { success: false, error: response.error || 'Failed to close document' };
  } catch (error) {
    return { success: false, error: `Failed to close document: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordCloseTool: LLMSimpleTool = {
  definition: WORD_CLOSE_DEFINITION,
  execute: executeWordClose,
  categories: OFFICE_CATEGORIES,
  description: 'Close Word document',
};

// =============================================================================
// Word Quit
// =============================================================================

const WORD_QUIT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_quit',
    description: `Quit Microsoft Word application entirely. Optionally save all documents before quitting.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are quitting Word' },
        save: { type: 'boolean', description: 'Whether to save all documents before quitting (default: false)' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordQuit(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const save = args['save'] === true;
    const response = await wordClient.wordQuit(save);
    if (response.success) {
      return { success: true, result: `Word closed${save ? ' (all documents saved)' : ''}` };
    }
    return { success: false, error: response.error || 'Failed to quit Word' };
  } catch (error) {
    return { success: false, error: `Failed to quit Word: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordQuitTool: LLMSimpleTool = {
  definition: WORD_QUIT_DEFINITION,
  execute: executeWordQuit,
  categories: OFFICE_CATEGORIES,
  description: 'Quit Microsoft Word',
};

// =============================================================================
// Word Screenshot
// =============================================================================

const WORD_SCREENSHOT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_screenshot',
    description: `Take a screenshot of the current Word document.
Captures the document content and saves to AppData folder.
Use this to verify document formatting or show the user what the document looks like.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are taking a screenshot' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordScreenshot(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await wordClient.wordScreenshot();
    if (response.success && response.image) {
      const filePath = await saveScreenshot(response.image, 'word');
      return {
        success: true,
        result: `Word screenshot saved to: ${filePath}`,
        metadata: { filepath: filePath },
      };
    }
    return { success: false, error: response.error || 'Failed to capture screenshot' };
  } catch (error) {
    return { success: false, error: `Failed to capture screenshot: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordScreenshotTool: LLMSimpleTool = {
  definition: WORD_SCREENSHOT_DEFINITION,
  execute: executeWordScreenshot,
  categories: OFFICE_CATEGORIES,
  description: 'Take Word window screenshot',
};

// =============================================================================
// Export Launch Tools
// =============================================================================

export const launchTools: LLMSimpleTool[] = [
  wordLaunchTool,
  wordCreateTool,
  wordOpenTool,
  wordSaveTool,
  wordCloseTool,
  wordQuitTool,
  wordScreenshotTool,
];
