/**
 * Excel Launch Tools
 *
 * Tools for launching, creating, opening, closing, and quitting Excel
 * Also includes screenshot functionality
 */

import { ToolDefinition } from '../../../types/index.js';
import { LLMSimpleTool, ToolResult } from '../../types.js';
import { excelClient } from '../excel-client.js';
import { saveScreenshot } from '../common/utils.js';
import { OFFICE_SCREENSHOT_PATH_DESC, OFFICE_CATEGORIES } from '../common/constants.js';

// =============================================================================
// Excel Launch
// =============================================================================

const EXCEL_LAUNCH_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_launch',
    description: `Launch Microsoft Excel for spreadsheet editing.
Use this tool to start Excel before working with spreadsheets.
The Excel window will be visible so you can see the changes in real-time.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are launching Excel' },
      },
      required: ['reason'],
    },
  },
};

async function executeExcelLaunch(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelLaunch();
    if (response.success) {
      return { success: true, result: response.message || 'Excel launched successfully' };
    }
    return { success: false, error: response.error || 'Failed to launch Excel' };
  } catch (error) {
    return { success: false, error: `Failed to launch Excel: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelLaunchTool: LLMSimpleTool = {
  definition: EXCEL_LAUNCH_DEFINITION,
  execute: executeExcelLaunch,
  categories: OFFICE_CATEGORIES,
  description: 'Launch Microsoft Excel',
};

// =============================================================================
// Excel Create
// =============================================================================

const EXCEL_CREATE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_create',
    description: `Create a new Excel workbook.`,
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
  try {
    const response = await excelClient.excelCreate();
    if (response.success) {
      return { success: true, result: response.message || 'New workbook created' };
    }
    return { success: false, error: response.error || 'Failed to create workbook' };
  } catch (error) {
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
  try {
    const response = await excelClient.excelOpen(args['path'] as string);
    if (response.success) {
      return { success: true, result: `Workbook opened: ${response['workbook_name'] || args['path']}` };
    }
    return { success: false, error: response.error || 'Failed to open workbook' };
  } catch (error) {
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
  try {
    const response = await excelClient.excelSave(args['path'] as string | undefined);
    if (response.success) {
      return { success: true, result: `Workbook saved: ${response['path'] || 'current location'}` };
    }
    return { success: false, error: response.error || 'Failed to save workbook' };
  } catch (error) {
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
Captures the used range and saves to ${OFFICE_SCREENSHOT_PATH_DESC}.`,
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
  try {
    const response = await excelClient.excelScreenshot();
    if (response.success && response.image) {
      const filePath = await saveScreenshot(response.image, 'excel');
      return {
        success: true,
        result: `Excel screenshot saved to: ${filePath}`,
      };
    }
    return { success: false, error: response.error || 'Failed to capture screenshot' };
  } catch (error) {
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
  try {
    const response = await excelClient.excelClose(args['save'] === true);
    if (response.success) {
      return { success: true, result: `Workbook closed${args['save'] ? ' (saved)' : ''}` };
    }
    return { success: false, error: response.error || 'Failed to close workbook' };
  } catch (error) {
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
  try {
    const response = await excelClient.excelQuit(args['save'] === true);
    if (response.success) {
      return { success: true, result: `Excel closed${args['save'] ? ' (all workbooks saved)' : ''}` };
    }
    return { success: false, error: response.error || 'Failed to quit Excel' };
  } catch (error) {
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
  excelLaunchTool,
  excelCreateTool,
  excelOpenTool,
  excelSaveTool,
  excelScreenshotTool,
  excelCloseTool,
  excelQuitTool,
];
