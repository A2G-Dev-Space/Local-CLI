/**
 * PowerPoint Table Tools
 *
 * Table operations: addTable, setTableCell, setTableStyle
 * Total: 3 tools
 */

import { ToolDefinition } from '../../../llm-client';
import { LLMSimpleTool, ToolResult } from '../common/types';
import { OFFICE_CATEGORIES } from '../common/constants';
import { powerpointClient } from '../../office';

// =============================================================================
// PowerPoint Add Table
// =============================================================================

const PPT_ADD_TABLE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_add_table',
    description: `Add a table to a slide.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding a table' },
        slide_number: { type: 'number', description: 'Slide number' },
        rows: { type: 'number', description: 'Number of rows' },
        cols: { type: 'number', description: 'Number of columns' },
        left: { type: 'number', description: 'Left position in points (default: 100)' },
        top: { type: 'number', description: 'Top position in points (default: 100)' },
        width: { type: 'number', description: 'Width in points (default: 400)' },
        height: { type: 'number', description: 'Height in points (default: 200)' },
        data: {
          type: 'array',
          items: { type: 'array', items: { type: 'string' } },
          description: '2D array of cell data [[row1], [row2], ...]',
        },
      },
      required: ['reason', 'slide_number', 'rows', 'cols'],
    },
  },
};

async function executePPTAddTable(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointAddTable(
      args['slide_number'] as number,
      args['rows'] as number,
      args['cols'] as number,
      (args['left'] as number) || 100,
      (args['top'] as number) || 100,
      (args['width'] as number) || 400,
      (args['height'] as number) || 200,
      args['data'] as string[][] | undefined
    );
    if (response.success) {
      return { success: true, result: `Table added. Shape index: ${response['shape_index']}` };
    }
    return { success: false, error: response.error || 'Failed to add table' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptAddTableTool: LLMSimpleTool = {
  definition: PPT_ADD_TABLE_DEFINITION, execute: executePPTAddTable, categories: OFFICE_CATEGORIES, description: 'Add table in PowerPoint',
};

// =============================================================================
// PowerPoint Set Table Cell
// =============================================================================

const PPT_SET_TABLE_CELL_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_table_cell',
    description: `Set text and formatting for a table cell.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are updating this cell' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Table shape index' },
        row: { type: 'number', description: 'Row number (1-based)' },
        col: { type: 'number', description: 'Column number (1-based)' },
        text: { type: 'string', description: 'Cell text' },
        font_name: { type: 'string', description: 'Font name (optional)' },
        font_size: { type: 'number', description: 'Font size (optional)' },
        bold: { type: 'boolean', description: 'Bold (optional)' },
        fill_color: { type: 'string', description: 'Cell fill color as hex (optional)' },
      },
      required: ['reason', 'slide_number', 'shape_index', 'row', 'col', 'text'],
    },
  },
};

async function executePPTSetTableCell(args: Record<string, unknown>): Promise<ToolResult> {
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
    if (response.success) { return { success: true, result: 'Table cell updated' }; }
    return { success: false, error: response.error || 'Failed to set table cell' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptSetTableCellTool: LLMSimpleTool = {
  definition: PPT_SET_TABLE_CELL_DEFINITION, execute: executePPTSetTableCell, categories: OFFICE_CATEGORIES, description: 'Set table cell in PowerPoint',
};

// =============================================================================
// PowerPoint Set Table Style
// =============================================================================

const PPT_SET_TABLE_STYLE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_set_table_style',
    description: `Set table style (borders, header fill, alternating rows).`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are styling the table' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Table shape index' },
        border_color: { type: 'string', description: 'Border color as hex' },
        border_width: { type: 'number', description: 'Border width in points' },
        header_row_fill: { type: 'string', description: 'Header row fill color as hex' },
        alternate_row_fill: { type: 'string', description: 'Alternate row fill color as hex' },
      },
      required: ['reason', 'slide_number', 'shape_index'],
    },
  },
};

async function executePPTSetTableStyle(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointSetTableStyle(
      args['slide_number'] as number,
      args['shape_index'] as number,
      {
        borderColor: args['border_color'] as string | undefined,
        borderWidth: args['border_width'] as number | undefined,
        headerRowFill: args['header_row_fill'] as string | undefined,
        alternateRowFill: args['alternate_row_fill'] as string | undefined,
      }
    );
    if (response.success) { return { success: true, result: 'Table style updated' }; }
    return { success: false, error: response.error || 'Failed to set table style' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const pptSetTableStyleTool: LLMSimpleTool = {
  definition: PPT_SET_TABLE_STYLE_DEFINITION, execute: executePPTSetTableStyle, categories: OFFICE_CATEGORIES, description: 'Set table style in PowerPoint',
};

// =============================================================================
// Export Table Tools
// =============================================================================

export const tablesTools: LLMSimpleTool[] = [
  pptAddTableTool,
  pptSetTableCellTool,
  pptSetTableStyleTool,
];
