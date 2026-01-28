/**
 * PowerPoint Table Tools
 *
 * Tools for adding and managing tables in PowerPoint slides.
 */

import { ToolDefinition } from '../../../types/index.js';
import { LLMSimpleTool, ToolResult } from '../../types.js';
import { powerpointClient } from '../powerpoint-client.js';
import { OFFICE_CATEGORIES } from '../common/constants.js';

// =============================================================================
// PowerPoint Add Table
// =============================================================================

const POWERPOINT_ADD_TABLE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_add_table',
    description: `Add a table to a slide. If data is not provided, use powerpoint_set_table_cell to populate cells individually.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding this table' },
        slide_number: { type: 'number', description: 'Slide number (1-indexed)' },
        rows: { type: 'number', description: 'Number of rows' },
        cols: { type: 'number', description: 'Number of columns' },
        left: { type: 'number', description: 'Left position in points (default: 100)' },
        top: { type: 'number', description: 'Top position in points (default: 100)' },
        width: { type: 'number', description: 'Table width in points (default: 400)' },
        height: { type: 'number', description: 'Table height in points (default: 200)' },
        data: { type: 'array', description: '2D array of cell values', items: { type: 'array', items: { type: 'string' } } },
      },
      required: ['reason', 'slide_number', 'rows', 'cols'],
    },
  },
};

async function executePowerPointAddTable(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const slideNum = Number(args['slide_number']);
    const rows = Number(args['rows']);
    const cols = Number(args['cols']);
    const response = await powerpointClient.powerpointAddTable(
      slideNum,
      rows,
      cols,
      args['left'] != null ? Number(args['left']) : undefined,
      args['top'] != null ? Number(args['top']) : undefined,
      args['width'] != null ? Number(args['width']) : undefined,
      args['height'] != null ? Number(args['height']) : undefined,
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
        reason: { type: 'string', description: 'Why you are setting this table cell' },
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
      required: ['reason', 'slide_number', 'shape_index', 'row', 'col', 'text'],
    },
  },
};

async function executePowerPointSetTableCell(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const slideNum = Number(args['slide_number']);
    const shapeIndex = Number(args['shape_index']);
    const row = Number(args['row']);
    const col = Number(args['col']);
    const response = await powerpointClient.powerpointSetTableCell(
      slideNum,
      shapeIndex,
      row,
      col,
      args['text'] as string,
      {
        fontName: args['font_name'] as string | undefined,
        fontSize: args['font_size'] != null ? Number(args['font_size']) : undefined,
        bold: args['bold'] != null ? Boolean(args['bold']) : undefined,
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
        reason: { type: 'string', description: 'Why you are setting this table style' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Table shape index' },
        border_color: { type: 'string', description: 'Border color (hex: #RRGGBB)' },
        header_row_fill: { type: 'string', description: 'Header row background color (hex)' },
        alternate_row_fill: { type: 'string', description: 'Alternating row background color (hex)' },
      },
      required: ['reason', 'slide_number', 'shape_index'],
    },
  },
};

async function executePowerPointSetTableStyle(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const slideNum = Number(args['slide_number']);
    const shapeIndex = Number(args['shape_index']);
    const response = await powerpointClient.powerpointSetTableStyle(
      slideNum,
      shapeIndex,
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
// PowerPoint Merge Table Cells
// =============================================================================

const POWERPOINT_MERGE_TABLE_CELLS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_merge_table_cells',
    description: `Merge a range of table cells.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are merging cells' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Table shape index' },
        start_row: { type: 'number', description: 'Start row (1-indexed)' },
        start_col: { type: 'number', description: 'Start column (1-indexed)' },
        end_row: { type: 'number', description: 'End row (1-indexed)' },
        end_col: { type: 'number', description: 'End column (1-indexed)' },
      },
      required: ['reason', 'slide_number', 'shape_index', 'start_row', 'start_col', 'end_row', 'end_col'],
    },
  },
};

async function executePowerPointMergeTableCells(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointMergeTableCells(
      Number(args['slide_number']),
      Number(args['shape_index']),
      Number(args['start_row']),
      Number(args['start_col']),
      Number(args['end_row']),
      Number(args['end_col'])
    );
    if (response.success) {
      return { success: true, result: response.message || 'Cells merged' };
    }
    return { success: false, error: response.error || 'Failed to merge cells' };
  } catch (error) {
    return { success: false, error: `Failed to merge cells: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointMergeTableCellsTool: LLMSimpleTool = {
  definition: POWERPOINT_MERGE_TABLE_CELLS_DEFINITION,
  execute: executePowerPointMergeTableCells,
  categories: OFFICE_CATEGORIES,
  description: 'Merge table cells',
};

// =============================================================================
// PowerPoint Add Table Row
// =============================================================================

const POWERPOINT_ADD_TABLE_ROW_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_add_table_row',
    description: `Add a row to a table.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding a row' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Table shape index' },
        position: { type: 'number', description: 'Position to insert row (1-indexed, default: end)' },
      },
      required: ['reason', 'slide_number', 'shape_index'],
    },
  },
};

