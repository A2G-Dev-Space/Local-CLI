/**
 * Excel Cells Tools
 *
 * Cell read/write and range operations for Excel.
 * Tools: writeCell, readCell, writeRange, readRange, copyRange, pasteRange, clearRange
 */

import { ToolDefinition } from '../../../types/index.js';
import { LLMSimpleTool, ToolResult } from '../../types.js';
import { excelClient } from '../excel-client.js';
import { OFFICE_CATEGORIES } from '../common/index.js';

// =============================================================================
// Excel Write Cell
// =============================================================================

const EXCEL_WRITE_CELL_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_write_cell',
    description: `Write a value to a specific cell in Excel with optional font settings.
Use cell references like "A1", "B2", "C10", etc.
- Numbers are automatically recognized (e.g., "123", "45.67")
- Dates in YYYY-MM-DD format are converted to Excel dates (e.g., "2024-01-19")
- Use as_text=true to force text format (prevents auto-conversion)`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are writing to this cell' },
        cell: { type: 'string', description: 'Cell reference (e.g., "A1", "B2")' },
        value: { type: 'string', description: 'Value to write to the cell' },
        sheet: { type: 'string', description: 'Sheet name (optional, uses active sheet if not specified)' },
        font_name: { type: 'string', description: 'Font name (e.g., "Arial", "Malgun Gothic")' },
        font_size: { type: 'number', description: 'Font size in points' },
        bold: { type: 'boolean', description: 'Whether to make the text bold' },
        as_text: { type: 'boolean', description: 'Force text format (prevents number/date conversion)' },
      },
      required: ['reason', 'cell', 'value'],
    },
  },
};

async function executeExcelWriteCell(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelWriteCell(
      args['cell'] as string,
      args['value'],
      args['sheet'] as string | undefined,
      {
        fontName: args['font_name'] as string | undefined,
        fontSize: args['font_size'] as number | undefined,
        bold: args['bold'] as boolean | undefined,
        asText: args['as_text'] as boolean | undefined,
      }
    );
    if (response.success) {
      return { success: true, result: `Value written to cell ${args['cell']}` };
    }
    return { success: false, error: response.error || 'Failed to write cell' };
  } catch (error) {
    return { success: false, error: `Failed to write cell: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelWriteCellTool: LLMSimpleTool = {
  definition: EXCEL_WRITE_CELL_DEFINITION,
  execute: executeExcelWriteCell,
  categories: OFFICE_CATEGORIES,
  description: 'Write value to Excel cell',
};

// =============================================================================
// Excel Read Cell
// =============================================================================

const EXCEL_READ_CELL_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_read_cell',
    description: `Read a value from a specific cell in Excel.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are reading this cell' },
        cell: { type: 'string', description: 'Cell reference (e.g., "A1", "B2")' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'cell'],
    },
  },
};

