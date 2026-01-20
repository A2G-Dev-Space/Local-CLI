/**
 * Word Table Tools
 *
 * Table operations: addTable, setTableCell, mergeTableCells, setTableStyle, setTableBorder
 * Total: 5 tools
 */

import { ToolDefinition } from '../../../llm-client';
import { LLMSimpleTool, ToolResult } from '../common/types';
import { OFFICE_CATEGORIES } from '../common/constants';
import { wordClient } from '../../office';

// =============================================================================
// Word Add Table
// =============================================================================

const WORD_ADD_TABLE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_add_table',
    description: `Add a table to the Word document.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding a table' },
        rows: { type: 'number', description: 'Number of rows' },
        cols: { type: 'number', description: 'Number of columns' },
        data: {
          type: 'array',
          items: { type: 'array', items: { type: 'string' } },
          description: '2D array of cell data (optional)',
        },
      },
      required: ['reason', 'rows', 'cols'],
    },
  },
};

async function executeWordAddTable(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await wordClient.wordAddTable(
      args['rows'] as number,
      args['cols'] as number,
      args['data'] as string[][] | undefined
    );
    if (response.success) {
      return { success: true, result: `Table added (${args['rows']}x${args['cols']})` };
    }
    return { success: false, error: response.error || 'Failed to add table' };
  } catch (error) {
    return { success: false, error: `Failed to add table: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordAddTableTool: LLMSimpleTool = {
  definition: WORD_ADD_TABLE_DEFINITION,
  execute: executeWordAddTable,
  categories: OFFICE_CATEGORIES,
  description: 'Add table to Word document',
};

// =============================================================================
// Word Set Table Cell
// =============================================================================

const WORD_SET_TABLE_CELL_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_set_table_cell',
    description: `Set the content of a specific cell in a Word table.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting table cell' },
        table_index: { type: 'number', description: 'Table index (1-based)' },
        row: { type: 'number', description: 'Row number (1-based)' },
        col: { type: 'number', description: 'Column number (1-based)' },
        text: { type: 'string', description: 'Text to set in the cell' },
        font_name: { type: 'string', description: 'Font name (optional)' },
        font_size: { type: 'number', description: 'Font size (optional)' },
        bold: { type: 'boolean', description: 'Bold text (optional)' },
      },
      required: ['reason', 'table_index', 'row', 'col', 'text'],
    },
  },
};

async function executeWordSetTableCell(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await wordClient.wordSetTableCell(
      args['table_index'] as number,
      args['row'] as number,
      args['col'] as number,
      args['text'] as string,
      {
        fontName: args['font_name'] as string | undefined,
        fontSize: args['font_size'] as number | undefined,
        bold: args['bold'] as boolean | undefined,
      }
    );
    if (response.success) {
      return { success: true, result: response.message || 'Table cell updated' };
    }
    return { success: false, error: response.error || 'Failed to set table cell' };
  } catch (error) {
    return { success: false, error: `Failed to set table cell: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordSetTableCellTool: LLMSimpleTool = {
  definition: WORD_SET_TABLE_CELL_DEFINITION,
  execute: executeWordSetTableCell,
  categories: OFFICE_CATEGORIES,
  description: 'Set Word table cell content',
};

// =============================================================================
// Word Merge Table Cells
// =============================================================================

const WORD_MERGE_TABLE_CELLS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_merge_table_cells',
    description: `Merge cells in a Word table.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are merging cells' },
        table_index: { type: 'number', description: 'Table index (1-based)' },
        start_row: { type: 'number', description: 'Start row (1-based)' },
        start_col: { type: 'number', description: 'Start column (1-based)' },
        end_row: { type: 'number', description: 'End row (1-based)' },
        end_col: { type: 'number', description: 'End column (1-based)' },
      },
      required: ['reason', 'table_index', 'start_row', 'start_col', 'end_row', 'end_col'],
    },
  },
};

async function executeWordMergeTableCells(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await wordClient.wordMergeTableCells(
      args['table_index'] as number,
      args['start_row'] as number,
      args['start_col'] as number,
      args['end_row'] as number,
      args['end_col'] as number
    );
    if (response.success) {
      return { success: true, result: 'Table cells merged' };
    }
    return { success: false, error: response.error || 'Failed to merge cells' };
  } catch (error) {
    return { success: false, error: `Failed to merge cells: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordMergeTableCellsTool: LLMSimpleTool = {
  definition: WORD_MERGE_TABLE_CELLS_DEFINITION,
  execute: executeWordMergeTableCells,
  categories: OFFICE_CATEGORIES,
  description: 'Merge Word table cells',
};

// =============================================================================
// Word Set Table Style
// =============================================================================

const WORD_SET_TABLE_STYLE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_set_table_style',
    description: `Apply a style to a Word table.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting table style' },
        table_index: { type: 'number', description: 'Table index (1-based)' },
        style: { type: 'string', description: 'Style name (e.g., "Table Grid", "Light Shading")' },
        preserve_korean_font: { type: 'boolean', description: 'Preserve Korean font (default: true)' },
      },
      required: ['reason', 'table_index', 'style'],
    },
  },
};

async function executeWordSetTableStyle(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await wordClient.wordSetTableStyle(
      args['table_index'] as number,
      args['style'] as string,
      args['preserve_korean_font'] !== false
    );
    if (response.success) {
      return { success: true, result: `Table style set to "${args['style']}"` };
    }
    return { success: false, error: response.error || 'Failed to set table style' };
  } catch (error) {
    return { success: false, error: `Failed to set table style: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordSetTableStyleTool: LLMSimpleTool = {
  definition: WORD_SET_TABLE_STYLE_DEFINITION,
  execute: executeWordSetTableStyle,
  categories: OFFICE_CATEGORIES,
  description: 'Set Word table style',
};

// =============================================================================
// Word Set Table Border
// =============================================================================

const WORD_SET_TABLE_BORDER_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'word_set_table_border',
    description: `Set border style for a Word table.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting table border' },
        table_index: { type: 'number', description: 'Table index (1-based)' },
        style: {
          type: 'string',
          enum: ['single', 'double', 'thick', 'none'],
          description: 'Border style',
        },
        color: { type: 'string', description: 'Border color as hex (e.g., "#000000")' },
      },
      required: ['reason', 'table_index'],
    },
  },
};

async function executeWordSetTableBorder(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await wordClient.wordSetTableBorder(
      args['table_index'] as number,
      {
        style: args['style'] as 'single' | 'double' | 'thick' | 'none' | undefined,
        color: args['color'] as string | undefined,
      }
    );
    if (response.success) {
      return { success: true, result: 'Table border set' };
    }
    return { success: false, error: response.error || 'Failed to set table border' };
  } catch (error) {
    return { success: false, error: `Failed to set table border: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const wordSetTableBorderTool: LLMSimpleTool = {
  definition: WORD_SET_TABLE_BORDER_DEFINITION,
  execute: executeWordSetTableBorder,
  categories: OFFICE_CATEGORIES,
  description: 'Set Word table border',
};

// =============================================================================
// Export Table Tools
// =============================================================================

export const tablesTools: LLMSimpleTool[] = [
  wordAddTableTool,
  wordSetTableCellTool,
  wordMergeTableCellsTool,
  wordSetTableStyleTool,
  wordSetTableBorderTool,
];
