/**
 * Excel Data Operations Tools
 *
 * Data manipulation tools: sorting, filtering, formulas, find/replace, grouping
 */

import { ToolDefinition } from '../../../types/index';
import { LLMSimpleTool, ToolResult } from '../../types';
import { excelClient } from '../excel-client';
import { OFFICE_CATEGORIES } from '../common/constants';

// =============================================================================
// Excel Set Formula
// =============================================================================

const EXCEL_SET_FORMULA_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_set_formula',
    description: `Set a formula in a cell.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting a formula' },
        cell: { type: 'string', description: 'Cell reference (e.g., "A1")' },
        formula: { type: 'string', description: 'Formula (e.g., "=SUM(A1:A10)")' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'cell', 'formula'],
    },
  },
};

async function executeExcelSetFormula(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelSetFormula(
      args['cell'] as string,
      args['formula'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Formula set in ${args['cell']}` };
    }
    return { success: false, error: response.error || 'Failed to set formula' };
  } catch (error) {
    return { success: false, error: `Failed to set formula: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelSetFormulaTool: LLMSimpleTool = {
  definition: EXCEL_SET_FORMULA_DEFINITION,
  execute: executeExcelSetFormula,
  categories: OFFICE_CATEGORIES,
  description: 'Set Excel formula',
};

// =============================================================================
// Excel Sort Range
// =============================================================================

const EXCEL_SORT_RANGE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_sort_range',
    description: `Sort a range of cells by a column.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are sorting' },
        range: { type: 'string', description: 'Range to sort (e.g., "A1:D10")' },
        sort_column: { type: 'string', description: 'Column to sort by (e.g., "B")' },
        ascending: { type: 'boolean', description: 'Sort ascending (default: true)' },
        has_header: { type: 'boolean', description: 'First row is header (default: true)' },
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
      args['ascending'] as boolean ?? true,
      args['has_header'] as boolean ?? true,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Range sorted by column ${args['sort_column']}` };
    }
    return { success: false, error: response.error || 'Failed to sort range' };
  } catch (error) {
    return { success: false, error: `Failed to sort range: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelSortRangeTool: LLMSimpleTool = {
  definition: EXCEL_SORT_RANGE_DEFINITION,
  execute: executeExcelSortRange,
  categories: OFFICE_CATEGORIES,
  description: 'Sort Excel range',
};

// =============================================================================
// Excel Freeze Panes
// =============================================================================

const EXCEL_FREEZE_PANES_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_freeze_panes',
    description: `Freeze panes to keep rows/columns visible while scrolling.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are freezing panes' },
        row: { type: 'number', description: 'Freeze rows above this row number' },
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
    if (response.success) {
      return { success: true, result: 'Panes frozen' };
    }
    return { success: false, error: response.error || 'Failed to freeze panes' };
  } catch (error) {
    return { success: false, error: `Failed to freeze panes: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelFreezePanesTool: LLMSimpleTool = {
  definition: EXCEL_FREEZE_PANES_DEFINITION,
  execute: executeExcelFreezePanes,
  categories: OFFICE_CATEGORIES,
  description: 'Freeze Excel panes',
};

// =============================================================================
// Excel Auto Filter
// =============================================================================

const EXCEL_AUTO_FILTER_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_auto_filter',
    description: `Apply auto filter to a range for data filtering.`,
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
      args['range'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Auto filter applied to ${args['range']}` };
    }
    return { success: false, error: response.error || 'Failed to apply auto filter' };
  } catch (error) {
    return { success: false, error: `Failed to apply auto filter: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelAutoFilterTool: LLMSimpleTool = {
  definition: EXCEL_AUTO_FILTER_DEFINITION,
  execute: executeExcelAutoFilter,
  categories: OFFICE_CATEGORIES,
  description: 'Apply Excel auto filter',
};

// =============================================================================
// Excel Find Replace
// =============================================================================

const EXCEL_FIND_REPLACE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_find_replace',
    description: `Find and replace text in the worksheet.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are doing find/replace' },
        find: { type: 'string', description: 'Text to find' },
        replace: { type: 'string', description: 'Replacement text' },
        match_case: { type: 'boolean', description: 'Case sensitive (default: false)' },
        match_entire_cell: { type: 'boolean', description: 'Match entire cell only (default: false)' },
        range: { type: 'string', description: 'Range to search (optional, searches entire sheet)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'find', 'replace'],
    },
  },
};

async function executeExcelFindReplace(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelFindReplace(
      args['find'] as string,
      args['replace'] as string,
      {
        matchCase: args['match_case'] as boolean | undefined,
        matchEntireCell: args['match_entire_cell'] as boolean | undefined,
        range: args['range'] as string | undefined,
        sheet: args['sheet'] as string | undefined,
      }
    );
    if (response.success) {
      return { success: true, result: `Replaced "${args['find']}" with "${args['replace']}"` };
    }
    return { success: false, error: response.error || 'Failed to find/replace' };
  } catch (error) {
    return { success: false, error: `Failed to find/replace: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelFindReplaceTool: LLMSimpleTool = {
  definition: EXCEL_FIND_REPLACE_DEFINITION,
  execute: executeExcelFindReplace,
  categories: OFFICE_CATEGORIES,
  description: 'Find and replace in Excel',
};

// =============================================================================
// Excel Group Rows
// =============================================================================

const EXCEL_GROUP_ROWS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_group_rows',
    description: `Group rows for outlining.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are grouping rows' },
        start_row: { type: 'number', description: 'Start row number' },
        end_row: { type: 'number', description: 'End row number' },
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
    if (response.success) {
      return { success: true, result: `Rows ${args['start_row']}-${args['end_row']} grouped` };
    }
    return { success: false, error: response.error || 'Failed to group rows' };
  } catch (error) {
    return { success: false, error: `Failed to group rows: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelGroupRowsTool: LLMSimpleTool = {
  definition: EXCEL_GROUP_ROWS_DEFINITION,
  execute: executeExcelGroupRows,
  categories: OFFICE_CATEGORIES,
  description: 'Group Excel rows',
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
        start_row: { type: 'number', description: 'Start row number' },
        end_row: { type: 'number', description: 'End row number' },
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
    if (response.success) {
      return { success: true, result: `Rows ${args['start_row']}-${args['end_row']} ungrouped` };
    }
    return { success: false, error: response.error || 'Failed to ungroup rows' };
  } catch (error) {
    return { success: false, error: `Failed to ungroup rows: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelUngroupRowsTool: LLMSimpleTool = {
  definition: EXCEL_UNGROUP_ROWS_DEFINITION,
  execute: executeExcelUngroupRows,
  categories: OFFICE_CATEGORIES,
  description: 'Ungroup Excel rows',
};

// =============================================================================
// Export All Data Operations Tools
// =============================================================================

export const dataOpsTools: LLMSimpleTool[] = [
  excelSetFormulaTool,
  excelSortRangeTool,
  excelFreezePanesTool,
  excelAutoFilterTool,
  excelFindReplaceTool,
  excelGroupRowsTool,
  excelUngroupRowsTool,
];
