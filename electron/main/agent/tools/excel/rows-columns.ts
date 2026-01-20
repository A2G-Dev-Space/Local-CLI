/**
 * Excel Rows & Columns Tools
 *
 * Row/Column operations: sortRange, insertRow, deleteRow, insertColumn, deleteColumn,
 * hideColumn, showColumn, hideRow, showRow, groupRows, ungroupRows, freezePanes, autoFilter
 * Total: 13 tools
 */

import { ToolDefinition } from '../../../llm-client';
import { LLMSimpleTool, ToolResult } from '../common/types';
import { OFFICE_CATEGORIES } from '../common/constants';
import { excelClient } from '../../office';

// =============================================================================
// Excel Sort Range
// =============================================================================

const EXCEL_SORT_RANGE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_sort_range',
    description: `Sort a range by a specific column.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are sorting' },
        range: { type: 'string', description: 'Range to sort (e.g., "A1:D10")' },
        sort_column: { type: 'string', description: 'Column letter to sort by (e.g., "B")' },
        ascending: { type: 'boolean', description: 'Sort ascending (default: true)' },
        has_header: { type: 'boolean', description: 'Range has header row (default: true)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'range', 'sort_column'],
    },
  },
};

async function executeExcelSortRange(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelSortRange(
      args['range'] as string,
      args['sort_column'] as string,
      args['ascending'] !== false,
      args['has_header'] !== false,
      args['sheet'] as string | undefined
    );
    if (response.success) { return { success: true, result: `Range sorted by column ${args['sort_column']}` }; }
    return { success: false, error: response.error || 'Failed to sort range' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelSortRangeTool: LLMSimpleTool = {
  definition: EXCEL_SORT_RANGE_DEFINITION, execute: executeExcelSortRange, categories: OFFICE_CATEGORIES, description: 'Sort range in Excel',
};

// =============================================================================
// Excel Insert Row
// =============================================================================

const EXCEL_INSERT_ROW_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_insert_row',
    description: `Insert new row(s) at a specific position.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are inserting rows' },
        row: { type: 'number', description: 'Row number to insert at (1-based)' },
        count: { type: 'number', description: 'Number of rows to insert (default: 1)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'row'],
    },
  },
};

async function executeExcelInsertRow(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const count = (args['count'] as number) || 1;
    const response = await excelClient.excelInsertRow(
      args['row'] as number, count, args['sheet'] as string | undefined
    );
    if (response.success) { return { success: true, result: `${count} row(s) inserted at row ${args['row']}` }; }
    return { success: false, error: response.error || 'Failed to insert row' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelInsertRowTool: LLMSimpleTool = {
  definition: EXCEL_INSERT_ROW_DEFINITION, execute: executeExcelInsertRow, categories: OFFICE_CATEGORIES, description: 'Insert rows in Excel',
};

// =============================================================================
// Excel Delete Row
// =============================================================================

const EXCEL_DELETE_ROW_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_delete_row',
    description: `Delete row(s) at a specific position.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are deleting rows' },
        row: { type: 'number', description: 'Starting row number (1-based)' },
        count: { type: 'number', description: 'Number of rows to delete (default: 1)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'row'],
    },
  },
};

async function executeExcelDeleteRow(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const count = (args['count'] as number) || 1;
    const response = await excelClient.excelDeleteRow(
      args['row'] as number, count, args['sheet'] as string | undefined
    );
    if (response.success) { return { success: true, result: `${count} row(s) deleted` }; }
    return { success: false, error: response.error || 'Failed to delete row' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelDeleteRowTool: LLMSimpleTool = {
  definition: EXCEL_DELETE_ROW_DEFINITION, execute: executeExcelDeleteRow, categories: OFFICE_CATEGORIES, description: 'Delete rows in Excel',
};

// =============================================================================
// Excel Insert Column
// =============================================================================

const EXCEL_INSERT_COLUMN_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_insert_column',
    description: `Insert new column(s) at a specific position.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are inserting columns' },
        column: { type: 'string', description: 'Column letter to insert at (e.g., "B")' },
        count: { type: 'number', description: 'Number of columns to insert (default: 1)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'column'],
    },
  },
};

