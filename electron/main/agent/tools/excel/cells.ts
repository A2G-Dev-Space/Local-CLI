/**
 * Excel Cell Tools
 *
 * Cell operations: writeCell, readCell, writeRange, readRange, setFormula
 * Total: 5 tools
 */

import { ToolDefinition } from '../../../llm-client';
import { LLMSimpleTool, ToolResult } from '../common/types';
import { OFFICE_CATEGORIES } from '../common/constants';
import { excelClient } from '../../office';

// =============================================================================
// Excel Write Cell
// =============================================================================

const EXCEL_WRITE_CELL_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_write_cell',
    description: `Write a value to a specific cell in Excel.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are writing to this cell' },
        cell: { type: 'string', description: 'Cell reference (e.g., "A1", "B2")' },
        value: { type: ['string', 'number'], description: 'Value to write' },
        sheet: { type: 'string', description: 'Sheet name (optional, uses active sheet)' },
        font_name: { type: 'string', description: 'Font name (optional)' },
        font_size: { type: 'number', description: 'Font size (optional)' },
        bold: { type: 'boolean', description: 'Bold text (optional)' },
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
      }
    );
    if (response.success) {
      return { success: true, result: `Value written to ${args['cell']}` };
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
  description: 'Write to Excel cell',
};

// =============================================================================
// Excel Read Cell
// =============================================================================

const EXCEL_READ_CELL_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_read_cell',
    description: `Read the value from a specific cell in Excel.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are reading this cell' },
        cell: { type: 'string', description: 'Cell reference (e.g., "A1")' },
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
      return { success: true, result: `${args['cell']}: ${response['value']}` };
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
  description: 'Read Excel cell value',
};

// =============================================================================
// Excel Write Range
// =============================================================================

const EXCEL_WRITE_RANGE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_write_range',
    description: `Write multiple values to a range of cells.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are writing to this range' },
        start_cell: { type: 'string', description: 'Starting cell reference (e.g., "A1")' },
        values: {
          type: 'array',
          items: { type: 'array', items: {} },
          description: '2D array of values: [[row1_col1, row1_col2], [row2_col1, row2_col2]]',
        },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'start_cell', 'values'],
    },
  },
};

async function executeExcelWriteRange(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelWriteRange(
      args['start_cell'] as string,
      args['values'] as unknown[][],
      args['sheet'] as string | undefined
    );
    if (response.success) {
      return { success: true, result: `Data written starting from ${args['start_cell']}` };
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
  description: 'Write to Excel range',
};

// =============================================================================
// Excel Read Range
// =============================================================================

const EXCEL_READ_RANGE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_read_range',
    description: `Read values from a range of cells.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are reading this range' },
        range: { type: 'string', description: 'Range to read (e.g., "A1:C10")' },
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
      const values = response['values'] as unknown[][];
      return { success: true, result: JSON.stringify(values, null, 2) };
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
  description: 'Read Excel range',
};

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
        reason: { type: 'string', description: 'Why you are setting this formula' },
        cell: { type: 'string', description: 'Cell reference' },
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
  description: 'Set formula in Excel cell',
};

// =============================================================================
// Export Cell Tools
// =============================================================================

export const cellsTools: LLMSimpleTool[] = [
  excelWriteCellTool,
  excelReadCellTool,
  excelWriteRangeTool,
  excelReadRangeTool,
  excelSetFormulaTool,
];
