/**
 * Excel Rows & Columns Tools
 *
 * Tools for managing Excel rows and columns:
 * - setColumnWidth, setRowHeight
 * - insertRow, deleteRow
 * - hideRow, hideColumn, showRow, showColumn
 */

import { ToolDefinition } from '../../../types/index.js';
import { LLMSimpleTool, ToolResult } from '../../types.js';
import { excelClient } from '../excel-client.js';
import { OFFICE_CATEGORIES } from '../common/constants.js';

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
  try {
    const response = await excelClient.excelSetColumnWidth(
      args['column'] as string,
      args['width'] as number | undefined,
      args['auto_fit'] as boolean | undefined,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Column ${args['column']} width set` };
    }
    return { success: false, error: response.error || 'Failed to set column width' };
  } catch (error) {
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
  try {
    const response = await excelClient.excelSetRowHeight(
      args['row'] as number,
      args['height'] as number | undefined,
      args['auto_fit'] as boolean | undefined,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Row ${args['row']} height set` };
    }
    return { success: false, error: response.error || 'Failed to set row height' };
  } catch (error) {
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
  try {
    const count = (args['count'] ?? 1) as number;
    const response = await excelClient.excelInsertRow(
      args['row'] as number,
      count,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `${count} row(s) inserted at row ${args['row']}` };
    }
    return { success: false, error: response.error || 'Failed to insert row' };
  } catch (error) {
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
  try {
    const count = (args['count'] ?? 1) as number;
    const response = await excelClient.excelDeleteRow(
      args['row'] as number,
      count,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `${count} row(s) deleted at row ${args['row']}` };
    }
    return { success: false, error: response.error || 'Failed to delete row' };
  } catch (error) {
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
// Excel Insert Column
// =============================================================================

const EXCEL_INSERT_COLUMN_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_insert_column',
    description: `Insert columns at a specific position.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are inserting columns' },
        column: { type: 'string', description: 'Column letter to insert at (e.g., "A", "B")' },
        count: { type: 'number', description: 'Number of columns to insert (default: 1)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'column'],
    },
  },
};

async function executeExcelInsertColumn(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const count = (args['count'] ?? 1) as number;
    const response = await excelClient.excelInsertColumn(
      args['column'] as string,
      count,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `${count} column(s) inserted at column ${args['column']}` };
    }
    return { success: false, error: response.error || 'Failed to insert column' };
  } catch (error) {
    return { success: false, error: `Failed to insert column: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelInsertColumnTool: LLMSimpleTool = {
  definition: EXCEL_INSERT_COLUMN_DEFINITION,
  execute: executeExcelInsertColumn,
  categories: OFFICE_CATEGORIES,
  description: 'Insert Excel columns',
};

// =============================================================================
// Excel Delete Column
// =============================================================================

const EXCEL_DELETE_COLUMN_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_delete_column',
    description: `Delete columns at a specific position.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are deleting columns' },
        column: { type: 'string', description: 'Column letter to delete (e.g., "A", "B")' },
        count: { type: 'number', description: 'Number of columns to delete (default: 1)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'column'],
    },
  },
};

async function executeExcelDeleteColumn(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const count = (args['count'] ?? 1) as number;
    const response = await excelClient.excelDeleteColumn(
      args['column'] as string,
      count,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `${count} column(s) deleted at column ${args['column']}` };
    }
    return { success: false, error: response.error || 'Failed to delete column' };
  } catch (error) {
    return { success: false, error: `Failed to delete column: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelDeleteColumnTool: LLMSimpleTool = {
  definition: EXCEL_DELETE_COLUMN_DEFINITION,
  execute: executeExcelDeleteColumn,
  categories: OFFICE_CATEGORIES,
  description: 'Delete Excel columns',
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
  try {
    const response = await excelClient.excelHideColumn(
      args['column'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Column ${args['column']} hidden` };
    }
    return { success: false, error: response.error || 'Failed to hide column' };
  } catch (error) {
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
  try {
    const response = await excelClient.excelShowColumn(
      args['column'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Column ${args['column']} shown` };
    }
    return { success: false, error: response.error || 'Failed to show column' };
  } catch (error) {
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
  try {
    const response = await excelClient.excelHideRow(
      args['row'] as number,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Row ${args['row']} hidden` };
    }
    return { success: false, error: response.error || 'Failed to hide row' };
  } catch (error) {
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
  try {
    const response = await excelClient.excelShowRow(
      args['row'] as number,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Row ${args['row']} shown` };
    }
    return { success: false, error: response.error || 'Failed to show row' };
  } catch (error) {
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
// Excel Group Columns
// =============================================================================

const EXCEL_GROUP_COLUMNS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_group_columns',
    description: `Group columns together (creates expandable/collapsible outline).
Useful for hiding detail columns while showing summaries.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are grouping columns' },
        start_col: { type: 'string', description: 'Starting column letter (e.g., "B")' },
        end_col: { type: 'string', description: 'Ending column letter (e.g., "D")' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'start_col', 'end_col'],
    },
  },
};

async function executeExcelGroupColumns(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelGroupColumns(
      args['start_col'] as string,
      args['end_col'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Grouped columns ${args['start_col']} to ${args['end_col']}` };
    }
    return { success: false, error: response.error || 'Failed to group columns' };
  } catch (error) {
    return { success: false, error: `Failed to group columns: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelGroupColumnsTool: LLMSimpleTool = {
  definition: EXCEL_GROUP_COLUMNS_DEFINITION,
  execute: executeExcelGroupColumns,
  categories: OFFICE_CATEGORIES,
  description: 'Group Excel columns',
};

// =============================================================================
// Excel Ungroup Columns
// =============================================================================

const EXCEL_UNGROUP_COLUMNS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_ungroup_columns',
    description: `Ungroup previously grouped columns.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are ungrouping columns' },
        start_col: { type: 'string', description: 'Starting column letter (e.g., "B")' },
        end_col: { type: 'string', description: 'Ending column letter (e.g., "D")' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'start_col', 'end_col'],
    },
  },
};

async function executeExcelUngroupColumns(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelUngroupColumns(
      args['start_col'] as string,
      args['end_col'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Ungrouped columns ${args['start_col']} to ${args['end_col']}` };
    }
    return { success: false, error: response.error || 'Failed to ungroup columns' };
  } catch (error) {
    return { success: false, error: `Failed to ungroup columns: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelUngroupColumnsTool: LLMSimpleTool = {
  definition: EXCEL_UNGROUP_COLUMNS_DEFINITION,
  execute: executeExcelUngroupColumns,
  categories: OFFICE_CATEGORIES,
  description: 'Ungroup Excel columns',
};

// =============================================================================
// Export all tools
// =============================================================================

export const rowsColumnsTools: LLMSimpleTool[] = [
  excelSetColumnWidthTool,
  excelSetRowHeightTool,
  excelInsertRowTool,
  excelDeleteRowTool,
  excelInsertColumnTool,
  excelDeleteColumnTool,
  excelHideColumnTool,
  excelShowColumnTool,
  excelHideRowTool,
  excelShowRowTool,
  excelGroupColumnsTool,
  excelUngroupColumnsTool,
];
