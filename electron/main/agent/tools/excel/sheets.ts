/**
 * Excel Sheet Tools
 *
 * Sheet operations: addSheet, deleteSheet, renameSheet, getSheets, selectSheet
 * Total: 5 tools
 */

import { ToolDefinition } from '../../../llm-client';
import { LLMSimpleTool, ToolResult } from '../common/types';
import { OFFICE_CATEGORIES } from '../common/constants';
import { excelClient } from '../../office';

// =============================================================================
// Excel Add Sheet
// =============================================================================

const EXCEL_ADD_SHEET_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_add_sheet',
    description: `Add a new worksheet to the workbook.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding a sheet' },
        name: { type: 'string', description: 'Name for the new sheet (optional)' },
        position: { type: 'string', description: 'Position: "start", "end", or after specific sheet name' },
      },
      required: ['reason'],
    },
  },
};

async function executeExcelAddSheet(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelAddSheet(
      args['name'] as string | undefined,
      args['position'] as 'start' | 'end' | string | undefined
    );
    if (response.success) {
      return { success: true, result: `Sheet added: ${response['sheet_name']}` };
    }
    return { success: false, error: response.error || 'Failed to add sheet' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelAddSheetTool: LLMSimpleTool = {
  definition: EXCEL_ADD_SHEET_DEFINITION, execute: executeExcelAddSheet, categories: OFFICE_CATEGORIES, description: 'Add worksheet in Excel',
};

// =============================================================================
// Excel Delete Sheet
// =============================================================================

const EXCEL_DELETE_SHEET_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_delete_sheet',
    description: `Delete a worksheet from the workbook.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are deleting this sheet' },
        name: { type: 'string', description: 'Name of the sheet to delete' },
      },
      required: ['reason', 'name'],
    },
  },
};

async function executeExcelDeleteSheet(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelDeleteSheet(args['name'] as string);
    if (response.success) { return { success: true, result: `Sheet '${args['name']}' deleted` }; }
    return { success: false, error: response.error || 'Failed to delete sheet' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelDeleteSheetTool: LLMSimpleTool = {
  definition: EXCEL_DELETE_SHEET_DEFINITION, execute: executeExcelDeleteSheet, categories: OFFICE_CATEGORIES, description: 'Delete worksheet in Excel',
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
        old_name: { type: 'string', description: 'Current name of the sheet' },
        new_name: { type: 'string', description: 'New name for the sheet' },
      },
      required: ['reason', 'old_name', 'new_name'],
    },
  },
};

async function executeExcelRenameSheet(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelRenameSheet(
      args['old_name'] as string,
      args['new_name'] as string
    );
    if (response.success) { return { success: true, result: `Sheet renamed to '${args['new_name']}'` }; }
    return { success: false, error: response.error || 'Failed to rename sheet' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelRenameSheetTool: LLMSimpleTool = {
  definition: EXCEL_RENAME_SHEET_DEFINITION, execute: executeExcelRenameSheet, categories: OFFICE_CATEGORIES, description: 'Rename worksheet in Excel',
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
        reason: { type: 'string', description: 'Why you need sheet list' },
      },
      required: ['reason'],
    },
  },
};

async function executeExcelGetSheets(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelGetSheets();
    if (response.success) {
      return { success: true, result: JSON.stringify({ sheets: response['sheets'], count: response['count'] }) };
    }
    return { success: false, error: response.error || 'Failed to get sheets' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelGetSheetsTool: LLMSimpleTool = {
  definition: EXCEL_GET_SHEETS_DEFINITION, execute: executeExcelGetSheets, categories: OFFICE_CATEGORIES, description: 'Get sheet list in Excel',
};

// =============================================================================
// Excel Select Sheet
// =============================================================================

const EXCEL_SELECT_SHEET_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_select_sheet',
    description: `Activate/select a specific worksheet.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are selecting this sheet' },
        name: { type: 'string', description: 'Name of the sheet to select' },
      },
      required: ['reason', 'name'],
    },
  },
};

async function executeExcelSelectSheet(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelSelectSheet(args['name'] as string);
    if (response.success) { return { success: true, result: `Sheet '${args['name']}' activated` }; }
    return { success: false, error: response.error || 'Failed to select sheet' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelSelectSheetTool: LLMSimpleTool = {
  definition: EXCEL_SELECT_SHEET_DEFINITION, execute: executeExcelSelectSheet, categories: OFFICE_CATEGORIES, description: 'Select worksheet in Excel',
};

// =============================================================================
// Export Sheet Tools
// =============================================================================

export const sheetsTools: LLMSimpleTool[] = [
  excelAddSheetTool,
  excelDeleteSheetTool,
  excelRenameSheetTool,
  excelGetSheetsTool,
  excelSelectSheetTool,
];
