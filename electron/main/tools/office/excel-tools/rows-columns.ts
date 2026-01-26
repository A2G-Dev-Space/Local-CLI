/**
 * Excel Rows & Columns Tools
 *
 * Tools for managing Excel rows and columns:
 * - setColumnWidth, setRowHeight
 * - insertRow, deleteRow
 * - hideRow, hideColumn, showRow, showColumn
 */

import { ToolDefinition } from '../../../types/index';
import { LLMSimpleTool, ToolResult } from '../../types';
import { excelClient } from '../excel-client';
import { OFFICE_CATEGORIES } from '../common/constants';
import { logger } from '../../../utils/logger';

// =============================================================================
// Excel Set Column Width
// =============================================================================

const EXCEL_SET_COLUMN_WIDTH_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_set_column_width',
    description: `Set column width or auto-fit.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting column width' },
        column: { type: 'string', description: 'Column letter (e.g., "A", "B")' },
        width: { type: 'number', description: 'Width in characters (ignored if auto_fit is true)' },
        auto_fit: { type: 'boolean', description: 'Auto-fit column width to content' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'column'],
    },
  },
};

async function executeExcelSetColumnWidth(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_set_column_width', args);
  try {
    const response = await excelClient.excelSetColumnWidth(
      args['column'] as string,
      args['width'] as number | undefined,
      args['auto_fit'] as boolean | undefined,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_set_column_width', args, { column: args['column'] }, Date.now() - startTime);
      return { success: true, result: `Column ${args['column']} width set` };
    }
    logger.toolError('excel_set_column_width', args, new Error(response.error || 'Failed to set column width'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to set column width' };
  } catch (error) {
    logger.toolError('excel_set_column_width', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to set column width: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelSetColumnWidthTool: LLMSimpleTool = {
  definition: EXCEL_SET_COLUMN_WIDTH_DEFINITION,
  execute: executeExcelSetColumnWidth,
  categories: OFFICE_CATEGORIES,
  description: 'Set Excel column width',
};

// =============================================================================
// Excel Set Row Height
// =============================================================================

const EXCEL_SET_ROW_HEIGHT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_set_row_height',
    description: `Set row height or auto-fit.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting row height' },
        row: { type: 'number', description: 'Row number' },
        height: { type: 'number', description: 'Height in points (ignored if auto_fit is true)' },
        auto_fit: { type: 'boolean', description: 'Auto-fit row height to content' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'row'],
    },
  },
};

