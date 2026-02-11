/**
 * Word Launch Tools
 *
 * Tools for launching, creating, opening, saving, closing Word and taking screenshots
 */

import { ToolDefinition } from '../../../types/index';
import { LLMSimpleTool, ToolResult } from '../../types';
import { wordClient } from '../word-client';
import { saveScreenshot, delay, APP_LAUNCH_DELAY_MS } from '../common/utils';
import { OFFICE_SCREENSHOT_PATH_DESC, OFFICE_CATEGORIES } from '../common/constants';
import { logger } from '../../../utils/logger';

// =============================================================================
// Word Create (auto-launches Word if not running)
// =============================================================================

const WORD_CREATE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_create',
    description: `Create a new Word document. Automatically launches Word if it is not already running.
Use this tool to start working with a new document.`,
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
  const startTime = Date.now();
  logger.toolStart('word_create', _args);
  try {
    const response = await wordClient.wordCreate();
    if (response.success) {
      // Wait for document to fully load before LLM proceeds
      await delay(APP_LAUNCH_DELAY_MS);
      logger.toolSuccess('word_create', _args, { message: response.message }, Date.now() - startTime);
      return { success: true, result: response.message || 'New document created' };
    }
    logger.toolError('word_create', _args, new Error(response.error || 'Failed to create document'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to create document' };
  } catch (error) {
    logger.toolError('word_create', _args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
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
    description: `Open an existing Word document. WSL paths are automatically converted to Windows paths.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are opening this document' },
        path: { type: 'string', description: 'File path to open. Can use Linux/WSL paths or Windows paths.' },
      },
      required: ['reason', 'path'],
    },
  },
};

async function executeWordOpen(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('word_open', args);
  try {
    const response = await wordClient.wordOpen(args['path'] as string);
    if (response.success) {
      // Wait for document to fully load before LLM proceeds
      await delay(APP_LAUNCH_DELAY_MS);
      logger.toolSuccess('word_open', args, { document_name: response['document_name'] }, Date.now() - startTime);
      return { success: true, result: `Document opened: ${response['document_name'] || args['path']}` };
    }
    logger.toolError('word_open', args, new Error(response.error || 'Failed to open document'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to open document' };
  } catch (error) {
    logger.toolError('word_open', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
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
    description: `Save the active Word document. WSL paths are automatically converted to Windows paths.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are saving' },
        path: { type: 'string', description: 'File path to save to (optional). Can use Linux/WSL paths or Windows paths.' },
      },
      required: ['reason'],
    },
  },
};

async function executeWordSave(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  const filePath = args['path'] as string | undefined;
  logger.toolStart('word_save', args);

  try {
    const response = await wordClient.wordSave(filePath);
    if (response.success) {
      const savedPath = response['path'] as string || filePath || 'current location';
      logger.toolSuccess('word_save', args, { path: savedPath }, Date.now() - startTime);
      return { success: true, result: `Document saved to: ${savedPath}` };
    }
    logger.toolError('word_save', args, new Error(response.error || 'Failed to save document'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to save document' };
  } catch (error) {
    logger.toolError('word_save', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
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
// Word Screenshot
// =============================================================================

const WORD_SCREENSHOT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_screenshot',
    description: `Take a screenshot of the current Word document.
Captures the document content and saves to ${OFFICE_SCREENSHOT_PATH_DESC}.
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
  const startTime = Date.now();
  logger.toolStart('word_screenshot', _args);
  try {
    const response = await wordClient.wordScreenshot();
    if (response.success && response.image) {
      const filePath = await saveScreenshot(response.image, 'word');
      logger.toolSuccess('word_screenshot', _args, { filePath }, Date.now() - startTime);
      return {
        success: true,
        result: `Word screenshot saved to: ${filePath}\n\nYou can view this image using read_file tool if your LLM supports vision.`,
      };
    }
    logger.toolError('word_screenshot', _args, new Error(response.error || 'Failed to capture screenshot'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to capture screenshot' };
  } catch (error) {
    logger.toolError('word_screenshot', _args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
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
// Word Close
// =============================================================================

const WORD_CLOSE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_close',
    description: `Close the active Word document.
Optionally save before closing.`,
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
  const startTime = Date.now();
  const save = args['save'] === true;
  logger.toolStart('word_close', args);

  try {
    const response = await wordClient.wordClose(save);
    if (response.success) {
      logger.toolSuccess('word_close', args, { saved: save }, Date.now() - startTime);
      return { success: true, result: `Document closed${save ? ' (saved)' : ''}` };
    }
    logger.toolError('word_close', args, new Error(response.error || 'Failed to close document'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to close document' };
  } catch (error) {
    logger.toolError('word_close', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
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
    description: `Quit Microsoft Word application entirely.
Optionally save all documents before quitting.`,
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
  const startTime = Date.now();
  const save = args['save'] === true;
  logger.toolStart('word_quit', args);

  try {
    const response = await wordClient.wordQuit(save);
    if (response.success) {
      logger.toolSuccess('word_quit', args, { saved: save }, Date.now() - startTime);
      return { success: true, result: `Word closed${save ? ' (all documents saved)' : ''}` };
    }
    logger.toolError('word_quit', args, new Error(response.error || 'Failed to quit Word'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to quit Word' };
  } catch (error) {
    logger.toolError('word_quit', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
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
// Export Launch Tools
// =============================================================================

export const launchTools: LLMSimpleTool[] = [
  wordCreateTool,
  wordOpenTool,
  wordSaveTool,
  wordScreenshotTool,
  wordCloseTool,
  wordQuitTool,
];
