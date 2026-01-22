/**
 * PowerPoint Table Tools
 *
 * Tools for adding and managing tables in PowerPoint slides.
 */

import { ToolDefinition } from '../../../types/index';
import { LLMSimpleTool, ToolResult } from '../../types';
import { powerpointClient } from '../powerpoint-client';
import { OFFICE_CATEGORIES } from '../common/constants';

// =============================================================================
// PowerPoint Add Table
// =============================================================================

const POWERPOINT_ADD_TABLE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_add_table',
    description: `Add a table to a slide.`,
    parameters: {
      type: 'object',
      properties: {
        slide_number: { type: 'number', description: 'Slide number (1-indexed)' },
        rows: { type: 'number', description: 'Number of rows' },
        cols: { type: 'number', description: 'Number of columns' },
        left: { type: 'number', description: 'Left position in points (default: 100)' },
        top: { type: 'number', description: 'Top position in points (default: 100)' },
        width: { type: 'number', description: 'Table width in points (default: 400)' },
        height: { type: 'number', description: 'Table height in points (default: 200)' },
        data: { type: 'array', description: '2D array of cell values', items: { type: 'array', items: { type: 'string' } } },
      },
      required: ['slide_number', 'rows', 'cols'],
    },
  },
};

async function executePowerPointAddTable(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointAddTable(
      args['slide_number'] as number,
      args['rows'] as number,
      args['cols'] as number,
      args['left'] as number | undefined,
      args['top'] as number | undefined,
      args['width'] as number | undefined,
      args['height'] as number | undefined,
      args['data'] as string[][] | undefined
    );
    if (response.success) {
      return { success: true, result: `Table added. Shape index: ${response['shape_index']}` };
    }
    return { success: false, error: response.error || 'Failed to add table' };
  } catch (error) {
    return { success: false, error: `Failed to add table: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointAddTableTool: LLMSimpleTool = {
  definition: POWERPOINT_ADD_TABLE_DEFINITION,
  execute: executePowerPointAddTable,
  categories: OFFICE_CATEGORIES,
  description: 'Add table to slide',
};

// =============================================================================
// PowerPoint Set Table Cell
// =============================================================================

const POWERPOINT_SET_TABLE_CELL_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_table_cell',
    description: `Set text and formatting for a table cell.`,
    parameters: {
      type: 'object',
      properties: {
        slide_number: { type: 'number', description: 'Slide number (1-indexed)' },
        shape_index: { type: 'number', description: 'Table shape index' },
        row: { type: 'number', description: 'Row number (1-indexed)' },
        col: { type: 'number', description: 'Column number (1-indexed)' },
        text: { type: 'string', description: 'Cell text' },
        font_name: { type: 'string', description: 'Font name' },
        font_size: { type: 'number', description: 'Font size' },
        bold: { type: 'boolean', description: 'Bold text' },
        fill_color: { type: 'string', description: 'Cell background color (hex: #RRGGBB)' },
      },
      required: ['slide_number', 'shape_index', 'row', 'col', 'text'],
    },
  },
};

async function executePowerPointSetTableCell(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointSetTableCell(
      args['slide_number'] as number,
      args['shape_index'] as number,
      args['row'] as number,
      args['col'] as number,
      args['text'] as string,
      {
        fontName: args['font_name'] as string | undefined,
        fontSize: args['font_size'] as number | undefined,
        bold: args['bold'] as boolean | undefined,
        fillColor: args['fill_color'] as string | undefined,
      }
    );
    if (response.success) {
      return { success: true, result: response.message || 'Table cell updated' };
    }
    return { success: false, error: response.error || 'Failed to update table cell' };
  } catch (error) {
    return { success: false, error: `Failed to update table cell: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointSetTableCellTool: LLMSimpleTool = {
  definition: POWERPOINT_SET_TABLE_CELL_DEFINITION,
  execute: executePowerPointSetTableCell,
  categories: OFFICE_CATEGORIES,
  description: 'Set table cell text and formatting',
};

// =============================================================================
// PowerPoint Set Table Style
// =============================================================================

const POWERPOINT_SET_TABLE_STYLE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_table_style',
    description: `Set table style (borders, header row, alternating rows).`,
    parameters: {
      type: 'object',
      properties: {
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Table shape index' },
        border_color: { type: 'string', description: 'Border color (hex: #RRGGBB)' },
        header_row_fill: { type: 'string', description: 'Header row background color (hex)' },
        alternate_row_fill: { type: 'string', description: 'Alternating row background color (hex)' },
      },
      required: ['slide_number', 'shape_index'],
    },
  },
};

async function executePowerPointSetTableStyle(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointSetTableStyle(
      args['slide_number'] as number,
      args['shape_index'] as number,
      {
        borderColor: args['border_color'] as string | undefined,
        headerRowFill: args['header_row_fill'] as string | undefined,
        alternateRowFill: args['alternate_row_fill'] as string | undefined,
      }
    );
    if (response.success) {
      return { success: true, result: response.message || 'Table style updated' };
    }
    return { success: false, error: response.error || 'Failed to update table style' };
  } catch (error) {
    return { success: false, error: `Failed to update table style: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointSetTableStyleTool: LLMSimpleTool = {
  definition: POWERPOINT_SET_TABLE_STYLE_DEFINITION,
  execute: executePowerPointSetTableStyle,
  categories: OFFICE_CATEGORIES,
  description: 'Set table style',
};

// =============================================================================
// Export
// =============================================================================

export const tablesTools: LLMSimpleTool[] = [
  powerpointAddTableTool,
  powerpointSetTableCellTool,
  powerpointSetTableStyleTool,
];
