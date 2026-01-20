/**
 * Excel Formatting Tools
 *
 * Formatting operations: setFont, setAlignment, setColumnWidth, setRowHeight,
 * mergeCells, unmergeCells, setBorder, setFill, setNumberFormat
 * Total: 9 tools
 */

import { ToolDefinition } from '../../../llm-client';
import { LLMSimpleTool, ToolResult } from '../common/types';
import { OFFICE_CATEGORIES } from '../common/constants';
import { excelClient } from '../../office';

// =============================================================================
// Excel Set Font
// =============================================================================

const EXCEL_SET_FONT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_set_font',
    description: `Set font properties for a range.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are changing font' },
        range: { type: 'string', description: 'Cell or range (e.g., "A1" or "A1:B10")' },
        font_name: { type: 'string', description: 'Font name' },
        font_size: { type: 'number', description: 'Font size' },
        bold: { type: 'boolean', description: 'Bold text' },
        italic: { type: 'boolean', description: 'Italic text' },
        underline: { type: 'boolean', description: 'Underline text' },
        color: { type: 'string', description: 'Font color as hex' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'range'],
    },
  },
};

async function executeExcelSetFont(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelSetFont(args['range'] as string, {
      fontName: args['font_name'] as string | undefined,
      fontSize: args['font_size'] as number | undefined,
      bold: args['bold'] as boolean | undefined,
      italic: args['italic'] as boolean | undefined,
      underline: args['underline'] as boolean | undefined,
      color: args['color'] as string | undefined,
    });
    if (response.success) { return { success: true, result: 'Font properties updated' }; }
    return { success: false, error: response.error || 'Failed to set font' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelSetFontTool: LLMSimpleTool = {
  definition: EXCEL_SET_FONT_DEFINITION, execute: executeExcelSetFont, categories: OFFICE_CATEGORIES, description: 'Set font in Excel',
};

// =============================================================================
// Excel Set Alignment
// =============================================================================

const EXCEL_SET_ALIGNMENT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_set_alignment',
    description: `Set text alignment for a range.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are changing alignment' },
        range: { type: 'string', description: 'Cell or range' },
        horizontal: { type: 'string', enum: ['left', 'center', 'right', 'justify'], description: 'Horizontal alignment' },
        vertical: { type: 'string', enum: ['top', 'center', 'bottom'], description: 'Vertical alignment' },
        wrap_text: { type: 'boolean', description: 'Wrap text in cell' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'range'],
    },
  },
};

async function executeExcelSetAlignment(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelSetAlignment(args['range'] as string, {
      horizontal: args['horizontal'] as 'left' | 'center' | 'right' | undefined,
      vertical: args['vertical'] as 'top' | 'center' | 'bottom' | undefined,
      wrapText: args['wrap_text'] as boolean | undefined,
    });
    if (response.success) { return { success: true, result: 'Alignment updated' }; }
    return { success: false, error: response.error || 'Failed to set alignment' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelSetAlignmentTool: LLMSimpleTool = {
  definition: EXCEL_SET_ALIGNMENT_DEFINITION, execute: executeExcelSetAlignment, categories: OFFICE_CATEGORIES, description: 'Set alignment in Excel',
};

// =============================================================================
// Excel Set Column Width
// =============================================================================

const EXCEL_SET_COLUMN_WIDTH_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_set_column_width',
    description: `Set column width or auto-fit.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are changing column width' },
        column: { type: 'string', description: 'Column letter (e.g., "A", "B")' },
        width: { type: 'number', description: 'Width in characters (optional if auto_fit is true)' },
        auto_fit: { type: 'boolean', description: 'Auto-fit column width' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'column'],
    },
  },
};

async function executeExcelSetColumnWidth(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelSetColumnWidth(
      args['column'] as string, args['width'] as number | undefined, args['auto_fit'] as boolean | undefined, args['sheet'] as string | undefined
    );
    if (response.success) { return { success: true, result: `Column ${args['column']} width set` }; }
    return { success: false, error: response.error || 'Failed to set column width' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelSetColumnWidthTool: LLMSimpleTool = {
  definition: EXCEL_SET_COLUMN_WIDTH_DEFINITION, execute: executeExcelSetColumnWidth, categories: OFFICE_CATEGORIES, description: 'Set column width in Excel',
};

// =============================================================================
// Excel Set Row Height
// =============================================================================

const EXCEL_SET_ROW_HEIGHT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_set_row_height',
    description: `Set row height or auto-fit.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are changing row height' },
        row: { type: 'number', description: 'Row number (1-based)' },
        height: { type: 'number', description: 'Height in points (optional if auto_fit is true)' },
        auto_fit: { type: 'boolean', description: 'Auto-fit row height' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'row'],
    },
  },
};