async function executeExcelReadCell(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelReadCell(
      args['cell'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      const value = response['value'];
      return { success: true, result: `Cell ${args['cell']}: ${value ?? '(empty)'}` };
    }
    return { success: false, error: response.error || 'Failed to read cell' };
  } catch (error) {
    return { success: false, error: `Failed to read cell: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelReadCellTool: LLMSimpleTool = {
  definition: EXCEL_READ_CELL_DEFINITION,
  execute: executeExcelReadCell,
  categories: OFFICE_CATEGORIES,
  description: 'Read value from Excel cell',
};

// =============================================================================
// Excel Write Range
// =============================================================================

const EXCEL_WRITE_RANGE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_write_range',
    description: `Write multiple values to a range of cells in Excel.
Provide a 2D array of values starting from the specified cell.
Example: start_cell="A1", values=[["Name", "Age"], ["John", 25]]`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are writing this range' },
        start_cell: { type: 'string', description: 'Starting cell reference (e.g., "A1")' },
        values: { type: 'array', items: { type: 'array', items: {} }, description: '2D array of values to write' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'start_cell', 'values'],
    },
  },
};

async function executeExcelWriteRange(args: Record<string, unknown>): Promise<ToolResult> {
  const values = args['values'] as unknown[][];
  try {
    const response = await excelClient.excelWriteRange(
      args['start_cell'] as string,
      values,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      const rows = values.length;
      const cols = values[0]?.length || 0;
      return { success: true, result: `Written ${rows}x${cols} values starting at ${args['start_cell']}` };
    }
    return { success: false, error: response.error || 'Failed to write range' };
  } catch (error) {
    return { success: false, error: `Failed to write range: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelWriteRangeTool: LLMSimpleTool = {
  definition: EXCEL_WRITE_RANGE_DEFINITION,
  execute: executeExcelWriteRange,
  categories: OFFICE_CATEGORIES,
  description: 'Write values to Excel range',
};

// =============================================================================
// Excel Read Range
// =============================================================================

const EXCEL_READ_RANGE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_read_range',
    description: `Read values from a range of cells in Excel.
Returns a 2D array of values.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Explanation of why you are reading this range' },
        range: { type: 'string', description: 'Range reference (e.g., "A1:C10")' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'range'],
    },
  },
};

async function executeExcelReadRange(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelReadRange(
      args['range'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      const values = response['values'];
      const rows = response['rows'] as number || 0;
      const cols = response['columns'] as number || 0;
      return {
        success: true,
        result: `Range ${args['range']} (${rows}x${cols}):\n${JSON.stringify(values, null, 2)}`,
      };
    }
    return { success: false, error: response.error || 'Failed to read range' };
  } catch (error) {
    return { success: false, error: `Failed to read range: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelReadRangeTool: LLMSimpleTool = {
  definition: EXCEL_READ_RANGE_DEFINITION,
  execute: executeExcelReadRange,
  categories: OFFICE_CATEGORIES,
  description: 'Read values from Excel range',
};

// =============================================================================
// Excel Copy Range
// =============================================================================

const EXCEL_COPY_RANGE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_copy_range',
    description: `Copy a range to clipboard.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are copying' },
        range: { type: 'string', description: 'Range to copy (e.g., "A1:B10")' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'range'],
    },
  },
};

async function executeExcelCopyRange(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelCopyRange(
      args['range'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Range ${args['range']} copied to clipboard` };
    }
    return { success: false, error: response.error || 'Failed to copy range' };
  } catch (error) {
    return { success: false, error: `Failed to copy range: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelCopyRangeTool: LLMSimpleTool = {
  definition: EXCEL_COPY_RANGE_DEFINITION,
  execute: executeExcelCopyRange,
  categories: OFFICE_CATEGORIES,
  description: 'Copy Excel range',
};

// =============================================================================
// Excel Paste Range
// =============================================================================

const EXCEL_PASTE_RANGE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_paste_range',
    description: `Paste clipboard content to a destination cell.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are pasting' },
        destination: { type: 'string', description: 'Destination cell (e.g., "A1")' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'destination'],
    },
  },
};

async function executeExcelPasteRange(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelPasteRange(
      args['destination'] as string,
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Pasted to ${args['destination']}` };
    }
    return { success: false, error: response.error || 'Failed to paste' };
  } catch (error) {
    return { success: false, error: `Failed to paste: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelPasteRangeTool: LLMSimpleTool = {
  definition: EXCEL_PASTE_RANGE_DEFINITION,
  execute: executeExcelPasteRange,
  categories: OFFICE_CATEGORIES,
  description: 'Paste to Excel range',
};

// =============================================================================
// Excel Clear Range
// =============================================================================

const EXCEL_CLEAR_RANGE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_clear_range',
    description: `Clear a range (all content, values only, formats only, or comments only).`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are clearing' },
        range: { type: 'string', description: 'Range to clear (e.g., "A1:B10")' },
        clear_type: { type: 'string', enum: ['all', 'contents', 'formats', 'comments'], description: 'What to clear (default: all)' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'range'],
    },
  },
};

async function executeExcelClearRange(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelClearRange(
      args['range'] as string,
      (args['clear_type'] ?? 'all') as 'all' | 'contents' | 'formats' | 'comments',
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: response.message || `Range ${args['range']} cleared` };
    }
    return { success: false, error: response.error || 'Failed to clear range' };
  } catch (error) {
    return { success: false, error: `Failed to clear range: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelClearRangeTool: LLMSimpleTool = {
  definition: EXCEL_CLEAR_RANGE_DEFINITION,
  execute: executeExcelClearRange,
  categories: OFFICE_CATEGORIES,
  description: 'Clear Excel range',
};

// =============================================================================
// Export: Cells Tools Array
// =============================================================================

export const cellsTools: LLMSimpleTool[] = [
  excelWriteCellTool,
  excelReadCellTool,
  excelWriteRangeTool,
  excelReadRangeTool,
  excelCopyRangeTool,
  excelPasteRangeTool,
  excelClearRangeTool,
];