async function executePowerPointAddTableRow(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointAddTableRow(
      Number(args['slide_number']),
      Number(args['shape_index']),
      args['position'] != null ? Number(args['position']) : undefined
    );
    if (response.success) {
      return { success: true, result: `${response.message}. Total rows: ${response['row_count']}` };
    }
    return { success: false, error: response.error || 'Failed to add row' };
  } catch (error) {
    return { success: false, error: `Failed to add row: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointAddTableRowTool: LLMSimpleTool = {
  definition: POWERPOINT_ADD_TABLE_ROW_DEFINITION,
  execute: executePowerPointAddTableRow,
  categories: OFFICE_CATEGORIES,
  description: 'Add table row',
};

// =============================================================================
// PowerPoint Add Table Column
// =============================================================================

const POWERPOINT_ADD_TABLE_COLUMN_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_add_table_column',
    description: `Add a column to a table.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are adding a column' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Table shape index' },
        position: { type: 'number', description: 'Position to insert column (1-indexed, default: end)' },
      },
      required: ['reason', 'slide_number', 'shape_index'],
    },
  },
};

async function executePowerPointAddTableColumn(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointAddTableColumn(
      Number(args['slide_number']),
      Number(args['shape_index']),
      args['position'] != null ? Number(args['position']) : undefined
    );
    if (response.success) {
      return { success: true, result: `${response.message}. Total columns: ${response['column_count']}` };
    }
    return { success: false, error: response.error || 'Failed to add column' };
  } catch (error) {
    return { success: false, error: `Failed to add column: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointAddTableColumnTool: LLMSimpleTool = {
  definition: POWERPOINT_ADD_TABLE_COLUMN_DEFINITION,
  execute: executePowerPointAddTableColumn,
  categories: OFFICE_CATEGORIES,
  description: 'Add table column',
};

// =============================================================================
// PowerPoint Delete Table Row
// =============================================================================

const POWERPOINT_DELETE_TABLE_ROW_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_delete_table_row',
    description: `Delete a row from a table.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are deleting this row' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Table shape index' },
        row_index: { type: 'number', description: 'Row to delete (1-indexed)' },
      },
      required: ['reason', 'slide_number', 'shape_index', 'row_index'],
    },
  },
};

async function executePowerPointDeleteTableRow(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointDeleteTableRow(
      Number(args['slide_number']),
      Number(args['shape_index']),
      Number(args['row_index'])
    );
    if (response.success) {
      return { success: true, result: `${response.message}. Remaining rows: ${response['row_count']}` };
    }
    return { success: false, error: response.error || 'Failed to delete row' };
  } catch (error) {
    return { success: false, error: `Failed to delete row: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointDeleteTableRowTool: LLMSimpleTool = {
  definition: POWERPOINT_DELETE_TABLE_ROW_DEFINITION,
  execute: executePowerPointDeleteTableRow,
  categories: OFFICE_CATEGORIES,
  description: 'Delete table row',
};

// =============================================================================
// PowerPoint Delete Table Column
// =============================================================================

const POWERPOINT_DELETE_TABLE_COLUMN_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_delete_table_column',
    description: `Delete a column from a table.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are deleting this column' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Table shape index' },
        col_index: { type: 'number', description: 'Column to delete (1-indexed)' },
      },
      required: ['reason', 'slide_number', 'shape_index', 'col_index'],
    },
  },
};

async function executePowerPointDeleteTableColumn(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointDeleteTableColumn(
      Number(args['slide_number']),
      Number(args['shape_index']),
      Number(args['col_index'])
    );
    if (response.success) {
      return { success: true, result: `${response.message}. Remaining columns: ${response['column_count']}` };
    }
    return { success: false, error: response.error || 'Failed to delete column' };
  } catch (error) {
    return { success: false, error: `Failed to delete column: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointDeleteTableColumnTool: LLMSimpleTool = {
  definition: POWERPOINT_DELETE_TABLE_COLUMN_DEFINITION,
  execute: executePowerPointDeleteTableColumn,
  categories: OFFICE_CATEGORIES,
  description: 'Delete table column',
};

// =============================================================================
// PowerPoint Get Table Info
// =============================================================================

const POWERPOINT_GET_TABLE_INFO_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'powerpoint_get_table_info',
    description: `Get information about a table including dimensions and cell contents.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you need table information' },
        slide_number: { type: 'number', description: 'Slide number' },
        shape_index: { type: 'number', description: 'Table shape index' },
      },
      required: ['reason', 'slide_number', 'shape_index'],
    },
  },
};

async function executePowerPointGetTableInfo(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await powerpointClient.powerpointGetTableInfo(
      Number(args['slide_number']),
      Number(args['shape_index'])
    );
    if (response.success) {
      return { success: true, result: JSON.stringify(response, null, 2) };
    }
    return { success: false, error: response.error || 'Failed to get table info' };
  } catch (error) {
    return { success: false, error: `Failed to get table info: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const powerpointGetTableInfoTool: LLMSimpleTool = {
  definition: POWERPOINT_GET_TABLE_INFO_DEFINITION,
  execute: executePowerPointGetTableInfo,
  categories: OFFICE_CATEGORIES,
  description: 'Get table information',
};

// =============================================================================
// Export
// =============================================================================

export const tablesTools: LLMSimpleTool[] = [
  powerpointAddTableTool,
  powerpointSetTableCellTool,
  powerpointSetTableStyleTool,
  powerpointMergeTableCellsTool,
  powerpointAddTableRowTool,
  powerpointAddTableColumnTool,
  powerpointDeleteTableRowTool,
  powerpointDeleteTableColumnTool,
  powerpointGetTableInfoTool,
];
