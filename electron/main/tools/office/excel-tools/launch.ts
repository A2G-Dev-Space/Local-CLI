/**
 * Excel Launch Tools
 *
 * Tools for launching, creating, opening, closing, and quitting Excel
 * Also includes screenshot functionality
 */

import { ToolDefinition } from '../../../types/index';
import { LLMSimpleTool, ToolResult } from '../../types';
import { excelClient } from '../excel-client';
import { saveScreenshot, delay, APP_LAUNCH_DELAY_MS } from '../common/utils';
import { OFFICE_CATEGORIES } from '../common/constants';
import { logger } from '../../../utils/logger';

// =============================================================================
// Excel Create (auto-launches Excel if not running)
// =============================================================================

const EXCEL_CREATE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_create',
    description: `Create a new Excel workbook. Automatically launches Excel if it is not already running.
Use this tool to start working with a new spreadsheet.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are creating a workbook' },
      },
      required: ['reason'],
    },
  },
};

async function executeExcelCreate(_args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_create', _args);
  try {
    const response = await excelClient.excelCreate();
    if (response.success) {
      // Wait for workbook to fully load before LLM proceeds
      await delay(APP_LAUNCH_DELAY_MS);
      logger.toolSuccess('excel_create', _args, { message: response.message }, Date.now() - startTime);
      return { success: true, result: response.message || 'New workbook created' };
    }
    logger.toolError('excel_create', _args, new Error(response.error || 'Failed to create workbook'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to create workbook' };
  } catch (error) {
    logger.toolError('excel_create', _args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to create workbook: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelCreateTool: LLMSimpleTool = {
  definition: EXCEL_CREATE_DEFINITION,
  execute: executeExcelCreate,
  categories: OFFICE_CATEGORIES,
  description: 'Create new Excel workbook',
};

// =============================================================================
// Excel Open
// =============================================================================

const EXCEL_OPEN_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_open',
    description: `Open an existing Excel workbook. WSL paths are automatically converted to Windows paths.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are opening this workbook' },
        path: { type: 'string', description: 'File path to open. Can use Linux/WSL paths or Windows paths.' },
      },
      required: ['reason', 'path'],
    },
  },
};

async function executeExcelOpen(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_open', args);
  try {
    const response = await excelClient.excelOpen(args['path'] as string);
    if (response.success) {
      // Wait for workbook to fully load before LLM proceeds
      await delay(APP_LAUNCH_DELAY_MS);
      logger.toolSuccess('excel_open', args, { workbookName: response['workbook_name'], path: args['path'] }, Date.now() - startTime);
      return { success: true, result: `Workbook opened: ${response['workbook_name'] || args['path']}` };
    }
    logger.toolError('excel_open', args, new Error(response.error || 'Failed to open workbook'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to open workbook' };
  } catch (error) {
    logger.toolError('excel_open', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to open workbook: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelOpenTool: LLMSimpleTool = {
  definition: EXCEL_OPEN_DEFINITION,
  execute: executeExcelOpen,
  categories: OFFICE_CATEGORIES,
  description: 'Open existing Excel workbook',
};

// =============================================================================
// Excel Save
// =============================================================================

const EXCEL_SAVE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_save',
    description: `Save the active Excel workbook. WSL paths are automatically converted to Windows paths.`,
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

async function executeExcelSave(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_save', args);
  try {
    const response = await excelClient.excelSave(args['path'] as string | undefined);
    if (response.success) {
      logger.toolSuccess('excel_save', args, { path: response['path'] }, Date.now() - startTime);
      return { success: true, result: `Workbook saved: ${response['path'] || 'current location'}` };
    }
    logger.toolError('excel_save', args, new Error(response.error || 'Failed to save workbook'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to save workbook' };
  } catch (error) {
    logger.toolError('excel_save', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to save workbook: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelSaveTool: LLMSimpleTool = {
  definition: EXCEL_SAVE_DEFINITION,
  execute: executeExcelSave,
  categories: OFFICE_CATEGORIES,
  description: 'Save Excel workbook',
};

// =============================================================================
// Excel Screenshot
// =============================================================================

const EXCEL_SCREENSHOT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_screenshot',
    description: `Take a screenshot of the current Excel worksheet.
Captures the used range and saves to the current working directory.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are taking a screenshot' },
      },
      required: ['reason'],
    },
  },
};

async function executeExcelScreenshot(_args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_screenshot', _args);
  try {
    const response = await excelClient.excelScreenshot();
    if (response.success && response.image) {
      const filePath = await saveScreenshot(response.image, 'excel');
      logger.toolSuccess('excel_screenshot', _args, { filePath }, Date.now() - startTime);
      return {
        success: true,
        result: `Excel screenshot saved to: ${filePath}\n\nTo verify this screenshot, call read_image with file_path="${filePath}"`,
      };
    }
    logger.toolError('excel_screenshot', _args, new Error(response.error || 'Failed to capture screenshot'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to capture screenshot' };
  } catch (error) {
    logger.toolError('excel_screenshot', _args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to capture screenshot: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelScreenshotTool: LLMSimpleTool = {
  definition: EXCEL_SCREENSHOT_DEFINITION,
  execute: executeExcelScreenshot,
  categories: OFFICE_CATEGORIES,
  description: 'Take Excel window screenshot',
};

// =============================================================================
// Excel Close
// =============================================================================

const EXCEL_CLOSE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_close',
    description: `Close the active Excel workbook.`,
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

async function executeExcelClose(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_close', args);
  try {
    const response = await excelClient.excelClose(args['save'] === true);
    if (response.success) {
      logger.toolSuccess('excel_close', args, { saved: args['save'] === true }, Date.now() - startTime);
      return { success: true, result: `Workbook closed${args['save'] ? ' (saved)' : ''}` };
    }
    logger.toolError('excel_close', args, new Error(response.error || 'Failed to close workbook'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to close workbook' };
  } catch (error) {
    logger.toolError('excel_close', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to close workbook: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelCloseTool: LLMSimpleTool = {
  definition: EXCEL_CLOSE_DEFINITION,
  execute: executeExcelClose,
  categories: OFFICE_CATEGORIES,
  description: 'Close Excel workbook',
};

// =============================================================================
// Excel Quit
// =============================================================================

const EXCEL_QUIT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_quit',
    description: `Quit Microsoft Excel application entirely.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are quitting Excel' },
        save: { type: 'boolean', description: 'Whether to save all workbooks before quitting (default: false)' },
      },
      required: ['reason'],
    },
  },
};

async function executeExcelQuit(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_quit', args);
  try {
    const response = await excelClient.excelQuit(args['save'] === true);
    if (response.success) {
      logger.toolSuccess('excel_quit', args, { saved: args['save'] === true }, Date.now() - startTime);
      return { success: true, result: `Excel closed${args['save'] ? ' (all workbooks saved)' : ''}` };
    }
    logger.toolError('excel_quit', args, new Error(response.error || 'Failed to quit Excel'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to quit Excel' };
  } catch (error) {
    logger.toolError('excel_quit', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to quit Excel: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelQuitTool: LLMSimpleTool = {
  definition: EXCEL_QUIT_DEFINITION,
  execute: executeExcelQuit,
  categories: OFFICE_CATEGORIES,
  description: 'Quit Microsoft Excel',
};

// =============================================================================
// Export All Launch Tools
// =============================================================================

export const launchTools: LLMSimpleTool[] = [
  excelCreateTool,
  excelOpenTool,
  excelSaveTool,
  excelScreenshotTool,
  excelCloseTool,
  excelQuitTool,
];
