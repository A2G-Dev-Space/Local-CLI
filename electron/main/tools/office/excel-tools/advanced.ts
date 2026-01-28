/**
 * Excel Advanced Data Tools
 *
 * Tools for advanced data operations.
 * Tools: array_formula, transpose, text_to_columns, hide_sheet, show_sheet
 */

import { ToolDefinition } from '../../../../src/types';
import { LLMSimpleTool, ToolResult } from '../../types';
import { excelClient } from '../excel-client';
import { OFFICE_CATEGORIES } from '../common';
import { logger } from '../../../utils/logger';

// =============================================================================
// Excel Insert Array Formula
// =============================================================================

const EXCEL_ARRAY_FORMULA_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_array_formula',
    description: `Insert an array formula (CSE formula) that calculates multiple results.
Classic array formulas use Ctrl+Shift+Enter, but this tool handles that automatically.
For Excel 365+, dynamic arrays work without special handling.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are inserting array formula' },
        range: { type: 'string', description: 'Range for the array formula result (e.g., "E1:E10")' },
        formula: { type: 'string', description: 'Array formula (e.g., "=A1:A10*B1:B10" for element-wise multiply)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'range', 'formula'],
    },
  },
};

async function executeExcelArrayFormula(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_array_formula', args);
  try {
    const response = await excelClient.excelInsertArrayFormula(
      args['range'] as string,
      args['formula'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_array_formula', args, { range: args['range'] }, Date.now() - startTime);
      return { success: true, result: response.message || `Array formula inserted in '${args['range']}'` };
    }
    logger.toolError('excel_array_formula', args, new Error(response.error || 'Failed'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to insert array formula' };
  } catch (error) {
    logger.toolError('excel_array_formula', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to insert array formula: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelArrayFormulaTool: LLMSimpleTool = {
  definition: EXCEL_ARRAY_FORMULA_DEFINITION,
  execute: executeExcelArrayFormula,
  categories: OFFICE_CATEGORIES,
  description: 'Insert Excel array formula',
};

// =============================================================================
// Excel Transpose
// =============================================================================

const EXCEL_TRANSPOSE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_transpose',
    description: `Transpose data (swap rows and columns) from source range to destination.
A 3x5 range becomes 5x3 after transpose.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are transposing data' },
        source_range: { type: 'string', description: 'Source range to transpose (e.g., "A1:C5")' },
        dest_cell: { type: 'string', description: 'Top-left cell for transposed output (e.g., "E1")' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'source_range', 'dest_cell'],
    },
  },
};

