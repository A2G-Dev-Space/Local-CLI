/**
 * Excel Sheet Management Tools
 *
 * Tools for managing worksheets in Excel workbooks:
 * - Add, delete, rename sheets
 * - Get sheet list
 * - Select/activate sheets
 */

import { ToolDefinition } from '../../../types/index';
import { LLMSimpleTool, ToolResult } from '../../types';
import { excelClient } from '../excel-client';
import { OFFICE_CATEGORIES } from '../common/constants';
import { logger } from '../../../utils/logger';

// =============================================================================
// Excel Add Sheet
// =============================================================================

const EXCEL_ADD_SHEET_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_add_sheet',
    description: `Add a new worksheet.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding a sheet' },
        name: { type: 'string', description: 'Sheet name (optional)' },
        position: { type: 'string', description: 'Position: "start", "end", or after specific sheet name' },
      },
      required: ['reason'],
    },
  },
};

async function executeExcelAddSheet(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_add_sheet', args);
  try {
    const response = await excelClient.excelAddSheet(
      args['name'] as string | undefined,
      args['position'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_add_sheet', args, { sheetName: response['sheet_name'] }, Date.now() - startTime);
      return { success: true, result: `Sheet added: ${response['sheet_name'] || 'new sheet'}` };
    }
    logger.toolError('excel_add_sheet', args, new Error(response.error || 'Failed to add sheet'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to add sheet' };
  } catch (error) {
    logger.toolError('excel_add_sheet', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to add sheet: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelAddSheetTool: LLMSimpleTool = {
  definition: EXCEL_ADD_SHEET_DEFINITION,
  execute: executeExcelAddSheet,
  categories: OFFICE_CATEGORIES,
  description: 'Add Excel worksheet',
};

// =============================================================================
// Excel Delete Sheet
// =============================================================================

const EXCEL_DELETE_SHEET_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_delete_sheet',
    description: `Delete a worksheet.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are deleting this sheet' },
        name: { type: 'string', description: 'Sheet name to delete' },
      },
      required: ['reason', 'name'],
    },
  },
};

async function executeExcelDeleteSheet(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_delete_sheet', args);
  try {
    const response = await excelClient.excelDeleteSheet(args['name'] as string);
    if (response.success) {
      logger.toolSuccess('excel_delete_sheet', args, { sheetName: args['name'] }, Date.now() - startTime);
      return { success: true, result: `Sheet deleted: ${args['name']}` };
    }
    logger.toolError('excel_delete_sheet', args, new Error(response.error || 'Failed to delete sheet'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to delete sheet' };
  } catch (error) {
    logger.toolError('excel_delete_sheet', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to delete sheet: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelDeleteSheetTool: LLMSimpleTool = {
  definition: EXCEL_DELETE_SHEET_DEFINITION,
  execute: executeExcelDeleteSheet,
  categories: OFFICE_CATEGORIES,
  description: 'Delete Excel worksheet',
};

// =============================================================================
// Excel Rename Sheet
// =============================================================================

const EXCEL_RENAME_SHEET_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_rename_sheet',
    description: `Rename a worksheet.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are renaming this sheet' },
        old_name: { type: 'string', description: 'Current sheet name' },
        new_name: { type: 'string', description: 'New sheet name' },
      },
      required: ['reason', 'old_name', 'new_name'],
    },
  },
};

async function executeExcelRenameSheet(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_rename_sheet', args);
  try {
    const response = await excelClient.excelRenameSheet(
      args['old_name'] as string,
      args['new_name'] as string
    );
    if (response.success) {
      logger.toolSuccess('excel_rename_sheet', args, { oldName: args['old_name'], newName: args['new_name'] }, Date.now() - startTime);
      return { success: true, result: `Sheet renamed: ${args['old_name']} → ${args['new_name']}` };
    }
    logger.toolError('excel_rename_sheet', args, new Error(response.error || 'Failed to rename sheet'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to rename sheet' };
  } catch (error) {
    logger.toolError('excel_rename_sheet', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to rename sheet: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelRenameSheetTool: LLMSimpleTool = {
  definition: EXCEL_RENAME_SHEET_DEFINITION,
  execute: executeExcelRenameSheet,
  categories: OFFICE_CATEGORIES,
  description: 'Rename Excel worksheet',
};

// =============================================================================
// Excel Get Sheets
// =============================================================================

const EXCEL_GET_SHEETS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_get_sheets',
    description: `Get list of all worksheets in the workbook.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you need the sheet list' },
      },
      required: ['reason'],
    },
  },
};

async function executeExcelGetSheets(_args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_get_sheets', _args);
  try {
    const response = await excelClient.excelGetSheets();
    if (response.success) {
      const sheets = response['sheets'] as string[] || [];
      logger.toolSuccess('excel_get_sheets', _args, { sheetCount: sheets.length }, Date.now() - startTime);
      return { success: true, result: `Sheets: ${sheets.join(', ')}` };
    }
    logger.toolError('excel_get_sheets', _args, new Error(response.error || 'Failed to get sheets'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to get sheets' };
  } catch (error) {
    logger.toolError('excel_get_sheets', _args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to get sheets: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelGetSheetsTool: LLMSimpleTool = {
  definition: EXCEL_GET_SHEETS_DEFINITION,
  execute: executeExcelGetSheets,
  categories: OFFICE_CATEGORIES,
  description: 'Get Excel worksheet list',
};

// =============================================================================
// Excel Select Sheet
// =============================================================================

const EXCEL_SELECT_SHEET_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_select_sheet',
    description: `Activate/select a worksheet.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are selecting sheet' },
        name: { type: 'string', description: 'Sheet name to select' },
      },
      required: ['reason', 'name'],
    },
  },
};

async function executeExcelSelectSheet(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_select_sheet', args);
  try {
    const response = await excelClient.excelSelectSheet(args['name'] as string);
    if (response.success) {
      logger.toolSuccess('excel_select_sheet', args, { sheetName: args['name'] }, Date.now() - startTime);
      return { success: true, result: `Sheet "${args['name']}" activated` };
    }
    logger.toolError('excel_select_sheet', args, new Error(response.error || 'Failed to select sheet'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to select sheet' };
  } catch (error) {
    logger.toolError('excel_select_sheet', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to select sheet: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelSelectSheetTool: LLMSimpleTool = {
  definition: EXCEL_SELECT_SHEET_DEFINITION,
  execute: executeExcelSelectSheet,
  categories: OFFICE_CATEGORIES,
  description: 'Select Excel sheet',
};

// =============================================================================
// Export All Sheet Tools
// =============================================================================

export const sheetsTools: LLMSimpleTool[] = [
  excelAddSheetTool,
  excelDeleteSheetTool,
  excelRenameSheetTool,
  excelGetSheetsTool,
  excelSelectSheetTool,
];