async function executeExcelInsertColumn(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const count = (args['count'] as number) || 1;
    const response = await excelClient.excelInsertColumn(
      args['column'] as string, count, args['sheet'] as string | undefined
    );
    if (response.success) { return { success: true, result: `${count} column(s) inserted at ${args['column']}` }; }
    return { success: false, error: response.error || 'Failed to insert column' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelInsertColumnTool: LLMSimpleTool = {
  definition: EXCEL_INSERT_COLUMN_DEFINITION, execute: executeExcelInsertColumn, categories: OFFICE_CATEGORIES, description: 'Insert columns in Excel',
};

// =============================================================================
// Excel Delete Column
// =============================================================================

const EXCEL_DELETE_COLUMN_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_delete_column',
    description: `Delete column(s) at a specific position.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are deleting columns' },
        column: { type: 'string', description: 'Starting column letter (e.g., "B")' },
        count: { type: 'number', description: 'Number of columns to delete (default: 1)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'column'],
    },
  },
};

async function executeExcelDeleteColumn(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const count = (args['count'] as number) || 1;
    const response = await excelClient.excelDeleteColumn(
      args['column'] as string, count, args['sheet'] as string | undefined
    );
    if (response.success) { return { success: true, result: `${count} column(s) deleted` }; }
    return { success: false, error: response.error || 'Failed to delete column' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelDeleteColumnTool: LLMSimpleTool = {
  definition: EXCEL_DELETE_COLUMN_DEFINITION, execute: executeExcelDeleteColumn, categories: OFFICE_CATEGORIES, description: 'Delete columns in Excel',
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
        reason: { type: 'string', description: 'Why you are hiding this column' },
        column: { type: 'string', description: 'Column letter to hide' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'column'],
    },
  },
};

async function executeExcelHideColumn(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelHideColumn(
      args['column'] as string, args['sheet'] as string | undefined
    );
    if (response.success) { return { success: true, result: `Column ${args['column']} hidden` }; }
    return { success: false, error: response.error || 'Failed to hide column' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelHideColumnTool: LLMSimpleTool = {
  definition: EXCEL_HIDE_COLUMN_DEFINITION, execute: executeExcelHideColumn, categories: OFFICE_CATEGORIES, description: 'Hide column in Excel',
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
        reason: { type: 'string', description: 'Why you are showing this column' },
        column: { type: 'string', description: 'Column letter to show' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'column'],
    },
  },
};

async function executeExcelShowColumn(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelShowColumn(
      args['column'] as string, args['sheet'] as string | undefined
    );
    if (response.success) { return { success: true, result: `Column ${args['column']} shown` }; }
    return { success: false, error: response.error || 'Failed to show column' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelShowColumnTool: LLMSimpleTool = {
  definition: EXCEL_SHOW_COLUMN_DEFINITION, execute: executeExcelShowColumn, categories: OFFICE_CATEGORIES, description: 'Show column in Excel',
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
        reason: { type: 'string', description: 'Why you are hiding this row' },
        row: { type: 'number', description: 'Row number to hide (1-based)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'row'],
    },
  },
};

async function executeExcelHideRow(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelHideRow(
      args['row'] as number, args['sheet'] as string | undefined
    );
    if (response.success) { return { success: true, result: `Row ${args['row']} hidden` }; }
    return { success: false, error: response.error || 'Failed to hide row' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelHideRowTool: LLMSimpleTool = {
  definition: EXCEL_HIDE_ROW_DEFINITION, execute: executeExcelHideRow, categories: OFFICE_CATEGORIES, description: 'Hide row in Excel',
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
        reason: { type: 'string', description: 'Why you are showing this row' },
        row: { type: 'number', description: 'Row number to show (1-based)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'row'],
    },
  },
};

async function executeExcelShowRow(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelShowRow(
      args['row'] as number, args['sheet'] as string | undefined
    );
    if (response.success) { return { success: true, result: `Row ${args['row']} shown` }; }
    return { success: false, error: response.error || 'Failed to show row' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelShowRowTool: LLMSimpleTool = {
  definition: EXCEL_SHOW_ROW_DEFINITION, execute: executeExcelShowRow, categories: OFFICE_CATEGORIES, description: 'Show row in Excel',
};

// =============================================================================
// Excel Group Rows
// =============================================================================

const EXCEL_GROUP_ROWS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_group_rows',
    description: `Group rows together for outline.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are grouping rows' },
        start_row: { type: 'number', description: 'Starting row number' },
        end_row: { type: 'number', description: 'Ending row number' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'start_row', 'end_row'],
    },
  },
};