async function executeExcelSetRowHeight(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_set_row_height', args);
  try {
    const response = await excelClient.excelSetRowHeight(
      args['row'] as number,
      args['height'] as number | undefined,
      args['auto_fit'] as boolean | undefined,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_set_row_height', args, { row: args['row'] }, Date.now() - startTime);
      return { success: true, result: `Row ${args['row']} height set` };
    }
    logger.toolError('excel_set_row_height', args, new Error(response.error || 'Failed to set row height'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to set row height' };
  } catch (error) {
    logger.toolError('excel_set_row_height', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to set row height: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelSetRowHeightTool: LLMSimpleTool = {
  definition: EXCEL_SET_ROW_HEIGHT_DEFINITION,
  execute: executeExcelSetRowHeight,
  categories: OFFICE_CATEGORIES,
  description: 'Set Excel row height',
};

// =============================================================================
// Excel Insert Row
// =============================================================================

const EXCEL_INSERT_ROW_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_insert_row',
    description: `Insert rows at a specific position.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are inserting rows' },
        row: { type: 'number', description: 'Row number to insert at' },
        count: { type: 'number', description: 'Number of rows to insert (default: 1)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'row'],
    },
  },
};

async function executeExcelInsertRow(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_insert_row', args);
  try {
    const count = args['count'] as number ?? 1;
    const response = await excelClient.excelInsertRow(
      args['row'] as number,
      count,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_insert_row', args, { row: args['row'], count }, Date.now() - startTime);
      return { success: true, result: `${count} row(s) inserted at row ${args['row']}` };
    }
    logger.toolError('excel_insert_row', args, new Error(response.error || 'Failed to insert row'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to insert row' };
  } catch (error) {
    logger.toolError('excel_insert_row', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to insert row: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelInsertRowTool: LLMSimpleTool = {
  definition: EXCEL_INSERT_ROW_DEFINITION,
  execute: executeExcelInsertRow,
  categories: OFFICE_CATEGORIES,
  description: 'Insert Excel rows',
};

// =============================================================================
// Excel Delete Row
// =============================================================================

const EXCEL_DELETE_ROW_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_delete_row',
    description: `Delete rows at a specific position.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are deleting rows' },
        row: { type: 'number', description: 'Row number to delete' },
        count: { type: 'number', description: 'Number of rows to delete (default: 1)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'row'],
    },
  },
};

async function executeExcelDeleteRow(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_delete_row', args);
  try {
    const count = args['count'] as number ?? 1;
    const response = await excelClient.excelDeleteRow(
      args['row'] as number,
      count,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_delete_row', args, { row: args['row'], count }, Date.now() - startTime);
      return { success: true, result: `${count} row(s) deleted at row ${args['row']}` };
    }
    logger.toolError('excel_delete_row', args, new Error(response.error || 'Failed to delete row'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to delete row' };
  } catch (error) {
    logger.toolError('excel_delete_row', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to delete row: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelDeleteRowTool: LLMSimpleTool = {
  definition: EXCEL_DELETE_ROW_DEFINITION,
  execute: executeExcelDeleteRow,
  categories: OFFICE_CATEGORIES,
  description: 'Delete Excel rows',
};

// =============================================================================
// Excel Hide Column
// =============================================================================

const EXCEL_HIDE_COLUMN_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_hide_column',
    description: `Hide a column.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are hiding column' },
        column: { type: 'string', description: 'Column letter (e.g., "A", "B")' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'column'],
    },
  },
};

async function executeExcelHideColumn(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_hide_column', args);
  try {
    const response = await excelClient.excelHideColumn(
      args['column'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_hide_column', args, { column: args['column'] }, Date.now() - startTime);
      return { success: true, result: `Column ${args['column']} hidden` };
    }
    logger.toolError('excel_hide_column', args, new Error(response.error || 'Failed to hide column'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to hide column' };
  } catch (error) {
    logger.toolError('excel_hide_column', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to hide column: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelHideColumnTool: LLMSimpleTool = {
  definition: EXCEL_HIDE_COLUMN_DEFINITION,
  execute: executeExcelHideColumn,
  categories: OFFICE_CATEGORIES,
  description: 'Hide Excel column',
};

// =============================================================================
// Excel Show Column
// =============================================================================

const EXCEL_SHOW_COLUMN_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_show_column',
    description: `Show a hidden column.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are showing column' },
        column: { type: 'string', description: 'Column letter (e.g., "A", "B")' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'column'],
    },
  },
};

async function executeExcelShowColumn(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_show_column', args);
  try {
    const response = await excelClient.excelShowColumn(
      args['column'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_show_column', args, { column: args['column'] }, Date.now() - startTime);
      return { success: true, result: `Column ${args['column']} shown` };
    }
    logger.toolError('excel_show_column', args, new Error(response.error || 'Failed to show column'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to show column' };
  } catch (error) {
    logger.toolError('excel_show_column', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to show column: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelShowColumnTool: LLMSimpleTool = {
  definition: EXCEL_SHOW_COLUMN_DEFINITION,
  execute: executeExcelShowColumn,
  categories: OFFICE_CATEGORIES,
  description: 'Show Excel column',
};

// =============================================================================
// Excel Hide Row
// =============================================================================

const EXCEL_HIDE_ROW_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_hide_row',
    description: `Hide a row.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are hiding row' },
        row: { type: 'number', description: 'Row number' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'row'],
    },
  },
};

async function executeExcelHideRow(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_hide_row', args);
  try {
    const response = await excelClient.excelHideRow(
      args['row'] as number,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_hide_row', args, { row: args['row'] }, Date.now() - startTime);
      return { success: true, result: `Row ${args['row']} hidden` };
    }
    logger.toolError('excel_hide_row', args, new Error(response.error || 'Failed to hide row'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to hide row' };
  } catch (error) {
    logger.toolError('excel_hide_row', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to hide row: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelHideRowTool: LLMSimpleTool = {
  definition: EXCEL_HIDE_ROW_DEFINITION,
  execute: executeExcelHideRow,
  categories: OFFICE_CATEGORIES,
  description: 'Hide Excel row',
};

// =============================================================================
// Excel Show Row
// =============================================================================

const EXCEL_SHOW_ROW_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_show_row',
    description: `Show a hidden row.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are showing row' },
        row: { type: 'number', description: 'Row number' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'row'],
    },
  },
};

async function executeExcelShowRow(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_show_row', args);
  try {
    const response = await excelClient.excelShowRow(
      args['row'] as number,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_show_row', args, { row: args['row'] }, Date.now() - startTime);
      return { success: true, result: `Row ${args['row']} shown` };
    }
    logger.toolError('excel_show_row', args, new Error(response.error || 'Failed to show row'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to show row' };
  } catch (error) {
    logger.toolError('excel_show_row', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to show row: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelShowRowTool: LLMSimpleTool = {
  definition: EXCEL_SHOW_ROW_DEFINITION,
  execute: executeExcelShowRow,
  categories: OFFICE_CATEGORIES,
  description: 'Show Excel row',
};

// =============================================================================
// Export all tools
// =============================================================================

export const rowsColumnsTools: LLMSimpleTool[] = [
  excelSetColumnWidthTool,
  excelSetRowHeightTool,
  excelInsertRowTool,
  excelDeleteRowTool,
  excelHideColumnTool,
  excelShowColumnTool,
  excelHideRowTool,
  excelShowRowTool,
];
