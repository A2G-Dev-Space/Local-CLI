/**
 * Excel Data Operations Tools
 *
 * Data manipulation tools: sorting, filtering, formulas, find/replace, grouping
 */

import { ToolDefinition } from '../../../types/index';
import { LLMSimpleTool, ToolResult } from '../../types';
import { excelClient } from '../excel-client';
import { OFFICE_CATEGORIES } from '../common/constants';
import { logger } from '../../../utils/logger';

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
  const startTime = Date.now();
  logger.toolStart('excel_set_formula', args);
  try {
    const response = await excelClient.excelSetFormula(
      args['cell'] as string,
      args['formula'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_set_formula', args, { cell: args['cell'] }, Date.now() - startTime);
      return { success: true, result: `Formula set in ${args['cell']}` };
    }
    logger.toolError('excel_set_formula', args, new Error(response.error || 'Failed to set formula'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to set formula' };
  } catch (error) {
    logger.toolError('excel_set_formula', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
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
  const startTime = Date.now();
  logger.toolStart('excel_sort_range', args);
  try {
    const response = await excelClient.excelSortRange(
      args['range'] as string,
      args['sort_column'] as string,
      (args['ascending'] ?? true) as boolean,
      (args['has_header'] ?? true) as boolean,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_sort_range', args, { range: args['range'], sortColumn: args['sort_column'] }, Date.now() - startTime);
      return { success: true, result: `Range sorted by column ${args['sort_column']}` };
    }
    logger.toolError('excel_sort_range', args, new Error(response.error || 'Failed to sort range'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to sort range' };
  } catch (error) {
    logger.toolError('excel_sort_range', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
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
  const startTime = Date.now();
  logger.toolStart('excel_freeze_panes', args);
  try {
    const response = await excelClient.excelFreezePanes(
      args['row'] as number | undefined,
      args['column'] as string | undefined,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_freeze_panes', args, { row: args['row'], column: args['column'] }, Date.now() - startTime);
      return { success: true, result: 'Panes frozen' };
    }
    logger.toolError('excel_freeze_panes', args, new Error(response.error || 'Failed to freeze panes'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to freeze panes' };
  } catch (error) {
    logger.toolError('excel_freeze_panes', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
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
  const startTime = Date.now();
  logger.toolStart('excel_auto_filter', args);
  try {
    const response = await excelClient.excelAutoFilter(
      args['range'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_auto_filter', args, { range: args['range'] }, Date.now() - startTime);
      return { success: true, result: `Auto filter applied to ${args['range']}` };
    }
    logger.toolError('excel_auto_filter', args, new Error(response.error || 'Failed to apply auto filter'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to apply auto filter' };
  } catch (error) {
    logger.toolError('excel_auto_filter', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
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
  const startTime = Date.now();
  logger.toolStart('excel_find_replace', args);
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
      logger.toolSuccess('excel_find_replace', args, { find: args['find'], replace: args['replace'] }, Date.now() - startTime);
      return { success: true, result: `Replaced "${args['find']}" with "${args['replace']}"` };
    }
    logger.toolError('excel_find_replace', args, new Error(response.error || 'Failed to find/replace'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to find/replace' };
  } catch (error) {
    logger.toolError('excel_find_replace', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
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
  const startTime = Date.now();
  logger.toolStart('excel_group_rows', args);
  try {
    const response = await excelClient.excelGroupRows(
      args['start_row'] as number,
      args['end_row'] as number,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_group_rows', args, { startRow: args['start_row'], endRow: args['end_row'] }, Date.now() - startTime);
      return { success: true, result: `Rows ${args['start_row']}-${args['end_row']} grouped` };
    }
    logger.toolError('excel_group_rows', args, new Error(response.error || 'Failed to group rows'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to group rows' };
  } catch (error) {
    logger.toolError('excel_group_rows', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
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
  const startTime = Date.now();
  logger.toolStart('excel_ungroup_rows', args);
  try {
    const response = await excelClient.excelUngroupRows(
      args['start_row'] as number,
      args['end_row'] as number,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_ungroup_rows', args, { startRow: args['start_row'], endRow: args['end_row'] }, Date.now() - startTime);
      return { success: true, result: `Rows ${args['start_row']}-${args['end_row']} ungrouped` };
    }
    logger.toolError('excel_ungroup_rows', args, new Error(response.error || 'Failed to ungroup rows'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to ungroup rows' };
  } catch (error) {
    logger.toolError('excel_ungroup_rows', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
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
// Excel Get Used Range
// =============================================================================

const EXCEL_GET_USED_RANGE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_get_used_range',
    description: `Get the used range (area with data) of the worksheet.
Returns the range address, row/column count, and starting position.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you need to know the used range' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason'],
    },
  },
};

async function executeExcelGetUsedRange(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_get_used_range', args);
  try {
    const response = await excelClient.excelGetUsedRange(args['sheet'] as string | undefined);
    if (response.success) {
      logger.toolSuccess('excel_get_used_range', args, { range: response['range'] }, Date.now() - startTime);
      return {
        success: true,
        result: `Used range: ${response['range']} (${response['rows']} rows × ${response['columns']} columns)`,
      };
    }
    logger.toolError('excel_get_used_range', args, new Error(response.error || 'Failed to get used range'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to get used range' };
  } catch (error) {
    logger.toolError('excel_get_used_range', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to get used range: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelGetUsedRangeTool: LLMSimpleTool = {
  definition: EXCEL_GET_USED_RANGE_DEFINITION,
  execute: executeExcelGetUsedRange,
  categories: OFFICE_CATEGORIES,
  description: 'Get Excel used range',
};

// =============================================================================
// Excel Autofit Range
// =============================================================================

const EXCEL_AUTOFIT_RANGE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_autofit_range',
    description: `Auto-fit column widths and/or row heights for a range to fit content.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are auto-fitting' },
        range: { type: 'string', description: 'Range to auto-fit (e.g., "A:D" or "A1:D10")' },
        fit_columns: { type: 'boolean', description: 'Auto-fit column widths (default: true)' },
        fit_rows: { type: 'boolean', description: 'Auto-fit row heights (default: false)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'range'],
    },
  },
};

async function executeExcelAutofitRange(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_autofit_range', args);
  try {
    const response = await excelClient.excelAutofitRange(
      args['range'] as string,
      args['fit_columns'] !== false,
      args['fit_rows'] === true,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_autofit_range', args, { range: args['range'] }, Date.now() - startTime);
      return { success: true, result: `Auto-fit applied to ${args['range']}` };
    }
    logger.toolError('excel_autofit_range', args, new Error(response.error || 'Failed to auto-fit range'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to auto-fit range' };
  } catch (error) {
    logger.toolError('excel_autofit_range', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to auto-fit range: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelAutofitRangeTool: LLMSimpleTool = {
  definition: EXCEL_AUTOFIT_RANGE_DEFINITION,
  execute: executeExcelAutofitRange,
  categories: OFFICE_CATEGORIES,
  description: 'Auto-fit Excel range',
};

// =============================================================================
// Excel Remove Duplicates
// =============================================================================

const EXCEL_REMOVE_DUPLICATES_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_remove_duplicates',
    description: `Remove duplicate rows from a range based on specified columns.
If no columns specified, all columns are used to detect duplicates.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are removing duplicates' },
        range: { type: 'string', description: 'Range to check for duplicates (e.g., "A1:D100")' },
        columns: { type: 'array', items: { type: 'number' }, description: 'Column numbers to check (1-based, e.g., [1,3] for columns A and C). If not specified, uses all columns.' },
        has_header: { type: 'boolean', description: 'First row is header (default: true)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'range'],
    },
  },
};

async function executeExcelRemoveDuplicates(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_remove_duplicates', args);
  try {
    const response = await excelClient.excelRemoveDuplicates(
      args['range'] as string,
      args['columns'] as number[] | undefined,
      args['has_header'] !== false,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_remove_duplicates', args, { range: args['range'], rowsRemoved: response['rows_removed'] }, Date.now() - startTime);
      return { success: true, result: response.message || `Duplicates removed from ${args['range']}` };
    }
    logger.toolError('excel_remove_duplicates', args, new Error(response.error || 'Failed to remove duplicates'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to remove duplicates' };
  } catch (error) {
    logger.toolError('excel_remove_duplicates', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to remove duplicates: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelRemoveDuplicatesTool: LLMSimpleTool = {
  definition: EXCEL_REMOVE_DUPLICATES_DEFINITION,
  execute: executeExcelRemoveDuplicates,
  categories: OFFICE_CATEGORIES,
  description: 'Remove duplicate rows in Excel',
};

// =============================================================================
// Excel Get Charts
// =============================================================================

const EXCEL_GET_CHARTS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_get_charts',
    description: `Get a list of all charts in the worksheet with their properties.
Returns chart index, name, type, title, position, size, and series count.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you need the chart list' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason'],
    },
  },
};

async function executeExcelGetCharts(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_get_charts', args);
  try {
    const response = await excelClient.excelGetCharts(args['sheet'] as string | undefined);
    if (response.success) {
      const count = response['count'] as number;
      logger.toolSuccess('excel_get_charts', args, { count }, Date.now() - startTime);
      if (count === 0) {
        return { success: true, result: 'No charts found in the worksheet' };
      }
      const charts = response['charts'] as Array<{ index: number; name: string; title: string | null }>;
      const summary = charts.map(c => `${c.index}. ${c.name}${c.title ? ` ("${c.title}")` : ''}`).join(', ');
      return { success: true, result: `Found ${count} chart(s): ${summary}` };
    }
    logger.toolError('excel_get_charts', args, new Error(response.error || 'Failed to get charts'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to get charts' };
  } catch (error) {
    logger.toolError('excel_get_charts', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to get charts: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelGetChartsTool: LLMSimpleTool = {
  definition: EXCEL_GET_CHARTS_DEFINITION,
  execute: executeExcelGetCharts,
  categories: OFFICE_CATEGORIES,
  description: 'Get list of Excel charts',
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
  excelGetUsedRangeTool,
  excelAutofitRangeTool,
  excelRemoveDuplicatesTool,
  excelGetChartsTool,
];