async function executeExcelGroupRows(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelGroupRows(
      args['start_row'] as number,
      args['end_row'] as number,
      args['sheet'] as string | undefined
    );
    if (response.success) { return { success: true, result: `Rows ${args['start_row']}-${args['end_row']} grouped` }; }
    return { success: false, error: response.error || 'Failed to group rows' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelGroupRowsTool: LLMSimpleTool = {
  definition: EXCEL_GROUP_ROWS_DEFINITION, execute: executeExcelGroupRows, categories: OFFICE_CATEGORIES, description: 'Group rows in Excel',
};

// =============================================================================
// Excel Ungroup Rows
// =============================================================================

const EXCEL_UNGROUP_ROWS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_ungroup_rows',
    description: `Ungroup rows.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are ungrouping rows' },
        start_row: { type: 'number', description: 'Starting row number' },
        end_row: { type: 'number', description: 'Ending row number' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'start_row', 'end_row'],
    },
  },
};

async function executeExcelUngroupRows(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelUngroupRows(
      args['start_row'] as number,
      args['end_row'] as number,
      args['sheet'] as string | undefined
    );
    if (response.success) { return { success: true, result: `Rows ${args['start_row']}-${args['end_row']} ungrouped` }; }
    return { success: false, error: response.error || 'Failed to ungroup rows' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelUngroupRowsTool: LLMSimpleTool = {
  definition: EXCEL_UNGROUP_ROWS_DEFINITION, execute: executeExcelUngroupRows, categories: OFFICE_CATEGORIES, description: 'Ungroup rows in Excel',
};

// =============================================================================
// Excel Freeze Panes
// =============================================================================

const EXCEL_FREEZE_PANES_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_freeze_panes',
    description: `Freeze rows and/or columns.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are freezing panes' },
        row: { type: 'number', description: 'Freeze rows above this row (1-based)' },
        column: { type: 'string', description: 'Freeze columns to the left of this column' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason'],
    },
  },
};

async function executeExcelFreezePanes(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelFreezePanes(
      args['row'] as number | undefined,
      args['column'] as string | undefined,
      args['sheet'] as string | undefined
    );
    if (response.success) { return { success: true, result: 'Panes frozen' }; }
    return { success: false, error: response.error || 'Failed to freeze panes' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelFreezePanesTool: LLMSimpleTool = {
  definition: EXCEL_FREEZE_PANES_DEFINITION, execute: executeExcelFreezePanes, categories: OFFICE_CATEGORIES, description: 'Freeze panes in Excel',
};

// =============================================================================
// Excel Auto Filter
// =============================================================================

const EXCEL_AUTO_FILTER_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_auto_filter',
    description: `Apply auto filter to a range.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are applying auto filter' },
        range: { type: 'string', description: 'Range to apply filter (e.g., "A1:D10")' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'range'],
    },
  },
};

async function executeExcelAutoFilter(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelAutoFilter(
      args['range'] as string, args['sheet'] as string | undefined
    );
    if (response.success) { return { success: true, result: `AutoFilter applied to ${args['range']}` }; }
    return { success: false, error: response.error || 'Failed to apply auto filter' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelAutoFilterTool: LLMSimpleTool = {
  definition: EXCEL_AUTO_FILTER_DEFINITION, execute: executeExcelAutoFilter, categories: OFFICE_CATEGORIES, description: 'Apply auto filter in Excel',
};

// =============================================================================
// Export Rows & Columns Tools
// =============================================================================

export const rowsColumnsTools: LLMSimpleTool[] = [
  excelSortRangeTool,
  excelInsertRowTool,
  excelDeleteRowTool,
  excelInsertColumnTool,
  excelDeleteColumnTool,
  excelHideColumnTool,
  excelShowColumnTool,
  excelHideRowTool,
  excelShowRowTool,
  excelGroupRowsTool,
  excelUngroupRowsTool,
  excelFreezePanesTool,
  excelAutoFilterTool,
];