async function executeExcelTranspose(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_transpose', args);
  try {
    const response = await excelClient.excelTranspose(
      args['source_range'] as string,
      args['dest_cell'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_transpose', args, {}, Date.now() - startTime);
      return { success: true, result: response.message || 'Data transposed' };
    }
    logger.toolError('excel_transpose', args, new Error(response.error || 'Failed'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to transpose' };
  } catch (error) {
    logger.toolError('excel_transpose', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to transpose: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelTransposeTool: LLMSimpleTool = {
  definition: EXCEL_TRANSPOSE_DEFINITION,
  execute: executeExcelTranspose,
  categories: OFFICE_CATEGORIES,
  description: 'Transpose Excel data (swap rows/columns)',
};

// =============================================================================
// Excel Text to Columns
// =============================================================================

const EXCEL_TEXT_TO_COLUMNS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_text_to_columns',
    description: `Split text in cells into multiple columns based on a delimiter.
Common use: separating "Last, First" into two columns.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are splitting text' },
        range: { type: 'string', description: 'Range containing text to split (e.g., "A1:A100")' },
        delimiter: { type: 'string', description: 'Delimiter: "comma", "tab", "semicolon", "space", or custom character' },
        dest_cell: { type: 'string', description: 'Top-left cell for output (optional, default: same as source)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'range', 'delimiter'],
    },
  },
};

async function executeExcelTextToColumns(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_text_to_columns', args);
  try {
    const response = await excelClient.excelTextToColumns(
      args['range'] as string,
      args['delimiter'] as string,
      args['dest_cell'] as string | undefined,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_text_to_columns', args, {}, Date.now() - startTime);
      return { success: true, result: response.message || 'Text split into columns' };
    }
    logger.toolError('excel_text_to_columns', args, new Error(response.error || 'Failed'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to split text' };
  } catch (error) {
    logger.toolError('excel_text_to_columns', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to split text: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelTextToColumnsTool: LLMSimpleTool = {
  definition: EXCEL_TEXT_TO_COLUMNS_DEFINITION,
  execute: executeExcelTextToColumns,
  categories: OFFICE_CATEGORIES,
  description: 'Split text into columns by delimiter',
};

// =============================================================================
// Excel Hide Sheet
// =============================================================================

const EXCEL_HIDE_SHEET_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_hide_sheet',
    description: `Hide a worksheet. Hidden sheets are not visible but still exist and can be unhidden.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are hiding this sheet' },
        sheet_name: { type: 'string', description: 'Name of the sheet to hide' },
      },
      required: ['reason', 'sheet_name'],
    },
  },
};

async function executeExcelHideSheet(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_hide_sheet', args);
  try {
    const response = await excelClient.excelHideSheet(args['sheet_name'] as string);
    if (response.success) {
      logger.toolSuccess('excel_hide_sheet', args, { sheet_name: args['sheet_name'] }, Date.now() - startTime);
      return { success: true, result: response.message || `Sheet '${args['sheet_name']}' hidden` };
    }
    logger.toolError('excel_hide_sheet', args, new Error(response.error || 'Failed'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to hide sheet' };
  } catch (error) {
    logger.toolError('excel_hide_sheet', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to hide sheet: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelHideSheetTool: LLMSimpleTool = {
  definition: EXCEL_HIDE_SHEET_DEFINITION,
  execute: executeExcelHideSheet,
  categories: OFFICE_CATEGORIES,
  description: 'Hide Excel worksheet',
};

// =============================================================================
// Excel Show Sheet
// =============================================================================

const EXCEL_SHOW_SHEET_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_show_sheet',
    description: `Show (unhide) a hidden worksheet.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are showing this sheet' },
        sheet_name: { type: 'string', description: 'Name of the sheet to show' },
      },
      required: ['reason', 'sheet_name'],
    },
  },
};

async function executeExcelShowSheet(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_show_sheet', args);
  try {
    const response = await excelClient.excelShowSheet(args['sheet_name'] as string);
    if (response.success) {
      logger.toolSuccess('excel_show_sheet', args, { sheet_name: args['sheet_name'] }, Date.now() - startTime);
      return { success: true, result: response.message || `Sheet '${args['sheet_name']}' shown` };
    }
    logger.toolError('excel_show_sheet', args, new Error(response.error || 'Failed'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to show sheet' };
  } catch (error) {
    logger.toolError('excel_show_sheet', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to show sheet: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelShowSheetTool: LLMSimpleTool = {
  definition: EXCEL_SHOW_SHEET_DEFINITION,
  execute: executeExcelShowSheet,
  categories: OFFICE_CATEGORIES,
  description: 'Show hidden Excel worksheet',
};

// =============================================================================
// Excel Set Calculation Mode
// =============================================================================

const EXCEL_SET_CALCULATION_MODE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_set_calculation_mode',
    description: `Set Excel calculation mode.
- automatic: Formulas recalculate automatically when cells change (default)
- manual: Formulas only recalculate when manually triggered
- semiautomatic: Auto-calc except for data tables`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are changing calculation mode' },
        mode: { type: 'string', enum: ['automatic', 'manual', 'semiautomatic'], description: 'Calculation mode' },
      },
      required: ['reason', 'mode'],
    },
  },
};

async function executeExcelSetCalculationMode(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_set_calculation_mode', args);
  try {
    const response = await excelClient.excelSetCalculationMode(
      args['mode'] as 'automatic' | 'manual' | 'semiautomatic'
    );
    if (response.success) {
      logger.toolSuccess('excel_set_calculation_mode', args, { mode: args['mode'] }, Date.now() - startTime);
      return { success: true, result: response.message || `Calculation mode set to '${args['mode']}'` };
    }
    logger.toolError('excel_set_calculation_mode', args, new Error(response.error || 'Failed'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to set calculation mode' };
  } catch (error) {
    logger.toolError('excel_set_calculation_mode', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to set calculation mode: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelSetCalculationModeTool: LLMSimpleTool = {
  definition: EXCEL_SET_CALCULATION_MODE_DEFINITION,
  execute: executeExcelSetCalculationMode,
  categories: OFFICE_CATEGORIES,
  description: 'Set Excel calculation mode',
};

// =============================================================================
// Excel Recalculate
// =============================================================================

const EXCEL_RECALCULATE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_recalculate',
    description: `Force recalculation of formulas. Useful when calculation mode is manual.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are recalculating' },
        scope: { type: 'string', enum: ['workbook', 'sheet', 'range'], description: 'Recalculation scope' },
        range: { type: 'string', description: 'Range to recalculate (required if scope is "range")' },
        sheet: { type: 'string', description: 'Sheet name (optional, for sheet/range scope)' },
      },
      required: ['reason', 'scope'],
    },
  },
};

async function executeExcelRecalculate(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_recalculate', args);
  try {
    const response = await excelClient.excelRecalculate(
      args['scope'] as 'workbook' | 'sheet' | 'range',
      args['range'] as string | undefined,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_recalculate', args, { scope: args['scope'] }, Date.now() - startTime);
      return { success: true, result: response.message || `Recalculated ${args['scope']}` };
    }
    logger.toolError('excel_recalculate', args, new Error(response.error || 'Failed'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to recalculate' };
  } catch (error) {
    logger.toolError('excel_recalculate', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to recalculate: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelRecalculateTool: LLMSimpleTool = {
  definition: EXCEL_RECALCULATE_DEFINITION,
  execute: executeExcelRecalculate,
  categories: OFFICE_CATEGORIES,
  description: 'Recalculate Excel formulas',
};

// =============================================================================
// Excel Trace Precedents
// =============================================================================

const EXCEL_TRACE_PRECEDENTS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_trace_precedents',
    description: `Draw arrows showing cells that directly provide values to the selected cell's formula.
Helps understand formula dependencies.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are tracing precedents' },
        cell: { type: 'string', description: 'Cell to trace (e.g., "C5")' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'cell'],
    },
  },
};

async function executeExcelTracePrecedents(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_trace_precedents', args);
  try {
    const response = await excelClient.excelTracePrecedents(
      args['cell'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_trace_precedents', args, { cell: args['cell'] }, Date.now() - startTime);
      return { success: true, result: response.message || `Showing precedents for ${args['cell']}` };
    }
    logger.toolError('excel_trace_precedents', args, new Error(response.error || 'Failed'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to trace precedents' };
  } catch (error) {
    logger.toolError('excel_trace_precedents', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to trace precedents: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelTracePrecedentsTool: LLMSimpleTool = {
  definition: EXCEL_TRACE_PRECEDENTS_DEFINITION,
  execute: executeExcelTracePrecedents,
  categories: OFFICE_CATEGORIES,
  description: 'Trace formula precedents',
};

// =============================================================================
// Excel Trace Dependents
// =============================================================================

const EXCEL_TRACE_DEPENDENTS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_trace_dependents',
    description: `Draw arrows showing cells that depend on the selected cell's value.
Helps understand what formulas will be affected by changing this cell.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are tracing dependents' },
        cell: { type: 'string', description: 'Cell to trace (e.g., "A1")' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'cell'],
    },
  },
};

async function executeExcelTraceDependents(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_trace_dependents', args);
  try {
    const response = await excelClient.excelTraceDependents(
      args['cell'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      logger.toolSuccess('excel_trace_dependents', args, { cell: args['cell'] }, Date.now() - startTime);
      return { success: true, result: response.message || `Showing dependents for ${args['cell']}` };
    }
    logger.toolError('excel_trace_dependents', args, new Error(response.error || 'Failed'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to trace dependents' };
  } catch (error) {
    logger.toolError('excel_trace_dependents', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to trace dependents: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelTraceDependentsTool: LLMSimpleTool = {
  definition: EXCEL_TRACE_DEPENDENTS_DEFINITION,
  execute: executeExcelTraceDependents,
  categories: OFFICE_CATEGORIES,
  description: 'Trace formula dependents',
};

// =============================================================================
// Excel Clear Arrows
// =============================================================================

const EXCEL_CLEAR_ARROWS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_clear_arrows',
    description: `Remove all precedent and dependent tracer arrows from the active sheet.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are clearing arrows' },
      },
      required: ['reason'],
    },
  },
};

async function executeExcelClearArrows(args: Record<string, unknown>): Promise<ToolResult> {
  const startTime = Date.now();
  logger.toolStart('excel_clear_arrows', args);
  try {
    const response = await excelClient.excelClearArrows();
    if (response.success) {
      logger.toolSuccess('excel_clear_arrows', args, {}, Date.now() - startTime);
      return { success: true, result: response.message || 'Cleared all arrows' };
    }
    logger.toolError('excel_clear_arrows', args, new Error(response.error || 'Failed'), Date.now() - startTime);
    return { success: false, error: response.error || 'Failed to clear arrows' };
  } catch (error) {
    logger.toolError('excel_clear_arrows', args, error instanceof Error ? error : new Error(String(error)), Date.now() - startTime);
    return { success: false, error: `Failed to clear arrows: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelClearArrowsTool: LLMSimpleTool = {
  definition: EXCEL_CLEAR_ARROWS_DEFINITION,
  execute: executeExcelClearArrows,
  categories: OFFICE_CATEGORIES,
  description: 'Clear tracer arrows',
};

// =============================================================================
// Export all advanced tools
// =============================================================================

export const advancedTools: LLMSimpleTool[] = [
  excelArrayFormulaTool,
  excelTransposeTool,
  excelTextToColumnsTool,
  excelHideSheetTool,
  excelShowSheetTool,
  excelSetCalculationModeTool,
  excelRecalculateTool,
  excelTracePrecedentsTool,
  excelTraceDependentsTool,
  excelClearArrowsTool,
];