async function executeExcelSetRowHeight(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelSetRowHeight(
      args['row'] as number, args['height'] as number | undefined, args['auto_fit'] as boolean | undefined, args['sheet'] as string | undefined
    );
    if (response.success) { return { success: true, result: `Row ${args['row']} height set` }; }
    return { success: false, error: response.error || 'Failed to set row height' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelSetRowHeightTool: LLMSimpleTool = {
  definition: EXCEL_SET_ROW_HEIGHT_DEFINITION, execute: executeExcelSetRowHeight, categories: OFFICE_CATEGORIES, description: 'Set row height in Excel',
};

// =============================================================================
// Excel Merge Cells
// =============================================================================

const EXCEL_MERGE_CELLS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_merge_cells',
    description: `Merge cells in a range.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are merging cells' },
        range: { type: 'string', description: 'Range to merge (e.g., "A1:C1")' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'range'],
    },
  },
};

async function executeExcelMergeCells(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelMergeCells(args['range'] as string, args['sheet'] as string | undefined);
    if (response.success) { return { success: true, result: `Cells merged: ${args['range']}` }; }
    return { success: false, error: response.error || 'Failed to merge cells' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelMergeCellsTool: LLMSimpleTool = {
  definition: EXCEL_MERGE_CELLS_DEFINITION, execute: executeExcelMergeCells, categories: OFFICE_CATEGORIES, description: 'Merge cells in Excel',
};

// =============================================================================
// Excel Unmerge Cells
// =============================================================================

const EXCEL_UNMERGE_CELLS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_unmerge_cells',
    description: `Unmerge cells in a range.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are unmerging cells' },
        range: { type: 'string', description: 'Range to unmerge' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'range'],
    },
  },
};

async function executeExcelUnmergeCells(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelUnmergeCells(args['range'] as string, args['sheet'] as string | undefined);
    if (response.success) { return { success: true, result: 'Cells unmerged' }; }
    return { success: false, error: response.error || 'Failed to unmerge cells' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelUnmergeCellsTool: LLMSimpleTool = {
  definition: EXCEL_UNMERGE_CELLS_DEFINITION, execute: executeExcelUnmergeCells, categories: OFFICE_CATEGORIES, description: 'Unmerge cells in Excel',
};

// =============================================================================
// Excel Set Border
// =============================================================================

const EXCEL_SET_BORDER_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_set_border',
    description: `Set border for a range.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting border' },
        range: { type: 'string', description: 'Cell or range' },
        style: { type: 'string', enum: ['thin', 'medium', 'thick', 'dashed', 'double', 'none'], description: 'Border style' },
        color: { type: 'string', description: 'Border color as hex' },
        edges: { type: 'string', enum: ['all', 'outline', 'inside'], description: 'Which edges to apply border to' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'range'],
    },
  },
};

async function executeExcelSetBorder(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const edgesArg = args['edges'] as string | undefined;
    const edges = edgesArg === 'all' ? ['all'] : edgesArg === 'outline' ? ['top', 'bottom', 'left', 'right'] : edgesArg === 'inside' ? ['all'] : undefined;
    const response = await excelClient.excelSetBorder(args['range'] as string, {
      style: args['style'] as 'thin' | 'medium' | 'thick' | 'dashed' | 'double' | 'dotted' | undefined,
      color: args['color'] as string | undefined,
      edges: edges as ('all' | 'left' | 'right' | 'top' | 'bottom')[] | undefined,
    });
    if (response.success) { return { success: true, result: 'Border set' }; }
    return { success: false, error: response.error || 'Failed to set border' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelSetBorderTool: LLMSimpleTool = {
  definition: EXCEL_SET_BORDER_DEFINITION, execute: executeExcelSetBorder, categories: OFFICE_CATEGORIES, description: 'Set border in Excel',
};

// =============================================================================
// Excel Set Fill
// =============================================================================

const EXCEL_SET_FILL_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_set_fill',
    description: `Set background fill color for a range.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting fill color' },
        range: { type: 'string', description: 'Cell or range' },
        color: { type: 'string', description: 'Fill color as hex (e.g., "#FFFF00")' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'range', 'color'],
    },
  },
};

async function executeExcelSetFill(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelSetFill(args['range'] as string, args['color'] as string, args['sheet'] as string | undefined);
    if (response.success) { return { success: true, result: `Fill color set for ${args['range']}` }; }
    return { success: false, error: response.error || 'Failed to set fill' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelSetFillTool: LLMSimpleTool = {
  definition: EXCEL_SET_FILL_DEFINITION, execute: executeExcelSetFill, categories: OFFICE_CATEGORIES, description: 'Set fill color in Excel',
};

// =============================================================================
// Excel Set Number Format
// =============================================================================

const EXCEL_SET_NUMBER_FORMAT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'excel_set_number_format',
    description: `Set number format for a range.`,
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Why you are setting number format' },
        range: { type: 'string', description: 'Cell or range' },
        format: { type: 'string', description: 'Number format (e.g., "#,##0.00", "0%", "yyyy-mm-dd")' },
        sheet: { type: 'string', description: 'Sheet name (optional)' },
      },
      required: ['reason', 'range', 'format'],
    },
  },
};

async function executeExcelSetNumberFormat(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const response = await excelClient.excelSetNumberFormat(args['range'] as string, args['format'] as string, args['sheet'] as string | undefined);
    if (response.success) { return { success: true, result: `Number format set for ${args['range']}` }; }
    return { success: false, error: response.error || 'Failed to set number format' };
  } catch (error) {
    return { success: false, error: `Failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export const excelSetNumberFormatTool: LLMSimpleTool = {
  definition: EXCEL_SET_NUMBER_FORMAT_DEFINITION, execute: executeExcelSetNumberFormat, categories: OFFICE_CATEGORIES, description: 'Set number format in Excel',
};

// =============================================================================
// Export Formatting Tools
// =============================================================================

export const formattingTools: LLMSimpleTool[] = [
  excelSetFontTool,
  excelSetAlignmentTool,
  excelSetColumnWidthTool,
  excelSetRowHeightTool,
  excelMergeCellsTool,
  excelUnmergeCellsTool,
  excelSetBorderTool,
  excelSetFillTool,
  excelSetNumberFormatTool,
];
